// API: Análisis de precio vs mercado con Claude
// POST /api/crm/precio-analisis — analiza si el precio de una propiedad está acorde al mercado
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Auth via Bearer token
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json() as { propiedadId: string };
  const { propiedadId } = body;
  if (!propiedadId) return NextResponse.json({ error: "Falta propiedadId" }, { status: 400 });

  // 1. Obtener la propiedad principal
  const { data: propiedad, error: propErr } = await sb
    .from("cartera_propiedades")
    .select("id, titulo, tipo_operacion, tipo_inmueble, operacion, tipo, precio, moneda, barrio, zona, ciudad, dormitorios, superficie_cubierta, superficie_total, created_at")
    .eq("id", propiedadId)
    .single();

  if (propErr || !propiedad) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  const precio = propiedad.precio as number | null;
  const moneda = (propiedad.moneda ?? "USD") as string;
  const ciudad = (propiedad.ciudad ?? "") as string;
  const operacion = (propiedad.tipo_operacion ?? propiedad.operacion ?? "") as string;

  if (!precio) {
    return NextResponse.json({ error: "La propiedad no tiene precio definido" }, { status: 400 });
  }

  // 2a. Obtener comparables de cartera_propiedades (últimas 90 días, misma op, ciudad similar, precio ±50%)
  const fechaLimite = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const precioMin = precio * 0.5;
  const precioMax = precio * 1.5;

  const { data: comparablesCartera } = await sb
    .from("cartera_propiedades")
    .select("id, titulo, tipo_operacion, operacion, tipo, tipo_inmueble, precio, moneda, barrio, zona, ciudad, dormitorios, superficie_cubierta, superficie_total, created_at")
    .neq("id", propiedadId)
    .or(`tipo_operacion.eq.${operacion},operacion.eq.${operacion}`)
    .gte("precio", precioMin)
    .lte("precio", precioMax)
    .gte("created_at", fechaLimite)
    .limit(10);

  // 2b. Obtener comparables de propiedades_externas
  const { data: comparablesExternos } = await sb
    .from("propiedades_externas")
    .select("id, titulo, operacion, tipo, precio, moneda, barrio, ciudad, dormitorios, superficie_cubierta, fuente")
    .eq("operacion", operacion)
    .gte("precio", precioMin)
    .lte("precio", precioMax)
    .limit(10);

  // Filtrar comparables de cartera por ciudad similar (cliente-side para mayor flexibilidad)
  const ciudadLower = ciudad.toLowerCase();
  const comparablesCarteraFiltrados = (comparablesCartera ?? []).filter((c: any) => {
    const cCiudad = ((c.ciudad ?? "") as string).toLowerCase();
    return cCiudad.includes(ciudadLower) || ciudadLower.includes(cCiudad) || cCiudad === ciudadLower;
  }).slice(0, 10);

  const comparablesExternosFiltrados = (comparablesExternos ?? []).filter((c: any) => {
    const cCiudad = ((c.ciudad ?? "") as string).toLowerCase();
    return cCiudad.includes(ciudadLower) || ciudadLower.includes(cCiudad) || cCiudad === ciudadLower;
  }).slice(0, 10);

  // 3. Armar prompt para Claude
  const propDesc = [
    `- Título: ${propiedad.titulo ?? "Sin título"}`,
    `- Operación: ${operacion}`,
    `- Tipo: ${propiedad.tipo_inmueble ?? propiedad.tipo ?? "No especificado"}`,
    `- Precio: ${moneda} ${precio.toLocaleString("es-AR")}`,
    `- Ciudad: ${ciudad || "No especificada"}`,
    `- Barrio/Zona: ${propiedad.barrio ?? propiedad.zona ?? "No especificado"}`,
    `- Dormitorios: ${propiedad.dormitorios ?? "N/D"}`,
    `- Superficie cubierta: ${propiedad.superficie_cubierta ? `${propiedad.superficie_cubierta} m²` : "N/D"}`,
    `- Superficie total: ${propiedad.superficie_total ? `${propiedad.superficie_total} m²` : "N/D"}`,
  ].join("\n");

  const fmtComparable = (c: any, fuente: string) => {
    const p = c.precio ? `${c.moneda ?? moneda} ${Number(c.precio).toLocaleString("es-AR")}` : "N/D";
    const sup = c.superficie_cubierta ? `${c.superficie_cubierta} m²` : "N/D";
    const dorm = c.dormitorios ? `${c.dormitorios} dorm.` : "";
    return `  · [${fuente}] ${c.titulo ?? "Sin título"} — ${p} — ${[c.barrio, c.ciudad].filter(Boolean).join(", ")} — ${[sup, dorm].filter(Boolean).join(", ")}`;
  };

  const lineasCartera = comparablesCarteraFiltrados.map((c: any) => fmtComparable(c, "Cartera propia"));
  const lineasExternas = comparablesExternosFiltrados.map((c: any) => fmtComparable(c, (c.fuente as string) ?? "Portal externo"));
  const todasLineas = [...lineasCartera, ...lineasExternas];

  const comparablesText = todasLineas.length > 0
    ? todasLineas.join("\n")
    : "No se encontraron comparables disponibles.";

  const prompt = `Sos un tasador inmobiliario experto en el mercado argentino. Analizá si el precio de la siguiente propiedad está acorde al mercado comparándola con las propiedades comparables disponibles.

PROPIEDAD A ANALIZAR:
${propDesc}

PROPIEDADES COMPARABLES (${todasLineas.length} encontradas):
${comparablesText}

Respondé ÚNICAMENTE con este JSON (sin markdown, sin texto extra):
{
  "veredicto": "bien_posicionado|caro|barato|muy_caro|muy_barato",
  "porcentaje_diferencia": <número; positivo = está más caro que el mercado, negativo = más barato>,
  "resumen": "<2-3 oraciones en español describiendo el análisis>",
  "recomendacion": "<1 oración con acción concreta>",
  "precio_mercado_estimado": <número estimado del precio de mercado>,
  "confianza": "alta|media|baja"
}

Si hay pocos o ningún comparable, indicá confianza "baja" y explicalo en el resumen.`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();

  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    const analisis = JSON.parse(cleaned);
    return NextResponse.json({
      ok: true,
      analisis,
      comparables_encontrados: todasLineas.length,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      analisis: {
        veredicto: "bien_posicionado",
        porcentaje_diferencia: 0,
        resumen: text,
        recomendacion: "Consultá con un tasador para mayor precisión.",
        precio_mercado_estimado: precio,
        confianza: "baja",
      },
      comparables_encontrados: todasLineas.length,
    });
  }
}
