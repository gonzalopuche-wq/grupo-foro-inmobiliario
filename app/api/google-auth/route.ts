// GET /api/google-auth?perfil_id=... → redirige a Google OAuth para Calendar
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(req: NextRequest) {
  const perfil_id = req.nextUrl.searchParams.get("perfil_id");
  if (!perfil_id) return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({
      error: "GOOGLE_CLIENT_ID no configurado. Creá un proyecto en console.cloud.google.com, habilitá la API de Google Calendar y agregá las credenciales OAuth en las variables de entorno de Vercel.",
    }, { status: 501 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/google-auth/callback`;

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", perfil_id);

  return NextResponse.redirect(url.toString());
}
