import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../lib/ratelimit";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type TipoContenido = "propiedad" | "mercado" | "consejo" | "personal" | "testimonio";
type Tono = "profesional" | "cercano" | "informal";
type Plataforma = "instagram" | "linkedin" | "whatsapp" | "facebook";

interface RequestBody {
  tipo: TipoContenido;
  propiedad_id?: string;
  tono: Tono;
  plataforma: Plataforma;
  contexto_extra?: string;
}

// ─── Límites de caracteres por plataforma ────────────────────────────────────

const LIMITES: Record<Plataforma, number> = {
  instagram: 2200,
  linkedin: 3000,
  whatsapp: 1000,
  facebook: 63206,
};

const PLATAFORMA_INSTRUCCIONES: Record<Plataforma, string> = {
  instagram:
    "Para Instagram: usá emojis estratégicos, saltos de línea para aerar el texto, un gancho en la primera línea, cerrá con pregunta o CTA. Máximo 2200 caracteres.",
  linkedin:
    "Para LinkedIn: tono profesional con storytelling, sin exceso de emojis (máx 3-4), párrafos cortos, formato de lista cuando corresponda. Máximo 3000 caracteres.",
  whatsapp:
    "Para WhatsApp: mensaje conversacional, directo y breve. Como si se lo mandaras a un contacto de confianza. Máximo 1000 caracteres.",
  facebook:
    "Para Facebook: mezcla de cercanía e información, emojis moderados, texto de largo medio. Incluí un CTA claro al final.",
};

const TONO_INSTRUCCIONES: Record<Tono, string> = {
  profesional:
    "Tono profesional, formal y confiable. Transmitís expertise y seriedad. Sin jerga coloquial.",
  cercano:
    "Tono cercano y cálido, como un amigo de confianza que conoce el mercado. Natural pero informado.",
  informal:
    "Tono informal y descontracturado, como hablaría un corredor joven en Argentina. Podés usar expresiones locales pero siempre respetuoso.",
};

// ─── Generación de prompts por tipo ─────────────────────────────────────────

