// Exportar cartera completa como CSV
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const COLS = [
  "codigo","titulo","tipo","operacion","estado","precio","moneda","expensas",
  "ciudad","zona","direccion","codigo_postal","latitud","longitud",
  "dormitorios","banos","ambientes","estacionamientos",
  "superficie_cubierta","superficie_total","sup_semicubierta","sup_descubierta",
  "sup_patio_terraza","sup_balcon","metros_frente","metros_fondo",
  "antiguedad","condicion","disposicion","orientacion","piso","numero_unidad",
  "apto_credito","con_cochera","amoblado","habitada","acepta_permuta","acepta_mascotas",
  "barrio_cerrado","uso_comercial","energia_solar",
  "ocultar_precio","ocultar_ubicacion","ocultar_de_redes","ocultar_web",
  "honorario_propietario","honorario_comprador","honorario_compartir",
  "descripcion","descripcion_privada","video_url","url_portal_origen",
  "estado_sync_tokko","estado_sync_kiteprop","created_at","updated_at",
];

function esc(val: any): string {
  if (val === null || val === undefined) return "";
  const s = Array.isArray(val) ? val.join("|") : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const perfilId = searchParams.get("perfil_id");
  if (!perfilId) return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });

  const [{ data: props }, { data: syncs }] = await Promise.all([
    sb.from("cartera_propiedades").select("*").eq("perfil_id", perfilId).order("created_at", { ascending: false }),
    sb.from("cartera_sync_portales").select("propiedad_id,tokko_id,tokko_synced_at,kiteprop_id,kiteprop_synced_at"),
  ]);

  const syncMap: Record<string, any> = {};
  (syncs ?? []).forEach((s: any) => { syncMap[s.propiedad_id] = s; });

  const rows = (props ?? []).map((p: any) => {
    const s = syncMap[p.id] ?? {};
    const enriched = {
      ...p,
      estado_sync_tokko: s.tokko_id ? `✓ ${s.tokko_synced_at?.slice(0,10) ?? ""}` : "",
      estado_sync_kiteprop: s.kiteprop_id ? `✓ ${s.kiteprop_synced_at?.slice(0,10) ?? ""}` : "",
    };
    return COLS.map(c => esc(enriched[c])).join(",");
  });

  const csv = [COLS.join(","), ...rows].join("\n");
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cartera-gfi-${fecha}.csv"`,
    },
  });
}
