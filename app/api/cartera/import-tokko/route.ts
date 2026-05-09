// app/api/cartera/import-tokko/route.ts
// Importación masiva desde Tokko Broker API → cartera_propiedades

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Reverse maps: Tokko IDs → GFI strings
const TIPO: Record<number, string> = {
  2: "Departamento", 3: "Casa", 13: "PH", 7: "Local",
  6: "Oficina", 9: "Terreno", 15: "Cochera", 18: "Galpon",
};
const OP: Record<number, string> = {
  1: "Venta", 2: "Alquiler", 3: "Alquiler temporal",
};
const STATUS: Record<number, string> = {
  2: "activa", 3: "vendida", 4: "reservada", 5: "pausada", 8: "pausada",
};
const AGE: Record<number, string> = {
  0: "A estrenar", 3: "Menos de 5 años", 7: "5-10 años", 15: "10-20 años", 25: "Más de 20 años",
};

function mapTokkoToCartera(t: any, perfilId: string) {
  const op = t.operations?.[0];
  const price = op?.prices?.[0];
  const opId: number = op?.id ?? t.operation_id;
  const typeId: number = t.type?.id ?? t.property_type_id;
  const statusId: number = t.status?.id ?? t.status_id ?? 2;
  const currencyRaw: string = price?.currency ?? (t.currency === 2 ? "USD" : "ARS");
  const moneda = currencyRaw === "USD" ? "USD" : currencyRaw === "EUR" ? "EUR" : "ARS";

  const photos = (t.photos ?? [])
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((ph: any) => ph.image ?? ph.url)
    .filter(Boolean)
    .slice(0, 20);

  const tags = (t.tags ?? []).map((tag: any) => tag.name ?? tag).filter(Boolean);

  return {
    perfil_id: perfilId,
    titulo: t.publication_title ?? t.title ?? "Propiedad importada desde Tokko",
    descripcion: t.description ?? null,
    tipo: TIPO[typeId] ?? "Departamento",
    operacion: OP[opId] ?? "Venta",
    estado: STATUS[statusId] ?? "activa",
    precio: price?.price ?? t.price ?? null,
    moneda,
    ciudad: t.location?.city ?? t.city ?? "Rosario",
    zona: t.location?.zone?.name ?? t.zone ?? null,
    direccion: t.location?.address ?? t.address ?? null,
    latitud: t.location?.lat ?? null,
    longitud: t.location?.lon ?? null,
    dormitorios: t.room_amount ?? t.rooms ?? null,
    banos: t.bathroom_amount ?? t.bathrooms ?? null,
    estacionamientos: t.parking_lot_amount ?? null,
    superficie_total: t.total_surface ?? t.total_area ?? null,
    superficie_cubierta: t.roofed_surface ?? t.covered_area ?? null,
    antiguedad: AGE[t.age] ?? null,
    apto_credito: t.accepts_credit ?? false,
    con_cochera: (t.parking_lot_amount ?? 0) > 0 || t.has_parking === 1,
    video_url: t.video ?? t.video_url ?? null,
    fotos: photos,
    amenities: tags,
    publicada_web: false,
    compartir_en_red: false,
    ocultar_precio: false,
    ocultar_ubicacion: false,
    ocultar_de_redes: false,
    ocultar_web: false,
    updated_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const perfilId = searchParams.get("perfil_id");
    const soloNuevas = searchParams.get("solo_nuevas") !== "false";

    if (!perfilId) return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });

    // API key: per-user first, fallback global
    const { data: creds } = await sb
      .from("portal_credenciales")
      .select("tokko_key")
      .eq("perfil_id", perfilId)
      .maybeSingle();
    const apiKey = creds?.tokko_key ?? process.env.TOKKO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key de Tokko no configurada. Agregala en Cartera → Portales." },
        { status: 400 }
      );
    }

    // Fetch all pages from Tokko
    const allProps: any[] = [];
    let offset = 0;
    const limit = 200;

    while (true) {
      const res = await fetch(
        `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&limit=${limit}&offset=${offset}`,
        { headers: { "Accept": "application/json" } }
      );
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ error: "API key de Tokko inválida o sin acceso a la API." }, { status: 400 });
      }
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Tokko ${res.status}: ${err}` }, { status: 500 });
      }
      const data = await res.json();
      const objects: any[] = data.objects ?? data.results ?? [];
      allProps.push(...objects);
      if (!data.meta?.next || objects.length < limit) break;
      offset += limit;
    }

    if (allProps.length === 0) {
      return NextResponse.json({ ok: true, total: 0, importadas: 0, saltadas: 0 });
    }

    // Get already-imported Tokko IDs for this corredor
    const { data: existing } = await sb
      .from("cartera_sync_portales")
      .select("tokko_id, propiedad_id");
    const existingTokkoIds = new Set((existing ?? []).map((r: any) => String(r.tokko_id)));

    let importadas = 0;
    let saltadas = 0;
    const errores: string[] = [];

    for (const t of allProps) {
      const tokkoId = String(t.id);

      if (soloNuevas && existingTokkoIds.has(tokkoId)) {
        saltadas++;
        continue;
      }

      try {
        const carteraData = mapTokkoToCartera(t, perfilId);
        const { data: newProp, error: insertErr } = await sb
          .from("cartera_propiedades")
          .insert(carteraData)
          .select("id")
          .single();

        if (insertErr) {
          errores.push(`#${tokkoId}: ${insertErr.message}`);
          continue;
        }

        await sb.from("cartera_sync_portales").upsert(
          { propiedad_id: newProp.id, tokko_id: tokkoId, tokko_synced_at: new Date().toISOString() },
          { onConflict: "propiedad_id" }
        );

        importadas++;
      } catch (e: any) {
        errores.push(`#${tokkoId}: ${e.message}`);
      }
    }

    return NextResponse.json({ ok: true, total: allProps.length, importadas, saltadas, errores: errores.slice(0, 20) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
