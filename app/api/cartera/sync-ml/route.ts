// Sincronización con MercadoLibre Inmuebles
// Requiere: ML_ACCESS_TOKEN y ML_REFRESH_TOKEN en Vercel (OAuth MercadoLibre)
// Para obtener tokens: https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Categorías ML para Argentina — Inmuebles
const CATEGORIA_ML: Record<string, string> = {
  "Departamento": "MLA1459",   // Departamentos en Venta
  "Casa": "MLA1466",           // Casas en Venta
  "PH": "MLA1459",
  "Terreno": "MLA1472",        // Terrenos y Lotes
  "Local": "MLA1615",          // Locales y Negocios
  "Oficina": "MLA1616",        // Oficinas
  "Cochera": "MLA1574",        // Cocheras y Bauleras
  "Galpon": "MLA1606",         // Depósitos y Galpones
};

const CATEGORIA_ALQUILER_ML: Record<string, string> = {
  "Departamento": "MLA1500",
  "Casa": "MLA1501",
  "PH": "MLA1500",
  "Terreno": "MLA1502",
  "Local": "MLA1615",
  "Oficina": "MLA1616",
};

function mapearAML(p: any) {
  const esAlquiler = p.operacion !== "Venta";
  const catMap = esAlquiler ? CATEGORIA_ALQUILER_ML : CATEGORIA_ML;
  const categoryId = catMap[p.tipo] ?? "MLA1459";

  const attributes: any[] = [
    { id: "PROPERTY_TYPE", value_name: p.tipo },
    { id: "OPERATION_TYPE", value_name: esAlquiler ? "Alquiler" : "Venta" },
  ];
  if (p.dormitorios) attributes.push({ id: "ROOMS", value_name: String(p.dormitorios) });
  if (p.banos) attributes.push({ id: "FULL_BATHROOMS", value_name: String(p.banos) });
  if (p.superficie_total) attributes.push({ id: "TOTAL_AREA", value_name: String(p.superficie_total), unit: "m²" });
  if (p.superficie_cubierta) attributes.push({ id: "COVERED_AREA", value_name: String(p.superficie_cubierta), unit: "m²" });
  if (p.con_cochera) attributes.push({ id: "PARKING_LOTS", value_name: "1" });
  if (p.apto_credito) attributes.push({ id: "ACCEPTS_CREDIT", value_name: "Sí" });
  if (p.antiguedad) attributes.push({ id: "PROPERTY_AGE", value_name: p.antiguedad });

  return {
    title: p.titulo?.slice(0, 60),
    category_id: categoryId,
    price: p.precio ?? 0,
    currency_id: p.moneda === "USD" ? "USD" : "ARS",
    available_quantity: 1,
    buying_mode: "classified",
    listing_type_id: "gold_special",
    condition: "not_specified",
    description: { plain_text: p.descripcion ?? "" },
    pictures: (p.fotos ?? []).slice(0, 12).map((url: string) => ({ source: url })),
    attributes,
    location: {
      address_line: p.direccion ?? "",
      city: { id: "TUxBQlJPUzU3NDU" }, // Rosario default
      neighborhood: p.zona ? { name: p.zona } : undefined,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const { propiedad_id, perfil_id } = await req.json();
    if (!propiedad_id || !perfil_id) return NextResponse.json({ error: "propiedad_id y perfil_id requeridos" }, { status: 400 });

    const accessToken = process.env.ML_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({
        ok: false, pendiente: true,
        error: "ML_ACCESS_TOKEN no configurado. Para publicar en MercadoLibre necesitás crear una app en developers.mercadolibre.com.ar y agregar el token en las variables de Vercel.",
      });
    }

    const { data: prop } = await sb.from("cartera_propiedades").select("*").eq("id", propiedad_id).single();
    if (!prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

    const { data: sync } = await sb.from("cartera_sync_portales").select("ml_id").eq("propiedad_id", propiedad_id).maybeSingle();
    const mlId = (sync as any)?.ml_id ?? null;

    const body = mapearAML(prop);
    const url = mlId
      ? `https://api.mercadolibre.com/items/${mlId}`
      : "https://api.mercadolibre.com/items";

    const res = await fetch(url, {
      method: mlId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ ok: false, error: `ML ${res.status}: ${err.message ?? JSON.stringify(err)}` });
    }

    const data = await res.json();
    const newMlId = data.id ?? mlId;

    await sb.from("cartera_sync_portales").upsert(
      { propiedad_id, ml_id: newMlId, ml_synced_at: new Date().toISOString(), ml_error: null },
      { onConflict: "propiedad_id" }
    );

    return NextResponse.json({ ok: true, id: newMlId, url: data.permalink });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
