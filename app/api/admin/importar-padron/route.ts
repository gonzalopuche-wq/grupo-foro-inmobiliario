import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Detecta qué columna del Excel corresponde a cada campo
function detectarColumna(headers: string[], palabrasClave: string[]): number {
  return headers.findIndex(h => {
    const h2 = h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    return palabrasClave.some(p => h2.includes(p));
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const archivo = formData.get("archivo") as File | null;
    if (!archivo) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const filas: any[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });

    if (filas.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío o tiene solo encabezados." }, { status: 400 });
    }

    // Primera fila = encabezados
    const headers: string[] = filas[0].map((h: any) => String(h ?? ""));

    // Detección automática de columnas por palabras clave
    const colMatricula  = detectarColumna(headers, ["matricula", "mat", "legajo", "nro"]);
    const colApellido   = detectarColumna(headers, ["apellido"]);
    const colNombre     = detectarColumna(headers, ["nombre"]);
    const colEstado     = detectarColumna(headers, ["estado", "habilitado", "situacion"]);
    const colInmob      = detectarColumna(headers, ["inmobiliaria", "empresa", "razon", "agencia"]);
    const colDireccion  = detectarColumna(headers, ["direccion", "domicilio", "calle"]);
    const colLocalidad  = detectarColumna(headers, ["localidad", "ciudad", "partido"]);
    const colTelefono   = detectarColumna(headers, ["telefono", "tel", "celular", "whatsapp"]);
    const colEmail      = detectarColumna(headers, ["email", "mail", "correo"]);

    if (colMatricula === -1 || colApellido === -1 || colNombre === -1) {
      return NextResponse.json({
        error: `No se detectaron columnas obligatorias. Encabezados encontrados: ${headers.join(", ")}`,
      }, { status: 400 });
    }

    // Parsear filas de datos
    const registros: any[] = [];
    for (let i = 1; i < filas.length; i++) {
      const fila = filas[i];
      const mat = String(fila[colMatricula] ?? "").trim();
      const ape = String(fila[colApellido] ?? "").trim();
      const nom = String(fila[colNombre]   ?? "").trim();
      if (!mat && !ape && !nom) continue; // fila vacía

      registros.push({
        matricula:   mat || null,
        apellido:    ape,
        nombre:      nom,
        estado:      colEstado    >= 0 ? String(fila[colEstado]    ?? "").trim() || "Habilitado" : "Habilitado",
        inmobiliaria:colInmob     >= 0 ? String(fila[colInmob]     ?? "").trim() || null : null,
        direccion:   colDireccion >= 0 ? String(fila[colDireccion] ?? "").trim() || null : null,
        localidad:   colLocalidad >= 0 ? String(fila[colLocalidad] ?? "").trim() || null : null,
        telefono:    colTelefono  >= 0 ? String(fila[colTelefono]  ?? "").trim() || null : null,
        email:       colEmail     >= 0 ? String(fila[colEmail]     ?? "").trim() || null : null,
      });
    }

    if (registros.length === 0) {
      return NextResponse.json({ error: "No se encontraron registros válidos en el archivo." }, { status: 400 });
    }

    // Borrar padrón anterior e insertar nuevo en lotes de 500
    await sb.from("cocir_padron").delete().neq("matricula", "___never___");

    const LOTE = 500;
    let insertados = 0;
    for (let i = 0; i < registros.length; i += LOTE) {
      const lote = registros.slice(i, i + LOTE);
      const { error } = await sb.from("cocir_padron").insert(lote);
      if (error) {
        return NextResponse.json({ error: `Error al insertar lote ${i / LOTE + 1}: ${error.message}` }, { status: 500 });
      }
      insertados += lote.length;
    }

    return NextResponse.json({
      ok: true,
      total: insertados,
      columnas_detectadas: {
        matricula: headers[colMatricula],
        apellido:  headers[colApellido],
        nombre:    headers[colNombre],
        estado:    colEstado    >= 0 ? headers[colEstado]    : "(no encontrada, usa 'Habilitado')",
        inmobiliaria: colInmob  >= 0 ? headers[colInmob]    : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Error procesando el archivo: ${e.message}` }, { status: 500 });
  }
}
