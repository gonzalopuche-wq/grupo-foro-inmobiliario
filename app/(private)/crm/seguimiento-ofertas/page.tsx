"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface RondaOferta {
  id: string;
  numero: number;
  fecha: string;
  tipo: "oferta" | "contraoferta";
  parte: "comprador" | "vendedor";
  monto: number;
  porcentaje_del_pedido: number;
  condiciones: string;
  respuesta_plazo_dias: number;
  estado: "pendiente" | "aceptada" | "rechazada" | "vencida";
}

interface Oferta {
  id: string;
  negocio_id: string;
  negocio_descripcion: string;
  tipo_operacion: "venta" | "alquiler";
  contacto_comprador: string;
  contacto_vendedor: string;
  precio_pedido: number;
  moneda: "ARS" | "USD";
  rondas: RondaOferta[];
  estado: "activa" | "aceptada" | "rechazada" | "vencida" | "contraoferta";
  fecha_inicio: string;
  fecha_vencimiento: string;
  notas: string;
  created_at: string;
}

type TabId = "activas" | "timeline" | "historial";
type EstadoFiltro = "todos" | "activa" | "aceptada" | "rechazada" | "vencida" | "contraoferta";
type TipoOpFiltro = "todos" | "venta" | "alquiler";

// ── Datos de ejemplo ──────────────────────────────────────────────────────────

