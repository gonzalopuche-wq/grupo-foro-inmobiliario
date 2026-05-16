import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { propiedadData, perfilData } = await req.json();

  // Buscar comparables de la misma zona
  const zona = propiedadData.zona?.trim() || propiedadData.barrio?.trim() || "";
  let comparablesTexto = "No hay datos comparables disponibles para esta zona.";

  if (zona) {
    const { data: comps } = await sb
      .from("comparables")
      .select("tipo_operacion, precio_venta, moneda, sup_cubierta, barrio, fecha_comparable")
      .ilike("barrio", `%${zona}%`)
      .not("precio_venta", "is", null)
      .order("fecha_comparable", { ascending: false })
      .limit(10);

    if (comps && comps.length > 0) {
      const promedioM2 = comps
        .filter(c => c.precio_venta && c.sup_cubierta && c.sup_cubierta > 0)
        .map(c => c.precio_venta! / c.sup_cubierta!)
        .reduce((a, b, _, arr) => a + b / arr.length, 0);

      comparablesTexto = `Zona: ${zona}
Comparables recientes (últimas ${comps.length} operaciones):
${comps.map(c =>
  `- ${c.tipo_operacion ?? "Venta"}: ${c.moneda ?? "USD"} ${c.precio_venta?.toLocaleString("es-AR") ?? "—"}${c.sup_cubierta ? ` · ${c.sup_cubierta} m²` : ""}`
).join("\n")}
${promedioM2 > 0 ? `Precio promedio/m²: USD ${Math.round(promedioM2).toLocaleString("es-AR")}` : ""}`;
    }
  }

  const tipoOp = propiedadData.operacion === "alquiler" ? "alquiler" : "venta";
  const agente = perfilData?.nombre && perfilData?.apellido
    ? `${perfilData.nombre} ${perfilData.apellido}${perfilData.matricula ? ` (Mat. ${perfilData.matricula})` : ""}${perfilData.inmobiliaria ? ` · ${perfilData.inmobiliaria}` : ""}`
    : "el corredor de GFI®";

  const honorariosRef = tipoOp === "alquiler"
    ? "1 mes de alquiler + IVA de cada parte"
    : "3% + IVA del precio de venta de cada parte";

  const prompt = `Sos un corredor inmobiliario matriculado argentino de alto nivel. Redactá una PROPUESTA DE CAPTACIÓN profesional y persuasiva para presentar a un propietario que quiere ${tipoOp === "alquiler" ? "alquilar" : "vender"} su propiedad.

DATOS DEL CORREDOR:
${agente}
${perfilData?.bio ? `Bio: ${perfilData.bio}` : ""}
${perfilData?.anos_experiencia ? `Experiencia: ${perfilData.anos_experiencia} años` : ""}

DATOS DE LA PROPIEDAD:
Tipo: ${propiedadData.tipo ?? "Propiedad"}
Operación: ${tipoOp}
Ubicación: ${[propiedadData.barrio, propiedadData.zona, propiedadData.ciudad].filter(Boolean).join(", ") || "Rosario"}
${propiedadData.precio ? `Precio orientativo: ${propiedadData.moneda ?? "USD"} ${Number(propiedadData.precio).toLocaleString("es-AR")}` : ""}
${propiedadData.sup_cubierta ? `Superficie: ${propiedadData.sup_cubierta} m²` : ""}
${propiedadData.propietario_nombre ? `Propietario/a: ${propiedadData.propietario_nombre}` : ""}

DATOS DE MERCADO (comparables):
${comparablesTexto}

Redactá la propuesta con las siguientes secciones (en formato limpio, sin markdown, sin asteriscos, con saltos de línea entre secciones):

1. SALUDO PERSONALIZADO — Dirigido al propietario, presentándote brevemente como profesional
2. ANÁLISIS DE MERCADO — Analizá la situación actual del mercado para la zona y tipo de propiedad, usando los datos comparables
3. ESTRATEGIA DE COMERCIALIZACIÓN — Plan de acción: portales digitales, redes sociales, base de contactos, open house, etc.
4. NUESTROS SERVICIOS — Qué hacés vos como corredor (tasación, fotos profesionales, gestión de consultas, negociación)
5. HONORARIOS PROFESIONALES — ${honorariosRef}. Recordá que son libremente pactados, estos son los de uso y costumbre en Rosario
6. CRONOGRAMA ESTIMADO — Timeline desde la firma de autorización hasta el cierre (${tipoOp === "alquiler" ? "15-30" : "30-90"} días estimados)
7. PRÓXIMOS PASOS — Call to action claro y profesional

Extensión: entre 400 y 600 palabras. Tono: profesional, confiable, orientado a resultados. Usá vocabulario inmobiliario argentino.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const texto = (message.content[0] as any)?.text ?? "";
    return NextResponse.json({ propuesta: texto });
  } catch (err) {
    console.error("Error IA propuesta captación:", err);
    return NextResponse.json({ error: "Error al generar la propuesta." }, { status: 500 });
  }
}
