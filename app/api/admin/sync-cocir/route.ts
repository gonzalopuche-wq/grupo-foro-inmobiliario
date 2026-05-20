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

// Detecta columnas: primero busca thead, luego primer tr con th, luego primer tr con td
function detectarColumnas($: cheerio.CheerioAPI): string[] {
  const cols: string[] = [];

  // 1. thead th/td
  $("table thead tr").first().find("th, td").each((i, el) => {
    cols[i] = detectarCampo($(el).text()) ?? `_col${i}`;
  });
  if (cols.length > 0) return cols;

  // 2. primer tr con th (sin thead wrapper)
  $("table tr").each((_, tr) => {
    const ths = $(tr).find("th");
    if (ths.length >= 3) {
      ths.each((i, el) => { cols[i] = detectarCampo($(el).text()) ?? `_col${i}`; });
      return false; // break
    }
  });
  if (cols.length > 0) return cols;

  return cols; // vacío → usará fallback posicional
}

function parsearTabla(html: string, camposPorCol: string[]): Record<string, string | null>[] {
  const $ = cheerio.load(html);
  const usarFallback = camposPorCol.length === 0 || camposPorCol.every(c => c.startsWith("_"));
  const registros: Record<string, string | null>[] = [];

  // Encontrar la tabla con más filas de datos (td)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mejorTabla: any = null;
  let maxTds = 0;
  $("table").each((_, tabla) => {
    const cnt = $(tabla).find("td").length;
    if (cnt > maxTds) { maxTds = cnt; mejorTabla = tabla; }
  });

  const scope = mejorTabla ? $(mejorTabla).find("tr") : $("table tr");

  scope.each((_, el) => {
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

// Extrae el array JSON balanceado comenzando en startIdx
function extraerArrayBalanceado(src: string, startIdx: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < Math.min(src.length, startIdx + 1_000_000); i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === "\\" && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return null;
}

// Extrae columnas del array "columns" de DataTables (si existe)
function extraerColumnasDT(src: string): string[] | null {
  const idx = src.search(/"columns"\s*:\s*\[|\bcolumns\s*:\s*\[/);
  if (idx === -1) return null;
  const arrStart = src.indexOf("[", idx);
  if (arrStart === -1) return null;
  const raw = extraerArrayBalanceado(src, arrStart);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const cols: string[] = [];
    for (const col of arr) {
      const titulo = typeof col === "string" ? col : (col?.title ?? col?.data ?? col?.name ?? "");
      cols.push(detectarCampo(String(titulo)) ?? "_");
    }
    return cols;
  } catch {
    return null;
  }
}

// Busca datos en script tags (patrón DataTables inline)
function extraerDatosDeScript(html: string): { datos: unknown[]; columnas: string[] | null } | null {
  const $ = cheerio.load(html);

  for (const script of $("script").toArray()) {
    const src = $(script).html() ?? "";
    if (src.length < 200) continue;

    // Buscar "data": [ o data: [
    const idxData = src.search(/"data"\s*:\s*\[|\bdata\s*:\s*\[/);
    if (idxData === -1) continue;

    const arrStart = src.indexOf("[", idxData);
    if (arrStart === -1) continue;

    const raw = extraerArrayBalanceado(src, arrStart);
    if (!raw) continue;

    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length < 2) continue;

      const columnas = extraerColumnasDT(src);
      return { datos: arr, columnas };
    } catch {
      continue;
    }
  }

  return null;
}

// Normaliza un registro de script (array o object) a campos conocidos
function normalizarFilaDT(fila: unknown, columnas: string[] | null): Record<string, string | null> {
  if (Array.isArray(fila)) {
    const mapa = columnas ?? FALLBACK_ORDEN;
    const rec: Record<string, string | null> = {};
    fila.forEach((v, i) => {
      const campo = mapa[i];
      if (campo && !campo.startsWith("_") && campo !== "_") {
        rec[campo] = v != null ? String(v).trim() || null : null;
      }
    });
    return rec;
  }
  if (fila && typeof fila === "object") {
    const rec: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(fila as Record<string, unknown>)) {
      const campo = detectarCampo(k);
      if (campo) rec[campo] = v != null ? String(v).trim() || null : null;
    }
    return rec;
  }
  return {};
}

function parsearFilasDT(filas: unknown[]): Record<string, string | null>[] {
  return filas.map((fila) => {
    if (Array.isArray(fila)) {
      return {
        matricula: fila[0] != null ? String(fila[0]) : null,
        apellido:  fila[1] != null ? String(fila[1]) : null,
        nombre:    fila[2] != null ? String(fila[2]) : null,
        estado:    fila[3] != null ? String(fila[3]) : null,
        inmobiliaria: fila[4] != null ? String(fila[4]) : null,
        direccion: fila[5] != null ? String(fila[5]) : null,
        localidad: fila[6] != null ? String(fila[6]) : null,
        telefono:  fila[7] != null ? String(fila[7]) : null,
        email:     fila[8] != null ? String(fila[8]) : null,
      };
    }
    const r: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(fila as Record<string, unknown>)) {
      const campo = detectarCampo(k);
      if (campo) r[campo] = v ? String(v) : null;
    }
    return r;
  }).filter(r => r.matricula || r.apellido || r.nombre);
}

function detectarUltimaPagina($: cheerio.CheerioAPI): number {
  let maxPag = 1;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(/[?&/](?:page|pagina|p)=?(\d+)/i) ?? href.match(/matriculados[/?](\d+)/i);
    if (m) {
      const n = parseInt(m[1]);
      if (n > maxPag) maxPag = n;
    }
    const txt = $(el).text().trim();
    if (/^\d+$/.test(txt)) {
      const n = parseInt(txt);
      if (n > maxPag && n < MAX_PAGINAS) maxPag = n;
    }
  });
  const hayMas = $("a:contains('Siguiente'), a:contains('siguiente'), a[rel='next'], .pagination .next:not(.disabled)").length > 0;
  if (hayMas && maxPag === 1) maxPag = 2;
  return maxPag;
}