function generarId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function crearEjemplos(): Oferta[] {
  const ahora = new Date();
  const hace20 = new Date(ahora); hace20.setDate(ahora.getDate() - 20);
  const hace15 = new Date(ahora); hace15.setDate(ahora.getDate() - 15);
  const hace10 = new Date(ahora); hace10.setDate(ahora.getDate() - 10);
  const hace5 = new Date(ahora); hace5.setDate(ahora.getDate() - 5);
  const hace3 = new Date(ahora); hace3.setDate(ahora.getDate() - 3);
  const en2 = new Date(ahora); en2.setDate(ahora.getDate() + 2);
  const en7 = new Date(ahora); en7.setDate(ahora.getDate() + 7);

  const oferta1: Oferta = {
    id: generarId(),
    negocio_id: "",
    negocio_descripcion: "Av. Santa Fe 3450, Piso 8 A — Palermo, CABA",
    tipo_operacion: "venta",
    contacto_comprador: "Martín Rodríguez (+54 911 5555-1234)",
    contacto_vendedor: "Ana Gómez (+54 911 4444-5678)",
    precio_pedido: 185000,
    moneda: "USD",
    rondas: [
      {
        id: generarId(),
        numero: 1,
        fecha: hace20.toISOString(),
        tipo: "oferta",
        parte: "comprador",
        monto: 155000,
        porcentaje_del_pedido: (155000 / 185000) * 100,
        condiciones: "Pago contado al escriturar. Plazo de escritura: 60 días.",
        respuesta_plazo_dias: 5,
        estado: "rechazada",
      },
      {
        id: generarId(),
        numero: 2,
        fecha: hace15.toISOString(),
        tipo: "contraoferta",
        parte: "vendedor",
        monto: 178000,
        porcentaje_del_pedido: (178000 / 185000) * 100,
        condiciones: "Baja leve. Vendedor mantiene plazo de 30 días para escritura.",
        respuesta_plazo_dias: 4,
        estado: "rechazada",
      },
      {
        id: generarId(),
        numero: 3,
        fecha: hace5.toISOString(),
        tipo: "oferta",
        parte: "comprador",
        monto: 168000,
        porcentaje_del_pedido: (168000 / 185000) * 100,
        condiciones: "Sube la oferta. Propone 50% contado y 50% en 6 cuotas.",
        respuesta_plazo_dias: 5,
        estado: "pendiente",
      },
    ],
    estado: "activa",
    fecha_inicio: hace20.toISOString(),
    fecha_vencimiento: en2.toISOString(),
    notas: "Comprador muy interesado, pero ajustado en presupuesto. Vendedor flexible.",
    created_at: hace20.toISOString(),
  };

  const oferta2: Oferta = {
    id: generarId(),
    negocio_id: "",
    negocio_descripcion: "Chalet — Calle Los Aromos 120, Nordelta, Tigre",
    tipo_operacion: "venta",
    contacto_comprador: "Laura Pérez (+54 911 6666-9999)",
    contacto_vendedor: "Carlos Bianchi (+54 911 7777-3333)",
    precio_pedido: 420000,
    moneda: "USD",
    rondas: [
      {
        id: generarId(),
        numero: 1,
        fecha: hace10.toISOString(),
        tipo: "oferta",
        parte: "comprador",
        monto: 370000,
        porcentaje_del_pedido: (370000 / 420000) * 100,
        condiciones: "Oferta inicial. Cliente espera respuesta en 3 días.",
        respuesta_plazo_dias: 3,
        estado: "rechazada",
      },
      {
        id: generarId(),
        numero: 2,
        fecha: hace3.toISOString(),
        tipo: "contraoferta",
        parte: "vendedor",
        monto: 405000,
        porcentaje_del_pedido: (405000 / 420000) * 100,
        condiciones: "Vendedor baja levemente. Incluye todos los muebles de la cocina.",
        respuesta_plazo_dias: 5,
        estado: "pendiente",
      },
    ],
    estado: "contraoferta",
    fecha_inicio: hace10.toISOString(),
    fecha_vencimiento: en7.toISOString(),
    notas: "Propiedad premium. Comprador tiene financiación pre-aprobada.",
    created_at: hace10.toISOString(),
  };

  const oferta3: Oferta = {
    id: generarId(),
    negocio_id: "",
    negocio_descripcion: "Departamento 2 amb — Corrientes 2800, Almagro, CABA",
    tipo_operacion: "alquiler",
    contacto_comprador: "Diego Torres (+54 911 3333-7777)",
    contacto_vendedor: "Propietario: Roberto Sánchez (+54 911 2222-1111)",
    precio_pedido: 280000,
    moneda: "ARS",
    rondas: [
      {
        id: generarId(),
        numero: 1,
        fecha: hace15.toISOString(),
        tipo: "oferta",
        parte: "comprador",
        monto: 250000,
        porcentaje_del_pedido: (250000 / 280000) * 100,
        condiciones: "Pago puntual. 2 meses de depósito. Garante propietario.",
        respuesta_plazo_dias: 3,
        estado: "rechazada",
      },
      {
        id: generarId(),
        numero: 2,
        fecha: hace10.toISOString(),
        tipo: "contraoferta",
        parte: "vendedor",
        monto: 270000,
        porcentaje_del_pedido: (270000 / 280000) * 100,
        condiciones: "Propietario cede $10.000. Exige 3 meses de depósito.",
        respuesta_plazo_dias: 3,
        estado: "rechazada",
      },
      {
        id: generarId(),
        numero: 3,
        fecha: hace5.toISOString(),
        tipo: "oferta",
        parte: "comprador",
        monto: 265000,
        porcentaje_del_pedido: (265000 / 280000) * 100,
        condiciones: "Acepta 3 meses de depósito. Pide incluir expensas.",
        respuesta_plazo_dias: 2,
        estado: "aceptada",
      },
    ],
    estado: "aceptada",
    fecha_inicio: hace15.toISOString(),
    fecha_vencimiento: hace3.toISOString(),
    notas: "Operación cerrada. Contrato en preparación.",
    created_at: hace15.toISOString(),
  };

  return [oferta1, oferta2, oferta3];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoneda(monto: number, moneda: "ARS" | "USD"): string {
  if (moneda === "USD") {
    return "USD " + monto.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }
  return "$ " + monto.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

function diasHasta(iso: string): number {
  const ahora = new Date();
  const destino = new Date(iso);
  return Math.round((destino.getTime() - ahora.getTime()) / 86400000);
}

function ultimaRonda(oferta: Oferta): RondaOferta | null {
  if (!oferta.rondas.length) return null;
  return [...oferta.rondas].sort((a, b) => b.numero - a.numero)[0];
}

function brechaActual(oferta: Oferta): number {
  const ultima = ultimaRonda(oferta);
  if (!ultima) return 0;
  return ((oferta.precio_pedido - ultima.monto) / oferta.precio_pedido) * 100;
}

function duracionDias(oferta: Oferta): number {
  const fin = oferta.estado === "activa" || oferta.estado === "contraoferta"
    ? new Date().toISOString()
    : oferta.fecha_vencimiento;
  return Math.max(0, Math.round((new Date(fin).getTime() - new Date(oferta.fecha_inicio).getTime()) / 86400000));
}

// ── Estilos constantes ────────────────────────────────────────────────────────

const C = {
  bg: "#0a0a0a",
  card: "#111111",
  border: "#222222",
  red: "#cc0000",
  text: "#e0e0e0",
  muted: "#888888",
  green: "#2d7a2d",
  yellow: "#b8960c",
  gray: "#555555",
  blue: "#1a5fa8",
} as const;

const styleBase: React.CSSProperties = {
  background: C.bg,
  color: C.text,
  minHeight: "100vh",
  fontFamily: "Inter, sans-serif",
  fontSize: "14px",
};

function badgeEstado(estado: Oferta["estado"]): React.CSSProperties {
  const map: Record<Oferta["estado"], string> = {
    activa: C.yellow,
    aceptada: C.green,
    rechazada: C.red,
    vencida: C.gray,
    contraoferta: C.blue,
  };
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    background: map[estado],
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };
}

function labelEstado(estado: Oferta["estado"]): string {
  const map: Record<Oferta["estado"], string> = {
    activa: "Activa",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    vencida: "Vencida",
    contraoferta: "Contraoferta",
  };
  return map[estado];
}

// ── Modal Nueva Oferta ────────────────────────────────────────────────────────

interface ModalNuevaOfertaProps {
  onClose: () => void;
  onSave: (oferta: Oferta) => void;
}

function ModalNuevaOferta({ onClose, onSave }: ModalNuevaOfertaProps) {
  const [desc, setDesc] = useState("");
  const [tipoOp, setTipoOp] = useState<"venta" | "alquiler">("venta");
  const [comprador, setComprador] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [precioPedido, setPrecioPedido] = useState("");
  const [moneda, setMoneda] = useState<"ARS" | "USD">("USD");
  const [vencimiento, setVencimiento] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [notas, setNotas] = useState("");

  function handleSave() {
    const precio = parseFloat(precioPedido.replace(/[^0-9.]/g, ""));
    if (!desc.trim() || !comprador.trim() || !vendedor.trim() || isNaN(precio) || precio <= 0) {
      alert("Completá todos los campos obligatorios.");
      return;
    }
    const now = new Date().toISOString();
    const oferta: Oferta = {
      id: generarId(),
      negocio_id: "",
      negocio_descripcion: desc,
      tipo_operacion: tipoOp,
      contacto_comprador: comprador,
      contacto_vendedor: vendedor,
      precio_pedido: precio,
      moneda,
      rondas: [],
      estado: "activa",
      fecha_inicio: now,
      fecha_vencimiento: new Date(vencimiento + "T23:59:59").toISOString(),
      notas,
      created_at: now,
    };
    onSave(oferta);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#1a1a1a",
    border: `1px solid ${C.border}`,
    borderRadius: "6px",
    color: C.text,
    padding: "8px 10px",
    fontSize: "13px",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    color: C.muted,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: "16px",
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: "10px", padding: "24px",
        width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto",
      }}>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "18px", margin: "0 0 20px" }}>
          Nueva oferta
        </h2>

        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Propiedad / Descripción *</label>
            <input style={inputStyle} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Av. Santa Fe 1234, Piso 5 A..." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Tipo de operación</label>
              <select style={inputStyle} value={tipoOp} onChange={e => setTipoOp(e.target.value as "venta" | "alquiler")}>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Moneda</label>
              <select style={inputStyle} value={moneda} onChange={e => setMoneda(e.target.value as "ARS" | "USD")}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Contacto comprador *</label>
            <input style={inputStyle} value={comprador} onChange={e => setComprador(e.target.value)} placeholder="Nombre + teléfono..." />
          </div>

          <div>
            <label style={labelStyle}>Contacto vendedor *</label>
            <input style={inputStyle} value={vendedor} onChange={e => setVendedor(e.target.value)} placeholder="Nombre + teléfono..." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Precio pedido *</label>
              <input style={inputStyle} type="number" value={precioPedido} onChange={e => setPrecioPedido(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Vencimiento</label>
              <input style={inputStyle} type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notas</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "70px" }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones de la operación..." />
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            background: "transparent", border: `1px solid ${C.border}`,
            color: C.text, padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
          }}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{
            background: C.red, border: "none",
            color: "#fff", padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 700,
          }}>
            Guardar oferta
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nueva Ronda ─────────────────────────────────────────────────────────

