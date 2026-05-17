"use client";

import { useState, useMemo, CSSProperties } from "react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TabId = "datos" | "comparador" | "guia";
type TipoVendedor = "fisica" | "empresa";
type TipoBien = "casa-habitacion" | "otro-inmueble" | "rural";
type MonedaInput = "ARS" | "USD";

interface Inputs {
  tipoVendedor: TipoVendedor;
  fechaAdquisicion: string;
  precioCompra: string;
  monedaCompra: MonedaInput;
  precioVenta: string;
  monedaVenta: MonedaInput;
  mejoras: string;
  monedaMejoras: MonedaInput;
  tipoBien: TipoBien;
  unicaPropiedad: boolean;
  esHabitante: boolean;
  inflacionAnual: string;
  tipoCambio: string;
}

interface ResultadoCalculo {
  regimen: "ITI" | "Ganancias" | "Exento";
  tasaAlicuota: number;
  precioVentaARS: number;
  costoActualizadoARS: number;
  mejorasARS: number;
  gananciaBrutaARS: number;
  impuestoARS: number;
  impuestoUSD: number;
  netoVendedorARS: number;
  esQuebranto: boolean;
  coefActualizacion: number;
  aniosTranscurridos: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsearNumero(str: string): number {
  const n = parseFloat(str.replace(/,/g, "."));
  return isNaN(n) ? 0 : n;
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatUSD(n: number): string {
  return `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Lógica de cálculo ─────────────────────────────────────────────────────────

function calcular(inputs: Inputs): ResultadoCalculo | null {
  if (!inputs.fechaAdquisicion) return null;

  const tc = parsearNumero(inputs.tipoCambio) || 1200;
  const inflAnual = parsearNumero(inputs.inflacionAnual) / 100;

  const toARS = (monto: number, moneda: MonedaInput) =>
    moneda === "USD" ? monto * tc : monto;

  const precioCompraARS = toARS(parsearNumero(inputs.precioCompra), inputs.monedaCompra);
  const precioVentaARS  = toARS(parsearNumero(inputs.precioVenta),  inputs.monedaVenta);
  const mejorasARS      = toARS(parsearNumero(inputs.mejoras),      inputs.monedaMejoras);

  const parts = inputs.fechaAdquisicion.split("-").map(Number);
  const aqYear = parts[0] ?? 2018;
  const aqMonth = parts[1] ?? 1;

  const esAnterior2018 = aqYear < 2018;

  const hoyAnio = 2026;
  const hoyMes  = 5;

  const aniosTranscurridos = Math.max(0, hoyAnio - aqYear + (hoyMes - aqMonth) / 12);

  const coefActualizacion = Math.pow(1 + inflAnual, aniosTranscurridos);
  const costoActualizadoARS = precioCompraARS * coefActualizacion;
  const mejorasActualizadasARS = mejorasARS * coefActualizacion;

  // Exención casa-habitación
  const exento =
    inputs.tipoBien === "casa-habitacion" &&
    inputs.unicaPropiedad &&
    inputs.esHabitante &&
    inputs.tipoVendedor === "fisica";

  if (exento) {
    return {
      regimen: "Exento",
      tasaAlicuota: 0,
      precioVentaARS,
      costoActualizadoARS,
      mejorasARS: mejorasActualizadasARS,
      gananciaBrutaARS: precioVentaARS - costoActualizadoARS - mejorasActualizadasARS,
      impuestoARS: 0,
      impuestoUSD: 0,
      netoVendedorARS: precioVentaARS,
      esQuebranto: false,
      coefActualizacion,
      aniosTranscurridos,
    };
  }

  // Régimen ITI (anterior 2018)
  if (esAnterior2018) {
    const impuestoARS = precioVentaARS * 0.015;
    return {
      regimen: "ITI",
      tasaAlicuota: 1.5,
      precioVentaARS,
      costoActualizadoARS: precioCompraARS,
      mejorasARS,
      gananciaBrutaARS: precioVentaARS - precioCompraARS - mejorasARS,
      impuestoARS,
      impuestoUSD: tc > 0 ? impuestoARS / tc : 0,
      netoVendedorARS: precioVentaARS - impuestoARS,
      esQuebranto: false,
      coefActualizacion: 1,
      aniosTranscurridos,
    };
  }

  // Régimen Ganancias (desde 2018)
  const gananciaBrutaARS = precioVentaARS - costoActualizadoARS - mejorasActualizadasARS;
  const esQuebranto = gananciaBrutaARS < 0;
  const tasa = inputs.tipoVendedor === "empresa" ? 0.35 : 0.15;
  const impuestoARS = esQuebranto ? 0 : gananciaBrutaARS * tasa;

  return {
    regimen: "Ganancias",
    tasaAlicuota: tasa * 100,
    precioVentaARS,
    costoActualizadoARS,
    mejorasARS: mejorasActualizadasARS,
    gananciaBrutaARS,
    impuestoARS,
    impuestoUSD: tc > 0 ? impuestoARS / tc : 0,
    netoVendedorARS: precioVentaARS - impuestoARS,
    esQuebranto,
    coefActualizacion,
    aniosTranscurridos,
  };
}

// ── Paleta ────────────────────────────────────────────────────────────────────

const C = {
  bg:     "#0a0a0a",
  red:    "#cc0000",
  text:   "#e0e0e0",
  muted:  "#888888",
  card:   "#111111",
  border: "#222222",
  green:  "#22c55e",
  yellow: "#facc15",
} as const;

// ── Estilos estáticos ─────────────────────────────────────────────────────────

const stPage: CSSProperties = {
  background: C.bg,
  minHeight: "100vh",
  color: C.text,
  fontFamily: "'Inter', sans-serif",
  padding: "0 0 60px",
};

const stHeader: CSSProperties = {
  background: C.card,
  borderBottom: `1px solid ${C.border}`,
  padding: "28px 24px 20px",
};

const stTitulo: CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 800,
  fontSize: "clamp(1.3rem, 4vw, 1.9rem)",
  color: C.text,
  margin: 0,
};

const stSubtitulo: CSSProperties = {
  color: C.muted,
  fontSize: "0.88rem",
  marginTop: 6,
};

const stTabsRow: CSSProperties = {
  display: "flex",
  borderBottom: `1px solid ${C.border}`,
  background: C.card,
  overflowX: "auto",
  scrollbarWidth: "none",
};

const stBody: CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "24px 16px",
};

const stCard: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "20px 20px",
  marginBottom: 16,
};

const stCardTitulo: CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  fontSize: "0.8rem",
  color: C.red,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  marginBottom: 16,
};

const stFila: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const stLabel: CSSProperties = {
  fontSize: "0.75rem",
  color: C.muted,
  letterSpacing: "0.03em",
};

const stInput: CSSProperties = {
  background: "#0f0f0f",
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  fontSize: "0.9rem",
  padding: "8px 10px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const stSelect: CSSProperties = {
  background: "#0f0f0f",
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  fontSize: "0.9rem",
  padding: "8px 10px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const stCheckRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  fontSize: "0.88rem",
  color: C.text,
  marginBottom: 8,
};

const stCheckbox: CSSProperties = {
  width: 16,
  height: 16,
  accentColor: C.red,
  cursor: "pointer",
};

const stBadgeExento: CSSProperties = {
  display: "inline-block",
  background: "#166534",
  color: C.green,
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  fontSize: "0.75rem",
  letterSpacing: "0.1em",
  padding: "4px 10px",
  borderRadius: 20,
  marginBottom: 12,
};

const stDesgloseFila: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "7px 0",
  borderBottom: `1px solid ${C.border}`,
  fontSize: "0.88rem",
};

const stDesgloseLabel: CSSProperties = { color: C.muted };
const stDesgloseValor: CSSProperties = { color: C.text, fontVariantNumeric: "tabular-nums" };

const stTotalFila: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0 0",
  fontSize: "1.05rem",
  fontWeight: 700,
  fontFamily: "'Montserrat', sans-serif",
};

const stAlertaQuebranto: CSSProperties = {
  background: "#1a1a00",
  border: `1px solid ${C.yellow}`,
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: "0.85rem",
  color: C.yellow,
  marginBottom: 12,
};

const stGuiaCard: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "18px 20px",
  marginBottom: 12,
};

const stGuiaTitulo: CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  fontSize: "0.9rem",
  color: C.red,
  marginBottom: 8,
};

const stGuiaTexto: CSSProperties = {
  fontSize: "0.85rem",
  color: C.muted,
  lineHeight: 1.65,
};

const stNotaLegal: CSSProperties = {
  background: "#0d0d0d",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: "0.78rem",
  color: C.muted,
  fontStyle: "italic",
  marginTop: 20,
};

const stTablaHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: 4,
  padding: "8px 10px",
  background: "#0f0f0f",
  borderRadius: "8px 8px 0 0",
  fontSize: "0.72rem",
  color: C.muted,
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const stTablaHeader3: CSSProperties = {
  ...stTablaHeader,
  gridTemplateColumns: "1fr 1fr 1fr",
};

const stBarraContenedor: CSSProperties = { marginTop: 20 };

const stBarraFila: CSSProperties = { marginBottom: 12 };

const stBarraLabel: CSSProperties = {
  fontSize: "0.78rem",
  color: C.muted,
  marginBottom: 4,
};

// ── Estilos dinámicos ─────────────────────────────────────────────────────────

function tabBtnStyle(active: boolean): CSSProperties {
  return {
    padding: "12px 20px",
    background: "transparent",
    border: "none",
    borderBottom: active ? `2px solid ${C.red}` : "2px solid transparent",
    color: active ? C.text : C.muted,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "0.82rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
    letterSpacing: "0.04em",
  };
}

function campoStyle(flex: number = 1): CSSProperties {
  return {
    flex,
    minWidth: 140,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  };
}

function resultCardStyle(regimen: string): CSSProperties {
  return {
    background: regimen === "Exento" ? "#0d1f12" : C.card,
    border: `1px solid ${regimen === "Exento" ? "#166534" : C.border}`,
    borderRadius: 10,
    padding: "24px 20px",
    marginBottom: 16,
  };
}

function badgeRegimenStyle(r: string): CSSProperties {
  return {
    display: "inline-block",
    background: r === "ITI" ? "#1a1200" : "#1a0000",
    color: r === "ITI" ? C.yellow : C.red,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
    padding: "4px 10px",
    borderRadius: 20,
    marginBottom: 12,
  };
}

function tablaFilaStyle(highlight: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 4,
    padding: "10px 10px",
    background: highlight ? "#161616" : "transparent",
    borderBottom: `1px solid ${C.border}`,
    fontSize: "0.83rem",
    alignItems: "center",
  };
}

function tablaFila3Style(highlight: boolean): CSSProperties {
  return {
    ...tablaFilaStyle(highlight),
    gridTemplateColumns: "1fr 1fr 1fr",
  };
}

// ── Componente MonedaField ────────────────────────────────────────────────────

interface MonedaFieldProps {
  label: string;
  valor: string;
  onValor: (v: string) => void;
  moneda: MonedaInput;
  onMoneda: (m: MonedaInput) => void;
  placeholder?: string;
  opcional?: boolean;
}

function MonedaField({
  label,
  valor,
  onValor,
  moneda,
  onMoneda,
  placeholder = "0",
  opcional = false,
}: MonedaFieldProps) {
  return (
    <div style={campoStyle(1)}>
      <label style={stLabel}>
        {label}
        {opcional && (
          <span style={{ color: C.muted, fontStyle: "italic" }}> (opcional)</span>
        )}
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <select
          value={moneda}
          onChange={(e) => onMoneda(e.target.value as MonedaInput)}
          style={{ ...stSelect, width: 72, flex: "0 0 72px" }}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
        <input
          type="number"
          value={valor}
          onChange={(e) => onValor(e.target.value)}
          placeholder={placeholder}
          style={{ ...stInput, flex: 1 }}
        />
      </div>
    </div>
  );
}

// ── Card de resultado ─────────────────────────────────────────────────────────

function ResultadoCard({
  resultado,
  tc,
}: {
  resultado: ResultadoCalculo;
  tc: number;
}) {
  const { regimen } = resultado;
  void tc; // tc is passed in case future use is needed

  return (
    <div style={resultCardStyle(regimen)}>
      {regimen === "Exento" ? (
        <div style={stBadgeExento}>EXENTO</div>
      ) : (
        <div style={badgeRegimenStyle(regimen)}>
          {regimen === "ITI"
            ? "RÉGIMEN ITI — 1.5%"
            : `GANANCIAS CEDULAR — ${resultado.tasaAlicuota.toFixed(0)}%`}
        </div>
      )}

      {resultado.esQuebranto && (
        <div style={stAlertaQuebranto}>
          Quebranto: el costo actualizado supera el precio de venta. No se paga impuesto.
        </div>
      )}

      {regimen === "Exento" && (
        <p style={{ fontSize: "0.85rem", color: C.green, marginBottom: 16 }}>
          Esta operación está exenta de Ganancias e ITI por aplicarse la exención
          de casa-habitación (única propiedad, habitada por el vendedor, persona física).
        </p>
      )}

      <div>
        <div style={stDesgloseFila}>
          <span style={stDesgloseLabel}>Precio de venta</span>
          <span style={stDesgloseValor}>ARS {formatARS(resultado.precioVentaARS)}</span>
        </div>
        <div style={stDesgloseFila}>
          <span style={stDesgloseLabel}>
            Costo de adquisición actualizado
            {regimen === "Ganancias" && resultado.coefActualizacion !== 1 && (
              <span style={{ color: C.muted, fontSize: "0.75rem" }}>
                {" "}(× {resultado.coefActualizacion.toFixed(2)})
              </span>
            )}
          </span>
          <span style={stDesgloseValor}>ARS {formatARS(resultado.costoActualizadoARS)}</span>
        </div>
        {resultado.mejorasARS > 0 && (
          <div style={stDesgloseFila}>
            <span style={stDesgloseLabel}>Mejoras</span>
            <span style={stDesgloseValor}>ARS {formatARS(resultado.mejorasARS)}</span>
          </div>
        )}
        <div style={stDesgloseFila}>
          <span style={stDesgloseLabel}>Ganancia bruta</span>
          <span
            style={{
              ...stDesgloseValor,
              color: resultado.gananciaBrutaARS < 0 ? C.yellow : C.text,
            }}
          >
            ARS {formatARS(resultado.gananciaBrutaARS)}
          </span>
        </div>
        <div
          style={{
            ...stDesgloseFila,
            borderBottom: "none",
            paddingTop: 10,
          }}
        >
          <span style={{ ...stDesgloseLabel, color: C.text, fontWeight: 700 }}>
            Impuesto estimado
          </span>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                color: regimen === "Exento" ? C.green : C.red,
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "1.15rem",
              }}
            >
              ARS {formatARS(resultado.impuestoARS)}
            </div>
            <div style={{ fontSize: "0.78rem", color: C.muted }}>
              {formatUSD(resultado.impuestoUSD)}
            </div>
          </div>
        </div>
        <div style={stTotalFila}>
          <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.88rem" }}>
            Neto del vendedor
          </span>
          <span style={{ color: C.green }}>ARS {formatARS(resultado.netoVendedorARS)}</span>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: "0.73rem", color: C.muted }}>
        Años desde adquisición: {resultado.aniosTranscurridos.toFixed(1)} |
        Coeficiente de actualización: {resultado.coefActualizacion.toFixed(3)}
      </div>
    </div>
  );
}

// ── Tab Datos ─────────────────────────────────────────────────────────────────

interface TabDatosProps {
  inputs: Inputs;
  onChange: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  resultado: ResultadoCalculo | null;
}

function TabDatos({ inputs, onChange, resultado }: TabDatosProps) {
  const tc = parsearNumero(inputs.tipoCambio) || 1200;

  return (
    <>
      <div style={stCard}>
        <div style={stCardTitulo}>Vendedor</div>
        <div style={stFila}>
          <div style={campoStyle(1)}>
            <label style={stLabel}>Tipo de vendedor</label>
            <select
              value={inputs.tipoVendedor}
              onChange={(e) => onChange("tipoVendedor", e.target.value as TipoVendedor)}
              style={stSelect}
            >
              <option value="fisica">Persona física</option>
              <option value="empresa">Empresa / Persona jurídica</option>
            </select>
          </div>
          <div style={campoStyle(1)}>
            <label style={stLabel}>Tipo de bien</label>
            <select
              value={inputs.tipoBien}
              onChange={(e) => onChange("tipoBien", e.target.value as TipoBien)}
              style={stSelect}
            >
              <option value="casa-habitacion">Casa-habitación</option>
              <option value="otro-inmueble">Otro inmueble urbano</option>
              <option value="rural">Inmueble rural</option>
            </select>
          </div>
        </div>

        {inputs.tipoVendedor === "fisica" && inputs.tipoBien === "casa-habitacion" && (
          <div style={{ marginTop: 4 }}>
            <label style={stCheckRow}>
              <input
                type="checkbox"
                checked={inputs.unicaPropiedad}
                onChange={(e) => onChange("unicaPropiedad", e.target.checked)}
                style={stCheckbox}
              />
              ¿Es la única propiedad del vendedor?
            </label>
            <label style={stCheckRow}>
              <input
                type="checkbox"
                checked={inputs.esHabitante}
                onChange={(e) => onChange("esHabitante", e.target.checked)}
                style={stCheckbox}
              />
              ¿El vendedor habita la propiedad a vender?
            </label>
          </div>
        )}
      </div>

      <div style={stCard}>
        <div style={stCardTitulo}>Operación</div>
        <div style={stFila}>
          <div style={campoStyle(1)}>
            <label style={stLabel}>Fecha de adquisición (mes/año)</label>
            <input
              type="month"
              value={inputs.fechaAdquisicion}
              onChange={(e) => onChange("fechaAdquisicion", e.target.value)}
              style={stInput}
            />
          </div>
          <div style={campoStyle(1)}>
            <label style={stLabel}>Tipo de cambio (ARS / USD)</label>
            <input
              type="number"
              value={inputs.tipoCambio}
              onChange={(e) => onChange("tipoCambio", e.target.value)}
              style={stInput}
            />
          </div>
        </div>

        <div style={stFila}>
          <MonedaField
            label="Precio de adquisición"
            valor={inputs.precioCompra}
            onValor={(v) => onChange("precioCompra", v)}
            moneda={inputs.monedaCompra}
            onMoneda={(m) => onChange("monedaCompra", m)}
          />
          <MonedaField
            label="Precio de venta"
            valor={inputs.precioVenta}
            onValor={(v) => onChange("precioVenta", v)}
            moneda={inputs.monedaVenta}
            onMoneda={(m) => onChange("monedaVenta", m)}
          />
        </div>

        <div style={stFila}>
          <MonedaField
            label="Mejoras realizadas"
            valor={inputs.mejoras}
            onValor={(v) => onChange("mejoras", v)}
            moneda={inputs.monedaMejoras}
            onMoneda={(m) => onChange("monedaMejoras", m)}
            opcional
          />
          <div style={campoStyle(1)}>
            <label style={stLabel}>Inflación anual estimada (%)</label>
            <input
              type="number"
              value={inputs.inflacionAnual}
              onChange={(e) => onChange("inflacionAnual", e.target.value)}
              placeholder="100"
              style={stInput}
            />
            <span style={{ fontSize: "0.7rem", color: C.muted, marginTop: 2 }}>
              Para actualizar el costo por RIPTE/IPC
            </span>
          </div>
        </div>
      </div>

      {resultado && <ResultadoCard resultado={resultado} tc={tc} />}
    </>
  );
}

// ── Tab Comparador ────────────────────────────────────────────────────────────

function TabComparador({ inputs }: { inputs: Inputs }) {
  const precioVentaBase = parsearNumero(inputs.precioVenta);

  const escenarios = useMemo(() => {
    return ([-0.1, 0, 0.1] as const).map((v) => {
      const precioMod = (precioVentaBase * (1 + v)).toString();
      const inputsMod: Inputs = { ...inputs, precioVenta: precioMod };
      return { variacion: v, resultado: calcular(inputsMod) };
    });
  }, [inputs, precioVentaBase]);

  const maxImpuesto = Math.max(
    ...escenarios.map((e) => e.resultado?.impuestoARS ?? 0),
    1,
  );

  const etiquetas = ["−10%", "Base", "+10%"];

  return (
    <>
      <div style={stCard}>
        <div style={stCardTitulo}>Comparador de escenarios</div>
        <p style={{ fontSize: "0.82rem", color: C.muted, marginBottom: 16 }}>
          Variación del precio de venta manteniendo los demás parámetros constantes.
        </p>

        {/* Tabla ganancia / impuesto */}
        <div
          style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}
        >
          <div style={stTablaHeader}>
            <span>Escenario</span>
            <span>Precio venta</span>
            <span>Ganancia</span>
            <span>Impuesto</span>
          </div>
          {escenarios.map((e, i) => {
            const res = e.resultado;
            return (
              <div key={i} style={tablaFilaStyle(i === 1)}>
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    color: i === 1 ? C.red : C.muted,
                  }}
                >
                  {etiquetas[i]}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {res ? `ARS ${formatARS(res.precioVentaARS)}` : "—"}
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    color:
                      res && res.gananciaBrutaARS < 0 ? C.yellow : C.text,
                  }}
                >
                  {res ? `ARS ${formatARS(res.gananciaBrutaARS)}` : "—"}
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    color: res?.regimen === "Exento" ? C.green : C.red,
                    fontWeight: 700,
                  }}
                >
                  {res
                    ? res.regimen === "Exento"
                      ? "EXENTO"
                      : `ARS ${formatARS(res.impuestoARS)}`
                    : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tabla neto vendedor */}
        <div
          style={{
            borderRadius: 8,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
            marginTop: 12,
          }}
        >
          <div style={stTablaHeader3}>
            <span>Escenario</span>
            <span>Impuesto (USD)</span>
            <span>Neto vendedor</span>
          </div>
          {escenarios.map((e, i) => {
            const res = e.resultado;
            return (
              <div key={i} style={tablaFila3Style(i === 1)}>
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    color: i === 1 ? C.red : C.muted,
                  }}
                >
                  {etiquetas[i]}
                </span>
                <span style={{ color: C.red, fontVariantNumeric: "tabular-nums" }}>
                  {res ? formatUSD(res.impuestoUSD) : "—"}
                </span>
                <span style={{ color: C.green, fontVariantNumeric: "tabular-nums" }}>
                  {res ? `ARS ${formatARS(res.netoVendedorARS)}` : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Barras SVG */}
        <div style={stBarraContenedor}>
          <div style={{ fontSize: "0.78rem", color: C.muted, marginBottom: 12 }}>
            Impuesto por escenario
          </div>
          {escenarios.map((e, i) => {
            const imp = e.resultado?.impuestoARS ?? 0;
            const pct = maxImpuesto > 0 ? (imp / maxImpuesto) * 100 : 0;
            return (
              <div key={i} style={stBarraFila}>
                <div style={stBarraLabel}>{etiquetas[i]}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg
                    width="100%"
                    height="20"
                    style={{ flex: 1, display: "block" }}
                    viewBox="0 0 200 20"
                    preserveAspectRatio="none"
                  >
                    <rect x="0" y="4" width="200" height="12" rx="4" fill={C.border} />
                    <rect
                      x="0"
                      y="4"
                      width={Math.max(2, pct * 2)}
                      height="12"
                      rx="4"
                      fill={i === 1 ? C.red : "#883300"}
                    />
                  </svg>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: C.text,
                      minWidth: 90,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ARS {formatARS(imp)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Tab Guía ──────────────────────────────────────────────────────────────────

function TabGuia() {
  const items: { titulo: string; contenido: React.ReactNode }[] = [
    {
      titulo: "¿Cuándo aplica ITI vs. Ganancias?",
      contenido: (
        <>
          <p style={{ margin: "0 0 8px" }}>
            El régimen depende de la fecha de adquisición del inmueble:
          </p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>
              <strong style={{ color: C.text }}>Antes del 01/01/2018:</strong> aplica el
              Impuesto a la Transferencia de Inmuebles (ITI) a tasa fija del 1,5% sobre
              el precio de venta. No se calcula ganancia.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong style={{ color: C.text }}>Desde el 01/01/2018 (Ley 27.430):</strong>{" "}
              aplica Impuesto a las Ganancias cedular al 15% sobre la ganancia neta para
              personas físicas, o 35% para empresas.
            </li>
          </ul>
        </>
      ),
    },
    {
      titulo: "Exención casa-habitación",
      contenido: (
        <>
          <p style={{ margin: "0 0 8px" }}>
            La ganancia está exenta cuando se cumplen simultáneamente:
          </p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>El vendedor es persona física (no empresa).</li>
            <li>
              Es la <strong style={{ color: C.text }}>única propiedad</strong> del vendedor.
            </li>
            <li>
              El vendedor{" "}
              <strong style={{ color: C.text }}>habita</strong> el inmueble a vender.
            </li>
          </ul>
          <p style={{ margin: "8px 0 0" }}>
            En ese caso, la operación está exenta de Ganancias y de ITI.
          </p>
        </>
      ),
    },
    {
      titulo: "¿Cómo se actualiza el costo?",
      contenido: (
        <>
          <p style={{ margin: "0 0 8px" }}>
            El costo de adquisición se actualiza por el índice RIPTE o IPC desde la fecha
            de compra hasta la venta. En esta calculadora se estima con la tasa de inflación
            anual ingresada (por defecto 100%).
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: C.text }}>Fórmula:</strong>{" "}
            Costo actualizado = Costo original × (1 + inflación anual)^años
          </p>
          <p style={{ margin: 0 }}>
            Ganancia neta = Precio de venta − Costo actualizado − Mejoras actualizadas.
          </p>
        </>
      ),
    },
    {
      titulo: "Empresas vs. personas físicas",
      contenido: (
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            <strong style={{ color: C.text }}>Persona física residente:</strong> régimen
            cedular al 15% (adquisición post-2018). Puede aplicar exención casa-habitación.
          </li>
          <li style={{ marginTop: 6 }}>
            <strong style={{ color: C.text }}>Empresa / persona jurídica:</strong> tributa
            35% sobre la ganancia neta en el balance impositivo. No aplica exención.
          </li>
          <li style={{ marginTop: 6 }}>
            <strong style={{ color: C.text }}>Adquisición pre-2018 (cualquier tipo):</strong>{" "}
            ITI 1.5% sobre precio de venta.
          </li>
        </ul>
      ),
    },
  ];

  return (
    <>
      {items.map((item, i) => (
        <div key={i} style={stGuiaCard}>
          <div style={stGuiaTitulo}>{item.titulo}</div>
          <div style={stGuiaTexto}>{item.contenido}</div>
        </div>
      ))}
      <div style={stNotaLegal}>
        Esta calculadora es orientativa y no constituye asesoramiento fiscal. Los resultados
        son estimaciones basadas en los datos ingresados. Consultá a un contador público
        matriculado antes de tomar decisiones impositivas.
      </div>
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const INPUTS_INICIALES: Inputs = {
  tipoVendedor:     "fisica",
  fechaAdquisicion: "",
  precioCompra:     "",
  monedaCompra:     "USD",
  precioVenta:      "",
  monedaVenta:      "USD",
  mejoras:          "",
  monedaMejoras:    "USD",
  tipoBien:         "casa-habitacion",
  unicaPropiedad:   false,
  esHabitante:      false,
  inflacionAnual:   "100",
  tipoCambio:       "1200",
};

export default function CalculadoraImpuestoGanancias() {
  const [tab, setTab] = useState<TabId>("datos");
  const [inputs, setInputs] = useState<Inputs>(INPUTS_INICIALES);

  function onChange<K extends keyof Inputs>(k: K, v: Inputs[K]) {
    setInputs((prev) => ({ ...prev, [k]: v }));
  }

  const resultado = useMemo(() => calcular(inputs), [inputs]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "datos",      label: "Datos de la operación" },
    { id: "comparador", label: "Comparador de escenarios" },
    { id: "guia",       label: "Guía y referencias" },
  ];

  return (
    <div style={stPage}>
      <div style={stHeader}>
        <h1 style={stTitulo}>Impuesto a las Ganancias en Ventas Inmobiliarias</h1>
        <p style={stSubtitulo}>
          ITI y Ganancias cedular — Normativa Argentina (Ley 27.430)
        </p>
      </div>

      <div style={stTabsRow}>
        {tabs.map((t) => (
          <button key={t.id} style={tabBtnStyle(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={stBody}>
        {tab === "datos" && (
          <TabDatos inputs={inputs} onChange={onChange} resultado={resultado} />
        )}
        {tab === "comparador" && <TabComparador inputs={inputs} />}
        {tab === "guia" && <TabGuia />}
      </div>
    </div>
  );
}
