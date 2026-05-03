import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tasacionTool: Anthropic.Tool = {
  name: "tasacion_result",
  description: "Devuelve el resultado de la tasación inmobiliaria profesional",
  input_schema: {
    type: "object" as const,
    properties: {
      valor_min:          { type: "number",  description: "Valor mínimo de tasación en USD" },
      valor_max:          { type: "number",  description: "Valor máximo de tasación en USD" },
      valor_sugerido:     { type: "number",  description: "Valor sugerido de tasación en USD" },
      precio_m2:          { type: "number",  description: "Precio por m² en USD" },
      moneda:             { type: "string",  enum: ["USD"] },
      alquiler_estimado:  { type: ["number","null"], description: "Alquiler estimado mensual en ARS. Debe reflejar precios de mercado 2025. Nunca inferior a ARS 400.000 para monoambiente o ARS 550.000 para 2 ambientes en zona central. Null solo si la operación es Alquiler." },
      analisis:           { type: "string",  description: "2-3 párrafos de análisis del mercado y justificación de los valores" },
      factores_positivos: { type: "array",   items: { type: "string" } },
      factores_negativos: { type: "array",   items: { type: "string" } },
      comparables: {
        type: "array",
        description: "3-4 propiedades comparables del mismo barrio/zona. Precios en USD coherentes con el mercado 2025.",
        items: {
          type: "object",
          properties: {
            descripcion: { type: "string", description: "Descripción específica: tipo, barrio, m², características (ej: 'Dpto 2d/1b, 58m², Barrio Centro, 5to piso, vista panorámica')" },
            precio:      { type: "number", description: "Precio de venta en USD" },
            m2:          { type: "number", description: "Superficie en m²" },
          },
          required: ["descripcion","precio","m2"],
        },
      },
      recomendacion: { type: "string", description: "Recomendación estratégica concreta para el corredor (precio de publicación, tiempo estimado de venta, tips de negociación)" },
    },
    required: ["valor_min","valor_max","valor_sugerido","precio_m2","moneda","analisis","factores_positivos","factores_negativos","comparables","recomendacion"],
  },
};

export async function POST(req: NextRequest) {
  const datos = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  try {
    const hoy = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });

    const prompt = `Sos un tasador inmobiliario matriculado, especialista en el mercado argentino con foco en Rosario y Gran Buenos Aires. Fecha de referencia: ${hoy}.

════════════════════════════════
PRECIOS DE MERCADO VIGENTES — ${hoy}
════════════════════════════════

ALQUILERES ROSARIO (ARS/mes):
Monoambiente / 1 amb (30-45m2): ARS 380.000 - 600.000
2 ambientes (45-65m2): ARS 550.000 - 870.000
3 ambientes (65-90m2): ARS 750.000 - 1.200.000
4+ ambientes / PH (90m2+): ARS 1.100.000 - 1.800.000
Casas: ARS 800.000 - 2.500.000 segun zona y metros

Modificadores por zona:
- Centro, Alberdi, Echesortu, Pichincha, Republica de la Sexta: valores base
- Fisherton, Puerto Norte, Roca Santa Fe, Avenida del Mar: +20-40%
- Barrios perifericos o emergentes: -15-25%

VALORES DE VENTA ROSARIO (USD/m2, mercado de usados):
- Centro / Alberdi / Echesortu / Pichincha: USD 1.200 - 1.900/m2
- Fisherton / Puerto Norte / Roca Santa Fe: USD 1.800 - 2.800/m2
- Barrios residenciales consolidados (Abasto, Belgrano, Italia, Las Delicias): USD 1.000 - 1.500/m2
- Barrios perifericos y emergentes: USD 700 - 1.100/m2

ALQUILERES CABA (ARS/mes referencia):
2 amb (50-65m2): ARS 850.000 - 1.400.000
3 amb (65-90m2): ARS 1.150.000 - 1.900.000

ALQUILERES GBA (ARS/mes referencia):
Zona norte premium (San Isidro, Vicente Lopez): ARS 750.000 - 1.200.000
Zona oeste/sur: ARS 500.000 - 850.000

REGLA CRITICA DE ALQUILER:
El campo alquiler_estimado NUNCA puede ser inferior a los minimos indicados arriba.
Si el barrio es centro o zona buena, usar el rango medio o superior.
Para Rosario centro, 2 dormitorios: minimo ARS 600.000, valor tipico ARS 700.000-900.000.

COMPARABLES:
- Incluir 3-4 comparables reales y especificos del mismo barrio o zona equivalente
- Precios en USD coherentes con los rangos actuales indicados
- Descripcion debe incluir: tipo, barrio/zona, m2, caracteristicas diferenciales
- El precio/m2 de cada comparable debe ser consistente con los rangos de esa zona

════════════════════════════════
PROPIEDAD A TASAR
════════════════════════════════
Tipo: ${datos.tipo}
Operacion: ${datos.operacion}
Barrio/Zona: ${datos.barrio}
Direccion: ${datos.direccion || "No especificada"}
Superficie cubierta: ${datos.sup_cubierta} m2
${datos.sup_total ? `Superficie total: ${datos.sup_total} m2` : ""}
Ambientes: ${datos.ambientes}
Dormitorios: ${datos.dormitorios || "No especificado"}
Banos: ${datos.banos || "No especificado"}
Antiguedad: ${datos.antiguedad ? `${datos.antiguedad} anios` : "No especificada"}
Estado de conservacion: ${datos.estado}
Piso: ${datos.piso || "No aplica"}
Cochera: ${datos.cochera ? "Si" : "No"}
Amenities: ${datos.amenities || "Ninguno"}
Observaciones: ${datos.observaciones || "Ninguna"}

Genera la tasacion con valores actualizados a ${hoy}. El alquiler estimado debe reflejar los precios reales de mercado actuales, no valores historicos.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [tasacionTool],
      tool_choice: { type: "tool", name: "tasacion_result" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find(b => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Respuesta invalida de IA." }, { status: 500 });
    }

    return NextResponse.json(toolUse.input);
  } catch {
    return NextResponse.json({ error: "Error al procesar la tasacion." }, { status: 500 });
  }
}
