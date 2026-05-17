"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

type TipoObra = "vivienda_economica" | "vivienda_media" | "vivienda_alta" | "dptos_obra_basica" | "dptos_obra_media" | "dptos_obra_alta" | "local_comercial" | "galpon_industrial";
type Estructura = "losa" | "steel_frame" | "madera" | "modular_prefab";

// ── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_OBRA: { value: TipoObra; label: string; icon: string; baseUSD: number; desc: string }[] = [
  { value: "vivienda_economica",    label: "Vivienda económica",      icon: "🏠", baseUSD: 420,  desc: "Terminaciones básicas, sin extras" },
  { value: "vivienda_media",        label: "Vivienda media",          icon: "🏡", baseUSD: 620,  desc: "Terminaciones estándar, cocina equipada" },
  { value: "vivienda_alta",         label: "Vivienda de alta gama",   icon: "🏰", baseUSD: 1100, desc: "Terminaciones premium, domótica" },
  { value: "dptos_obra_basica",     label: "Dpto. obra básica",       icon: "🏢", baseUSD: 500,  desc: "Terminaciones mínimas para inversión" },
  { value: "dptos_obra_media",      label: "Dpto. obra media",        icon: "🏬", baseUSD: 700,  desc: "Terminaciones completas, amenities básicos" },
  { value: "dptos_obra_alta",       label: "Dpto. obra premium",      icon: "🌆", baseUSD: 1200, desc: "Premium, vista, amenities completos" },
  { value: "local_comercial",       label: "Local comercial",         icon: "🏪", baseUSD: 380,  desc: "Estructura + instalaciones básicas" },
  { value: "galpon_industrial",     label: "Galpón industrial",       icon: "🏭", baseUSD: 220,  desc: "Estructura metálica, piso industrial" },
];

const ESTRUCTURAS: { value: Estructura; label: string; factor: number; desc: string }[] = [
  { value: "losa",           label: "Mampostería + losa", factor: 1.00, desc: "Sistema tradicional" },
  { value: "steel_frame",    label: "Steel frame",        factor: 0.85, desc: "Rápido, antisísmico, menor costo" },
  { value: "madera",         label: "Madera (entramado)", factor: 0.80, desc: "Sustentable, menor tiempo de obra" },
  { value: "modular_prefab", label: "Modular prefab",     factor: 0.70, desc: "Máxima velocidad, menor personalización" },
];

// Costo CAC aproximado por m² de mano de obra (ARS) — actualizado May 2026
const MANO_OBRA_FACTOR = 0.40; // 40% del costo total es MO
const HONORARIOS_PROFESIONALES_FACTOR = 0.08; // 8% del valor de obra

// ── Componente ───────────────────────────────────────────────────────────────

