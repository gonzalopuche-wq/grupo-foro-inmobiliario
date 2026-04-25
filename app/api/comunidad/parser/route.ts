import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Grupos que van al MIR y su tipo de operación
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

// Subtipo por grupo
const SUBTIPO_POR_GRUPO: Record<string, "ofrecido" | "busqueda"> = {
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
    const title =
      html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ??
      html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
    const description =
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ??
      html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
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

    const subtipoPorGrupo = SUBTIPO_POR_GRUPO[grupo_id] ?? "ofrecido";

    // Si el mensaje es solo un link, enriquecer con metadata
    let textoParaParser = texto;
    const urlMatch = texto.trim().match(/^https?:\/\/\S+$/);
    if (urlMatch) {
      const preview = await fetchLinkPreview(urlMatch[0]);
      if (preview?.title || preview?.description) {
        textoParaParser = `${preview.title ?? ""}\n${preview.description ?? ""}\nURL: ${texto}`;
      }
    }

    // Contexto del grupo para la IA
    const contextoGrupo =
      subtipoPorGrupo === "ofrecido"
        ? "Este mensaje viene del grupo de OFRECIDOS — es una propiedad disponible para venta/alquiler."
        : "Este mensaje viene del grupo de BÚSQUEDAS — alguien está buscando una propiedad.";

    // Parser IA
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Sos un parser de mensajes inmobiliarios. Analizá este mensaje de un corredor de Rosario, Argentina.

${contextoGrupo}

MENSAJE: "${textoParaParser}"
GRUPO: ${grupo_id}

IMPORTANTE:
- Si contiene datos de una propiedad (incluso solo un link de portal inmobiliario), clasificalo como operación.
- Links de portales (zonaprop, argenprop, mercadolibre, kiteprop, mariopuche, properati, navent) SIEMPRE son operaciones.
- Booleans deben ser true/false, nunca strings.
- Para "caracteristicas" devolvé un array de strings con lo que encuentres (ej: ["pileta","parrilla","cochera"]) o [].

Respondé SOLO con JSON válido, sin texto adicional:

Si ES una operación:
{
  "es_operacion": true,
  "tipo_propiedad": "departamento|casa|local|terreno|campo|garage|cochera|oficina|ph|otro",
  "operacion": "venta|alquiler|alquiler_temporario|permuta",
  "dormitorios": número o null,
  "ambientes": número o null,
  "zona": "barrio o zona mencionada" o null,
  "ciudad": "Rosario" (default si no se menciona otra),
  "precio": número o null,
  "moneda": "USD|ARS" o null,
  "superficie_total": número o null,
  "superficie_cubierta": número o null,
  "superficie_min": número o null,
  "tipo_superficie": "cubierta|total|terreno" o null,
  "antiguedad": "a estrenar|reciclada|a reciclar|bueno|muy bueno|excelente" o null,
  "apto_credito": true o false,
  "acepta_mascotas": true o false,
  "acepta_bitcoin": true o false,
  "barrio_cerrado": true o false,
  "uso_comercial": true o false,
  "con_cochera": true o false,
  "caracteristicas": [],
  "descripcion_corta": "resumen en máximo 80 caracteres"
}

Si NO es una operación (charla, consulta, saludo, etc.):
{
  "es_operacion": false
}`,
        },
      ],
    });

    let parsed: any;
    try {
      const content =
        response.content[0].type === "text" ? response.content[0].text : "";
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ cargado: false, motivo: "parse_error" });
    }

    if (!parsed.es_operacion) {
      // Si es grupo operacional y tiene link de portal, forzar carga mínima
      const tienePortal =
        /zonaprop|argenprop|mercadolibre|kiteprop|mariopuche|properati|navent/i.test(
          texto
        );

      if (!tienePortal) {
        return NextResponse.json({ cargado: false, motivo: "no_es_operacion" });
      }

      parsed = {
        es_operacion: true,
        tipo_propiedad: "otro",
        operacion: tipoOperacion,
        descripcion_corta: texto.substring(0, 80),
        apto_credito: false,
        acepta_mascotas: false,
        acepta_bitcoin: false,
        barrio_cerrado: false,
        uso_comercial: false,
        con_cochera: false,
        caracteristicas: [],
      };
    }

    // ── Insertar en la tabla correcta según subtipo ──────────────────────────
    const tabla = subtipoPorGrupo === "ofrecido" ? "mir_ofrecidos" : "mir_busquedas";

    const payload = {
      perfil_id:         user_id,
      operacion:         parsed.operacion ?? tipoOperacion,
      tipo_propiedad:    parsed.tipo_propiedad ?? "otro",
      zona:              parsed.zona ?? null,
      ciudad:            parsed.ciudad ?? "Rosario",
      precio:            parsed.precio ?? null,
      moneda:            parsed.moneda ?? null,
      ambientes:         parsed.ambientes ?? null,
      dormitorios:       parsed.dormitorios ?? null,
      superficie_total:  parsed.superficie_total ?? null,
      superficie_cubierta: parsed.superficie_cubierta ?? null,
      superficie_min:    parsed.superficie_min ?? null,
      tipo_superficie:   parsed.tipo_superficie ?? null,
      antiguedad:        parsed.antiguedad ?? null,
      apto_credito:      parsed.apto_credito ?? false,
      acepta_mascotas:   parsed.acepta_mascotas ?? false,
      acepta_bitcoin:    parsed.acepta_bitcoin ?? false,
      barrio_cerrado:    parsed.barrio_cerrado ?? false,
      uso_comercial:     parsed.uso_comercial ?? false,
      con_cochera:       parsed.con_cochera ?? false,
      caracteristicas:   parsed.caracteristicas ?? [],
      descripcion:       texto,
      activo:            true,
    };

    const { data: mirEntry, error: mirError } = await supabaseAdmin
      .from(tabla)
      .insert(payload)
      .select("id")
      .single();

    if (mirError) {
      console.error(`Error insertando en ${tabla}:`, mirError);
      return NextResponse.json({ cargado: false, motivo: "db_error", detalle: mirError.message });
    }

    // Actualizar el mensaje con referencia al MIR
    if (mirEntry) {
      await supabaseAdmin
        .from("mensajes_chat")
        .update({
          tipo:     subtipoPorGrupo,
          mir_id:   mirEntry.id,
          mir_tipo: subtipoPorGrupo,
        })
        .eq("id", mensaje_id);
    }

    return NextResponse.json({
      cargado:  true,
      tipo:     subtipoPorGrupo,
      tabla,
      mir_id:   mirEntry?.id,
    });
  } catch (err) {
    console.error("Error parser comunidad:", err);
    return NextResponse.json({ cargado: false, motivo: "error_interno" });
  }
}
