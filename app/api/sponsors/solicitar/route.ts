import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { empresa, rubro, descripcion, contacto_nombre, contacto_email, contacto_telefono, sitio_web, mensaje } = body;

    if (!empresa?.trim() || !rubro?.trim() || !contacto_nombre?.trim() || !contacto_email?.trim()) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contacto_email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("sponsor_solicitudes").insert({
      empresa: empresa.trim(),
      rubro: rubro.trim(),
      descripcion: descripcion?.trim() || null,
      contacto_nombre: contacto_nombre.trim(),
      contacto_email: contacto_email.trim().toLowerCase(),
      contacto_telefono: contacto_telefono?.trim() || null,
      sitio_web: sitio_web?.trim() || null,
      mensaje: mensaje?.trim() || null,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error interno" }, { status: 500 });
  }
}
