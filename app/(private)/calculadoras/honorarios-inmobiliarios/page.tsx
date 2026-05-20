"use client";

import { useState, useMemo } from "react";

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

function fmtUSD(n: number): string {
  return "USD " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return n.toFixed(2).replace(".", ",") + "%";
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "venta" | "alquiler" | "escenarios";
type CondTrib = "monotributo" | "ri";
type RolOp = "captador" | "vendedor" | "ambos";
type ComisionMode = "total" | "separado";
type QuienPaga = "propietario" | "inquilino" | "50-50" | "custom";

// ─── Styles ──────────────────────────────────────────────────────────────────

const C = {
  bg: "#0a0a0a",
  red: "#cc0000",
  text: "#e0e0e0",
  card: "#111111",
  border: "#222222",
  muted: "#888888",
  green: "#22c55e",
  yellow: "#eab308",
};

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: `1px solid ${C.border}`,
  color: C.text,
  padding: "8px 12px",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "Inter, sans-serif",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.muted,
  fontFamily: "Inter, sans-serif",
  marginBottom: 4,
  display: "block",
};

const cardStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "16px 20px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  fontSize: 14,
  color: C.red,
  marginBottom: 14,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

// ─── Field component ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  usd?: number | null;
  ars: number;
  accent?: boolean;
}

function SummaryCard({ label, usd, ars, accent }: SummaryCardProps) {
  return (
    <div
      style={{
        ...cardStyle,
        borderColor: accent ? C.red : C.border,
        flex: "1 1 200px",
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 11, color: C.muted, fontFamily: "Inter, sans-serif", marginBottom: 6 }}>{label}</div>
      {usd != null && (
        <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: C.text }}>
          {fmtUSD(usd)}
        </div>
      )}
      <div
        style={{
          fontSize: usd != null ? 13 : 20,
          fontFamily: usd != null ? "Inter, sans-serif" : "Montserrat, sans-serif",
          fontWeight: usd != null ? 400 : 800,
          color: accent ? C.red : C.text,
          marginTop: usd != null ? 2 : 0,
        }}
      >
        {fmtARS(ars)}
      </div>
    </div>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, color: C.text }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: C.red, width: 15, height: 15 }}
      />
      {label}
    </label>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

function Sel<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Number input ─────────────────────────────────────────────────────────────

