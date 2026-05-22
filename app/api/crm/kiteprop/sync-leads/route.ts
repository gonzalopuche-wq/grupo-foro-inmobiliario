import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function autenticar(req: NextRequest): Promise<string | null> {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return null;
  const { data: { user } } = await sb.auth.getUser(jwt);
  return user?.id ?? null;
}

async function obtenerApiKey(userId: string): Promise<{ apiKey: string | null; baseUrl: string }> {
  // Primero crm_integraciones_config (fuente primaria del route de KiteProp)
  const { data: cfg } = await sb
    .from("crm_integraciones_config")
    .select("config")
    .eq("perfil_id", userId)
    .eq("tipo", "kiteprop")
    .maybeSingle();

  if (cfg?.config) {
    const c = cfg.config as Record<string, string>;
    if (c.api_key) {
      return {
        apiKey: c.api_key,
        baseUrl: (c.base_url ?? "https://www.kiteprop.com/api/v1")
          .replace("api.kiteprop.com", "www.kiteprop.com")
          .replace(/\/$/, ""),
      };
    }
  }

  // Fallback: portal_credenciales
  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("kiteprop_key")
    .eq("perfil_id", userId)
    .maybeSingle();

  const key = (creds as Record<string, string | null> | null)?.kiteprop_key ?? process.env.KITEPROP_API_KEY ?? null;
  return { apiKey: key, baseUrl: "https://www.kiteprop.com/api/v1" };
}

interface KpLead {
  id?: unknown;
  nombre?: unknown; first_name?: unknown; name?: unknown;
  apellido?: unknown; last_name?: unknown;
  email?: unknown;
  telefono?: unknown; phone?: unknown; celular?: unknown;
  tipo_propiedad?: unknown; property_type?: unknown; tipo?: unknown;
  operacion?: unknown; operation?: unknown;
  zona?: unknown; zone?: unknown; location?: unknown; barrio?: unknown; neighbourhood?: unknown;
  presupuesto_min?: unknown; budget_min?: unknown;
  presupuesto_max?: unknown; budget_max?: unknown;
  moneda?: unknown; currency?: unknown;
  dormitorios?: unknown; bedrooms?: unknown; ambientes?: unknown; rooms?: unknown;
  notas?: unknown; notes?: unknown; observaciones?: unknown; comentarios?: unknown;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown): number | null {
  const n = parseFloat(str(v));
  return isNaN(n) ? null : n;
}

function normalizarLead(kp: KpLead) {
  const nombre = str(kp.nombre ?? kp.first_name ?? kp.name) || "Sin nombre";
  const apellido = str(kp.apellido ?? kp.last_name);
  const email = str(kp.email) || null;
  const telefono = str(kp.telefono ?? kp.phone ?? kp.celular) || null;
  const id = str(kp.id);
  const notas = str(kp.notas ?? kp.notes ?? kp.observaciones ?? kp.comentarios);

  const criterios: Record<string, unknown> = {};
  const tipo = str(kp.tipo_propiedad ?? kp.property_type ?? kp.tipo);
  const operacion = str(kp.operacion ?? kp.operation);
  const zona = str(kp.zona ?? kp.zone ?? kp.barrio ?? kp.neighbourhood ?? kp.location);
  const pMin = num(kp.presupuesto_min ?? kp.budget_min);
  const pMax = num(kp.presupuesto_max ?? kp.budget_max);
  const moneda = str(kp.moneda ?? kp.currency) || "USD";
  const dorm = num(kp.dormitorios ?? kp.bedrooms);
  const amb = num(kp.ambientes ?? kp.rooms);

  if (tipo)    criterios.tipo       = tipo;
  if (operacion) criterios.operacion = operacion;
  if (zona)    criterios.zona       = zona;
  if (pMin)    criterios.precio_min = pMin;
  if (pMax)    criterios.precio_max = pMax;
  if (moneda)  criterios.moneda     = moneda;
  if (dorm)    criterios.dormitorios = dorm;
  if (amb)     criterios.ambientes  = amb;

  return { nombre, apellido, email, telefono, notas, criterios, externoId: `kiteprop:${id}` };
}

