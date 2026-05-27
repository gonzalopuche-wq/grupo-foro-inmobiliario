import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import {
  verifyMetaSignature,
  inferGrupoGfi,
  sendWhatsAppMessage,
  runSmartProspecting,
  detectarRubroProveedor,
  GRUPOS_MIR,
  SUBTIPO,
  OPERACION_GRUPO,
  OPERACION_BUSQUEDA,
} from "../../../../lib/whatsapp";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── GET — verificación del webhook Meta ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── POST — recepción de mensajes ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";

  if (!verifyMetaSignature(rawBody, sigHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  // Meta espera 200 rápido — procesamos en background
  processMessages(payload).catch(console.error);

  return NextResponse.json({ ok: true });
}

// ── Procesamiento de mensajes ─────────────────────────────────────────────────
async function processMessages(payload: any) {
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change.field !== "messages") continue;
      const value    = change.value ?? {};
      const messages = value.messages ?? [];
      const contacts = value.contacts ?? [];

      for (const msg of messages) {
        // Solo mensajes de texto por ahora
        if (msg.type !== "text") continue;

        const waMessageId = msg.id as string;
        const from        = msg.from as string;
        const texto       = (msg.text?.body ?? "") as string;
        const nombre      = contacts.find((c: any) => c.wa_id === from)?.profile?.name ?? null;

        // Deduplicar
        const { data: dup } = await sb
          .from("whatsapp_mensajes")
          .select("id")
          .eq("wa_message_id", waMessageId)
          .maybeSingle();
        if (dup) continue;

        // Buscar corredor GFI por número de WA
        const { data: perfil } = await sb
          .from("perfiles")
          .select("id, nombre, apellido")
          .eq("whatsapp_negocio", from)
          .maybeSingle();
        const perfilId = perfil?.id ?? null;

        // Inferir grupo
        const grupoGfi = inferGrupoGfi(texto);

        // Guardar mensaje
        const { data: waMsg } = await sb
          .from("whatsapp_mensajes")
          .insert({
            wa_message_id: waMessageId,
            numero_from:   from,
            nombre_from:   nombre,
            perfil_id:     perfilId,
            contenido:     texto,
            grupo_gfi:     grupoGfi,
          })
          .select("id")
          .single();

        if (!waMsg) continue;

        // Si no hay corredor GFI registrado → pedir que vincule su número
        if (!perfilId) {
          await sendWhatsAppMessage(
            from,
            "Hola! Tu número no está vinculado a ninguna cuenta en GFI®.\n\n" +
            "Para cargar propiedades automáticamente, ingresá a tu perfil en GFI® y agregá este número en el campo «WhatsApp Negocio».\n\n" +
            "🌐 gfi.com.ar"
          );
          continue;
        }

        // Solicitud de proveedor → match en red_proveedores
        if (grupoGfi === "solicitud-proveedor") {
          await handleSolicitudProveedor(from, texto, sb);
          await sb.from("whatsapp_mensajes").update({ procesado: true, mir_tabla: "solicitud_proveedor" }).eq("id", waMsg.id);
          continue;
        }

        // Recomendación de proveedor → guardar en red_proveedores
        if (grupoGfi === "recomendacion-proveedor") {
          await handleRecomendacionProveedor(texto, perfilId, waMsg.id, sb);
          continue;
        }

        // Contenido profesional (plantillas, cláusulas) → Foro GFI
        if (grupoGfi === "foro-consultas" && perfilId) {
          await handleForoConocimiento(texto, perfilId, waMsg.id, sb);
          continue;
        }

        // Si el grupo no tiene parser MIR → solo guardar
        if (!GRUPOS_MIR.has(grupoGfi)) {
          await sendWhatsAppMessage(
            from,
            "✅ Tu mensaje fue recibido por GFI®. Para publicar en el MIR, escribí el texto de tu propiedad o búsqueda directamente (comenzá con «Vendo», «Alquilo», «Busco», etc.)."
          );
          continue;
        }

        // Parsear con IA
        try {
          const result = await parseMirMessage(texto, grupoGfi, perfilId, waMsg.id);

          if (result.cargado) {
            await sb.from("whatsapp_mensajes").update({
              procesado:   true,
              mir_entry_id: result.mir_id,
              mir_tabla:    result.tabla,
            }).eq("id", waMsg.id);

            const tipo = result.tipo === "ofrecido" ? "propiedad" : "búsqueda";
            await sendWhatsAppMessage(
              from,
              `✅ Tu ${tipo} fue cargada al MIR de GFI® automáticamente.\n\nPodés verla en gfi.com.ar/mir`
            );

            // Smart Prospecting: si es ofrecido, notificar corredores con búsquedas compatibles
            if (result.tipo === "ofrecido" && result.mir_id) {
              await runSmartProspecting(result.mir_id);
            }
          } else {
            await sb.from("whatsapp_mensajes").update({
              procesado:    true,
              error_detalle: result.motivo ?? "no_es_operacion",
            }).eq("id", waMsg.id);

            if (result.motivo !== "no_es_operacion") {
              await sendWhatsAppMessage(
                from,
                "⚠️ No pude interpretar tu mensaje como propiedad o búsqueda. " +
                "Intentá con más detalle (tipo, zona, precio, dormitorios)."
              );
            }
          }
        } catch (err) {
          await sb.from("whatsapp_mensajes").update({
            procesado:    true,
            error_detalle: String(err),
          }).eq("id", waMsg.id);
        }
      }
    }
  }
}

