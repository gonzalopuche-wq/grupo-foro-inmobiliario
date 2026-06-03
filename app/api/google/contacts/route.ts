// GET  ?pageToken=&pageSize=50 → lista contactos de Google People API
// POST { contacts: [{displayName, email, phone, company}] } → importa a crm_contactos
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

  const pageToken = req.nextUrl.searchParams.get("pageToken") ?? "";
  const pageSize = req.nextUrl.searchParams.get("pageSize") ?? "50";

  const params = new URLSearchParams({
    personFields: "names,emailAddresses,phoneNumbers,organizations",
    pageSize,
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(
    `https://people.googleapis.com/v1/people/me/connections?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: "people_list_failed", detail: err }, { status: 502 });
  }

  const json = await res.json();
  const connections: Record<string, unknown>[] = json.connections ?? [];

  const contacts = connections.map((c) => {
    const names = c.names as { displayName?: string }[] | undefined;
    const emails = c.emailAddresses as { value?: string }[] | undefined;
    const phones = c.phoneNumbers as { value?: string }[] | undefined;
    const orgs = c.organizations as { name?: string }[] | undefined;
    return {
      resourceName: c.resourceName as string,
      displayName: names?.[0]?.displayName ?? "",
      email: emails?.[0]?.value ?? "",
      phone: phones?.[0]?.value ?? "",
      company: orgs?.[0]?.name ?? "",
    };
  });

  return NextResponse.json({ contacts, nextPageToken: json.nextPageToken ?? null });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { contacts } = await req.json() as {
    contacts: { displayName: string; email: string; phone?: string; company?: string }[];
  };

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: "contacts[] requerido" }, { status: 400 });
  }

  let importados = 0;
  let duplicados = 0;

  for (const c of contacts) {
    const nombre = c.displayName?.split(" ")[0] ?? c.displayName ?? "";
    const apellido = c.displayName?.split(" ").slice(1).join(" ") ?? "";
    const email = c.email ?? null;

    // Chequear duplicado por email (si tiene)
    if (email) {
      const { data: existing } = await sb
        .from("crm_contactos")
        .select("id")
        .eq("perfil_id", user.id)
        .eq("email", email)
        .maybeSingle();
      if (existing) { duplicados++; continue; }
    }

    const { error } = await sb.from("crm_contactos").insert({
      perfil_id: user.id,
      nombre,
      apellido,
      email,
      telefono: c.phone ?? null,
      empresa: c.company ?? null,
      origen: "google_contacts",
      estado: "activo",
      created_at: new Date().toISOString(),
    });

    if (!error) importados++;
  }

  return NextResponse.json({ ok: true, importados, duplicados });
}
