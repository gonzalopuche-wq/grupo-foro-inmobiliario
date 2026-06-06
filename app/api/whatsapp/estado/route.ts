// Estado de la integración WhatsApp Cloud API (Meta) — solo admin.
// Reporta qué variables de entorno están configuradas (sin exponer secretos)
// y devuelve la URL de callback del webhook para pegar en Meta.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(authToken);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin" && perfil?.tipo !== "master") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const phoneId = !!process.env.WHATSAPP_PHONE_ID;
  const accessToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
  const appSecret = !!process.env.WHATSAPP_APP_SECRET;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";
  const webhookUrl = `${siteUrl.replace(/\/$/, "")}/api/whatsapp/webhook`;

  const conectado = phoneId && accessToken;

  return NextResponse.json({
    ok: true,
    conectado,
    env: {
      phone_id: phoneId,
      access_token: accessToken,
      app_secret: appSecret,
      verify_token: !!verifyToken,
    },
    verify_token: verifyToken, // se muestra a admin para pegar en Meta
    webhook_url: webhookUrl,
  });
}
