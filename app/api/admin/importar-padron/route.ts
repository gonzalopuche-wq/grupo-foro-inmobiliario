import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Buscar la fila de encabezados reales (puede haber títulos/subtítulos antes)
    const PALABRAS_HEADER = [
      "matricula", "mat", "apellido", "nombre", "estado", "legajo", "nro", "hab",
      "inmob", "orden", "ord", "corredor", "profesional", "domicilio", "localidad",
      "telefon", "email", "mail", "dni", "baja", "activ", "suspen", "inhabili",
    ];
    let filaHeaders = 0;
    let mejorPuntaje = 0;
    for (let i = 0; i < Math.min(15, filas.length); i++) {
      const celdas = filas[i].map((h: any) => String(h ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
      const celdasNoVacias = celdas.filter(c => c.length > 0).length;
      const coincidencias = celdas.filter(c => PALABRAS_HEADER.some(p => c.includes(p))).length;
      // Preferir la fila con más coincidencias Y más celdas no vacías
      const puntaje = coincidencias * 10 + celdasNoVacias;
      if (puntaje > mejorPuntaje && celdasNoVacias >= 2) {
        mejorPuntaje = puntaje;
        filaHeaders = i;
      }
    }

    const headers: string[] = filas[filaHeaders].map((h: any) => String(h ?? ""));

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
      const primerasFilas = filas.slice(0, 5).map(f => f.map((c: any) => String(c ?? "")).join(" | ")).join("\n");
      return NextResponse.json({
        error: `No se detectaron columnas obligatorias (matrícula, apellido, nombre). Encabezados encontrados en fila ${filaHeaders + 1}: ${headers.join(", ")}. Primeras filas:\n${primerasFilas}`,
      }, { status: 400 });
    }

    const registros: any[] = [];
    const ahora = new Date().toISOString();

    for (let i = filaHeaders + 1; i < filas.length; i++) {
      const fila = filas[i];
      const mat = String(fila[colMatricula] ?? "").trim();
      const ape = String(fila[colApellido] ?? "").trim();
      const nom = String(fila[colNombre]   ?? "").trim();
      if (!mat && !ape && !nom) continue;

      registros.push({
        matricula:    mat || null,
        apellido:     ape,
        nombre:       nom,
        estado:       colEstado    >= 0 ? String(fila[colEstado]    ?? "").trim() || "Habilitado" : "Habilitado",
        inmobiliaria: colInmob     >= 0 ? String(fila[colInmob]     ?? "").trim() || null : null,
        direccion:    colDireccion >= 0 ? String(fila[colDireccion] ?? "").trim() || null : null,
        localidad:    colLocalidad >= 0 ? String(fila[colLocalidad] ?? "").trim() || null : null,
        telefono:     colTelefono  >= 0 ? String(fila[colTelefono]  ?? "").trim() || null : null,
        email:        colEmail     >= 0 ? String(fila[colEmail]     ?? "").trim() || null : null,
        actualizado_at: ahora,
      });
    }

    if (registros.length === 0) {
      return NextResponse.json({ error: "No se encontraron registros válidos." }, { status: 400 });
    }

    // Traer matrículas existentes para hacer upsert a nivel aplicación
    const { data: existentes } = await sb
      .from("cocir_padron")
      .select("id, matricula");

    const mapaExistentes = new Map<string, string>();
    (existentes ?? []).forEach((r: any) => {
      if (r.matricula) mapaExistentes.set(String(r.matricula).trim(), r.id);
    });

    const nuevos: any[] = [];
    const actualizaciones: any[] = [];

    for (const reg of registros) {
      const mat = String(reg.matricula ?? "").trim();
      if (mat && mapaExistentes.has(mat)) {
        actualizaciones.push({ ...reg, id: mapaExistentes.get(mat) });
      } else {
        nuevos.push(reg);
      }
    }

    const LOTE = 500;
    let insertados = 0;
    let actualizados = 0;

    // Insertar nuevos
    for (let i = 0; i < nuevos.length; i += LOTE) {
      const lote = nuevos.slice(i, i + LOTE);
      const { error } = await sb.from("cocir_padron").insert(lote);
      if (error) return NextResponse.json({ error: `Error insertando: ${error.message}` }, { status: 500 });
      insertados += lote.length;
    }

    // Actualizar existentes (estado, nombre, inmobiliaria, etc.)
    for (const reg of actualizaciones) {
      const { id, ...campos } = reg;
      await sb.from("cocir_padron").update(campos).eq("id", id);
      actualizados++;
    }

    return NextResponse.json({
      ok: true,
      insertados,
      actualizados,
      total: insertados + actualizados,
      columnas_detectadas: {
        matricula:    headers[colMatricula],
        apellido:     headers[colApellido],
        nombre:       headers[colNombre],
        estado:       colEstado    >= 0 ? headers[colEstado]    : "(default: Habilitado)",
        inmobiliaria: colInmob     >= 0 ? headers[colInmob]    : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Error procesando el archivo: ${e.message}` }, { status: 500 });
  }
}
