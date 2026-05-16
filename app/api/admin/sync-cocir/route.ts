import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CAMPOS_CONOCIDOS = ["matricula", "apellido", "nombre", "estado", "inmobiliaria", "direccion", "localidad", "telefono", "email"] as const;
const FALLBACK_ORDEN = ["matricula", "apellido", "nombre", "estado", "inmobiliaria", "direccion", "localidad", "telefono", "email"];
const BASE_URL = "https://cocir.org.ar/paginas/matriculados";
const MAX_PAGINAS = 200;
const BATCH_PARALELO = 5;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
  "Referer": "https://cocir.org.ar/",
  "Cache-Control": "no-cache",
};

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

function parsearTabla(html: string, camposPorCol: string[]): any[] {
  const $ = cheerio.load(html);
  const usarFallback = camposPorCol.length === 0;
  const registros: any[] = [];

  $("table tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 2) return;
    const rec: Record<string, string | null> = {};
    tds.each((i, td) => {
      const val = $(td).text().trim() || null;
      const campo = usarFallback ? (FALLBACK_ORDEN[i] ?? null) : (camposPorCol[i] ?? null);
      if (campo && !campo.startsWith("_")) rec[campo] = val;
    });
    if (!rec.matricula && !rec.apellido && !rec.nombre) return;
    registros.push(rec);
  });

  return registros;
}

function detectarUltimaPagina($: cheerio.CheerioAPI): number {
  let maxPag = 1;

  // Look for page number links
  $("a[href]").each((_, el) => {
    const href = $( el).attr("href") ?? "";
    // Match ?page=N, ?pagina=N, &page=N, /matriculados/N, /matriculados?page=N
    const m = href.match(/[?&/](?:page|pagina|p)=?(\d+)/i) ?? href.match(/matriculados[/?](\d+)/i);
    if (m) {
      const n = parseInt(m[1]);
      if (n > maxPag) maxPag = n;
    }
    // Also check text content for page numbers
    const txt = $( el).text().trim();
    if (/^\d+$/.test(txt)) {
      const n = parseInt(txt);
      if (n > maxPag && n < MAX_PAGINAS) maxPag = n;
    }
  });

  // Check for aria-label="Next" or "Siguiente" text
  const hayMasPag = $("a:contains('Siguiente'), a:contains('siguiente'), a[rel='next'], .pagination .next:not(.disabled)").length > 0;
  if (hayMasPag && maxPag === 1) maxPag = 2; // At least 2 pages

  return maxPag;
}

function urlPagina(n: number, patron: string): string {
  return patron.replace("{n}", String(n));
}

// Normalize Argentine phone numbers to +54 9 XXXXXXXXXX format
function normalizarTelefono(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  const d = digits.replace(/^\+/, "");
  // Already international
  if (d.startsWith("549") && d.length >= 12) return `+${d}`;
  if (d.startsWith("54") && d.length >= 11) return `+54 9 ${d.slice(2)}`;
  // Local with 0: 011... or 0341...
  if (d.startsWith("0") && d.length >= 10) return `+54 9 ${d.slice(1)}`;
  // 10-digit local
  if (d.length === 10) return `+54 9 ${d}`;
  if (d.length < 8) return null;
  return `+54 9 ${d}`;
}