export default function CalculadoraConstruccion() {
  const [tipoObra, setTipoObra] = useState<TipoObra>("vivienda_media");
  const [estructura, setEstructura] = useState<Estructura>("losa");
  const [superficieCubierta, setSuperficieCubierta] = useState(120);
  const [superficieSemicubierta, setSuperficieSemicubierta] = useState(20);
  const [pisos, setPisos] = useState(1);
  const [tcDolar, setTcDolar] = useState(1200);
  const [mesesObra, setMesesObra] = useState(18);
  const [inflacionMensual, setInflacionMensual] = useState(3.0);
  const [terreno, setTerreno] = useState(0);
  const [gastosMunicipal, setGastosMunicipal] = useState(2.0);
  const [incluirProf, setIncluirProf] = useState(true);
  const [zona, setZona] = useState<"amba" | "interior" | "patagonia">("amba");

  const zonaFactor: Record<string, number> = { amba: 1.0, interior: 0.88, patagonia: 1.25 };

  const resultado = useMemo(() => {
    const tipo = TIPOS_OBRA.find(t => t.value === tipoObra)!;
    const est = ESTRUCTURAS.find(e => e.value === estructura)!;
    const zFactor = zonaFactor[zona];

    // Superficie ponderada (semicubierta vale 60%)
    const supEfectiva = superficieCubierta + superficieSemicubierta * 0.6;
    const supTotal = superficieCubierta + superficieSemicubierta;

    const costoBaseUSD = tipo.baseUSD * est.factor * zFactor;
    const costoObraUSD = costoBaseUSD * supEfectiva;

    // Honorarios profesionales (dirección técnica, proyecto)
    const honorariosUSD = incluirProf ? costoObraUSD * HONORARIOS_PROFESIONALES_FACTOR : 0;

    // Gastos municipales sobre valuación fiscal estimada
    const gastosMunicipalesUSD = costoObraUSD * gastosMunicipal / 100;

    // Terreno
    const terrenoUSD = terreno;

    const subtotalSinTerreno = costoObraUSD + honorariosUSD + gastosMunicipalesUSD;
    const totalUSD = subtotalSinTerreno + terrenoUSD;
    const totalARS = totalUSD * tcDolar;

    // Costo por m² efectivo
    const costoM2USD = supTotal > 0 ? subtotalSinTerreno / supTotal : 0;

    // Impacto inflación sobre MO durante obra
    // MO se paga en ARS — valor total MO ARS inicial, se indexa por inflación mensual
    const moARS = costoObraUSD * tcDolar * MANO_OBRA_FACTOR;
    let moAjustado = 0;
    for (let i = 0; i < mesesObra; i++) {
      moAjustado += moARS / mesesObra * Math.pow(1 + inflacionMensual / 100, i);
    }
    const sobrecosteMO = moAjustado - moARS;
    const sobrecosteMOUSD = sobrecosteMO / tcDolar;
    const totalConInflacion = totalUSD + sobrecosteMOUSD;

    // Valor futuro estimado al terminar (mercado tiende a subir con la obra)
    const valorMercadoEstimado = totalConInflacion * 1.20; // 20% margen constructor

    return {
      costoBaseUSD,
      costoObraUSD,
      honorariosUSD,
      gastosMunicipalesUSD,
      terrenoUSD,
      subtotalSinTerreno,
      totalUSD,
      totalARS,
      costoM2USD,
      supEfectiva,
      supTotal,
      sobrecosteMOUSD,
      totalConInflacion,
      valorMercadoEstimado,
      moARS,
      moAjustado,
    };
  }, [tipoObra, estructura, superficieCubierta, superficieSemicubierta, pisos, tcDolar, mesesObra, inflacionMensual, terreno, gastosMunicipal, incluirProf, zona]);

  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => `USD ${fmt(n)}`;
  const fmtARS = (n: number) => `$ ${fmt(n)}`;

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 14, width: "100%",
    fontFamily: "Inter, sans-serif", boxSizing: "border-box" as const,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4, display: "block",
  };
  const sectionStyle: React.CSSProperties = { background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const tipo = TIPOS_OBRA.find(t => t.value === tipoObra)!;
    const est = ESTRUCTURAS.find(e => e.value === estructura)!;
    win.document.write(`
      <html><head><title>Presupuesto Construcción</title>
      <style>body{font-family:Arial,sans-serif;font-size:13px;max-width:700px;margin:40px auto}h1{color:#cc0000}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.total{font-weight:bold;font-size:15px;background:#fff8f0}</style>
      </head><body>
      <h1>🏗️ Presupuesto de Construcción</h1>
      <p><b>Tipo:</b> ${tipo.label} | <b>Estructura:</b> ${est.label} | <b>Zona:</b> ${zona}</p>
      <p><b>Superficie cubierta:</b> ${superficieCubierta} m² | <b>Semicubierta:</b> ${superficieSemicubierta} m²</p>
      <p><b>Duración estimada:</b> ${mesesObra} meses</p>
      <table>
        <tr><th>Concepto</th><th>USD</th><th>ARS</th></tr>
        <tr><td>Costo de obra (${resultado.supEfectiva.toFixed(0)} m² efectivos × USD ${resultado.costoBaseUSD.toFixed(0)}/m²)</td><td>${fmtUSD(resultado.costoObraUSD)}</td><td>${fmtARS(resultado.costoObraUSD * tcDolar)}</td></tr>
        ${incluirProf ? `<tr><td>Honorarios profesionales (8%)</td><td>${fmtUSD(resultado.honorariosUSD)}</td><td>${fmtARS(resultado.honorariosUSD * tcDolar)}</td></tr>` : ""}
        <tr><td>Gastos municipales (${gastosMunicipal}%)</td><td>${fmtUSD(resultado.gastosMunicipalesUSD)}</td><td>${fmtARS(resultado.gastosMunicipalesUSD * tcDolar)}</td></tr>
        ${terreno > 0 ? `<tr><td>Terreno</td><td>${fmtUSD(resultado.terrenoUSD)}</td><td>${fmtARS(resultado.terrenoUSD * tcDolar)}</td></tr>` : ""}
        <tr><td>Sobrecosto MO por inflación (${inflacionMensual}% mensual / ${mesesObra} meses)</td><td>${fmtUSD(resultado.sobrecosteMOUSD)}</td><td>${fmtARS(resultado.sobrecosteMOUSD * tcDolar)}</td></tr>
        <tr class="total"><td><b>TOTAL CON INFLACIÓN</b></td><td><b>${fmtUSD(resultado.totalConInflacion)}</b></td><td><b>${fmtARS(resultado.totalConInflacion * tcDolar)}</b></td></tr>
      </table>
      <p><b>Costo por m² (sin terreno):</b> USD ${resultado.costoM2USD.toFixed(0)}/m²</p>
      <p><b>Valor de mercado estimado al terminar:</b> ${fmtUSD(resultado.valorMercadoEstimado)}</p>
      <p style="color:#888;font-size:11px">Generado: ${new Date().toLocaleDateString("es-AR")} — Valores orientativos, sujetos a cotización</p>
      </body></html>
    `);
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>🏗️ Costo de Construcción</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Presupuesto estimado por m² con impacto inflacionario sobre mano de obra</p>
        </div>
        <button onClick={exportPDF} style={{
          background: "#cc0000", color: "#fff", border: "none", borderRadius: 8,
          padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Montserrat, sans-serif",
        }}>📄 PDF</button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Tipo de obra — tarjetas */}
        <div style={sectionStyle}>
          <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000", textTransform: "uppercase" }}>Tipo de obra</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {TIPOS_OBRA.map(t => (
              <div
                key={t.value}
                onClick={() => setTipoObra(t.value)}
                style={{
                  padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${tipoObra === t.value ? "#cc0000" : "#222"}`,
                  background: tipoObra === t.value ? "#cc000015" : "#0d0d0d",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tipoObra === t.value ? "#fff" : "#ccc" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{t.desc}</div>
                <div style={{ fontSize: 12, color: "#cc0000", marginTop: 4, fontWeight: 700 }}>USD {t.baseUSD}/m²</div>
              </div>
            ))}
          </div>
        </div>

        {/* Parámetros */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase" }}>Obra</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Estructura</label>
                <select value={estructura} onChange={e => setEstructura(e.target.value as Estructura)} style={inputStyle}>
                  {ESTRUCTURAS.map(e => <option key={e.value} value={e.value}>{e.label} (×{e.factor}) — {e.desc}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Sup. cubierta (m²)</label>
                  <input type="number" value={superficieCubierta} onChange={e => setSuperficieCubierta(+e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sup. semicubierta (m²)</label>
                  <input type="number" value={superficieSemicubierta} onChange={e => setSuperficieSemicubierta(+e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Pisos</label>
                  <input type="number" min={1} max={20} value={pisos} onChange={e => setPisos(+e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Zona</label>
                  <select value={zona} onChange={e => setZona(e.target.value as typeof zona)} style={inputStyle}>
                    <option value="amba">AMBA (×1.00)</option>
                    <option value="interior">Interior (×0.88)</option>
                    <option value="patagonia">Patagonia (×1.25)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#f59e0b", textTransform: "uppercase" }}>Financiero</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>TC (ARS/USD)</label>
                <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Duración obra (meses)</label>
                  <input type="number" min={3} max={60} value={mesesObra} onChange={e => setMesesObra(+e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Inflación MO (% mensual)</label>
                  <input type="number" step={0.1} value={inflacionMensual} onChange={e => setInflacionMensual(+e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Terreno (USD, opcional)</label>
                <input type="number" value={terreno} onChange={e => setTerreno(+e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Gastos municipales (%)</label>
                  <input type="number" step={0.1} value={gastosMunicipal} onChange={e => setGastosMunicipal(+e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" id="prof" checked={incluirProf} onChange={e => setIncluirProf(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#cc0000" }} />
                  <label htmlFor="prof" style={{ fontSize: 13, color: "#ccc" }}>Honorarios profesionales</label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
          {[
            { label: "Costo de obra", val: fmtUSD(resultado.costoObraUSD), sub: `${resultado.supTotal} m² totales`, color: "#3b82f6" },
            { label: "Total sin terreno", val: fmtUSD(resultado.subtotalSinTerreno), sub: `USD ${resultado.costoM2USD.toFixed(0)}/m² final`, color: "#cc0000" },
            { label: "Sobrecosto inflación", val: fmtUSD(resultado.sobrecosteMOUSD), sub: `${mesesObra} meses × ${inflacionMensual}%/mes`, color: "#f59e0b" },
            { label: "Total con inflación", val: fmtUSD(resultado.totalConInflacion), sub: fmtARS(resultado.totalConInflacion * tcDolar), color: "#a78bfa" },
            { label: "Valor mercado est.", val: fmtUSD(resultado.valorMercadoEstimado), sub: "+20% margen constructor", color: "#22c55e" },
          ].map((kpi, i) => (
            <div key={i} style={{ background: "#111", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Desglose */}
        <div style={sectionStyle}>
          <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>Desglose de costos</h2>
          {[
            { label: `Obra (${resultado.supEfectiva.toFixed(0)} m² ef. × USD ${resultado.costoBaseUSD.toFixed(0)}/m²)`, val: resultado.costoObraUSD, color: "#3b82f6" },
            ...(incluirProf ? [{ label: "Honorarios profesionales (dirección técnica, proyecto 8%)", val: resultado.honorariosUSD, color: "#a78bfa" }] : []),
            { label: `Gastos municipales y visados (${gastosMunicipal}%)`, val: resultado.gastosMunicipalesUSD, color: "#f59e0b" },
            ...(terreno > 0 ? [{ label: "Terreno", val: resultado.terrenoUSD, color: "#888" }] : []),
            { label: `Sobrecosto MO por inflación (${inflacionMensual}%/mes × ${mesesObra} meses)`, val: resultado.sobrecosteMOUSD, color: "#f59e0b" },
            { label: "TOTAL", val: resultado.totalConInflacion, color: "#cc0000" },
          ].map((row, i, arr) => {
            const total = resultado.totalConInflacion;
            const pct = total > 0 ? (row.val / total) * 100 : 0;
            const isTotal = i === arr.length - 1;
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: isTotal ? "none" : "1px solid #1a1a1a",
                borderTop: isTotal ? "2px solid #333" : "none",
                marginTop: isTotal ? 4 : 0,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: isTotal ? 14 : 13, color: isTotal ? "#fff" : "#ccc", fontWeight: isTotal ? 700 : 400 }}>{row.label}</div>
                  {!isTotal && (
                    <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, marginTop: 4, overflow: "hidden", maxWidth: 200 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: row.color, borderRadius: 2 }} />
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", minWidth: 200 }}>
                  <div style={{ fontSize: isTotal ? 16 : 14, fontWeight: isTotal ? 700 : 600, color: row.color }}>{fmtUSD(row.val)}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{fmtARS(row.val * tcDolar)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparativa estructuras */}
        <div style={sectionStyle}>
          <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
            Comparativa de sistemas constructivos
          </h2>
          {ESTRUCTURAS.map(est => {
            const tipo = TIPOS_OBRA.find(t => t.value === tipoObra)!;
            const costoEst = tipo.baseUSD * est.factor * { amba: 1, interior: 0.88, patagonia: 1.25 }[zona] * resultado.supEfectiva;
            return (
              <div key={est.value} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: est.value === estructura ? "#fff" : "#888", fontWeight: est.value === estructura ? 700 : 400 }}>
                    {est.label} {est.value === estructura ? "← actual" : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "#888" }}>{fmtUSD(costoEst)}</span>
                </div>
                <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(costoEst / (tipo.baseUSD * resultado.supEfectiva)) * 100}%`,
                    background: est.value === estructura ? "#cc0000" : "#333",
                    borderRadius: 4, transition: "width 0.3s",
                  }} />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
