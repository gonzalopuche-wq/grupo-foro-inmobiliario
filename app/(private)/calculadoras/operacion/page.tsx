"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type TipoOp = "compraventa" | "locacion";
type Moneda = "ARS" | "USD";

const fmtARS = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtUSD = (n: number) => "USD " + Math.round(n).toLocaleString("es-AR");
const fmtMon = (n: number, m: Moneda) => m === "USD" ? fmtUSD(n) : fmtARS(n);
const fmtPct = (n: number) => n.toFixed(2).replace(".", ",") + "%";

interface CostoItem {
  label: string;
  parte: "comprador" | "vendedor" | "locatario" | "propietario" | "corredor";
  monto: number;
  pct?: number;
  detalle?: string;
  variante?: "highlight" | "total" | "sub";
}

export default function CalculadoraOperacionPage() {
  const [tipoOp, setTipoOp] = useState<TipoOp>("compraventa");
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [precio, setPrecio] = useState("");
  const [dolarBlue, setDolarBlue] = useState("1000");

  // Compraventa params
  const [honorariosComprador, setHonorariosComprador] = useState("3");
  const [honorariosVendedor, setHonorariosVendedor] = useState("3");
  const [sellosComprador, setSellosComprador] = useState("1.5");
  const [sellosVendedor, setSellosVendedor] = useState("1.5");
  const [escribania, setEscribania] = useState("1");
  const [iti, setIti] = useState("1.5");
  const [incluirIti, setIncluirIti] = useState(true);
  const [iibbHonorarios, setIibbHonorarios] = useState("5.5");
  const [ivaHonorarios, setIvaHonorarios] = useState("21");
  const [escribaniaACargoVendedor, setEscribaniaACargoVendedor] = useState(false);

  // Locación params
  const [alquilerMensual, setAlquilerMensual] = useState("");
  const [mesesContrato, setMesesContrato] = useState("24");
  const [comisionLocatario, setComisionLocatario] = useState("1");
  const [comisionPropietario, setComisionPropietario] = useState("1");
  const [mesesDeposito, setMesesDeposito] = useState("1");
  const [sellosLocacion, setSellosLocacion] = useState("1");
  const [iibbLocacion, setIibbLocacion] = useState("5.5");
  const [ivaLocacion, setIvaLocacion] = useState("21");

  // Resultado expandido
  const [expandido, setExpandido] = useState<string | null>(null);

  const precioNum = useMemo(() => parseFloat(precio.replace(/\./g, "").replace(",", ".")) || 0, [precio]);
  const alquilerNum = useMemo(() => parseFloat(alquilerMensual.replace(/\./g, "").replace(",", ".")) || 0, [alquilerMensual]);
  const dolarNum = useMemo(() => parseFloat(dolarBlue.replace(/\./g, "").replace(",", ".")) || 1, [dolarBlue]);

  // ── COMPRAVENTA ──────────────────────────────────────────────────────────────
  const costosCv = useMemo((): CostoItem[] => {
    if (!precioNum) return [];
    const p = precioNum;
    const pARS = moneda === "USD" ? p * dolarNum : p;
    const iibb = parseFloat(iibbHonorarios) / 100;
    const iva = parseFloat(ivaHonorarios) / 100;
    const items: CostoItem[] = [];

    // ── COMPRADOR ──
    const honCompRaw = p * (parseFloat(honorariosComprador) / 100);
    const honCompIIBB = honCompRaw * iibb;
    const honCompBase = honCompRaw + honCompIIBB;
    const honCompIVA = honCompBase * iva;
    const honCompTotal = honCompBase + honCompIVA;
    const sellosComp = pARS * (parseFloat(sellosComprador) / 100);
    const escribComp = escribaniaACargoVendedor ? 0 : pARS * (parseFloat(escribania) / 100);

    items.push({
      label: "Honorarios corredor (comprador)",
      parte: "comprador",
      monto: honCompRaw,
      pct: parseFloat(honorariosComprador),
      detalle: `+ IIBB ${fmtPct(parseFloat(iibbHonorarios))} + IVA ${fmtPct(parseFloat(ivaHonorarios))} = ${fmtMon(honCompTotal, moneda)}`,
      variante: "sub",
    });
    items.push({
      label: "IIBB + IVA sobre honorarios",
      parte: "comprador",
      monto: honCompIIBB + honCompIVA,
      detalle: `IIBB: ${fmtMon(honCompIIBB, moneda)} · IVA: ${fmtMon(honCompIVA, moneda)}`,
      variante: "sub",
    });
    items.push({
      label: "Impuesto de Sellos (comprador)",
      parte: "comprador",
      monto: moneda === "ARS" ? sellosComp : sellosComp / dolarNum,
      pct: parseFloat(sellosComprador),
      detalle: `Sobre precio en ARS: ${fmtARS(sellosComp)}`,
      variante: "sub",
    });
    if (!escribaniaACargoVendedor) {
      items.push({
        label: "Escribanía",
        parte: "comprador",
        monto: moneda === "ARS" ? escribComp : escribComp / dolarNum,
        pct: parseFloat(escribania),
        detalle: `${fmtPct(parseFloat(escribania))} sobre precio en ARS: ${fmtARS(escribComp)}`,
        variante: "sub",
      });
    }
    const totalComprador = honCompTotal + (moneda === "ARS" ? sellosComp : sellosComp / dolarNum) + (escribaniaACargoVendedor ? 0 : moneda === "ARS" ? escribComp : escribComp / dolarNum);
    items.push({ label: "TOTAL GASTOS COMPRADOR", parte: "comprador", monto: totalComprador, variante: "total" });

    // ── VENDEDOR ──
    const honVendRaw = p * (parseFloat(honorariosVendedor) / 100);
    const honVendIIBB = honVendRaw * iibb;
    const honVendBase = honVendRaw + honVendIIBB;
    const honVendIVA = honVendBase * iva;
    const honVendTotal = honVendBase + honVendIVA;
    const sellosVend = pARS * (parseFloat(sellosVendedor) / 100);
    const escribVend = escribaniaACargoVendedor ? pARS * (parseFloat(escribania) / 100) : 0;
    const itiMonto = incluirIti ? pARS * (parseFloat(iti) / 100) : 0;

    items.push({
      label: "Honorarios corredor (vendedor)",
      parte: "vendedor",
      monto: honVendRaw,
      pct: parseFloat(honorariosVendedor),
      detalle: `+ IIBB ${fmtPct(parseFloat(iibbHonorarios))} + IVA ${fmtPct(parseFloat(ivaHonorarios))} = ${fmtMon(honVendTotal, moneda)}`,
      variante: "sub",
    });
    items.push({
      label: "IIBB + IVA sobre honorarios",
      parte: "vendedor",
      monto: honVendIIBB + honVendIVA,
      detalle: `IIBB: ${fmtMon(honVendIIBB, moneda)} · IVA: ${fmtMon(honVendIVA, moneda)}`,
      variante: "sub",
    });
    items.push({
      label: "Impuesto de Sellos (vendedor)",
      parte: "vendedor",
      monto: moneda === "ARS" ? sellosVend : sellosVend / dolarNum,
      pct: parseFloat(sellosVendedor),
      detalle: `Sobre precio en ARS: ${fmtARS(sellosVend)}`,
      variante: "sub",
    });
    if (escribaniaACargoVendedor) {
      items.push({
        label: "Escribanía (a cargo vendedor)",
        parte: "vendedor",
        monto: moneda === "ARS" ? escribVend : escribVend / dolarNum,
        pct: parseFloat(escribania),
        detalle: `${fmtPct(parseFloat(escribania))} sobre precio en ARS: ${fmtARS(escribVend)}`,
        variante: "sub",
      });
    }
    if (incluirIti) {
      items.push({
        label: "ITI (Impuesto Transf. Inmuebles)",
        parte: "vendedor",
        monto: moneda === "ARS" ? itiMonto : itiMonto / dolarNum,
        pct: parseFloat(iti),
        detalle: `${fmtPct(parseFloat(iti))} sobre precio en ARS: ${fmtARS(itiMonto)} (puede no aplicar si es casa habitual)`,
        variante: "sub",
      });
    }
    const totalVendedor = honVendTotal
      + (moneda === "ARS" ? sellosVend : sellosVend / dolarNum)
      + (escribaniaACargoVendedor ? moneda === "ARS" ? escribVend : escribVend / dolarNum : 0)
      + (incluirIti ? moneda === "ARS" ? itiMonto : itiMonto / dolarNum : 0);
    items.push({ label: "TOTAL GASTOS VENDEDOR", parte: "vendedor", monto: totalVendedor, variante: "total" });

    // ── CORREDOR ──
    const honTotalBruto = honCompRaw + honVendRaw;
    const honTotalNeto = honCompTotal + honVendTotal;
    const iibbTotal = (honCompIIBB + honVendIIBB);
    const ivaTotal = (honCompIVA + honVendIVA);
    items.push({ label: "Honorarios netos cobrados", parte: "corredor", monto: honCompRaw + honVendRaw, pct: parseFloat(honorariosComprador) + parseFloat(honorariosVendedor), variante: "sub" });
    items.push({ label: "Menos IIBB a pagar", parte: "corredor", monto: -(iibbTotal), variante: "sub", detalle: `${fmtMon(iibbTotal, moneda)} de ${fmtMon(honTotalBruto, moneda)}` });
    items.push({ label: "Menos IVA a pagar", parte: "corredor", monto: -(ivaTotal), variante: "sub", detalle: `Debita del corredor (responsable inscripto)` });
    const honorariosNetos = honTotalBruto - iibbTotal - ivaTotal;
    items.push({ label: "HONORARIOS NETOS CORREDOR", parte: "corredor", monto: honorariosNetos, variante: "total" });

    return items;
  }, [precioNum, moneda, dolarNum, honorariosComprador, honorariosVendedor, sellosComprador, sellosVendedor, escribania, iti, incluirIti, iibbHonorarios, ivaHonorarios, escribaniaACargoVendedor]);

  // ── LOCACIÓN ──────────────────────────────────────────────────────────────
  const costosLoc = useMemo((): CostoItem[] => {
    if (!alquilerNum) return [];
    const alq = alquilerNum;
    const meses = parseInt(mesesContrato) || 24;
    const totalAnual = alq * 12;
    const iibb = parseFloat(iibbLocacion) / 100;
    const iva = parseFloat(ivaLocacion) / 100;
    const items: CostoItem[] = [];

    // Locatario
    const comLocRaw = alq * parseFloat(comisionLocatario);
    const comLocIIBB = comLocRaw * iibb;
    const comLocBase = comLocRaw + comLocIIBB;
    const comLocIVA = comLocBase * iva;
    const comLocTotal = comLocBase + comLocIVA;
    const deposito = alq * parseInt(mesesDeposito);
    const sellosLoc = (alq * meses) * (parseFloat(sellosLocacion) / 100);

    items.push({
      label: `Comisión locatario (${parseFloat(comisionLocatario)} mes${parseFloat(comisionLocatario) !== 1 ? "es" : ""})`,
      parte: "locatario",
      monto: comLocRaw,
      detalle: `+ IIBB + IVA = ${fmtARS(comLocTotal)}`,
      variante: "sub",
    });
    items.push({
      label: "IIBB + IVA sobre comisión",
      parte: "locatario",
      monto: comLocIIBB + comLocIVA,
      detalle: `IIBB: ${fmtARS(comLocIIBB)} · IVA: ${fmtARS(comLocIVA)}`,
      variante: "sub",
    });
    items.push({
      label: `Depósito en garantía (${mesesDeposito} mes${parseInt(mesesDeposito) !== 1 ? "es" : ""})`,
      parte: "locatario",
      monto: deposito,
      detalle: "Reintegrable al finalizar el contrato",
      variante: "sub",
    });
    items.push({
      label: "Impuesto de Sellos",
      parte: "locatario",
      monto: sellosLoc / 2,
      pct: parseFloat(sellosLocacion) / 2,
      detalle: `Mitad del ${fmtPct(parseFloat(sellosLocacion))} sobre monto total del contrato: ${fmtARS(sellosLoc)} (50% c/parte)`,
      variante: "sub",
    });
    const totalLocatario = comLocTotal + deposito + sellosLoc / 2;
    items.push({ label: "TOTAL INICIAL LOCATARIO", parte: "locatario", monto: totalLocatario, variante: "total" });

    // Propietario
    const comPropRaw = alq * parseFloat(comisionPropietario);
    const comPropIIBB = comPropRaw * iibb;
    const comPropBase = comPropRaw + comPropIIBB;
    const comPropIVA = comPropBase * iva;
    const comPropTotal = comPropBase + comPropIVA;

    items.push({
      label: `Comisión propietario (${parseFloat(comisionPropietario)} mes${parseFloat(comisionPropietario) !== 1 ? "es" : ""})`,
      parte: "propietario",
      monto: comPropRaw,
      detalle: `+ IIBB + IVA = ${fmtARS(comPropTotal)}`,
      variante: "sub",
    });
    items.push({
      label: "IIBB + IVA sobre comisión",
      parte: "propietario",
      monto: comPropIIBB + comPropIVA,
      variante: "sub",
    });
    items.push({
      label: "Impuesto de Sellos",
      parte: "propietario",
      monto: sellosLoc / 2,
      pct: parseFloat(sellosLocacion) / 2,
      variante: "sub",
    });
    const totalPropietario = comPropTotal + sellosLoc / 2;
    items.push({ label: "TOTAL GASTOS PROPIETARIO", parte: "propietario", monto: totalPropietario, variante: "total" });

    // Corredor
    const comTotalBruto = comLocRaw + comPropRaw;
    const iibbTotal = comLocIIBB + comPropIIBB;
    const ivaTotal = comLocIVA + comPropIVA;
    const comNeta = comTotalBruto - iibbTotal - ivaTotal;
    items.push({ label: "Comisiones brutas cobradas", parte: "corredor", monto: comTotalBruto, variante: "sub" });
    items.push({ label: "Menos IIBB a pagar", parte: "corredor", monto: -iibbTotal, variante: "sub" });
    items.push({ label: "Menos IVA a pagar", parte: "corredor", monto: -ivaTotal, variante: "sub" });
    items.push({ label: "COMISIÓN NETA CORREDOR", parte: "corredor", monto: comNeta, variante: "total" });

    return items;
  }, [alquilerNum, mesesContrato, comisionLocatario, comisionPropietario, mesesDeposito, sellosLocacion, iibbLocacion, ivaLocacion]);

  const costos = tipoOp === "compraventa" ? costosCv : costosLoc;

  const partes = tipoOp === "compraventa"
    ? [{ key: "comprador" as const, label: "Comprador", color: "#3b82f6" },
       { key: "vendedor" as const, label: "Vendedor", color: "#f59e0b" },
       { key: "corredor" as const, label: "Corredor", color: "#cc0000" }]
    : [{ key: "locatario" as const, label: "Locatario", color: "#3b82f6" },
       { key: "propietario" as const, label: "Propietario", color: "#f59e0b" },
       { key: "corredor" as const, label: "Corredor", color: "#cc0000" }];

  const exportarPDF = () => {
    const formatMonto = (item: CostoItem) => {
      const m = Math.abs(item.monto);
      const prefix = item.monto < 0 ? "-" : "";
      if (tipoOp === "compraventa" && moneda === "USD") return `${prefix}USD ${Math.round(m).toLocaleString("es-AR")}`;
      return `${prefix}$ ${Math.round(m).toLocaleString("es-AR")}`;
    };

    const parteRows = partes.map(p => {
      const items = costos.filter(c => c.parte === p.key);
      return `
        <div style="margin-bottom:24px;">
          <h3 style="font-family:Montserrat,sans-serif;font-size:13px;font-weight:800;color:${p.color};letter-spacing:0.12em;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:10px;">${p.label}</h3>
          ${items.map(it => `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid #f5f5f5;">
              <div>
                <div style="font-size:12px;color:${it.variante==="total"?"#111":"#444"};font-weight:${it.variante==="total"?"800":"400"};">${it.label}</div>
                ${it.detalle ? `<div style="font-size:10px;color:#888;margin-top:2px;">${it.detalle}</div>` : ""}
              </div>
              <div style="font-size:${it.variante==="total"?"13":"12"}px;font-weight:${it.variante==="total"?"800":"600"};color:${it.monto<0?"#ef4444":it.variante==="total"?p.color:"#333"};white-space:nowrap;margin-left:12px;">${formatMonto(it)}</div>
            </div>
          `).join("")}
        </div>
      `;
    }).join("");

    const html = `<!DOCTYPE html><html>
    <head><meta charset="utf-8"><title>Cálculo de Costos — GFI®</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;600&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Inter, sans-serif; background: #fff; color: #111; padding: 40px; max-width: 720px; margin: 0 auto; }
      @media print { body { padding: 20px; } }
    </style></head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #cc0000;padding-bottom:16px;margin-bottom:24px;">
        <div>
          <div style="font-family:Montserrat,sans-serif;font-size:22px;font-weight:800;color:#111;">GFI<sup style="color:#cc0000">®</sup></div>
          <div style="font-size:10px;color:#888;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Calculadora de Costos de Operación</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:Montserrat,sans-serif;font-size:11px;font-weight:800;color:#cc0000;text-transform:uppercase;">${tipoOp === "compraventa" ? "Compraventa" : "Locación"}</div>
          <div style="font-size:11px;color:#666;margin-top:2px;">${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</div>
        </div>
      </div>
      <div style="background:#f8f8f8;border-radius:8px;padding:14px 18px;margin-bottom:24px;display:flex;gap:24px;flex-wrap:wrap;">
        ${tipoOp === "compraventa"
          ? `<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:4px;">Precio de venta</div><div style="font-family:Montserrat,sans-serif;font-size:20px;font-weight:800;color:#cc0000;">${fmtMon(precioNum, moneda)}</div></div>
             ${moneda === "USD" ? `<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:4px;">Dólar referencia</div><div style="font-size:15px;font-weight:700;color:#333;">${fmtARS(dolarNum)}</div></div>` : ""}`
          : `<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:4px;">Alquiler mensual</div><div style="font-family:Montserrat,sans-serif;font-size:20px;font-weight:800;color:#cc0000;">${fmtARS(alquilerNum)}</div></div>
             <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:4px;">Duración</div><div style="font-size:15px;font-weight:700;color:#333;">${mesesContrato} meses</div></div>`
        }
      </div>
      ${parteRows}
      <div style="margin-top:32px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px;">
        Cálculo orientativo. Los porcentajes pueden variar según acuerdo entre partes y legislación vigente. Fecha de cálculo: ${new Date().toLocaleDateString("es-AR")}.
      </div>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const S = {
    input: { width: "100%", padding: "8px 11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 13, fontFamily: "Inter,sans-serif", outline: "none", boxSizing: "border-box" as const },
    label: { fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 5 },
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 0 80px", fontFamily: "Inter,sans-serif", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap');
        .op-tab { background: none; border: none; cursor: pointer; font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; padding: 10px 20px; border-bottom: 2px solid transparent; transition: all 0.15s; }
        .op-tab.active { color: #cc0000; border-bottom-color: #cc0000; }
        .op-tab:not(.active) { color: rgba(255,255,255,0.3); }
        .op-param { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }
        .op-item:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>← CALCULADORAS</Link>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
        <div>
          <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>Calculadoras</div>
          <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>Costos de Operación</h1>
        </div>
      </div>

      {/* Tipo operación tabs */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 24, display: "flex", gap: 0 }}>
        <button className={`op-tab${tipoOp === "compraventa" ? " active" : ""}`} onClick={() => setTipoOp("compraventa")}>🏠 Compraventa</button>
        <button className={`op-tab${tipoOp === "locacion" ? " active" : ""}`} onClick={() => setTipoOp("locacion")}>🔑 Locación</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* LEFT: Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Panel principal */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>
              {tipoOp === "compraventa" ? "Datos de la operación" : "Datos del contrato"}
            </div>

            {tipoOp === "compraventa" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <div>
                    <label style={S.label}>Precio de venta</label>
                    <input value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Ej: 100000" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Moneda</label>
                    <select value={moneda} onChange={e => setMoneda(e.target.value as Moneda)} style={{ ...S.input, background: "rgba(0,0,0,0.4)" }}>
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                    </select>
                  </div>
                </div>
                {moneda === "USD" && (
                  <div>
                    <label style={S.label}>Tipo de cambio ($ ARS)</label>
                    <input value={dolarBlue} onChange={e => setDolarBlue(e.target.value)} placeholder="Ej: 1000" style={S.input} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={S.label}>Alquiler mensual (ARS)</label>
                  <input value={alquilerMensual} onChange={e => setAlquilerMensual(e.target.value)} placeholder="Ej: 350000" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Duración del contrato (meses)</label>
                  <input type="number" value={mesesContrato} onChange={e => setMesesContrato(e.target.value)} style={S.input} min="1" max="120" />
                </div>
              </div>
            )}
          </div>

          {/* Parámetros */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px" }}>
            <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
              Parámetros (% editables)
            </div>
            <div className="op-param">
              {tipoOp === "compraventa" ? (
                <>
                  <div>
                    <label style={S.label}>Honor. comprador (%)</label>
                    <input type="number" value={honorariosComprador} onChange={e => setHonorariosComprador(e.target.value)} style={S.input} step="0.5" />
                  </div>
                  <div>
                    <label style={S.label}>Honor. vendedor (%)</label>
                    <input type="number" value={honorariosVendedor} onChange={e => setHonorariosVendedor(e.target.value)} style={S.input} step="0.5" />
                  </div>
                  <div>
                    <label style={S.label}>Sellos comprador (%)</label>
                    <input type="number" value={sellosComprador} onChange={e => setSellosComprador(e.target.value)} style={S.input} step="0.25" />
                  </div>
                  <div>
                    <label style={S.label}>Sellos vendedor (%)</label>
                    <input type="number" value={sellosVendedor} onChange={e => setSellosVendedor(e.target.value)} style={S.input} step="0.25" />
                  </div>
                  <div>
                    <label style={S.label}>Escribanía (%)</label>
                    <input type="number" value={escribania} onChange={e => setEscribania(e.target.value)} style={S.input} step="0.25" />
                  </div>
                  <div>
                    <label style={S.label}>IIBB sobre honor. (%)</label>
                    <input type="number" value={iibbHonorarios} onChange={e => setIibbHonorarios(e.target.value)} style={S.input} step="0.5" />
                  </div>
                  <div>
                    <label style={S.label}>IVA sobre honor. (%)</label>
                    <input type="number" value={ivaHonorarios} onChange={e => setIvaHonorarios(e.target.value)} style={S.input} step="1" />
                  </div>
                  <div>
                    <label style={S.label}>ITI (%)</label>
                    <input type="number" value={iti} onChange={e => setIti(e.target.value)} style={S.input} step="0.25" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={S.label}>Comisión locatario (meses)</label>
                    <input type="number" value={comisionLocatario} onChange={e => setComisionLocatario(e.target.value)} style={S.input} step="0.5" />
                  </div>
                  <div>
                    <label style={S.label}>Comisión propietario (meses)</label>
                    <input type="number" value={comisionPropietario} onChange={e => setComisionPropietario(e.target.value)} style={S.input} step="0.5" />
                  </div>
                  <div>
                    <label style={S.label}>Depósito (meses)</label>
                    <input type="number" value={mesesDeposito} onChange={e => setMesesDeposito(e.target.value)} style={S.input} min="0" max="12" />
                  </div>
                  <div>
                    <label style={S.label}>Sellos sobre monto total (%)</label>
                    <input type="number" value={sellosLocacion} onChange={e => setSellosLocacion(e.target.value)} style={S.input} step="0.1" />
                  </div>
                  <div>
                    <label style={S.label}>IIBB sobre comisión (%)</label>
                    <input type="number" value={iibbLocacion} onChange={e => setIibbLocacion(e.target.value)} style={S.input} step="0.5" />
                  </div>
                  <div>
                    <label style={S.label}>IVA sobre comisión (%)</label>
                    <input type="number" value={ivaLocacion} onChange={e => setIvaLocacion(e.target.value)} style={S.input} step="1" />
                  </div>
                </>
              )}
            </div>
            {tipoOp === "compraventa" && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  <input type="checkbox" checked={incluirIti} onChange={e => setIncluirIti(e.target.checked)} style={{ accentColor: "#cc0000" }} />
                  Incluir ITI (vendedor)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  <input type="checkbox" checked={escribaniaACargoVendedor} onChange={e => setEscribaniaACargoVendedor(e.target.checked)} style={{ accentColor: "#cc0000" }} />
                  Escribanía a cargo del vendedor
                </label>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Resultados */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(!precioNum && tipoOp === "compraventa") || (!alquilerNum && tipoOp === "locacion") ? (
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "48px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🧮</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif" }}>
                Ingresá {tipoOp === "compraventa" ? "el precio de venta" : "el alquiler mensual"} para ver el cálculo
              </div>
            </div>
          ) : (
            <>
              {/* Export button */}
              <button onClick={exportarPDF} style={{ padding: "10px 18px", background: "#cc0000", border: "none", color: "#fff", borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: "Montserrat,sans-serif", cursor: "pointer", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 7, alignSelf: "flex-end" }}>
                📄 Exportar PDF
              </button>

              {partes.map(p => {
                const pItems = costos.filter(c => c.parte === p.key);
                const total = pItems.find(i => i.variante === "total");
                const isOpen = expandido === p.key;
                return (
                  <div key={p.key} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${isOpen ? `${p.color}30` : "rgba(255,255,255,0.07)"}`, borderRadius: 10, overflow: "hidden" }}>
                    <button
                      onClick={() => setExpandido(isOpen ? null : p.key)}
                      style={{ width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", gap: 10 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>{p.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {total && <span style={{ fontSize: 16, fontFamily: "Montserrat,sans-serif", fontWeight: 900, color: total.monto < 0 ? "#ef4444" : p.color }}>{tipoOp === "compraventa" ? fmtMon(Math.abs(total.monto), moneda) : fmtARS(Math.abs(total.monto))}</span>}
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {pItems.map((item, i) => (
                          <div key={i} className="op-item" style={{
                            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
                            padding: "10px 18px",
                            borderBottom: i < pItems.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            background: item.variante === "total" ? `${p.color}10` : "transparent",
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: item.variante === "total" ? 11 : 11, fontFamily: "Montserrat,sans-serif", fontWeight: item.variante === "total" ? 800 : 500, color: item.variante === "total" ? "#fff" : "rgba(255,255,255,0.55)" }}>
                                {item.label}
                                {item.pct ? <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginLeft: 6 }}>{fmtPct(item.pct)}</span> : null}
                              </div>
                              {item.detalle && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2, lineHeight: 1.4 }}>{item.detalle}</div>}
                            </div>
                            <div style={{ fontSize: item.variante === "total" ? 13 : 12, fontFamily: "Montserrat,sans-serif", fontWeight: item.variante === "total" ? 900 : 600, color: item.monto < 0 ? "#ef4444" : item.variante === "total" ? p.color : "rgba(255,255,255,0.7)", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {item.monto < 0 ? "- " : ""}{tipoOp === "compraventa" ? fmtMon(Math.abs(item.monto), moneda) : fmtARS(Math.abs(item.monto))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", fontFamily: "Montserrat,sans-serif", lineHeight: 1.6, padding: "8px 0" }}>
                Cálculo orientativo. Los porcentajes pueden variar según acuerdo entre partes y normativa vigente. IIBB puede diferir según provincia y régimen tributario del corredor.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
