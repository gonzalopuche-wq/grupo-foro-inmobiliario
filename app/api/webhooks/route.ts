import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHmac } from "crypto";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return null;
  const { data: { user } } = await sb.auth.getUser(jwt);
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [hooks, logs] = await Promise.all([
    sb.from("gfi_webhooks").select("id,nombre,url,eventos,activo,ultimo_envio,created_at").eq("perfil_id", user.id).order("created_at", { ascending: false }),
    sb.from("gfi_webhooks_log").select("id,webhook_id,evento,status_code,ok,duracion_ms,created_at").eq("perfil_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({ hooks: hooks.data ?? [], logs: logs.data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { accion } = body;

  if (accion === "crear") {
    const { nombre, url, eventos } = body as { nombre: string; url: string; eventos: string[] };
    if (!nombre?.trim() || !url?.trim() || !eventos?.length) {
      return NextResponse.json({ error: "Nombre, URL y al menos un evento son requeridos" }, { status: 400 });
    }
    const secret = randomBytes(32).toString("hex");
    const { data, error } = await sb.from("gfi_webhooks").insert({
      perfil_id: user.id,
      nombre: nombre.trim(),
      url: url.trim(),
      secret,
      eventos,
      activo: true,
    }).select("id,secret").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, secret });
  }

  if (accion === "actualizar") {
    const { id, nombre, url, eventos, activo } = body as { id: string; nombre?: string; url?: string; eventos?: string[]; activo?: boolean };
    const update: Record<string, unknown> = {};
    if (nombre !== undefined) update.nombre = nombre.trim();
    if (url !== undefined) update.url = url.trim();
    if (eventos !== undefined) update.eventos = eventos;
    if (activo !== undefined) update.activo = activo;
    const { error } = await sb.from("gfi_webhooks").update(update).eq("id", id).eq("perfil_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (accion === "eliminar") {
    const { id } = body as { id: string };
    const { error } = await sb.from("gfi_webhooks").delete().eq("id", id).eq("perfil_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (accion === "test") {
    const { id } = body as { id: string };
    const { data: hook } = await sb.from("gfi_webhooks").select("url,secret").eq("id", id).eq("perfil_id", user.id).single();
    if (!hook) return NextResponse.json({ error: "Webhook no encontrado" }, { status: 404 });

    const payload = JSON.stringify({ event: "test", data: { message: "Webhook de prueba desde GFI®" }, timestamp: new Date().toISOString() });
    const sig = createHmac("sha256", hook.secret).update(payload).digest("hex");
    let ok = false;
    let status = 0;
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-GFI-Signature": `sha256=${sig}`, "X-GFI-Event": "test" },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });
      ok = res.ok;
      status = res.status;
    } catch {
      ok = false;
    }
    await sb.from("gfi_webhooks_log").insert({ webhook_id: id, perfil_id: user.id, evento: "test", status_code: status || null, ok, duracion_ms: 0 });
    return NextResponse.json({ ok, status });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