export async function sincronizarParaUsuario(userId: string): Promise<{ total: number; importados: number; actualizados: number; errores: number }> {
  const { apiKey, baseUrl } = await obtenerApiKey(userId);
  if (!apiKey) throw new Error("Sin API key de KiteProp");

  const headers = { Accept: "application/json", "X-API-Key": apiKey };
  let leads: KpLead[] = [];

  // Intentar /leads/ primero (interesados específicos), luego /contacts/
  for (const endpoint of ["leads", "inquiries", "contacts"]) {
    try {
      const url = `${baseUrl}/${endpoint}/?api_key=${apiKey}&limit=500&format=json`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const raw = await res.json();
      const arr: KpLead[] = Array.isArray(raw) ? raw : (raw.results ?? raw.objects ?? raw.data ?? raw.leads ?? []);
      if (arr.length > 0) { leads = arr; break; }
    } catch {
      continue;
    }
  }

  let importados = 0, actualizados = 0, errores = 0;

  for (const kp of leads) {
    try {
      const norm = normalizarLead(kp);

      let contactoId: string | null = null;

      // Buscar contacto existente por email
      if (norm.email) {
        const { data: ex } = await sb
          .from("crm_contactos")
          .select("id, etiquetas")
          .eq("perfil_id", userId)
          .eq("email", norm.email)
          .maybeSingle();
        if (ex) {
          const ets: string[] = [...new Set([...(ex.etiquetas ?? []), "KP"])];
          await sb.from("crm_contactos").update({ etiquetas: ets, origen: "kiteprop" }).eq("id", ex.id);
          contactoId = ex.id as string;
          actualizados++;
        }
      }

      // Si no encontró por email, buscar por teléfono
      if (!contactoId && norm.telefono) {
        const { data: ex } = await sb
          .from("crm_contactos")
          .select("id, etiquetas")
          .eq("perfil_id", userId)
          .eq("telefono", norm.telefono)
          .maybeSingle();
        if (ex) {
          const ets: string[] = [...new Set([...(ex.etiquetas ?? []), "KP"])];
          await sb.from("crm_contactos").update({ etiquetas: ets, origen: "kiteprop" }).eq("id", ex.id);
          contactoId = ex.id as string;
          actualizados++;
        }
      }

      // Crear nuevo contacto
      if (!contactoId) {
        const { data: nuevo } = await sb
          .from("crm_contactos")
          .insert({
            perfil_id: userId,
            nombre: norm.nombre,
            apellido: norm.apellido || null,
            email: norm.email,
            telefono: norm.telefono,
            etiquetas: ["KP"],
            origen: "kiteprop",
            notas: norm.notas || null,
            tipo: "cliente",
            estado: "lead:nuevo",
          })
          .select("id")
          .single();
        if (nuevo) { contactoId = (nuevo as { id: string }).id; importados++; }
      }

      // Crear/actualizar búsqueda si tiene criterios
      if (contactoId && Object.keys(norm.criterios).length > 0) {
        const nombreBusqueda = `Búsqueda KP — ${norm.nombre}${norm.apellido ? " " + norm.apellido : ""}`;
        await sb.from("crm_listas_busqueda").upsert({
          corredor_id: userId,
          contacto_id: contactoId,
          nombre: nombreBusqueda,
          criterios: norm.criterios,
          origen: "kiteprop",
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

  // Actualizar ultima_sincronizacion en crm_integraciones_config
  const { data: cfgRow } = await sb
    .from("crm_integraciones_config")
    .select("id")
    .eq("perfil_id", userId)
    .eq("tipo", "kiteprop")
    .maybeSingle();
  if (cfgRow) {
    await sb.from("crm_integraciones_config")
      .update({ ultima_sincronizacion: new Date().toISOString() })
      .eq("id", (cfgRow as { id: string }).id);
  }

  return { total: leads.length, importados, actualizados, errores };
}

// GET — retorna estado de última sincronización
export async function GET(req: NextRequest) {
  const userId = await autenticar(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data } = await sb
    .from("crm_integraciones_config")
    .select("ultima_sincronizacion")
    .eq("perfil_id", userId)
    .eq("tipo", "kiteprop")
    .maybeSingle();

  const { apiKey } = await obtenerApiKey(userId);

  return NextResponse.json({
    ok: true,
    configurado: !!apiKey,
    ultima_sincronizacion: (data as { ultima_sincronizacion: string | null } | null)?.ultima_sincronizacion ?? null,
  });
}

// POST — ejecuta la sincronización
export async function POST(req: NextRequest) {
  const userId = await autenticar(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const resultado = await sincronizarParaUsuario(userId);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    if (msg.includes("Sin API key")) {
      return NextResponse.json({ error: msg, sinCredenciales: true }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
