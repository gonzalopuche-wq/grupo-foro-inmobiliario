"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  fecha_cierre: string | null;
  created_at: string;
}

// ── probabilidades de cierre por etapa ────────────────────────────────────────
const PROB_BASE: Record<string, number> = {
  prospecto:          0.05,
  contactado:         0.10,
  visita_coordinada:  0.20,
  visita_realizada:   0.35,
  oferta_enviada:     0.55,
  negociacion:        0.70,
  reserva:            0.90,
  escritura:          0.97,
  cerrado:            1.00,
  perdido:            0.00,
};

const PROB_OPT:  Record<string, number> = Object.fromEntries(
  Object.entries(PROB_BASE).map(([k, v]) => [k, Math.min(1, v * 1.35)])
);
const PROB_PES:  Record<string, number> = Object.fromEntries(
  Object.entries(PROB_BASE).map(([k, v]) => [k, v * 0.65])
);

// ── tiempo promedio hasta cierre por etapa (meses) ────────────────────────────
const MESES_ETAPA: Record<string, number> = {
  prospecto: 6, contactado: 5, visita_coordinada: 4, visita_realizada: 3,
  oferta_enviada: 2, negociacion: 1.5, reserva: 1, escritura: 0.5,
  cerrado: 0, perdido: 0,
};

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtUSD = (n: number) => `USD ${Math.round(n).toLocaleString("es-AR")}`;
const fmtARS = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const fmtMon = (n: number, m = "USD") => m === "USD" ? fmtUSD(n) : fmtARS(n);
const fmtPct = (n: number) => (n * 100).toFixed(0) + "%";

const MESES_NOMBRES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const labelMes = (offset: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return MESES_NOMBRES[d.getMonth()] + " " + d.getFullYear();
};

const ETAPA_COLOR: Record<string, string> = {
  prospecto: "#6b7280", contactado: "#3b82f6", visita_coordinada: "#8b5cf6",
  visita_realizada: "#a78bfa", oferta_enviada: "#d4960c", negociacion: "#d4960c",
  reserva: "#06b6d4", escritura: "#3abab6", cerrado: "#3abab6", perdido: "#b80000",
};

