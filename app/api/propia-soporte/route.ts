// Tabla requerida en Supabase:
//
// CREATE TABLE IF NOT EXISTS propia_reportes (
//   id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   created_at   TIMESTAMPTZ DEFAULT NOW(),
//   updated_at   TIMESTAMPTZ DEFAULT NOW(),
//   perfil_id    UUID REFERENCES perfiles(id) ON DELETE CASCADE,
//   nombre       TEXT NOT NULL,
//   email        TEXT NOT NULL,
//   matricula    TEXT,
//   tipo         TEXT NOT NULL,
//   urgencia     TEXT NOT NULL DEFAULT 'media',
//   descripcion  TEXT NOT NULL,
//   estado       TEXT NOT NULL DEFAULT 'pendiente',
//   notas_admin  TEXT
// );
// ALTER TABLE propia_reportes ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "perfil puede ver sus reportes" ON propia_reportes FOR SELECT USING (auth.uid() = perfil_id);
// CREATE POLICY "perfil puede insertar" ON propia_reportes FOR INSERT WITH CHECK (auth.uid() = perfil_id);

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb.auth.getUser(token);
  return user ?? null;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await sb.from("perfiles").select("tipo").eq("id", userId).single();
  return data?.tipo === "admin" || data?.tipo === "master";
}

// ── GET: listar reportes ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = await isAdmin(user.id);
  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");
  const urgencia = url.searchParams.get("urgencia");

  let query = sb
    .from("propia_reportes")
    .select("*")
    .order("created_at", { ascending: false });

  if (!admin) {
    query = query.eq("perfil_id", user.id);
  }
  if (estado) query = query.eq("estado", estado);
  if (urgencia) query = query.eq("urgencia", urgencia);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reportes: data ?? [], isAdmin: admin });
}

// ── POST: crear reporte ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { tipo, urgencia, descripcion } = body;

  if (!tipo || !urgencia || !descripcion?.trim()) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  if (descripcion.trim().length < 20) {
    return NextResponse.json({ error: "La descripción debe tener al menos 20 caracteres" }, { status: 400 });
  }

  // Obtener datos del perfil para incluir en el reporte
  const { data: perfil } = await sb
    .from("perfiles")
    .select("nombre, apellido, matricula")
    .eq("id", user.id)
    .single();

  const { data, error } = await sb.from("propia_reportes").insert({
    perfil_id: user.id,
    nombre: `${perfil?.nombre ?? ""} ${perfil?.apellido ?? ""}`.trim() || "Sin nombre",
    email: user.email ?? "",
    matricula: perfil?.matricula ?? null,
    tipo,
    urgencia,
    descripcion: descripcion.trim(),
    estado: "pendiente",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reporte: data }, { status: 201 });
}

// ── PATCH: actualizar estado / notas (solo admin) ─────────────────────────────
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = await isAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const body = await req.json();
  const { id, estado, notas_admin } = body;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (estado) updates.estado = estado;
  if (notas_admin !== undefined) updates.notas_admin = notas_admin;

  const { data, error } = await sb
    .from("propia_reportes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reporte: data });
}