async function fetchPagina(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    // --- Fetch page 1 ---
    const html1 = await fetchPagina(BASE_URL);
    if (!html1) return NextResponse.json({ ok: false, error: "No se pudo acceder a cocir.org.ar" });

    const $1 = cheerio.load(html1);

    // Detect columns from thead
    const camposPorCol: string[] = [];
    $1("table thead tr th, table thead tr td").each((i, el) => {
      camposPorCol[i] = detectarCampo($1(el).text()) ?? `_col${i}`;
    });

    const registrosPag1 = parsearTabla(html1, camposPorCol);

    if (registrosPag1.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No se encontraron registros en la primera página",
        debug: {
          htmlLen: html1.length,
          tables: $1("table").length,
          thead: $1("table thead").length,
        },
      });
    }

    // --- Detect pagination ---
    const ultimaPagina = detectarUltimaPagina($1);

    // Detect URL pattern for pagination
    let patronPaginacion = `${BASE_URL}?page={n}`;
    const linkPaginaEjemplo = $1("a[href]").filter((_, el) => {
      const href = $1(el).attr("href") ?? "";
      return /[?&](?:page|pagina)=\d+/i.test(href) || /matriculados[/?]\d+/.test(href);
    }).first().attr("href") ?? "";

    if (linkPaginaEjemplo) {
      // Infer pattern from example link
      const m = linkPaginaEjemplo.match(/([?&])(?:page|pagina|p)=\d+/i);
      if (m) {
        const sep = m[1];
        const key = m[0].replace(m[1], "").replace(/=\d+$/, "");
        patronPaginacion = `${BASE_URL}${sep}${key}={n}`;
      } else if (/matriculados\/\d+/.test(linkPaginaEjemplo)) {
        patronPaginacion = `${BASE_URL}/{n}`;
      }
    }

    // --- Fetch remaining pages in parallel batches ---
    const todosRegistros = [...registrosPag1];
    const matriculasVistas = new Set<string>(registrosPag1.map(r => String(r.matricula ?? "").trim()).filter(Boolean));

    if (ultimaPagina > 1) {
      const paginas = Array.from({ length: ultimaPagina - 1 }, (_, i) => i + 2);
      for (let i = 0; i < paginas.length; i += BATCH_PARALELO) {
        const lote = paginas.slice(i, i + BATCH_PARALELO);
        const resultados = await Promise.all(
          lote.map(n => fetchPagina(urlPagina(n, patronPaginacion)))
        );
        let alguno = false;
        for (const html of resultados) {
          if (!html) continue;
          const regs = parsearTabla(html, camposPorCol);
          for (const r of regs) {
            const mat = String(r.matricula ?? "").trim();
            if (mat && matriculasVistas.has(mat)) continue; // skip duplicate
            if (mat) matriculasVistas.add(mat);
            todosRegistros.push(r);
            alguno = true;
          }
        }
        // Stop early if no new records in this batch (last page reached)
        if (!alguno) break;
      }
    }

    // --- UPSERT to DB ---
    const ahora = new Date().toISOString();
    const { data: existentes } = await sb
      .from("cocir_padron")
      .select("id, matricula, estado, inmobiliaria, direccion, localidad, telefono, email, apellido, nombre");

    const mapa = new Map<string, any>();
    (existentes ?? []).forEach((r: any) => {
      if (r.matricula) mapa.set(String(r.matricula).trim(), r);
    });

    const nuevos: any[] = [];
    const actualizaciones: any[] = [];
    let sinCambios = 0;

    for (const reg of todosRegistros) {
      const mat = String(reg.matricula ?? "").trim();
      const existente = mat ? mapa.get(mat) : undefined;

      if (existente) {
        const update: any = { actualizado_at: ahora };
        let hayCambios = false;
        for (const campo of CAMPOS_CONOCIDOS) {
          const newVal = reg[campo];
          if (!newVal) continue;
          if (existente[campo] !== newVal) {
            update[campo] = newVal;
            hayCambios = true;
          }
        }
        if (hayCambios) {
          actualizaciones.push({ ...update, id: existente.id });
        } else {
          sinCambios++;
        }
      } else {
        nuevos.push({ ...reg, actualizado_at: ahora });
      }
    }

    const LOTE = 500;
    for (let i = 0; i < nuevos.length; i += LOTE) {
      const { error } = await sb.from("cocir_padron").insert(nuevos.slice(i, i + LOTE));
      if (error) return NextResponse.json({ ok: false, error: error.message });
    }

    for (let i = 0; i < actualizaciones.length; i += LOTE) {
      const { error } = await sb.from("cocir_padron").upsert(actualizaciones.slice(i, i + LOTE));
      if (error) return NextResponse.json({ ok: false, error: error.message });
    }

    // ── Validar matrículas de perfiles GFI + sincronizar teléfono desde COCIR ──
    const { data: perfilesGfi } = await sb
      .from("perfiles")
      .select("id, matricula, telefono, whatsapp_negocio")
      .not("matricula", "is", null)
      .neq("matricula", "");

    const { data: padronActual } = await sb
      .from("cocir_padron")
      .select("matricula, estado, telefono, email");

    interface PadronEntry { estado: string; telefono: string | null; email: string | null }
    const padronMap = new Map<string, PadronEntry>();
    for (const p of padronActual ?? []) {
      if (p.matricula) {
        padronMap.set(String(p.matricula).trim(), {
          estado: p.estado ?? "activo",
          telefono: p.telefono ?? null,
          email: p.email ?? null,
        });
      }
    }

    let validados = 0;
    let suspendidos = 0;
    let noEncontrados = 0;
    let telefonosSincronizados = 0;

    for (const perfil of perfilesGfi ?? []) {
      const mat = String(perfil.matricula ?? "").trim();
      if (!mat) continue;
      const entrada = padronMap.get(mat);
      let nuevoEstado: string;
      if (!entrada) {
        nuevoEstado = "no_encontrado";
        noEncontrados++;
      } else if (/suspendid|inhabilitad|baja/i.test(entrada.estado)) {
        nuevoEstado = "suspendido";
        suspendidos++;
      } else {
        nuevoEstado = "activo";
        validados++;
      }

      const upd: Record<string, any> = { cocir_estado: nuevoEstado, cocir_ultimo_control: ahora };

      // Backfill phone from COCIR if the profile has none
      if (entrada?.telefono && !perfil.telefono && !perfil.whatsapp_negocio) {
        const tel = normalizarTelefono(entrada.telefono);
        if (tel) {
          upd.telefono = tel;
          upd.whatsapp_negocio = tel;
          telefonosSincronizados++;
        }
      }

      await sb.from("perfiles").update(upd).eq("id", perfil.id);
    }
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      ok: true,
      insertados: nuevos.length,
      actualizados: actualizaciones.length,
      sin_cambios: sinCambios,
      total_scrapeados: todosRegistros.length,
      paginas_procesadas: ultimaPagina,
      sincronizado_at: ahora,
      validacion_gfi: { validados, suspendidos, no_encontrados: noEncontrados, telefonos_sincronizados: telefonosSincronizados },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
