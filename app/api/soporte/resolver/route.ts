import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  ).auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { ticket_id } = await req.json();
  if (!ticket_id) return NextResponse.json({ error: "Falta ticket_id" }, { status: 400 });

  const { data: ticket } = await sb
    .from("soporte_tickets")
    .select("asunto, descripcion, prioridad, perfiles(nombre, apellido, matricula)")
    .eq("id", ticket_id)
    .single();

  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  const usuario = ticket.perfiles as { nombre: string; apellido: string; matricula: string | null } | null;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    system: `Sos el asistente de soporte técnico de GFI® (Grupo Foro Inmobiliario), plataforma privada para corredores inmobiliarios matriculados en COCIR (Rosario, Argentina).
La plataforma incluye: Dashboard, MIR, Red GFI, CRM, Comunidad, Foro, Eventos, Networking, Canal del Foro, Noticias, Emprendimientos, Calculadoras, Comparables, Padrón GFI, Biblioteca, Cotizaciones, Proveedores, Beneficios, Mi Perfil, Mi Web, Tasaciones IA, Contratos IA, Agenda, Referidos, Notificaciones.
Generá una respuesta clara, amable y profesional en español argentino para el ticket de soporte. La respuesta debe:
- Ser concisa (máximo 4 párrafos)
- Incluir pasos concretos si es un problema técnico
- Sugerir si el usuario debe contactar al admin directamente si el problema no puede resolverse vía plataforma
- Usar tono cálido pero profesional`,
    messages: [
      {
        role: "user",
        content: `Ticket de soporte de ${usuario ? `${usuario.nombre} ${usuario.apellido} (Mat. ${usuario.matricula ?? "sin matrícula"})` : "usuario"}:

Asunto: ${ticket.asunto}
Prioridad: ${ticket.prioridad}

Descripción:
${ticket.descripcion}

Generá una respuesta de soporte para este ticket.`,
      },
    ],
  });

  const respuestaIA = response.content[0].type === "text" ? response.content[0].text : "";

  // Guardar respuesta IA en el ticket
  await sb
    .from("soporte_tickets")
    .update({ respuesta_ia: respuestaIA })
    .eq("id", ticket_id);

  return NextResponse.json({ ok: true, respuesta: respuestaIA });
}