// ── Parser MIR inline ─────────────────────────────────────────────────────────
async function parseMirMessage(
  texto: string,
  grupoId: string,
  userId: string,
  mensajeId: string
): Promise<{ cargado: boolean; motivo?: string; tipo?: string; tabla?: string; mir_id?: string }> {
  const tipoOp    = OPERACION_GRUPO[grupoId] ?? "venta";
  const esOfrecido = (SUBTIPO[grupoId] ?? "ofrecido") === "ofrecido";

  const promptBase = `Sos un parser de mensajes inmobiliarios de Rosario, Argentina (2da Circ. COCIR).
${esOfrecido ? "Este mensaje es de OFRECIDOS — propiedad disponible." : "Este mensaje es de BÚSQUEDAS — corredor busca para cliente."}

MENSAJE: "${texto}"

Abreviaturas: dorm=dormitorios, sup/m2=superficie, UDS/USD/U$S=dólares, $=pesos ARS, pb=planta baja, dpto=departamento.
Ciudades: Rosario, Funes, Roldán, Granadero Baigorria, Pérez, San Lorenzo, Capitán Bermúdez, Arroyo Seco.

Respondé SOLO con JSON válido (sin texto extra):`;

  const promptOfrecido = promptBase + `
Si ES propiedad:
{"es_operacion":true,"tipo_propiedad":"departamento|casa|local|terreno|campo|garage|cochera|oficina|ph|otro","operacion":"venta|alquiler|alquiler_temporario|permuta","dormitorios":num|null,"banos":num|null,"zona":str|null,"ciudad":str,"precio":num|null,"moneda":"USD|ARS"|null,"superficie_total":num|null,"superficie_cubierta":num|null,"apto_credito":bool,"con_cochera":bool,"descripcion_corta":str}
Si NO es propiedad: {"es_operacion":false}`;

  const promptBusqueda = promptBase + `
Si ES búsqueda:
{"es_operacion":true,"tipo_propiedad":"departamento|casa|local|terreno|campo|garage|cochera|oficina|ph|otro","operacion":"venta|alquiler|alquiler_temporario|permuta","dormitorios_min":num|null,"dormitorios_max":num|null,"banos_min":num|null,"zona":str|null,"ciudad":str,"presupuesto_min":num|null,"presupuesto_max":num|null,"moneda":"USD|ARS"|null,"superficie_min":num|null,"apto_credito":bool,"con_cochera":bool,"descripcion_corta":str}
Si NO es búsqueda: {"es_operacion":false}`;

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages:   [{ role: "user", content: esOfrecido ? promptOfrecido : promptBusqueda }],
  });

  const raw   = response.content[0].type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) return { cargado: false, motivo: "parse_error" };

  let parsed: any;
  try { parsed = JSON.parse(match[0]); }
  catch { return { cargado: false, motivo: "parse_error" }; }

  if (!parsed.es_operacion) return { cargado: false, motivo: "no_es_operacion" };

  let payload: Record<string, unknown>;
  let tabla: string;

  if (esOfrecido) {
    tabla   = "mir_ofrecidos";
    payload = {
      perfil_id:           userId,
      operacion:           parsed.operacion ?? tipoOp,
      tipo_propiedad:      parsed.tipo_propiedad ?? "otro",
      zona:                parsed.zona ?? null,
      ciudad:              parsed.ciudad ?? "Rosario",
      precio:              parsed.precio ?? null,
      moneda:              parsed.moneda ?? null,
      dormitorios:         parsed.dormitorios ?? null,
      banos:               parsed.banos ?? null,
      superficie_total:    parsed.superficie_total ?? null,
      superficie_cubierta: parsed.superficie_cubierta ?? null,
      apto_credito:        parsed.apto_credito ?? false,
      con_cochera:         parsed.con_cochera ?? false,
      descripcion:         texto,
      activo:              true,
      fuente:              "whatsapp",
    };
  } else {
    tabla   = "mir_busquedas";
    const opB = OPERACION_BUSQUEDA[parsed.operacion ?? tipoOp] ?? parsed.operacion ?? tipoOp;
    payload = {
      perfil_id:       userId,
      operacion:       opB,
      tipo_propiedad:  parsed.tipo_propiedad ?? "otro",
      zona:            parsed.zona ?? null,
      ciudad:          parsed.ciudad ?? "Rosario",
      presupuesto_min: parsed.presupuesto_min ?? null,
      presupuesto_max: parsed.presupuesto_max ?? null,
      moneda:          parsed.moneda ?? null,
      dormitorios_min: parsed.dormitorios_min ?? null,
      dormitorios_max: parsed.dormitorios_max ?? null,
      banos_min:       parsed.banos_min ?? null,
      superficie_min:  parsed.superficie_min ?? null,
      apto_credito:    parsed.apto_credito ?? false,
      con_cochera:     parsed.con_cochera ?? false,
      descripcion:     texto,
      activo:          true,
      fuente:          "whatsapp",
    };
  }

  const { data: entry, error } = await sb.from(tabla).insert(payload).select("id").single();
  if (error || !entry) return { cargado: false, motivo: error?.message ?? "db_error" };

  // Vincular con el mensaje WA en mensajes_chat (si existe la tabla)
  await sb.from("mensajes_chat").update({
    tipo:     esOfrecido ? "ofrecido" : "busqueda",
    mir_id:   entry.id,
    mir_tipo: esOfrecido ? "ofrecido" : "busqueda",
  }).eq("id", mensajeId).maybeSingle();

  return {
    cargado: true,
    tipo:    esOfrecido ? "ofrecido" : "busqueda",
    tabla,
    mir_id:  entry.id,
  };
}

