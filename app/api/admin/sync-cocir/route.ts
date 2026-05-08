import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      return NextResponse.json({ error: `HTTP ${res.status} al fetchar COCIR` }, { status: 500 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Debug: estructura encontrada
    const debug = {
      statusHttp: res.status,
      htmlLen: html.length,
      tables: $("table").length,
      trs: $("tr").length,
      tds: $("td").length,
      snippet: html.slice(0, 800),
    };

    const registros: any[] = [];

    // Intento 1: tabla estándar
    $("table tr").each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        registros.push({
          matricula: $(tds[0]).text().trim(),
          apellido: $(tds[1]).text().trim(),
          nombre: $(tds[2]).text().trim(),
          estado: tds[3] ? $(tds[3]).text().trim() : "activo",
          inmobiliaria: tds[4] ? $(tds[4]).text().trim() : null,
        });
      }
    });

    // Si no encontró nada (COCIR bloqueó o cambió estructura), NO tocar la DB
    if (registros.length === 0) {
      return NextResponse.json({ ok: false, total: 0, debug }, { status: 200 });
    }

    // Upsert: agregar nuevos + actualizar existentes, nunca borrar
    const ahora = new Date().toISOString();
    const { data: existentes } = await sb.from("cocir_padron").select("id, matricula");
    const mapa = new Map<string, string>();
    (existentes ?? []).forEach((r: any) => { if (r.matricula) mapa.set(String(r.matricula).trim(), r.id); });

    const nuevos: any[] = [];
    const actualizaciones: any[] = [];
    for (const reg of registros) {
      const mat = String(reg.matricula ?? "").trim();
      const conFecha = { ...reg, actualizado_at: ahora };
      if (mat && mapa.has(mat)) actualizaciones.push({ ...conFecha, id: mapa.get(mat) });
      else nuevos.push(conFecha);
    }

    if (nuevos.length > 0) {
      const { error } = await sb.from("cocir_padron").insert(nuevos);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const reg of actualizaciones) {
      const { id, ...campos } = reg;
      await sb.from("cocir_padron").update(campos).eq("id", id);
    }

    return NextResponse.json({ ok: true, insertados: nuevos.length, actualizados: actualizaciones.length, total: registros.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
