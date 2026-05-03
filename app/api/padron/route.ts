import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verifica que el usuario esté autenticado antes de devolver datos
async function getAuthUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

async function cargarTodo(tabla: string, columnas: string, orden: string) {
  const CHUNK = 1000
  let todos: any[] = []
  let desde = 0
  while (true) {
    const { data, error } = await supabaseAdmin
      .from(tabla)
      .select(columnas)
      .order(orden, { ascending: true })
      .range(desde, desde + CHUNK - 1)
    if (error) return { data: [], error: error.message }
    if (!data || data.length === 0) break
    todos = todos.concat(data)
    if (data.length < CHUNK) break
    desde += CHUNK
  }
  return { data: todos, error: null }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const [cocirRes, gfiRes] = await Promise.all([
    cargarTodo(
      "cocir_padron",
      "id,matricula,apellido,nombre,inmobiliaria,direccion,localidad,telefono,email,estado,actualizado_at",
      "apellido"
    ),
    cargarTodo(
      "perfiles",
      "id,nombre,apellido,matricula,telefono,email,inmobiliaria,especialidades,foto_url,zona_trabajo,anos_experiencia,bio,socio_cir,tipo,estado,created_at",
      "apellido"
    ),
  ])

  return NextResponse.json({
    cocir: cocirRes.data,
    gfi: gfiRes.data,
    errores: {
      cocir: cocirRes.error,
      gfi: gfiRes.error,
    },
  })
}
