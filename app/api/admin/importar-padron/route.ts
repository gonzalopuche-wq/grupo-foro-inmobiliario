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

// Detects column roles from data values (for Excel files with no header row)
function inferirColumnasDesdeData(filas: any[][], filaInicio: number) {
  const ESTADO_RE = /^(habilitado|suspendido|inhabilitado|dado de baja|activo|inactivo|baja)/i;
  const muestra = filas
    .slice(filaInicio, filaInicio + 20)
    .filter(f => f.some((c: any) => String(c ?? "").trim()));
  if (muestra.length === 0) return null;

  const nCols = Math.max(...muestra.map(f => f.length), 1);
  const cnt = Array.from({ length: nCols }, () => ({
    esMatricula: 0, esNombreCompleto: 0, esEstado: 0, esTelefono: 0, esEmail: 0,
  }));

  for (const fila of muestra) {
    for (let c = 0; c < Math.min(fila.length, nCols); c++) {
      const val = String(fila[c] ?? "").trim();
      if (!val) continue;
      if (/^\d{1,5}$/.test(val)) cnt[c].esMatricula++;
      if (val.includes(",") && /[a-záéíóúñ]/i.test(val)) cnt[c].esNombreCompleto++;
      if (ESTADO_RE.test(val)) cnt[c].esEstado++;
      if (/^\d{9,11}$/.test(val)) cnt[c].esTelefono++;
      if (val.includes("@")) cnt[c].esEmail++;
    }
  }

  const n = muestra.length;
  const best = (key: keyof typeof cnt[0], minFraction = 0.5) => {
    const i = cnt.reduce((b, _c, idx) => cnt[idx][key] > cnt[b][key] ? idx : b, 0);
    return cnt[i][key] >= n * minFraction ? i : -1;
  };

  const colMatricula = best("esMatricula");
  const colNombreCompleto = best("esNombreCompleto");
  if (colMatricula < 0 && colNombreCompleto < 0) return null;

  return {
    colMatricula,
    colNombreCompleto,
    colEstado:    best("esEstado"),
    colTelefono:  best("esTelefono", 0.1),
    colEmail:     best("esEmail", 0.1),
  };
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

    if (filas.length < 1) {
      return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
    }

    // Score each of the first 15 rows to find the most likely header row
    const PALABRAS_HEADER = [
      "matricula", "mat", "apellido", "nombre", "estado", "legajo", "nro", "hab",
      "inmob", "orden", "ord", "corredor", "profesional", "domicilio", "localidad",
      "telefon", "email", "mail", "dni", "baja", "activ", "suspen", "inhabili",
    ];
    let filaHeaders = -1;
    let mejorPuntaje = 0;
    let mejorCoincidencias = 0;
    for (let i = 0; i < Math.min(15, filas.length); i++) {
      const celdas = filas[i].map((h: any) =>
        String(h ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
      );
      const celdasNoVacias = celdas.filter(c => c.length > 0).length;
      const coincidencias = celdas.filter(c => PALABRAS_HEADER.some(p => c.includes(p))).length;
      const puntaje = coincidencias * 10 + celdasNoVacias;
      if (puntaje > mejorPuntaje && celdasNoVacias >= 2) {
        mejorPuntaje = puntaje;
        mejorCoincidencias = coincidencias;
        filaHeaders = i;
      }
    }

    const registros: any[] = [];
    const ahora = new Date().toISOString();
    let modoDetectado = "desconocido";

    // Mode 1: header row with at least 2 recognizable column names
    if (filaHeaders >= 0 && mejorCoincidencias >= 2) {
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

      if (colMatricula >= 0 && colApellido >= 0 && colNombre >= 0) {
        modoDetectado = "con-encabezados";
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
      }
    }

    // Mode 2: no header row — infer column types from data patterns
    // Handles the COCIR standard export: "APELLIDO, NOMBRE" | matrícula | estado | dni | tel
    if (registros.length === 0) {
      const inferido = inferirColumnasDesdeData(filas, 0);
      if (inferido) {
        modoDetectado = "sin-encabezados";
        for (let i = 0; i < filas.length; i++) {
          const fila = filas[i];
          let ape = "", nom = "";
          if (inferido.colNombreCompleto >= 0) {
            const full = String(fila[inferido.colNombreCompleto] ?? "").trim();
            const partes = full.split(",");
            ape = partes[0]?.trim() ?? "";
            nom = partes.slice(1).join(" ").trim();
          }
          const mat = inferido.colMatricula >= 0
            ? String(fila[inferido.colMatricula] ?? "").trim() : "";
          if (!mat && !ape && !nom) continue;
          registros.push({
            matricula:    mat || null,
            apellido:     ape,
            nombre:       nom,
            estado:       inferido.colEstado   >= 0 ? String(fila[inferido.colEstado]   ?? "").trim() || "Habilitado" : "Habilitado",
            inmobiliaria: null,
            direccion:    null,
            localidad:    null,
            telefono:     inferido.colTelefono >= 0 ? String(fila[inferido.colTelefono] ?? "").trim() || null : null,
            email:        inferido.colEmail    >= 0 ? String(fila[inferido.colEmail]    ?? "").trim() || null : null,
            actualizado_at: ahora,
          });
        }
      }
    }

    if (registros.length === 0) {
      const primerasFilas = filas.slice(0, 5)
        .map(f => f.map((c: any) => String(c ?? "")).join(" | "))
        .join("\n");
      return NextResponse.json({
        error: `No se pudieron detectar las columnas. El archivo no tiene encabezados reconocibles ni está en formato COCIR estándar. Primeras filas:\n${primerasFilas}`,
      }, { status: 400 });
    }

    // Upsert: insert new records, update existing ones (never delete)
    const { data: existentes } = await sb.from("cocir_padron").select("id, matricula");
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
    for (let i = 0; i < nuevos.length; i += LOTE) {
      const lote = nuevos.slice(i, i + LOTE);
      const { error } = await sb.from("cocir_padron").insert(lote);
      if (error) return NextResponse.json({ error: `Error insertando: ${error.message}` }, { status: 500 });
      insertados += lote.length;
    }
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
      modo: modoDetectado,
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Error procesando el archivo: ${e.message}` }, { status: 500 });
  }
}
