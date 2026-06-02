import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { datos, editandoId } = body;

  // Resolve effective perfil_id: colaboradores work on behalf of their corredor
  let efectivoId = user.id;
  const { data: perfil } = await supabaseAdmin
    .from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo === "colaborador") {
    const { data: colab } = await supabaseAdmin
      .from("colaboradores").select("corredor_id").eq("user_id", user.id).single();
    if (colab?.corredor_id) efectivoId = colab.corredor_id;
  }

  datos.perfil_id = efectivoId;
  datos.updated_at = new Date().toISOString();

  let propId: string | null = null;

  // Snapshot precio/titulo before update to detect price drops
  let precioAnteriorDb: number | null = null;
  let tituloDb: string | null = null;
  if (editandoId && datos.precio != null) {
    const { data: snap } = await supabaseAdmin
      .from("cartera_propiedades")
      .select("precio, titulo, moneda")
      .eq("id", editandoId)
      .single();
    precioAnteriorDb = snap?.precio ?? null;
    tituloDb = snap?.titulo ?? null;
  }

  if (editandoId) {
    const { error } = await supabaseAdmin
      .from("cartera_propiedades")
      .update(datos)
      .eq("id", editandoId)
      .eq("perfil_id", efectivoId);
    if (error) {
      console.error("[cartera/guardar] update error:", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    propId = editandoId;

    // Fire-and-forget: notify web_leads when price drops >3%
    if (
      precioAnteriorDb != null &&
      datos.precio != null &&
      datos.precio < precioAnteriorDb * 0.97
    ) {
      void notificarBajaDePrecio({
        propiedadId: editandoId,
        titulo: tituloDb ?? "la propiedad",
        precioAnterior: precioAnteriorDb,
        precioNuevo: datos.precio as number,
        moneda: (datos.moneda as string) ?? "USD",
      });
    }
  } else {
    const { data: nueva, error } = await supabaseAdmin
      .from("cartera_propiedades")
      .insert(datos)
      .select("id")
      .single();
    if (error) {
      console.error("[cartera/guardar] insert error:", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    propId = nueva?.id ?? null;
  }

  void sincronizarConPropia(propId!, datos, efectivoId);

  return NextResponse.json({ ok: true, propId });
}

async function sincronizarConPropia(propId: string, datos: Record<string, unknown>, userId: string) {
  try {
    const { data: creds } = await supabaseAdmin
      .from("portal_credenciales")
      .select("propia_api_key, propia_provider, propia_usuario")
      .eq("perfil_id", userId)
      .maybeSingle();

    const apiKey = (creds as Record<string, string | null> | null)?.propia_api_key;
    const provider = (creds as Record<string, string | null> | null)?.propia_provider;
    if (!apiKey || !provider) return;

    const seller = (creds as Record<string, string | null>).propia_usuario ?? undefined;
    const op = ((datos.operacion as string) ?? "venta").toLowerCase();
    const forSale = op === "venta" || op === "ambas";
    const forRent = op === "alquiler" || op === "ambas";

    const { data: existing } = await supabaseAdmin
      .from("cartera_propiedades").select("propia_id").eq("id", propId).maybeSingle();
    const currentPropiaId = (existing as Record<string, string | null> | null)?.propia_id;

    const payload: Record<string, unknown> = {
      provider, seller,
      external_identifier: propId,
      title: datos.titulo ?? "",
      description: (datos.descripcion_privada as string | null) ?? null,
      for_sale: forSale,
      for_rent: forRent,
      for_sale_price: forSale ? (datos.precio ?? null) : null,
      for_rent_price: forRent ? (datos.precio ?? null) : null,
      currency: ((datos.moneda as string) ?? "USD").toLowerCase(),
      address: datos.direccion ?? "",
      city: datos.ciudad ?? "",
      state: datos.zona ?? "",
      country: "Argentina",
      rooms: datos.ambientes ?? null,
      bedrooms: datos.dormitorios ?? null,
      bathrooms: datos.banos ?? null,
      total_meters: datos.superficie_total ?? null,
      covered_meters: datos.superficie_cubierta ?? null,
      images: Array.isArray(datos.fotos)
        ? (datos.fotos as string[]).map(url => ({ lg: url, md: url, sm: url }))
        : [],
    };
    if (currentPropiaId) payload.property_id = currentPropiaId;

    const PROPIA_BASE = (process.env.PROPIA_API_BASE ?? "https://propia.com.ar/api").replace(/\/$/, "");
    const res = await fetch(`${PROPIA_BASE}/properties/publish`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.error("[cartera/guardar] Propia sync HTTP", res.status);
      return;
    }

    const result = await res.json() as Record<string, unknown>;
    const propiaId = (result.id ?? result.property_id ?? result.propia_id) as string | undefined;
    if (propiaId) {
      await supabaseAdmin.from("cartera_propiedades").update({
        propia_id: String(propiaId),
        propia_sync_at: new Date().toISOString(),
      }).eq("id", propId);
    }
  } catch (err) {
    console.error("[cartera/guardar] sincronizarConPropia:", err);
  }
}

async function notificarBajaDePrecio({
  propiedadId,
  titulo,
  precioAnterior,
  precioNuevo,
  moneda,
}: {
  propiedadId: string;
  titulo: string;
  precioAnterior: number;
  precioNuevo: number;
  moneda: string;
}) {
  try {
    const { data: leads } = await supabaseAdmin
      .from("web_leads")
      .select("email, nombre")
      .eq("propiedad_id", propiedadId)
      .not("email", "is", null);

    if (!leads || leads.length === 0) return;

    const fmt = (n: number) =>
      n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const pct = Math.round(((precioAnterior - precioNuevo) / precioAnterior) * 100);
    const sym = moneda === "USD" ? "USD" : "$";
    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar"}/inmueble/${propiedadId}`;

    const seenEmails = new Set<string>();
    for (const lead of leads) {
      const email = lead.email as string;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);

      const nombre = (lead.nombre as string | null) ?? "Estimado/a";

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;color:#222;">
          <div style="background:#990000;padding:20px 24px;">
            <div style="color:#fff;font-size:18px;font-weight:bold;">GFI® · Bajó el precio</div>
            <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Una propiedad que te interesó bajó de precio</div>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
            <p style="font-size:15px;margin-top:0;">Hola ${nombre},</p>
            <p style="font-size:14px;color:#444;">
              La propiedad <strong>${titulo}</strong> que consultaste bajó su precio:
            </p>
            <div style="margin:20px 0;padding:16px;background:#f9f9f9;border-radius:8px;text-align:center;">
              <div style="font-size:13px;color:#999;text-decoration:line-through;">${sym} ${fmt(precioAnterior)}</div>
              <div style="font-size:26px;font-weight:700;color:#990000;margin:4px 0;">${sym} ${fmt(precioNuevo)}</div>
              <div style="display:inline-block;background:#22807c;color:#fff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;">-${pct}%</div>
            </div>
            <div style="text-align:center;margin-top:24px;">
              <a href="${url}" style="background:#990000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">Ver propiedad</a>
            </div>
            <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#999;">
              Recibís este email porque consultaste esta propiedad en GFI®.
              Si no querés recibir más alertas, ignorá este mensaje.
            </div>
          </div>
        </div>
      `;

      await resend.emails.send({
        from: "GFI® Alertas <noreply@foroinmobiliario.com.ar>",
        to: email,
        subject: `Bajó el precio: ${titulo} (−${pct}%)`,
        html,
      });
    }
  } catch (err) {
    console.error("[cartera/guardar] notificarBajaDePrecio error:", err);
  }
}
