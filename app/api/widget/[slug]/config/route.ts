// Config pública del chatbot embebible para un corredor (por slug).
// El widget la pide al cargar para saber color, mensaje de bienvenida, posición
// y si está activo. No expone datos sensibles.
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { corsJson, corsPreflight } from "../../../../lib/cors";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return corsJson({ ok: false, error: "Falta slug" }, { status: 400 });

  const { data: cfg } = await supabase
    .from("web_corredor_config")
    .select("perfil_id, activa, chatbot_activo, chatbot_color, chatbot_bienvenida, chatbot_posicion")
    .eq("slug", slug)
    .maybeSingle();

  // Si la web no está activa o el chatbot está apagado, devolvemos activo:false
  // (el widget no se muestra). No es un error.
  if (!cfg || !cfg.activa || !cfg.chatbot_activo) {
    return corsJson({ ok: true, activo: false });
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, apellido")
    .eq("id", cfg.perfil_id)
    .maybeSingle();

  const nombre = perfil ? `${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim() : "el corredor";

  return corsJson({
    ok: true,
    activo: true,
    nombre,
    color: cfg.chatbot_color || "#6366F1",
    bienvenida: cfg.chatbot_bienvenida || "¡Hola! ¿En qué puedo ayudarte hoy?",
    posicion: cfg.chatbot_posicion === "bl" ? "bl" : "br",
  });
}
