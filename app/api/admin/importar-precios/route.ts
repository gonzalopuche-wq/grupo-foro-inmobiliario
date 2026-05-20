import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function authorizado(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return false;
  const { data: p } = await sb
    .from("perfiles")
    .select("tipo")
    .eq("id", data.user.id)
    .single();
  return p?.tipo === "admin";
}

function detectarCol(headers: string[], palabras: string[]): number {
  return headers.findIndex((h) => {
    const n = h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();
    return palabras.some((p) => n.includes(p));
  });
}

function parsearPrecio(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const s = String(val)
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

interface FilaParseada {
  codigo: string | null;
  piso: string | null;
  numero_unidad: string | null;
  numero_torre: string | null;
  precio: number | null;
  moneda: string | null;
}

function parsearArchivo(buffer: Buffer, nombre: string): FilaParseada[] | { error: string } {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    return { error: "Los archivos PDF no están soportados por ahora. Por favor convertí el archivo a Excel (.xlsx) o CSV y volvé a intentarlo." };
  }

  let filas: unknown[][];
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  } catch {
    return { error: "No se pudo leer el archivo. Verificá que sea un Excel o CSV válido." };
  }

  if (filas.length < 2) return { error: "El archivo está vacío o tiene muy pocas filas." };

  // Buscar fila de encabezados (primeras 10 filas)
  const PALABRAS_ENCABEZADO = [
    "codigo", "cod", "piso", "floor", "unidad", "unit", "depto", "dpto",
    "torre", "tower", "bloque", "precio", "price", "valor", "importe", "monto",
    "moneda", "currency",
  ];

  let filaEncabezado = 0;
  let mejorPuntaje = 0;
  for (let i = 0; i < Math.min(10, filas.length); i++) {
    const celdas = filas[i].map((c) =>
      String(c ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
    );
    const noVacias = celdas.filter((c) => c.length > 0).length;
    const coincidencias = celdas.filter((c) => PALABRAS_ENCABEZADO.some((p) => c.includes(p))).length;
    const puntaje = coincidencias * 10 + noVacias;
    if (puntaje > mejorPuntaje && noVacias >= 2) {
      mejorPuntaje = puntaje;
      filaEncabezado = i;
    }
  }

  const headers = filas[filaEncabezado].map((h) => String(h ?? ""));
  const colCodigo  = detectarCol(headers, ["codigo", "cod", "code", "ref"]);
  const colPiso    = detectarCol(headers, ["piso", "floor", "nivel"]);
  const colUnidad  = detectarCol(headers, ["unidad", "unit", "depto", "dpto", "departamento", "nro", "numero"]);
  const colTorre   = detectarCol(headers, ["torre", "tower", "bloque", "block", "edificio"]);
  const colPrecio  = detectarCol(headers, ["precio", "price", "valor", "importe", "monto", "venta"]);
  const colMoneda  = detectarCol(headers, ["moneda", "currency", "curr"]);

  if (colPrecio < 0) {
    return { error: `No se encontró columna de precio. Encabezados detectados: ${headers.filter(Boolean).join(", ")}` };
  }
  if (colCodigo < 0 && colUnidad < 0) {
    return { error: `No se encontró columna de unidad ni código. Encabezados detectados: ${headers.filter(Boolean).join(", ")}` };
  }

  const resultado: FilaParseada[] = [];
  for (let i = filaEncabezado + 1; i < filas.length; i++) {
    const fila = filas[i];
    const precio = parsearPrecio(colPrecio >= 0 ? fila[colPrecio] : null);
    if (precio === null) continue;

    const codigo  = colCodigo >= 0  ? String(fila[colCodigo]  ?? "").trim() || null : null;
    const piso    = colPiso >= 0    ? String(fila[colPiso]    ?? "").trim() || null : null;
    const unidad  = colUnidad >= 0  ? String(fila[colUnidad]  ?? "").trim() || null : null;
    const torre   = colTorre >= 0   ? String(fila[colTorre]   ?? "").trim() || null : null;
    const moneda  = colMoneda >= 0  ? String(fila[colMoneda]  ?? "").trim().toUpperCase() || null : null;

    if (!codigo && !unidad) continue;

    resultado.push({ codigo, piso, numero_unidad: unidad, numero_torre: torre, precio, moneda });
  }

  return resultado;
}

interface PropDB {
  id: string;
  codigo: string | null;
  piso: string | null;
  numero_unidad: string | null;
  numero_torre: string | null;
  precio: number | null;
  moneda: string | null;
  perfil_id: string;
  titulo: string | null;
}

