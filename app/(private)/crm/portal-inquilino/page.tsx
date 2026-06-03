"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Contrato {
  id: string;
  inquilino_nombre: string;
  inquilino_telefono: string;
  propietario_nombre: string;
  direccion: string;
  barrio: string;
  fecha_inicio: string;
  fecha_fin: string;
  alquiler_actual: number;
  moneda: "ARS" | "USD";
  estado: string;
  notas: string;
  created_at: string;
}

interface ReciboForm {
  periodo: string;
  monto: number;
  moneda: string;
  concepto: string;
  notas: string;
}

// ── Demo data ──────────────────────────────────────────────────────────────

const CONTRATOS_DEMO: Contrato[] = [
  {
    id: "demo-1",
    inquilino_nombre: "Martínez, Juan Pablo",
    inquilino_telefono: "1145678901",
    propietario_nombre: "Rodríguez, Ana",
    direccion: "Av. Corrientes 2450 3°B",
    barrio: "Balvanera",
    fecha_inicio: "2024-04-01",
    fecha_fin: "2026-04-01",
    alquiler_actual: 420000,
    moneda: "ARS",
    estado: "vigente",
    notas: "Buen pagador, paga siempre antes del día 5.",
    created_at: "2024-04-01T10:00:00Z",
  },
  {
    id: "demo-2",
    inquilino_nombre: "García, Sofía",
    inquilino_telefono: "1167890123",
    propietario_nombre: "López, Carlos",
    direccion: "Gurruchaga 780 PB A",
    barrio: "Palermo Soho",
    fecha_inicio: "2024-06-15",
    fecha_fin: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    alquiler_actual: 1200,
    moneda: "USD",
    estado: "por_vencer",
    notas: "En negociación para renovar.",
    created_at: "2024-06-15T09:00:00Z",
  },
  {
    id: "demo-3",
    inquilino_nombre: "Fernández, Diego",
    inquilino_telefono: "1189012345",
    propietario_nombre: "Sánchez, María",
    direccion: "Cuba 2100 PB B",
    barrio: "Belgrano",
    fecha_inicio: "2023-02-01",
    fecha_fin: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
    alquiler_actual: 380000,
    moneda: "ARS",
    estado: "vencido",
    notas: "Pendiente renovación formal.",
    created_at: "2023-02-01T11:00:00Z",
  },
  {
    id: "demo-4",
    inquilino_nombre: "Alvarez, Lucía",
    inquilino_telefono: "1112345678",
    propietario_nombre: "Torres, Norberto",
    direccion: "Av. Santa Fe 3200 7°D",
    barrio: "Palermo",
    fecha_inicio: "2025-01-01",
    fecha_fin: new Date(Date.now() + 50 * 86400000).toISOString().slice(0, 10),
    alquiler_actual: 650000,
    moneda: "ARS",
    estado: "vigente",
    notas: "",
    created_at: "2025-01-01T08:00:00Z",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasRestantes(fechaFin: string): number {
  return Math.round((new Date(fechaFin).getTime() - new Date(hoy()).getTime()) / 86400000);
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${MESES[parseInt(m) - 1]} ${y}`;
}

function fmt(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function periodoActual(): string {
  const now = new Date();
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${MESES[now.getMonth()]} ${now.getFullYear()}`;
}

function badgeVencimiento(dias: number): { color: string; bg: string; border: string; label: string } {
  if (dias < 0) return { color: "#b80000", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: `Vencido hace ${Math.abs(dias)} días` };
  if (dias < 30) return { color: "#b80000", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", label: `${dias} días` };
  if (dias < 90) return { color: "#d4960c", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: `${dias} días` };
  return { color: "#3abab6", bg: "rgba(58,186,182,0.1)", border: "rgba(58,186,182,0.25)", label: `${dias} días` };
}

// ── Estilos compartidos ────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--gfi-border-subtle)",
    border: "1px solid var(--gfi-border)",
    borderRadius: 12,
    padding: "16px 20px",
  } as React.CSSProperties,

  btn: {
    background: "#990000",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "7px 16px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,

  btnOutline: {
    background: "transparent",
    color: "var(--gfi-text-secondary)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,

  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--gfi-border)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    padding: "8px 12px",
    fontFamily: "Inter, sans-serif",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  label: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    display: "block",
    marginBottom: 4,
  } as React.CSSProperties,
};

// ── Modal Recibo ───────────────────────────────────────────────────────────

function ModalRecibo({
  contrato,
  onClose,
}: {
  contrato: Contrato;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ReciboForm>({
    periodo: periodoActual(),
    monto: contrato.alquiler_actual,
    moneda: contrato.moneda,
    concepto: "Alquiler mensual",
    notas: "",
  });
  const [generado, setGenerado] = useState(false);

  function handleGenerar(e: React.FormEvent) {
    e.preventDefault();
    setGenerado(true);
  }

  if (generado) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <div style={{
          background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)",
          borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 480,
          fontFamily: "Inter, sans-serif",
        }}>
          {/* Recibo visual */}
          <div style={{ borderBottom: "2px solid #990000", paddingBottom: 12, marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#fff" }}>
              RECIBO DE ALQUILER
            </div>
            <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 2 }}>
              Período: {form.periodo}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {[
              ["Inquilino", contrato.inquilino_nombre],
              ["Propiedad", `${contrato.direccion}, ${contrato.barrio}`],
              ["Concepto", form.concepto],
              ["Importe", `${form.moneda === "USD" ? "USD " : "$ "}${fmt(form.monto)}`],
              ["Fecha emisión", fmtFecha(hoy())],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>{k}</span>
                <span style={{ fontSize: 13, color: "#fff", fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
            {form.notas && (
              <div style={{ fontSize: 12, color: "var(--gfi-text-secondary)", fontStyle: "italic", marginTop: 4 }}>
                {form.notas}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button style={s.btnOutline} onClick={() => window.print()}>Imprimir</button>
            <button style={s.btn} onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)",
        borderRadius: 16, padding: "24px 28px", width: "100%", maxWidth: 480,
        fontFamily: "Inter, sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#fff" }}>
            Generar recibo
          </div>
          <button style={s.btnOutline} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--gfi-text-muted)", marginBottom: 16 }}>
          {contrato.inquilino_nombre} — {contrato.direccion}
        </div>

        <form onSubmit={handleGenerar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={s.label}>Período</label>
              <input style={s.input} value={form.periodo}
                onChange={e => setForm(p => ({ ...p, periodo: e.target.value }))} required />
            </div>
            <div>
              <label style={s.label}>Moneda</label>
              <select style={s.input} value={form.moneda}
                onChange={e => setForm(p => ({ ...p, moneda: e.target.value }))}>
                <option value="ARS">ARS $</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={s.label}>Importe</label>
              <input style={s.input} type="number" value={form.monto || ""}
                onChange={e => setForm(p => ({ ...p, monto: parseFloat(e.target.value) || 0 }))} required />
            </div>
            <div>
              <label style={s.label}>Concepto</label>
              <input style={s.input} value={form.concepto}
                onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={s.label}>Notas (opcional)</label>
            <textarea style={{ ...s.input, minHeight: 52, resize: "vertical" }}
              value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              placeholder="Ej: Pago anticipado, incluye expensas..." />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" style={s.btnOutline} onClick={onClose}>Cancelar</button>
            <button type="submit" style={s.btn}>Generar recibo</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Historial ────────────────────────────────────────────────────────

function ModalHistorial({
  contrato,
  onClose,
}: {
  contrato: Contrato;
  onClose: () => void;
}) {
  const [actividades, setActividades] = useState<{ tipo: string; nota: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("crm_actividad")
        .select("tipo, nota, created_at")
        .ilike("nota", `%${contrato.inquilino_nombre.split(",")[0]}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      setActividades(data ?? []);
      setLoading(false);
    }
    cargar();
  }, [contrato.inquilino_nombre]);

  const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  function fmtDt(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)",
        borderRadius: 16, padding: "24px 28px", width: "100%", maxWidth: 540,
        maxHeight: "80vh", overflowY: "auto", fontFamily: "Inter, sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#fff" }}>
            Historial — {contrato.inquilino_nombre}
          </div>
          <button style={s.btnOutline} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ color: "var(--gfi-text-muted)", fontSize: 13, padding: "20px 0" }}>Cargando...</div>
        ) : actividades.length === 0 ? (
          <div style={{ color: "var(--gfi-text-muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            Sin interacciones registradas en CRM
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actividades.map((a, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--gfi-border)",
                borderLeft: "3px solid rgba(153,0,0,0.5)",
                borderRadius: 8,
                padding: "10px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{a.tipo}</span>
                  <span style={{ fontSize: 10, color: "var(--gfi-text-muted)", flexShrink: 0 }}>{fmtDt(a.created_at)}</span>
                </div>
                {a.nota && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{a.nota}</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button style={s.btn} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function PortalInquilinoPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"activos" | "vencimientos">("activos");
  const [reciboContrato, setReciboContrato] = useState<Contrato | null>(null);
  const [historialContrato, setHistorialContrato] = useState<Contrato | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("crm_contratos")
        .select("*")
        .eq("perfil_id", user.id)
        .order("fecha_fin", { ascending: true });

      if (error || !data || data.length === 0) {
        setContratos(CONTRATOS_DEMO);
      } else {
        setContratos(data as Contrato[]);
      }
      setLoading(false);
    }
    cargar();
  }, []);

  const contratosConDias = useMemo(
    () => contratos.map(c => ({ ...c, diasRestantes: diasRestantes(c.fecha_fin) })),
    [contratos]
  );

  const activos = useMemo(
    () => contratosConDias.filter(c => c.diasRestantes > 0 || c.estado === "vigente"),
    [contratosConDias]
  );

  const porVencer = useMemo(
    () => contratosConDias.filter(c => c.diasRestantes >= 0 && c.diasRestantes <= 60)
      .sort((a, b) => a.diasRestantes - b.diasRestantes),
    [contratosConDias]
  );

  const vencidos = useMemo(
    () => contratosConDias.filter(c => c.diasRestantes < 0)
      .sort((a, b) => b.diasRestantes - a.diasRestantes),
    [contratosConDias]
  );

  const kpiTotal = activos.length;
  const kpiPorVencer = porVencer.length;
  const kpiVencidos = vencidos.length;

  function toggleExpand(id: string) {
    setExpandido(p => p === id ? null : id);
  }

  return (
    <>
      <style>{`
        .pi-card {
          background: var(--gfi-bg-secondary, #111);
          border: 1px solid var(--gfi-border-subtle, #222);
          border-radius: 12px;
          transition: border-color 0.15s;
        }
        .pi-card:hover { border-color: var(--gfi-border, #333); }
        .pi-tab-btn {
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: Inter, sans-serif;
          transition: all 0.15s;
        }
        .pi-action-btn {
          padding: 6px 14px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          font-family: Inter, sans-serif;
          border: none;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .pi-action-btn:hover { opacity: 0.8; }
      `}</style>

      <div style={{ maxWidth: 900, fontFamily: "Inter, sans-serif", color: "#fff" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>
              Portal del Inquilino
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--gfi-text-muted)" }}>
              Estado de tus inquilinos activos — contratos, vencimientos y acciones rápidas
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ ...s.card, flex: 1, minWidth: 140 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#fff" }}>{kpiTotal}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              Contratos activos
            </div>
          </div>
          <div style={{ ...s.card, flex: 1, minWidth: 140, borderColor: kpiPorVencer > 0 ? "rgba(245,158,11,0.35)" : "var(--gfi-border)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: kpiPorVencer > 0 ? "#d4960c" : "#fff" }}>
              {kpiPorVencer}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              Por vencer (60 días)
            </div>
          </div>
          <div style={{ ...s.card, flex: 1, minWidth: 140, borderColor: kpiVencidos > 0 ? "rgba(239,68,68,0.35)" : "var(--gfi-border)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: kpiVencidos > 0 ? "#b80000" : "#fff" }}>
              {kpiVencidos}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              Vencidos
            </div>
          </div>
        </div>

        {/* Alertas de vencimiento próximo */}
        {porVencer.filter(c => c.diasRestantes <= 30).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {porVencer.filter(c => c.diasRestantes <= 30).map(c => (
              <div key={`alerta-${c.id}`} style={{
                background: "rgba(153,0,0,0.08)",
                border: "1px solid rgba(153,0,0,0.35)",
                borderRadius: 10, padding: "10px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 16 }}>🔴</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                  <strong style={{ color: "#ff4444" }}>
                    Contrato vence en {c.diasRestantes} días
                  </strong>
                  {" — "}{c.inquilino_nombre}, {c.direccion}
                </span>
                <a
                  href={`https://wa.me/54${c.inquilino_telefono.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pi-action-btn"
                  style={{ marginLeft: "auto", background: "#990000", color: "#fff", flexShrink: 0, display: "inline-block", textDecoration: "none" }}>
                  Contactar
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["activos", "vencimientos"] as const).map(t => (
            <button key={t} className="pi-tab-btn" onClick={() => setTab(t)} style={{
              background: tab === t ? "rgba(153,0,0,0.18)" : "transparent",
              border: tab === t ? "1px solid rgba(153,0,0,0.5)" : "1px solid var(--gfi-border)",
              color: tab === t ? "#ff4444" : "var(--gfi-text-secondary)",
            }}>
              {t === "activos" ? `Inquilinos activos (${activos.length})` : `Por vencer / Vencidos (${porVencer.length + vencidos.length})`}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--gfi-text-muted)", fontSize: 14 }}>
            Cargando contratos...
          </div>
        )}

        {/* ── TAB: ACTIVOS ─────────────────────────────────────────────── */}
        {!loading && tab === "activos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activos.length === 0 && (
              <div style={{ ...s.card, textAlign: "center", padding: "48px 20px", color: "var(--gfi-text-muted)" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏡</div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>Sin inquilinos activos</div>
                <div style={{ fontSize: 12 }}>Los contratos vigentes aparecerán aquí</div>
              </div>
            )}

            {activos.map(c => {
              const badge = badgeVencimiento(c.diasRestantes);
              const abierto = expandido === c.id;
              const waLink = `https://wa.me/54${c.inquilino_telefono.replace(/\D/g, "")}`;

              return (
                <div key={c.id} className="pi-card">
                  {/* Cabecera del card */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)", color: "#fff" }}>
                          {c.inquilino_nombre}
                        </span>
                        {/* Badge días restantes */}
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          background: badge.bg, color: badge.color,
                          border: `1px solid ${badge.border}`,
                          borderRadius: 99, padding: "2px 9px",
                          fontFamily: "var(--font-display)", letterSpacing: "0.04em",
                        }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--gfi-text-muted)", flexWrap: "wrap" }}>
                        <span>📍 {c.direccion}{c.barrio ? `, ${c.barrio}` : ""}</span>
                        <span>📅 Vence {fmtFecha(c.fecha_fin)}</span>
                        <span style={{ color: "#fff", fontWeight: 600 }}>
                          {c.moneda === "USD" ? "USD " : "$ "}{fmt(c.alquiler_actual)}/mes
                        </span>
                      </div>
                    </div>

                    {/* Acciones rápidas */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                        className="pi-action-btn"
                        style={{ background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.25)", display: "inline-block", textDecoration: "none", padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 700 }}>
                        WhatsApp
                      </a>
                      <button className="pi-action-btn"
                        style={{ background: "rgba(255,255,255,0.07)", color: "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)" }}
                        onClick={() => setReciboContrato(c)}>
                        Generar recibo
                      </button>
                      <button className="pi-action-btn"
                        style={{ background: abierto ? "rgba(153,0,0,0.15)" : "rgba(255,255,255,0.07)", color: abierto ? "#ff4444" : "var(--gfi-text-secondary)", border: `1px solid ${abierto ? "rgba(153,0,0,0.3)" : "var(--gfi-border)"}` }}
                        onClick={() => toggleExpand(c.id)}>
                        {abierto ? "▲ Cerrar" : "▼ Ver más"}
                      </button>
                    </div>
                  </div>

                  {/* Panel expandido */}
                  {abierto && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                        {/* Datos de contacto */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gfi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Contacto</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                              📞 <a href={`tel:${c.inquilino_telefono}`} style={{ color: "#4ab8d8", textDecoration: "none" }}>{c.inquilino_telefono}</a>
                            </div>
                          </div>
                        </div>

                        {/* Datos del contrato */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gfi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Contrato</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                            <div>Inicio: {fmtFecha(c.fecha_inicio)}</div>
                            <div>Vencimiento: {fmtFecha(c.fecha_fin)}</div>
                            <div>Propietario: {c.propietario_nombre}</div>
                          </div>
                        </div>

                        {/* Notas */}
                        {c.notas && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gfi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Notas</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>{c.notas}</div>
                          </div>
                        )}
                      </div>

                      {/* Botón historial */}
                      <div style={{ marginTop: 14 }}>
                        <button className="pi-action-btn"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)", padding: "7px 16px" }}
                          onClick={() => setHistorialContrato(c)}>
                          Ver historial en CRM
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: VENCIMIENTOS ────────────────────────────────────────── */}
        {!loading && tab === "vencimientos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Por vencer en 60 días */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gfi-text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "var(--font-display)" }}>
                Por vencer — próximos 60 días ({porVencer.length})
              </div>
              {porVencer.length === 0 ? (
                <div style={{ ...s.card, textAlign: "center", padding: "28px 20px", color: "var(--gfi-text-muted)", fontSize: 13 }}>
                  Sin contratos por vencer en los próximos 60 días
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {porVencer.map(c => {
                    const badge = badgeVencimiento(c.diasRestantes);
                    return (
                      <div key={c.id} style={{
                        ...s.card,
                        borderLeft: `4px solid ${badge.color}`,
                        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                      }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 2 }}>
                            {c.inquilino_nombre}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>
                            {c.direccion}{c.barrio ? `, ${c.barrio}` : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "center", minWidth: 80 }}>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: badge.color }}>
                            {c.diasRestantes}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", textTransform: "uppercase" }}>días</div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", minWidth: 100 }}>
                          Vence {fmtFecha(c.fecha_fin)}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="pi-action-btn"
                            style={{ background: "#990000", color: "#fff" }}
                            onClick={() => setReciboContrato(c)}>
                            Recibo
                          </button>
                          <button className="pi-action-btn"
                            style={{ background: "rgba(255,255,255,0.07)", color: "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)" }}
                            onClick={() => setHistorialContrato(c)}>
                            Historial
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vencidos */}
            {vencidos.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#b80000", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "var(--font-display)" }}>
                  Vencidos ({vencidos.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {vencidos.map(c => (
                    <div key={c.id} style={{
                      ...s.card,
                      borderLeft: "4px solid rgba(239,68,68,0.5)",
                      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                      opacity: 0.8,
                    }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 2 }}>
                          {c.inquilino_nombre}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>
                          {c.direccion}{c.barrio ? `, ${c.barrio}` : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#b80000" }}>
                        Venció hace {Math.abs(c.diasRestantes)} días
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="pi-action-btn"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)" }}
                          onClick={() => setHistorialContrato(c)}>
                          Historial
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {reciboContrato && (
        <ModalRecibo contrato={reciboContrato} onClose={() => setReciboContrato(null)} />
      )}
      {historialContrato && (
        <ModalHistorial contrato={historialContrato} onClose={() => setHistorialContrato(null)} />
      )}
    </>
  );
}
