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


// Normalizar operación para mir_busquedas: "venta" → "compra", resto igual
const OPERACION_BUSQUEDA_MAP: Record<string, string> = {
  "venta": "compra",
  "alquiler": "alquiler",
  "alquiler_temporario": "alquiler_temporario",
  "permuta": "permuta",
  "campo": "campo",
  "comercial": "comercial",
  "fondo_comercio": "fondo_comercio",
  "vehiculo": "vehiculo",
  "compra": "compra",
};
const normalizeOperacionBusqueda = (op: string): string =>
  OPERACION_BUSQUEDA_MAP[op] ?? op;

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

function extraerDatosDeUrl(url: string): string {
  try {
    const slug = new URL(url).pathname;
    const palabras = slug.replace(/[-_/]/g, " ").replace(/\d+/g, " $& ").trim();
    return `Propiedad en portal inmobiliario. Slug: ${palabras}`;
  } catch {
    return `Link de propiedad: ${url}`;
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ cargado: false, motivo: "no_auth" });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ cargado: false, motivo: "no_auth" });

  try {
    const { texto, grupo_id, mensaje_id } = await req.json();
    const user_id = user.id;

    const tipoOperacion = GRUPOS_MIR[grupo_id];
    if (!tipoOperacion) {
      return NextResponse.json({ cargado: false, motivo: "grupo_no_mir" });
    }

    const subtipoPorGrupo = SUBTIPO_POR_GRUPO[grupo_id] ?? "ofrecido";
    const esOfrecido = subtipoPorGrupo === "ofrecido";

    // ── Enriquecimiento de texto ─────────────────────────────────────────────
    const urlEnMensaje = texto.match(/https?:\/\/\S+/)?.[0];
    const textoSinUrl = texto.replace(/https?:\/\/\S+/g, "").trim();
    const esSoloUrl = urlEnMensaje && textoSinUrl.length < 10;

    let textoParaParser = texto;

    if (esSoloUrl && urlEnMensaje) {
      const preview = await fetchLinkPreview(urlEnMensaje);
      if (preview?.title || preview?.description) {
        textoParaParser = `${preview.title ?? ""}\n${preview.description ?? ""}\nURL: ${urlEnMensaje}`;
      } else {
        textoParaParser = extraerDatosDeUrl(urlEnMensaje);
      }
    }

    const contextoGrupo = esOfrecido
      ? "Este mensaje viene del grupo de OFRECIDOS — es una propiedad disponible."
      : "Este mensaje viene del grupo de BÚSQUEDAS — un corredor busca propiedad para un cliente.";

    // ── Prompt ofrecidos ─────────────────────────────────────────────────────
    const promptOfrecido = `Sos un parser de mensajes inmobiliarios de Rosario, Argentina y la región (2da Circunscripción COCIR).
${contextoGrupo}

MENSAJE: "${textoParaParser}"
GRUPO: ${grupo_id}

INSTRUCCIONES:
- Extraé todos los datos que puedas. Abreviaturas frecuentes: "dorm"=dormitorios, "sup/m2"=superficie, "cub"=cubierta, "UDS/USD/U$S/u$d/u$s"=dólares, "$"=pesos ARS, "pb"=planta baja, "bº/brio"=barrio, "dpto"=departamento, "pje/pllo"=pasillo.
- Localidades: Rosario, Funes, Roldán, Granadero Baigorria, Pérez, Soldini, Zavalla, Pueblo Esther, Alvear, Casilda, Carcarañá, General Lagos, Arroyo Seco, San Lorenzo, Capitán Bermúdez, Villa Gobernador Gálvez, Ricardone, Acebal, Totoras, Rufino, Venado Tuerto, Cañada de Gómez.
- Moneda: "USD/UDS/U$S/u$d/u$s/dólares/dolares" → "USD". "$" o "pesos" → "ARS".
- Links de portales (zonaprop, argenprop, mercadolibre, kiteprop, mariopuche, ficha.info, red.propia, ladedapropiedades, properati, navent) SIEMPRE son operaciones.
- "parrillero/parrilla" → agregar a caracteristicas. "pileta/piscina" → caracteristicas. "cochera/garage" → con_cochera=true. "barrio cerrado/country/club de campo" → barrio_cerrado=true. "apto crédito/hipotecario" → apto_credito=true. "acepta mascotas/pets" → acepta_mascotas=true.
- NO es operación si el mensaje es: saludo, consulta de contacto de inmobiliaria, aviso de comisión compartida, respuesta a otro mensaje sin datos de propiedad.
- Booleans: true/false. "caracteristicas": array de strings con amenities extras.

Respondé SOLO con JSON válido, sin texto extra:

Si ES una operación:
{
  "es_operacion": true,
  "tipo_propiedad": "departamento|casa|local|terreno|campo|garage|cochera|oficina|ph|otro",
  "operacion": "venta|alquiler|alquiler_temporario|permuta",
  "dormitorios": número o null,
  "ambientes": número o null,
  "banos": número o null,
  "zona": "barrio, calle o sector de la ciudad" o null,
  "ciudad": "localidad exacta o Rosario si no se menciona",
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

    // ── Prompt búsquedas ─────────────────────────────────────────────────────
    const promptBusqueda = `Sos un parser de mensajes inmobiliarios de Rosario, Argentina y la región (2da Circunscripción COCIR).
${contextoGrupo}

MENSAJE: "${textoParaParser}"
GRUPO: ${grupo_id}

INSTRUCCIONES GENERALES:
- Abreviaturas: "dorm"=dormitorios, "dpto"=departamento, "m2"=metros cuadrados, "UDS/USD/U$S/u$d/u$s/usd"=dólares, "$"=pesos, "pb"=planta baja, "pllo/pje"=pasillo, "monoambiente/mono"=1 ambiente.
- Moneda: cualquier variante de USD → "USD". "$" o "pesos" → "ARS".
- Localidades: Rosario, Funes, Roldán, Granadero Baigorria, Pérez, Soldini, Zavalla, Pueblo Esther, Alvear, Casilda, etc.

INSTRUCCIONES ESPECÍFICAS PARA BÚSQUEDAS:
- "con cochera/garage" → con_cochera=true
- "apto crédito/hipotecario/nido" → apto_credito=true  
- "acepta mascotas/perro/gato/pets" → acepta_mascotas=true
- "barrio cerrado/country/club de campo" → barrio_cerrado=true
- "no eléctrico" → agregar "no eléctrico" a caracteristicas
- "al frente/contrafrente" → agregar a caracteristicas
- "con balcón/terraza" → agregar a caracteristicas
- "con parrillero/parrilla" → agregar a caracteristicas
- "con pileta/piscina" → agregar a caracteristicas
- "con patio/jardín" → agregar a caracteristicas
- "luminoso/buena luz" → agregar a caracteristicas
- "escriturable" → agregar a caracteristicas
- "puede estar alquilado" → agregar a caracteristicas
- "NO PB / no planta baja" → agregar "no planta baja" a caracteristicas
- "NO último piso" → agregar "no último piso" a caracteristicas
- "piso X en adelante" → agregar "piso mínimo X" a caracteristicas
- "cocina separada" → agregar a caracteristicas
- "con ascensor" → agregar a caracteristicas
- "antigüedad hasta X años" → calcular: si hasta 10 años → antiguedad="muy bueno", hasta 15-20 → "bueno", hasta 25 → "bueno", a estrenar → "a estrenar"
- Zona: si dicen "de calle X a calle Y" o "zona X/Y", capturalo como zona descriptiva
- Si el mensaje es solo un saludo, consulta de contacto, pregunta por inmobiliaria, o aviso de comisión → es_operacion=false
- presupuesto_max: el número que dicen como tope. Si dicen "aprox 1M" → 1000000 ARS. "1M pesos" → 1000000 ARS.

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
  "zona": "descripción de zona, barrio o rango de calles" o null,
  "ciudad": "localidad exacta o Rosario si no se menciona",
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

Si NO es una búsqueda (saludo, consulta de contacto, pregunta por inmobiliaria, aviso de comisión compartida): { "es_operacion": false }`;

    const messages = [{ role: "user" as const, content: esOfrecido ? promptOfrecido : promptBusqueda }];

    const safeMessages = messages
      .map(m => ({ role: m.role, content: (m.content || "").trim() }))
      .filter(m => m.content.length > 0);

    if (safeMessages.length === 0) {
      return NextResponse.json({ cargado: false, motivo: "empty_content" });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: safeMessages,
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
        caracteristicas: null,
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
        caracteristicas:     (parsed.caracteristicas && parsed.caracteristicas.length > 0) ? parsed.caracteristicas : null,
        descripcion:         texto,
        activo:              true,
      };
    } else {
      tabla = "mir_busquedas";
      payload = {
        perfil_id:       user_id,
        operacion:       normalizeOperacionBusqueda(parsed.operacion ?? tipoOperacion),
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
        tipo_superficie: parsed.tipo_superficie ?? "total",
        apto_credito:    parsed.apto_credito ?? false,
        acepta_mascotas: parsed.acepta_mascotas ?? false,
        acepta_bitcoin:  parsed.acepta_bitcoin ?? false,
        barrio_cerrado:  parsed.barrio_cerrado ?? false,
        uso_comercial:   parsed.uso_comercial ?? false,
        con_cochera:     parsed.con_cochera ?? false,
        caracteristicas: (parsed.caracteristicas && parsed.caracteristicas.length > 0) ? parsed.caracteristicas : null,
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