function buildPrompt(
  tipo: TipoContenido,
  plataforma: Plataforma,
  tono: Tono,
  perfil: Record<string, string | null>,
  propiedad: Record<string, unknown> | null,
  contextoExtra: string
): string {
  const nombreCorredor =
    [perfil.nombre, perfil.apellido].filter(Boolean).join(" ") || "un corredor";
  const inmobiliaria = perfil.inmobiliaria || "una inmobiliaria";
  const zona = perfil.zona_trabajo || "Argentina";
  const especialidades = perfil.especialidades || "compra, venta y alquiler";

  const baseContext = `Sos un experto en marketing inmobiliario digital para el mercado argentino.
Corredor: ${nombreCorredor} — ${inmobiliaria} — Zona: ${zona}
${TONO_INSTRUCCIONES[tono]}
${PLATAFORMA_INSTRUCCIONES[plataforma]}
${contextoExtra ? `Contexto adicional: ${contextoExtra}` : ""}

IMPORTANTE: Respondé SOLO con un JSON válido con esta estructura exacta (sin texto extra fuera del JSON):
{
  "texto_principal": "el post completo listo para publicar",
  "hashtags": ["hashtag1", "hashtag2"],
  "llamada_a_accion": "CTA sugerido",
  "mejor_hora_publicar": "ej: Martes o jueves a las 19-20hs",
  "alternativa": "versión alternativa más corta o con enfoque diferente"
}`;

  if (tipo === "propiedad" && propiedad) {
    const p = propiedad;
    const detalle = [
      `Título: ${p.titulo ?? "Sin título"}`,
      `Operación: ${p.operacion ?? ""}`,
      `Tipo: ${p.tipo ?? ""}`,
      `Precio: ${p.moneda ?? "USD"} ${p.precio ? Number(p.precio).toLocaleString("es-AR") : "A consultar"}`,
      `Ubicación: ${[p.zona, p.barrio, p.ciudad].filter(Boolean).join(", ") || "Sin especificar"}`,
      p.dormitorios ? `Dormitorios: ${p.dormitorios}` : null,
      p.banos ? `Baños: ${p.banos}` : null,
      p.superficie_cubierta ? `Sup. cubierta: ${p.superficie_cubierta}m²` : null,
      p.superficie_total ? `Sup. total: ${p.superficie_total}m²` : null,
      p.antiguedad ? `Antigüedad: ${p.antiguedad}` : null,
      p.descripcion ? `Descripción: ${String(p.descripcion).slice(0, 400)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return `${baseContext}

Generá un post para vender/alquilar esta propiedad inmobiliaria argentina.
Usá lenguaje emotivo y destacá los puntos fuertes de la propiedad.

PROPIEDAD:
${detalle}`;
  }

  if (tipo === "mercado") {
    return `${baseContext}

Generá contenido educativo/informativo sobre el mercado inmobiliario argentino actual (año 2026).
Temas posibles: tendencias de precios, impacto del blanqueo, diferencias regionales,
momento para comprar vs. alquilar, evolución del dólar MEP, oportunidades en pozo,
el mercado de alquileres post-ley, nuevos desarrollos, etc.
El corredor es especialista en: ${especialidades}, zona: ${zona}`;
  }

  if (tipo === "consejo") {
    return `${baseContext}

Generá un post con consejos prácticos sobre el mercado inmobiliario argentino.
Orientalo a compradores, vendedores o inquilinos según lo que sea más útil.
Consejos prácticos y accionables del corredor ${nombreCorredor}.
Zona de trabajo: ${zona}`;
  }

  if (tipo === "personal") {
    return `${baseContext}

Generá contenido de marca personal para el corredor inmobiliario ${nombreCorredor}.
Puede ser sobre un logro reciente, su trayectoria, su filosofía de trabajo,
una anécdota del mercado, por qué eligió esta profesión, etc.
Inmobiliaria: ${inmobiliaria}, Especialidades: ${especialidades}
Hacelo auténtico y humano, que conecte emocionalmente con la audiencia.`;
  }

  if (tipo === "testimonio") {
    return `${baseContext}

Generá un post que comparta un testimonio o caso de éxito de un cliente del corredor ${nombreCorredor}.
Protegé la privacidad (no uses nombres reales, solo "mi cliente", "una familia", "una pareja", etc.).
Mostrá el problema que tenían, el proceso vivido y el resultado exitoso.
Zona de trabajo: ${zona}`;
  }

  return baseContext;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const {
      data: { user },
    } = await sb.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (!rateLimit(`ia-contenido-rrss:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Demasiadas consultas. Esperá un momento." },
        { status: 429 }
      );
    }

    // Resolver efectivoId (colaboradores)
    let efectivoId = user.id;
    let { data: perfil } = await sb
      .from("perfiles")
      .select("id, nombre, apellido, inmobiliaria, especialidades, zona_trabajo, matricula, tipo")
      .eq("id", user.id)
      .single();

    if (perfil?.tipo === "colaborador") {
      const { data: colab } = await sb
        .from("colaboradores")
        .select("corredor_id")
        .eq("user_id", user.id)
        .single();
      if (colab?.corredor_id) {
        efectivoId = colab.corredor_id;
        const { data: perfilCorredor } = await sb
          .from("perfiles")
          .select("id, nombre, apellido, inmobiliaria, especialidades, zona_trabajo, matricula")
          .eq("id", efectivoId)
          .single();
        if (perfilCorredor) perfil = { ...perfil, ...perfilCorredor };
      }
    }

    // Body
    const body = (await req.json()) as RequestBody;
    const { tipo, propiedad_id, tono, plataforma, contexto_extra = "" } = body;

    if (!tipo || !tono || !plataforma) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: tipo, tono y plataforma" },
        { status: 400 }
      );
    }

    // Propiedad (si aplica)
    let propiedad: Record<string, unknown> | null = null;
    if (tipo === "propiedad") {
      if (!propiedad_id) {
        return NextResponse.json(
          { error: "propiedad_id requerido para tipo 'propiedad'" },
          { status: 400 }
        );
      }
      const { data: prop } = await sb
        .from("cartera_propiedades")
        .select(
          "id, titulo, operacion, tipo, precio, moneda, ciudad, zona, barrio, dormitorios, banos, superficie_cubierta, superficie_total, antiguedad, descripcion"
        )
        .eq("id", propiedad_id)
        .eq("perfil_id", efectivoId)
        .single();

      if (!prop) {
        return NextResponse.json(
          { error: "Propiedad no encontrada o no pertenece a tu cartera" },
          { status: 404 }
        );
      }
      propiedad = prop as Record<string, unknown>;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Sin ANTHROPIC_API_KEY configurada" }, { status: 500 });
    }

    const prompt = buildPrompt(
      tipo,
      plataforma,
      tono,
      (perfil ?? {}) as Record<string, string | null>,
      propiedad,
      contexto_extra
    );

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      (message.content[0] as { type: string; text?: string })?.text ?? "{}";

    // Extraer JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Respuesta inválida de la IA. Intentá de nuevo." },
        { status: 500 }
      );
    }

    let parsed: {
      texto_principal?: string;
      hashtags?: string[];
      llamada_a_accion?: string;
      mejor_hora_publicar?: string;
      alternativa?: string;
    };

    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "Error al procesar la respuesta de IA. Intentá de nuevo." },
        { status: 500 }
      );
    }

    // Normalizar hashtags
    const hashtags = (parsed.hashtags ?? []).map((h: string) =>
      h.startsWith("#") ? h : `#${h}`
    );

    return NextResponse.json({
      ok: true,
      texto_principal: parsed.texto_principal ?? "",
      hashtags,
      llamada_a_accion: parsed.llamada_a_accion ?? "",
      mejor_hora_publicar: parsed.mejor_hora_publicar ?? "",
      alternativa: parsed.alternativa ?? "",
      limite_caracteres: LIMITES[plataforma],
      caracteres_usados: (parsed.texto_principal ?? "").length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("ia-contenido-rrss error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
