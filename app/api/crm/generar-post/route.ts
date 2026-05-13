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

  const { propiedad_id, red } = await req.json();
  if (!propiedad_id || !["instagram", "whatsapp", "ambos"].includes(red)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const { data: prop } = await sb
    .from("cartera_propiedades")
    .select("titulo, descripcion, operacion, tipo, precio, moneda, ciudad, zona, direccion, dormitorios, banos, superficie_cubierta, superficie_total, cocheras, ambientes, antiguedad, amenities, perfil_id")
    .eq("id", propiedad_id)
    .single();

  if (!prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (prop.perfil_id !== user.id) {
    const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
    if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const fmtPrecio = prop.precio
    ? `${prop.moneda === "USD" ? "USD" : "$"} ${prop.precio.toLocaleString("es-AR")}`
    : "A consultar";

  const specs = [
    prop.superficie_cubierta && `${prop.superficie_cubierta}m² cubiertos`,
    prop.superficie_total && prop.superficie_total !== prop.superficie_cubierta && `${prop.superficie_total}m² totales`,
    prop.ambientes && `${prop.ambientes} ambientes`,
    prop.dormitorios && `${prop.dormitorios} dormitorios`,
    prop.banos && `${prop.banos} baños`,
    prop.cocheras && `${prop.cocheras} cochera${prop.cocheras > 1 ? "s" : ""}`,
    prop.antiguedad === 0 ? "a estrenar" : prop.antiguedad && `${prop.antiguedad} años`,
  ].filter(Boolean).join(", ");

  const amenities = Array.isArray(prop.amenities) && prop.amenities.length
    ? `Amenities: ${(prop.amenities as string[]).join(", ")}`
    : "";

  const resumen = `
Operación: ${prop.operacion} | Tipo: ${prop.tipo}
Precio: ${fmtPrecio}
Ubicación: ${[prop.direccion, prop.zona, prop.ciudad].filter(Boolean).join(", ")}
Características: ${specs || "sin datos"}
${amenities}
Descripción: ${prop.descripcion ?? ""}
`.trim();

  const sistemPrompt = `Sos un experto en marketing inmobiliario argentino. Redactás posts atractivos para redes sociales de corredores matriculados en Rosario, Argentina. Usás lenguaje cercano, profesional y persuasivo en español rioplatense. Nunca inventás información que no esté en los datos.`;

  const generar = async (tipo: "instagram" | "whatsapp") => {
    const instruccion = tipo === "instagram"
      ? `Generá un post para Instagram con:
- Gancho emotivo en la primera línea (máx 20 palabras)
- Descripción de la propiedad en 3-4 líneas con datos clave
- Call to action para contactar
- 8-12 hashtags relevantes (sector, zona, tipo)
- Máximo 200 palabras en total
- Usá emojis con moderación (2-4 en total)`
      : `Generá un mensaje para compartir por WhatsApp con:
- Saludo informal y directo
- Datos clave de la propiedad (precio, ubicación, características principales)
- Propuesta de valor en 1 línea
- CTA para agendar visita o pedir más info
- Sin hashtags
- Máximo 120 palabras
- Tono conversacional y directo`;

    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: sistemPrompt,
      messages: [{
        role: "user",
        content: `${instruccion}\n\nDatos de la propiedad:\n${resumen}\n\nGenerá SOLO el texto del post, sin explicaciones ni títulos adicionales.`,
      }],
    });
    return resp.content[0].type === "text" ? resp.content[0].text.trim() : "";
  };

  if (red === "ambos") {
    const [instagram, whatsapp] = await Promise.all([generar("instagram"), generar("whatsapp")]);
    return NextResponse.json({ ok: true, instagram, whatsapp });
  }

  const texto = await generar(red as "instagram" | "whatsapp");
  return NextResponse.json({ ok: true, [red]: texto });
}
