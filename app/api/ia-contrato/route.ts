import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { tipo, partes, propiedad, condiciones, clausulas_extra } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  const TIPOS: Record<string, string> = {
    compraventa:     "Boleto de Compraventa",
    alquiler:        "Contrato de Locación (Alquiler)",
    autorización:    "Autorización de Venta",
    reserva:         "Seña y Reserva",
    cesion:          "Cesión de Derechos",
    mandato:         "Contrato de Mandato Inmobiliario",
  };

  const nombreContrato = TIPOS[tipo] ?? tipo;
  const hoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  const prompt = `Sos un abogado especializado en derecho inmobiliario argentino (Código Civil y Comercial 2015, Ley 27.551 de alquileres).

Redactá un ${nombreContrato} profesional con los siguientes datos:

TIPO DE CONTRATO: ${nombreContrato}
FECHA: ${hoy}, Rosario, Santa Fe, Argentina

PARTES:
${partes.vendedor ? `PARTE VENDEDORA/LOCADORA:\n- Nombre: ${partes.vendedor.nombre}\n- DNI/CUIT: ${partes.vendedor.dni || "a completar"}\n- Domicilio: ${partes.vendedor.domicilio || "a completar"}` : ""}
${partes.comprador ? `\nPARTE COMPRADORA/LOCATARIA:\n- Nombre: ${partes.comprador.nombre}\n- DNI/CUIT: ${partes.comprador.dni || "a completar"}\n- Domicilio: ${partes.comprador.domicilio || "a completar"}` : ""}

INMUEBLE:
${propiedad ? `- Tipo: ${propiedad.tipo || "Inmueble"}
- Ubicación: ${propiedad.direccion || ""} ${propiedad.zona ? ", " + propiedad.zona : ""}, ${propiedad.ciudad || "Rosario"}, Santa Fe
- Superficie: ${propiedad.superficie_cubierta ? propiedad.superficie_cubierta + " m² cubiertos" : "a determinar"}
- Descripción: ${propiedad.descripcion || "Inmueble en condiciones habitables"}` : "- A completar por las partes"}

CONDICIONES ECONÓMICAS:
${condiciones.precio ? `- Precio/Monto: ${condiciones.moneda || "ARS"} ${condiciones.precio.toLocaleString("es-AR")}` : "- A determinar"}
${condiciones.forma_pago ? `- Forma de pago: ${condiciones.forma_pago}` : ""}
${condiciones.plazo ? `- Plazo: ${condiciones.plazo}` : ""}
${condiciones.honorarios ? `- Honorarios del corredor: ${condiciones.honorarios}` : "- Honorarios del corredor: 3% + 3% sobre el precio de operación (Reglamento GFI)"}

CORREDOR INMOBILIARIO:
- Nombre: ${partes.corredor?.nombre || "a completar"}
- Matrícula COCIR: ${partes.corredor?.matricula || "a completar"}

${clausulas_extra ? `CLÁUSULAS ADICIONALES SOLICITADAS:\n${clausulas_extra}` : ""}

INSTRUCCIONES DE REDACCIÓN:
1. Redactá el contrato completo con todas las cláusulas necesarias
2. Usá lenguaje jurídico formal pero claro
3. Incluí numeración de cláusulas
4. Incluí espacio para firmas al final
5. Adaptá el contenido a la legislación argentina vigente
6. Dejá campos entre [CORCHETES] donde el corredor deba completar información faltante
7. Incluí cláusula sobre intervención del corredor matriculado

Respondé SOLO con el texto del contrato, sin explicaciones previas ni posteriores.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const texto = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    return NextResponse.json({ contrato: texto });
  } catch (err) {
    console.error("ia-contrato error:", err);
    return NextResponse.json({ error: "Error generando contrato." }, { status: 500 });
  }
}
