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

export async function POST(req: NextRequest) {
  try {
    const { texto, grupo_id, user_id, mensaje_id } = await req.json();

    // Verificar que el grupo va al MIR
    const tipoOperacion = GRUPOS_MIR[grupo_id];
    if (!tipoOperacion) {
      return NextResponse.json({ cargado: false, motivo: "grupo_no_mir" });
    }

    // Parser IA — detectar si es ofrecido o búsqueda
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Sos un parser de mensajes inmobiliarios. Analizá este mensaje de un corredor inmobiliario de Rosario, Argentina y determiná si es una publicación de operación inmobiliaria.

MENSAJE: "${texto}"
GRUPO: ${grupo_id}

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
      return NextResponse.json({ cargado: false, motivo: "no_es_operacion" });
    }

    // Cargar al MIR
    const { data: mirEntry } = await supabaseAdmin
      .from("mir")
      .insert({
        user_id,
        subtipo: parsed.subtipo,
        operacion: parsed.operacion ?? tipoOperacion,
        tipo_inmueble: parsed.tipo_inmueble ?? "otro",
        dormitorios: parsed.dormitorios,
        zona: parsed.zona,
        precio: parsed.precio,
        moneda: parsed.moneda,
        superficie: parsed.superficie,
        descripcion: texto,
        descripcion_corta: parsed.descripcion_corta,
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
