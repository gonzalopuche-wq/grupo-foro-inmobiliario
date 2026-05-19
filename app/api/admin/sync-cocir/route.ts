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
const BASE_URL_ALTERNATIVAS = [
  "https://cocir.org.ar/paginas/matriculados",
  "https://www.cocir.org.ar/paginas/matriculados",
  "https://cocir.org.ar/matriculados",
  "https://www.cocir.org.ar/matriculados",
];
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
  // Usar fallback si no hay columnas detectadas O si TODAS son desconocidas (_col*)
  const usarFallback = camposPorCol.length === 0 || camposPorCol.every(c => c.startsWith("_"));
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

// Intenta obtener datos via DataTables AJAX (común en sitios institucionales argentinos)
async function fetchDataTables(baseUrl: string, start: number, length: number): Promise<any[] | null> {
  const dtHeaders = {
    ...HEADERS,
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
  };
  const candidatos = [
    `${baseUrl}?draw=${Math.ceil(start/length)+1}&start=${start}&length=${length}&search%5Bvalue%5D=&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=asc`,
    `${baseUrl}?draw=1&start=${start}&length=${length}`,
  ];
  for (const url of candidatos) {
    try {
      const res = await fetch(url, { headers: dtHeaders });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json") && !ct.includes("javascript")) continue;
      const json = await res.json();
      // DataTables response: { data: [...] }
      if (Array.isArray(json?.data)) return json.data;
      // Simple array
      if (Array.isArray(json)) return json;
    } catch { continue; }
  }
  return null;
}

function parsearFilasDT(filas: any[]): any[] {
  return filas.map((fila: any) => {
    if (Array.isArray(fila)) {
      // Columnas posicionales: [matricula, apellido, nombre, estado, ...]
      return {
        matricula: fila[0] ?? null,
        apellido: fila[1] ?? null,
        nombre: fila[2] ?? null,
        estado: fila[3] ?? null,
        inmobiliaria: fila[4] ?? null,
        direccion: fila[5] ?? null,
        localidad: fila[6] ?? null,
        telefono: fila[7] ?? null,
        email: fila[8] ?? null,
      };
    }
    // Object con claves como "matricula", "Matrícula", "MATRICULA", etc.
    const r: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(fila)) {
      const campo = detectarCampo(k);
      if (campo) r[campo] = v ? String(v) : null;
    }
    return r;
  }).filter((r: any) => r.matricula || r.apellido || r.nombre);
}

async function authorizado(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const token = auth?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", data.user.id).single();
  return p?.tipo === "admin";
}