function urlPagina(n: number, patron: string): string {
  return patron.replace("{n}", String(n));
}

function normalizarTelefono(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  const d = digits.replace(/^\+/, "");
  if (d.startsWith("549") && d.length >= 12) return `+${d}`;
  if (d.startsWith("54") && d.length >= 11) return `+54 9 ${d.slice(2)}`;
  if (d.startsWith("0") && d.length >= 10) return `+54 9 ${d.slice(1)}`;
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

async function fetchDataTablesAjax(baseUrl: string, start: number, length: number): Promise<unknown[] | null> {
  const dtHeaders = {
    ...HEADERS,
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
  };
  const draw = Math.ceil(start / length) + 1;
  const qs = `draw=${draw}&start=${start}&length=${length}&search%5Bvalue%5D=&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=asc`;
  const intentos = [
    { url: `${baseUrl}?${qs}`, method: "GET" },
    { url: `${baseUrl}?draw=${draw}&start=${start}&length=${length}`, method: "GET" },
    { url: baseUrl, method: "POST", body: qs, ct: "application/x-www-form-urlencoded" },
  ];
  for (const intento of intentos) {
    try {
      const res = await fetch(intento.url, {
        method: intento.method,
        headers: { ...dtHeaders, ...(intento.ct ? { "Content-Type": intento.ct } : {}) },
        ...(intento.body ? { body: intento.body } : {}),
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json") && !ct.includes("javascript")) continue;
      const json = await res.json();
      if (Array.isArray(json?.data)) return json.data;
      if (Array.isArray(json)) return json;
    } catch { continue; }
  }
  return null;
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

async function guardarEnDB(
  todos: Record<string, string | null>[],
  matriculasVistas: Set<string>,
  metodo: string,
): Promise<NextResponse> {
  const ahora = new Date().toISOString();
  const { data: existentes } = await sb
    .from("cocir_padron")
    .select("id, matricula, estado, inmobiliaria, direccion, localidad, telefono, email, apellido, nombre");

  const mapa = new Map<string, Record<string, unknown>>();
  (existentes ?? []).forEach((r: Record<string, unknown>) => {
    if (r.matricula) mapa.set(String(r.matricula).trim(), r);
  });

  const nuevos: Record<string, unknown>[] = [];
  const actualizaciones: Record<string, unknown>[] = [];
  let sinCambios = 0;

  for (const reg of todos) {
    const mat = String(reg.matricula ?? "").trim();
    const existente = mat ? mapa.get(mat) : undefined;
    if (existente) {
      const upd: Record<string, unknown> = { actualizado_at: ahora };
      let hay = false;
      for (const campo of CAMPOS_CONOCIDOS) {
        const nv = reg[campo];
        if (!nv) continue;
        if (existente[campo] !== nv) { upd[campo] = nv; hay = true; }
      }
      if (hay) actualizaciones.push({ ...upd, id: existente.id });
      else sinCambios++;
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

  let eliminados = 0;
  if (matriculasVistas.size > 100) {
    const paraElim = (existentes ?? []).filter((r: Record<string, unknown>) => {
      const m = String(r.matricula ?? "").trim();
      return m && !matriculasVistas.has(m);
    });
    if (paraElim.length > 0) {
      const ids = paraElim.map((r: Record<string, unknown>) => r.id);
      for (let i = 0; i < ids.length; i += LOTE) {
        await sb.from("cocir_padron").delete().in("id", ids.slice(i, i + LOTE));
      }
      eliminados = paraElim.length;
    }
  }

  // Validar matrículas de perfiles GFI
  const { data: perfilesGfi } = await sb
    .from("perfiles")
    .select("id, matricula, telefono, whatsapp_negocio")
    .not("matricula", "is", null)
    .neq("matricula", "");

  const { data: padronActual } = await sb
    .from("cocir_padron")
    .select("matricula, estado, telefono, email");

  const padronMap = new Map<string, { estado: string; telefono: string | null; email: string | null }>();
  for (const p of padronActual ?? []) {
    if (p.matricula) {
      padronMap.set(String(p.matricula).trim(), {
        estado: p.estado ?? "activo",
        telefono: p.telefono ?? null,
        email: p.email ?? null,
      });
    }
  }

  let validados = 0, suspendidos = 0, noEncontrados = 0, telefonosSincronizados = 0;
  for (const perfil of perfilesGfi ?? []) {
    const mat = String(perfil.matricula ?? "").trim();
    if (!mat) continue;
    const entrada = padronMap.get(mat);
    let nuevoEstado: string;
    if (!entrada) { nuevoEstado = "no_encontrado"; noEncontrados++; }
    else if (/suspendid|inhabilitad|baja/i.test(entrada.estado)) { nuevoEstado = "suspendido"; suspendidos++; }
    else { nuevoEstado = "activo"; validados++; }

    const upd: Record<string, unknown> = { cocir_estado: nuevoEstado, cocir_ultimo_control: ahora };
    if (entrada?.telefono && !perfil.telefono && !perfil.whatsapp_negocio) {
      const tel = normalizarTelefono(entrada.telefono);
      if (tel) { upd.telefono = tel; upd.whatsapp_negocio = tel; telefonosSincronizados++; }
    }
    await sb.from("perfiles").update(upd).eq("id", perfil.id);
  }

  return NextResponse.json({
    ok: true,
    metodo,
    insertados: nuevos.length,
    actualizados: actualizaciones.length,
    eliminados,
    sin_cambios: sinCambios,
    total_scrapeados: todos.length,
    sincronizado_at: ahora,
    validacion_gfi: { validados, suspendidos, no_encontrados: noEncontrados, telefonos_sincronizados: telefonosSincronizados },
  });
}

export async function GET(req: NextRequest) {
  if (!(await authorizado(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    // ── 1. Obtener HTML de la primera página ──
    let html1: string | null = null;
    let urlActiva = BASE_URL_ALTERNATIVAS[0];
    for (const url of BASE_URL_ALTERNATIVAS) {
      html1 = await fetchPagina(url);
      if (html1 && html1.length > 500) { urlActiva = url; break; }
    }
    if (!html1) return NextResponse.json({ ok: false, error: "No se pudo acceder a cocir.org.ar" });

    const htmlLow = html1.toLowerCase();
    if (htmlLow.includes("checking your browser") || htmlLow.includes("cloudflare") || htmlLow.includes("just a moment") || htmlLow.includes("captcha")) {
      return NextResponse.json({
        ok: false,
        error: "cocir.org.ar está bloqueando el acceso automático (Cloudflare/captcha). El padrón existente no fue modificado.",
        debug: { urlActiva, htmlLen: html1.length, htmlInicio: html1.slice(0, 600) },
      });
    }

    const $1 = cheerio.load(html1);
    const camposPorCol = detectarColumnas($1);

    // ── 2. Intentar parsear tabla HTML ──
    const registrosPag1 = parsearTabla(html1, camposPorCol);

    if (registrosPag1.length > 0) {
      // Éxito con tabla HTML → paginar
      let patronPaginacion = `${urlActiva}?page={n}`;
      const linkEjemplo = $1("a[href]").filter((_, el) => {
        const h = $1(el).attr("href") ?? "";
        return /[?&](?:page|pagina)=\d+/i.test(h) || /matriculados[/?]\d+/.test(h);
      }).first().attr("href") ?? "";
      if (linkEjemplo) {
        const m = linkEjemplo.match(/([?&])(?:page|pagina|p)=\d+/i);
        if (m) {
          const sep = m[1];
          const key = m[0].replace(m[1], "").replace(/=\d+$/, "");
          patronPaginacion = `${urlActiva}${sep}${key}={n}`;
        } else if (/matriculados\/\d+/.test(linkEjemplo)) {
          patronPaginacion = `${urlActiva}/{n}`;
        }
      }

      const todosRegistros = [...registrosPag1];
      const matriculasVistas = new Set<string>(registrosPag1.map(r => String(r.matricula ?? "").trim()).filter(Boolean));
      const MAX_VACIOS = 3;
      let vacios = 0;
      let siguiente = 2;
      const patronesAlt = [
        patronPaginacion,
        `${urlActiva}/{n}`,
        `${urlActiva}?page={n}`,
        `${urlActiva}?pagina={n}`,
      ].filter((v, i, a) => a.indexOf(v) === i);
      let patronActivo = patronPaginacion;
      let verificado = false;

      while (siguiente <= MAX_PAGINAS && vacios < MAX_VACIOS) {
        const lote = Array.from({ length: BATCH_PARALELO }, (_, i) => siguiente + i).filter(n => n <= MAX_PAGINAS);
        siguiente += BATCH_PARALELO;
        const htmls = await Promise.all(lote.map(n => fetchPagina(urlPagina(n, patronActivo))));
        let nuevosEnLote = 0;
        for (const html of htmls) {
          if (!html) continue;
          for (const r of parsearTabla(html, camposPorCol)) {
            const mat = String(r.matricula ?? "").trim();
            if (mat && matriculasVistas.has(mat)) continue;
            if (mat) matriculasVistas.add(mat);
            todosRegistros.push(r);
            nuevosEnLote++;
          }
        }
        if (!verificado && nuevosEnLote === 0) {
          let encontrado = false;
          for (const pat of patronesAlt) {
            if (pat === patronActivo) continue;
            const h2 = await fetchPagina(urlPagina(2, pat));
            if (!h2) continue;
            const regsAlt = parsearTabla(h2, camposPorCol);
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
          if (!encontrado) vacios++;
          else vacios = 0;
          verificado = true;
          continue;
        }
        verificado = true;
        if (nuevosEnLote === 0) vacios++;
        else vacios = 0;
      }
      return guardarEnDB(todosRegistros, matriculasVistas, "html-table");
    }

    // ── 3. Intentar datos embebidos en <script> (DataTables inline) ──
    const scriptResult = extraerDatosDeScript(html1);
    if (scriptResult && scriptResult.datos.length >= 2) {
      const { datos, columnas } = scriptResult;
      const todos = datos
        .map(f => normalizarFilaDT(f, columnas))
        .filter(r => r.matricula || r.apellido || r.nombre);

      if (todos.length > 0) {
        const matsVistas = new Set<string>(todos.map(r => String(r.matricula ?? "").trim()).filter(Boolean));
        return guardarEnDB(todos, matsVistas, "script-json");
      }
    }

    // ── 4. Intentar DataTables AJAX ──
    const dtPage0 = await fetchDataTablesAjax(urlActiva, 0, 100);
    if (dtPage0 && dtPage0.length > 0) {
      const dtTodos = [...parsearFilasDT(dtPage0)];
      const dtVistas = new Set<string>(dtTodos.map(r => String(r.matricula ?? "").trim()).filter(Boolean));
      let dtStart = 100;
      let dtVacios = 0;
      while (dtStart < 10000 && dtVacios < 3) {
        const chunk = await fetchDataTablesAjax(urlActiva, dtStart, 100);
        if (!chunk || chunk.length === 0) { dtVacios++; break; }
        let nuevos = 0;
        for (const r of parsearFilasDT(chunk)) {
          const mat = String(r.matricula ?? "").trim();
          if (mat && dtVistas.has(mat)) continue;
          if (mat) dtVistas.add(mat);
          dtTodos.push(r);
          nuevos++;
        }
        if (nuevos === 0) dtVacios++;
        else dtVacios = 0;
        dtStart += 100;
      }
      return guardarEnDB(dtTodos, dtVistas, "datatables-ajax");
    }

    // ── 5. Sin datos: devolver diagnóstico detallado ──
    const filasTd = $1("table tr").filter((_, el) => $1(el).find("td").length >= 2).length;
    const primeraFila: string[] = [];
    $1("table tr").first().find("td,th").each((_, el) => { primeraFila.push($1(el).text().trim()); });
    const tablaInfo = {
      tables: $1("table").length,
      trs: $1("table tr").length,
      tds: $1("table td").length,
      ths: $1("table th").length,
      theads: $1("table thead").length,
      filasTd,
      columnasMapeadas: camposPorCol,
      primeraFila,
    };
    return NextResponse.json({
      ok: false,
      error: "No se encontraron registros (ni en tabla HTML, ni en scripts, ni en DataTables AJAX)",
      debug: {
        urlActiva,
        htmlLen: html1.length,
        tablaInfo,
        tieneScriptConData: /"data"\s*:\s*\[/.test(html1) || /\bdata\s*:\s*\[/.test(html1),
        htmlInicio: html1.slice(0, 1200),
        htmlBody: html1.slice(html1.indexOf("<body") > -1 ? html1.indexOf("<body") : 1500, html1.indexOf("<body") > -1 ? html1.indexOf("<body") + 3000 : 4500),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

