import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "../../../../lib/whatsapp";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — admin envía un mensaje WA a un número específico
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { to, body } = await req.json();
  if (!to || !body) return NextResponse.json({ error: "to y body son requeridos" }, { status: 400 });

  // Normalizar número (quitar espacios, +, guiones)
  const numero = to.replace(/[\s+\-()]/g, "");
  if (!/^\d{10,15}$/.test(numero)) {
    return NextResponse.json({ error: "Número inválido (10-15 dígitos con código de país)" }, { status: 400 });
  }

  const ok = await sendWhatsAppMessage(numero, body);
  if (!ok) {
    return NextResponse.json({
      error: "No se pudo enviar. Verificá que WHATSAPP_PHONE_ID y WHATSAPP_ACCESS_TOKEN estén configurados.",
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
