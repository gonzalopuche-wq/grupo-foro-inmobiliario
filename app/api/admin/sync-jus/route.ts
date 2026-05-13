import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 30;

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

function extraerJus(html: string): number | null {
  const texto = html.toLowerCase();

  // Buscar "jus" como palabra (delimitada por espacios, guiones, símbolos)
  const posJusWord: number[] = [];
  const reWord = /[\s\-_>]jus[\s\-_<,:.()/]/g;
  let mw;
  while ((mw = reWord.exec(texto)) !== null) {
    posJusWord.push(mw.index + 1);
  }
  // Fallback: cualquier "jus" si no encontramos como palabra
  const posiciones = posJusWord.length > 0 ? posJusWord : (() => {
    const pos: number[] = [];
    let p = 0;
    while ((p = texto.indexOf("jus", p)) !== -1) { pos.push(p); p += 3; }
    return pos;
  })();
  if (posiciones.length === 0) return null;

  // Paso 1: solo valores con signo $ (formato monetario — excluye números de leyes, años, etc.)
  const patronesDinero = [
    /\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/g,   // $ 12.345,67
    /\$\s*([\d]{1,3}(?:\.\d{3})+)/g,           // $ 12.345
    /\$\s*(\d{4,7})/g,                          // $ 12345 (mín 4 dígitos para evitar artículos)
  ];

  let mejor: number | null = null;
  let menorDistancia = Infinity;

  for (const posJus of posiciones) {
    const inicio = Math.max(0, posJus - 800);
    const ventana = html.slice(inicio, posJus + 1500);
    const offset = posJus - inicio;

    for (const pat of patronesDinero) {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(ventana)) !== null) {
        const raw = m[1].replace(/\./g, "").replace(",", ".");
        const val = parseFloat(raw);
        if (!isNaN(val) && val >= 1_000 && val <= 500_000) {
          const dist = Math.abs(m.index - offset);
          if (dist < menorDistancia) {
            menorDistancia = dist;
            mejor = val;
          }
        }
      }
    }
  }

  if (mejor !== null) return mejor;

  // Paso 2 (fallback): formatos numéricos con coma decimal AR pero sin $
  const patronesFallback = [
    /([\d]{1,3}(?:\.\d{3})*,\d{2})/g,
    /([\d]{1,3}\.\d{3})/g,
  ];

  menorDistancia = Infinity;
  for (const posJus of posiciones) {
    const inicio = Math.max(0, posJus - 500);
    const ventana = html.slice(inicio, posJus + 1000);
    const offset = posJus - inicio;
    for (const pat of patronesFallback) {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(ventana)) !== null) {
        const raw = m[1].replace(/\./g, "").replace(",", ".");
        const val = parseFloat(raw);
        if (!isNaN(val) && val >= 1_000 && val <= 500_000) {
          const dist = Math.abs(m.index - offset);
          if (dist < menorDistancia) { menorDistancia = dist; mejor = val; }
        }
      }
    }
  }
  return mejor;
}

export async function GET(req: NextRequest) {
  if (!(await authorizado(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const URL_FALLBACK = "https://www.justiciasantafe.gov.ar/index.php/unidad_jus/unidad-jus-ley-12851/";

  let url = URL_FALLBACK;
  try {
    const { data: conf } = await sb
      .from("configuracion_sitio")
      .select("valor")
      .eq("clave", "jus_url_cocir")
      .maybeSingle();
    if (conf?.valor?.trim()) url = conf.valor.trim();
  } catch { /* tabla aún no existe, usar fallback */ }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GrupoForoInmobiliario/1.0 (sync-jus)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `La página respondió HTTP ${res.status}` });
    }
    html = await res.text();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `No se pudo acceder a la URL: ${e?.message ?? e}` });
  }

  const valor = extraerJus(html);
  if (!valor) {
    return NextResponse.json({
      ok: false,
      error: "No se encontró el valor del JUS en la página. Verificá que la URL sea correcta.",
    });
  }

  const { error } = await sb.from("indicadores").upsert(
    { clave: "valor_jus", valor, descripcion: "Valor JUS", actualizado_at: new Date().toISOString() },
    { onConflict: "clave" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true, valor });
}