interface ModalNuevaRondaProps {
  oferta: Oferta;
  onClose: () => void;
  onSave: (ronda: RondaOferta) => void;
}

function ModalNuevaRonda({ oferta, onClose, onSave }: ModalNuevaRondaProps) {
  const siguienteNumero = oferta.rondas.length + 1;
  const [tipo, setTipo] = useState<"oferta" | "contraoferta">("oferta");
  const [parte, setParte] = useState<"comprador" | "vendedor">("comprador");
  const [monto, setMonto] = useState("");
  const [condiciones, setCondiciones] = useState("");
  const [plazoDias, setPlazoDias] = useState("3");

  function handleSave() {
    const montoNum = parseFloat(monto.replace(/[^0-9.]/g, ""));
    if (isNaN(montoNum) || montoNum <= 0) {
      alert("Ingresá un monto válido.");
      return;
    }
    const ronda: RondaOferta = {
      id: generarId(),
      numero: siguienteNumero,
      fecha: new Date().toISOString(),
      tipo,
      parte,
      monto: montoNum,
      porcentaje_del_pedido: (montoNum / oferta.precio_pedido) * 100,
      condiciones,
      respuesta_plazo_dias: parseInt(plazoDias) || 3,
      estado: "pendiente",
    };
    onSave(ronda);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#1a1a1a",
    border: `1px solid ${C.border}`,
    borderRadius: "6px",
    color: C.text,
    padding: "8px 10px",
    fontSize: "13px",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    color: C.muted,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: "16px",
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: "10px", padding: "24px",
        width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto",
      }}>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "18px", margin: "0 0 6px" }}>
          Nueva ronda — R{siguienteNumero}
        </h2>
        <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 20px" }}>
          {oferta.negocio_descripcion}
        </p>

        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select style={inputStyle} value={tipo} onChange={e => setTipo(e.target.value as "oferta" | "contraoferta")}>
                <option value="oferta">Oferta</option>
                <option value="contraoferta">Contraoferta</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Parte</label>
              <select style={inputStyle} value={parte} onChange={e => setParte(e.target.value as "comprador" | "vendedor")}>
                <option value="comprador">Comprador</option>
                <option value="vendedor">Vendedor</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Monto ({oferta.moneda})</label>
              <input style={inputStyle} type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Plazo respuesta (días)</label>
              <input style={inputStyle} type="number" value={plazoDias} onChange={e => setPlazoDias(e.target.value)} min="1" max="30" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>% del precio pedido</label>
            <div style={{ color: C.text, fontSize: "16px", fontWeight: 700, padding: "6px 0" }}>
              {monto && parseFloat(monto) > 0
                ? fmtPct((parseFloat(monto) / oferta.precio_pedido) * 100)
                : "—"}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Condiciones</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "70px" }} value={condiciones} onChange={e => setCondiciones(e.target.value)} placeholder="Financiación, fecha de escritura, bienes incluidos..." />
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            background: "transparent", border: `1px solid ${C.border}`,
            color: C.text, padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
          }}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{
            background: C.red, border: "none",
            color: "#fff", padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 700,
          }}>
            Agregar ronda
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gráfico de línea SVG ──────────────────────────────────────────────────────

