// app/api/cartera/import-csv/route.ts
// Importación masiva desde CSV con columnas estándar

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Accepted column aliases (case-insensitive, with/without accent)
const ALIASES: Record<string, string> = {
  titulo: "titulo", title: "titulo", nombre: "titulo",
  tipo: "tipo", "tipo propiedad": "tipo", type: "tipo",
  operacion: "operacion", operación: "operacion", operation: "operacion",
  estado: "estado", status: "estado",
  precio: "precio", price: "precio",
  moneda: "moneda", currency: "moneda",
  ciudad: "ciudad", city: "ciudad",
  zona: "zona", barrio: "zona", neighborhood: "zona",
  direccion: "direccion", dirección: "direccion", address: "direccion",
  dormitorios: "dormitorios", habitaciones: "dormitorios", rooms: "dormitorios", bedrooms: "dormitorios",
  banos: "banos", baños: "banos", bathrooms: "banos",
  ambientes: "ambientes",
  "sup cubierta": "superficie_cubierta", "superficie cubierta": "superficie_cubierta", covered_area: "superficie_cubierta",
  "sup total": "superficie_total", "superficie total": "superficie_total", total_area: "superficie_total",
  antiguedad: "antiguedad", antigüedad: "antiguedad", age: "antiguedad",
  descripcion: "descripcion", descripción: "descripcion", description: "descripcion",
  "apto credito": "apto_credito", credito: "apto_credito", credit: "apto_credito",
  cochera: "con_cochera", parking: "con_cochera",
  expensas: "expensas", expenses: "expensas",
  video: "video_url", video_url: "video_url",
  fotos: "fotos", photos: "fotos",
  codigo: "codigo", code: "codigo", "codigo interno": "codigo",
};

const TIPOS_VALIDOS = ["Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Cochera", "Galpon", "Otro"];
const OPS_VALIDAS = ["Venta", "Alquiler", "Alquiler temporal"];
const ESTADOS_VALIDOS = ["activa", "reservada", "vendida", "pausada"];
const MONEDAS_VALIDAS = ["USD", "ARS", "EUR"];

function normalizarCampo(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function parsearCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse header — support comma or semicolon
  const sep = lines[0].includes(";") ? ";" : ",";
  const rawHeaders = lines[0].split(sep).map(h => h.replace(/^["']|["']$/g, "").trim());
  const headers = rawHeaders.map(h => ALIASES[normalizarCampo(h)] ?? normalizarCampo(h));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple CSV parse (handles quoted fields)
    const vals: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line + sep) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === sep && !inQ) { vals.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    if (vals.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? "").trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function rowToCartera(row: Record<string, string>, perfilId: string): any {
  const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const bool = (v: string) => ["si", "sí", "yes", "true", "1", "x"].includes(v.toLowerCase());
  const pick = (v: string, validos: string[], def: string) =>
    validos.find(o => o.toLowerCase() === v.toLowerCase()) ?? def;

  return {
    perfil_id: perfilId,
    titulo: row.titulo || "Propiedad importada",
    tipo: pick(row.tipo ?? "", TIPOS_VALIDOS, "Departamento"),
    operacion: pick(row.operacion ?? "", OPS_VALIDAS, "Venta"),
    estado: pick(row.estado ?? "", ESTADOS_VALIDOS, "activa"),
    precio: num(row.precio ?? ""),
    moneda: MONEDAS_VALIDAS.includes((row.moneda ?? "").toUpperCase())
      ? (row.moneda ?? "USD").toUpperCase() : "USD",
    ciudad: row.ciudad || "Rosario",
    zona: row.zona || null,
    direccion: row.direccion || null,
    dormitorios: num(row.dormitorios ?? ""),
    banos: num(row.banos ?? ""),
    ambientes: num(row.ambientes ?? ""),
    superficie_cubierta: num(row.superficie_cubierta ?? ""),
    superficie_total: num(row.superficie_total ?? ""),
    antiguedad: row.antiguedad || null,
    descripcion: row.descripcion || null,
    apto_credito: bool(row.apto_credito ?? ""),
    con_cochera: bool(row.con_cochera ?? ""),
    expensas: num(row.expensas ?? ""),
    video_url: row.video_url || null,
    codigo: row.codigo || null,
    fotos: row.fotos ? row.fotos.split("|").map(u => u.trim()).filter(Boolean) : [],
    publicada_web: false,
    compartir_en_red: false,
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
    const { csv, perfil_id } = body;
    if (!csv || !perfil_id) {
      return NextResponse.json({ error: "csv y perfil_id requeridos" }, { status: 400 });
    }

    const { rows } = parsearCSV(csv);
    if (rows.length === 0) {
      return NextResponse.json({ error: "El archivo no tiene filas válidas" }, { status: 400 });
    }

    let importadas = 0;
    const errores: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.titulo && !row.tipo && !row.operacion) continue; // skip empty rows
      try {
        const data = rowToCartera(row, perfil_id);
        const { error } = await sb.from("cartera_propiedades").insert(data);
        if (error) errores.push(`Fila ${i + 2}: ${error.message}`);
        else importadas++;
      } catch (e: any) {
        errores.push(`Fila ${i + 2}: ${e.message}`);
      }
    }

    return NextResponse.json({ ok: true, total: rows.length, importadas, errores: errores.slice(0, 20) });
  } catch (e: any) {
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
