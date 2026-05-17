"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Inversor {
  id: number;
  nombre: string;
  aporte: number;
  moneda: string;
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

type Tipo = "desarrollo" | "alquiler" | "mixto";

let nextId = 1;

export default function FideicomisoPage() {
  const [nombre, setNombre] = useState("Fideicomiso Inmobiliario");
  const [tipo, setTipo] = useState<Tipo>("desarrollo");
  const [inversores, setInversores] = useState<Inversor[]>([
    { id: nextId++, nombre: "Inversor A", aporte: 100000, moneda: "USD" },
    { id: nextId++, nombre: "Inversor B", aporte: 50000, moneda: "USD" },
  ]);
  const [tc, setTc] = useState(1300);
  // Desarrollo
  const [costoTerreno, setCostoTerreno] = useState(200000);
  const [costoConstructivo, setCostoConstructivo] = useState(300000);
  const [gastosComerciales, setGastosComerciales] = useState(30000);
  const [gastosAdmin, setGastosAdmin] = useState(20000);
  const [precioVenta, setPrecioVenta] = useState(700000);
  const [plazoMeses, setPlazoMeses] = useState(36);
  const [honorariosFiduc, setHonorariosFiduc] = useState(3); // % sobre ventas
  // Alquiler
  const [valorInmueble, setValorInmueble] = useState(500000);
  const [alqMensual, setAlqMensual] = useState(2500);
  const [vacancia, setVacancia] = useState(8);
  const [opex, setOpex] = useState(15); // % del ingreso bruto
  const [apreciacion, setApreciacion] = useState(5);
  const [horizonte, setHorizonte] = useState(5);
  const [distribucionPct, setDistribucionPct] = useState(80); // % de renta a distribuir

  const addInversor = () => setInversores(prev => [...prev, { id: nextId++, nombre: `Inversor ${prev.length + 1}`, aporte: 0, moneda: "USD" }]);
  const removeInversor = (id: number) => setInversores(prev => prev.filter(i => i.id !== id));
  const updateInversor = (id: number, key: keyof Inversor, val: string | number) =>
    setInversores(prev => prev.map(i => i.id === id ? { ...i, [key]: val } : i));

  const aporteUSD = (inv: Inversor) => inv.moneda === "ARS" ? inv.aporte / tc : inv.aporte;

  const totalCapital = useMemo(() => inversores.reduce((s, i) => s + aporteUSD(i), 0), [inversores, tc]);

  const participaciones = useMemo(() => inversores.map(inv => ({
    inv,
    usd: aporteUSD(inv),
    pct: totalCapital > 0 ? (aporteUSD(inv) / totalCapital) * 100 : 0,
  })), [inversores, totalCapital, tc]);

  // ── DESARROLLO ───────────────────────────────────────────────────────────────
  const analisisDesarrollo = useMemo(() => {
    const costoTotal = costoTerreno + costoConstructivo + gastosComerciales + gastosAdmin;
    const honFiduc = precioVenta * honorariosFiduc / 100;
    const utilidadBruta = precioVenta - costoTotal - honFiduc;
    const roi = costoTotal > 0 ? (utilidadBruta / costoTotal) * 100 : 0;
    const roiAnual = plazoMeses > 0 ? (roi / plazoMeses) * 12 : 0;
    const distribucionTotal = utilidadBruta; // se distribuye todo
    const porInversor = participaciones.map(p => ({
      ...p,
      retorno: distribucionTotal * p.pct / 100,
      totalRecibido: p.usd + distribucionTotal * p.pct / 100,
    }));
    return { costoTotal, honFiduc, utilidadBruta, roi, roiAnual, distribucionTotal, porInversor };
  }, [costoTerreno, costoConstructivo, gastosComerciales, gastosAdmin, precioVenta, honorariosFiduc, plazoMeses, participaciones]);

  // ── ALQUILER ─────────────────────────────────────────────────────────────────
  const analisisAlquiler = useMemo(() => {
    const ingresosBrutos = alqMensual * 12 * (1 - vacancia / 100);
    const opexAnual = ingresosBrutos * opex / 100;
    const noiAnual = ingresosBrutos - opexAnual;
    const distribAnual = noiAnual * distribucionPct / 100;
    const rentaNeta = valorInmueble > 0 ? (noiAnual / valorInmueble) * 100 : 0;

    const años = Array.from({ length: horizonte }, (_, i) => {
      const año = i + 1;
      const factorAprec = Math.pow(1 + apreciacion / 100, año);
      const valorFuturo = valorInmueble * factorAprec;
      const ingresosBrutosA = alqMensual * 12 * (1 - vacancia / 100) * factorAprec;
      const opexA = ingresosBrutosA * opex / 100;
      const noiA = ingresosBrutosA - opexA;
      const distribA = noiA * distribucionPct / 100;
      return { año, valorFuturo, ingresosBrutosA, noiA, distribA };
    });

    const valorFinal = años[años.length - 1]?.valorFuturo ?? valorInmueble;
    const plusvalia = valorFinal - valorInmueble;
    const distribAcum = años.reduce((s, a) => s + a.distribA, 0);
    const retornoTotal = distribAcum + plusvalia;
    const roiTotal = valorInmueble > 0 ? (retornoTotal / valorInmueble) * 100 : 0;
    const roiAnual = horizonte > 0 ? roiTotal / horizonte : 0;

    const porInversor = participaciones.map(p => ({
      ...p,
      distribAnual: distribAnual * p.pct / 100,
      retornoTotal: retornoTotal * p.pct / 100,
    }));

    return { ingresosBrutos, opexAnual, noiAnual, distribAnual, rentaNeta, años, valorFinal, plusvalia, distribAcum, retornoTotal, roiTotal, roiAnual, porInversor };
  }, [alqMensual, vacancia, opex, valorInmueble, apreciacion, horizonte, distribucionPct, participaciones]);

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const filas = participaciones.map(p => {
      const ret = tipo === "desarrollo"
        ? analisisDesarrollo.porInversor.find(x => x.inv.id === p.inv.id)
        : analisisAlquiler.porInversor.find(x => x.inv.id === p.inv.id);
      return `<tr>
        <td style="padding:5px;border:1px solid #ddd">${p.inv.nombre}</td>
        <td style="padding:5px;border:1px solid #ddd;text-align:right">USD ${fmt(p.usd)}</td>
        <td style="padding:5px;border:1px solid #ddd;text-align:right">${p.pct.toFixed(1)}%</td>
        <td style="padding:5px;border:1px solid #ddd;text-align:right">${tipo === "desarrollo"
          ? `USD ${fmt((ret as typeof analisisDesarrollo.porInversor[number])?.retorno ?? 0)}`
          : `USD ${fmt((ret as typeof analisisAlquiler.porInversor[number])?.retornoTotal ?? 0)}`}
        </td>
      </tr>`;
    }).join("");
    win.document.write(`<html><body style="font-family:sans-serif;padding:24px;font-size:12px">
      <h2>${nombre} — Tipo: ${tipo}</h2>
      <p>Capital total: USD ${fmt(totalCapital)}</p>
      <table border="0" cellpadding="0" style="width:100%;border-collapse:collapse">
        <thead><tr><th style="padding:5px;border:1px solid #ddd;text-align:left">Inversor</th><th style="padding:5px;border:1px solid #ddd;text-align:right">Aporte USD</th><th style="padding:5px;border:1px solid #ddd;text-align:right">%</th><th style="padding:5px;border:1px solid #ddd;text-align:right">Retorno</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const inpStyle = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const };
  const lblStyle = { fontSize: 11, color: "#6b7280", fontWeight: 600 as const, display: "block" as const, marginBottom: 3 };
  const selStyle = { ...inpStyle };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🏛️ Fideicomiso Inmobiliario
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Simulá participaciones, distribución de utilidades y retorno por inversor</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/calculadoras" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
            <button onClick={exportarPDF} style={{ background: "#cc000022", color: "#cc0000", border: "1px solid #cc000044", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
          </div>
        </div>

        {/* Config general */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><label style={lblStyle}>Nombre del fideicomiso</label><input value={nombre} onChange={e => setNombre(e.target.value)} style={inpStyle} /></div>
            <div><label style={lblStyle}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as Tipo)} style={selStyle}>
                <option value="desarrollo">Desarrollo / Venta</option>
                <option value="alquiler">Renta / Alquiler</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
            <div><label style={lblStyle}>TC USD/ARS</label><input type="number" value={tc} onChange={e => setTc(parseFloat(e.target.value) || 1)} style={inpStyle} /></div>
          </div>
        </div>

        {/* Inversores */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Inversores ({inversores.length})</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Capital total: <strong style={{ color: "#22c55e" }}>USD {fmt(totalCapital)}</strong></span>
              <button onClick={addInversor} style={{ background: "#cc000022", color: "#cc0000", border: "1px solid #cc000044", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>+ Agregar</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inversores.map((inv, idx) => (
              <div key={inv.id} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <div style={{ flex: 2 }}>
                  {idx === 0 && <label style={lblStyle}>Nombre</label>}
                  <input value={inv.nombre} onChange={e => updateInversor(inv.id, "nombre", e.target.value)} style={inpStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  {idx === 0 && <label style={lblStyle}>Aporte</label>}
                  <input type="number" value={inv.aporte} onChange={e => updateInversor(inv.id, "aporte", parseFloat(e.target.value) || 0)} style={inpStyle} />
                </div>
                <div style={{ width: 80 }}>
                  {idx === 0 && <label style={lblStyle}>Moneda</label>}
                  <select value={inv.moneda} onChange={e => updateInversor(inv.id, "moneda", e.target.value)} style={selStyle}><option>USD</option><option>ARS</option></select>
                </div>
                <div style={{ width: 60, textAlign: "center" }}>
                  {idx === 0 && <label style={lblStyle}>%</label>}
                  <div style={{ padding: "6px 0", fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>
                    {totalCapital > 0 ? ((aporteUSD(inv) / totalCapital) * 100).toFixed(1) : "0.0"}%
                  </div>
                </div>
                {inversores.length > 1 && (
                  <button onClick={() => removeInversor(inv.id)} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16, marginBottom: 4 }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Parámetros según tipo */}
        {(tipo === "desarrollo" || tipo === "mixto") && (
          <div style={{ background: "#111", border: "1px solid #3b82f633", borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#3b82f6", marginBottom: 14 }}>🏗️ Parámetros de Desarrollo</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              {[
                { label: "Terreno (USD)", val: costoTerreno, set: setCostoTerreno },
                { label: "Costo constructivo (USD)", val: costoConstructivo, set: setCostoConstructivo },
                { label: "Gastos comerciales (USD)", val: gastosComerciales, set: setGastosComerciales },
                { label: "Gastos admin (USD)", val: gastosAdmin, set: setGastosAdmin },
                { label: "Precio venta (USD)", val: precioVenta, set: setPrecioVenta },
                { label: "Plazo (meses)", val: plazoMeses, set: setPlazoMeses },
                { label: "Honorarios fiduciario (%)", val: honorariosFiduc, set: setHonorariosFiduc, step: 0.5 },
              ].map(f => (
                <div key={f.label}><label style={lblStyle}>{f.label}</label>
                  <input type="number" value={f.val} step={f.step ?? 1} onChange={e => f.set(parseFloat(e.target.value) || 0)} style={inpStyle} />
                </div>
              ))}
            </div>
            {/* Resultado desarrollo */}
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
              {[
                { label: "Costo Total", val: `USD ${fmt(analisisDesarrollo.costoTotal)}`, color: "#cc0000" },
                { label: "Hon. Fiduciario", val: `USD ${fmt(analisisDesarrollo.honFiduc)}`, color: "#f97316" },
                { label: "Utilidad Bruta", val: `USD ${fmt(analisisDesarrollo.utilidadBruta)}`, color: "#22c55e" },
                { label: "ROI Total", val: `${analisisDesarrollo.roi.toFixed(1)}%`, color: "#3b82f6" },
                { label: "ROI Anualizado", val: `${analisisDesarrollo.roiAnual.toFixed(1)}%`, color: "#a855f7" },
              ].map(k => (
                <div key={k.label} style={{ background: "#0a0a0a", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(tipo === "alquiler" || tipo === "mixto") && (
          <div style={{ background: "#111", border: "1px solid #22c55e33", borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#22c55e", marginBottom: 14 }}>🏠 Parámetros de Renta</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              {[
                { label: "Valor inmueble (USD)", val: valorInmueble, set: setValorInmueble },
                { label: "Alquiler mensual (USD)", val: alqMensual, set: setAlqMensual },
                { label: "Vacancia (%)", val: vacancia, set: setVacancia, step: 0.5 },
                { label: "OpEx (% ingreso bruto)", val: opex, set: setOpex, step: 0.5 },
                { label: "Apreciación (%/año)", val: apreciacion, set: setApreciacion, step: 0.5 },
                { label: "Horizonte (años)", val: horizonte, set: setHorizonte },
                { label: "Distribución (%)", val: distribucionPct, set: setDistribucionPct },
              ].map(f => (
                <div key={f.label}><label style={lblStyle}>{f.label}</label>
                  <input type="number" value={f.val} step={f.step ?? 1} onChange={e => f.set(parseFloat(e.target.value) || 0)} style={inpStyle} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
              {[
                { label: "NOI Anual", val: `USD ${fmt(analisisAlquiler.noiAnual)}`, color: "#22c55e" },
                { label: "Renta Neta", val: `${analisisAlquiler.rentaNeta.toFixed(2)}%`, color: "#3b82f6" },
                { label: "Plusvalía", val: `USD ${fmt(analisisAlquiler.plusvalia)}`, color: "#a855f7" },
                { label: `ROI ${horizonte}a`, val: `${analisisAlquiler.roiTotal.toFixed(1)}%`, color: "#f97316" },
                { label: "ROI Anual", val: `${analisisAlquiler.roiAnual.toFixed(1)}%`, color: "#eab308" },
              ].map(k => (
                <div key={k.label} style={{ background: "#0a0a0a", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribución por inversor */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Distribución por Inversor</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#161616" }}>
                  <th style={{ padding: "8px 14px", textAlign: "left", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>Inversor</th>
                  <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>Aporte USD</th>
                  <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>%</th>
                  {(tipo === "desarrollo" || tipo === "mixto") && <>
                    <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>Retorno</th>
                    <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>Total recibido</th>
                  </>}
                  {tipo === "alquiler" && <>
                    <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>Distrib./año</th>
                    <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>Retorno total</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {participaciones.map((p, i) => {
                  const dDes = analisisDesarrollo.porInversor.find(x => x.inv.id === p.inv.id);
                  const dAlq = analisisAlquiler.porInversor.find(x => x.inv.id === p.inv.id);
                  return (
                    <tr key={p.inv.id} style={{ background: i % 2 === 0 ? "#0f0f0f" : "#111", borderBottom: "1px solid #1f2937" }}>
                      <td style={{ padding: "9px 14px", fontWeight: 600, color: "#e5e5e5" }}>{p.inv.nombre}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: "#9ca3af" }}>USD {fmt(p.usd)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: "#3b82f6", fontWeight: 700 }}>{p.pct.toFixed(1)}%</td>
                      {(tipo === "desarrollo" || tipo === "mixto") && <>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#22c55e", fontWeight: 700 }}>USD {fmt(dDes?.retorno ?? 0)}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#e5e5e5", fontWeight: 700 }}>USD {fmt(dDes?.totalRecibido ?? 0)}</td>
                      </>}
                      {tipo === "alquiler" && <>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#22c55e", fontWeight: 700 }}>USD {fmt(dAlq?.distribAnual ?? 0)}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#a855f7", fontWeight: 700 }}>USD {fmt(dAlq?.retornoTotal ?? 0)}</td>
                      </>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Proyección anual alquiler */}
        {tipo === "alquiler" && analisisAlquiler.años.length > 0 && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Proyección Anual</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#161616" }}>
                    {["Año", "Valor inmueble", "Ing. brutos", "NOI", "Distribución"].map(h => (
                      <th key={h} style={{ padding: "7px 12px", textAlign: "right", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analisisAlquiler.años.map((a, i) => (
                    <tr key={a.año} style={{ background: i % 2 === 0 ? "#0f0f0f" : "#111" }}>
                      <td style={{ padding: "6px 12px", textAlign: "right", color: "#6b7280" }}>{a.año}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", color: "#9ca3af" }}>USD {fmt(a.valorFuturo)}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", color: "#9ca3af" }}>USD {fmt(a.ingresosBrutosA)}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", color: "#22c55e" }}>USD {fmt(a.noiA)}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", color: "#3b82f6", fontWeight: 700 }}>USD {fmt(a.distribA)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
