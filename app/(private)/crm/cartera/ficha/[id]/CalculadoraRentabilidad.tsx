"use client";
import { useState } from "react";

interface Props {
  precioVenta?: number | null;
  moneda?: string;
  precioAlquiler?: number | null;
}

export function CalculadoraRentabilidad({ precioVenta, moneda = "USD", precioAlquiler }: Props) {
  const [alquilerMensual, setAlquilerMensual] = useState(precioAlquiler ?? 0);
  const [valorInmueble, setValorInmueble] = useState(precioVenta ?? 0);
  const [gastosMensuales, setGastosMensuales] = useState(0);

  const alquilerAnual = alquilerMensual * 12;
  const gastoAnual = gastosMensuales * 12;
  const ingresoNeto = alquilerAnual - gastoAnual;
  const rendimientoBruto = valorInmueble > 0 ? (alquilerAnual / valorInmueble) * 100 : 0;
  const rendimientoNeto = valorInmueble > 0 ? (ingresoNeto / valorInmueble) * 100 : 0;
  const añosRecupero = rendimientoNeto > 0 ? 100 / rendimientoNeto : 0;

  // Comparativas de inversión (referencia AR 2026)
  const alternativas = [
    { label: "Plazo fijo (ARS)", valor: 42, color: "#f59e0b" },
    { label: "Dólar MEP / CCL", valor: 4, color: "#60a5fa" },
    { label: "UVA (estimado)", valor: 5.5, color: "#a78bfa" },
  ];

  const maxVal = Math.max(rendimientoBruto, rendimientoNeto, 42, 10);

  const fmtNum = (n: number) => n.toLocaleString("es-AR");
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  return (
    <div style={{ marginTop: 0 }}>
      <style>{`
        .calc-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        @media (max-width: 640px) { .calc-grid { grid-template-columns: 1fr; } }
        .calc-input-group { display: flex; flex-direction: column; gap: 4px; }
        .calc-input-label { font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #888; }
        .calc-input { width: 100%; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 7px; padding: 9px 12px; font-size: 15px; font-family: 'Montserrat',sans-serif; font-weight: 700; color: #111; outline: none; transition: border-color 0.15s; }
        .calc-input:focus { border-color: #cc0000; background: #fff; }
        .calc-input::placeholder { color: #bbb; font-weight: 400; }
        .calc-results { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        @media (max-width: 480px) { .calc-results { grid-template-columns: 1fr; } }
        .calc-result-card { background: #f8f8f8; border: 1px solid #eee; border-radius: 8px; padding: 14px 16px; }
        .calc-result-card.highlight { background: #0a0a0a; border-color: #222; }
        .calc-result-val { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; color: #cc0000; }
        .calc-result-card.highlight .calc-result-val { color: #fff; }
        .calc-result-label { font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-top: 2px; }
        .calc-result-card.highlight .calc-result-label { color: rgba(255,255,255,0.4); }
        .calc-comparativa { margin-top: 0; }
        .calc-comparativa-title { font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #999; margin-bottom: 12px; }
        .calc-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .calc-bar-label { font-size: 11px; color: #666; font-family: 'Montserrat',sans-serif; font-weight: 600; width: 130px; flex-shrink: 0; }
        .calc-bar-track { flex: 1; background: #f0f0f0; border-radius: 4px; height: 12px; overflow: hidden; }
        .calc-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
        .calc-bar-pct { font-size: 11px; font-family: 'Montserrat',sans-serif; font-weight: 700; color: #444; width: 48px; text-align: right; flex-shrink: 0; }
        .calc-nota { font-size: 10px; color: #aaa; margin-top: 14px; font-style: italic; }
      `}</style>

      {/* Inputs */}
      <div className="calc-grid">
        <div className="calc-input-group">
          <label className="calc-input-label">Valor del inmueble ({moneda})</label>
          <input
            type="number"
            className="calc-input"
            value={valorInmueble || ""}
            onChange={e => setValorInmueble(Number(e.target.value))}
            placeholder="Ej: 120000"
            min={0}
          />
        </div>
        <div className="calc-input-group">
          <label className="calc-input-label">Alquiler mensual ({moneda})</label>
          <input
            type="number"
            className="calc-input"
            value={alquilerMensual || ""}
            onChange={e => setAlquilerMensual(Number(e.target.value))}
            placeholder="Ej: 500"
            min={0}
          />
        </div>
        <div className="calc-input-group">
          <label className="calc-input-label">Gastos mensuales ({moneda})</label>
          <input
            type="number"
            className="calc-input"
            value={gastosMensuales || ""}
            onChange={e => setGastosMensuales(Number(e.target.value))}
            placeholder="Expensas, impuestos…"
            min={0}
          />
        </div>
      </div>

      {/* Resultados */}
      <div className="calc-results">
        <div className="calc-result-card highlight">
          <div className="calc-result-val">{fmtPct(rendimientoNeto)}</div>
          <div className="calc-result-label">Rendimiento neto anual</div>
        </div>
        <div className="calc-result-card highlight">
          <div className="calc-result-val">{añosRecupero > 0 ? `${añosRecupero.toFixed(1)} años` : "—"}</div>
          <div className="calc-result-label">Años de recupero</div>
        </div>
        <div className="calc-result-card">
          <div className="calc-result-val">{fmtPct(rendimientoBruto)}</div>
          <div className="calc-result-label">Rendimiento bruto</div>
        </div>
        <div className="calc-result-card">
          <div className="calc-result-val">{moneda} {fmtNum(ingresoNeto)}</div>
          <div className="calc-result-label">Ingreso neto anual</div>
        </div>
      </div>

      {/* Comparativa */}
      <div className="calc-comparativa">
        <div className="calc-comparativa-title">Comparativa vs. otras inversiones (% anual)</div>

        {/* Esta propiedad — bruto */}
        <div className="calc-bar-row">
          <div className="calc-bar-label">Esta prop. (bruto)</div>
          <div className="calc-bar-track">
            <div
              className="calc-bar-fill"
              style={{
                width: `${Math.min(100, (rendimientoBruto / maxVal) * 100)}%`,
                background: "#cc0000",
              }}
            />
          </div>
          <div className="calc-bar-pct">{fmtPct(rendimientoBruto)}</div>
        </div>

        {/* Esta propiedad — neto */}
        <div className="calc-bar-row">
          <div className="calc-bar-label">Esta prop. (neto)</div>
          <div className="calc-bar-track">
            <div
              className="calc-bar-fill"
              style={{
                width: `${Math.min(100, (rendimientoNeto / maxVal) * 100)}%`,
                background: "#e55",
              }}
            />
          </div>
          <div className="calc-bar-pct">{fmtPct(rendimientoNeto)}</div>
        </div>

        {/* Alternativas */}
        {alternativas.map(alt => (
          <div key={alt.label} className="calc-bar-row">
            <div className="calc-bar-label">{alt.label}</div>
            <div className="calc-bar-track">
              <div
                className="calc-bar-fill"
                style={{
                  width: `${Math.min(100, (alt.valor / maxVal) * 100)}%`,
                  background: alt.color,
                }}
              />
            </div>
            <div className="calc-bar-pct">{fmtPct(alt.valor)}</div>
          </div>
        ))}
      </div>

      <div className="calc-nota">
        * Valores de referencia orientativos. Plazo fijo ~42% anual en pesos, Dólar MEP ~4%, UVA ~5.5% real.
        No incluye plusvalía ni costos de transacción.
      </div>
    </div>
  );
}
