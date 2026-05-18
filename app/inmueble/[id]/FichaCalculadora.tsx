"use client";

import { useState } from "react";

interface Props {
  precioUsd: number | null;
  moneda: string;
}

const fmtNum = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

export default function FichaCalculadora({ precioUsd, moneda }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [anticipo, setAnticipo] = useState(30);
  const [tasa, setTasa] = useState(8.5);
  const [plazo, setPlazo] = useState(20);

  const precio = precioUsd ?? 0;
  const monto = precio * (1 - anticipo / 100);
  const tasaMensual = tasa / 100 / 12;
  const meses = plazo * 12;
  const cuota = monto > 0 && tasaMensual > 0
    ? (monto * tasaMensual * Math.pow(1 + tasaMensual, meses)) / (Math.pow(1 + tasaMensual, meses) - 1)
    : 0;
  const totalPagar = cuota * meses;
  const ingresoNecesario = cuota / 0.3;

  const inp: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6, color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13,
    padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box" as const,
  };

  const lbl: React.CSSProperties = {
    display: "block", fontSize: 9, fontFamily: "Montserrat,sans-serif",
    fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.35)", marginBottom: 5,
  };

  if (!precio || moneda !== "USD") return null;

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={() => setAbierta(a => !a)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "rgba(255,255,255,0.6)", fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const }}
      >
        <span>🏦 Calculadora de crédito hipotecario</span>
        <span style={{ fontSize: 14, opacity: 0.5 }}>{abierta ? "▲" : "▼"}</span>
      </button>

      {abierta && (
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
            <div>
              <label style={lbl}>Anticipo %</label>
              <input
                type="number" min={10} max={90} step={5}
                value={anticipo} onChange={e => setAnticipo(Number(e.target.value))}
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Tasa anual %</label>
              <input
                type="number" min={1} max={50} step={0.5}
                value={tasa} onChange={e => setTasa(Number(e.target.value))}
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Plazo (años)</label>
              <select value={plazo} onChange={e => setPlazo(Number(e.target.value))} style={inp}>
                {[10, 15, 20, 25, 30].map(p => <option key={p} value={p}>{p} años</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Anticipo</div>
              <div style={{ fontSize: 16, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>USD {fmtNum(precio * anticipo / 100)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>A financiar</div>
              <div style={{ fontSize: 16, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>USD {fmtNum(monto)}</div>
            </div>
            <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(96,165,250,0.7)", marginBottom: 5 }}>Cuota estimada/mes</div>
              <div style={{ fontSize: 16, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#60a5fa" }}>USD {fmtNum(Math.round(cuota))}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>Ingreso mínimo</div>
              <div style={{ fontSize: 16, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>USD {fmtNum(Math.round(ingresoNecesario))}/mes</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>cuota ≤ 30% del ingreso</div>
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", lineHeight: 1.5 }}>
            Valores estimativos en base a tasa fija. Las condiciones reales varían según banco, historial crediticio y cotización del dólar. Total a pagar: USD {fmtNum(Math.round(totalPagar))}.
          </div>
        </div>
      )}
    </div>
  );
}
