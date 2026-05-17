"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

type TipoOp = "venta" | "alquiler" | "alquiler_temporal";
type Moneda = "USD" | "ARS";

const TIPO_LABELS: Record<TipoOp, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alquiler Temporario",
};

const HON_DEFAULT: Record<TipoOp, { vendedor: number; comprador: number }> = {
  venta:             { vendedor: 3, comprador: 3 },
  alquiler:          { vendedor: 5, comprador: 5 }, // % del primer mes / mes de comisión
  alquiler_temporal: { vendedor: 10, comprador: 0 },
};

interface Participante {
  id: string;
  nombre: string;
  rol: "agente_interno" | "inmobiliaria_externa" | "referidor";
  lado: "vendedor" | "comprador" | "ambos";
  pct: number; // % del total de honorarios de su lado que le corresponde
}

export default function HonorariosCompartidosPage() {
  const [tipoOp, setTipoOp] = useState<TipoOp>("venta");
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [valorOp, setValorOp] = useState(150000);
  const [tc, setTc] = useState(1300);
  const [honVendedorPct, setHonVendedorPct] = useState(HON_DEFAULT.venta.vendedor);
  const [honCompradorPct, setHonCompradorPct] = useState(HON_DEFAULT.venta.comprador);
  const [ivaIncluido, setIvaIncluido] = useState(true); // si el % ya incluye IVA o se agrega aparte
  const [ivaPct] = useState(21);
  const [participantes, setParticipantes] = useState<Participante[]>([
    { id: "p1", nombre: "Agente 1 (interno)", rol: "agente_interno", lado: "vendedor", pct: 50 },
    { id: "p2", nombre: "Agente 2 (interno)", rol: "agente_interno", lado: "comprador", pct: 50 },
  ]);

  const updPart = (id: string, cambios: Partial<Participante>) =>
    setParticipantes(prev => prev.map(p => p.id === id ? { ...p, ...cambios } : p));

  const addPart = () => {
    setParticipantes(prev => [...prev, {
      id: `p${Date.now()}`,
      nombre: `Participante ${prev.length + 1}`,
      rol: "agente_interno",
      lado: "vendedor",
      pct: 50,
    }]);
  };

  const delPart = (id: string) =>
    setParticipantes(prev => prev.filter(p => p.id !== id));

  const calcs = useMemo(() => {
    const valorUSD = moneda === "USD" ? valorOp : valorOp / tc;
    const valorARS = moneda === "ARS" ? valorOp : valorOp * tc;

    // Honorarios brutos (sobre valor de operación)
    const honVendedorBruto = valorUSD * (honVendedorPct / 100);
    const honCompradorBruto = valorUSD * (honCompradorPct / 100);
    const honTotalBruto = honVendedorBruto + honCompradorBruto;

    // IVA
    const factorIVA = ivaIncluido ? 1 : 1 + ivaPct / 100;
    const honVendedorConIVA = honVendedorBruto * factorIVA;
    const honCompradorConIVA = honCompradorBruto * factorIVA;
    const honTotalConIVA = honTotalBruto * factorIVA;

    // Distribución por participante
    const porPart = participantes.map(p => {
      const baseUSD = p.lado === "vendedor" ? honVendedorBruto
        : p.lado === "comprador" ? honCompradorBruto
        : honTotalBruto;
      const montoUSD = baseUSD * (p.pct / 100);
      const montoARS = montoUSD * tc;
      const montoConIVA = montoUSD * factorIVA;
      return { ...p, baseUSD, montoUSD, montoARS, montoConIVA };
    });

    // Chequeo: suma de % por lado
    const pctVendedor = participantes.filter(p => p.lado === "vendedor" || p.lado === "ambos").reduce((s, p) => s + (p.lado === "ambos" ? p.pct / 2 : p.pct), 0);
    const pctComprador = participantes.filter(p => p.lado === "comprador" || p.lado === "ambos").reduce((s, p) => s + (p.lado === "ambos" ? p.pct / 2 : p.pct), 0);

    const totalParticipantesUSD = porPart.reduce((s, p) => s + p.montoUSD, 0);

    return {
      valorUSD, valorARS,
      honVendedorBruto, honCompradorBruto, honTotalBruto,
      honVendedorConIVA, honCompradorConIVA, honTotalConIVA,
      porPart, pctVendedor, pctComprador,
      totalParticipantesUSD,
    };
  }, [valorOp, moneda, tc, honVendedorPct, honCompradorPct, ivaIncluido, ivaPct, participantes]);

  const ROL_COLORS: Record<string, string> = {
    agente_interno: "#3b82f6",
    inmobiliaria_externa: "#f97316",
    referidor: "#a855f7",
  };

  const ROL_LABELS: Record<string, string> = {
    agente_interno: "Agente interno",
    inmobiliaria_externa: "Inmobiliaria externa",
    referidor: "Referidor",
  };

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Liquidación Honorarios</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:700px;margin:0 auto}
    h1{font-size:20px;font-weight:800;margin-bottom:4px}
    .sub{color:#666;font-size:12px;margin-bottom:20px}
    .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
    .kpi{background:#f5f5f5;border-radius:6px;padding:10px 12px}
    .kpi-label{font-size:10px;color:#666;margin-bottom:2px}
    .kpi-value{font-size:16px;font-weight:800}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#111;color:#fff;padding:8px 10px;text-align:left}
    td{padding:8px 10px;border-bottom:1px solid #eee}
    .total-row{font-weight:800;background:#f9f9f9}
    </style></head><body>
    <h1>Liquidación de Honorarios</h1>
    <div class="sub">${TIPO_LABELS[tipoOp]} · ${moneda} ${fmt(valorOp)} · ${new Date().toLocaleDateString("es-AR")}</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Hon. vendedor (${honVendedorPct}%)</div><div class="kpi-value">USD ${fmt(Math.round(calcs.honVendedorBruto))}</div></div>
      <div class="kpi"><div class="kpi-label">Hon. comprador (${honCompradorPct}%)</div><div class="kpi-value">USD ${fmt(Math.round(calcs.honCompradorBruto))}</div></div>
      <div class="kpi"><div class="kpi-label">Total honorarios</div><div class="kpi-value">USD ${fmt(Math.round(calcs.honTotalConIVA))}</div></div>
    </div>
    <table>
      <thead><tr><th>Participante</th><th>Rol</th><th>Lado</th><th>%</th><th>USD (s/IVA)</th><th>ARS</th></tr></thead>
      <tbody>
        ${calcs.porPart.map(p => `<tr><td>${p.nombre}</td><td>${ROL_LABELS[p.rol]}</td><td>${p.lado}</td><td>${p.pct}%</td><td>USD ${fmt(Math.round(p.montoUSD))}</td><td>ARS ${fmt(Math.round(p.montoARS))}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="4">TOTAL</td><td>USD ${fmt(Math.round(calcs.totalParticipantesUSD))}</td><td>ARS ${fmt(Math.round(calcs.totalParticipantesUSD * tc))}</td></tr>
      </tbody>
    </table>
    <p style="font-size:10px;color:#999;margin-top:20px">Calculado con GFI® Grupo Foro Inmobiliario · ${ivaIncluido ? "% incluye IVA" : `IVA ${ivaPct}% agregado`}</p>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>🤝 Honorarios Compartidos</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Liquidación de honorarios con co-broking y múltiples participantes</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Hon. vendedor", value: `USD ${fmt(Math.round(calcs.honVendedorBruto))}`, sub: `${honVendedorPct}%`, color: "#cc0000" },
            { label: "Hon. comprador", value: `USD ${fmt(Math.round(calcs.honCompradorBruto))}`, sub: `${honCompradorPct}%`, color: "#f97316" },
            { label: "Total s/IVA", value: `USD ${fmt(Math.round(calcs.honTotalBruto))}`, sub: "", color: "#e5e5e5" },
            { label: "Total c/IVA", value: `USD ${fmt(Math.round(calcs.honTotalConIVA))}`, sub: "", color: "#22c55e" },
            { label: "Total en ARS", value: `ARS ${fmt(Math.round(calcs.honTotalConIVA * tc / 1000))}k`, sub: "", color: "#3b82f6" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: k.color }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: 10, color: "#4b5563" }}>{k.sub} del valor</div>}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
          {/* Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Operación</div>

              {/* Tipo */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Tipo</label>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {(Object.keys(TIPO_LABELS) as TipoOp[]).map(t => (
                    <button key={t} onClick={() => {
                      setTipoOp(t);
                      setHonVendedorPct(HON_DEFAULT[t].vendedor);
                      setHonCompradorPct(HON_DEFAULT[t].comprador);
                    }}
                      style={{ background: tipoOp === t ? "#1f2937" : "transparent", border: `1px solid ${tipoOp === t ? "#374151" : "#222"}`, borderRadius: 5, color: tipoOp === t ? "#e5e5e5" : "#6b7280", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      {TIPO_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor + moneda */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Valor de operación</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="number" value={valorOp} step={1000}
                    onChange={e => setValorOp(parseFloat(e.target.value) || 0)}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, flex: 1, boxSizing: "border-box" }} />
                  <select value={moneda} onChange={e => setMoneda(e.target.value as Moneda)}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 12 }}>
                    <option>USD</option><option>ARS</option>
                  </select>
                </div>
              </div>

              {/* TC */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>TC ARS/USD</label>
                <input type="number" value={tc} step={50}
                  onChange={e => setTc(parseFloat(e.target.value) || 1)}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
              </div>

              {/* Honorarios */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#cc0000", display: "block", marginBottom: 3 }}>Hon. vendedor (%)</label>
                  <input type="number" value={honVendedorPct} step={0.5} min={0} max={20}
                    onChange={e => setHonVendedorPct(parseFloat(e.target.value) || 0)}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#f97316", display: "block", marginBottom: 3 }}>Hon. comprador (%)</label>
                  <input type="number" value={honCompradorPct} step={0.5} min={0} max={20}
                    onChange={e => setHonCompradorPct(parseFloat(e.target.value) || 0)}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* IVA */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setIvaIncluido(v => !v)}
                  style={{ background: ivaIncluido ? "rgba(34,197,94,0.1)" : "transparent", border: `1px solid ${ivaIncluido ? "rgba(34,197,94,0.4)" : "#333"}`, borderRadius: 5, color: ivaIncluido ? "#22c55e" : "#6b7280", padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                  {ivaIncluido ? "✓ " : ""}IVA incluido en %
                </button>
                {!ivaIncluido && <span style={{ fontSize: 11, color: "#6b7280" }}>+21% se suma</span>}
              </div>
            </div>

            <button onClick={exportarPDF}
              style={{ background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", padding: "10px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 800, letterSpacing: "0.08em" }}>
              🖨️ Exportar liquidación PDF
            </button>
          </div>

          {/* Participantes */}
          <div>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Participantes y distribución
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6b7280" }}>
                  <span>Vendedor: <strong style={{ color: calcs.pctVendedor > 100 ? "#cc0000" : calcs.pctVendedor === 100 ? "#22c55e" : "#f97316" }}>{Math.round(calcs.pctVendedor)}%</strong></span>
                  <span>Comprador: <strong style={{ color: calcs.pctComprador > 100 ? "#cc0000" : calcs.pctComprador === 100 ? "#22c55e" : "#f97316" }}>{Math.round(calcs.pctComprador)}%</strong></span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {calcs.porPart.map((p, i) => (
                  <div key={p.id} style={{ background: "#0a0a0a", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap" }}>
                      <input value={p.nombre} onChange={e => updPart(p.id, { nombre: e.target.value })}
                        style={{ background: "#111", border: "1px solid #222", borderRadius: 5, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, flex: 1, minWidth: 120 }} />
                      <select value={p.rol} onChange={e => updPart(p.id, { rol: e.target.value as Participante["rol"] })}
                        style={{ background: "#111", border: "1px solid #222", borderRadius: 5, color: ROL_COLORS[p.rol], padding: "5px 8px", fontSize: 11 }}>
                        <option value="agente_interno">Agente interno</option>
                        <option value="inmobiliaria_externa">Inmobiliaria externa</option>
                        <option value="referidor">Referidor</option>
                      </select>
                      <select value={p.lado} onChange={e => updPart(p.id, { lado: e.target.value as Participante["lado"] })}
                        style={{ background: "#111", border: "1px solid #222", borderRadius: 5, color: "#9ca3af", padding: "5px 8px", fontSize: 11 }}>
                        <option value="vendedor">Vendedor</option>
                        <option value="comprador">Comprador</option>
                        <option value="ambos">Ambos lados</option>
                      </select>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="number" value={p.pct} step={5} min={0} max={100}
                          onChange={e => updPart(p.id, { pct: parseFloat(e.target.value) || 0 })}
                          style={{ background: "#111", border: "1px solid #222", borderRadius: 5, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: 60 }} />
                        <span style={{ color: "#6b7280", fontSize: 12 }}>%</span>
                      </div>
                      {participantes.length > 1 && (
                        <button onClick={() => delPart(p.id)}
                          style={{ background: "transparent", border: "1px solid #cc000033", borderRadius: 5, color: "#cc0000", padding: "5px 8px", fontSize: 11, cursor: "pointer" }}>×</button>
                      )}
                    </div>
                    {/* Barra + montos */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 3, height: 5, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(p.montoUSD / Math.max(calcs.honTotalBruto, 1) * 100, 100)}%`, height: "100%", background: ROL_COLORS[p.rol], transition: "width 0.3s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#e5e5e5" }}>USD {fmt(Math.round(p.montoUSD))}</span>
                        <span style={{ color: "#3b82f6" }}>ARS {fmt(Math.round(p.montoARS / 1000))}k</span>
                        {!ivaIncluido && <span style={{ color: "#22c55e" }}>c/IVA USD {fmt(Math.round(p.montoConIVA))}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addPart}
                style={{ marginTop: 12, width: "100%", background: "transparent", border: "1px dashed #374151", borderRadius: 8, color: "#6b7280", padding: "10px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                + Agregar participante
              </button>

              {/* Total */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#9ca3af", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Total distribuido</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 20, color: "#22c55e" }}>
                    USD {fmt(Math.round(calcs.totalParticipantesUSD))}
                  </div>
                  <div style={{ fontSize: 11, color: "#3b82f6" }}>
                    ARS {fmt(Math.round(calcs.totalParticipantesUSD * tc / 1000))}k
                  </div>
                </div>
              </div>
            </div>

            {/* Info por rol */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 14px", marginTop: 10, fontSize: 11, color: "#6b7280" }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {Object.entries(ROL_COLORS).map(([rol, color]) => (
                  <span key={rol} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
                    {ROL_LABELS[rol]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