// ── Match de proveedores ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSolicitudProveedor(from: string, texto: string, sb: any) {
  const rubro = detectarRubroProveedor(texto);
  if (!rubro) {
    await sendWhatsAppMessage(from, "🔍 No identifiqué el tipo de proveedor. Visitá gfi.com.ar/proveedores para ver todos.");
    return;
  }

  const { data: proveedores } = await sb
    .from("red_proveedores")
    .select("nombre, rubro, telefono, zona, notas")
    .ilike("rubro", `%${rubro.split(" ")[0].toLowerCase()}%`)
    .eq("activo", true)
    .limit(5);

  if (!proveedores || proveedores.length === 0) {
    await sendWhatsAppMessage(
      from,
      `🔍 No encontré ${rubro.toLowerCase()}s en la Red GFI todavía.\n\n¿Conocés uno? Podés cargarlo en gfi.com.ar/proveedores y ayudar a toda la comunidad.`
    );
    return;
  }

  const lista = (proveedores as any[]).map(p =>
    `• *${p.nombre}* (${p.rubro})${p.zona ? ` — ${p.zona}` : ""}${p.telefono ? `\n  📱 ${p.telefono}` : ""}`
  ).join("\n\n");

  await sendWhatsAppMessage(
    from,
    `📋 Encontré ${proveedores.length} ${rubro.toLowerCase()}${proveedores.length > 1 ? "s" : ""} en la Red GFI®:\n\n${lista}\n\n_Ver todos: gfi.com.ar/proveedores_`
  );
}

