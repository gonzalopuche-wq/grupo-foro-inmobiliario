import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROPIA_BASE = (process.env.PROPIA_API_BASE ?? "https://propia.com.ar/api").replace(/\/$/, "");

async function obtenerCredenciales(userId: string) {
  const { data } = await sb
    .from("portal_credenciales")
    .select("propia_api_key, propia_provider, propia_usuario")
    .eq("perfil_id", userId)
    .maybeSingle();
  const row = data as Record<string, string | null> | null;
  return {
    apiKey:   row?.propia_api_key   ?? process.env.PROPIA_API_KEY ?? null,
    provider: row?.propia_provider  ?? process.env.PROPIA_PROVIDER ?? null,
    seller:   row?.propia_usuario   ?? null,
  };
}

interface PropiaLead {
  id?: unknown;
  inquiry_id?: unknown;
  contact_id?: unknown;
  nombre?: unknown; first_name?: unknown; name?: unknown;
  apellido?: unknown; last_name?: unknown; surname?: unknown;
  email?: unknown; correo?: unknown;
  telefono?: unknown; phone?: unknown; celular?: unknown; mobile?: unknown;
  tipo_propiedad?: unknown; property_type?: unknown;
  operacion?: unknown; operation?: unknown;
  zona?: unknown; zone?: unknown; barrio?: unknown; neighbourhood?: unknown; location?: unknown;
  presupuesto_min?: unknown; budget_min?: unknown; price_min?: unknown;
  presupuesto_max?: unknown; budget_max?: unknown; price_max?: unknown;
  moneda?: unknown; currency?: unknown;
  dormitorios?: unknown; bedrooms?: unknown; rooms?: unknown;
  notas?: unknown; notes?: unknown; mensaje?: unknown; message?: unknown;
  created_at?: unknown; fecha?: unknown;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown): number | null {
  const n = parseFloat(str(v));
  return isNaN(n) ? null : n;
}

function normalizarLead(raw: PropiaLead) {
  const nombre = str(raw.nombre ?? raw.first_name ?? raw.name) || "Sin nombre";
  const apellido = str(raw.apellido ?? raw.last_name ?? raw.surname);
  const email = str(raw.email ?? raw.correo) || null;
  const telefono = str(raw.telefono ?? raw.phone ?? raw.celular ?? raw.mobile) || null;
  const notas = str(raw.notas ?? raw.notes ?? raw.mensaje ?? raw.message);
  const externoId = `propia:${str(raw.id ?? raw.inquiry_id ?? raw.contact_id)}`;

  const criterios: Record<string, unknown> = {};
  const tipo = str(raw.tipo_propiedad ?? raw.property_type);
  const operacion = str(raw.operacion ?? raw.operation);
  const zona = str(raw.zona ?? raw.zone ?? raw.barrio ?? raw.neighbourhood ?? raw.location);
  const pMin = num(raw.presupuesto_min ?? raw.budget_min ?? raw.price_min);
  const pMax = num(raw.presupuesto_max ?? raw.budget_max ?? raw.price_max);
  const moneda = str(raw.moneda ?? raw.currency) || "USD";
  const dorm = num(raw.dormitorios ?? raw.bedrooms ?? raw.rooms);

  if (tipo)      criterios.tipo       = tipo;
  if (operacion) criterios.operacion  = operacion;
  if (zona)      criterios.zona       = zona;
  if (pMin)      criterios.precio_min = pMin;
  if (pMax)      criterios.precio_max = pMax;
  if (moneda)    criterios.moneda     = moneda;
  if (dorm)      criterios.dormitorios = dorm;

  return { nombre, apellido, email, telefono, notas, criterios, externoId };
}

