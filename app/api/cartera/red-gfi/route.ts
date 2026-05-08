// app/api/cartera/red-gfi/route.ts
// Toggle sharing a cartera property into the Red GFI network (mir_ofrecidos)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OP_MAP: Record<string, string> = {
  "Venta": "venta",
  "Alquiler": "alquiler",
  "Alquiler temporal": "temporario",
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const { data: { user }, error: authErr } = await sbAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { propiedad_id } = await req.json();
    if (!propiedad_id) return NextResponse.json({ error: "propiedad_id requerido" }, { status: 400 });

    const { data: prop, error: propErr } = await sbAdmin
      .from("cartera_propiedades")
      .select("*")
      .eq("id", propiedad_id)
      .eq("perfil_id", user.id)
      .single();
    if (propErr || !prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

    if (prop.compartir_en_red) {
      // Deactivate sharing
      if (prop.mir_ofrecido_id) {
        await sbAdmin.from("mir_ofrecidos").update({ activo: false }).eq("id", prop.mir_ofrecido_id);
      }
      await sbAdmin.from("cartera_propiedades")
        .update({ compartir_en_red: false })
        .eq("id", propiedad_id);
      return NextResponse.json({ ok: true, compartiendo: false });
    }

    // Activate sharing — upsert into mir_ofrecidos
    const mirData = {
      perfil_id: user.id,
      operacion: OP_MAP[prop.operacion] ?? "venta",
      tipo_propiedad: prop.tipo,
      zona: prop.zona ?? null,
      ciudad: prop.ciudad ?? "Rosario",
      precio: prop.precio ?? null,
      moneda: prop.moneda ?? "USD",
      dormitorios: prop.dormitorios ?? null,
      banos: prop.banos ?? null,
      superficie_cubierta: prop.superficie_cubierta ?? null,
      superficie_total: prop.superficie_total ?? null,
      antiguedad: prop.antiguedad ?? null,
      apto_credito: prop.apto_credito ?? false,
      uso_comercial: prop.uso_comercial ?? false,
      barrio_cerrado: prop.barrio_cerrado ?? false,
      con_cochera: prop.con_cochera ?? false,
      acepta_mascotas: prop.acepta_mascotas ?? false,
      acepta_bitcoin: false,
      descripcion: prop.descripcion ?? null,
      activo: true,
      nombre_publicante: prop.titulo,
      honorario_compartir: prop.honorario_compartir ?? null,
      fotos: prop.fotos ?? [],
      cartera_id: propiedad_id,
    };

    let mirId = prop.mir_ofrecido_id;
    if (mirId) {
      await sbAdmin.from("mir_ofrecidos").update(mirData).eq("id", mirId);
    } else {
      const { data: nuevo, error: insErr } = await sbAdmin
        .from("mir_ofrecidos")
        .insert(mirData)
        .select("id")
        .single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      mirId = nuevo.id;
    }

    await sbAdmin.from("cartera_propiedades")
      .update({ compartir_en_red: true, mir_ofrecido_id: mirId })
      .eq("id", propiedad_id);

    return NextResponse.json({ ok: true, compartiendo: true, mir_ofrecido_id: mirId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
