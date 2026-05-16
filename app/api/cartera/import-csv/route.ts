// app/api/cartera/import-csv/route.ts
// Importación masiva desde CSV/Excel con columnas estándar + KiteProp + ZonaProp + otros

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Column aliases — case-insensitive, accent-stripped. null = skip column.
const ALIASES: Record<string, string | null> = {
  // Standard GFI
  titulo: "titulo", title: "titulo",
  tipo: "tipo", type: "tipo",
  operacion: "operacion", operation: "operacion",
  estado: "estado", status: "estado",
  precio: "precio", price: "precio",
  moneda: "moneda", currency: "moneda",
  ciudad: "ciudad", city: "ciudad",
  zona: "zona", barrio: "zona", neighborhood: "zona",
  direccion: "direccion", address: "direccion",
  dormitorios: "dormitorios", habitaciones: "dormitorios", rooms: "dormitorios", bedrooms: "dormitorios",
  banos: "banos", bathrooms: "banos",
  ambientes: "ambientes",
  "sup cubierta": "superficie_cubierta", "superficie cubierta": "superficie_cubierta", covered_area: "superficie_cubierta",
  "sup total": "superficie_total", "superficie total": "superficie_total", total_area: "superficie_total",
  antiguedad: "antiguedad", age: "antiguedad",
  descripcion: "descripcion", description: "descripcion",
  "apto credito": "apto_credito", credito: "apto_credito", credit: "apto_credito",
  cochera: "con_cochera", parking: "con_cochera", garaje: "con_cochera", garage: "con_cochera",
  expensas: "expensas", expenses: "expensas",
  video: "video_url", video_url: "video_url",
  fotos: "fotos", photos: "fotos",
  codigo: "codigo", code: "codigo", "codigo interno": "codigo", ref: "codigo", referencia: "codigo", cod: "codigo",

  // KiteProp
  "tipo de propiedad": "tipo",
  "tipo inmueble": "tipo",
  "tipo de inmueble": "tipo",
  "tipo de operacion": "operacion",
  "tipo operacion": "operacion",
  nombre: "titulo",
  "titulo propiedad": "titulo",
  "nombre propiedad": "titulo",
  localidad: "ciudad",
  "calle y numero": "direccion",
  "calle y nro": "direccion",
  calle: "direccion",
  "sup. cubierta": "superficie_cubierta",
  "sup. total": "superficie_total",
  "m2 cubiertos": "superficie_cubierta",
  "m2 totales": "superficie_total",
  "m2 cubierta": "superficie_cubierta",
  "m2 total": "superficie_total",
  "superficie cubierta m2": "superficie_cubierta",
  "superficie total m2": "superficie_total",
  "precio venta": "precio",
  "precio alquiler": "precio",
  valor: "precio",

  // ZonaProp / Argenprop extras
  "precio usd": "precio",
  "precio ars": "precio",

  // Columns to skip
  id: null,
  "id interno": null,
  "fecha de alta": null,
  "fecha alta": null,
  "fecha de modificacion": null,
  "fecha modificacion": null,
  "fecha de baja": null,
  "url portal": null,
  url: null,
  link: null,
  publicado: null,
  "publicada web": null,
  provincia: null,
  pais: null,
  pisos: null,
  planta: null,
  unidad: null,
};

const TIPOS_VALIDOS = ["Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Cochera", "Galpon", "Otro"];
const OPS_VALIDAS = ["Venta", "Alquiler", "Alquiler temporal"];
const ESTADOS_VALIDOS = ["activa", "reservada", "vendida", "pausada"];
const MONEDAS_VALIDAS = ["USD", "ARS", "EUR"];

const TIPOS_MAP: Record<string, string> = {
  "local comercial": "Local",
  "galpon": "Galpon",
  "garage": "Cochera",
  "garaje": "Cochera",
  "estacionamiento": "Cochera",
  "vivienda": "Casa",
  "chalet": "Casa",
  "country": "Casa",
  "quinta": "Casa",
  "ph": "PH",
  "duplex": "PH",
};

