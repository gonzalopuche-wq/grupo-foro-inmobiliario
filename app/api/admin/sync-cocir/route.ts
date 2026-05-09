import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCol(tds: any, idx: number, $: cheerio.CheerioAPI): string | null {
  if (idx < 0 || idx >= tds.length) return null;
  const val = $(tds[idx]).text().trim();
  return val || null;
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
      return NextResponse.json({ error: `HTTP ${res.status} al fetchar COCIR` }, { status: 500 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Detect column positions from header row
    const colMap: Record<string, number> = {};
    $("table tr:first-child th, table thead tr th").each((i, el) => {
      const text = $(el).text().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      if (text.includes("matricula")) colMap.matricula = i;
      else if (text.includes("apellido")) colMap.apellido = i;
      else if (text.includes("nombre")) colMap.nombre = i;
      else if (text.includes("estado")) colMap.estado = i;
      else if (text.includes("inmobiliaria") || text.includes("razon social") || text.includes("razon")) colMap.inmobiliaria = i;
      else if (text.includes("telefono") || text.includes("tel.") || text === "tel") colMap.telefono = i;
      else if (text.includes("email") || text.includes("correo")) colMap.email = i;
      else if (text.includes("direccion")) colMap.direccion = i;
      else if (text.includes("localidad")) colMap.localidad = i;
    });

    // Fallback column positions based on known COCIR table structure
    const col = {
      matricula:   colMap.matricula   ?? 0,
      apellido:    colMap.apellido    ?? 1,
      nombre:      colMap.nombre      ?? 2,
      estado:      colMap.estado      ?? 3,
      inmobiliaria:colMap.inmobiliaria?? 4,
      telefono:    colMap.telefono    ?? 5,
      email:       colMap.email       ?? 6,
      direccion:   colMap.direccion   ?? 7,
      localidad:   colMap.localidad   ?? 8,
    };

    const debug = {
      statusHttp: res.status,
      htmlLen: html.length,
      tables: $("table").length,
      trs: $("tr").length,
      tds: $("td").length,
      colMap,
      snippet: html.slice(0, 800),
    };

    const ahora = new Date().toISOString();
    const registros: any[] = [];

    $("table tr").each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length < 3) return;
      const matricula = getCol(tds, col.matricula, $);
      const apellido  = getCol(tds, col.apellido,  $);
      const nombre    = getCol(tds, col.nombre,    $);
      if (!apellido && !nombre) return; // skip header-like rows with no name
      registros.push({
        matricula,
        apellido:     apellido ?? "",
        nombre:       nombre ?? "",
        estado:       getCol(tds, col.estado,       $) ?? "activo",
        inmobiliaria: getCol(tds, col.inmobiliaria, $),
        telefono:     getCol(tds, col.telefono,     $),
        email:        getCol(tds, col.email,        $),
        direccion:    getCol(tds, col.direccion,    $),
        localidad:    getCol(tds, col.localidad,    $),
        actualizado_at: ahora,
      });
    });

    if (registros.length === 0) {
      return NextResponse.json({ ok: false, total: 0, debug }, { status: 200 });
    }

    // Safety guard: require a meaningful number of records before wiping the table.
    // If COCIR returns an unusually small payload (bot block, error page, etc.)
    // we skip the replace to avoid leaving cocir_padron empty.
    if (registros.length < 100) {
      return NextResponse.json({ ok: false, total: registros.length, error: "Demasiado pocos registros para reemplazar el padrón — posible bloqueo o cambio de formato", debug }, { status: 200 });
    }

    await sb.from("cocir_padron").delete().neq("matricula", "");
    const { error } = await sb.from("cocir_padron").insert(registros);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const conTelefono = registros.filter(r => r.telefono).length;
    return NextResponse.json({ ok: true, total: registros.length, conTelefono, colMap });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
