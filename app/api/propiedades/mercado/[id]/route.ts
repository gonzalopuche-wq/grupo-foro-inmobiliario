import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const GFI_SELECT = [
  "id,titulo,operacion,tipo,precio,precio_anterior,moneda,zona,ciudad,provincia,direccion",
  "dormitorios,banos,ambientes,superficie_cubierta,sup_terreno,sup_semicubierta,sup_descubierta,expensas",
  "orientacion,piso,estacionamientos,bauleras,antiguedad",
  "amoblado,acepta_mascotas,apto_credito",
  "com_pileta,com_gimnasio,com_sum,com_ascensor,com_seguridad,com_parrilla,com_quincho,com_solarium,com_lavanderia,com_cowork,com_juegos_infantiles",
  "amb_balcon,amb_terraza,amb_jardin,amb_patio",
  "video_url,tour_virtual_url",
  "descripcion,fotos,estado,updated_at",
].join(",");

const EXT_SELECT = [
  "id,portal,portal_id,url,titulo,operacion,tipo,precio,moneda,barrio,ciudad,provincia,direccion",
  "dormitorios,banos,ambientes,superficie_cubierta,sup_terreno,sup_semicubierta,sup_descubierta,expensas",
  "orientacion,piso,cocheras,baulera,antiguedad",
  "amoblado,acepta_mascotas,apto_credito",
  "com_pileta,com_gimnasio,com_sum,com_ascensor,com_seguridad,com_parrilla,com_quincho,com_solarium,com_laundry,com_cowork,com_juegos_ninos",
  "amb_balcon,amb_terraza,amb_jardin,amb_patio",
  "video_url,tour_virtual_url",
  "agente_nombre,agente_telefono,agente_email",
  "imagenes,descripcion,activa,synced_at",
].join(",");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const fuente = req.nextUrl.searchParams.get("fuente") ?? "";

  if (fuente === "gfi") {
    const { data: rawGfi, error } = await sb
      .from("cartera_propiedades")
      .select(GFI_SELECT)
      .eq("id", id)
      .single();

    if (error || !rawGfi) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const d = rawGfi as any;

    return NextResponse.json({
      id: d.id,
      fuente: "gfi",
      titulo: d.titulo ?? null,
      operacion: d.operacion ?? null,
      tipo: d.tipo ?? null,
      precio: d.precio ?? null,
      precio_anterior: d.precio_anterior ?? null,
      moneda: d.moneda ?? null,
      barrio: d.zona ?? null,
      ciudad: d.ciudad ?? null,
      provincia: "Santa Fe",
      direccion: d.direccion ?? null,
      dormitorios: d.dormitorios ?? null,
      banos: d.banos ?? null,
      ambientes: d.ambientes ?? null,
      superficie_cubierta: d.superficie_cubierta ?? null,
      sup_terreno: d.sup_terreno ?? null,
      sup_semicubierta: d.sup_semicubierta ?? null,
      sup_descubierta: d.sup_descubierta ?? null,
      expensas: d.expensas ?? null,
      orientacion: d.orientacion ?? null,
      piso: d.piso ?? null,
      cocheras: d.estacionamientos ?? null,
      baulera: !!(d.bauleras && d.bauleras > 0),
      antiguedad: d.antiguedad ?? null,
      amoblado: d.amoblado ?? false,
      acepta_mascotas: d.acepta_mascotas ?? false,
      apto_credito: d.apto_credito ?? false,
      com_pileta: d.com_pileta ?? false,
      com_gimnasio: d.com_gimnasio ?? false,
      com_sum: d.com_sum ?? false,
      com_ascensor: d.com_ascensor ?? false,
      com_seguridad: d.com_seguridad ?? false,
      com_parrilla: d.com_parrilla ?? false,
      com_quincho: d.com_quincho ?? false,
      com_solarium: d.com_solarium ?? false,
      com_laundry: d.com_lavanderia ?? false,
      com_cowork: d.com_cowork ?? false,
      com_juegos_ninos: d.com_juegos_infantiles ?? false,
      amb_balcon: d.amb_balcon ?? false,
      amb_terraza: d.amb_terraza ?? false,
      amb_jardin: d.amb_jardin ?? false,
      amb_patio: d.amb_patio ?? false,
      video_url: d.video_url ?? null,
      tour_virtual_url: d.tour_virtual_url ?? null,
      agente_nombre: null,
      agente_telefono: null,
      agente_email: null,
      descripcion: d.descripcion ?? null,
      imagenes: Array.isArray(d.fotos) ? d.fotos : [],
      url: `/crm/cartera/ficha/${id}`,
      datos_raw: d,
    });
  } else {
    const { data: rawExt, error } = await sb
      .from("propiedades_externas")
      .select(EXT_SELECT)
      .eq("id", id)
      .single();

    if (error || !rawExt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const d = rawExt as any;

    let imagenes: string[] = [];
    if (Array.isArray(d.imagenes)) {
      imagenes = d.imagenes as string[];
    } else if (typeof d.imagenes === "string") {
      try { imagenes = JSON.parse(d.imagenes); } catch { imagenes = []; }
    }

    return NextResponse.json({
      id: d.id,
      fuente: fuente || d.portal,
      titulo: d.titulo ?? null,
      operacion: d.operacion ?? null,
      tipo: d.tipo ?? null,
      precio: d.precio ?? null,
      precio_anterior: null,
      moneda: d.moneda ?? null,
      barrio: d.barrio ?? null,
      ciudad: d.ciudad ?? null,
      provincia: d.provincia ?? null,
      direccion: d.direccion ?? null,
      dormitorios: d.dormitorios ?? null,
      banos: d.banos ?? null,
      ambientes: d.ambientes ?? null,
      superficie_cubierta: d.superficie_cubierta ?? null,
      sup_terreno: d.sup_terreno ?? null,
      sup_semicubierta: d.sup_semicubierta ?? null,
      sup_descubierta: d.sup_descubierta ?? null,
      expensas: d.expensas ?? null,
      orientacion: d.orientacion ?? null,
      piso: d.piso ?? null,
      cocheras: d.cocheras ?? null,
      baulera: d.baulera ?? false,
      antiguedad: d.antiguedad ?? null,
      amoblado: d.amoblado ?? false,
      acepta_mascotas: d.acepta_mascotas ?? false,
      apto_credito: d.apto_credito ?? false,
      com_pileta: d.com_pileta ?? false,
      com_gimnasio: d.com_gimnasio ?? false,
      com_sum: d.com_sum ?? false,
      com_ascensor: d.com_ascensor ?? false,
      com_seguridad: d.com_seguridad ?? false,
      com_parrilla: d.com_parrilla ?? false,
      com_quincho: d.com_quincho ?? false,
      com_solarium: d.com_solarium ?? false,
      com_laundry: d.com_laundry ?? false,
      com_cowork: d.com_cowork ?? false,
      com_juegos_ninos: d.com_juegos_ninos ?? false,
      amb_balcon: d.amb_balcon ?? false,
      amb_terraza: d.amb_terraza ?? false,
      amb_jardin: d.amb_jardin ?? false,
      amb_patio: d.amb_patio ?? false,
      video_url: d.video_url ?? null,
      tour_virtual_url: d.tour_virtual_url ?? null,
      agente_nombre: d.agente_nombre ?? null,
      agente_telefono: d.agente_telefono ?? null,
      agente_email: d.agente_email ?? null,
      descripcion: d.descripcion ?? null,
      imagenes,
      url: d.url ?? null,
      datos_raw: d,
    });
  }
}
