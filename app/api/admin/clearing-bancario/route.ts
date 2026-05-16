import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function detectarCol(headers: string[], palabras: string[]): number {
  return headers.findIndex(h => {
    const n = h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    return palabras.some(p => n.includes(p));
  });
}

function normalizarMonto(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/\s/g, "").replace(/\$/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.abs(n);
}

function normalizarFecha(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // Try DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // Try YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

export async function POST(req: NextRequest) {
  // Verify admin
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (!["admin", "master"].includes(perfil?.tipo ?? "")) {
    return NextResponse.json({ ok: false, error: "Solo admins" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "No se recibió archivo" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  // Find header row (first row with more than 2 non-empty cells)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const nonEmpty = rows[i].filter((c: any) => String(c ?? "").trim().length > 0).length;
    if (nonEmpty >= 3) { headerIdx = i; break; }
  }

  const headers = rows[headerIdx].map((c: any) => String(c ?? ""));
  const dataRows = rows.slice(headerIdx + 1).filter(r => r.some((c: any) => String(c ?? "").trim().length > 0));

  // Detect columns
  const iMonto = detectarCol(headers, ["importe", "monto", "credito", "crédito", "credit", "amount", "valor"]);
  const iFecha = detectarCol(headers, ["fecha", "date", "dia", "día"]);
  const iDesc  = detectarCol(headers, ["descripcion", "descripción", "concepto", "detalle", "referencia", "nombre", "origen"]);
  const iCbu   = detectarCol(headers, ["cbu", "cvu", "cuenta", "origen"]);

  const columnas_detectadas = {
    monto: iMonto >= 0 ? headers[iMonto] : null,
    fecha: iFecha >= 0 ? headers[iFecha] : null,
    descripcion: iDesc >= 0 ? headers[iDesc] : null,
    cbu: iCbu >= 0 ? headers[iCbu] : null,
  };

  // Parse bank transactions
  interface BankRow {
    fecha: string | null;
    monto: number | null;
    descripcion: string;
    cbu: string;
  }

  const transacciones: BankRow[] = dataRows
    .map(r => ({
      fecha: iFecha >= 0 ? normalizarFecha(r[iFecha]) : null,
      monto: iMonto >= 0 ? normalizarMonto(r[iMonto]) : null,
      descripcion: iDesc >= 0 ? String(r[iDesc] ?? "").trim() : "",
      cbu: iCbu >= 0 ? String(r[iCbu] ?? "").replace(/\D/g, "") : "",
    }))
    .filter(r => r.monto && r.monto > 0);

  if (transacciones.length === 0) {
    return NextResponse.json({ ok: false, error: "No se encontraron transacciones válidas en el archivo.", columnas_detectadas, total_filas: dataRows.length }, { status: 400 });
  }

  // Load pending payments from DB
  const { data: pagos } = await sb
    .from("suscripciones")
    .select("id, perfil_id, monto_declarado_ars, fecha_pago_declarado, cbu_origen, estado, perfiles(nombre, apellido, matricula)")
    .in("estado", ["pendiente"])
    .order("creado_at", { ascending: false });

  // Match bank rows with declared payments
  const MONTO_TOL = 0.05; // 5% tolerance
  const FECHA_DIAS = 3;   // ±3 days tolerance

  const matches: any[] = [];
  const sinMatch: any[] = [];
  const pagosCruzados: Set<string> = new Set();

  for (const trx of transacciones) {
    const montoTrx = trx.monto!;
    const fechaTrx = trx.fecha ? new Date(trx.fecha) : null;

    const candidatos = (pagos ?? []).filter(p => {
      if (!p.monto_declarado_ars) return false;
      const montoPago = Number(p.monto_declarado_ars);
      const difMonto = Math.abs(montoTrx - montoPago) / montoPago;
      if (difMonto > MONTO_TOL) return false;

      if (fechaTrx && p.fecha_pago_declarado) {
        const fechaPago = new Date(p.fecha_pago_declarado);
        const difDias = Math.abs((fechaTrx.getTime() - fechaPago.getTime()) / 86400000);
        if (difDias > FECHA_DIAS) return false;
      }

      if (trx.cbu && p.cbu_origen) {
        const cbuTrx = trx.cbu.slice(-8);
        const cbuPago = String(p.cbu_origen).replace(/\D/g, "").slice(-8);
        if (cbuPago && cbuTrx && cbuPago !== cbuTrx) return false;
      }

      return true;
    });

    if (candidatos.length > 0) {
      const mejor = candidatos[0];
      pagosCruzados.add(mejor.id);
      matches.push({
        banco: { fecha: trx.fecha, monto: montoTrx, descripcion: trx.descripcion, cbu: trx.cbu },
        pago: { id: mejor.id, perfil_id: mejor.perfil_id, monto_declarado_ars: mejor.monto_declarado_ars, fecha_pago_declarado: mejor.fecha_pago_declarado, perfiles: mejor.perfiles },
        confianza: candidatos.length === 1 ? "alta" : "media",
      });
    } else {
      sinMatch.push({ fecha: trx.fecha, monto: montoTrx, descripcion: trx.descripcion, cbu: trx.cbu });
    }
  }

  // Declared payments that didn't match any bank row
  const pagosNoEncontrados = (pagos ?? []).filter(p => !pagosCruzados.has(p.id));

  return NextResponse.json({
    ok: true,
    total_transacciones: transacciones.length,
    total_pagos_pendientes: pagos?.length ?? 0,
    matches,
    sin_match_banco: sinMatch,
    pagos_no_encontrados: pagosNoEncontrados.map(p => ({
      id: p.id, perfil_id: p.perfil_id,
      monto_declarado_ars: p.monto_declarado_ars,
      fecha_pago_declarado: p.fecha_pago_declarado,
      perfiles: p.perfiles,
    })),
    columnas_detectadas,
  });
}
