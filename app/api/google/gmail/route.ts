// GET  ?contact_email=foo@bar.com  → lista hasta 10 threads de Gmail con ese email
// POST { to, subject, body, contact_id? } → envía email via Gmail API
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGoogleToken } from "../../../lib/google-token";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb.auth.getUser(token);
  return user ?? null;
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const contactEmail = req.nextUrl.searchParams.get("contact_email");
  if (!contactEmail) return NextResponse.json({ error: "contact_email requerido" }, { status: 400 });

  const accessToken = await getGoogleToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 403 });
  }

  const query = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${query}&maxResults=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    return NextResponse.json({ error: "gmail_list_failed", detail: err }, { status: 502 });
  }

  const listJson = await listRes.json();
  const rawThreads: { id: string }[] = listJson.threads ?? [];

  // Fetch snippet + metadata for each thread
  const threads = await Promise.all(
    rawThreads.map(async (t) => {
      const tRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!tRes.ok) return { id: t.id, snippet: "", date: "", subject: "" };
      const tJson = await tRes.json();
      const firstMsg = tJson.messages?.[0];
      const headers: { name: string; value: string }[] = firstMsg?.payload?.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "(sin asunto)";
      const date = headers.find(h => h.name === "Date")?.value ?? "";
      return { id: t.id, snippet: tJson.snippet ?? "", date, subject };
    })
  );

  return NextResponse.json({ threads });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { to, subject, body } = await req.json();
  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject y body son requeridos" }, { status: 400 });
  }

  const accessToken = await getGoogleToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 403 });
  }

  // Construir el mensaje RFC 2822
  const raw = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body).toString("base64"),
  ].join("\r\n");

  // base64url encoding
  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    }
  );

  if (!sendRes.ok) {
    const err = await sendRes.json().catch(() => ({}));
    return NextResponse.json({ error: "gmail_send_failed", detail: err }, { status: 502 });
  }

  const sendJson = await sendRes.json();
  return NextResponse.json({ ok: true, messageId: sendJson.id });
}