// ── componente ────────────────────────────────────────────────────────────────
export default function ProyeccionIngresosPage() {
  const [uid, setUid]             = useState<string | null>(null);
  const [negocios, setNegocios]   = useState<Negocio[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dolarBlue, setDolarBlue] = useState("1000");
  const [mesesHorizonte, setMeses] = useState(6);
  const [iibb, setIibb]           = useState(5.5);
  const [iva, setIva]             = useState(21);
  const [escenario, setEscenario] = useState<"base" | "opt" | "pes">("base");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_negocios")
      .select("id,titulo,etapa,tipo_operacion,valor_operacion,moneda,honorarios_pct,fecha_cierre,created_at")
      .eq("perfil_id", userId)
      .eq("archivado", false)
      .not("etapa", "in", '("perdido")');
    setNegocios((data ?? []) as Negocio[]);
    setLoading(false);
  };

  const dolar = parseFloat(dolarBlue) || 1;
  const iibbRate = iibb / 100;
  const ivaRate  = iva  / 100;

  // ── proyección mensual ────────────────────────────────────────────────────
  const proyeccion = useMemo(() => {
    const probs = escenario === "opt" ? PROB_OPT : escenario === "pes" ? PROB_PES : PROB_BASE;

    // Para cada negocio, calcular honorario esperado (prob * honorario bruto)
    // y asignarlo al mes correspondiente según etapa
    const meses: { mes: string; base: number; opt: number; pes: number; negocios: { titulo: string; monto: number; etapa: string }[] }[] = [];
    for (let i = 0; i < mesesHorizonte; i++) {
      meses.push({ mes: labelMes(i), base: 0, opt: 0, pes: 0, negocios: [] });
    }

    negocios.forEach(n => {
      if (n.etapa === "cerrado") return; // ya cerrado, no proyectar
      const v = n.valor_operacion ?? 0;
      const h = n.honorarios_pct ?? 3;
      const honBruto = v * h / 100;
      // convertir a USD si es ARS
      const honUSD = n.moneda === "ARS" ? honBruto / dolar : honBruto;

      const mesesHastaCierre = MESES_ETAPA[n.etapa] ?? 3;
      const mesIdx = Math.min(mesesHorizonte - 1, Math.round(mesesHastaCierre));

      if (mesIdx < 0 || mesIdx >= mesesHorizonte) return;

      const pBase = PROB_BASE[n.etapa] ?? 0;
      const pOpt  = PROB_OPT[n.etapa]  ?? 0;
      const pPes  = PROB_PES[n.etapa]  ?? 0;

      meses[mesIdx].base += honUSD * pBase;
      meses[mesIdx].opt  += honUSD * pOpt;
      meses[mesIdx].pes  += honUSD * pPes;
      meses[mesIdx].negocios.push({
        titulo: n.titulo,
        monto:  honUSD * (probs[n.etapa] ?? 0),
        etapa:  n.etapa,
      });
    });

    return meses;
  }, [negocios, dolar, mesesHorizonte, escenario]);

  // ── totales ───────────────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const bruto = proyeccion.reduce((s, m) => s + (escenario === "opt" ? m.opt : escenario === "pes" ? m.pes : m.base), 0);
    const descuentos = bruto * iibbRate + (bruto + bruto * iibbRate) * ivaRate;
    return {
      bruto,
      neto: bruto - descuentos,
      impuestos: descuentos,
      mensualPromedio: bruto / mesesHorizonte,
    };
  }, [proyeccion, escenario, iibbRate, ivaRate, mesesHorizonte]);

  // ── resumen por etapa ─────────────────────────────────────────────────────
  const porEtapa = useMemo(() => {
    const probs = escenario === "opt" ? PROB_OPT : escenario === "pes" ? PROB_PES : PROB_BASE;
    const map: Record<string, { count: number; valorEsperado: number }> = {};
    negocios.filter(n => n.etapa !== "cerrado").forEach(n => {
      const v = n.valor_operacion ?? 0;
      const h = n.honorarios_pct ?? 3;
      const honUSD = n.moneda === "ARS" ? (v * h / 100) / dolar : v * h / 100;
      const esperado = honUSD * (probs[n.etapa] ?? 0);
      if (!map[n.etapa]) map[n.etapa] = { count: 0, valorEsperado: 0 };
      map[n.etapa].count++;
      map[n.etapa].valorEsperado += esperado;
    });
    return Object.entries(map).sort((a, b) => b[1].valorEsperado - a[1].valorEsperado);
  }, [negocios, dolar, escenario]);

  // ── max para SVG bar ──────────────────────────────────────────────────────
  const maxMes = useMemo(() =>
    Math.max(...proyeccion.map(m => Math.max(m.opt, m.base, m.pes)), 1),
  [proyeccion]);

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = proyeccion.map((m, i) => {
      const val = escenario === "opt" ? m.opt : escenario === "pes" ? m.pes : m.base;
      return `<tr><td style="padding:5px 10px">${m.mes}</td><td style="padding:5px 10px;text-align:right;font-weight:600">${fmtUSD(val)}</td><td style="padding:5px 10px;text-align:right;color:#6b7280">${fmtUSD(m.pes)} – ${fmtUSD(m.opt)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Proyección de ingresos</title>
    <style>body{font-family:Arial,sans-serif;color:#111;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{font-size:12px;border-bottom:1px solid #f0f0f0}</style></head>
    <body><h1>Proyección de ingresos · próximos ${mesesHorizonte} meses</h1>
    <p>Escenario: <b>${escenario === "opt" ? "Optimista" : escenario === "pes" ? "Pesimista" : "Base"}</b> · Tipo de cambio: $ ${dolar.toLocaleString("es-AR")}/USD</p>
    <p><b>Total bruto esperado:</b> ${fmtUSD(totales.bruto)} · <b>Neto:</b> ${fmtUSD(totales.neto)}</p>
    <table><thead><tr><th>Mes</th><th>Valor esperado</th><th>Rango (pes – opt)</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const escenarioColor = { base: "#fff", opt: "#3abab6", pes: "#d4960c" };
  const escenarioLabel = { base: "Base", opt: "Optimista", pes: "Pesimista" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .pi-card { background:rgba(14,14,14,0.9); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:18px; }
        .pi-input { width:100%; padding:8px 10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:13px; font-family:'Inter',sans-serif; outline:none; box-sizing:border-box; }
        .pi-input:focus { border-color:rgba(153,0,0,0.5); }
        .pi-select { width:100%; padding:8px 10px; background:rgba(14,14,14,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:13px; font-family:'Inter',sans-serif; outline:none; }
        .pi-label { display:block; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:5px; font-family:'Montserrat',sans-serif; }
        .pi-btn { padding:8px 14px; border:none; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; }
        .pi-kpi { text-align:center; }
        .pi-kpi-n { font-family:'Montserrat',sans-serif; font-size:18px; font-weight:800; }
        .pi-kpi-l { font-size:10px; color:rgba(255,255,255,0.3); font-family:'Montserrat',sans-serif; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; margin-top:4px; }
        .pi-tab { padding:7px 16px; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; border:1px solid transparent; transition:all 0.15s; }
        @media(max-width:700px){.pi-cols{flex-direction:column!important;} .pi-grid4{grid-template-columns:repeat(2,1fr)!important;}}
      `}</style>

      <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#fff" }}>
              Proyección de <span style={{ color: "#990000" }}>Ingresos</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
              Comisiones esperadas basadas en el pipeline CRM · probabilidad por etapa
            </div>
          </div>
          <button className="pi-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }} onClick={exportarPDF}>
            ↓ Exportar PDF
          </button>
        </div>

        {/* ── Config ── */}
        <div className="pi-card">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 120 }}>
              <label className="pi-label">Horizonte</label>
              <select className="pi-select" value={mesesHorizonte} onChange={e => setMeses(parseInt(e.target.value))}>
                {[3,6,9,12].map(m => <option key={m} value={m}>{m} meses</option>)}
              </select>
            </div>
            <div style={{ minWidth: 130 }}>
              <label className="pi-label">Tipo de cambio (ARS/USD)</label>
              <input className="pi-input" type="text" inputMode="numeric" value={dolarBlue} onChange={e => setDolarBlue(e.target.value.replace(/[^0-9]/g,""))} />
            </div>
            <div style={{ minWidth: 100 }}>
              <label className="pi-label">IIBB (%)</label>
              <input className="pi-input" type="number" step="0.5" value={iibb} onChange={e => setIibb(parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ minWidth: 100 }}>
              <label className="pi-label">IVA (%)</label>
              <input className="pi-input" type="number" step="1" value={iva} onChange={e => setIva(parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["pes","base","opt"] as const).map(e => (
                <button key={e} className="pi-tab"
                  style={{
                    background: escenario === e ? `${e === "opt" ? "rgba(34,197,94," : e === "pes" ? "rgba(245,158,11," : "rgba(255,255,255,"}0.12)` : "rgba(255,255,255,0.04)",
                    color: escenario === e ? escenarioColor[e] : "rgba(255,255,255,0.35)",
                    border: `1px solid ${escenario === e ? (e === "opt" ? "rgba(34,197,94,0.4)" : e === "pes" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.08)"}`,
                  }}
                  onClick={() => setEscenario(e)}>
                  {escenarioLabel[e]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 48, fontFamily: "Inter,sans-serif" }}>Cargando pipeline...</div>
        ) : negocios.filter(n => n.etapa !== "cerrado").length === 0 ? (
          <div className="pi-card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>Sin negocios activos en el pipeline</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6, fontFamily: "Inter,sans-serif" }}>Agregá negocios en el CRM para ver la proyección</div>
          </div>
        ) : (
          <>
            {/* ── KPIs ── */}
            <div className="pi-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { n: fmtUSD(totales.bruto),          l: "Total bruto esperado",   c: "#fff" },
                { n: fmtUSD(totales.impuestos),      l: `IIBB+IVA estimado`,      c: "#b80000" },
                { n: fmtUSD(totales.neto),           l: "Honorario neto",          c: "#3abab6" },
                { n: fmtUSD(totales.mensualPromedio), l: "Promedio / mes",         c: "#4ab8d8" },
              ].map(k => (
                <div key={k.l} className="pi-card pi-kpi">
                  <div className="pi-kpi-n" style={{ color: k.c, fontSize: 14 }}>{k.n}</div>
                  <div className="pi-kpi-l">{k.l}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "Montserrat,sans-serif", marginTop: 4 }}>Escenario {escenarioLabel[escenario]}</div>
                </div>
              ))}
            </div>

            {/* ── Layout ── */}
            <div className="pi-cols" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

              {/* Gráfico mensual */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="pi-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                    Proyección mensual — {escenarioLabel[escenario]}
                  </div>
                  {/* SVG Bar chart */}
                  <div style={{ overflowX: "auto" }}>
                    <svg width="100%" height={200} viewBox={`0 0 ${Math.max(360, proyeccion.length * 80)} 200`} preserveAspectRatio="none">
                      {proyeccion.map((m, i) => {
                        const val = escenario === "opt" ? m.opt : escenario === "pes" ? m.pes : m.base;
                        const barH = Math.max(4, (val / maxMes) * 150);
                        const optH = Math.max(2, (m.opt / maxMes) * 150);
                        const pesH = Math.max(2, (m.pes / maxMes) * 150);
                        const x = i * 80 + 8;
                        return (
                          <g key={i}>
                            {/* Rango pes-opt */}
                            <rect x={x + 16} y={180 - optH} width={48} height={optH - pesH} fill="rgba(255,255,255,0.06)" rx={2} />
                            {/* Barra principal */}
                            <rect x={x + 8} y={180 - barH} width={64} height={barH}
                              fill={escenario === "opt" ? "rgba(34,197,94,0.7)" : escenario === "pes" ? "rgba(245,158,11,0.7)" : "rgba(153,0,0,0.7)"}
                              stroke={escenario === "opt" ? "#3abab6" : escenario === "pes" ? "#d4960c" : "#990000"}
                              strokeWidth={0.5} rx={3} />
                            {/* Valor */}
                            {val > 0 && (
                              <text x={x + 40} y={180 - barH - 5} textAnchor="middle"
                                fill="rgba(255,255,255,0.6)" fontSize={9} fontFamily="Montserrat,sans-serif">
                                {fmtUSD(val).replace("USD ", "")}
                              </text>
                            )}
                            {/* Label mes */}
                            <text x={x + 40} y={196} textAnchor="middle"
                              fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="Montserrat,sans-serif">
                              {m.mes}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", marginTop: 8 }}>
                    Las barras grises trasparentes muestran el rango pesimista–optimista para cada mes.
                  </div>
                </div>

                {/* Tabla mensual */}
                <div className="pi-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                    Detalle mensual
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {["Mes","Pesimista","Base","Optimista","Negocios"].map(h => (
                            <th key={h} style={{ padding: "7px 10px", textAlign: h === "Mes" || h === "Negocios" ? "left" : "right", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {proyeccion.map((m, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "9px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff" }}>{m.mes}</td>
                            <td style={{ padding: "9px 10px", textAlign: "right", color: "#d4960c" }}>{fmtUSD(m.pes)}</td>
                            <td style={{ padding: "9px 10px", textAlign: "right", color: "#fff", fontWeight: 600 }}>{fmtUSD(m.base)}</td>
                            <td style={{ padding: "9px 10px", textAlign: "right", color: "#3abab6" }}>{fmtUSD(m.opt)}</td>
                            <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.4)" }}>{m.negocios.length}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                          <td style={{ padding: "10px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Total</td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#d4960c" }}>{fmtUSD(proyeccion.reduce((s,m)=>s+m.pes,0))}</td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>{fmtUSD(proyeccion.reduce((s,m)=>s+m.base,0))}</td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#3abab6" }}>{fmtUSD(proyeccion.reduce((s,m)=>s+m.opt,0))}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Col derecha: por etapa + metodología */}
              <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Por etapa */}
                <div className="pi-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                    Pipeline por etapa
                  </div>
                  {porEtapa.map(([etapa, data]) => {
                    const color = ETAPA_COLOR[etapa] ?? "#6b7280";
                    const maxVal = Math.max(...porEtapa.map(([,d]) => d.valorEsperado), 1);
                    return (
                      <div key={etapa} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "Inter,sans-serif" }}>
                            {etapa.replace("_"," ")} <span style={{ color: "rgba(255,255,255,0.3)" }}>({data.count})</span>
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "Montserrat,sans-serif" }}>{fmtUSD(data.valorEsperado)}</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                          <div style={{ height: "100%", width: `${(data.valorEsperado / maxVal) * 100}%`, background: color, borderRadius: 2, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Metodología */}
                <div className="pi-card" style={{ background: "rgba(255,255,255,0.01)" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Probabilidades por etapa</div>
                  {Object.entries(PROB_BASE).filter(([e]) => e !== "perdido" && e !== "cerrado").map(([etapa, prob]) => (
                    <div key={etapa} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>{etapa.replace("_"," ")}</span>
                      <div style={{ display: "flex", gap: 8, fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                        <span style={{ color: "#d4960c" }}>{fmtPct(PROB_PES[etapa])}</span>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>{fmtPct(prob)}</span>
                        <span style={{ color: "#3abab6" }}>{fmtPct(PROB_OPT[etapa])}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", marginTop: 8, lineHeight: 1.4 }}>
                    Pes / Base / Opt — Ajustá el escenario según tu historial real
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
