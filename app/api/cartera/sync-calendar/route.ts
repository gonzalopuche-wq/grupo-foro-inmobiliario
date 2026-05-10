// POST /api/cartera/sync-calendar — crea o actualiza un evento en Google Calendar para una visita
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGoogleToken } from "../../../lib/google-token";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { visita_id, perfil_id } = await req.json();
    if (!visita_id || !perfil_id) {
      return NextResponse.json({ error: "visita_id y perfil_id requeridos" }, { status: 400 });
    }

    const accessToken = await getGoogleToken(perfil_id);
    if (!accessToken) {
      return NextResponse.json({
        ok: false, pendiente: true,
        error: "Google Calendar no conectado. Andá a CRM → Portales y conectá tu cuenta de Google.",
      });
    }

    const { data: visita } = await sb
      .from("cartera_visitas")
      .select("*, cartera_propiedades(titulo, direccion, tipo)")
      .eq("id", visita_id)
      .single();

    if (!visita) return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });

    const { data: creds } = await sb
      .from("portal_credenciales")
      .select("google_calendar_id")
      .eq("perfil_id", perfil_id)
      .maybeSingle();

    const calendarId = creds?.google_calendar_id ?? "primary";
    const prop = (visita.cartera_propiedades as any) ?? {};

    const start = visita.fecha_visita ?? new Date().toISOString();
    const end   = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();

    const event = {
      summary: `🏠 Visita: ${prop.titulo ?? "Propiedad"}`,
      location: prop.direccion ?? "",
      description: [
        prop.titulo ? `Propiedad: ${prop.titulo}` : null,
        prop.direccion ? `Dirección: ${prop.direccion}` : null,
        visita.cliente_nombre ? `Cliente: ${visita.cliente_nombre}` : null,
        visita.cliente_telefono ? `Tel: ${visita.cliente_telefono}` : null,
        visita.cliente_email ? `Email: ${visita.cliente_email}` : null,
        visita.cliente_dni ? `DNI: ${visita.cliente_dni}` : null,
        visita.numero_orden ? `Orden: ${visita.numero_orden}` : null,
        visita.observaciones ? `\nObservaciones: ${visita.observaciones}` : null,
      ].filter(Boolean).join("\n"),
      start: { dateTime: start, timeZone: "America/Argentina/Buenos_Aires" },
      end:   { dateTime: end,   timeZone: "America/Argentina/Buenos_Aires" },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
    };

    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const res = await fetch(calUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ ok: false, error: `Google Calendar: ${err.error?.message ?? res.status}` });
    }

    const created = await res.json();
    return NextResponse.json({ ok: true, eventId: created.id, link: created.htmlLink });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
