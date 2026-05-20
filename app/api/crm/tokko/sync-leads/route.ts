import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOKKO_BASE = "https://www.tokkobroker.com/api/v1";

async function autenticar(req: NextRequest): Promise<string | null> {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return null;
  const { data: { user } } = await sb.auth.getUser(jwt);
  return user?.id ?? null;
}

async function obtenerApiKey(userId: string): Promise<string | null> {
  const { data: cfg } = await sb
    .from("crm_integraciones_config")
    .select("config")
    .eq("perfil_id", userId)
    .eq("tipo", "tokko")
    .maybeSingle();
  if (cfg?.config) {
    const c = cfg.config as Record<string, string>;
    if (c.api_key) return c.api_key;
  }
  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("tokko_key")
    .eq("perfil_id", userId)
    .maybeSingle();
  return (creds as Record<string, string | null> | null)?.tokko_key ?? process.env.TOKKO_API_KEY ?? null;
}

interface TokkoContact {
  id?: unknown;
  first_name?: unknown; name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown; celular?: unknown; mobile?: unknown;
  address?: unknown;
  tags?: unknown;
  notes?: unknown; memo?: unknown;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizarContacto(c: TokkoContact) {
  const nombre = str(c.first_name ?? c.name) || "Sin nombre";
  const apellido = str(c.last_name);
  const email = str(c.email) || null;
  const telefono = str(c.phone ?? c.celular ?? c.mobile) || null;
  const notas = str(c.notes ?? c.memo);
  const externoId = `tokko:${str(c.id)}`;
  return { nombre, apellido, email, telefono, notas, externoId };
}

export async function sincronizarParaUsuario(userId: string): Promise<{ total: number; importados: number; actualizados: number; errores: number }> {
  const apiKey = await obtenerApiKey(userId);
  if (!apiKey) throw new Error("Sin API key de Tokko Broker");

  let contacts: TokkoContact[] = [];
  let offset = 0;
  const limit = 100;

  // Paginar todos los contactos
  while (true) {
    const url = `${TOKKO_BASE}/contact/?key=${apiKey}&limit=${limit}&offset=${offset}&format=json`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) break;
    const raw = await res.json();
    const arr: TokkoContact[] = Array.isArray(raw) ? raw : (raw.objects ?? raw.results ?? raw.data ?? []);
    if (arr.length === 0) break;
    contacts = contacts.concat(arr);
    if (arr.length < limit) break;
    offset += limit;
    if (contacts.length >= 2000) break;
  }

  let importados = 0, actualizados = 0, errores = 0;

  for (const c of contacts) {
    try {
      const norm = normalizarContacto(c);
      let contactoId: string | null = null;

      if (norm.email) {
        const { data: ex } = await sb
          .from("crm_contactos")
          .select("id, etiquetas")
          .eq("perfil_id", userId)
          .eq("email", norm.email)
          .maybeSingle();
        if (ex) {
          const ets: string[] = [...new Set([...(ex.etiquetas ?? []), "TK"])];
          await sb.from("crm_contactos").update({ etiquetas: ets, origen: "tokko" }).eq("id", ex.id);
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
          const ets: string[] = [...new Set([...(ex.etiquetas ?? []), "TK"])];
          await sb.from("crm_contactos").update({ etiquetas: ets, origen: "tokko" }).eq("id", ex.id);
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
            etiquetas: ["TK"],
            origen: "tokko",
            notas: norm.notas || null,
            tipo: "cliente",
            estado: "lead:nuevo",
          })
          .select("id")
          .single();
        if (nuevo) { contactoId = (nuevo as { id: string }).id; importados++; }
      }
      void contactoId;
    } catch {
      errores++;
    }
  }

  // Actualizar ultima_sincronizacion
  const { data: cfgRow } = await sb
    .from("crm_integraciones_config")
    .select("id")
    .eq("perfil_id", userId)
    .eq("tipo", "tokko")
    .maybeSingle();
  if (cfgRow) {
    await sb.from("crm_integraciones_config")
      .update({ ultima_sincronizacion: new Date().toISOString() })
      .eq("id", (cfgRow as { id: string }).id);
  }

  return { total: contacts.length, importados, actualizados, errores };
}

export async function GET(req: NextRequest) {
  const userId = await autenticar(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data } = await sb
    .from("crm_integraciones_config")
    .select("ultima_sincronizacion")
    .eq("perfil_id", userId)
    .eq("tipo", "tokko")
    .maybeSingle();

  const apiKey = await obtenerApiKey(userId);

  return NextResponse.json({
    ok: true,
    configurado: !!apiKey,
    ultima_sincronizacion: (data as { ultima_sincronizacion: string | null } | null)?.ultima_sincronizacion ?? null,
  });
}

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
