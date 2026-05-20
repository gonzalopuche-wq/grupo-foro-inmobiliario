import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sincronizarParaUsuario } from "../../crm/kiteprop/sync-leads/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cron diario: sincroniza leads de KiteProp para todos los usuarios configurados
// Llamar con Authorization: Bearer {CRON_SECRET}
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Todos los usuarios con KiteProp configurado
  const { data: configs } = await sb
    .from("crm_integraciones_config")
    .select("perfil_id")
    .eq("tipo", "kiteprop");

  // También usuarios con kiteprop_key en portal_credenciales (sin crm_integraciones_config)
  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("perfil_id")
    .not("kiteprop_key", "is", null);

  const configIds = new Set((configs ?? []).map((r: { perfil_id: string }) => r.perfil_id));
  const credIds = (creds ?? []).map((r: { perfil_id: string }) => r.perfil_id).filter(id => !configIds.has(id));
  const allIds = [...configIds, ...credIds];

  const resumen: Array<{ userId: string; ok: boolean; resultado?: object; error?: string }> = [];

  for (const userId of allIds) {
    try {
      const resultado = await sincronizarParaUsuario(userId);
      resumen.push({ userId, ok: true, resultado });
    } catch (e: unknown) {
      resumen.push({ userId, ok: false, error: e instanceof Error ? e.message : "Error" });
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
