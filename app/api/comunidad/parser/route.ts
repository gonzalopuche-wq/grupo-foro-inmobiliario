import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const GRUPOS_MIR: Record<string, string> = {
  "ventas-ofrecidos":       "venta",
  "ventas-busqueda":        "venta",
  "alquileres-ofrecidos":   "alquiler",
  "alquileres-busqueda":    "alquiler",
  "alquileres-temporarios": "alquiler_temporario",
  "permutas":               "permuta",
  "campos-chacras":         "campo",
  "inmuebles-comerciales":  "comercial",
  "fondos-comercio":        "fondo_comercio",
  "ventas-vehiculos":       "vehiculo",
};

// Inferir subtipo por nombre del grupo
const SUBTIPO_POR_GRUPO: Record<string, string> = {
  "ventas-ofrecidos":       "ofrecido",
  "ventas-busqueda":        "busqueda",
  "alquileres-ofrecidos":   "ofrecido",
  "alquileres-busqueda":    "busqueda",
  "alquileres-temporarios": "ofrecido",
  "permutas":               "ofrecido",
  "campos-chacras":         "ofrecido",
  "inmuebles-comerciales":  "ofrecido",
  "fondos-comercio":        "ofrecido",
  "ventas-vehiculos":       "ofrecido",
};

async function fetchLinkPreview(url: string): Promise<{ title?: string; description?: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    });
    const html = await res.text();
    const title = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
      ?? html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
    const description = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]
      ?? html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    return { title, description };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { texto, grupo_id, user_id, mensaje_id } = await req.json();

    // Verificar que el grupo va al MIR
    const tipoOperacion = GRUPOS_MIR[grupo_id];
    if (!tipoOperacion) {
      return NextResponse.json({ cargado: false, motivo: "grupo_no_mir" });
    }

    // Si el mensaje es solo un link, enriquecer con metadata del link
    let textoParaParser = texto;
    const urlMatch = texto.trim().match(/^https?:\/\/\S+$/);
    if (urlMatch) {
      const preview = await fetchLinkPreview(urlMatch[0]);
      if (preview?.title || preview?.description) {
        textoParaParser = `${preview.title ?? ""}\n${preview.description ?? ""}\nURL: ${texto}`;
      }
      // Si no se puede obtener preview, igual intentar con el contexto del grupo
    }

    // Contexto del grupo para ayudar a la IA
    const contextoGrupo = grupo_id.includes("ofrecidos")
      ? "Este mensaje viene del grupo de OFRECIDOS — probablemente es una propiedad en venta/alquiler."
      : grupo_id.includes("busqueda") || grupo_id.includes("búsqueda")
      ? "Este mensaje viene del grupo de BÚSQUEDAS — probablemente alguien busca una propiedad."
      : "";

    // Parser IA
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Sos un parser de mensajes inmobiliarios. Analizá este mensaje de un corredor inmobiliario de Rosario, Argentina.

${contextoGrupo}

MENSAJE: "${textoParaParser}"
GRUPO: ${grupo_id}

IMPORTANTE: Si el mensaje contiene datos de una propiedad (aunque sea solo un link con título de propiedad), clasificalo como operación. Los links de portales inmobiliarios (zonaprop, argenprop, mercadolibre, kiteprop, mariopuche, etc.) SIEMPRE son operaciones inmobiliarias.

Respondé SOLO con JSON válido, sin texto adicional:

Si ES una operación:
{
  "es_operacion": true,
  "subtipo": "ofrecido" | "busqueda",
  "tipo_inmueble": "departamento|casa|local|terreno|campo|vehiculo|otro",
  "operacion": "venta|alquiler|alquiler_temporario|permuta|campo|comercial|fondo_comercio|vehiculo",
  "dormitorios": número o null,
  "zona": "zona/barrio mencionado o null",
  "precio": número o null,
  "moneda": "USD|ARS|null",
  "superficie": número o null,
  "descripcion_corta": "resumen en máximo 80 caracteres"
}

Si NO es una operación (es charla, consulta, saludo, etc.):
{
  "es_operacion": false
}`
      }]
    });

    let parsed: any;
    try {
      const content = response.content[0].type === "text" ? response.content[0].text : "";
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ cargado: false, motivo: "parse_error" });
    }

    if (!parsed.es_operacion) {
      // Si el grupo es de ofrecidos/búsquedas y tiene un link de portal, forzar la carga
      const esGrupoOperacional = !!tipoOperacion;
      const tienePortal = /zonaprop|argenprop|mercadolibre|kiteprop|mariopuche|properati|navent/i.test(texto);
      
      if (!(esGrupoOperacional && tienePortal)) {
        return NextResponse.json({ cargado: false, motivo: "no_es_operacion" });
      }
      
      // Forzar con datos mínimos del grupo
      parsed = {
        es_operacion: true,
        subtipo: SUBTIPO_POR_GRUPO[grupo_id] ?? "ofrecido",
        tipo_inmueble: "otro",
        operacion: tipoOperacion,
        descripcion_corta: texto.substring(0, 80),
      };
    }

    // Si la IA no determinó el subtipo, usar el del grupo
    if (!parsed.subtipo) {
      parsed.subtipo = SUBTIPO_POR_GRUPO[grupo_id] ?? "ofrecido";
    }

    // Cargar al MIR
    const { data: mirEntry } = await supabaseAdmin
      .from("mir")
      .insert({
        user_id,
        subtipo: parsed.subtipo,
        operacion: parsed.operacion ?? tipoOperacion,
        tipo_inmueble: parsed.tipo_inmueble ?? "otro",
        dormitorios: parsed.dormitorios ?? null,
        zona: parsed.zona ?? null,
        precio: parsed.precio ?? null,
        moneda: parsed.moneda ?? null,
        superficie: parsed.superficie ?? null,
        descripcion: texto,
        descripcion_corta: parsed.descripcion_corta ?? texto.substring(0, 80),
        origen: "chat",
        grupo_id,
        activo: true,
      })
      .select("id")
      .single();

    // Actualizar el mensaje con referencia al MIR
    if (mirEntry) {
      await supabaseAdmin
        .from("mensajes_chat")
        .update({
          tipo: parsed.subtipo,
          mir_id: mirEntry.id,
          mir_tipo: parsed.subtipo,
        })
        .eq("id", mensaje_id);
    }

    return NextResponse.json({
      cargado: true,
      tipo: parsed.subtipo,
      mir_id: mirEntry?.id,
    });

  } catch (err) {
    console.error("Error parser comunidad:", err);
    return NextResponse.json({ cargado: false, motivo: "error_interno" });
  }
}