interface GraficoLineaProps {
  oferta: Oferta;
}

function GraficoLinea({ oferta }: GraficoLineaProps) {
  const { rondas, precio_pedido: pedido, moneda } = oferta;
  if (!rondas.length) {
    return <p style={{ color: C.muted, fontSize: "12px" }}>Sin rondas registradas.</p>;
  }

  const WIDTH = 480;
  const HEIGHT = 160;
  const PAD = { top: 20, right: 20, bottom: 30, left: 60 };
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const montos = rondas.map(r => r.monto);
  const allValues = [...montos, pedido];
  const minV = Math.min(...allValues) * 0.97;
  const maxV = Math.max(...allValues) * 1.01;

  function xOf(i: number): number {
    if (rondas.length === 1) return PAD.left + plotW / 2;
    return PAD.left + (i / (rondas.length - 1)) * plotW;
  }

  function yOf(v: number): number {
    return PAD.top + plotH - ((v - minV) / (maxV - minV)) * plotH;
  }

  const yPedido = yOf(pedido);

  // Puntos comprador (rojo) y vendedor (verde)
  const puntos = rondas.map((r, i) => ({ x: xOf(i), y: yOf(r.monto), parte: r.parte, ronda: r }));

  // Línea polilínea
  const polyline = puntos.map(p => `${p.x},${p.y}`).join(" ");

  // Zona de acuerdo: brecha < 5%
  const brechaActualPct = ((pedido - (ultimaRonda(oferta)?.monto ?? 0)) / pedido) * 100;
  const enZonaAcuerdo = brechaActualPct < 5;

  return (
    <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: "block", maxWidth: WIDTH }}>
      {/* Zona de acuerdo */}
      {enZonaAcuerdo && (
        <rect
          x={PAD.left} y={yOf(pedido * 0.95)}
          width={plotW} height={yOf(pedido * 0.97) - yOf(pedido * 0.95) + plotH * 0.15}
          fill="rgba(45,122,45,0.12)"
        />
      )}

      {/* Línea precio pedido */}
      <line
        x1={PAD.left} y1={yPedido} x2={PAD.left + plotW} y2={yPedido}
        stroke={C.muted} strokeWidth={1} strokeDasharray="5,4"
      />
      <text x={PAD.left + plotW + 2} y={yPedido + 4} fill={C.muted} fontSize={9}>
        {moneda === "USD" ? "USD" : "ARS"}
      </text>

      {/* Eje Y label */}
      <text x={PAD.left - 4} y={yPedido + 4} fill={C.muted} fontSize={9} textAnchor="end">
        {fmtMoneda(pedido, moneda).replace("$ ", "").replace("USD ", "")}
      </text>

      {/* Polilínea de rondas */}
      {puntos.length > 1 && (
        <polyline points={polyline} fill="none" stroke="#555" strokeWidth={1.5} />
      )}

      {/* Puntos */}
      {puntos.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x} cy={p.y} r={5}
            fill={p.parte === "comprador" ? C.red : C.green}
            stroke={C.card} strokeWidth={1.5}
          />
          <text x={p.x} y={p.y - 9} fill={C.text} fontSize={9} textAnchor="middle">
            R{p.ronda.numero}
          </text>
          <text x={p.x} y={HEIGHT - 8} fill={C.muted} fontSize={8} textAnchor="middle">
            {fmtFecha(p.ronda.fecha)}
          </text>
        </g>
      ))}

      {/* Leyenda */}
      <circle cx={PAD.left} cy={HEIGHT - 2} r={4} fill={C.red} />
      <text x={PAD.left + 7} y={HEIGHT - 0} fill={C.muted} fontSize={8}>Comprador</text>
      <circle cx={PAD.left + 70} cy={HEIGHT - 2} r={4} fill={C.green} />
      <text x={PAD.left + 77} y={HEIGHT - 0} fill={C.muted} fontSize={8}>Vendedor</text>
    </svg>
  );
}

// ── Gráfico barras SVG (historial) ────────────────────────────────────────────

interface GraficoBarrasProps {
  ofertas: Oferta[];
}