function NumInput({
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {prefix && <span style={{ fontSize: 13, color: C.muted, fontFamily: "Inter, sans-serif" }}>{prefix}</span>}
      <input
        type="number"
        style={{ ...inputStyle, flex: 1 }}
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      {suffix && <span style={{ fontSize: 13, color: C.muted, fontFamily: "Inter, sans-serif" }}>{suffix}</span>}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({ label, value, sub, bold }: { label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "8px 0",
        borderBottom: `1px solid ${C.border}`,
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: C.muted, fontFamily: "Inter, sans-serif" }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 14, color: C.text, fontFamily: "Inter, sans-serif", fontWeight: bold ? 700 : 400 }}>
          {value}
        </span>
        {sub && (
          <div style={{ fontSize: 11, color: C.muted, fontFamily: "Inter, sans-serif" }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — VENTA
// ═══════════════════════════════════════════════════════════════════════════════

function TabVenta() {
  const [valorUSD, setValorUSD] = useState(150000);
  const [tc, setTc] = useState(1150);
  const [compartida, setCompartida] = useState(false);
  const [rol, setRol] = useState<RolOp>("ambos");
  const [comisionMode, setComisionMode] = useState<ComisionMode>("total");
  const [comisionTotal, setComisionTotal] = useState(6);
  const [comVendedor, setComVendedor] = useState(3);
  const [comComprador, setComComprador] = useState(3);
  const [condTrib, setCondTrib] = useState<CondTrib>("monotributo");
  const [cobroking, setCobroking] = useState(false);
  const [cobrokingPct, setCobrokingPct] = useState(50);

  const calc = useMemo(() => {
    const propUSD = valorUSD;
    const propARS = propUSD * tc;

    // Comisiones base
    let pctVend = comisionMode === "total" ? comisionTotal / 2 : comVendedor;
    let pctComp = comisionMode === "total" ? comisionTotal / 2 : comComprador;

    // Si operación compartida, ajustar según rol
    let miComVendedorPct = pctVend;
    let miComCompradorPct = pctComp;
    if (compartida) {
      if (rol === "captador") { miComVendedorPct = pctVend; miComCompradorPct = 0; }
      else if (rol === "vendedor") { miComVendedorPct = 0; miComCompradorPct = pctComp; }
      // ambos → no cambia
    }

    const comBrutaVendUSD = propUSD * (miComVendedorPct / 100);
    const comBrutaCompUSD = propUSD * (miComCompradorPct / 100);
    const comBrutaTotalUSD = comBrutaVendUSD + comBrutaCompUSD;
    const comBrutaTotalARS = comBrutaTotalUSD * tc;

    // IVA
    const ivaFactor = condTrib === "ri" ? 0.21 : 0;
    const ivaUSD = comBrutaTotalUSD * ivaFactor;
    const ivaARS = ivaUSD * tc;
    const comConIvaUSD = comBrutaTotalUSD + ivaUSD;
    const comConIvaARS = comConIvaUSD * tc;

    // Co-broking
    const cobrokingFactor = cobroking ? cobrokingPct / 100 : 0;
    const alOtroCorrUSD = comBrutaTotalUSD * cobrokingFactor;
    const alOtroCorrARS = alOtroCorrUSD * tc;
    const miParteNetaCobUSD = comBrutaTotalUSD * (1 - cobrokingFactor);
    const miParteNetaCobARS = miParteNetaCobUSD * tc;

    // Neto impositivo estimado
    // RI: descuenta IVA propio (21% sobre base), asumiendo no paga más
    // Monotributo: no hay descuento adicional (ya está en cuota fija)
    const costoImpUSD = condTrib === "ri" ? ivaUSD * (1 - cobrokingFactor) : 0;
    const costoImpARS = costoImpUSD * tc;
    const ingresoNetoUSD = miParteNetaCobUSD - costoImpUSD;
    const ingresoNetoARS = ingresoNetoUSD * tc;

    return {
      propARS,
      comBrutaTotalUSD,
      comBrutaTotalARS,
      ivaUSD,
      ivaARS,
      comConIvaUSD,
      comConIvaARS,
      alOtroCorrUSD,
      alOtroCorrARS,
      miParteNetaCobUSD,
      miParteNetaCobARS,
      costoImpUSD,
      costoImpARS,
      ingresoNetoUSD,
      ingresoNetoARS,
    };
  }, [
    valorUSD, tc, compartida, rol, comisionMode, comisionTotal,
    comVendedor, comComprador, condTrib, cobroking, cobrokingPct,
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {/* Propiedad */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Propiedad</div>
          <Field label="Valor de la propiedad (USD)">
            <NumInput value={valorUSD} onChange={setValorUSD} min={0} step={1000} prefix="USD" />
          </Field>
          <Field label="Tipo de cambio (ARS/USD)">
            <NumInput value={tc} onChange={setTc} min={1} step={10} prefix="$" />
          </Field>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif" }}>
            Valor en ARS: {fmtARS(calc.propARS)}
          </div>
        </div>

        {/* Honorarios */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Honorarios</div>
          <Field label="Modo de honorarios">
            <Sel<ComisionMode>
              value={comisionMode}
              onChange={setComisionMode}
              options={[
                { value: "total", label: "Total dividido en dos (ej. 6% = 3%+3%)" },
                { value: "separado", label: "Vendedor y comprador por separado" },
              ]}
            />
          </Field>
          {comisionMode === "total" ? (
            <Field label={`Honorarios totales (${fmtPct(comisionTotal)}, ${fmtPct(comisionTotal / 2)} c/parte)`}>
              <NumInput value={comisionTotal} onChange={setComisionTotal} min={0} max={20} step={0.5} suffix="%" />
            </Field>
          ) : (
            <>
              <Field label={`Honorarios al vendedor (${fmtPct(comVendedor)})`}>
                <NumInput value={comVendedor} onChange={setComVendedor} min={0} max={20} step={0.5} suffix="%" />
              </Field>
              <Field label={`Honorarios al comprador (${fmtPct(comComprador)})`}>
                <NumInput value={comComprador} onChange={setComComprador} min={0} max={20} step={0.5} suffix="%" />
              </Field>
            </>
          )}
        </div>

        {/* Operación y tributación */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Operación y tributación</div>
          <Field label="Condición tributaria">
            <Sel<CondTrib>
              value={condTrib}
              onChange={setCondTrib}
              options={[
                { value: "monotributo", label: "Monotributo" },
                { value: "ri", label: "Responsable Inscripto (IVA 21%)" },
              ]}
            />
          </Field>
          <div style={{ marginBottom: 14 }}>
            <Check checked={compartida} onChange={setCompartida} label="¿Operación compartida?" />
          </div>
          {compartida && (
            <Field label="Tu rol en la operación">
              <Sel<RolOp>
                value={rol}
                onChange={setRol}
                options={[
                  { value: "captador", label: "Captador (lado vendedor)" },
                  { value: "vendedor", label: "Vendedor (lado comprador)" },
                  { value: "ambos", label: "Ambos lados" },
                ]}
              />
            </Field>
          )}
          <div style={{ marginBottom: 10 }}>
            <Check checked={cobroking} onChange={setCobroking} label="¿Está en co-broking?" />
          </div>
          {cobroking && (
            <Field label={`% de los honorarios que van al otro corredor (${fmtPct(cobrokingPct)})`}>
              <NumInput value={cobrokingPct} onChange={setCobrokingPct} min={0} max={99} step={5} suffix="%" />
            </Field>
          )}
        </div>

      </div>

      {/* Desglose */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Desglose del cálculo</div>
        <Row label="Honorarios brutos totales" value={fmtUSD(calc.comBrutaTotalUSD)} sub={fmtARS(calc.comBrutaTotalARS)} />
        {condTrib === "ri" && (
          <Row label="IVA (21%)" value={fmtUSD(calc.ivaUSD)} sub={fmtARS(calc.ivaARS)} />
        )}
        <Row
          label={condTrib === "ri" ? "Honorarios con IVA (lo que cobra el cliente)" : "Honorarios (sin IVA — Monotributo)"}
          value={fmtUSD(calc.comConIvaUSD)}
          sub={fmtARS(calc.comConIvaARS)}
          bold
        />
        {cobroking && (
          <>
            <Row label={`Al otro corredor (${fmtPct(cobrokingPct)})`} value={fmtUSD(calc.alOtroCorrUSD)} sub={fmtARS(calc.alOtroCorrARS)} />
            <Row label="Tu parte después de co-broking" value={fmtUSD(calc.miParteNetaCobUSD)} sub={fmtARS(calc.miParteNetaCobARS)} bold />
          </>
        )}
        <Row label="Costo impositivo estimado" value={fmtUSD(calc.costoImpUSD)} sub={fmtARS(calc.costoImpARS)} />
        <Row label="Ingreso neto estimado" value={fmtUSD(calc.ingresoNetoUSD)} sub={fmtARS(calc.ingresoNetoARS)} bold />
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <SummaryCard label="Cobrás al cliente" usd={calc.comConIvaUSD} ars={calc.comConIvaARS} accent />
        <SummaryCard label="Tu parte neta" usd={calc.miParteNetaCobUSD} ars={calc.miParteNetaCobARS} />
        <SummaryCard label="Costo impositivo estimado" ars={calc.costoImpARS} />
        <SummaryCard label="Ingreso neto estimado" usd={calc.ingresoNetoUSD} ars={calc.ingresoNetoARS} />
      </div>

      {condTrib === "ri" && (
        <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", paddingTop: 4 }}>
          * Costo impositivo estimado: IVA débito fiscal (21% sobre base). No incluye IIBB, Ganancias u otros impuestos.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — ALQUILER
// ═══════════════════════════════════════════════════════════════════════════════

function TabAlquiler() {
  const [alquilerMensual, setAlquilerMensual] = useState(200000);
  const [mesesComision, setMesesComision] = useState(1);
  const [quienPaga, setQuienPaga] = useState<QuienPaga>("inquilino");
  const [customPctPropietario, setCustomPctPropietario] = useState(50);
  const [condTrib, setCondTrib] = useState<CondTrib>("monotributo");
  const [cobroking, setCobroking] = useState(false);
  const [cobrokingPct, setCobrokingPct] = useState(50);
  const [tc, setTc] = useState(1150);

  const calc = useMemo(() => {
    const comBrutaARS = alquilerMensual * mesesComision;

    // Distribución por quién paga
    let pctPropietario = 0;
    let pctInquilino = 0;
    if (quienPaga === "propietario") { pctPropietario = 100; pctInquilino = 0; }
    else if (quienPaga === "inquilino") { pctPropietario = 0; pctInquilino = 100; }
    else if (quienPaga === "50-50") { pctPropietario = 50; pctInquilino = 50; }
    else { pctPropietario = customPctPropietario; pctInquilino = 100 - customPctPropietario; }

    const comPropietarioARS = comBrutaARS * (pctPropietario / 100);
    const comInquilinoARS = comBrutaARS * (pctInquilino / 100);

    // IVA
    const ivaFactor = condTrib === "ri" ? 0.21 : 0;
    const ivaARS = comBrutaARS * ivaFactor;
    const comConIvaARS = comBrutaARS + ivaARS;

    // Co-broking
    const cobrokingFactor = cobroking ? cobrokingPct / 100 : 0;
    const alOtroCorrARS = comBrutaARS * cobrokingFactor;
    const miParteARS = comBrutaARS * (1 - cobrokingFactor);
    const miParteConIvaARS = miParteARS * (1 + ivaFactor);

    // Neto
    const costoImpARS = condTrib === "ri" ? ivaARS * (1 - cobrokingFactor) : 0;
    const ingresoNetoARS = miParteARS - costoImpARS;

    // En USD
    const comBrutaUSD = comBrutaARS / tc;
    const ingresoNetoUSD = ingresoNetoARS / tc;
    const comConIvaUSD = comConIvaARS / tc;

    return {
      comBrutaARS,
      comBrutaUSD,
      comPropietarioARS,
      comInquilinoARS,
      ivaARS,
      comConIvaARS,
      comConIvaUSD,
      alOtroCorrARS,
      miParteARS,
      miParteConIvaARS,
      costoImpARS,
      ingresoNetoARS,
      ingresoNetoUSD,
    };
  }, [alquilerMensual, mesesComision, quienPaga, customPctPropietario, condTrib, cobroking, cobrokingPct, tc]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {/* Alquiler */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Alquiler</div>
          <Field label="Alquiler mensual (ARS)">
            <NumInput value={alquilerMensual} onChange={setAlquilerMensual} min={0} step={10000} prefix="$" />
          </Field>
          <Field label={`Meses de honorarios (${mesesComision})`}>
            <NumInput value={mesesComision} onChange={setMesesComision} min={0.5} max={2} step={0.5} suffix="mes/es" />
          </Field>
          <Field label="Tipo de cambio (ARS/USD)">
            <NumInput value={tc} onChange={setTc} min={1} step={10} prefix="$" />
          </Field>
        </div>

        {/* Distribución */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>¿Quién paga los honorarios?</div>
          <Field label="Distribución">
            <Sel<QuienPaga>
              value={quienPaga}
              onChange={setQuienPaga}
              options={[
                { value: "propietario", label: "Propietario (100%)" },
                { value: "inquilino", label: "Inquilino (100%)" },
                { value: "50-50", label: "50% propietario / 50% inquilino" },
                { value: "custom", label: "Personalizado" },
              ]}
            />
          </Field>
          {quienPaga === "custom" && (
            <Field label={`Propietario paga ${fmtPct(customPctPropietario)}, inquilino ${fmtPct(100 - customPctPropietario)}`}>
              <NumInput value={customPctPropietario} onChange={setCustomPctPropietario} min={0} max={100} step={5} suffix="% propietario" />
            </Field>
          )}
          {quienPaga !== "propietario" && (
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", marginTop: 6 }}>
              Propietario paga: {fmtARS(calc.comPropietarioARS)} — Inquilino paga: {fmtARS(calc.comInquilinoARS)}
            </div>
          )}
        </div>

        {/* Tributación y co-broking */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Tributación y co-broking</div>
          <Field label="Condición tributaria">
            <Sel<CondTrib>
              value={condTrib}
              onChange={setCondTrib}
              options={[
                { value: "monotributo", label: "Monotributo" },
                { value: "ri", label: "Responsable Inscripto (IVA 21%)" },
              ]}
            />
          </Field>
          <div style={{ marginBottom: 10 }}>
            <Check checked={cobroking} onChange={setCobroking} label="¿Co-broking?" />
          </div>
          {cobroking && (
            <Field label={`% al otro corredor (${fmtPct(cobrokingPct)})`}>
              <NumInput value={cobrokingPct} onChange={setCobrokingPct} min={0} max={99} step={5} suffix="%" />
            </Field>
          )}
        </div>
      </div>

      {/* Desglose */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Desglose</div>
        <Row label="Honorarios brutos" value={fmtARS(calc.comBrutaARS)} sub={fmtUSD(calc.comBrutaUSD)} />
        {condTrib === "ri" && (
          <Row label="IVA (21%)" value={fmtARS(calc.ivaARS)} />
        )}
        <Row
          label={condTrib === "ri" ? "Total a cobrar al cliente (con IVA)" : "Total a cobrar al cliente"}
          value={fmtARS(calc.comConIvaARS)}
          sub={fmtUSD(calc.comConIvaUSD)}
          bold
        />
        {cobroking && (
          <>
            <Row label={`Al otro corredor (${fmtPct(cobrokingPct)})`} value={fmtARS(calc.alOtroCorrARS)} />
            <Row label="Tu parte neta (antes de IVA)" value={fmtARS(calc.miParteARS)} bold />
          </>
        )}
        <Row label="Costo impositivo estimado" value={fmtARS(calc.costoImpARS)} />
        <Row label="Ingreso neto estimado" value={fmtARS(calc.ingresoNetoARS)} sub={fmtUSD(calc.ingresoNetoUSD)} bold />
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <SummaryCard label="Cobrás al cliente" usd={calc.comConIvaUSD} ars={calc.comConIvaARS} accent />
        <SummaryCard label="Tu parte neta" ars={calc.miParteARS} />
        <SummaryCard label="Costo impositivo estimado" ars={calc.costoImpARS} />
        <SummaryCard label="Ingreso neto estimado" usd={calc.ingresoNetoUSD} ars={calc.ingresoNetoARS} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — ESCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

interface BarChartProps {
  bars: { label: string; value: number; isTarget: boolean }[];
  maxVal: number;
}

function BarChart({ bars, maxVal }: BarChartProps) {
  const W = 700;
  const H = 250;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 50;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const barW = (plotW / bars.length) * 0.6;
  const gap = plotW / bars.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, display: "block", overflow: "visible" }}
    >
      {/* Y gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + plotH * (1 - t);
        const val = Math.round(maxVal * t * 10) / 10;
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke={C.border} strokeWidth={1} />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill={C.muted}>
              {val}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {bars.map((bar, i) => {
        const x = padL + gap * i + (gap - barW) / 2;
        const barH = maxVal > 0 ? (bar.value / maxVal) * plotH : 0;
        const y = padT + plotH - barH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill={bar.isTarget ? C.red : "#333333"}
              rx={3}
            />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fill={C.text}>
              {bar.value.toFixed(1)}
            </text>
            <text x={x + barW / 2} y={padT + plotH + 16} textAnchor="middle" fontSize={11} fill={C.muted}>
              {bar.label}
            </text>
          </g>
        );
      })}

      {/* X axis */}
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={C.border} strokeWidth={1} />
      {/* Y axis */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={C.border} strokeWidth={1} />
    </svg>
  );
}

const PORTFOLIO_TIPOS = [
  { label: "Corredor junior", ventas: 2, color: "#555555" },
  { label: "Corredor senior", ventas: 5, color: "#888888" },
  { label: "Top producer", ventas: 10, color: C.red },
];

function TabEscenarios() {
  const [metaMensualARS, setMetaMensualARS] = useState(1500000);
  const [comisionPct, setComisionPct] = useState(3);
  const [precioPromUSD, setPrecioPromUSD] = useState(120000);
  const [tc, setTc] = useState(1150);
  const [condTrib, setCondTrib] = useState<CondTrib>("monotributo");

  const calc = useMemo(() => {
    const ivaFactor = condTrib === "ri" ? 0.21 : 0;
    // Ingreso neto por operación: comisión bruta ARS * (1 - ivaFactor)
    const comBrutaPorOpARS = precioPromUSD * tc * (comisionPct / 100);
    const netoPorOpARS = comBrutaPorOpARS * (1 - ivaFactor);
    const netoPorOpUSD = netoPorOpARS / tc;

    const opsMeta = netoPorOpARS > 0 ? metaMensualARS / netoPorOpARS : 0;
    const montoTotalUSD = opsMeta * precioPromUSD;

    // Escenarios de la meta
    const mults = [0.5, 0.75, 1, 1.25, 1.5];
    const escenarios = mults.map((m) => ({
      label: `${Math.round(m * 100)}%`,
      meta: metaMensualARS * m,
      ops: netoPorOpARS > 0 ? (metaMensualARS * m) / netoPorOpARS : 0,
      isTarget: m === 1,
    }));

    const maxOps = Math.max(...escenarios.map((e) => e.ops), 1);

    // Portfolio tipos
    const portfolioCards = PORTFOLIO_TIPOS.map((p) => ({
      ...p,
      ingresoMensualARS: p.ventas * netoPorOpARS,
      ingresoMensualUSD: p.ventas * netoPorOpUSD,
    }));

    return { opsMeta, montoTotalUSD, escenarios, maxOps, portfolioCards, netoPorOpARS, netoPorOpUSD };
  }, [metaMensualARS, comisionPct, precioPromUSD, tc, condTrib]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Tu meta</div>
          <Field label="Meta de ingresos mensuales (ARS)">
            <NumInput value={metaMensualARS} onChange={setMetaMensualARS} min={0} step={100000} prefix="$" />
          </Field>
          <Field label={`Honorarios promedio (${fmtPct(comisionPct)})`}>
            <NumInput value={comisionPct} onChange={setComisionPct} min={0.5} max={20} step={0.5} suffix="%" />
          </Field>
        </div>
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Mercado</div>
          <Field label="Precio promedio de propiedades (USD)">
            <NumInput value={precioPromUSD} onChange={setPrecioPromUSD} min={0} step={5000} prefix="USD" />
          </Field>
          <Field label="Tipo de cambio (ARS/USD)">
            <NumInput value={tc} onChange={setTc} min={1} step={10} prefix="$" />
          </Field>
          <Field label="Condición tributaria">
            <Sel<CondTrib>
              value={condTrib}
              onChange={setCondTrib}
              options={[
                { value: "monotributo", label: "Monotributo" },
                { value: "ri", label: "Responsable Inscripto" },
              ]}
            />
          </Field>
        </div>
      </div>

      {/* Resultado principal */}
      <div
        style={{
          ...cardStyle,
          borderColor: C.red,
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
            Para ganar {fmtARS(metaMensualARS)}/mes necesitás
          </div>
          <div style={{ fontSize: 40, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: C.red }}>
            {calc.opsMeta.toFixed(1)}
          </div>
          <div style={{ fontSize: 14, color: C.text, fontFamily: "Inter, sans-serif" }}>
            operaciones de venta por mes
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
            Monto total a cerrar
          </div>
          <div style={{ fontSize: 28, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: C.text }}>
            {fmtUSD(calc.montoTotalUSD)}
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", marginTop: 2 }}>
            {fmtARS(calc.montoTotalUSD * tc)} en propiedades/mes
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
            Neto por operación
          </div>
          <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: C.text }}>
            {fmtARS(calc.netoPorOpARS)}
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", marginTop: 2 }}>
            {fmtUSD(calc.netoPorOpUSD)}
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Operaciones necesarias según % de la meta</div>
        <BarChart
          bars={calc.escenarios.map((e) => ({ label: e.label, value: parseFloat(e.ops.toFixed(2)), isTarget: e.isTarget }))}
          maxVal={calc.maxOps * 1.1}
        />
        <div style={{ fontSize: 11, color: C.muted, fontFamily: "Inter, sans-serif", marginTop: 8, textAlign: "center" }}>
          Operaciones por mes para cada nivel de meta
        </div>
      </div>

      {/* Tabla */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Tabla de escenarios</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Nivel", "Meta ARS", "Operaciones necesarias", "Monto total USD"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: 600, fontSize: 12 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calc.escenarios.map((e, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    background: e.isTarget ? "#1a0000" : "transparent",
                  }}
                >
                  <td style={{ padding: "8px 12px", color: e.isTarget ? C.red : C.text, fontWeight: e.isTarget ? 700 : 400 }}>
                    {e.label} {e.isTarget ? "(meta)" : ""}
                  </td>
                  <td style={{ padding: "8px 12px", color: C.text }}>{fmtARS(e.meta)}</td>
                  <td style={{ padding: "8px 12px", color: e.isTarget ? C.red : C.text, fontWeight: e.isTarget ? 700 : 400 }}>
                    {e.ops.toFixed(1)}
                  </td>
                  <td style={{ padding: "8px 12px", color: C.text }}>{fmtUSD(e.ops * precioPromUSD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portfolio cards */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Escenarios de portfolio típico</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {calc.portfolioCards.map((p) => (
            <div
              key={p.label}
              style={{
                ...cardStyle,
                flex: "1 1 200px",
                minWidth: 180,
                borderColor: p.color,
              }}
            >
              <div style={{ fontSize: 11, color: p.color, fontFamily: "Inter, sans-serif", marginBottom: 4, fontWeight: 600 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: C.text }}>
                {p.ventas} ventas/mes
              </div>
              <div style={{ fontSize: 16, color: C.text, fontFamily: "Inter, sans-serif", marginTop: 6 }}>
                {fmtARS(p.ingresoMensualARS)}/mes
              </div>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                {fmtUSD(p.ingresoMensualUSD)}/mes
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function HonorariosInmobiliariosPage() {
  const [activeTab, setActiveTab] = useState<Tab>("venta");

  const tabs: { id: Tab; label: string }[] = [
    { id: "venta", label: "Operación de venta" },
    { id: "alquiler", label: "Alquiler" },
    { id: "escenarios", label: "Calculadora de escenarios" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        padding: "24px 16px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: "clamp(22px, 4vw, 32px)",
              color: C.text,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Calculadora de{" "}
            <span style={{ color: C.red }}>Honorarios Inmobiliarios</span>
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
            Calculá tus honorarios profesionales, desglose impositivo y metas de producción
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            borderBottom: `1px solid ${C.border}`,
            overflowX: "auto",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === t.id ? `2px solid ${C.red}` : "2px solid transparent",
                color: activeTab === t.id ? C.text : C.muted,
                padding: "10px 16px",
                fontSize: 13,
                fontFamily: "Inter, sans-serif",
                fontWeight: activeTab === t.id ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "venta" && <TabVenta />}
        {activeTab === "alquiler" && <TabAlquiler />}
        {activeTab === "escenarios" && <TabEscenarios />}
      </div>
    </div>
  );
}
