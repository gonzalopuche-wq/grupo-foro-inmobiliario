// Cron: ajuste automático de alquileres — corre diariamente
// Detecta contratos que vencen su período de ajuste hoy o en los próximos 3 días
// y notifica al corredor para aplicar el ajuste
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";

async function enviarPush(perfil_id: string, titulo: string, body: string, url: string) {
  return fetch(`${siteUrl}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": process.env.CRON_SECRET ?? "" },
    body: JSON.stringify({ perfil_id, titulo, body, url }),
  }).catch(() => {});
}

function calcularProximoAjuste(fecha_inicio: string, periodicidad_meses: number): Date {
  const inicio = new Date(fecha_inicio);
  const hoy = new Date();
  // Cuántos períodos han pasado
  const mesesTranscurridos = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  const periodosCompletos = Math.floor(mesesTranscurridos / periodicidad_meses);
  const proximo = new Date(inicio);
  proximo.setMonth(proximo.getMonth() + (periodosCompletos + 1) * periodicidad_meses);
  return proximo;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en3dias = new Date(hoy);
  en3dias.setDate(en3dias.getDate() + 3);

  // Traer contratos de alquiler activos con ajuste configurado
  const { data: contratos } = await sb
    .from("crm_contratos")
    .select(`
      id, perfil_id, tipo_contrato,
      fecha_inicio, fecha_fin, monto_mensual,
      periodicidad_ajuste, indice_ajuste, inquilino_id,
      crm_contactos!crm_contratos_inquilino_id_fkey(nombre, apellido)
    `)
    .eq("estado", "activo")
    .eq("tipo_contrato", "alquiler")
    .not("periodicidad_ajuste", "is", null)
    .not("indice_ajuste", "is", null);

  if (!contratos?.length) return NextResponse.json({ ok: true, notificados: 0 });

  let notificados = 0;

  for (const c of contratos) {
    try {
      const periodicidad = c.periodicidad_ajuste as number;
      if (!periodicidad || periodicidad <= 0) continue;

      const proximo = calcularProximoAjuste(c.fecha_inicio, periodicidad);

      // Notificar si el ajuste es hoy o en los próximos 3 días
      if (proximo < hoy || proximo > en3dias) continue;

      const diasRestantes = Math.round((proximo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      const contacto = (c.crm_contactos as any);
      const nombreInquilino = contacto ? `${contacto.nombre} ${contacto.apellido}` : "Inquilino";

      const titulo = diasRestantes === 0
        ? "📈 Ajuste de alquiler hoy"
        : `📈 Ajuste de alquiler en ${diasRestantes} día${diasRestantes > 1 ? "s" : ""}`;

      const body = `${nombreInquilino} · Índice: ${c.indice_ajuste} · Monto actual: $${(c.monto_mensual ?? 0).toLocaleString("es-AR")}`;

      await enviarPush(c.perfil_id, titulo, body, `/crm/contratos/${c.id}`);
      notificados++;
    } catch { /* continuar */ }
  }

  return NextResponse.json({ ok: true, notificados });
}
