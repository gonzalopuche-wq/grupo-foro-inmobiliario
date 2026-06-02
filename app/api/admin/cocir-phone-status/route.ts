import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  return p?.tipo === "admin" || p?.tipo === "master";
}

// GET → devuelve comparación teléfono entre perfiles GFI y cocir_padron
// Filtra por estado: "sin_telefono_gfi" | "diferente" | "sin_padron" | "ok" | "todos"
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const estado = req.nextUrl.searchParams.get("estado") ?? "todos";
  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "0");
  const pageSize = 50;

  // Cargar todos los perfiles con matricula
  const { data: perfiles, error: ep } = await sb
    .from("perfiles")
    .select("id, nombre, apellido, matricula, telefono, celular_oficina, whatsapp_negocio, email, inmobiliaria, foto_url, tipo, estado")
    .not("matricula", "is", null)
    .neq("matricula", "")
    .order("apellido");

  if (ep) return NextResponse.json({ error: ep.message }, { status: 500 });

  // Cargar padron completo (telefono + celular)
  let padron: { matricula: string | number; telefono: string | null; celular: string | null; email: string | null; inmobiliaria: string | null; estado: string | null }[] = [];
  let desde = 0;
  while (true) {
    const { data, error } = await sb
      .from("cocir_padron")
      .select("matricula, telefono, celular, email, inmobiliaria, estado")
      .range(desde, desde + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    padron = padron.concat(data);
    if (data.length < 1000) break;
    desde += 1000;
  }

  const padronIdx = new Map<string, typeof padron[0]>();
  for (const r of padron) {
    if (r.matricula != null) {
      const key = String(r.matricula).trim().replace(/^0+/, "") || String(r.matricula).trim();
      padronIdx.set(key, r);
    }
  }

  function normTel(t: string | null | undefined): string {
    return (t ?? "").replace(/\D/g, "").replace(/^549/, "").replace(/^54/, "").replace(/^0/, "");
  }

  type PhoneStatus = "ok" | "sin_telefono_gfi" | "diferente" | "sin_padron";

  const comparacion = (perfiles ?? []).map(p => {
    const mat = String(p.matricula ?? "").trim();
    const matNorm = mat.replace(/^0+/, "") || mat;
    const cocir = padronIdx.get(matNorm) ?? padronIdx.get(mat) ?? null;

    const telGFI = p.telefono ?? p.celular_oficina ?? null;
    const telCOCIR = cocir?.telefono ?? cocir?.celular ?? null;

    let status: PhoneStatus;
    if (!cocir) {
      status = "sin_padron";
    } else if (!telGFI && telCOCIR) {
      status = "sin_telefono_gfi";
    } else if (telGFI && telCOCIR && normTel(telGFI) !== normTel(telCOCIR)) {
      status = "diferente";
    } else {
      status = "ok";
    }

    return {
      id: p.id,
      nombre: p.nombre,
      apellido: p.apellido,
      matricula: mat,
      foto_url: p.foto_url ?? null,
      tipo: p.tipo,
      estado_gfi: p.estado,
      // GFI phones
      telefono_gfi: p.telefono ?? null,
      celular_oficina_gfi: p.celular_oficina ?? null,
      whatsapp_negocio_gfi: p.whatsapp_negocio ?? null,
      email_gfi: p.email ?? null,
      inmobiliaria_gfi: p.inmobiliaria ?? null,
      // COCIR data
      telefono_cocir: cocir?.telefono ?? null,
      celular_cocir: cocir?.celular ?? null,
      email_cocir: cocir?.email ?? null,
      inmobiliaria_cocir: cocir?.inmobiliaria ?? null,
      estado_cocir: cocir?.estado ?? null,
      tiene_padron: !!cocir,
      status,
    };
  });

  const filtrado = estado === "todos"
    ? comparacion
    : comparacion.filter(r => r.status === estado);

  const totales = {
    total: comparacion.length,
    sin_telefono_gfi: comparacion.filter(r => r.status === "sin_telefono_gfi").length,
    diferente: comparacion.filter(r => r.status === "diferente").length,
    sin_padron: comparacion.filter(r => r.status === "sin_padron").length,
    ok: comparacion.filter(r => r.status === "ok").length,
  };

  const paginado = filtrado.slice(page * pageSize, (page + 1) * pageSize);

  return NextResponse.json({
    data: paginado,
    total: filtrado.length,
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < filtrado.length,
    totales,
  });
}

// POST → sincroniza teléfono de un perfil específico desde COCIR
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { perfil_id, campos = ["telefono"] } = body;

  if (!perfil_id) return NextResponse.json({ error: "Falta perfil_id" }, { status: 400 });

  const { data: perfil } = await sb
    .from("perfiles")
    .select("id, matricula, telefono, celular_oficina, email, inmobiliaria, whatsapp_negocio")
    .eq("id", perfil_id)
    .single();

  if (!perfil?.matricula) return NextResponse.json({ error: "Perfil sin matrícula" }, { status: 400 });

  const mat = String(perfil.matricula).trim();
  const num = parseInt(mat.replace(/^0+/, "") || mat, 10);

  const { data: registros } = await sb
    .from("cocir_padron")
    .select("matricula, telefono, celular, email, inmobiliaria")
    .or(`matricula.eq.${mat},matricula.eq.${isNaN(num) ? mat : num}`)
    .limit(5);

  const cocir = (registros ?? []).find(r =>
    String(r.matricula) === mat || Number(r.matricula) === num
  ) ?? null;

  if (!cocir) return NextResponse.json({ error: "Matrícula no encontrada en el padrón COCIR" }, { status: 404 });

  const update: Record<string, string | null> = {};
  const cambios: Record<string, { anterior: string | null; nuevo: string }> = {};
  const forzar = body.forzar === true;

  if (campos.includes("telefono") && cocir.telefono) {
    if (forzar || !perfil.telefono) {
      update.telefono = cocir.telefono;
      if (!perfil.whatsapp_negocio) update.whatsapp_negocio = cocir.telefono;
      cambios.telefono = { anterior: perfil.telefono, nuevo: cocir.telefono };
    }
  }
  if (campos.includes("celular") && cocir.celular) {
    if (forzar || !perfil.celular_oficina) {
      update.celular_oficina = cocir.celular;
      cambios.celular = { anterior: perfil.celular_oficina, nuevo: cocir.celular };
    }
  }
  if (campos.includes("email") && cocir.email) {
    if (forzar || !perfil.email) {
      update.email = cocir.email;
      cambios.email = { anterior: perfil.email, nuevo: cocir.email };
    }
  }
  if (campos.includes("inmobiliaria") && cocir.inmobiliaria) {
    if (forzar || !perfil.inmobiliaria) {
      update.inmobiliaria = cocir.inmobiliaria;
      cambios.inmobiliaria = { anterior: perfil.inmobiliaria, nuevo: cocir.inmobiliaria };
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, actualizados: 0, message: "No hay campos para actualizar", cambios: {} });
  }

  const { error } = await sb.from("perfiles").update(update).eq("id", perfil_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, actualizados: Object.keys(update).length, cambios });
}
