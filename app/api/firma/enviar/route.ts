import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.foroinmobiliario.com.ar");

interface Firmante {
  nombre: string;
  email: string;
  rol: string; // "inquilino" | "propietario" | "corredor" | "otro"
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { contrato_id, titulo, firmantes, documento_html } = body as {
    contrato_id?: string;
    titulo: string;
    firmantes: Firmante[];
    documento_html?: string;
  };

  if (!titulo || !firmantes?.length) {
    return NextResponse.json({ error: "Faltan parámetros: titulo y firmantes son obligatorios" }, { status: 400 });
  }

  // Build firmantes array with unique tokens
  const firmanteConTokens = firmantes.map((f) => ({
    ...f,
    token: crypto.randomUUID(),
    firmado: false,
    firmado_at: null,
    nombre_firmado: null,
  }));

  // Save solicitud de firma
  const { data: solicitud, error } = await sb
    .from("firma_solicitudes")
    .insert({
      perfil_id: user.id,
      contrato_id: contrato_id ?? null,
      titulo,
      firmantes: firmanteConTokens,
      html_doc: documento_html ?? null,
      estado: "pendiente",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !solicitud) {
    console.error("firma_solicitudes insert error:", error);
    return NextResponse.json({ error: "No se pudo guardar la solicitud de firma" }, { status: 500 });
  }

  // Send emails to each firmante
  const emailResults = await Promise.allSettled(
    firmanteConTokens.map((f) => {
      const link = `${SITE_URL}/firmar/${f.token}`;
      return resend.emails.send({
        from: "GFI <noticias@foroinmobiliario.com.ar>",
        to: f.email,
        subject: `Documento para firmar: ${titulo}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:12px;border:1px solid #1e293b;">
            <div style="margin-bottom:24px;">
              <img src="https://www.foroinmobiliario.com.ar/logo.png" alt="GFI" style="height:32px;" onerror="this.style.display='none'" />
            </div>
            <h2 style="color:#f8fafc;margin-top:0;font-size:20px;">Solicitud de firma digital</h2>
            <p style="color:#94a3b8;">Hola <strong style="color:#f8fafc;">${f.nombre}</strong>,</p>
            <p style="color:#94a3b8;">Te invitamos a firmar el siguiente documento como <em>${f.rol}</em>:</p>
            <div style="background:#1e293b;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #334155;">
              <p style="margin:0;font-weight:700;font-size:16px;color:#f8fafc;">${titulo}</p>
            </div>
            <a href="${link}"
               style="display:inline-block;background:linear-gradient(135deg,#b80000,#660000);color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0;">
              Revisar y firmar documento
            </a>
            <p style="color:#475569;font-size:12px;margin-top:24px;">
              Este link es personal e intransferible. Si no esperabas este email, podés ignorarlo.
            </p>
            <p style="color:#334155;font-size:11px;">GFI — Grupo Foro Inmobiliario</p>
          </div>
        `,
      });
    })
  );

  const enviados = emailResults.filter((r) => r.status === "fulfilled").length;
  const fallidos = emailResults.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    solicitud_id: solicitud.id,
    enviados,
    fallidos,
    tokens: firmanteConTokens.map((f) => ({ email: f.email, rol: f.rol, token: f.token })),
  });
}
