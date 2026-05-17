"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type TipoPropiedad = "departamento" | "casa" | "ph" | "local" | "oficina" | "terreno";
type EstadoConservacion = "excelente" | "muy_bueno" | "bueno" | "regular" | "malo";
type Orientacion =
  | "norte" | "sur" | "este" | "oeste"
  | "noreste" | "noroeste" | "sureste" | "suroeste";
type Luminosidad = "muy_luminoso" | "luminoso" | "regular" | "oscuro";

interface PropiedadInputs {
  tipo: TipoPropiedad;
  superficieCubierta: number;
  superficieTotal: number;
  ambientes: number;
  dormitorios: number;
  banos: number;
  piso: number;
  tieneAscensor: boolean;
  tieneCochera: boolean;
  tienePiscina: boolean;
  tieneJardin: boolean;
  tieneTerrazaOBalcon: boolean;
  tieneSalon: boolean;
  tieneGimnasio: boolean;
  tieneSeguridad24h: boolean;
  estadoConservacion: EstadoConservacion;
  antiguedad: number;
  orientacion: Orientacion;
  luminosidad: Luminosidad;
}

interface PrecioReferencia {
  precioBasePorM2: number;
  ciudad: string;
  barrio: string;
}

interface AjusteItem {
  nombre: string;
  pct: number;
  activo: boolean;
  categoria: string;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const PROP_DEFAULT: PropiedadInputs = {
  tipo: "departamento",
  superficieCubierta: 80,
  superficieTotal: 80,
  ambientes: 3,
  dormitorios: 2,
  banos: 1,
  piso: 3,
  tieneAscensor: true,
  tieneCochera: false,
  tienePiscina: false,
  tieneJardin: false,
  tieneTerrazaOBalcon: true,
  tieneSalon: false,
  tieneGimnasio: false,
  tieneSeguridad24h: false,
  estadoConservacion: "bueno",
  antiguedad: 20,
  orientacion: "norte",
  luminosidad: "luminoso",
};

const REF_DEFAULT: PrecioReferencia = {
  precioBasePorM2: 2500,
  ciudad: "Rosario",
  barrio: "Centro",
};

// ── Adjustment table ──────────────────────────────────────────────────────────

const AJUSTES_CONFIG = {
  PB: -8,
  bajo_1_3: 0,
  medio_4_7: 5,
  alto_8_mas: 12,
  sinAscensor: -5,
  cochera: 8,
  piscina: 6,
  jardin: 5,
  terraza_balcon: 3,
  salon_usos: 2,
  gimnasio: 3,
  seguridad24h: 4,
  excelente: 10,
  muy_bueno: 5,
  bueno: 0,
  regular: -10,
  malo: -20,
  menos5anos: 8,
  entre5_15: 3,
  entre15_30: 0,
  entre30_50: -5,
  mas50anos: -10,
  norte: 3,
  noreste_noroeste: 2,
  este_oeste: 0,
  sur: -3,
  sureste_suroeste: -1,
  muy_luminoso: 5,
  luminoso: 2,
  regular_lum: 0,
  oscuro: -8,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function pisoKey(piso: number): keyof typeof AJUSTES_CONFIG {
  if (piso === 0) return "PB";
  if (piso <= 3) return "bajo_1_3";
  if (piso <= 7) return "medio_4_7";
  return "alto_8_mas";
}

function antiguedadKey(anos: number): keyof typeof AJUSTES_CONFIG {
  if (anos < 5) return "menos5anos";
  if (anos < 15) return "entre5_15";
  if (anos < 30) return "entre15_30";
  if (anos < 50) return "entre30_50";
  return "mas50anos";
}

function orientacionKey(o: Orientacion): keyof typeof AJUSTES_CONFIG {
  if (o === "norte") return "norte";
  if (o === "noreste" || o === "noroeste") return "noreste_noroeste";
  if (o === "este" || o === "oeste") return "este_oeste";
  if (o === "sur") return "sur";
  return "sureste_suroeste";
}

function luminosidadKey(l: Luminosidad): keyof typeof AJUSTES_CONFIG {
  if (l === "muy_luminoso") return "muy_luminoso";
  if (l === "luminoso") return "luminoso";
  if (l === "regular") return "regular_lum";
  return "oscuro";
}

// ── Compute adjustments ───────────────────────────────────────────────────────

function computeAjustes(prop: PropiedadInputs): AjusteItem[] {
  const items: AjusteItem[] = [];
  const isDep = prop.tipo === "departamento" || prop.tipo === "ph";

  // Piso
  if (isDep) {
    const key = pisoKey(prop.piso);
    const pct = AJUSTES_CONFIG[key];
    const labels: Record<string, string> = {
      PB: "Planta baja",
      bajo_1_3: "Piso bajo (1–3)",
      medio_4_7: "Piso medio (4–7)",
      alto_8_mas: "Piso alto (8+)",
    };
    items.push({ nombre: labels[key], pct, activo: pct !== 0, categoria: "Piso" });
  }

  // Ascensor
  if (isDep && !prop.tieneAscensor && prop.piso > 0) {
    items.push({ nombre: "Sin ascensor", pct: AJUSTES_CONFIG.sinAscensor, activo: true, categoria: "Accesibilidad" });
  }

  // Amenities
  const amenities: Array<{ nombre: string; key: keyof typeof AJUSTES_CONFIG; tiene: boolean }> = [
    { nombre: "Cochera", key: "cochera", tiene: prop.tieneCochera },
    { nombre: "Piscina", key: "piscina", tiene: prop.tienePiscina },
    { nombre: "Jardín", key: "jardin", tiene: prop.tieneJardin },
    { nombre: "Terraza / balcón", key: "terraza_balcon", tiene: prop.tieneTerrazaOBalcon },
    { nombre: "Salón de usos múltiples", key: "salon_usos", tiene: prop.tieneSalon },
    { nombre: "Gimnasio", key: "gimnasio", tiene: prop.tieneGimnasio },
    { nombre: "Seguridad 24h", key: "seguridad24h", tiene: prop.tieneSeguridad24h },
  ];
  for (const a of amenities) {
    items.push({
      nombre: a.nombre,
      pct: AJUSTES_CONFIG[a.key],
      activo: a.tiene,
      categoria: "Amenities",
    });
  }

  // Estado de conservación
  const estadoLabels: Record<EstadoConservacion, string> = {
    excelente: "Estado excelente",
    muy_bueno: "Estado muy bueno",
    bueno: "Estado bueno",
    regular: "Estado regular",
    malo: "Estado malo",
  };
  const estadoPct = AJUSTES_CONFIG[prop.estadoConservacion];
  items.push({
    nombre: estadoLabels[prop.estadoConservacion],
    pct: estadoPct,
    activo: estadoPct !== 0,
    categoria: "Conservación",
  });

  // Antigüedad
  const antKey = antiguedadKey(prop.antiguedad);
  const antPct = AJUSTES_CONFIG[antKey];
  const antLabels: Record<string, string> = {
    menos5anos: "Antigüedad < 5 años",
    entre5_15: "Antigüedad 5–15 años",
    entre15_30: "Antigüedad 15–30 años",
    entre30_50: "Antigüedad 30–50 años",
    mas50anos: "Antigüedad > 50 años",
  };
  items.push({
    nombre: antLabels[antKey],
    pct: antPct,
    activo: antPct !== 0,
    categoria: "Antigüedad",
  });

  // Orientación
  const oriKey = orientacionKey(prop.orientacion);
  const oriPct = AJUSTES_CONFIG[oriKey];
  const oriLabels: Record<string, string> = {
    norte: "Orientación norte",
    noreste_noroeste: "Orientación NE / NO",
    este_oeste: "Orientación E / O",
    sur: "Orientación sur",
    sureste_suroeste: "Orientación SE / SO",
  };
  items.push({
    nombre: oriLabels[oriKey],
    pct: oriPct,
    activo: oriPct !== 0,
    categoria: "Orientación",
  });

  // Luminosidad
  const lumKey = luminosidadKey(prop.luminosidad);
  const lumPct = AJUSTES_CONFIG[lumKey];
  const lumLabels: Record<string, string> = {
    muy_luminoso: "Muy luminoso",
    luminoso: "Luminoso",
    regular_lum: "Luminosidad regular",
    oscuro: "Oscuro",
  };
  items.push({
    nombre: lumLabels[lumKey],
    pct: lumPct,
    activo: lumPct !== 0,
    categoria: "Luminosidad",
  });

  return items;
}

// ── Waterfall SVG ─────────────────────────────────────────────────────────────

interface WaterfallBar {
  label: string;
  valor: number;
  tipo: "base" | "pos" | "neg" | "final";
  x: number;
  y: number;
  h: number;
  w: number;
}

function WaterfallChart({
  precioBase,
  precioAjustado,
  ajustes,
}: {
  precioBase: number;
  precioAjustado: number;
  ajustes: AjusteItem[];
}) {
  const W = 700;
  const H = 300;
  const PAD = { top: 30, right: 20, bottom: 50, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Only include adjustments with pct >= 2% magnitude
  const significativos = ajustes.filter((a) => a.activo && Math.abs(a.pct) >= 2);

  const totalBars = 2 + significativos.length; // base + ajustes + final
  const barW = Math.max(20, Math.min(50, (chartW / totalBars) * 0.6));
  const gap = (chartW - barW * totalBars) / (totalBars - 1 || 1);

  // Determine y axis range
  const allVals: number[] = [precioBase, precioAjustado];
  let running = precioBase;
  for (const a of significativos) {
    const delta = precioBase * (a.pct / 100);
    allVals.push(running);
    allVals.push(running + delta);
    running += delta;
  }
  const minY = Math.min(...allVals) * 0.9;
  const maxY = Math.max(...allVals) * 1.1;
  const range = maxY - minY || 1;

  function toY(val: number): number {
    return PAD.top + chartH - ((val - minY) / range) * chartH;
  }

  const bars: WaterfallBar[] = [];
  let cursor = precioBase;
  let xPos = 0;

  // Base bar
  bars.push({
    label: "Base",
    valor: precioBase,
    tipo: "base",
    x: PAD.left + xPos * (barW + gap),
    y: toY(precioBase),
    h: ((precioBase - minY) / range) * chartH,
    w: barW,
  });
  xPos++;

  // Differential bars
  for (const a of significativos) {
    const delta = precioBase * (a.pct / 100);
    const from = cursor;
    const to = cursor + delta;
    const tipo: "pos" | "neg" = delta >= 0 ? "pos" : "neg";
    bars.push({
      label: a.pct > 0 ? `+${a.pct}%` : `${a.pct}%`,
      valor: to,
      tipo,
      x: PAD.left + xPos * (barW + gap),
      y: delta >= 0 ? toY(to) : toY(from),
      h: Math.abs((delta / range) * chartH),
      w: barW,
    });
    cursor = to;
    xPos++;
  }

  // Final bar
  bars.push({
    label: "Ajustado",
    valor: precioAjustado,
    tipo: "final",
    x: PAD.left + xPos * (barW + gap),
    y: toY(precioAjustado),
    h: ((precioAjustado - minY) / range) * chartH,
    w: barW,
  });

  const barColors: Record<string, string> = {
    base: "#3b82f6",
    pos: "#22c55e",
    neg: "#cc0000",
    final: "#cc0000",
  };

  // Y axis ticks
  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => minY + (range * i) / ticks);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-label="Gráfico de cascada de ajustes"
    >
      {/* Grid lines */}
      {tickVals.map((tv, i) => {
        const ty = toY(tv);
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={ty}
              x2={W - PAD.right}
              y2={ty}
              stroke="#1f2937"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={ty + 4}
              textAnchor="end"
              fill="#6b7280"
              fontSize={9}
            >
              {fmt(tv, 0)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {bars.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={Math.max(b.h, 2)}
            fill={barColors[b.tipo]}
            opacity={b.tipo === "base" ? 0.7 : 0.85}
            rx={3}
          />
          {/* Connector line from previous bar top */}
          {i > 0 && i < bars.length - 1 && (
            <line
              x1={bars[i - 1].x + bars[i - 1].w}
              y1={b.tipo === "pos" ? b.y + b.h : b.y}
              x2={b.x}
              y2={b.tipo === "pos" ? b.y + b.h : b.y}
              stroke="#374151"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          {/* Label below */}
          <text
            x={b.x + b.w / 2}
            y={H - PAD.bottom + 14}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize={9}
          >
            {b.label}
          </text>
          {/* Value above bar */}
          <text
            x={b.x + b.w / 2}
            y={b.y - 4}
            textAnchor="middle"
            fill="#e5e5e5"
            fontSize={9}
          >
            {fmt(b.valor, 0)}
          </text>
        </g>
      ))}

      {/* Axis line */}
      <line
        x1={PAD.left}
        y1={PAD.top + chartH}
        x2={W - PAD.right}
        y2={PAD.top + chartH}
        stroke="#374151"
        strokeWidth={1}
      />
    </svg>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "4px 0",
        color: value ? "#e5e5e5" : "#6b7280",
        fontSize: 12,
        width: "100%",
        textAlign: "left",
      }}
      aria-pressed={value}
    >
      <span
        style={{
          display: "inline-flex",
          width: 34,
          height: 18,
          borderRadius: 9,
          background: value ? "#cc0000" : "#374151",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
          }}
        />
      </span>
      {label}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ValuacionRapidaPage() {
  const [prop, setProp] = useState<PropiedadInputs>({ ...PROP_DEFAULT });
  const [ref, setRef] = useState<PrecioReferencia>({ ...REF_DEFAULT });

  // Helpers
  const setP = <K extends keyof PropiedadInputs>(k: K, v: PropiedadInputs[K]) =>
    setProp((p) => ({ ...p, [k]: v }));
  const setR = <K extends keyof PrecioReferencia>(k: K, v: PrecioReferencia[K]) =>
    setRef((r) => ({ ...r, [k]: v }));

  // Styles
  const inputStyle: React.CSSProperties = {
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e5e5e5",
    padding: "5px 8px",
    fontSize: 12,
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "Inter, sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 600,
    display: "block",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle };

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label style={labelStyle}>{label}</label>
      {node}
    </div>
  );

  // ── Calculations ──────────────────────────────────────────────────────────

  const calculos = useMemo(() => {
    const ajustes = computeAjustes(prop);
    const ajusteTotalPct = ajustes
      .filter((a) => a.activo)
      .reduce((s, a) => s + a.pct, 0);

    const precioAjustadoPorM2 = ref.precioBasePorM2 * (1 + ajusteTotalPct / 100);
    const valorEstimadoUSD = precioAjustadoPorM2 * prop.superficieCubierta;
    const valorMinUSD = valorEstimadoUSD * 0.9;
    const valorMaxUSD = valorEstimadoUSD * 1.1;
    const valorSegunZona = ref.precioBasePorM2 * prop.superficieCubierta;
    const diferenciaPct =
      valorSegunZona > 0
        ? ((valorEstimadoUSD - valorSegunZona) / valorSegunZona) * 100
        : 0;

    return {
      ajustes,
      ajusteTotalPct,
      precioAjustadoPorM2,
      valorEstimadoUSD,
      valorMinUSD,
      valorMaxUSD,
      valorSegunZona,
      diferenciaPct,
    };
  }, [prop, ref]);

  // ── PDF export ────────────────────────────────────────────────────────────

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const filas = calculos.ajustes
      .map(
        (a) => `
      <tr style="background:${a.activo ? "#fff" : "#f9f9f9"}">
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${a.categoria}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${a.nombre}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:${
          a.pct > 0 ? "#166534" : a.pct < 0 ? "#991b1b" : "#374151"
        };font-weight:600;">${a.pct > 0 ? "+" : ""}${a.pct}%</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${a.activo ? "✓" : "—"}</td>
      </tr>`
      )
      .join("");

    win.document.write(`
      <html>
      <head>
        <title>Tasación Rápida — ${ref.barrio}, ${ref.ciudad}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 15px; margin: 20px 0 8px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
          .result-box { background: #f9fafb; border: 2px solid #cc0000; border-radius: 8px; padding: 20px; margin: 16px 0; }
          .big { font-size: 32px; font-weight: 800; color: #cc0000; }
          .sub { font-size: 14px; color: #374151; margin-top: 4px; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
          .info-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
          .info-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; }
          .info-val { font-size: 16px; font-weight: 700; margin-top: 2px; }
        </style>
      </head>
      <body>
        <h1>Tasación Rápida por Método Comparativo</h1>
        <p style="color:#6b7280;margin-top:4px;">
          ${ref.barrio}, ${ref.ciudad} &nbsp;·&nbsp;
          ${prop.superficieCubierta} m² cubiertos &nbsp;·&nbsp;
          ${prop.ambientes} ambientes &nbsp;·&nbsp;
          ${prop.antiguedad} años de antigüedad
        </p>

        <div class="result-box">
          <div class="big">USD ${fmt(calculos.valorEstimadoUSD)}</div>
          <div class="sub">Rango estimado: USD ${fmt(calculos.valorMinUSD)} — USD ${fmt(calculos.valorMaxUSD)}</div>
        </div>

        <div class="grid2">
          <div class="info-item">
            <div class="info-label">Precio base/m² (zona)</div>
            <div class="info-val">USD ${fmt(ref.precioBasePorM2, 0)}/m²</div>
          </div>
          <div class="info-item">
            <div class="info-label">Precio ajustado/m²</div>
            <div class="info-val">USD ${fmt(calculos.precioAjustadoPorM2, 0)}/m²</div>
          </div>
          <div class="info-item">
            <div class="info-label">Ajuste total aplicado</div>
            <div class="info-val" style="color:${calculos.ajusteTotalPct >= 0 ? "#166534" : "#991b1b"}">
              ${calculos.ajusteTotalPct > 0 ? "+" : ""}${calculos.ajusteTotalPct.toFixed(1)}%
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">vs. precio de zona</div>
            <div class="info-val" style="color:${calculos.diferenciaPct >= 0 ? "#166534" : "#991b1b"}">
              ${calculos.diferenciaPct > 0 ? "+" : ""}${calculos.diferenciaPct.toFixed(1)}%
            </div>
          </div>
        </div>

        <h2>Tabla de Ajustes</h2>
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Atributo</th>
              <th style="text-align:right">Ajuste</th>
              <th style="text-align:center">Activo</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>

        <p style="margin-top:24px;font-size:11px;color:#9ca3af;">
          Tasación generada el ${new Date().toLocaleDateString("es-AR")} &nbsp;·&nbsp;
          Este informe es orientativo y no reemplaza una valuación profesional.
        </p>
      </body>
      </html>
    `);
    setTimeout(() => win.print(), 400);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const sectionHead: React.CSSProperties = {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    color: "#cc0000",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };

  const card: React.CSSProperties = {
    background: "#111",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  };

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#e5e5e5",
        padding: "24px 20px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                fontSize: 26,
                color: "#fff",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Valuación Rápida
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "6px 0 0" }}>
              Método comparativo con ajustes por atributos de la propiedad
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link
              href="/calculadoras"
              style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}
            >
              ← Calculadoras
            </Link>
            <button
              onClick={exportarPDF}
              style={{
                background: "#cc000022",
                color: "#cc0000",
                border: "1px solid #cc000044",
                borderRadius: 6,
                padding: "7px 16px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
              }}
            >
              Exportar Tasación
            </button>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 480px) 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* ════ LEFT: Inputs ════ */}
          <div>

            {/* Precio de referencia */}
            <div style={{ ...card, borderTop: "3px solid #3b82f6" }}>
              <div style={sectionHead}>Precio de Referencia</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {field(
                  "Ciudad",
                  <input
                    value={ref.ciudad}
                    onChange={(e) => setR("ciudad", e.target.value)}
                    style={inputStyle}
                    placeholder="Rosario"
                  />
                )}
                {field(
                  "Barrio",
                  <input
                    value={ref.barrio}
                    onChange={(e) => setR("barrio", e.target.value)}
                    style={inputStyle}
                    placeholder="Centro"
                  />
                )}
              </div>
              {field(
                "Precio base por m² (USD/m²)",
                <input
                  type="number"
                  value={ref.precioBasePorM2}
                  onChange={(e) =>
                    setR("precioBasePorM2", parseFloat(e.target.value) || 0)
                  }
                  style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }}
                  min={0}
                  step={100}
                />
              )}
              <p style={{ fontSize: 10, color: "#6b7280", margin: "8px 0 0" }}>
                Precio de referencia de mercado para la zona. Fuente: portales, tasadores.
              </p>
            </div>

            {/* La propiedad */}
            <div style={{ ...card, borderTop: "3px solid #cc0000" }}>
              <div style={sectionHead}>La Propiedad</div>

              {/* Tipo */}
              <div style={{ marginBottom: 12 }}>
                {field(
                  "Tipo de propiedad",
                  <select
                    value={prop.tipo}
                    onChange={(e) => setP("tipo", e.target.value as TipoPropiedad)}
                    style={selectStyle}
                  >
                    <option value="departamento">Departamento</option>
                    <option value="casa">Casa</option>
                    <option value="ph">PH</option>
                    <option value="local">Local</option>
                    <option value="oficina">Oficina</option>
                    <option value="terreno">Terreno</option>
                  </select>
                )}
              </div>

              {/* Surfaces + rooms */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {field(
                  "Sup. cubierta (m²)",
                  <input
                    type="number"
                    value={prop.superficieCubierta}
                    onChange={(e) =>
                      setP("superficieCubierta", parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                    min={0}
                  />
                )}
                {field(
                  "Sup. total (m²)",
                  <input
                    type="number"
                    value={prop.superficieTotal}
                    onChange={(e) =>
                      setP("superficieTotal", parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                    min={0}
                  />
                )}
                {field(
                  "Ambientes",
                  <input
                    type="number"
                    value={prop.ambientes}
                    onChange={(e) =>
                      setP("ambientes", parseInt(e.target.value) || 1)
                    }
                    style={inputStyle}
                    min={1}
                  />
                )}
                {field(
                  "Dormitorios",
                  <input
                    type="number"
                    value={prop.dormitorios}
                    onChange={(e) =>
                      setP("dormitorios", parseInt(e.target.value) || 0)
                    }
                    style={inputStyle}
                    min={0}
                  />
                )}
                {field(
                  "Baños",
                  <input
                    type="number"
                    value={prop.banos}
                    onChange={(e) =>
                      setP("banos", parseInt(e.target.value) || 1)
                    }
                    style={inputStyle}
                    min={1}
                  />
                )}
                {(prop.tipo === "departamento" || prop.tipo === "ph") &&
                  field(
                    "Piso",
                    <input
                      type="number"
                      value={prop.piso}
                      onChange={(e) =>
                        setP("piso", parseInt(e.target.value) || 0)
                      }
                      style={inputStyle}
                      min={0}
                    />
                  )}
                {field(
                  "Antigüedad (años)",
                  <input
                    type="number"
                    value={prop.antiguedad}
                    onChange={(e) =>
                      setP("antiguedad", parseInt(e.target.value) || 0)
                    }
                    style={inputStyle}
                    min={0}
                  />
                )}
              </div>

              {/* Estado + orientación + luminosidad */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {field(
                  "Estado de conservación",
                  <select
                    value={prop.estadoConservacion}
                    onChange={(e) =>
                      setP(
                        "estadoConservacion",
                        e.target.value as EstadoConservacion
                      )
                    }
                    style={selectStyle}
                  >
                    <option value="excelente">Excelente</option>
                    <option value="muy_bueno">Muy bueno</option>
                    <option value="bueno">Bueno</option>
                    <option value="regular">Regular</option>
                    <option value="malo">Malo</option>
                  </select>
                )}
                {field(
                  "Orientación",
                  <select
                    value={prop.orientacion}
                    onChange={(e) =>
                      setP("orientacion", e.target.value as Orientacion)
                    }
                    style={selectStyle}
                  >
                    <option value="norte">Norte</option>
                    <option value="noreste">Noreste</option>
                    <option value="noroeste">Noroeste</option>
                    <option value="este">Este</option>
                    <option value="oeste">Oeste</option>
                    <option value="sur">Sur</option>
                    <option value="sureste">Sureste</option>
                    <option value="suroeste">Suroeste</option>
                  </select>
                )}
                {field(
                  "Luminosidad",
                  <select
                    value={prop.luminosidad}
                    onChange={(e) =>
                      setP("luminosidad", e.target.value as Luminosidad)
                    }
                    style={selectStyle}
                  >
                    <option value="muy_luminoso">Muy luminoso</option>
                    <option value="luminoso">Luminoso</option>
                    <option value="regular">Regular</option>
                    <option value="oscuro">Oscuro</option>
                  </select>
                )}
              </div>

              {/* Amenities toggles */}
              <div
                style={{
                  borderTop: "1px solid #1f2937",
                  paddingTop: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#6b7280",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 10,
                  }}
                >
                  Amenities
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 4,
                  }}
                >
                  {(prop.tipo === "departamento" || prop.tipo === "ph") && (
                    <Toggle
                      value={prop.tieneAscensor}
                      onChange={(v) => setP("tieneAscensor", v)}
                      label="Ascensor"
                    />
                  )}
                  <Toggle
                    value={prop.tieneCochera}
                    onChange={(v) => setP("tieneCochera", v)}
                    label="Cochera"
                  />
                  <Toggle
                    value={prop.tienePiscina}
                    onChange={(v) => setP("tienePiscina", v)}
                    label="Piscina"
                  />
                  <Toggle
                    value={prop.tieneJardin}
                    onChange={(v) => setP("tieneJardin", v)}
                    label="Jardín"
                  />
                  <Toggle
                    value={prop.tieneTerrazaOBalcon}
                    onChange={(v) => setP("tieneTerrazaOBalcon", v)}
                    label="Terraza / Balcón"
                  />
                  <Toggle
                    value={prop.tieneSalon}
                    onChange={(v) => setP("tieneSalon", v)}
                    label="Salón de usos múlt."
                  />
                  <Toggle
                    value={prop.tieneGimnasio}
                    onChange={(v) => setP("tieneGimnasio", v)}
                    label="Gimnasio"
                  />
                  <Toggle
                    value={prop.tieneSeguridad24h}
                    onChange={(v) => setP("tieneSeguridad24h", v)}
                    label="Seguridad 24h"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ════ RIGHT: Results ════ */}
          <div>

            {/* Main result card */}
            <div
              style={{
                background: "#111",
                border: "2px solid #cc0000",
                borderRadius: 16,
                padding: 28,
                marginBottom: 20,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Background accent */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 200,
                  height: 200,
                  background:
                    "radial-gradient(circle at top right, #cc000018, transparent 70%)",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Valor estimado — {ref.barrio}, {ref.ciudad}
              </div>

              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 42,
                  color: "#fff",
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                USD {fmt(calculos.valorEstimadoUSD)}
              </div>

              <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>
                Rango:&nbsp;
                <span style={{ color: "#e5e5e5" }}>
                  USD {fmt(calculos.valorMinUSD)} — USD {fmt(calculos.valorMaxUSD)}
                </span>
                &nbsp;(±10%)
              </div>

              {/* Per-m2 comparison */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    background: "#0a0a0a",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>
                    Precio zona (base)
                  </div>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 18,
                      color: "#e5e5e5",
                    }}
                  >
                    USD {fmt(ref.precioBasePorM2, 0)}/m²
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    USD {fmt(calculos.valorSegunZona)} total
                  </div>
                </div>
                <div
                  style={{
                    background: "#0a0a0a",
                    border: "1px solid #cc000066",
                    borderRadius: 8,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>
                    Precio ajustado
                  </div>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 18,
                      color: "#cc0000",
                    }}
                  >
                    USD {fmt(calculos.precioAjustadoPorM2, 0)}/m²
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {calculos.ajusteTotalPct > 0 ? "+" : ""}
                    {calculos.ajusteTotalPct.toFixed(1)}% sobre base
                  </div>
                </div>
              </div>

              {/* Visual adjustment bar */}
              <div style={{ marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#6b7280",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Posición respecto al precio de zona
                </div>
                <div
                  style={{
                    position: "relative",
                    height: 8,
                    background: "#1f2937",
                    borderRadius: 4,
                    overflow: "visible",
                  }}
                >
                  {/* Center line (zona price) */}
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: -4,
                      width: 2,
                      height: 16,
                      background: "#6b7280",
                      borderRadius: 1,
                    }}
                  />
                  {/* Fill bar */}
                  {(() => {
                    const clampedPct = Math.max(-40, Math.min(40, calculos.ajusteTotalPct));
                    const isPos = clampedPct >= 0;
                    const widthPct = (Math.abs(clampedPct) / 40) * 50;
                    return (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: isPos ? "50%" : `calc(50% - ${widthPct}%)`,
                          width: `${widthPct}%`,
                          height: "100%",
                          background: isPos ? "#cc0000" : "#3b82f6",
                          borderRadius: 4,
                          transition: "width 0.3s, left 0.3s",
                        }}
                      />
                    );
                  })()}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    fontSize: 10,
                    color: "#6b7280",
                  }}
                >
                  <span>-40%</span>
                  <span
                    style={{
                      color:
                        calculos.diferenciaPct >= 0 ? "#22c55e" : "#f87171",
                      fontWeight: 700,
                    }}
                  >
                    {calculos.diferenciaPct > 0 ? "+" : ""}
                    {calculos.diferenciaPct.toFixed(1)}%
                  </span>
                  <span>+40%</span>
                </div>
              </div>
            </div>

            {/* Adjustment breakdown table */}
            <div
              style={{
                background: "#111",
                border: "1px solid #1f2937",
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: "#161616",
                  padding: "12px 18px",
                  borderBottom: "1px solid #1f2937",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#fff",
                  }}
                >
                  Ajustes Aplicados
                </span>
                <span
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color:
                      calculos.ajusteTotalPct >= 0 ? "#22c55e" : "#f87171",
                  }}
                >
                  Total:{" "}
                  {calculos.ajusteTotalPct > 0 ? "+" : ""}
                  {calculos.ajusteTotalPct.toFixed(1)}%
                </span>
              </div>

              {/* Active adjustments first */}
              {calculos.ajustes.some((a) => a.activo && a.pct !== 0) && (
                <div style={{ borderBottom: "1px solid #1f2937" }}>
                  {calculos.ajustes
                    .filter((a) => a.activo && a.pct !== 0)
                    .map((a, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 18px",
                          borderBottom: "1px solid #0f0f0f",
                          background: "#111",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: a.pct > 0 ? "#22c55e" : "#cc0000",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 12, color: "#e5e5e5" }}>
                            {a.nombre}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: "#6b7280",
                              background: "#1f2937",
                              borderRadius: 4,
                              padding: "1px 5px",
                            }}
                          >
                            {a.categoria}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: "Montserrat, sans-serif",
                            color: a.pct > 0 ? "#22c55e" : "#f87171",
                          }}
                        >
                          {a.pct > 0 ? "+" : ""}
                          {a.pct}%
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Inactive adjustments */}
              {calculos.ajustes
                .filter((a) => !a.activo || a.pct === 0)
                .map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 18px",
                      borderBottom: "1px solid #0a0a0a",
                      opacity: 0.45,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#374151",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        {a.nombre}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>
                      {a.pct === 0
                        ? "0% (base)"
                        : `${a.pct > 0 ? "+" : ""}${a.pct}%`}
                    </span>
                  </div>
                ))}
            </div>

            {/* Waterfall chart */}
            <div
              style={{
                background: "#111",
                border: "1px solid #1f2937",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  marginBottom: 14,
                }}
              >
                Construcción del Precio (USD/m²)
              </div>
              <WaterfallChart
                precioBase={ref.precioBasePorM2}
                precioAjustado={calculos.precioAjustadoPorM2}
                ajustes={calculos.ajustes}
              />
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 10,
                  fontSize: 10,
                  color: "#6b7280",
                  flexWrap: "wrap",
                }}
              >
                {[
                  { color: "#3b82f6", label: "Precio base" },
                  { color: "#22c55e", label: "Ajuste positivo" },
                  { color: "#cc0000", label: "Ajuste negativo / Final" },
                ].map((l) => (
                  <div
                    key={l.label}
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: l.color,
                        opacity: 0.85,
                      }}
                    />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <p
              style={{
                fontSize: 10,
                color: "#4b5563",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Esta valuación es orientativa y se basa en un método comparativo simplificado.
              No reemplaza una tasación profesional homologada. Los porcentajes de ajuste son
              valores estándar de referencia y pueden variar según el mercado local.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
