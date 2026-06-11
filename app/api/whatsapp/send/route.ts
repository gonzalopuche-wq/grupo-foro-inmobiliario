import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessageDetailed } from "../../../../lib/whatsapp";

export const dynamic = "force-dynamic";

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

  const r = await sendWhatsAppMessageDetailed(numero, body);
  if (!r.ok) {
    return NextResponse.json({
      error: r.error ?? "No se pudo enviar.",
      code: r.code,
    }, { status: 502 });
  }

  // Meta aceptó el mensaje (200). Que lo ACEPTE no garantiza que LLEGUE: fuera de la
  // ventana de 24h o en modo prueba con número no permitido, no se entrega.
  return NextResponse.json({
    ok: true,
    id: r.id,
    aviso: "Meta aceptó el mensaje. Si no llega, suele ser por la ventana de 24h: el destinatario tiene que haberte escrito a vos en las últimas 24h, o necesitás una plantilla aprobada. En modo prueba, el número debe estar en la lista de destinatarios permitidos de Meta.",
  });
}
