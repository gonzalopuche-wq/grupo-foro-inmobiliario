import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

  return NextResponse.json({ ok: true, propId });
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
          <div style="background:#cc0000;padding:20px 24px;">
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
              <div style="font-size:26px;font-weight:700;color:#cc0000;margin:4px 0;">${sym} ${fmt(precioNuevo)}</div>
              <div style="display:inline-block;background:#16a34a;color:#fff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;">-${pct}%</div>
            </div>
            <div style="text-align:center;margin-top:24px;">
              <a href="${url}" style="background:#cc0000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">Ver propiedad</a>
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
