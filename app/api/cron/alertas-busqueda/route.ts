// Cron: detecta propiedades nuevas en cartera que matchean búsquedas de contactos CRM
// Corre diariamente. Notifica al corredor vía push con el resumen de matches.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";

async function enviarPush(perfil_id: string, titulo: string, body: string, url: string) {
  return fetch(`${siteUrl}/api/push/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.CRON_SECRET ?? "",
    },
    body: JSON.stringify({ perfil_id, titulo, body, url }),
  }).catch(() => {});
}

/** Normaliza texto: minúsculas, sin tildes */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Verifica si al menos una palabra de `zona_interes` aparece en la ubicación
 * de la propiedad (barrio + ciudad).
 */
function matchZona(
  barrio: string | null,
  ciudad: string | null,
  zona_interes: string | null
): boolean {
  if (!zona_interes) return false;
  const ubicacion = normalizar(`${barrio ?? ""} ${ciudad ?? ""}`);
  const palabras = normalizar(zona_interes)
    .split(/\s+/)
    .filter((p) => p.length >= 3); // ignorar palabras muy cortas
  return palabras.some((palabra) => ubicacion.includes(palabra));
}

/**
 * Verifica si el precio de la propiedad entra en el presupuesto del contacto.
 * Solo aplica si tienen la misma moneda.
 */
function matchPresupuesto(
  precio: number | null,
  moneda_prop: string | null,
  presupuesto_max: number | null,
  moneda_contacto: string | null
): boolean {
  if (!precio || !presupuesto_max || !moneda_prop || !moneda_contacto) return false;
  if (moneda_prop.toLowerCase() !== moneda_contacto.toLowerCase()) return false;
  return precio <= presupuesto_max;
}

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 1. Propiedades nuevas: creadas en las últimas 25 horas
  const desde = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  const { data: propiedades, error: errorProps } = await sb
    .from("cartera_propiedades")
    .select("id, perfil_id, titulo, tipo_operacion, tipo_inmueble, precio, moneda, barrio, ciudad, created_at")
    .gte("created_at", desde);

  if (errorProps) {
    console.error("[alertas-busqueda] Error al obtener propiedades:", errorProps);
    return NextResponse.json({ error: "Error al obtener propiedades" }, { status: 500 });
  }

  if (!propiedades?.length) {
    return NextResponse.json({ matches_encontrados: 0, corredores_notificados: 0 });
  }

  // 2. Contactos activos con zona_interes o presupuesto_max definidos
  const { data: contactos, error: errorContactos } = await sb
    .from("crm_contactos")
    .select("id, perfil_id, nombre, apellido, email, interes, presupuesto_min, presupuesto_max, moneda, zona_interes, estado")
    .not("estado", "ilike", "%perdido%")
    .or("zona_interes.not.is.null,presupuesto_max.not.is.null");

  if (errorContactos) {
    console.error("[alertas-busqueda] Error al obtener contactos:", errorContactos);
    return NextResponse.json({ error: "Error al obtener contactos" }, { status: 500 });
  }

  if (!contactos?.length) {
    return NextResponse.json({ matches_encontrados: 0, corredores_notificados: 0 });
  }

  // Agrupar contactos por perfil_id para búsqueda eficiente
  const contactosPorPerfil: Record<string, typeof contactos> = {};
  for (const contacto of contactos) {
    const pid = contacto.perfil_id as string;
    if (!pid) continue;
    if (!contactosPorPerfil[pid]) contactosPorPerfil[pid] = [];
    contactosPorPerfil[pid].push(contacto);
  }

  // 3. Matching: por cada propiedad nueva, buscar contactos del mismo corredor
  // matches_por_perfil: perfil_id → Set de contactos que matchean
  const matchesPorPerfil: Record<string, Set<string>> = {};
  let totalMatches = 0;

  for (const prop of propiedades) {
    const pid = prop.perfil_id as string;
    if (!pid) continue;

    const contactosDelCorredor = contactosPorPerfil[pid] ?? [];
    if (!contactosDelCorredor.length) continue;

    for (const contacto of contactosDelCorredor) {
      try {
        const hayMatchZona = matchZona(prop.barrio, prop.ciudad, contacto.zona_interes);
        const hayMatchPresupuesto = matchPresupuesto(
          prop.precio,
          prop.moneda,
          contacto.presupuesto_max,
          contacto.moneda
        );

        if (!hayMatchZona && !hayMatchPresupuesto) continue;

        if (!matchesPorPerfil[pid]) matchesPorPerfil[pid] = new Set();
        const nombreContacto = `${contacto.nombre ?? ""} ${contacto.apellido ?? ""}`.trim();
        matchesPorPerfil[pid].add(nombreContacto || contacto.id);
        totalMatches++;
      } catch (err) {
        console.error(
          `[alertas-busqueda] Error evaluando prop ${prop.id} con contacto ${contacto.id}:`,
          err
        );
        // Continuar con las demás
      }
    }
  }

  // 4. Agrupar matches por corredor y enviar 1 push por corredor
  let corredoresNotificados = 0;

  for (const [perfil_id, nombresSet] of Object.entries(matchesPorPerfil)) {
    try {
      const nombres = Array.from(nombresSet);
      const n = nombres.length;
      const tituloMsg = `🏠 ${propiedades.filter((p) => p.perfil_id === perfil_id).length} propiedad${propiedades.filter((p) => p.perfil_id === perfil_id).length === 1 ? "" : "es"} nueva${propiedades.filter((p) => p.perfil_id === perfil_id).length === 1 ? "" : "s"} para tus clientes`;

      // Construir body: "Nombre1, Nombre2... tienen propiedades que coinciden con su búsqueda"
      let bodyMsg: string;
      if (n <= 3) {
        bodyMsg = `${nombres.join(", ")} ${n === 1 ? "tiene una propiedad" : "tienen propiedades"} que coincide${n === 1 ? "" : "n"} con su búsqueda`;
      } else {
        const mencionados = nombres.slice(0, 3).join(", ");
        const resto = n - 3;
        bodyMsg = `${mencionados} y ${resto} más tienen propiedades que coinciden con su búsqueda`;
      }

      await enviarPush(perfil_id, tituloMsg, bodyMsg, "/crm/contactos");
      corredoresNotificados++;
    } catch (err) {
      console.error(`[alertas-busqueda] Error enviando push a perfil ${perfil_id}:`, err);
      // Continuar con los demás corredores
    }
  }

  return NextResponse.json({
    matches_encontrados: totalMatches,
    corredores_notificados: corredoresNotificados,
  });
}
