import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { contenido } = await req.json();
  if (!contenido?.trim()) return NextResponse.json({ error: "Texto vacío" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  const prompt = `Sos un experto en automatización de documentos legales inmobiliarios argentinos.

Tu tarea es analizar el siguiente contrato modelo y reemplazar los datos variables (nombres, DNIs, domicilios, montos, fechas, etc.) con las variables correspondientes de esta lista:

VARIABLES DISPONIBLES:
- {{FECHA_HOY}} — fecha actual (ej: "15 de mayo de 2025", "Buenos Aires, 10 de enero de 2026")
- {{VENDEDOR_NOMBRE}} — nombre completo del vendedor o locador
- {{VENDEDOR_DNI}} — DNI o CUIT del vendedor
- {{VENDEDOR_DOMICILIO}} — domicilio del vendedor
- {{COMPRADOR_NOMBRE}} — nombre completo del comprador, inquilino o locatario
- {{COMPRADOR_DNI}} — DNI o CUIT del comprador
- {{COMPRADOR_DOMICILIO}} — domicilio del comprador
- {{PROPIEDAD_TITULO}} — título descriptivo de la propiedad
- {{PROPIEDAD_TIPO}} — tipo de inmueble (casa, departamento, local, etc.)
- {{PROPIEDAD_DIRECCION}} — dirección del inmueble
- {{PROPIEDAD_CIUDAD}} — ciudad/localidad del inmueble
- {{PROPIEDAD_SUPERFICIE}} — superficie cubierta en m²
- {{PRECIO}} — monto pactado (solo el número formateado)
- {{MONEDA}} — moneda (USD, ARS, EUR)
- {{FORMA_PAGO}} — forma de pago acordada
- {{PLAZO}} — plazo del contrato (para alquileres)
- {{CORREDOR_NOMBRE}} — nombre del corredor inmobiliario
- {{CORREDOR_MATRICULA}} — número de matrícula del corredor
- {{HONORARIOS_PCT}} — porcentaje de honorarios (ej: "3%")
- {{HONORARIOS_MONTO}} — monto de honorarios (moneda + número)
- {{SEÑA_MONTO}} — monto de la seña o reserva
- {{FECHA_ENTREGA}} — fecha de entrega o escrituración
- {{GARANTIA_TIPO}} — tipo de garantía exigida
- {{EXPENSAS}} — condición sobre expensas

REGLAS:
1. Reemplazá SOLO los datos que claramente son variables (nombres de personas, DNIs, montos, fechas específicas, direcciones concretas). NO reemplaces texto jurídico ni cláusulas.
2. Si hay un dato que podría corresponder a más de una variable, elegí la más adecuada por contexto.
3. Si hay datos que no tienen variable disponible, dejálos tal cual o ponelos entre [CORCHETES].
4. Mantené el formato, saltos de línea, numeración y estructura del documento exactamente igual.
5. Respondé SOLO con el texto procesado, sin ninguna explicación antes ni después.

TEXTO A PROCESAR:
${contenido}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const procesado = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Contar variables insertadas
    const matches = procesado.match(/\{\{[A-Z_]+\}\}/g) ?? [];
    const variablesInsertadas = new Set(matches).size;

    return NextResponse.json({ contenido: procesado, variables_insertadas: variablesInsertadas });
  } catch (err) {
    console.error("ia-plantilla-analizar error:", err);
    return NextResponse.json({ error: "Error procesando la plantilla." }, { status: 500 });
  }
}