export async function sincronizarParaUsuario(userId: string): Promise<{ total: number; importados: number; actualizados: number; errores: number }> {
  const { apiKey, provider } = await obtenerCredenciales(userId);
  if (!apiKey) throw new Error("Sin API key de Propia");

  const hdrs = { Accept: "application/json", Authorization: `Bearer ${apiKey}` };
  let leads: PropiaLead[] = [];

  // Intentar distintos endpoints posibles de la API de Propia
  const endpoints = [
    `/crm-integrations/inquiries?provider=${provider ?? ""}&limit=500`,
    `/crm-integrations/status?provider=${provider ?? ""}&limit=500&offset=0`,
    `/contacts/?limit=500`,
    `/inquiries/?limit=500`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${PROPIA_BASE}${ep}`, {
        headers: hdrs,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const raw = await res.json();
      const arr: PropiaLead[] = Array.isArray(raw)
        ? raw
        : (raw.results ?? raw.data ?? raw.inquiries ?? raw.contacts ?? raw.objects ?? []);
      if (arr.length > 0) { leads = arr; break; }
    } catch {
      continue;
    }
  }

  let importados = 0, actualizados = 0, errores = 0;

  for (const raw of leads) {
    try {
      const norm = normalizarLead(raw);

      let contactoId: string | null = null;

      if (norm.email) {
        const { data: ex } = await sb
          .from("crm_contactos")
          .select("id, etiquetas")
          .eq("perfil_id", userId)
          .eq("email", norm.email)
          .maybeSingle();
        if (ex) {
          const ets: string[] = [...new Set([...(ex.etiquetas ?? []), "Propia"])];
          await sb.from("crm_contactos").update({ etiquetas: ets, origen: "propia" }).eq("id", ex.id);
          contactoId = ex.id as string;
          actualizados++;
        }
      }

      if (!contactoId && norm.telefono) {
        const { data: ex } = await sb
          .from("crm_contactos")
          .select("id, etiquetas")
          .eq("perfil_id", userId)
          .eq("telefono", norm.telefono)
          .maybeSingle();
        if (ex) {
          const ets: string[] = [...new Set([...(ex.etiquetas ?? []), "Propia"])];
          await sb.from("crm_contactos").update({ etiquetas: ets, origen: "propia" }).eq("id", ex.id);
          contactoId = ex.id as string;
          actualizados++;
        }
      }

      if (!contactoId) {
        const { data: nuevo } = await sb
          .from("crm_contactos")
          .insert({
            perfil_id: userId,
            nombre: norm.nombre,
            apellido: norm.apellido || null,
            email: norm.email,
            telefono: norm.telefono,
            etiquetas: ["Propia"],
            origen: "propia",
            notas: norm.notas || null,
            tipo: "cliente",
            estado: "lead:nuevo",
          })
          .select("id")
          .single();
        if (nuevo) { contactoId = (nuevo as { id: string }).id; importados++; }
      }

      if (contactoId && Object.keys(norm.criterios).length > 0) {
        const nombreBusqueda = `Búsqueda Propia — ${norm.nombre}${norm.apellido ? " " + norm.apellido : ""}`;
        await sb.from("crm_listas_busqueda").upsert({
          corredor_id: userId,
          contacto_id: contactoId,
          nombre: nombreBusqueda,
          criterios: norm.criterios,
          origen: "propia",
          externo_id: norm.externoId,
          email_cliente: norm.email,
          notificar_cliente: false,
          publica: false,
        }, { onConflict: "corredor_id,externo_id" });
      }
    } catch {
      errores++;
    }
  }

  // Actualizar ultima_sincronizacion
  await sb.from("crm_integraciones_config").upsert({
    perfil_id: userId,
    tipo: "propia",
    ultima_sincronizacion: new Date().toISOString(),
  }, { onConflict: "perfil_id,tipo" });

  return { total: leads.length, importados, actualizados, errores };
}

// ── GET: estado de la última sincronización ───────────────────────────────────
export async function GET(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(jwt);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data } = await sb
    .from("crm_integraciones_config")
    .select("ultima_sincronizacion")
    .eq("perfil_id", user.id)
    .eq("tipo", "propia")
    .maybeSingle();

  const cfg = data as { ultima_sincronizacion: string | null } | null;
  return NextResponse.json({ ok: true, ultima_sincronizacion: cfg?.ultima_sincronizacion ?? null });
}

// ── POST: disparar sync manual ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(jwt);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const resultado = await sincronizarParaUsuario(user.id);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
