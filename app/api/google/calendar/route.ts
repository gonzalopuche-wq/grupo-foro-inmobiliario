// GET  ?days=7 → lista eventos de Calendar de los próximos N días
// POST { summary, description, start, end, attendees?, location? } → crea evento
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

  const accessToken = await getGoogleToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 403 });
  }

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10);
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: "calendar_list_failed", detail: err }, { status: 502 });
  }

  const json = await res.json();
  const items: Record<string, unknown>[] = json.items ?? [];

  const events = items.map((ev) => ({
    id: ev.id as string,
    summary: ev.summary as string ?? "(sin título)",
    start: ev.start as { dateTime?: string; date?: string },
    end: ev.end as { dateTime?: string; date?: string },
    description: (ev.description as string | undefined) ?? "",
    htmlLink: (ev.htmlLink as string | undefined) ?? "",
    location: (ev.location as string | undefined) ?? "",
  }));

  return NextResponse.json({ events });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const accessToken = await getGoogleToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 403 });
  }

  const { summary, description, start, end, attendees, location } = await req.json();
  if (!summary || !start || !end) {
    return NextResponse.json({ error: "summary, start y end son requeridos" }, { status: 400 });
  }

  const eventBody: Record<string, unknown> = {
    summary,
    description: description ?? "",
    start: typeof start === "string" ? { dateTime: start } : start,
    end: typeof end === "string" ? { dateTime: end } : end,
  };
  if (location) eventBody.location = location;
  if (Array.isArray(attendees) && attendees.length > 0) {
    eventBody.attendees = attendees.map((a: string | { email: string }) =>
      typeof a === "string" ? { email: a } : a
    );
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: "calendar_create_failed", detail: err }, { status: 502 });
  }

  const json = await res.json();
  return NextResponse.json({ ok: true, eventId: json.id, htmlLink: json.htmlLink });
}
