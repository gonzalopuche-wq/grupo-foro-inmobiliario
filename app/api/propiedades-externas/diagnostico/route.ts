// Diagnóstico de sync de portales externos — solo admin/master
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (!perfil || !["admin", "master"].includes(perfil.tipo)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const resultados: Record<string, any> = {};

  // ── 1. cartera_propiedades: conteo por estado ─────────────────────────────
  const { data: carteraCount, error: carteraErr } = await sb
    .from("cartera_propiedades")
    .select("estado", { count: "exact" });

  const carteraByEstado: Record<string, number> = {};
  for (const row of carteraCount ?? []) {
    carteraByEstado[row.estado ?? "null"] = (carteraByEstado[row.estado ?? "null"] ?? 0) + 1;
  }
  resultados.cartera_propiedades = {
    total: carteraCount?.length ?? 0,
    por_estado: carteraByEstado,
    error: carteraErr?.message ?? null,
  };

  // ── 2. Test query GFI (sin upsert) ────────────────────────────────────────
  const { data: gfiData, error: gfiErr } = await sb
    .from("cartera_propiedades")
    .select("id,titulo,operacion,tipo,precio,moneda,ciudad,zona,dormitorios,banos,ambientes,superficie_cubierta,sup_terreno,expensas,fotos,codigo,estado,provincia,direccion,latitud,longitud,descripcion,perfil_id", { count: "exact" })
    .in("estado", ["activa", "reservada"])
    .limit(1);

  resultados.gfi_query = {
    filas_activas_reservadas: gfiData !== null ? "OK" : "SIN DATOS",
    error: gfiErr?.message ?? null,
  };

  // ── 3. propiedades_externas: conteo por portal ────────────────────────────
  const { data: extCount, error: extErr } = await sb
    .from("propiedades_externas")
    .select("portal");

  const extByPortal: Record<string, number> = {};
  for (const row of extCount ?? []) {
    extByPortal[row.portal] = (extByPortal[row.portal] ?? 0) + 1;
  }
  resultados.propiedades_externas = {
    total: extCount?.length ?? 0,
    por_portal: extByPortal,
    error: extErr?.message ?? null,
  };

  // ── 4. Keys configuradas (solo existencia, no valor) ─────────────────────
  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("kiteprop_key,propia_api_key");

  const { data: integConfigs } = await sb
    .from("crm_integraciones_config")
    .select("tipo,activo,config")
    .eq("activo", true);

  const keysStatus: Record<string, boolean> = {
    kiteprop_key: (creds ?? []).some((c: any) => !!c.kiteprop_key),
    propia_api_key: (creds ?? []).some((c: any) => !!c.propia_api_key),
    tokko_key: (integConfigs ?? []).some((c: any) => c.tipo === "tokko" && !!(c.config as any)?.api_key),
    kiteprop_integ: (integConfigs ?? []).some((c: any) => c.tipo === "kiteprop" && !!(c.config as any)?.api_key),
    propia_integ: (integConfigs ?? []).some((c: any) => c.tipo === "propia" && !!(c.config as any)?.api_key),
  };
  resultados.keys_configuradas = keysStatus;

  // ── 5. Test upsert de portales ────────────────────────────────────────────
  // Verifica que el constraint permita los portales necesarios
  const portalTest = ["gfi_red", "gfi_portal", "kiteprop", "tokko", "propia_red", "propia_portal"];
  const constraintOk: Record<string, boolean> = {};
  for (const p of portalTest) {
    const { error: testErr } = await sb.from("propiedades_externas").upsert([{
      portal: p, portal_id: `_diag_test_${p}`, titulo: "test", operacion: "venta", tipo: "otro",
      activa: false, synced_at: new Date().toISOString(),
    }], { onConflict: "portal,portal_id" });
    constraintOk[p] = !testErr;
    // Limpiar el registro de prueba
    if (!testErr) {
      await sb.from("propiedades_externas").delete().eq("portal", p).eq("portal_id", `_diag_test_${p}`);
    }
  }
  resultados.constraint_portales = constraintOk;

  return NextResponse.json(resultados);
}
