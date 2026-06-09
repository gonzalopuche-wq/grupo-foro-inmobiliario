// Emisión de factura electrónica AFIP para una suscripción (abono mensual).
// Reparte el total entre los emisores activos según su % de facturación y pide
// un CAE por cada uno. SOLO admin/master. SOLO SERVIDOR.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  obtenerTicketAcceso, solicitarCAE, tipoComprobante, docReceptor,
  hoyYyyymmdd, construirQrAfip, type Ambiente, type CondicionIva,
} from "@/app/lib/afip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const IVA_ID_21 = 5; // alícuota 21%
const r2 = (n: number) => Math.round(n * 100) / 100;

async function esAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", data.user.id).single();
  return ["admin", "master"].includes(p?.tipo ?? "");
}

export async function POST(req: NextRequest) {
  if (!(await esAdmin(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { suscripcion_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  const { suscripcion_id } = body;
  if (!suscripcion_id) return NextResponse.json({ error: "Falta suscripcion_id" }, { status: 400 });

  // Config AFIP
  const { data: indicadores } = await sb.from("indicadores").select("clave, valor, valor_texto")
    .in("clave", ["afip_habilitado", "afip_ambiente"]);
  const getInd = (k: string) => indicadores?.find(i => i.clave === k);
  const habilitado = Number(getInd("afip_habilitado")?.valor ?? 0) === 1;
  if (!habilitado) return NextResponse.json({ error: "La facturación AFIP está deshabilitada (afip_habilitado=0)." }, { status: 400 });
  const ambiente = (getInd("afip_ambiente")?.valor_texto as Ambiente) ?? "homologacion";

  // Suscripción + receptor (corredor)
  const { data: sub } = await sb.from("suscripciones")
    .select("id, periodo, monto_usd, monto_ars, dolar_ref, perfil_id, perfiles(nombre, apellido, cuit, dni, condicion_iva)")
    .eq("id", suscripcion_id).single();
  if (!sub) return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });
  const perf: any = Array.isArray(sub.perfiles) ? sub.perfiles[0] : sub.perfiles;

  // Importe total en ARS (neto + IVA). Si hay monto_ars usamos eso como total c/IVA.
  const netoArs = sub.dolar_ref && sub.monto_usd
    ? r2(sub.monto_usd * sub.dolar_ref)
    : sub.monto_ars ? r2(sub.monto_ars / 1.21) : 0;
  if (netoArs <= 0) return NextResponse.json({ error: "No se pudo determinar el importe de la suscripción." }, { status: 400 });

  // Emisores activos (reparto por %)
  const { data: emisores } = await sb.from("facturacion_emisores")
    .select("*").eq("activo", true).order("es_principal", { ascending: false });
  if (!emisores || emisores.length === 0) {
    return NextResponse.json({ error: "No hay emisores configurados. Cargá al menos uno en Facturación." }, { status: 400 });
  }

  const fecha = hoyYyyymmdd();
  const fechaIso = `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
  const receptor = docReceptor(perf?.cuit ?? null, perf?.dni ?? null);
  const receptorNombre = `${perf?.apellido ?? ""}, ${perf?.nombre ?? ""}`.replace(/^, |, $/g, "");
  const condReceptor = (perf?.condicion_iva as CondicionIva) ?? null;

  const resultados: any[] = [];

  for (const em of emisores as any[]) {
    const pct = Number(em.porcentaje_facturacion) / 100;
    const netoE = r2(netoArs * pct);
    const ivaE = r2(netoE * 0.21);
    const totalE = r2(netoE + ivaE);
    const tipoCmp = tipoComprobante(em.condicion_iva as CondicionIva, condReceptor);

    // Idempotencia: ¿ya hay una factura emitida para este emisor/corredor/período/ambiente?
    const { data: yaEmitida } = await sb.from("facturas_afip").select("id, cae")
      .eq("emisor_id", em.id).eq("perfil_id", sub.perfil_id).eq("periodo", sub.periodo)
      .eq("ambiente", ambiente).eq("estado", "emitida").maybeSingle();
    if (yaEmitida) { resultados.push({ emisor: em.razon_social, ok: true, yaEmitida: true, cae: yaEmitida.cae }); continue; }

    // Fila pendiente
    const baseRow = {
      emisor_id: em.id, perfil_id: sub.perfil_id, suscripcion_id: sub.id, periodo: sub.periodo,
      ambiente, tipo_cbte: tipoCmp, punto_venta: em.punto_venta,
      doc_tipo: receptor.docTipo, doc_nro: receptor.docNro, concepto: 2,
      importe_neto: tipoCmp === 11 ? totalE : netoE,
      importe_iva: tipoCmp === 11 ? 0 : ivaE,
      iva_pct: 21,
      importe_total: totalE,
      emisor_cuit: em.cuit, emisor_razon_social: em.razon_social, receptor_nombre: receptorNombre,
    };

    try {
      const ticket = await obtenerTicketAcceso({ cuit: em.cuit, ambiente, certEnv: em.cert_env });
      const cae = await solicitarCAE(ambiente, { token: ticket.token, sign: ticket.sign, cuit: em.cuit }, {
        ptoVta: em.punto_venta, cbteTipo: tipoCmp, concepto: 2,
        docTipo: receptor.docTipo, docNro: receptor.docNro, cbteFch: fecha,
        impNeto: netoE, impIVA: ivaE, impTotal: totalE, ivaId: IVA_ID_21,
        fchServDesde: fecha, fchServHasta: fecha, fchVtoPago: fecha,
      });

      if (cae.resultado === "A" && cae.cae) {
        const caeVtoIso = cae.caeVto ? `${cae.caeVto.slice(0, 4)}-${cae.caeVto.slice(4, 6)}-${cae.caeVto.slice(6, 8)}` : null;
        const qr = construirQrAfip({
          fecha: fechaIso, cuit: Number(em.cuit.replace(/\D/g, "")), ptoVta: em.punto_venta,
          tipoCmp, nroCmp: cae.cbteNro, importe: totalE,
          tipoDocRec: receptor.docTipo, nroDocRec: Number(receptor.docNro), cae: cae.cae,
        });
        const { data: ins } = await sb.from("facturas_afip").insert({
          ...baseRow, cbte_nro: cae.cbteNro, cae: cae.cae, cae_vto: caeVtoIso,
          estado: "emitida", qr_payload: qr, emitida_at: new Date().toISOString(),
          response_json: { observaciones: cae.observaciones },
        }).select("id").single();
        resultados.push({ emisor: em.razon_social, ok: true, cae: cae.cae, cbteNro: cae.cbteNro, id: ins?.id });
      } else {
        await sb.from("facturas_afip").insert({
          ...baseRow, estado: "error", error_msg: cae.observaciones ?? `Resultado ${cae.resultado}`,
        });
        resultados.push({ emisor: em.razon_social, ok: false, error: cae.observaciones ?? `Rechazado (${cae.resultado})` });
      }
    } catch (e: any) {
      await sb.from("facturas_afip").insert({ ...baseRow, estado: "error", error_msg: String(e?.message ?? e).slice(0, 500) });
      resultados.push({ emisor: em.razon_social, ok: false, error: String(e?.message ?? e).slice(0, 300) });
    }
  }

  const algunaOk = resultados.some(r => r.ok);
  return NextResponse.json({ ok: algunaOk, ambiente, resultados }, { status: algunaOk ? 200 : 502 });
}
