import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CAMPOS_CONOCIDOS = ["matricula", "apellido", "nombre", "estado", "inmobiliaria", "direccion", "localidad", "telefono", "email"] as const;

function detectarCampo(texto: string): string | null {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (t.includes("mat") || t.includes("legajo") || t.includes("nro")) return "matricula";
  if (t.includes("apellido")) return "apellido";
  if (t.includes("nombre")) return "nombre";
  if (t.includes("estado") || t.includes("situacion") || t.includes("hab")) return "estado";
  if (t.includes("inmob") || t.includes("empresa") || t.includes("razon")) return "inmobiliaria";
  if (t.includes("direcc") || t.includes("domicilio") || t.includes("calle")) return "direccion";
  if (t.includes("localidad") || t.includes("ciudad") || t.includes("partido")) return "localidad";
  if (t.includes("tel") || t.includes("celular") || t.includes("whatsapp")) return "telefono";
  if (t.includes("email") || t.includes("mail") || t.includes("correo")) return "email";
  return null;
}

export async function GET() {
  try {
    const url = "https://cocir.org.ar/paginas/matriculados";

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        "Referer": "https://cocir.org.ar/",
        "Cache-Control": "no-cache",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}`, total: 0 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Detect column order from thead headers
    const camposPorCol: string[] = [];
    $("table thead tr th, table thead tr td").each((i, el) => {
      camposPorCol[i] = detectarCampo($(el).text()) ?? `_col${i}`;
    });

    // Fallback: standard COCIR positional order if no thead
    const fallbackOrden: string[] = ["matricula", "apellido", "nombre", "estado", "inmobiliaria", "direccion", "localidad", "telefono", "email"];
    const usarFallback = camposPorCol.length === 0;

    const registros: any[] = [];

    $("table tr").each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length < 2) return;

      const rec: Record<string, string | null> = {};
      tds.each((i, td) => {
        const val = $(td).text().trim() || null;
        const campo = usarFallback ? (fallbackOrden[i] ?? null) : (camposPorCol[i] ?? null);
        if (campo && !campo.startsWith("_")) rec[campo] = val;
      });

      if (!rec.matricula && !rec.apellido && !rec.nombre) return;
      registros.push(rec);
    });

    if (registros.length === 0) {
      return NextResponse.json({
        ok: false, total: 0,
        debug: { status: res.status, htmlLen: html.length, tables: $("table").length },
      });
    }

    const ahora = new Date().toISOString();
    const { data: existentes } = await sb
      .from("cocir_padron")
      .select("id, matricula, estado, inmobiliaria, direccion, localidad, telefono, email");

    const mapa = new Map<string, any>();
    (existentes ?? []).forEach((r: any) => {
      if (r.matricula) mapa.set(String(r.matricula).trim(), r);
    });

    const nuevos: any[] = [];
    const actualizaciones: any[] = [];

    for (const reg of registros) {
      const mat = String(reg.matricula ?? "").trim();
      const existente = mat ? mapa.get(mat) : undefined;

      if (existente) {
        const update: any = { actualizado_at: ahora };
        let hayCambios = false;
        for (const campo of CAMPOS_CONOCIDOS) {
          if (campo === "estado" && reg[campo]) {
            // Always refresh estado
            update[campo] = reg[campo];
            hayCambios = true;
          } else if (reg[campo] != null && reg[campo] !== "" && !existente[campo]) {
            // Fill in empty fields
            update[campo] = reg[campo];
            hayCambios = true;
          }
        }
        if (hayCambios) actualizaciones.push({ ...update, id: existente.id });
      } else {
        nuevos.push({ ...reg, actualizado_at: ahora });
      }
    }

    const LOTE = 500;
    for (let i = 0; i < nuevos.length; i += LOTE) {
      const { error } = await sb.from("cocir_padron").insert(nuevos.slice(i, i + LOTE));
      if (error) return NextResponse.json({ ok: false, error: error.message });
    }
    for (const reg of actualizaciones) {
      const { id, ...campos } = reg;
      await sb.from("cocir_padron").update(campos).eq("id", id);
    }

    return NextResponse.json({
      ok: true,
      insertados: nuevos.length,
      actualizados: actualizaciones.length,
      total: registros.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