export async function GET(req: NextRequest) {
  if (!(await authorizado(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    // --- Fetch page 1: probar URLs alternativas ---
    let html1: string | null = null;
    let urlActiva = BASE_URL;
    for (const url of BASE_URL_ALTERNATIVAS) {
      html1 = await fetchPagina(url);
      if (html1 && html1.length > 500) { urlActiva = url; break; }
    }
    if (!html1) return NextResponse.json({ ok: false, error: "No se pudo acceder a cocir.org.ar" });

    // Detectar bloqueo Cloudflare o captcha
    const htmlLow = html1.toLowerCase();
    if (htmlLow.includes("checking your browser") || htmlLow.includes("cloudflare") || htmlLow.includes("just a moment") || htmlLow.includes("captcha")) {
      return NextResponse.json({
        ok: false,
        error: "cocir.org.ar está bloqueando el acceso automático (Cloudflare/captcha). El padrón existente en la base de datos no fue modificado.",
        debug: { urlActiva, htmlLen: html1.length, htmlInicio: html1.slice(0, 600) },
      });
    }

    const $1 = cheerio.load(html1);

    // Detect columns from thead
    const camposPorCol: string[] = [];
    $1("table thead tr th, table thead tr td").each((i, el) => {
      camposPorCol[i] = detectarCampo($1(el).text()) ?? `_col${i}`;
    });

    const registrosPag1 = parsearTabla(html1, camposPorCol);

    if (registrosPag1.length === 0) {
      // Intentar DataTables AJAX antes de fallar
      const dtPage0 = await fetchDataTables(urlActiva, 0, 100);
      if (dtPage0 && dtPage0.length > 0) {
        // Scrapear via DataTables: paginar hasta vacío
        const dtTodos = [...parsearFilasDT(dtPage0)];
        const dtVistas = new Set<string>(dtTodos.map((r: any) => String(r.matricula ?? "").trim()).filter(Boolean));
        let dtStart = 100;
        const DT_LOTE = 100;
        let dtVacios = 0;
        while (dtStart < 10000 && dtVacios < 3) {
          const chunk = await fetchDataTables(urlActiva, dtStart, DT_LOTE);
          if (!chunk || chunk.length === 0) { dtVacios++; break; }
          let nuevos = 0;
          for (const r of parsearFilasDT(chunk)) {
            const mat = String((r as any).matricula ?? "").trim();
            if (mat && dtVistas.has(mat)) continue;
            if (mat) dtVistas.add(mat);
            dtTodos.push(r);
            nuevos++;
          }
          if (nuevos === 0) dtVacios++;
          else dtVacios = 0;
          dtStart += DT_LOTE;
        }
        // Reemplazar registrosPag1 y continuar flujo normal con dtTodos
        const ahora2 = new Date().toISOString();
        const { data: existentes2 } = await sb.from("cocir_padron").select("id, matricula, estado, inmobiliaria, direccion, localidad, telefono, email, apellido, nombre");
        const mapa2 = new Map<string, any>();
        (existentes2 ?? []).forEach((r: any) => { if (r.matricula) mapa2.set(String(r.matricula).trim(), r); });
        const nuevosR: any[] = [];
        const actualizacionesR: any[] = [];
        let sinCambiosR = 0;
        for (const reg of dtTodos) {
          const mat = String((reg as any).matricula ?? "").trim();
          const existente = mat ? mapa2.get(mat) : undefined;
          if (existente) {
            const upd: any = { actualizado_at: ahora2 };
            let hay = false;
            for (const campo of CAMPOS_CONOCIDOS) {
              const nv = (reg as any)[campo];
              if (!nv) continue;
              if (existente[campo] !== nv) { upd[campo] = nv; hay = true; }
            }
            if (hay) actualizacionesR.push({ ...upd, id: existente.id });
            else sinCambiosR++;
          } else {
            nuevosR.push({ ...reg, actualizado_at: ahora2 });
          }
        }
        const LOTE2 = 500;
        for (let i = 0; i < nuevosR.length; i += LOTE2) {
          await sb.from("cocir_padron").insert(nuevosR.slice(i, i + LOTE2));
        }
        for (let i = 0; i < actualizacionesR.length; i += LOTE2) {
          await sb.from("cocir_padron").upsert(actualizacionesR.slice(i, i + LOTE2));
        }
        let eliminadosR = 0;
        if (dtVistas.size > 500) {
          const paraElimR = (existentes2 ?? []).filter((r: any) => { const m = String(r.matricula ?? "").trim(); return m && !dtVistas.has(m); });
          const idsR = paraElimR.map((r: any) => r.id);
          for (let i = 0; i < idsR.length; i += LOTE2) { await sb.from("cocir_padron").delete().in("id", idsR.slice(i, i + LOTE2)); }
          eliminadosR = paraElimR.length;
        }
        return NextResponse.json({ ok: true, metodo: "datatables", insertados: nuevosR.length, actualizados: actualizacionesR.length, eliminados: eliminadosR, sin_cambios: sinCambiosR, total_scrapeados: dtTodos.length, sincronizado_at: ahora2 });
      }

      // Sin datos ni por HTML ni por DataTables → devolver debug
      const filasTd = $1("table tr").filter((_, el) => $1(el).find("td").length >= 2).length;
      const primeraFila: string[] = [];
      $1("table tr").first().find("td,th").each((_, el) => { primeraFila.push($1(el).text().trim()); });
      return NextResponse.json({
        ok: false,
        error: "No se encontraron registros en la primera página",
        debug: {
          urlActiva,
          htmlLen: html1.length,
          tables: $1("table").length,
          thead: $1("table thead").length,
          filasTd,
          columnasMapeadas: camposPorCol,
          primeraFila,
          htmlInicio: html1.slice(0, 800),
        },
      });
    }

    // --- Detect pagination ---
    const ultimaPagina = detectarUltimaPagina($1);

    // Detect URL pattern for pagination
    let patronPaginacion = `${urlActiva}?page={n}`;
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
        patronPaginacion = `${urlActiva}${sep}${key}={n}`;
      } else if (/matriculados\/\d+/.test(linkPaginaEjemplo)) {
        patronPaginacion = `${urlActiva}/{n}`;
      }
    }

    // --- Fetch remaining pages in parallel batches ---
    // Continúa aunque detectarUltimaPagina devuelva 1: se detiene solo cuando
    // hay MAX_CONSECUTIVOS_VACIOS lotes consecutivos sin registros nuevos.
    const todosRegistros = [...registrosPag1];
    const matriculasVistas = new Set<string>(registrosPag1.map(r => String(r.matricula ?? "").trim()).filter(Boolean));

    const MAX_CONSECUTIVOS_VACIOS = 3;
    let consecutivosVacios = 0;
    let siguiente = 2;

    // También intentar patrón de ruta si el detectado falla en el primer lote
    const patronesAlternativos = [
      patronPaginacion,
      `${urlActiva}/{n}`,
      `${urlActiva}?page={n}`,
      `${urlActiva}?pagina={n}`,
    ].filter((v, i, a) => a.indexOf(v) === i); // unique

    let patronActivo = patronPaginacion;
    let patronVerificado = false;

    while (siguiente <= MAX_PAGINAS && consecutivosVacios < MAX_CONSECUTIVOS_VACIOS) {
      const lote = Array.from({ length: BATCH_PARALELO }, (_, i) => siguiente + i)
        .filter(n => n <= MAX_PAGINAS);
      siguiente += BATCH_PARALELO;

      const htmls = await Promise.all(lote.map(n => fetchPagina(urlPagina(n, patronActivo))));
      let nuevosEnLote = 0;

      for (const html of htmls) {
        if (!html) continue;
        const regs = parsearTabla(html, camposPorCol);
        for (const r of regs) {
          const mat = String(r.matricula ?? "").trim();
          if (mat && matriculasVistas.has(mat)) continue;
          if (mat) matriculasVistas.add(mat);
          todosRegistros.push(r);
          nuevosEnLote++;
        }
      }

      // Si el primer lote no dio datos, probar patrones alternativos
      if (!patronVerificado && nuevosEnLote === 0) {
        let encontrado = false;
        for (const pat of patronesAlternativos) {
          if (pat === patronActivo) continue;
          const htmlAlt = await fetchPagina(urlPagina(2, pat));
          if (!htmlAlt) continue;
          const regsAlt = parsearTabla(htmlAlt, camposPorCol);
          if (regsAlt.length > 0) {
            patronActivo = pat;
            for (const r of regsAlt) {
              const mat = String(r.matricula ?? "").trim();
              if (mat && matriculasVistas.has(mat)) continue;
              if (mat) matriculasVistas.add(mat);
              todosRegistros.push(r);
              nuevosEnLote++;
            }
            encontrado = true;
            break;
          }
        }
        if (!encontrado) consecutivosVacios++;
        else consecutivosVacios = 0;
        patronVerificado = true;
        continue;
      }

      patronVerificado = true;
      if (nuevosEnLote === 0) consecutivosVacios++;
      else consecutivosVacios = 0;
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

    // ── Limpiar registros que ya no están en COCIR ──
    let eliminados = 0;
    if (matriculasVistas.size > 500) {
      const paraEliminar = (existentes ?? []).filter((r: any) => {
        const mat = String(r.matricula ?? "").trim();
        return mat && !matriculasVistas.has(mat);
      });
      if (paraEliminar.length > 0) {
        const idsEliminar = paraEliminar.map((r: any) => r.id);
        for (let i = 0; i < idsEliminar.length; i += LOTE) {
          const { error } = await sb.from("cocir_padron").delete().in("id", idsEliminar.slice(i, i + LOTE));
          if (error) return NextResponse.json({ ok: false, error: error.message });
        }
        eliminados = paraEliminar.length;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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
      eliminados,
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
