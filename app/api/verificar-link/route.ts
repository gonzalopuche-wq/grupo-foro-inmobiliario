import { NextRequest, NextResponse } from "next/server";

const PRIVATE_IP = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1$|fc|fd)/i;

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (PRIVATE_IP.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ ok: false, mensaje: "URL requerida" }, { status: 400 });
  if (!isSafeUrl(url)) return NextResponse.json({ ok: false, mensaje: "URL no permitida" }, { status: 400 });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "GFI-LinkChecker/1.0" },
    });

    clearTimeout(timer);

    const ok = res.status >= 200 && res.status < 400;
    return NextResponse.json({ ok, codigo: res.status, mensaje: ok ? "OK" : `HTTP ${res.status}` });

  } catch (e: any) {
    if (e.name === "AbortError") {
      return NextResponse.json({ ok: false, codigo: null, mensaje: "Timeout" });
    }
    // Si HEAD falla, intentar con GET
    try {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 7000);
      const res2 = await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        redirect: "follow",
        headers: { "User-Agent": "GFI-LinkChecker/1.0" },
      });
      clearTimeout(timer2);
      const ok = res2.status >= 200 && res2.status < 400;
      return NextResponse.json({ ok, codigo: res2.status, mensaje: ok ? "OK" : `HTTP ${res2.status}` });
    } catch (e2: any) {
      return NextResponse.json({ ok: false, codigo: null, mensaje: e2.message ?? "Error de conexión" });
    }
  }
}
