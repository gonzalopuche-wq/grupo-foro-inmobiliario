"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Movimiento {
  id: number;
  parte: "comprador" | "vendedor";
  monto: number;
  nota: string;
  fecha: string;
}

type Estrategia = "agresiva" | "moderada" | "conservadora";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function pct(a: number, b: number) {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

// ── Sugerencias por estrategia ────────────────────────────────────────────────

function sugerirContraoferta(
  ultimaOferta: number,
  precioPedido: number,
  objetivoVendedor: number,
  estrategia: Estrategia,
  parte: "comprador" | "vendedor"
): { monto: number; mensaje: string } {
  const gap = precioPedido - ultimaOferta;
  const factores: Record<Estrategia, number> = { agresiva: 0.25, moderada: 0.45, conservadora: 0.65 };
  const f = factores[estrategia];

  if (parte === "comprador") {
    // Comprador sube: recorre una fracción del gap hacia el precio pedido
    const monto = Math.round((ultimaOferta + gap * f) / 1000) * 1000;
    const mensajes: Record<Estrategia, string> = {
      agresiva: `Sube solo ${(f * 100).toFixed(0)}% del gap. Muestra interés pero mantiene presión.`,
      moderada: `Sube ${(f * 100).toFixed(0)}% del gap. Señal de negociación genuina.`,
      conservadora: `Sube ${(f * 100).toFixed(0)}% del gap. Mueve hacia un punto intermedio.`,
    };
    return { monto, mensaje: mensajes[estrategia] };
  } else {
    // Vendedor baja: cede una fracción del gap desde el precio pedido hacia la oferta
    const monto = Math.round((precioPedido - gap * f) / 1000) * 1000;
    const mensajes: Record<Estrategia, string> = {
      agresiva: `Baja solo ${(f * 100).toFixed(0)}% del gap. Sostiene el valor.`,
      moderada: `Baja ${(f * 100).toFixed(0)}% del gap. Muestra flexibilidad razonable.`,
      conservadora: `Baja ${(f * 100).toFixed(0)}% del gap. Busca cerrar rápido.`,
    };
    return { monto: Math.max(monto, objetivoVendedor), mensaje: mensajes[estrategia] };
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function Negociacion() {
  const [precioPedido, setPrecioPedido] = useState(150000);
  const [objetivoVendedor, setObjetivoVendedor] = useState(135000);
  const [ofertaInicial, setOfertaInicial] = useState(120000);
  const [estrategia, setEstrategia] = useState<Estrategia>("moderada");
  const [honorariosPct, setHonorariosPct] = useState(3.0);

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [nuevaOferta, setNuevaOferta] = useState(0);
  const [nuevaParte, setNuevaParte] = useState<"comprador" | "vendedor">("comprador");
  const [nuevaNota, setNuevaNota] = useState("");
  const [idCounter, setIdCounter] = useState(1);

  function iniciarNegociacion() {
    const primer: Movimiento = {
      id: 0,
      parte: "comprador",
      monto: ofertaInicial,
      nota: "Oferta inicial del comprador",
      fecha: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMovimientos([primer]);
    setIdCounter(1);
  }

  function agregarMovimiento() {
    if (nuevaOferta <= 0) return;
    const m: Movimiento = {
      id: idCounter,
      parte: nuevaParte,
      monto: nuevaOferta,
      nota: nuevaNota || (nuevaParte === "comprador" ? "Contraoferta del comprador" : "Contraoferta del vendedor"),
      fecha: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMovimientos(prev => [...prev, m]);
    setIdCounter(prev => prev + 1);
    setNuevaOferta(0);
    setNuevaNota("");
  }

  const estado = useMemo(() => {
    if (movimientos.length === 0) return null;
    const ultima = movimientos[movimientos.length - 1];
    const brecha = precioPedido - ultima.monto;
    const brechaPct = Math.abs(pct(ultima.monto, precioPedido));
    const posibleCierre = ultima.monto >= objetivoVendedor;
    const honorariosUSD = ultima.monto * honorariosPct / 100;
    const zona = ultima.monto < objetivoVendedor * 0.9 ? "muy lejos"
      : ultima.monto < objetivoVendedor ? "cerca del piso"
      : ultima.monto <= precioPedido * 0.97 ? "zona de acuerdo"
      : "precio pedido";

    const sugerencia = sugerirContraoferta(
      ultima.monto,
      precioPedido,
      objetivoVendedor,
      estrategia,
      ultima.parte === "comprador" ? "vendedor" : "comprador"
    );

    return { ultima, brecha, brechaPct, posibleCierre, honorariosUSD, zona, sugerencia };
  }, [movimientos, precioPedido, objetivoVendedor, honorariosPct, estrategia]);

  const maxMonto = useMemo(() => Math.max(precioPedido * 1.02, ...movimientos.map(m => m.monto)), [movimientos, precioPedido]);
  const minMonto = useMemo(() => Math.min(ofertaInicial * 0.98, ...movimientos.map(m => m.monto)), [movimientos, ofertaInicial]);

  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "7px 10px", fontFamily: "'Inter',sans-serif", fontSize: 12, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Simulador de Negociación
        </h1>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Panel configuración */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 18 }}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Parámetros</p>
            {[
              { label: "Precio pedido (USD)", val: precioPedido, set: setPrecioPedido },
              { label: "Objetivo mínimo vendedor (USD)", val: objetivoVendedor, set: setObjetivoVendedor },
              { label: "Oferta inicial comprador (USD)", val: ofertaInicial, set: setOfertaInicial },
              { label: "Honorarios (%)", val: honorariosPct, set: setHonorariosPct, step: 0.5 },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{r.label}</label>
                <input type="number" step={r.step ?? 1000} value={r.val} onChange={e => r.set(+e.target.value)} style={inputStyle} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Estrategia</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["agresiva", "moderada", "conservadora"] as const).map(e => (
                  <button key={e} onClick={() => setEstrategia(e)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${estrategia === e ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: estrategia === e ? "rgba(204,0,0,0.12)" : "transparent", color: estrategia === e ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em", textTransform: "capitalize" }}>
                    {e}
                  </button>
                ))}
              </div>
              <p style={{ margin: "6px 0 0 0", fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>
                {estrategia === "agresiva" ? "Movimientos pequeños — mantiene presión, puede alargar la negociación." :
                 estrategia === "moderada" ? "Movimientos equilibrados — muestra buena fe sin ceder demasiado." :
                 "Movimientos amplios — prioriza velocidad de cierre sobre precio."}
              </p>
            </div>

            <button onClick={iniciarNegociacion} style={{ width: "100%", padding: "9px", borderRadius: 8, background: "rgba(204,0,0,0.15)", border: "1px solid rgba(204,0,0,0.4)", color: "#cc0000", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
              {movimientos.length > 0 ? "↺ Reiniciar" : "▶ Iniciar Negociación"}
            </button>
          </div>

          {/* Rangos de referencia */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
            <p style={{ margin: "0 0 10px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Rangos</p>
            {[
              { label: "Precio pedido", val: precioPedido, color: "#cc0000" },
              { label: "Piso vendedor", val: objetivoVendedor, color: "#f97316" },
              { label: "Oferta inicial", val: ofertaInicial, color: "#3b82f6" },
              { label: "Brecha total", val: precioPedido - ofertaInicial, color: "rgba(255,255,255,0.4)" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>USD {fmt(r.val)}</span>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Brecha: {((precioPedido - ofertaInicial) / precioPedido * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, position: "relative", overflow: "visible" }}>
                {/* Oferta inicial */}
                <div style={{ position: "absolute", left: `${((ofertaInicial - ofertaInicial * 0.98) / (precioPedido * 1.02 - ofertaInicial * 0.98)) * 100}%`, top: -2, width: 3, height: 12, background: "#3b82f6", borderRadius: 2 }} />
                {/* Piso vendedor */}
                <div style={{ position: "absolute", left: `${((objetivoVendedor - ofertaInicial * 0.98) / (precioPedido * 1.02 - ofertaInicial * 0.98)) * 100}%`, top: -2, width: 3, height: 12, background: "#f97316", borderRadius: 2 }} />
                {/* Precio pedido */}
                <div style={{ position: "absolute", right: "2%", top: -2, width: 3, height: 12, background: "#cc0000", borderRadius: 2 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Panel negociación */}
        <div>
          {movimientos.length === 0 ? (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 60, textAlign: "center" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: 32 }}>🤝</p>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Configurá los parámetros e iniciá la negociación</p>
            </div>
          ) : (
            <>
              {/* Estado actual */}
              {estado && (
                <div style={{ background: estado.posibleCierre ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${estado.posibleCierre ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                    {[
                      { label: "Última oferta", val: `USD ${fmt(estado.ultima.monto)}`, color: estado.ultima.parte === "comprador" ? "#3b82f6" : "#cc0000" },
                      { label: "Brecha restante", val: `USD ${fmt(estado.brecha)}`, color: estado.brechaPct < 3 ? "#22c55e" : "#f97316" },
                      { label: "Diferencia precio", val: `${pct(estado.ultima.monto, precioPedido).toFixed(1)}%`, color: "rgba(255,255,255,0.6)" },
                      { label: "Honorarios est.", val: `USD ${fmt(estado.honorariosUSD)}`, color: "#a78bfa" },
                    ].map(kpi => (
                      <div key={kpi.label} style={{ textAlign: "center" }}>
                        <p style={{ margin: "0 0 4px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kpi.label}</p>
                        <p style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Zona */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>ZONA:</span>
                    <span style={{ fontSize: 12, padding: "3px 12px", borderRadius: 20, background: estado.zona === "zona de acuerdo" ? "rgba(34,197,94,0.15)" : estado.zona === "cerca del piso" ? "rgba(249,115,22,0.15)" : "rgba(204,0,0,0.15)", color: estado.zona === "zona de acuerdo" ? "#22c55e" : estado.zona === "cerca del piso" ? "#f97316" : "#cc0000", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
                      {estado.zona.toUpperCase()}
                    </span>
                    {estado.posibleCierre && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>✅ Supera piso del vendedor — posible cierre</span>}
                  </div>

                  {/* Sugerencia */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ margin: "0 0 4px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Sugerencia ({estrategia}) — próxima jugada del {estado.ultima.parte === "comprador" ? "VENDEDOR" : "COMPRADOR"}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#f97316" }}>USD {fmt(estado.sugerencia.monto)}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", flex: 1 }}>{estado.sugerencia.mensaje}</span>
                      <button onClick={() => { setNuevaOferta(estado.sugerencia.monto); setNuevaParte(estado.ultima.parte === "comprador" ? "vendedor" : "comprador"); setNuevaNota(estado.sugerencia.mensaje); }} style={{ padding: "5px 12px", borderRadius: 8, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", color: "#f97316", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
                        Usar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline gráfico */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <p style={{ margin: "0 0 16px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Evolución de la Negociación</p>
                <div style={{ position: "relative", padding: "0 40px" }}>
                  {/* Líneas de referencia */}
                  {[precioPedido, objetivoVendedor].map((ref, i) => {
                    const y = 100 - ((ref - minMonto) / (maxMonto - minMonto)) * 100;
                    return (
                      <div key={i} style={{ position: "absolute", top: `${y}%`, left: 40, right: 40, height: 1, background: i === 0 ? "rgba(204,0,0,0.3)" : "rgba(249,115,22,0.3)", borderTop: `1px dashed ${i === 0 ? "rgba(204,0,0,0.4)" : "rgba(249,115,22,0.4)"}` }}>
                        <span style={{ position: "absolute", right: -36, fontSize: 8, color: i === 0 ? "rgba(204,0,0,0.7)" : "rgba(249,115,22,0.7)", top: -6 }}>{i === 0 ? "Pedido" : "Piso"}</span>
                      </div>
                    );
                  })}
                  {/* Puntos */}
                  <svg style={{ width: "100%", height: 120, display: "block" }} viewBox={`0 0 ${Math.max(movimientos.length * 60, 300)} 120`} preserveAspectRatio="none">
                    {movimientos.length > 1 && (
                      <polyline
                        points={movimientos.map((m, i) => {
                          const x = (i / (movimientos.length - 1)) * (Math.max(movimientos.length * 60, 300) - 40) + 20;
                          const y = 110 - ((m.monto - minMonto) / (maxMonto - minMonto)) * 100;
                          return `${x},${y}`;
                        }).join(" ")}
                        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5}
                      />
                    )}
                    {movimientos.map((m, i) => {
                      const x = movimientos.length > 1 ? (i / (movimientos.length - 1)) * (Math.max(movimientos.length * 60, 300) - 40) + 20 : 150;
                      const y = 110 - ((m.monto - minMonto) / (maxMonto - minMonto)) * 100;
                      const color = m.parte === "comprador" ? "#3b82f6" : "#cc0000";
                      return (
                        <g key={m.id}>
                          <circle cx={x} cy={y} r={6} fill={color} stroke="#0a0a0a" strokeWidth={2} />
                          <text x={x} y={y - 10} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={8}>
                            {(m.monto / 1000).toFixed(0)}k
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Timeline lista */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Historial</p>
                {movimientos.map((m, idx) => {
                  const anterior = idx > 0 ? movimientos[idx - 1].monto : null;
                  const diff = anterior !== null ? m.monto - anterior : null;
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: idx < movimientos.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.parte === "comprador" ? "rgba(59,130,246,0.15)" : "rgba(204,0,0,0.15)", border: `1px solid ${m.parte === "comprador" ? "rgba(59,130,246,0.3)" : "rgba(204,0,0,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 }}>
                        {m.parte === "comprador" ? "🏠" : "🤝"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: m.parte === "comprador" ? "#3b82f6" : "#cc0000", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{m.parte === "comprador" ? "Comprador" : "Vendedor"}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{m.fecha}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Montserrat',sans-serif" }}>USD {fmt(m.monto)}</span>
                          {diff !== null && (
                            <span style={{ fontSize: 11, color: diff > 0 ? "#22c55e" : "#cc0000", fontWeight: 700 }}>
                              {diff > 0 ? "+" : ""}USD {fmt(diff)}
                            </span>
                          )}
                        </div>
                        {m.nota && <p style={{ margin: "2px 0 0 0", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{m.nota}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Agregar movimiento */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
                <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Registrar Movimiento</p>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={labelStyle}>Parte</label>
                    <select value={nuevaParte} onChange={e => setNuevaParte(e.target.value as "comprador" | "vendedor")} style={{ ...inputStyle }}>
                      <option value="comprador">Comprador</option>
                      <option value="vendedor">Vendedor</option>
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <label style={labelStyle}>Monto (USD)</label>
                    <input type="number" step={1000} value={nuevaOferta || ""} onChange={e => setNuevaOferta(+e.target.value)} placeholder="Ej: 140000" style={inputStyle} />
                  </div>
                  <div style={{ flex: 3, minWidth: 160 }}>
                    <label style={labelStyle}>Nota</label>
                    <input type="text" value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} placeholder="Comentario opcional" style={inputStyle} />
                  </div>
                  <button onClick={agregarMovimiento} style={{ padding: "7px 20px", borderRadius: 8, background: "#cc0000", border: "none", color: "#fff", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    + Agregar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
