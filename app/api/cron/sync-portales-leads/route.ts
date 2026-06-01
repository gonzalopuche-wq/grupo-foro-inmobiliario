import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sincronizarParaUsuario as syncKP } from "../../crm/kiteprop/sync-leads/route";
import { sincronizarParaUsuario as syncTK } from "../../crm/tokko/sync-leads/route";
import { sincronizarParaUsuario as syncPR } from "../../crm/propia/sync-leads/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cron diario: sincroniza leads/contactos de KiteProp y Tokko para todos los usuarios configurados
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Usuarios con KiteProp configurado
  const [kpConfigs, kpCreds, tkConfigs, tkCreds, prCreds] = await Promise.all([
    sb.from("crm_integraciones_config").select("perfil_id").eq("tipo", "kiteprop"),
    sb.from("portal_credenciales").select("perfil_id").not("kiteprop_key", "is", null),
    sb.from("crm_integraciones_config").select("perfil_id").eq("tipo", "tokko"),
    sb.from("portal_credenciales").select("perfil_id").not("tokko_key", "is", null).neq("tokko_key", ""),
    sb.from("portal_credenciales").select("perfil_id").not("propia_api_key", "is", null).neq("propia_api_key", ""),
  ]);

  const kpIds = new Set([
    ...(kpConfigs.data ?? []).map((r: { perfil_id: string }) => r.perfil_id),
    ...(kpCreds.data ?? []).map((r: { perfil_id: string }) => r.perfil_id),
  ]);
  const tkIds = new Set([
    ...(tkConfigs.data ?? []).map((r: { perfil_id: string }) => r.perfil_id),
    ...(tkCreds.data ?? []).map((r: { perfil_id: string }) => r.perfil_id),
  ]);
  const prIds = new Set([
    ...(prCreds.data ?? []).map((r: { perfil_id: string }) => r.perfil_id),
  ]);

  const resumen: Array<{ userId: string; portal: string; ok: boolean; resultado?: object; error?: string }> = [];

  const tareas: Array<{ userId: string; portal: string; fn: () => Promise<object> }> = [
    ...[...kpIds].map(id => ({ userId: id, portal: "kiteprop", fn: () => syncKP(id) })),
    ...[...tkIds].map(id => ({ userId: id, portal: "tokko",    fn: () => syncTK(id) })),
    ...[...prIds].map(id => ({ userId: id, portal: "propia",   fn: () => syncPR(id) })),
  ];

  const resultados = await Promise.allSettled(tareas.map(t => t.fn()));
  for (let i = 0; i < tareas.length; i++) {
    const r = resultados[i];
    if (r.status === "fulfilled") {
      resumen.push({ userId: tareas[i].userId, portal: tareas[i].portal, ok: true, resultado: r.value });
    } else {
      const err = r.reason;
      resumen.push({ userId: tareas[i].userId, portal: tareas[i].portal, ok: false, error: err instanceof Error ? err.message : "Error" });
    }
  }

  const totales = resumen.reduce(
    (acc, r) => {
      if (r.ok && r.resultado) {
        const res = r.resultado as { importados: number; actualizados: number; errores: number };
        acc.importados += res.importados ?? 0;
        acc.actualizados += res.actualizados ?? 0;
        acc.errores += res.errores ?? 0;
      }
      return acc;
    },
    { importados: 0, actualizados: 0, errores: 0 }
  );

  return NextResponse.json({ ok: true, usuarios: resumen.length, ...totales, resumen });
}