function GraficoBarras({ ofertas }: GraficoBarrasProps) {
  const WIDTH = 520;
  const HEIGHT = 160;
  const PAD = { top: 20, right: 20, bottom: 40, left: 40 };
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  // Últimos 6 meses
  const meses: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("es-AR", { month: "short" }).toUpperCase();
    meses.push({ key, label });
  }

  const datos = meses.map(m => {
    const del_mes = ofertas.filter(o => o.created_at.slice(0, 7) === m.key);
    return {
      ...m,
      aceptadas: del_mes.filter(o => o.estado === "aceptada").length,
      rechazadas: del_mes.filter(o => o.estado === "rechazada").length,
    };
  });

  const maxVal = Math.max(...datos.map(d => d.aceptadas + d.rechazadas), 1);
  const barW = plotW / meses.length;
  const barPad = barW * 0.2;

  return (
    <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: "block", maxWidth: WIDTH }}>
      {datos.map((d, i) => {
        const x = PAD.left + i * barW + barPad / 2;
        const w = barW - barPad;
        const hAceptadas = (d.aceptadas / maxVal) * plotH;
        const hRechazadas = (d.rechazadas / maxVal) * plotH;
        const yBase = PAD.top + plotH;
        return (
          <g key={d.key}>
            {/* rechazadas (abajo) */}
            <rect x={x} y={yBase - hRechazadas} width={w} height={hRechazadas} fill={C.red} opacity={0.8} />
            {/* aceptadas (encima) */}
            <rect x={x} y={yBase - hRechazadas - hAceptadas} width={w} height={hAceptadas} fill={C.green} opacity={0.8} />
            <text x={x + w / 2} y={HEIGHT - 6} fill={C.muted} fontSize={9} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
      {/* Leyenda */}
      <rect x={PAD.left} y={4} width={10} height={10} fill={C.green} />
      <text x={PAD.left + 14} y={13} fill={C.muted} fontSize={9}>Aceptadas</text>
      <rect x={PAD.left + 80} y={4} width={10} height={10} fill={C.red} />
      <text x={PAD.left + 94} y={13} fill={C.muted} fontSize={9}>Rechazadas</text>
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function SeguimientoOfertas() {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("activas");
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>("todos");
  const [filtroTipoOp, setFiltroTipoOp] = useState<TipoOpFiltro>("todos");
  const [modalNuevaOferta, setModalNuevaOferta] = useState(false);
  const [modalRondaOfertaId, setModalRondaOfertaId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_seguimiento_ofertas")
        .select("ofertas")
        .eq("perfil_id", userId)
        .maybeSingle();
      if (row?.ofertas && Array.isArray(row.ofertas) && row.ofertas.length > 0) {
        setOfertas(row.ofertas as Oferta[]);
      }
      setLoading(false);
    });
  }, []);

  const guardarSB = useCallback(async (nuevas: Oferta[]) => {
    if (!uid) return;
    await supabase.from("crm_seguimiento_ofertas").upsert(
      { perfil_id: uid, ofertas: nuevas, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id" }
    );
  }, [uid]);

  const actualizarYGuardar = useCallback((nuevas: Oferta[]) => {
    setOfertas(nuevas);
    guardarSB(nuevas);
  }, [guardarSB]);

  const agregarOferta = useCallback((oferta: Oferta) => {
    const nuevas = [oferta, ...ofertas];
    actualizarYGuardar(nuevas);
    setModalNuevaOferta(false);
  }, [ofertas, actualizarYGuardar]);

  const agregarRonda = useCallback((ofertaId: string, ronda: RondaOferta) => {
    const nuevas = ofertas.map(o => {
      if (o.id !== ofertaId) return o;
      const rondas = [...o.rondas, ronda];
      const estado: Oferta["estado"] = ronda.parte === "vendedor" ? "contraoferta" : "activa";
      return { ...o, rondas, estado };
    });
    actualizarYGuardar(nuevas);
    setModalRondaOfertaId(null);
  }, [ofertas, actualizarYGuardar]);

  const marcarEstado = useCallback((ofertaId: string, estado: Oferta["estado"]) => {
    const nuevas = ofertas.map(o => o.id === ofertaId ? { ...o, estado } : o);
    actualizarYGuardar(nuevas);
  }, [ofertas, actualizarYGuardar]);

  // KPIs
  const kpis = useMemo(() => {
    const total = ofertas.length;
    const activas = ofertas.filter(o => o.estado === "activa" || o.estado === "contraoferta").length;
    const aceptadas = ofertas.filter(o => o.estado === "aceptada").length;
    const tasaCierre = total > 0 ? (aceptadas / total) * 100 : 0;
    const cerradas = ofertas.filter(o => o.estado === "aceptada");
    const brechasPromedio = cerradas.length > 0
      ? cerradas.reduce((s, o) => {
          const ultima = ultimaRonda(o);
          if (!ultima) return s;
          return s + ((o.precio_pedido - ultima.monto) / o.precio_pedido) * 100;
        }, 0) / cerradas.length
      : 0;
    return { total, activas, aceptadas, tasaCierre, brechasPromedio };
  }, [ofertas]);

  // Filtradas
  const ofertasFiltradas = useMemo(() => {
    return ofertas.filter(o => {
      if (filtroEstado !== "todos" && o.estado !== filtroEstado) return false;
      if (filtroTipoOp !== "todos" && o.tipo_operacion !== filtroTipoOp) return false;
      return true;
    });
  }, [ofertas, filtroEstado, filtroTipoOp]);

  const ofertaParaRonda = modalRondaOfertaId
    ? ofertas.find(o => o.id === modalRondaOfertaId) ?? null
    : null;

  // Estadísticas históricas
  const statsHistorial = useMemo(() => {
    const cerradas = ofertas.filter(o => o.estado === "aceptada" || o.estado === "rechazada");
    const aceptadas = cerradas.filter(o => o.estado === "aceptada");
    const pctAceptadas = cerradas.length > 0 ? (aceptadas.length / cerradas.length) * 100 : 0;
    const brechaPromCierre = aceptadas.length > 0
      ? aceptadas.reduce((s, o) => {
          const u = ultimaRonda(o);
          return s + (u ? ((o.precio_pedido - u.monto) / o.precio_pedido) * 100 : 0);
        }, 0) / aceptadas.length
      : 0;
    const duracionProm = cerradas.length > 0
      ? cerradas.reduce((s, o) => s + duracionDias(o), 0) / cerradas.length
      : 0;
    const rondasProm = cerradas.length > 0
      ? cerradas.reduce((s, o) => s + o.rondas.length, 0) / cerradas.length
      : 0;
    return { total: cerradas.length, pctAceptadas, brechaPromCierre, duracionProm, rondasProm, aceptadas, cerradas };
  }, [ofertas]);

  const tabStyle = (t: TabId): React.CSSProperties => ({
    padding: "8px 18px",
    borderRadius: "6px 6px 0 0",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: tab === t ? 700 : 400,
    background: tab === t ? C.card : "transparent",
    color: tab === t ? C.text : C.muted,
    borderBottom: tab === t ? `2px solid ${C.red}` : "2px solid transparent",
  });

  const selectStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: `1px solid ${C.border}`,
    borderRadius: "6px",
    color: C.text,
    padding: "6px 10px",
    fontSize: "12px",
  };

  const kpiCardStyle: React.CSSProperties = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    padding: "14px 18px",
    flex: "1 1 140px",
  };

  if (loading) {
    return <div style={{ ...styleBase, display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando...</div>;
  }

  return (
    <div style={styleBase}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 16px" }}>

        {/* Encabezado */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(20px, 4vw, 28px)",
            margin: "0 0 4px",
            color: C.text,
          }}>
            Seguimiento de Ofertas
          </h1>
          <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>
            Trackeá el progreso de cada negociación en tiempo real
          </p>
        </div>

        {/* KPIs globales */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
          <div style={kpiCardStyle}>
            <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total activas</div>
            <div style={{ fontSize: "26px", fontWeight: 800, fontFamily: "Montserrat, sans-serif", color: C.yellow }}>{kpis.activas}</div>
          </div>
          <div style={kpiCardStyle}>
            <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tasa de cierre</div>
            <div style={{ fontSize: "26px", fontWeight: 800, fontFamily: "Montserrat, sans-serif", color: C.green }}>{fmtPct(kpis.tasaCierre)}</div>
          </div>
          <div style={kpiCardStyle}>
            <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Brecha promedio cierre</div>
            <div style={{ fontSize: "26px", fontWeight: 800, fontFamily: "Montserrat, sans-serif", color: C.text }}>{fmtPct(kpis.brechasPromedio)}</div>
          </div>
          <div style={kpiCardStyle}>
            <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total ofertas</div>
            <div style={{ fontSize: "26px", fontWeight: 800, fontFamily: "Montserrat, sans-serif", color: C.text }}>{kpis.total}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: "20px" }}>
          <button style={tabStyle("activas")} onClick={() => setTab("activas")}>Ofertas activas</button>
          <button style={tabStyle("timeline")} onClick={() => setTab("timeline")}>Timeline</button>
          <button style={tabStyle("historial")} onClick={() => setTab("historial")}>Historial</button>
        </div>

        {/* ── TAB: Activas ── */}
        {tab === "activas" && (
          <div>
            {/* Controles */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "18px", alignItems: "center" }}>
              <select style={selectStyle} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoFiltro)}>
                <option value="todos">Todos los estados</option>
                <option value="activa">Activa</option>
                <option value="contraoferta">Contraoferta</option>
                <option value="aceptada">Aceptada</option>
                <option value="rechazada">Rechazada</option>
                <option value="vencida">Vencida</option>
              </select>
              <select style={selectStyle} value={filtroTipoOp} onChange={e => setFiltroTipoOp(e.target.value as TipoOpFiltro)}>
                <option value="todos">Todas las operaciones</option>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
              </select>
              <div style={{ marginLeft: "auto" }}>
                <button
                  onClick={() => setModalNuevaOferta(true)}
                  style={{
                    background: C.red, border: "none",
                    color: "#fff", padding: "8px 16px", borderRadius: "6px",
                    cursor: "pointer", fontSize: "13px", fontWeight: 700,
                  }}
                >
                  + Nueva oferta
                </button>
              </div>
            </div>

            {/* Lista de cards */}
            {ofertasFiltradas.length === 0 && (
              <p style={{ color: C.muted, textAlign: "center", padding: "40px 0" }}>
                No hay ofertas con los filtros seleccionados.
              </p>
            )}

            <div style={{ display: "grid", gap: "16px" }}>
              {ofertasFiltradas.map(oferta => {
                const ultima = ultimaRonda(oferta);
                const brecha = brechaActual(oferta);
                const diasVenc = diasHasta(oferta.fecha_vencimiento);
                const vencePronto = diasVenc >= 0 && diasVenc <= 2;
                const estaActiva = oferta.estado === "activa" || oferta.estado === "contraoferta";

                return (
                  <div key={oferta.id} style={{
                    background: C.card,
                    border: `1px solid ${vencePronto && estaActiva ? C.red : C.border}`,
                    borderRadius: "10px",
                    padding: "18px",
                  }}>
                    {/* Header */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "2px" }}>
                          {oferta.negocio_descripcion}
                        </div>
                        <div style={{ color: C.muted, fontSize: "11px" }}>
                          {oferta.tipo_operacion === "venta" ? "Venta" : "Alquiler"} · Inicio: {fmtFecha(oferta.fecha_inicio)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={badgeEstado(oferta.estado)}>{labelEstado(oferta.estado)}</span>
                        {vencePronto && estaActiva && (
                          <span style={{ background: C.red, color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", letterSpacing: "0.3px" }}>
                            ⚠ Vence {diasVenc === 0 ? "hoy" : `en ${diasVenc}d`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contactos + Precios */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "14px" }}>
                      <div>
                        <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Comprador</div>
                        <div style={{ fontSize: "13px" }}>{oferta.contacto_comprador}</div>
                      </div>
                      <div>
                        <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Vendedor</div>
                        <div style={{ fontSize: "13px" }}>{oferta.contacto_vendedor}</div>
                      </div>
                      <div>
                        <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Precio pedido</div>
                        <div style={{ fontSize: "14px", fontWeight: 700 }}>{fmtMoneda(oferta.precio_pedido, oferta.moneda)}</div>
                      </div>
                      <div>
                        <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Última oferta</div>
                        {ultima ? (
                          <div>
                            <span style={{ fontSize: "14px", fontWeight: 700 }}>{fmtMoneda(ultima.monto, oferta.moneda)}</span>
                            <span style={{ color: brecha > 10 ? C.red : brecha > 5 ? C.yellow : C.green, fontSize: "11px", marginLeft: "6px" }}>
                              −{fmtPct(brecha)} ({fmtMoneda(oferta.precio_pedido - ultima.monto, oferta.moneda)})
                            </span>
                          </div>
                        ) : <div style={{ color: C.muted }}>Sin rondas</div>}
                      </div>
                    </div>

                    {/* Timeline de rondas */}
                    {oferta.rondas.length > 0 && (
                      <div style={{ marginBottom: "14px" }}>
                        <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                          Rondas
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {[...oferta.rondas].sort((a, b) => a.numero - b.numero).map(r => (
                            <div key={r.id} style={{
                              background: "#1a1a1a",
                              border: `1px solid ${C.border}`,
                              borderRadius: "6px",
                              padding: "6px 10px",
                              fontSize: "11px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                              minWidth: "120px",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                <span style={{
                                  fontWeight: 700,
                                  color: r.parte === "comprador" ? C.red : C.green,
                                }}>R{r.numero}</span>
                                <span style={{ color: C.muted }}>{r.parte === "comprador" ? "Comprador" : "Vendedor"}</span>
                              </div>
                              <div style={{ fontWeight: 600 }}>{fmtMoneda(r.monto, oferta.moneda)}</div>
                              <div style={{ color: C.muted }}>{fmtFecha(r.fecha)}</div>
                              {r.estado !== "pendiente" && (
                                <div style={{
                                  fontSize: "9px",
                                  color: r.estado === "aceptada" ? C.green : r.estado === "rechazada" ? C.red : C.muted,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.3px",
                                }}>
                                  {r.estado}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notas */}
                    {oferta.notas && (
                      <div style={{ color: C.muted, fontSize: "12px", marginBottom: "14px", fontStyle: "italic" }}>
                        {oferta.notas}
                      </div>
                    )}

                    {/* Acciones */}
                    {estaActiva && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        <button
                          onClick={() => setModalRondaOfertaId(oferta.id)}
                          style={{
                            background: "#1a1a1a", border: `1px solid ${C.border}`,
                            color: C.text, padding: "6px 12px", borderRadius: "6px",
                            cursor: "pointer", fontSize: "12px",
                          }}
                        >
                          + Nueva ronda
                        </button>
                        <button
                          onClick={() => marcarEstado(oferta.id, "aceptada")}
                          style={{
                            background: C.green, border: "none",
                            color: "#fff", padding: "6px 12px", borderRadius: "6px",
                            cursor: "pointer", fontSize: "12px", fontWeight: 700,
                          }}
                        >
                          ✓ Marcar aceptada
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("¿Rechazar esta oferta?")) marcarEstado(oferta.id, "rechazada");
                          }}
                          style={{
                            background: "transparent", border: `1px solid ${C.red}`,
                            color: C.red, padding: "6px 12px", borderRadius: "6px",
                            cursor: "pointer", fontSize: "12px",
                          }}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: Timeline ── */}
        {tab === "timeline" && (
          <div style={{ display: "grid", gap: "20px" }}>
            {ofertas
              .filter(o => o.estado === "activa" || o.estado === "contraoferta")
              .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
              .map(oferta => (
                <div key={oferta.id} style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: "10px",
                  padding: "18px",
                }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ fontWeight: 700, fontSize: "14px" }}>{oferta.negocio_descripcion}</div>
                      <div style={{ color: C.muted, fontSize: "11px" }}>
                        Precio pedido: {fmtMoneda(oferta.precio_pedido, oferta.moneda)} · {oferta.rondas.length} rondas
                      </div>
                    </div>
                    <span style={badgeEstado(oferta.estado)}>{labelEstado(oferta.estado)}</span>
                  </div>
                  <GraficoLinea oferta={oferta} />
                  <div style={{ display: "flex", gap: "16px", marginTop: "10px", flexWrap: "wrap" }}>
                    <span style={{ color: C.muted, fontSize: "11px" }}>
                      Brecha actual: <strong style={{ color: C.text }}>{fmtPct(brechaActual(oferta))}</strong>
                    </span>
                    <span style={{ color: C.muted, fontSize: "11px" }}>
                      Vencimiento: <strong style={{ color: diasHasta(oferta.fecha_vencimiento) <= 2 ? C.red : C.text }}>{fmtFecha(oferta.fecha_vencimiento)}</strong>
                    </span>
                    <span style={{ color: C.muted, fontSize: "11px" }}>
                      Duración: <strong style={{ color: C.text }}>{duracionDias(oferta)} días</strong>
                    </span>
                  </div>
                </div>
              ))}
            {ofertas.filter(o => o.estado === "activa" || o.estado === "contraoferta").length === 0 && (
              <p style={{ color: C.muted, textAlign: "center", padding: "40px 0" }}>
                No hay negociaciones activas en este momento.
              </p>
            )}
          </div>
        )}

        {/* ── TAB: Historial ── */}
        {tab === "historial" && (
          <div>
            {/* KPIs historial */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
              {[
                { label: "Total cerradas", value: statsHistorial.total.toString(), color: C.text },
                { label: "% aceptadas", value: fmtPct(statsHistorial.pctAceptadas), color: C.green },
                { label: "Brecha prom. cierre", value: fmtPct(statsHistorial.brechaPromCierre), color: C.text },
                { label: "Duración prom.", value: `${statsHistorial.duracionProm.toFixed(0)}d`, color: C.text },
                { label: "Rondas promedio", value: statsHistorial.rondasProm.toFixed(1), color: C.text },
              ].map(k => (
                <div key={k.label} style={{ ...kpiCardStyle, minWidth: "120px" }}>
                  <div style={{ color: C.muted, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.label}</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, fontFamily: "Montserrat, sans-serif", color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Gráfico barras */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: "10px", padding: "18px", marginBottom: "20px",
            }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>
                Ofertas por mes (últimos 6 meses)
              </div>
              <GraficoBarras ofertas={ofertas} />
            </div>

            {/* Tabla historial */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: "10px", overflow: "auto",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Propiedad", "Tipo", "Precio pedido", "Última oferta", "Brecha", "Rondas", "Duración", "Estado"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        color: C.muted,
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: 600,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statsHistorial.cerradas.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: "30px", textAlign: "center", color: C.muted }}>
                        No hay ofertas cerradas aún.
                      </td>
                    </tr>
                  )}
                  {statsHistorial.cerradas.map(o => {
                    const u = ultimaRonda(o);
                    const brecha = u ? ((o.precio_pedido - u.monto) / o.precio_pedido) * 100 : 0;
                    return (
                      <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 14px", fontSize: "13px" }}>
                          <div>{o.negocio_descripcion}</div>
                          <div style={{ color: C.muted, fontSize: "11px" }}>{o.contacto_comprador}</div>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "12px", color: C.muted, textTransform: "capitalize" }}>
                          {o.tipo_operacion}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "13px", fontWeight: 600 }}>
                          {fmtMoneda(o.precio_pedido, o.moneda)}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "13px" }}>
                          {u ? fmtMoneda(u.monto, o.moneda) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "12px", color: brecha > 10 ? C.red : brecha > 5 ? C.yellow : C.green }}>
                          {fmtPct(brecha)}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "12px", textAlign: "center" }}>
                          {o.rondas.length}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "12px", color: C.muted }}>
                          {duracionDias(o)}d
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={badgeEstado(o.estado)}>{labelEstado(o.estado)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {modalNuevaOferta && (
        <ModalNuevaOferta onClose={() => setModalNuevaOferta(false)} onSave={agregarOferta} />
      )}
      {ofertaParaRonda && (
        <ModalNuevaRonda
          oferta={ofertaParaRonda}
          onClose={() => setModalRondaOfertaId(null)}
          onSave={ronda => agregarRonda(ofertaParaRonda.id, ronda)}
        />
      )}
    </div>
  );
}
