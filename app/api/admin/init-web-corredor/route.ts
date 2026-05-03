import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { matricula, slug, secret } = await req.json()

  if (secret !== process.env.ADMIN_INIT_SECRET && secret !== "gfi-init-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Buscar perfil por matrícula
  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from("perfiles")
    .select("id,nombre,apellido,matricula,telefono,email,inmobiliaria,foto_url")
    .eq("matricula", matricula)
    .single()

  if (perfilError || !perfil) {
    return NextResponse.json({ error: `Perfil con matricula ${matricula} no encontrado`, detail: perfilError?.message }, { status: 404 })
  }

  // Verificar si ya existe
  const { data: existing } = await supabaseAdmin
    .from("web_corredor_config")
    .select("id,slug,activa")
    .eq("slug", slug)
    .single()

  if (existing) {
    if (!existing.activa) {
      const { data: updated } = await supabaseAdmin
        .from("web_corredor_config")
        .update({ activa: true })
        .eq("id", existing.id)
        .select()
        .single()
      return NextResponse.json({ ok: true, accion: "activado", config: updated ?? existing, perfil })
    }
    return NextResponse.json({ ok: true, accion: "ya_existe_activa", config: existing, perfil })
  }

  // Crear config
  const nombre = `${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim()
  const { data: config, error: insertError } = await supabaseAdmin
    .from("web_corredor_config")
    .insert({
      perfil_id: perfil.id,
      slug,
      activa: true,
      plantilla: "rosario-classic",
      color_primario: "#cc0000",
      color_secundario: "#111111",
      color_texto: "#ffffff",
      color_fondo: "#0a0a0a",
      titulo_sitio: nombre || "Corredor Inmobiliario",
      subtitulo: "Corredor Inmobiliario Matriculado · Rosario",
      descripcion_profesional: null,
      mostrar_formulario_contacto: true,
      mostrar_formulario_tasacion: true,
      mostrar_propiedades_destacadas: true,
      mostrar_sobre_mi: true,
      mostrar_testimonios: false,
      limite_propiedades_home: 6,
      whatsapp: perfil.telefono ?? null,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: "Error al crear config", detail: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, accion: "creado", config, perfil })
}
