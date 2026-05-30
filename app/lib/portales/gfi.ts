// Sincroniza propiedades de GFI desde cartera_propiedades
// gfi_red  → toda la red interna (activa + reservada)
// gfi_portal → solo las que están activas en el portal público
import { createClient } from "@supabase/supabase-js";
import { PropExtNorm, parseNum } from "./types";

function normalizarOperacion(op: string): string {
  const o = op.toLowerCase();
  if (o.includes("temp")) return "alquiler_temporal";
  if (o.includes("alquiler")) return "alquiler";
  return "venta";
}

function normalizarTipo(tipo: string): string {
  return tipo.toLowerCase().replace(/\s+/g, "_");
}

function normalizarImagenes(fotos: any): string[] {
  if (!fotos) return [];
  if (Array.isArray(fotos)) {
    return fotos
      .map((f: any) => (typeof f === "string" ? f : f?.url ?? f?.src ?? ""))
      .filter((u: string) => u.startsWith("http"));
  }
  return [];
}

function mapearPropiedad(p: any, portal: "gfi_red" | "gfi_portal"): PropExtNorm {
  return {
    portal_id: p.id,
    url: `/crm/cartera/ficha/${p.id}`,
    titulo: p.titulo ?? "",
    operacion: normalizarOperacion(p.operacion ?? "venta"),
    tipo: normalizarTipo(p.tipo ?? "otro"),
    precio: parseNum(p.precio),
    moneda: p.moneda ?? "USD",
    dormitorios: parseNum(p.dormitorios),
    banos: parseNum(p.banos),
    ambientes: parseNum(p.ambientes),
    superficie_cubierta: parseNum(p.superficie_cubierta),
    sup_terreno: null,
    expensas: parseNum(p.expensas),
    barrio: p.zona ?? null,
    ciudad: p.ciudad ?? "Rosario",
    provincia: p.provincia ?? "Santa Fe",
    direccion: p.direccion ?? null,
    lat: parseNum(p.latitud),
    lng: parseNum(p.longitud),
    imagenes: normalizarImagenes(p.fotos),
    descripcion: p.descripcion ?? null,
    datos_raw: { codigo: p.codigo, perfil_id: p.perfil_id },
  };
}

export async function syncGFIRed(): Promise<PropExtNorm[]> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await sb
    .from("cartera_propiedades")
    .select("id,titulo,operacion,tipo,precio,moneda,ciudad,zona,dormitorios,banos,ambientes,superficie_cubierta,expensas,fotos,codigo,estado,provincia,direccion,latitud,longitud,descripcion,perfil_id")
    .in("estado", ["activa", "reservada"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`GFI Red: ${error.message}`);
  if (!data) return [];
  return data.map(p => mapearPropiedad(p, "gfi_red"));
}

export async function syncGFIPortal(): Promise<PropExtNorm[]> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await sb
    .from("cartera_propiedades")
    .select("id,titulo,operacion,tipo,precio,moneda,ciudad,zona,dormitorios,banos,ambientes,superficie_cubierta,expensas,fotos,codigo,estado,provincia,direccion,latitud,longitud,descripcion,perfil_id")
    .eq("estado", "activa")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`GFI Portal: ${error.message}`);
  if (!data) return [];
  return data.map(p => mapearPropiedad(p, "gfi_portal"));
}