const OPS_MAP: Record<string, string> = {
  "venta": "Venta",
  "sale": "Venta",
  "compra": "Venta",
  "alquiler": "Alquiler",
  "alquilar": "Alquiler",
  "rent": "Alquiler",
  "locacion": "Alquiler",
  "alquiler temporal": "Alquiler temporal",
  "temporal": "Alquiler temporal",
  "vacation rental": "Alquiler temporal",
  "turistico": "Alquiler temporal",
};

function normalizarCampo(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Parse Argentine number format: "1.200.000" or "1.200.000,50" or "120000"
function parseNum(v: string): number | null {
  if (!v) return null;
  let s = v.replace(/[$€\s]/g, "").trim();
  if (!s || s === "-") return null;
  const dotCount = (s.match(/\./g) || []).length;
  const hasComma = s.includes(",");
  if (dotCount > 1) {
    // "1.200.000" or "1.200.000,50" — dots are thousand separators
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (dotCount === 1 && hasComma) {
    // "1.200,50" — dot is thousand separator, comma is decimal
    s = s.replace(".", "").replace(",", ".");
  } else if (!dotCount && hasComma) {
    // "1200,50" — comma is decimal
    s = s.replace(",", ".");
  } else if (dotCount === 1 && /\.\d{3}$/.test(s)) {
    // "120.000" — dot is thousand separator
    s = s.replace(".", "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function pickTipo(v: string): string {
  if (!v) return "Departamento";
  const lower = normalizarCampo(v);
  const exact = TIPOS_VALIDOS.find(o => normalizarCampo(o) === lower);
  if (exact) return exact;
  if (TIPOS_MAP[lower]) return TIPOS_MAP[lower];
  for (const [k, mapped] of Object.entries(TIPOS_MAP)) {
    if (lower.includes(k)) return mapped;
  }
  for (const tipo of TIPOS_VALIDOS) {
    if (lower.includes(normalizarCampo(tipo))) return tipo;
  }
  return "Departamento";
}

function pickOp(v: string): string {
  if (!v) return "Venta";
  const lower = normalizarCampo(v);
  const exact = OPS_VALIDAS.find(o => normalizarCampo(o) === lower);
  if (exact) return exact;
  return OPS_MAP[lower] ?? "Venta";
}

function parsearCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Skip leading blank lines
  let headerIdx = 0;
  while (headerIdx < lines.length && !lines[headerIdx].trim()) headerIdx++;
  if (headerIdx >= lines.length || lines.length - headerIdx < 2) return { headers: [], rows: [] };

  const headerLine = lines[headerIdx];
  // Detect separator: prefer semicolon if more semicolons than commas
  const sep = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ";" : ",";

  const rawHeaders = headerLine.split(sep).map(h => h.replace(/^["'\s]+|["'\s]+$/g, "").trim());
  const headers = rawHeaders.map(h => {
    const norm = normalizarCampo(h);
    const alias = ALIASES[norm];
    if (alias === null) return "__skip__";
    return alias ?? norm;
  });

  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line + sep) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === sep && !inQ) { vals.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    if (vals.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h !== "__skip__") row[h] = (vals[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers: headers.filter(h => h !== "__skip__"), rows };
}

function rowToCartera(row: Record<string, string>, perfilId: string): any {
  const bool = (v: string) => ["si", "yes", "true", "1", "x", "con"].includes((v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));

  return {
    perfil_id: perfilId,
    titulo: row.titulo || "Propiedad importada",
    tipo: pickTipo(row.tipo ?? ""),
    operacion: pickOp(row.operacion ?? ""),
    estado: ESTADOS_VALIDOS.find(s => s === (row.estado ?? "").toLowerCase()) ?? "activa",
    precio: parseNum(row.precio ?? ""),
    moneda: MONEDAS_VALIDAS.includes((row.moneda ?? "").toUpperCase())
      ? (row.moneda ?? "USD").toUpperCase() : "USD",
    ciudad: row.ciudad || "Rosario",
    zona: row.zona || null,
    direccion: row.direccion || null,
    dormitorios: parseNum(row.dormitorios ?? ""),
    banos: parseNum(row.banos ?? ""),
    ambientes: parseNum(row.ambientes ?? ""),
    superficie_cubierta: parseNum(row.superficie_cubierta ?? ""),
    superficie_total: parseNum(row.superficie_total ?? ""),
    antiguedad: row.antiguedad || null,
    descripcion: row.descripcion || null,
    apto_credito: bool(row.apto_credito ?? ""),
    con_cochera: bool(row.con_cochera ?? ""),
    expensas: parseNum(row.expensas ?? ""),
    video_url: row.video_url || null,
    codigo: row.codigo || null,
    fotos: row.fotos ? row.fotos.split("|").map(u => u.trim()).filter(Boolean) : [],
    publicada_web: false,
    ocultar_precio: false,
    ocultar_ubicacion: false,
    ocultar_de_redes: false,
    ocultar_web: false,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { csv, perfil_id, preview, selectedRows } = body;
    if (!csv || !perfil_id) {
      return NextResponse.json({ error: "csv y perfil_id requeridos" }, { status: 400 });
    }

    const { rows } = parsearCSV(csv);
    if (rows.length === 0) {
      return NextResponse.json({ error: "El archivo no tiene filas válidas. Verificá que las columnas tengan nombres reconocibles." }, { status: 400 });
    }

    // Preview mode: return parsed rows without saving
    if (preview) {
      const previewRows = rows.map((row, i) => {
        const vals = Object.values(row).filter(v => v && v !== "0");
        if (vals.length < 2) return null;
        const d = rowToCartera(row, perfil_id);
        return {
          idx: i,
          titulo: d.titulo,
          tipo: d.tipo,
          operacion: d.operacion,
          precio: d.precio,
          moneda: d.moneda,
          ciudad: d.ciudad,
          zona: d.zona,
          dormitorios: d.dormitorios,
          superficie_cubierta: d.superficie_cubierta,
        };
      }).filter(Boolean);
      return NextResponse.json({ ok: true, preview: previewRows, total: previewRows.length });
    }

    // Normal import: save rows (optionally filtered by selectedRows index array)
    const toImport = selectedRows
      ? rows.filter((_, i) => (selectedRows as number[]).includes(i))
      : rows;

    let importadas = 0;
    const errores: string[] = [];

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      const vals = Object.values(row).filter(v => v && v !== "0");
      if (vals.length < 2) continue;
      try {
        const data = rowToCartera(row, perfil_id);
        const { error } = await sb.from("cartera_propiedades").insert(data);
        if (error) errores.push(`Fila ${i + 2}: ${error.message}`);
        else importadas++;
      } catch (e: any) {
        errores.push(`Fila ${i + 2}: ${e.message}`);
      }
    }

    return NextResponse.json({ ok: true, total: toImport.length, importadas, errores: errores.slice(0, 20) });
  } catch (e: any) {
    console.error("Error en import-csv:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET returns a CSV template for download
export async function GET() {
  const headers = [
    "titulo", "tipo", "operacion", "estado", "precio", "moneda",
    "ciudad", "zona", "direccion", "dormitorios", "banos", "ambientes",
    "sup cubierta", "sup total", "antiguedad", "descripcion",
    "apto credito", "cochera", "expensas", "video", "fotos", "codigo",
  ].join(",");
  const example = [
    "Departamento en venta Pichincha", "Departamento", "Venta", "activa",
    "120000", "USD", "Rosario", "Pichincha", "Mendoza 1234",
    "3", "1", "4", "65", "70", "10-20 años",
    "Luminoso departamento...", "Si", "No", "", "", "", "GFI-001",
  ].join(",");

  return new NextResponse(`${headers}\n${example}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-cartera-gfi.csv"',
    },
  });
}
