// Cron: detecta leads sin contacto en N días y notifica al corredor
// Corre diariamente. Busca contactos con negocio activo sin interacción reciente.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";

const DIAS_SIN_CONTACTO = 7;

async function enviarPush(perfil_id: string, titulo: string, body: string, url: string) {
  return fetch(`${siteUrl}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": process.env.CRON_SECRET ?? "" },
    body: JSON.stringify({ perfil_id, titulo, body, url }),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - DIAS_SIN_CONTACTO);
  const fechaLimiteStr = fechaLimite.toISOString();

  // Traer todos los negocios activos con su contacto y última interacción
  const { data: negocios } = await sb
    .from("crm_negocios")
    .select("id, perfil_id, contacto_id, titulo, etapa, crm_contactos(id, nombre, apellido, telefono)")
    .not("etapa", "in", '("cerrado","perdido")')
    .eq("archivado", false);

  if (!negocios?.length) return NextResponse.json({ ok: true, alertas: 0 });

  // Para cada negocio, verificar la última interacción
  const alertasPorPerfil: Record<string, { nombre: string; contacto_id: string; negocio_id: string; telefono?: string }[]> = {};

  for (const neg of negocios) {
    const contacto = (neg.crm_contactos as any);
    if (!contacto) continue;

    const { data: ultima } = await sb
      .from("crm_interacciones")
      .select("created_at")
      .eq("contacto_id", neg.contacto_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const sinContacto = !ultima || ultima.created_at < fechaLimiteStr;
    if (!sinContacto) continue;

    const pid = neg.perfil_id as string;
    if (!alertasPorPerfil[pid]) alertasPorPerfil[pid] = [];
    alertasPorPerfil[pid].push({
      nombre: `${contacto.nombre} ${contacto.apellido}`,
      contacto_id: neg.contacto_id as string,
      negocio_id: neg.id as string,
      telefono: contacto.telefono,
    });
  }

  let totalAlertas = 0;
  for (const [perfil_id, leads] of Object.entries(alertasPorPerfil)) {
    const primero = leads[0];
    const resto = leads.length - 1;
    const body = resto > 0
      ? `${primero.nombre} y ${resto} contacto${resto > 1 ? "s" : ""} más sin contacto hace +${DIAS_SIN_CONTACTO} días`
      : `${primero.nombre} lleva +${DIAS_SIN_CONTACTO} días sin contacto`;

    await enviarPush(
      perfil_id,
      "⚡ Leads que necesitan seguimiento",
      body,
      `/crm/hoy`
    );
    totalAlertas += leads.length;
  }

  return NextResponse.json({ ok: true, alertas: totalAlertas, perfiles: Object.keys(alertasPorPerfil).length });
}
