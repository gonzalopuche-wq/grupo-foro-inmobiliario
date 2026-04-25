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
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();
    const title =
      html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ??
      html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
    const description =
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ??
      html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    return { title: title.trim(), description: description.trim() };
  } catch {
    return null;
  }
}

// Extraer datos inmobiliarios directamente de la URL (slug del portal)
function extraerDatosDeUrl(url: string): string {
  try {
    const slug = new URL(url).pathname;
    // Eliminar guiones y extraer palabras clave del slug
    const palabras = slug.replace(/[-_/]/g, " ").replace(/\d+/g, " $& ").trim();
    return `Propiedad en portal inmobiliario. Slug: ${palabras}`;
  } catch {
    return `Link de propiedad: ${url}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { texto, grupo_id, user_id, mensaje_id } = await req.json();

    const tipoOperacion = GRUPOS_MIR[grupo_id];
    if (!tipoOperacion) {
      return NextResponse.json({ cargado: false, motivo: "grupo_no_mir" });
    }

    const subtipoPorGrupo = SUBTIPO_POR_GRUPO[grupo_id] ?? "ofrecido";
    const esOfrecido = subtipoPorGrupo === "ofrecido";

    // ── Estrategia de enriquecimiento ────────────────────────────────────────
    // 1. Texto con contenido descriptivo (con o sin link): usar el texto directamente
    // 2. Solo URL sin texto: intentar fetch, si falla usar slug de la URL
    const urlEnMensaje = texto.match(/https?:\/\/\S+/)?.[0];
    const textoSinUrl = texto.replace(/https?:\/\/\S+/g, "").trim();
    const esSoloUrl = urlEnMensaje && textoSinUrl.length < 10;

    let textoParaParser = texto;

    if (esSoloUrl && urlEnMensaje) {
      // Intentar fetch del link
      const preview = await fetchLinkPreview(urlEnMensaje);
      if (preview?.title || preview?.description) {
        textoParaParser = `${preview.title ?? ""}\n${preview.description ?? ""}\nURL: ${urlEnMensaje}`;
      } else {
        // Portal bloqueó el scraping — usar datos del slug
        textoParaParser = extraerDatosDeUrl(urlEnMensaje);
      }
    }
    // Si tiene texto descriptivo: usarlo tal cual — ya tiene toda la info necesaria

    const contextoGrupo = esOfrecido
      ? "Este mensaje viene del grupo de OFRECIDOS — es una propiedad disponible."
      : "Este mensaje viene del grupo de BÚSQUEDAS — alguien está buscando una propiedad.";

    // ── Prompts ──────────────────────────────────────────────────────────────
    const promptOfrecido = `Sos un parser de mensajes inmobiliarios de Rosario, Argentina y la región.
${contextoGrupo}

MENSAJE: "${textoParaParser}"
GRUPO: ${grupo_id}

INSTRUCCIONES:
- Extraé todos los datos que puedas del texto. Los corredores usan abreviaturas: "dorm" = dormitorios, "sup" = superficie, "cub" = cubierta, "m2" = metros cuadrados, "UDS/USD/U$S" = dólares, "$" = pesos.
- Localidades comunes: Rosario, Zavalla, Funes, Roldán, Granadero Baigorria, Pérez, Soldini, etc.
- Si mencionan precio con "USD/UDS/U$S", moneda = "USD". Si es "$" o "pesos", moneda = "ARS".
- Links de portales (zonaprop, argenprop, mercadolibre, kiteprop, mariopuche, ficha.info, red.propia, ladedapropiedades, properati, navent) SIEMPRE son operaciones.
- Booleans: true/false. "caracteristicas": array de strings.

Respondé SOLO con JSON válido, sin texto extra:

Si ES una operación:
{
  "es_operacion": true,
  "tipo_propiedad": "departamento|casa|local|terreno|campo|garage|cochera|oficina|ph|otro",
  "operacion": "venta|alquiler|alquiler_temporario|permuta",
  "dormitorios": número o null,
  "ambientes": número o null,
  "banos": número o null,
  "zona": "barrio, calle o zona" o null,
  "ciudad": "nombre de la ciudad/localidad o Rosario si no se menciona",
  "precio": número o null,
  "moneda": "USD|ARS" o null,
  "superficie_total": número o null,
  "superficie_cubierta": número o null,
  "tipo_superficie": "cubierta|total|terreno" o null,
  "antiguedad": "a estrenar|reciclada|a reciclar|bueno|muy bueno|excelente" o null,
  "apto_credito": true o false,
  "acepta_mascotas": true o false,
  "acepta_bitcoin": true o false,
  "barrio_cerrado": true o false,
  "uso_comercial": true o false,
  "con_cochera": true o false,
  "caracteristicas": [],
  "descripcion_corta": "máximo 80 caracteres resumiendo la propiedad"
}

Si NO es una operación: { "es_operacion": false }`;

    const promptBusqueda = `Sos un parser de mensajes inmobiliarios de Rosario, Argentina y la región.
${contextoGrupo}

MENSAJE: "${textoParaParser}"
GRUPO: ${grupo_id}

INSTRUCCIONES:
- Extraé todos los datos que puedas del texto. Los corredores usan abreviaturas: "dorm" = dormitorios, "sup" = superficie, "m2" = metros cuadrados, "UDS/USD/U$S" = dólares.
- Booleans: true/false. "caracteristicas": array de strings.

Respondé SOLO con JSON válido, sin texto extra:

Si ES una búsqueda:
{
  "es_operacion": true,
  "tipo_propiedad": "departamento|casa|local|terreno|campo|garage|cochera|oficina|ph|otro",
  "operacion": "venta|alquiler|alquiler_temporario|permuta",
  "dormitorios_min": número o null,
  "dormitorios_max": número o null,
  "ambientes_min": número o null,
  "banos_min": número o null,
  "banos_max": número o null,
  "zona": "barrio o zona" o null,
  "ciudad": "nombre de la ciudad/localidad o Rosario si no se menciona",
  "presupuesto_min": número o null,
  "presupuesto_max": número o null,
  "moneda": "USD|ARS" o null,
  "superficie_min": número o null,
  "superficie_max": número o null,
  "tipo_superficie": "cubierta|total|terreno" o null,
  "apto_credito": true o false,
  "acepta_mascotas": true o false,
  "acepta_bitcoin": true o false,
  "barrio_cerrado": true o false,
  "uso_comercial": true o false,
  "con_cochera": true o false,
  "caracteristicas": [],
  "descripcion_corta": "máximo 80 caracteres resumiendo la búsqueda"
}

Si NO es una búsqueda: { "es_operacion": false }`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{ role: "user", content: esOfrecido ? promptOfrecido : promptBusqueda }],
    });

    let parsed: any;
    try {
      const raw = response.content[0].type === "text" ? response.content[0].text : "";
      const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("parse_error raw:", response.content[0]);
      return NextResponse.json({ cargado: false, motivo: "parse_error" });
    }

    if (!parsed.es_operacion) {
      // Si es grupo MIR y tiene link de portal, forzar carga mínima
      const tienePortal =
        /zonaprop|argenprop|mercadolibre|kiteprop|mariopuche|properati|navent|ficha\.info|red\.propia|ladedapropiedades/i.test(texto);

      if (!tienePortal) {
        return NextResponse.json({ cargado: false, motivo: "no_es_operacion" });
      }

      parsed = {
        es_operacion: true,
        tipo_propiedad: "otro",
        operacion: tipoOperacion,
        descripcion_corta: textoSinUrl.substring(0, 80) || texto.substring(0, 80),
        apto_credito: false,
        acepta_mascotas: false,
        acepta_bitcoin: false,
        barrio_cerrado: false,
        uso_comercial: false,
        con_cochera: false,
        caracteristicas: [],
      };
    }

    // ── Payload según tabla ──────────────────────────────────────────────────
    let payload: Record<string, any>;
    let tabla: string;

    if (esOfrecido) {
      tabla = "mir_ofrecidos";
      payload = {
        perfil_id:           user_id,
        operacion:           parsed.operacion ?? tipoOperacion,
        tipo_propiedad:      parsed.tipo_propiedad ?? "otro",
        zona:                parsed.zona ?? null,
        ciudad:              parsed.ciudad ?? "Rosario",
        precio:              parsed.precio ?? null,
        moneda:              parsed.moneda ?? null,
        ambientes:           parsed.ambientes ?? null,
        dormitorios:         parsed.dormitorios ?? null,
        superficie_total:    parsed.superficie_total ?? null,
        superficie_cubierta: parsed.superficie_cubierta ?? null,
        superficie_min:      null,
        tipo_superficie:     parsed.tipo_superficie ?? null,
        antiguedad:          parsed.antiguedad ?? null,
        apto_credito:        parsed.apto_credito ?? false,
        acepta_mascotas:     parsed.acepta_mascotas ?? false,
        acepta_bitcoin:      parsed.acepta_bitcoin ?? false,
        barrio_cerrado:      parsed.barrio_cerrado ?? false,
        uso_comercial:       parsed.uso_comercial ?? false,
        con_cochera:         parsed.con_cochera ?? false,
        caracteristicas:     parsed.caracteristicas ?? [],
        descripcion:         texto,
        activo:              true,
      };
    } else {
      tabla = "mir_busquedas";
      payload = {
        perfil_id:       user_id,
        operacion:       parsed.operacion ?? tipoOperacion,
        tipo_propiedad:  parsed.tipo_propiedad ?? "otro",
        zona:            parsed.zona ?? null,
        ciudad:          parsed.ciudad ?? "Rosario",
        presupuesto_min: parsed.presupuesto_min ?? null,
        presupuesto_max: parsed.presupuesto_max ?? null,
        moneda:          parsed.moneda ?? null,
        ambientes_min:   parsed.ambientes_min ?? null,
        dormitorios_min: parsed.dormitorios_min ?? null,
        dormitorios_max: parsed.dormitorios_max ?? null,
        banos_min:       parsed.banos_min ?? null,
        banos_max:       parsed.banos_max ?? null,
        superficie_min:  parsed.superficie_min ?? null,
        superficie_max:  parsed.superficie_max ?? null,
        tipo_superficie: parsed.tipo_superficie ?? null,
        apto_credito:    parsed.apto_credito ?? false,
        acepta_mascotas: parsed.acepta_mascotas ?? false,
        acepta_bitcoin:  parsed.acepta_bitcoin ?? false,
        barrio_cerrado:  parsed.barrio_cerrado ?? false,
        uso_comercial:   parsed.uso_comercial ?? false,
        con_cochera:     parsed.con_cochera ?? false,
        caracteristicas: parsed.caracteristicas ?? [],
        descripcion:     texto,
        activo:          true,
      };
    }

    const { data: mirEntry, error: mirError } = await supabaseAdmin
      .from(tabla)
      .insert(payload)
      .select("id")
      .single();

    if (mirError) {
      console.error(`Error insertando en ${tabla}:`, mirError);
      return NextResponse.json({
        cargado: false,
        motivo:  "db_error",
        detalle: mirError.message,
        tabla,
        payload,
      });
    }

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
      cargado: true,
      tipo:    subtipoPorGrupo,
      tabla,
      mir_id:  mirEntry?.id,
    });

  } catch (err) {
    console.error("Error parser comunidad:", err);
    return NextResponse.json({ cargado: false, motivo: "error_interno" });
  }
}
