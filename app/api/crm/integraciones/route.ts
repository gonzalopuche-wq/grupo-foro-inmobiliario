import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return null;
  const { data: { user } } = await sb.auth.getUser(jwt);
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const exportar = req.nextUrl.searchParams.get("export");

  if (exportar === "contactos") {
    const { data, error } = await sb
      .from("crm_contactos")
      .select("nombre,apellido,email,telefono,estado,interes,zona_interes,presupuesto_min,presupuesto_max,moneda,notas,created_at")
      .eq("perfil_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (exportar === "propiedades") {
    const { data, error } = await sb
      .from("cartera_propiedades")
      .select("codigo,titulo,tipo,operacion,precio,moneda,direccion,zona,ciudad,dormitorios,banos,ambientes,superficie_cubierta,superficie_total,estado,created_at")
      .eq("perfil_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (exportar === "negocios") {
    const { data, error } = await sb
      .from("crm_negocios")
      .select("titulo,etapa,tipo,monto,moneda,fecha_cierre_estimada,honorario_estimado,honorario_cobrado,notas,created_at")
      .eq("perfil_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  const [logs, configs] = await Promise.all([
    sb.from("crm_integraciones_log").select("*").eq("perfil_id", user.id).order("created_at", { ascending: false }).limit(50),
    sb.from("crm_integraciones_config").select("tipo,activo,ultima_sincronizacion,created_at").eq("perfil_id", user.id),
  ]);
  return NextResponse.json({ logs: logs.data ?? [], configs: configs.data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { accion } = body;

  if (accion === "guardar_config") {
    const { tipo, config } = body as { tipo: string; config: Record<string, unknown> };
    const { error } = await sb.from("crm_integraciones_config").upsert(
      { perfil_id: user.id, tipo, config, activo: true },
      { onConflict: "perfil_id,tipo" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (accion === "update_sync") {
    const { tipo } = body as { tipo: string };
    await sb.from("crm_integraciones_config").update({ ultima_sincronizacion: new Date().toISOString() })
      .eq("perfil_id", user.id).eq("tipo", tipo);
    return NextResponse.json({ ok: true });
  }

  if (accion === "importar_contactos") {
    const { contactos, fuente } = body as { contactos: Record<string, string>[]; fuente: string };
    let ok = 0, err = 0;
    for (const c of contactos) {
      const { error } = await sb.from("crm_contactos").insert({
        perfil_id: user.id,
        nombre:    c.nombre?.trim() || "Sin nombre",
        apellido:  c.apellido?.trim() || null,
        email:     c.email?.trim() || null,
        telefono:  c.telefono?.trim() || null,
        notas:     c.notas?.trim() || null,
        estado:    "prospecto",
        fuente:    fuente || "csv_import",
      });
      if (error) err++; else ok++;
    }
    await sb.from("crm_integraciones_log").insert({
      perfil_id: user.id,
      tipo: fuente === "tokko" ? "tokko_contactos" : "csv_contactos",
      estado: "completado", filas_importadas: ok, filas_error: err,
      detalle: { total: contactos.length },
    });
    return NextResponse.json({ ok: true, importados: ok, errores: err });
  }

  if (accion === "importar_propiedades") {
    const { propiedades, fuente } = body as { propiedades: Record<string, string>[]; fuente: string };
    let ok = 0, err = 0;
    for (const p of propiedades) {
      const precio = p.precio ? parseFloat(String(p.precio).replace(/[^0-9.]/g, "")) : null;
      const { error } = await sb.from("cartera_propiedades").insert({
        perfil_id:           user.id,
        titulo:              p.titulo || p.direccion || "Propiedad importada",
        tipo:                p.tipo || "Otro",
        operacion:           p.operacion || "Venta",
        precio:              isNaN(precio!) ? null : precio,
        moneda:              p.moneda || "USD",
        direccion:           p.direccion || null,
        zona:                p.zona || null,
        ciudad:              p.ciudad || null,
        dormitorios:         p.dormitorios ? parseInt(p.dormitorios) : null,
        banos:               p.banos ? parseInt(p.banos) : null,
        superficie_cubierta: p.superficie_cubierta ? parseFloat(p.superficie_cubierta) : null,
        superficie_total:    p.superficie_total ? parseFloat(p.superficie_total) : null,
        descripcion:         p.descripcion || null,
        estado:              "activa",
        codigo:              p.codigo || null,
        url_portal_origen:   fuente === "tokko" ? `tokko:${p.codigo || ""}` : null,
      });
      if (error) err++; else ok++;
    }
    await sb.from("crm_integraciones_log").insert({
      perfil_id: user.id,
      tipo: fuente === "tokko" ? "tokko_propiedades" : "csv_propiedades",
      estado: "completado", filas_importadas: ok, filas_error: err,
      detalle: { total: propiedades.length },
    });
    return NextResponse.json({ ok: true, importados: ok, errores: err });
  }

  if (accion === "log") {
    const { tipo, estado, filas_importadas, filas_error, detalle } = body;
    await sb.from("crm_integraciones_log").insert({ perfil_id: user.id, tipo, estado, filas_importadas, filas_error, detalle });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
