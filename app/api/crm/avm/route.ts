// API: AVM local — Automated Valuation Model
// POST /api/crm/avm — estima el valor de una propiedad con comparables + Claude Haiku
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface AVMRequest {
  tipo_operacion: string; // "venta" | "alquiler"
  tipo_inmueble: string;  // "departamento" | "casa" | etc.
  barrio?: string;
  ciudad: string;
  superficie_cubierta: number;
  dormitorios?: number;
  moneda?: string;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export async function POST(req: NextRequest) {
  // Auth via Bearer token
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json()) as AVMRequest;
  const { tipo_operacion, tipo_inmueble, ciudad, superficie_cubierta, dormitorios, moneda } = body;
  const barrio = body.barrio ?? "";

  if (!tipo_operacion || !tipo_inmueble || !ciudad || !superficie_cubierta) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: tipo_operacion, tipo_inmueble, ciudad, superficie_cubierta" },
      { status: 400 }
    );
  }

  const monedaEfectiva = (moneda ?? "USD").toUpperCase();
  const supMin = superficie_cubierta * 0.7;
  const supMax = superficie_cubierta * 1.3;
  const ciudadLower = ciudad.toLowerCase();
  const barrioLower = barrio.toLowerCase();

  // 1a. Buscar en cartera_propiedades
  // cartera usa "operacion" y "tipo", zona en vez de barrio
  const { data: carteraRaw } = await sb
    .from("cartera_propiedades")
    .select("id, titulo, operacion, tipo, precio, moneda, zona, ciudad, dormitorios, superficie_cubierta, estado")
    .eq("operacion", tipo_operacion)
    .eq("tipo", tipo_inmueble)
    .gte("superficie_cubierta", supMin)
    .lte("superficie_cubierta", supMax)
    .not("precio", "is", null)
    .in("estado", ["activa", "disponible", "publicada"])
    .limit(30);

  // 1b. Buscar en propiedades_externas
  const { data: externasRaw } = await sb
    .from("propiedades_externas")
    .select("id, titulo, operacion, tipo, precio, moneda, barrio, ciudad, dormitorios, superficie_cubierta, portal, activa")
    .eq("operacion", tipo_operacion)
    .eq("tipo", tipo_inmueble)
    .gte("superficie_cubierta", supMin)
    .lte("superficie_cubierta", supMax)
    .not("precio", "is", null)
    .eq("activa", true)
    .limit(30);

  // Filtrar por ciudad — flexible matching
  const matchesCiudad = (c: string | null) => {
    if (!c) return false;
    const cl = c.toLowerCase();
    return cl.includes(ciudadLower) || ciudadLower.includes(cl);
  };

  const carteraFiltrada = (carteraRaw ?? []).filter((c: any) => matchesCiudad(c.ciudad));
  const externasFiltradas = (externasRaw ?? []).filter((c: any) => matchesCiudad(c.ciudad));

  // Normalizar comparables a formato común
  interface Comparable {
    fuente: string;
    titulo: string;
    precio: number;
    moneda: string;
    barrio: string;
    ciudad: string;
    dormitorios: number | null;
    superficie_cubierta: number;
    precio_m2: number;
  }

  const normalizar = (items: any[], fuente: string, barrioField: string): Comparable[] =>
    items
      .filter((c: any) => c.precio && c.superficie_cubierta && Number(c.superficie_cubierta) > 0)
      .map((c: any) => ({
        fuente,
        titulo: (c.titulo ?? "Sin título") as string,
        precio: Number(c.precio),
        moneda: (c.moneda ?? monedaEfectiva) as string,
        barrio: (c[barrioField] ?? "") as string,
        ciudad: (c.ciudad ?? ciudad) as string,
        dormitorios: c.dormitorios ?? null,
        superficie_cubierta: Number(c.superficie_cubierta),
        precio_m2: Number(c.precio) / Number(c.superficie_cubierta),
      }));

  const comparablesCartera = normalizar(carteraFiltrada, "Cartera GFI", "zona");
  const comparablesExternas = normalizar(externasFiltradas, "Portal externo", "barrio");

  // Priorizar comparables del mismo barrio
  const scoreBarrio = (b: string) => {
    if (!barrioLower) return 0;
    const bl = b.toLowerCase();
    return bl.includes(barrioLower) || barrioLower.includes(bl) ? 1 : 0;
  };

  const sortByBarrio = (arr: Comparable[]) =>
    [...arr].sort((a, b) => scoreBarrio(b.barrio) - scoreBarrio(a.barrio));

  const todosComparables: Comparable[] = [
    ...sortByBarrio(comparablesCartera).slice(0, 10),
    ...sortByBarrio(comparablesExternas).slice(0, 10),
  ];

  // 2. Calcular estadísticas
  const precios = todosComparables.map((c) => c.precio);
  const preciosM2 = todosComparables.map((c) => c.precio_m2);

  const stats = {
    precio_mediana: Math.round(median(precios)),
    precio_promedio: Math.round(average(precios)),
    precio_m2_mediana: Math.round(median(preciosM2)),
    precio_m2_promedio: Math.round(average(preciosM2)),
    rango_min: precios.length > 0 ? Math.min(...precios) : 0,
    rango_max: precios.length > 0 ? Math.max(...precios) : 0,
    total: todosComparables.length,
  };

  // 3. Llamar a Claude Haiku para generar la valuación
  const fmtComp = (c: Comparable) =>
    `  · [${c.fuente}] ${c.titulo} — ${c.moneda} ${c.precio.toLocaleString("es-AR")} — ${[c.barrio, c.ciudad].filter(Boolean).join(", ")} — ${c.superficie_cubierta} m² — ${Math.round(c.precio_m2).toLocaleString("es-AR")}/m²${c.dormitorios ? ` — ${c.dormitorios} dorm.` : ""}`;

  const comparablesText =
    todosComparables.length > 0
      ? todosComparables.map(fmtComp).join("\n")
      : "No se encontraron comparables disponibles.";

  const prompt = `Sos un tasador inmobiliario experto en el mercado argentino. Realizá una valuación AVM (Automated Valuation Model) de la siguiente propiedad basándote en los comparables disponibles.

PROPIEDAD A VALUAR:
- Tipo de operación: ${tipo_operacion}
- Tipo de inmueble: ${tipo_inmueble}
- Ciudad: ${ciudad}${barrio ? `\n- Barrio: ${barrio}` : ""}
- Superficie cubierta: ${superficie_cubierta} m²${dormitorios ? `\n- Dormitorios: ${dormitorios}` : ""}
- Moneda preferida: ${monedaEfectiva}

COMPARABLES (${todosComparables.length} encontrados):
${comparablesText}

ESTADÍSTICAS CALCULADAS:
- Precio mediana: ${monedaEfectiva} ${stats.precio_mediana.toLocaleString("es-AR")}
- Precio promedio: ${monedaEfectiva} ${stats.precio_promedio.toLocaleString("es-AR")}
- Precio/m² mediana: ${monedaEfectiva} ${stats.precio_m2_mediana.toLocaleString("es-AR")}/m²
- Precio/m² promedio: ${monedaEfectiva} ${stats.precio_m2_promedio.toLocaleString("es-AR")}/m²

Respondé ÚNICAMENTE con este JSON (sin markdown, sin texto extra):
{
  "precio_estimado": <número entero>,
  "rango_min": <número entero, aprox. -10% del estimado>,
  "rango_max": <número entero, aprox. +10% del estimado>,
  "precio_m2_estimado": <número entero>,
  "confianza": "alta|media|baja",
  "resumen": "<2-3 oraciones en español explicando la valuación, el mercado y factores relevantes>",
  "comparables_usados": ${todosComparables.length}
}

Reglas:
- Si hay menos de 3 comparables, indicá confianza "baja".
- Si hay 3-5 comparables, confianza "media".
- Si hay 6 o más comparables, confianza "alta".
- El precio_estimado debe ser coherente con los comparables y la superficie.
- Si no hay comparables, estimá basándote en conocimiento del mercado argentino e indicá confianza "baja".`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();

  let valuacion: {
    precio_estimado: number;
    rango_min: number;
    rango_max: number;
    precio_m2_estimado: number;
    confianza: "alta" | "media" | "baja";
    resumen: string;
    comparables_usados: number;
  };

  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    valuacion = JSON.parse(cleaned);
  } catch {
    // Fallback: usar estadísticas calculadas
    const precioEstimado = Math.round(
      stats.precio_m2_mediana > 0
        ? stats.precio_m2_mediana * superficie_cubierta
        : stats.precio_mediana
    );
    valuacion = {
      precio_estimado: precioEstimado,
      rango_min: Math.round(precioEstimado * 0.9),
      rango_max: Math.round(precioEstimado * 1.1),
      precio_m2_estimado: Math.round(
        stats.precio_m2_mediana > 0
          ? stats.precio_m2_mediana
          : precioEstimado / superficie_cubierta
      ),
      confianza:
        todosComparables.length >= 6
          ? "alta"
          : todosComparables.length >= 3
          ? "media"
          : "baja",
      resumen:
        text.length > 10
          ? text
          : "Valuación estimada en base a comparables de mercado disponibles.",
      comparables_usados: todosComparables.length,
    };
  }

  return NextResponse.json({
    ok: true,
    valuacion,
    stats,
    comparables: todosComparables.map((c) => ({
      fuente: c.fuente,
      titulo: c.titulo,
      precio: c.precio,
      moneda: c.moneda,
      barrio: c.barrio,
      ciudad: c.ciudad,
      superficie_cubierta: c.superficie_cubierta,
      precio_m2: Math.round(c.precio_m2),
      dormitorios: c.dormitorios,
    })),
  });
}
