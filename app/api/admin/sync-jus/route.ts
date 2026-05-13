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
  const posJus = texto.indexOf("jus");
  if (posJus === -1) return null;

  // Buscar valores monetarios en los 2000 chars alrededor del texto "jus"
  const ventana = html.slice(Math.max(0, posJus - 800), posJus + 1200);
  const patrones = [
    /\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/g,  // $ 12.345,67
    /\$\s*([\d]{1,3}(?:\.\d{3})+)/g,          // $ 12.345
    /\$\s*(\d{4,6})/g,                         // $ 12345
  ];

  let mejor: number | null = null;
  let menorDistancia = Infinity;

  for (const pat of patrones) {
    let m;
    while ((m = pat.exec(ventana)) !== null) {
      const raw = m[1].replace(/\./g, "").replace(",", ".");
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 500 && val <= 1_000_000) {
        const dist = Math.abs(m.index - 800);
        if (dist < menorDistancia) {
          menorDistancia = dist;
          mejor = val;
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

  const { data: conf } = await sb
    .from("configuracion_sitio")
    .select("valor")
    .eq("clave", "jus_url_cocir")
    .maybeSingle();

  const url = conf?.valor?.trim();
  if (!url) {
    return NextResponse.json({
      ok: false,
      error: "URL del JUS no configurada. Ingresá la URL de COCIR en Configuración del Sitio → JUS.",
    });
  }

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
    { clave: "valor_jus", valor, descripcion: "Valor JUS COCIR 2da Circ.", actualizado_at: new Date().toISOString() },
    { onConflict: "clave" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true, valor });
}
