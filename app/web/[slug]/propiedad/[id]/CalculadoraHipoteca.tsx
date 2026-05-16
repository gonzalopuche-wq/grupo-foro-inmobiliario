"use client";

import { useState, useMemo } from "react";

export function CalculadoraHipoteca({
  precioBase,
  moneda,
  accent,
  cardBorder,
  textMuted,
  text,
  card,
}: {
  precioBase: number | null;
  moneda: string;
  accent: string;
  cardBorder: string;
  textMuted: string;
  text: string;
  card: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [porcentajeEntrada, setPorcentajeEntrada] = useState(30);
  const [plazoAnios, setPlazoAnios] = useState(20);
  const [tna, setTna] = useState(8.5);

  const resultado = useMemo(() => {
    const precio = precioBase ?? 0;
    const entrada = (precio * porcentajeEntrada) / 100;
    const prestamo = precio - entrada;
    const n = plazoAnios * 12;
    const r = tna / 100 / 12;
    if (r === 0 || n === 0 || prestamo <= 0) return null;
    const cuota = (prestamo * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPagado = cuota * n;
    const totalIntereses = totalPagado - prestamo;
    return { entrada, prestamo, cuota, totalPagado, totalIntereses };
  }, [precioBase, porcentajeEntrada, plazoAnios, tna]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

  const sym = moneda === "ARS" ? "$" : "U$D";

  if (!precioBase) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.05)",
    border: `1px solid ${cardBorder}`, borderRadius: 6, color: text,
    fontSize: 13, fontFamily: "Inter,sans-serif", outline: "none",
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setAbierta(v => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 14px", background: "transparent", border: `1px solid ${cardBorder}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: textMuted, cursor: "pointer", fontFamily: "Montserrat,sans-serif" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>🏦</span> Calculadora de cuotas
        </span>
        <span style={{ fontSize: 11, transition: "transform 0.2s", display: "inline-block", transform: abierta ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {abierta && (
        <div style={{ marginTop: 8, padding: "16px", background: card, border: `1px solid ${cardBorder}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 10, color: textMuted, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                Entrada ({porcentajeEntrada}%)
              </label>
              <input
                type="range" min={10} max={80} step={5}
                value={porcentajeEntrada}
                onChange={e => setPorcentajeEntrada(Number(e.target.value))}
                style={{ width: "100%", accentColor: accent }}
              />
              <div style={{ fontSize: 12, color: text, marginTop: 2, fontFamily: "Montserrat,sans-serif", fontWeight: 600 }}>
                {sym} {fmt((precioBase * porcentajeEntrada) / 100)}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: textMuted, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                Plazo ({plazoAnios} años)
              </label>
              <input
                type="range" min={5} max={30} step={5}
                value={plazoAnios}
                onChange={e => setPlazoAnios(Number(e.target.value))}
                style={{ width: "100%", accentColor: accent }}
              />
              <div style={{ fontSize: 12, color: text, marginTop: 2, fontFamily: "Montserrat,sans-serif", fontWeight: 600 }}>
                {plazoAnios * 12} cuotas
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, color: textMuted, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
              Tasa nominal anual (TNA %)
            </label>
            <input
              type="number" min={1} max={200} step={0.5}
              value={tna}
              onChange={e => setTna(Math.max(0.1, Number(e.target.value)))}
              style={inputStyle}
            />
          </div>

          {resultado && (
            <div style={{ borderTop: `1px solid ${cardBorder}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: textMuted }}>Préstamo</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: text, fontFamily: "Montserrat,sans-serif" }}>{sym} {fmt(resultado.prestamo)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: `${accent}15`, borderRadius: 8, border: `1px solid ${accent}30` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: text, fontFamily: "Montserrat,sans-serif" }}>Cuota estimada</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: accent, fontFamily: "Montserrat,sans-serif" }}>{sym} {fmt(resultado.cuota)}/mes</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: textMuted }}>Total intereses</span>
                <span style={{ fontSize: 12, color: textMuted, fontFamily: "Montserrat,sans-serif" }}>{sym} {fmt(resultado.totalIntereses)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: textMuted }}>Total a pagar</span>
                <span style={{ fontSize: 12, color: textMuted, fontFamily: "Montserrat,sans-serif" }}>{sym} {fmt(resultado.totalPagado)}</span>
              </div>
              <p style={{ fontSize: 10, color: textMuted, marginTop: 4, fontStyle: "italic", lineHeight: 1.4, opacity: 0.7 }}>
                Cálculo estimativo (sistema francés). Consultá con tu banco o institución financiera para condiciones reales.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