// ── Captura de conocimiento profesional al Foro ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleForoConocimiento(texto: string, perfilId: string, msgId: string, sb: any) {
  // Claude classifica el contenido
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Analizá este mensaje de un grupo WhatsApp de corredores inmobiliarios argentinos.
Respondé SOLO con JSON válido:

MENSAJE:
"""${texto.slice(0, 1200)}"""

{
  "tipo": "plantilla_legal|guia_profesional|consulta_profesional|chat_informal",
  "titulo": "título descriptivo y corto para el Foro (null si chat_informal)",
  "resumen": "resumen de 1 oración (null si chat_informal)"
}`,
    }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  let parsed: { tipo: string; titulo: string | null; resumen: string | null } | null = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch { /* skip */ }

  if (!parsed || parsed.tipo === "chat_informal" || !parsed.titulo) return;

  // Buscar categoría en el foro
  const { data: cat } = await sb
    .from("forum_categories")
    .select("id")
    .in("slug", ["recursos-comunidad", "recursos", "general", "conocimiento"])
    .limit(1)
    .maybeSingle();

  const categoryId = (cat as any)?.id;
  if (!categoryId) return;

  const esPinned = parsed.tipo === "plantilla_legal";

  await sb.from("forum_topics").insert({
    title: parsed.titulo,
    body: `> 🤖 *Capturado automáticamente del grupo WhatsApp GFI®*\n\n${texto}`,
    category_id: categoryId,
    author_id: perfilId,
    status: "published",
    is_pinned: esPinned,
  });

  await sb.from("whatsapp_mensajes").update({
    procesado: true,
    mir_tabla: "forum_topics",
  }).eq("id", msgId);
}

// ── Auto-captura de recomendaciones de proveedores ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRecomendacionProveedor(texto: string, perfilId: string | null, msgId: string, sb: any) {
  // Claude Haiku extrae nombre, rubro y teléfono del mensaje corto
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Extraé los datos del proveedor de este mensaje de WhatsApp de corredores inmobiliarios argentinos.
Respondé SOLO con JSON válido:

MENSAJE: "${texto}"

{"nombre": "nombre completo o razón social", "rubro": "tipo de servicio", "telefono": "número si aparece, sino null", "zona": "barrio/ciudad si aparece, sino null"}
Si no es una recomendación de proveedor: {"nombre": null}`,
    }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  let parsed: { nombre: string | null; rubro?: string; telefono?: string | null; zona?: string | null } | null = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch { /* skip */ }

  if (!parsed?.nombre) {
    await sb.from("whatsapp_mensajes").update({ procesado: true, error_detalle: "no_proveedor" }).eq("id", msgId);
    return;
  }

  // Upsert en red_proveedores (evita duplicados por nombre+rubro)
  await sb.from("red_proveedores").upsert({
    nombre:    parsed.nombre,
    rubro:     parsed.rubro ?? "Otro",
    telefono:  parsed.telefono ?? null,
    zona:      parsed.zona ?? null,
    activo:    true,
    fuente:    "whatsapp",
    recomendado_por: perfilId,
  }, { onConflict: "nombre,rubro", ignoreDuplicates: false });

  await sb.from("whatsapp_mensajes").update({ procesado: true, mir_tabla: "red_proveedores" }).eq("id", msgId);
}