interface Match {
  id: string;
  codigo: string | null;
  piso: string | null;
  numero_unidad: string | null;
  numero_torre: string | null;
  titulo: string | null;
  precio_actual: number | null;
  moneda_actual: string | null;
  precio_nuevo: number;
  moneda_nueva: string | null;
}

export async function POST(req: NextRequest) {
  if (!(await authorizado(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const archivo = form.get("archivo") as File | null;
    const modo = (form.get("modo") as string) ?? "preview";
    const constructoraId = (form.get("constructora_id") as string) ?? "";

    if (!archivo) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const filas = parsearArchivo(buffer, archivo.name);

    if ("error" in filas) {
      return NextResponse.json({ error: filas.error }, { status: 400 });
    }
    if (filas.length === 0) {
      return NextResponse.json({ error: "El archivo no contiene filas con precios válidos." }, { status: 400 });
    }

    // Cargar propiedades de la DB
    let query = sb
      .from("cartera_propiedades")
      .select("id, codigo, piso, numero_unidad, numero_torre, precio, moneda, perfil_id, titulo");
    if (constructoraId) {
      query = query.eq("perfil_id", constructoraId);
    }
    const { data: props, error: dbErr } = await query;
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    const propiedades = (props ?? []) as PropDB[];

    // Indexar por codigo y por piso+unidad+torre
    const porCodigo = new Map<string, PropDB>();
    const porUbicacion = new Map<string, PropDB>();
    for (const p of propiedades) {
      if (p.codigo) porCodigo.set(p.codigo.trim().toLowerCase(), p);
      const claveUbic = [p.piso ?? "", p.numero_unidad ?? "", p.numero_torre ?? ""]
        .map((s) => s.trim().toLowerCase()).join("|");
      if (p.numero_unidad) porUbicacion.set(claveUbic, p);
    }

    const matches: Match[] = [];
    const sinMatch: FilaParseada[] = [];

    for (const fila of filas) {
      let prop: PropDB | undefined;

      // 1. Buscar por codigo
      if (fila.codigo) {
        prop = porCodigo.get(fila.codigo.toLowerCase());
      }
      // 2. Buscar por piso+unidad+torre
      if (!prop && fila.numero_unidad) {
        const clave = [fila.piso ?? "", fila.numero_unidad ?? "", fila.numero_torre ?? ""]
          .map((s) => s.trim().toLowerCase()).join("|");
        prop = porUbicacion.get(clave);
      }
      // 3. Buscar solo por unidad (sin piso/torre)
      if (!prop && fila.numero_unidad) {
        const clave = ["", fila.numero_unidad.trim().toLowerCase(), ""].join("|");
        prop = porUbicacion.get(clave);
      }

      if (prop) {
        matches.push({
          id: prop.id,
          codigo: prop.codigo,
          piso: prop.piso,
          numero_unidad: prop.numero_unidad,
          numero_torre: prop.numero_torre,
          titulo: prop.titulo,
          precio_actual: prop.precio,
          moneda_actual: prop.moneda,
          precio_nuevo: fila.precio!,
          moneda_nueva: fila.moneda ?? prop.moneda,
        });
      } else {
        sinMatch.push(fila);
      }
    }

    if (modo === "preview") {
      return NextResponse.json({
        ok: true,
        modo: "preview",
        total_archivo: filas.length,
        matches: matches.length,
        sin_match: sinMatch.length,
        preview: matches,
        sin_match_detalle: sinMatch.slice(0, 20),
      });
    }

    // Modo aplicar
    if (matches.length === 0) {
      return NextResponse.json({ error: "No hay coincidencias para actualizar." }, { status: 400 });
    }

    const ahora = new Date().toISOString();
    let actualizados = 0;
    const errores: string[] = [];

    const LOTE = 50;
    for (let i = 0; i < matches.length; i += LOTE) {
      const lote = matches.slice(i, i + LOTE);
      await Promise.all(
        lote.map(async (m) => {
          const { error } = await sb
            .from("cartera_propiedades")
            .update({
              precio_anterior: m.precio_actual,
              precio: m.precio_nuevo,
              moneda: m.moneda_nueva ?? m.moneda_actual ?? "USD",
              updated_at: ahora,
            })
            .eq("id", m.id);
          if (error) errores.push(`${m.id}: ${error.message}`);
          else actualizados++;
        })
      );
    }

    return NextResponse.json({
      ok: true,
      modo: "aplicar",
      actualizados,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: `Error procesando el archivo: ${msg}` }, { status: 500 });
  }
}
