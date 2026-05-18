"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  tipo: "propietario" | "comprador" | "inquilino" | "inversor" | "colega" | "otros";
  created_at: string;
  perfil_id: string;
}

interface Relacion {
  id: string;
  contacto_a_id: string;
  contacto_b_id: string;
  tipo: "referido" | "colega" | "socio" | "conocido" | "familiar";
  descripcion: string;
  created_at: string;
}

type TabId = "directorio" | "red" | "referidos";

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "red_contactos";

const TIPO_COLORES: Record<Contacto["tipo"], string> = {
  propietario: "#7c3aed",
  comprador:   "#0ea5e9",
  inquilino:   "#16a34a",
  inversor:    "#d97706",
  colega:      "#cc0000",
  otros:       "#6b7280",
};

const TIPO_LABELS: Record<Contacto["tipo"], string> = {
  propietario: "Propietario",
  comprador:   "Comprador",
  inquilino:   "Inquilino",
  inversor:    "Inversor",
  colega:      "Colega",
  otros:       "Otros",
};

const RELACION_TIPOS: Array<{ value: Relacion["tipo"]; label: string; color: string }> = [
  { value: "referido",  label: "Referido",  color: "#cc0000"  },
  { value: "colega",    label: "Colega",    color: "#0ea5e9"  },
  { value: "socio",     label: "Socio",     color: "#d97706"  },
  { value: "conocido",  label: "Conocido",  color: "#16a34a"  },
  { value: "familiar",  label: "Familiar",  color: "#7c3aed"  },
];

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function cargarRelaciones(): Relacion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Relacion[]) : [];
  } catch {
    return [];
  }
}

function guardarRelaciones(lista: Relacion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function generarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function inicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase();
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width, height }: { width: string | number; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        background: "linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)",
        backgroundSize: "200% 100%",
        borderRadius: 6,
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nombre, tipo, size = 40 }: { nombre: string; tipo: Contacto["tipo"]; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: TIPO_COLORES[tipo],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Montserrat, sans-serif",
        fontWeight: 800,
        fontSize: size * 0.4,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {inicial(nombre)}
    </div>
  );
}

// ── Badge relación ────────────────────────────────────────────────────────────

function BadgeRelacion({ tipo }: { tipo: Relacion["tipo"] }) {
  const r = RELACION_TIPOS.find(t => t.value === tipo);
  return (
    <span
      style={{
        background: r?.color ?? "#6b7280",
        color: "#fff",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        letterSpacing: "0.03em",
      }}
    >
      {r?.label ?? tipo}
    </span>
  );
}

// ── Modal agregar relación ────────────────────────────────────────────────────

interface ModalProps {
  contactos: Contacto[];
  preseleccionado: string | null;
  onCerrar: () => void;
  onGuardar: (rel: Relacion) => void;
}

function ModalRelacion({ contactos, preseleccionado, onCerrar, onGuardar }: ModalProps) {
  const [contactoA, setContactoA] = useState(preseleccionado ?? "");
  const [contactoB, setContactoB] = useState("");
  const [tipo, setTipo] = useState<Relacion["tipo"]>("referido");
  const [descripcion, setDescripcion] = useState("");
  const [busquedaB, setBusquedaB] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState("");

  const opcionesB = useMemo(() => {
    const q = busquedaB.toLowerCase();
    return contactos.filter(
      c => c.id !== contactoA && (
        c.nombre.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      )
    );
  }, [contactos, contactoA, busquedaB]);

  const contactoAObj = contactos.find(c => c.id === contactoA);
  const contactoBObj = contactos.find(c => c.id === contactoB);

  function handleGuardar() {
    if (!contactoA || !contactoB) { setError("Seleccioná ambos contactos."); return; }
    if (contactoA === contactoB) { setError("No podés vincular un contacto consigo mismo."); return; }
    onGuardar({
      id: generarId(),
      contacto_a_id: contactoA,
      contacto_b_id: contactoB,
      tipo,
      descripcion,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div
        style={{
          background: "#111111", border: "1px solid #222222", borderRadius: 12,
          padding: 28, width: "100%", maxWidth: 480, color: "#e0e0e0",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: "#e0e0e0", marginTop: 0, marginBottom: 20 }}>
          Agregar relación
        </h2>

        {/* Contacto A */}
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#a0a0a0" }}>Contacto A</label>
        <select
          value={contactoA}
          onChange={e => setContactoA(e.target.value)}
          style={{
            width: "100%", background: "#0a0a0a", border: "1px solid #333",
            borderRadius: 8, padding: "10px 12px", color: "#e0e0e0",
            fontFamily: "Inter, sans-serif", fontSize: 14, marginBottom: 16,
            appearance: "none",
          }}
        >
          <option value="">-- Seleccioná un contacto --</option>
          {contactos.map(c => (
            <option key={c.id} value={c.id}>{c.nombre} ({TIPO_LABELS[c.tipo]})</option>
          ))}
        </select>

        {/* Contacto B (searchable) */}
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#a0a0a0" }}>Contacto B</label>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Buscá por nombre o email…"
            value={contactoBObj ? contactoBObj.nombre : busquedaB}
            onChange={e => { setBusquedaB(e.target.value); setContactoB(""); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            style={{
              width: "100%", background: "#0a0a0a", border: "1px solid #333",
              borderRadius: 8, padding: "10px 12px", color: "#e0e0e0",
              fontFamily: "Inter, sans-serif", fontSize: 14, boxSizing: "border-box",
            }}
          />
          {dropdownOpen && opcionesB.length > 0 && (
            <div
              style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                background: "#1a1a1a", border: "1px solid #333", borderRadius: 8,
                maxHeight: 200, overflowY: "auto", zIndex: 10, marginTop: 4,
              }}
            >
              {opcionesB.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setContactoB(c.id); setBusquedaB(""); setDropdownOpen(false); }}
                  style={{
                    padding: "10px 14px", cursor: "pointer", fontSize: 14,
                    borderBottom: "1px solid #222",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#222")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {c.nombre} <span style={{ color: "#a0a0a0", fontSize: 12 }}>({TIPO_LABELS[c.tipo]})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tipo de relación */}
        <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#a0a0a0" }}>Tipo de relación</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {RELACION_TIPOS.map(t => (
            <label
              key={t.value}
              style={{
                display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                padding: "6px 12px", borderRadius: 20,
                border: `1px solid ${tipo === t.value ? t.color : "#333"}`,
                background: tipo === t.value ? t.color + "22" : "transparent",
                fontSize: 13, color: tipo === t.value ? t.color : "#a0a0a0",
                userSelect: "none",
              }}
            >
              <input
                type="radio"
                name="tipo-relacion"
                value={t.value}
                checked={tipo === t.value}
                onChange={() => setTipo(t.value)}
                style={{ display: "none" }}
              />
              {t.label}
            </label>
          ))}
        </div>

        {/* Descripción */}
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#a0a0a0" }}>Descripción (opcional)</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          rows={3}
          placeholder="Describí cómo se conocen o contexto de la relación…"
          style={{
            width: "100%", background: "#0a0a0a", border: "1px solid #333",
            borderRadius: 8, padding: "10px 12px", color: "#e0e0e0",
            fontFamily: "Inter, sans-serif", fontSize: 14, resize: "vertical",
            boxSizing: "border-box", marginBottom: 16,
          }}
        />

        {error && <p style={{ color: "#cc0000", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCerrar}
            style={{
              background: "transparent", border: "1px solid #333", borderRadius: 8,
              padding: "9px 20px", color: "#a0a0a0", cursor: "pointer",
              fontFamily: "Inter, sans-serif", fontSize: 14,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            style={{
              background: "#cc0000", border: "none", borderRadius: 8,
              padding: "9px 20px", color: "#fff", cursor: "pointer",
              fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14,
            }}
          >
            Guardar relación
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────

function DonutRelaciones({ relaciones }: { relaciones: Relacion[] }) {
  const conteos = RELACION_TIPOS.map(t => ({
    ...t,
    count: relaciones.filter(r => r.tipo === t.value).length,
  })).filter(t => t.count > 0);

  const total = conteos.reduce((s, t) => s + t.count, 0);
  if (total === 0) return <p style={{ color: "#666", fontSize: 13 }}>Sin relaciones aún.</p>;

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 50;
  const strokeW = 22;

  let acum = 0;
  const slices = conteos.map(t => {
    const frac = t.count / total;
    const startAngle = acum * 2 * Math.PI - Math.PI / 2;
    const endAngle = (acum + frac) * 2 * Math.PI - Math.PI / 2;
    acum += frac;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = frac > 0.5 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

    return { ...t, d };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map(s => (
          <path
            key={s.value}
            d={s.d}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy + 5} textAnchor="middle" fill="#e0e0e0" fontSize={18} fontFamily="Montserrat" fontWeight={800}>{total}</text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill="#666" fontSize={9} fontFamily="Inter">relaciones</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {conteos.map(t => (
          <div key={t.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "Inter, sans-serif" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: t.color, display: "inline-block" }} />
            <span style={{ color: "#e0e0e0" }}>{t.label}</span>
            <span style={{ color: "#666" }}>({t.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Gráfico de barras SVG ─────────────────────────────────────────────────────

function GraficoBarsas({ relaciones }: { relaciones: Relacion[] }) {
  const ahora = new Date();
  const datos = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - 11 + i, 1);
    const anio = d.getFullYear();
    const mes = d.getMonth();
    const count = relaciones.filter(r => {
      const rd = new Date(r.created_at);
      return rd.getFullYear() === anio && rd.getMonth() === mes;
    }).length;
    return { label: MESES[mes], count };
  });

  const maxVal = Math.max(...datos.map(d => d.count), 1);
  const W = 700;
  const H = 250;
  const padL = 32;
  const padR = 16;
  const padT = 20;
  const padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = (chartW / 12) * 0.6;
  const gap = chartW / 12;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, height: "auto" }}
      aria-label="Relaciones por mes"
    >
      {/* ejes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#333" strokeWidth={1} />
      <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="#333" strokeWidth={1} />

      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + chartH - frac * chartH;
        const val = Math.round(frac * maxVal);
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#1e1e1e" strokeWidth={1} />
            <text x={padL - 4} y={y + 4} textAnchor="end" fill="#555" fontSize={10} fontFamily="Inter">{val}</text>
          </g>
        );
      })}

      {/* barras */}
      {datos.map((d, i) => {
        const x = padL + i * gap + (gap - barW) / 2;
        const barH = (d.count / maxVal) * chartH;
        const y = padT + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill="#cc0000" rx={3} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="#e0e0e0" fontSize={10} fontFamily="Inter">{d.count}</text>
            )}
            <text x={x + barW / 2} y={padT + chartH + 16} textAnchor="middle" fill="#666" fontSize={10} fontFamily="Inter">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Tab Directorio ────────────────────────────────────────────────────────────

interface TabDirectorioProps {
  contactos: Contacto[];
  onAgregarRelacion: (contactoId: string) => void;
}

function TabDirectorio({ contactos, onAgregarRelacion }: TabDirectorioProps) {
  const [busqueda, setBusqueda] = useState("");
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  const handleBusqueda = useCallback((val: string) => {
    setBusqueda(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(val.toLowerCase()), 400);
  }, []);

  const filtrados = useMemo(() => {
    if (!query) return contactos;
    return contactos.filter(c =>
      c.nombre.toLowerCase().includes(query) ||
      (c.email ?? "").toLowerCase().includes(query) ||
      (c.telefono ?? "").includes(query)
    );
  }, [contactos, query]);

  const porTipo = useMemo(() => {
    const grupos: Record<string, Contacto[]> = {};
    for (const c of filtrados) {
      if (!grupos[c.tipo]) grupos[c.tipo] = [];
      grupos[c.tipo].push(c);
    }
    return grupos;
  }, [filtrados]);

  const tiposOrden: Contacto["tipo"][] = ["propietario", "comprador", "inquilino", "inversor", "colega", "otros"];

  function toggleColapso(tipo: string) {
    setColapsados(prev => {
      const s = new Set(prev);
      if (s.has(tipo)) s.delete(tipo); else s.add(tipo);
      return s;
    });
  }

  if (contactos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#666", fontFamily: "Inter, sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
        <p style={{ fontSize: 16, marginBottom: 8 }}>Aún no tenés contactos.</p>
        <p style={{ fontSize: 14 }}>Agregá contactos al CRM para ver tu red.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats rápidas */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <div style={{
          background: "#111", border: "1px solid #222", borderRadius: 10,
          padding: "12px 20px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#e0e0e0" }}>{contactos.length}</span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#a0a0a0" }}>contactos<br />en total</span>
        </div>
        {tiposOrden.map(tipo => {
          const cant = contactos.filter(c => c.tipo === tipo).length;
          if (cant === 0) return null;
          return (
            <div
              key={tipo}
              style={{
                background: TIPO_COLORES[tipo] + "22",
                border: `1px solid ${TIPO_COLORES[tipo]}44`,
                borderRadius: 20, padding: "6px 14px",
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: "Inter, sans-serif", fontSize: 13,
              }}
            >
              <span style={{ color: TIPO_COLORES[tipo], fontWeight: 600 }}>{cant}</span>
              <span style={{ color: "#a0a0a0" }}>{TIPO_LABELS[tipo]}</span>
            </div>
          );
        })}
      </div>

      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscá por nombre, email o teléfono…"
        value={busqueda}
        onChange={e => handleBusqueda(e.target.value)}
        style={{
          width: "100%", background: "#111", border: "1px solid #222",
          borderRadius: 10, padding: "12px 16px", color: "#e0e0e0",
          fontFamily: "Inter, sans-serif", fontSize: 14, marginBottom: 24,
          boxSizing: "border-box",
        }}
      />

      {/* Grupos por tipo */}
      {filtrados.length === 0 ? (
        <p style={{ color: "#666", fontFamily: "Inter, sans-serif", textAlign: "center", padding: 32 }}>
          No se encontraron contactos para "{busqueda}".
        </p>
      ) : (
        tiposOrden.map(tipo => {
          const grupo = porTipo[tipo];
          if (!grupo || grupo.length === 0) return null;
          const colapsado = colapsados.has(tipo);
          return (
            <div key={tipo} style={{ marginBottom: 24 }}>
              <button
                onClick={() => toggleColapso(tipo)}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                  width: "100%", textAlign: "left", marginBottom: 12,
                }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: TIPO_COLORES[tipo], display: "inline-block",
                }} />
                <span style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                  fontSize: 15, color: "#e0e0e0",
                }}>
                  {TIPO_LABELS[tipo]}
                </span>
                <span style={{
                  background: "#222", borderRadius: 20, padding: "2px 10px",
                  fontSize: 12, color: "#a0a0a0", fontFamily: "Inter, sans-serif",
                }}>
                  {grupo.length}
                </span>
                <span style={{ marginLeft: "auto", color: "#666", fontSize: 18, transform: colapsado ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  ▾
                </span>
              </button>

              {!colapsado && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {grupo.map(c => (
                    <div
                      key={c.id}
                      style={{
                        background: "#111", border: "1px solid #222",
                        borderRadius: 10, padding: 16,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <Avatar nombre={c.nombre} tipo={c.tipo} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                            fontSize: 14, color: "#e0e0e0",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {c.nombre}
                          </div>
                          <div style={{ fontSize: 11, color: "#666", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                            Alta: {formatearFecha(c.created_at)}
                          </div>
                        </div>
                      </div>
                      {c.email && (
                        <div style={{ fontSize: 12, color: "#a0a0a0", fontFamily: "Inter, sans-serif", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#555" }}>✉</span> {c.email}
                        </div>
                      )}
                      {c.telefono && (
                        <div style={{ fontSize: 12, color: "#a0a0a0", fontFamily: "Inter, sans-serif", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#555" }}>📞</span> {c.telefono}
                        </div>
                      )}
                      <button
                        onClick={() => onAgregarRelacion(c.id)}
                        style={{
                          background: "transparent", border: "1px solid #cc0000",
                          borderRadius: 8, padding: "6px 12px", color: "#cc0000",
                          cursor: "pointer", fontFamily: "Inter, sans-serif",
                          fontSize: 12, fontWeight: 600, width: "100%",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#cc000022"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        + Agregar relación
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Tab Red ───────────────────────────────────────────────────────────────────

interface TabRedProps {
  contactos: Contacto[];
  relaciones: Relacion[];
  onAgregarRelacion: (contactoId: string) => void;
  onEliminarRelacion: (id: string) => void;
}

function TabRed({ contactos, relaciones, onAgregarRelacion, onEliminarRelacion }: TabRedProps) {
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const getContacto = useCallback((id: string) => contactos.find(c => c.id === id), [contactos]);

  // Contactos con al menos una relación
  const contactosConRelaciones = useMemo(() => {
    const ids = new Set<string>();
    relaciones.forEach(r => { ids.add(r.contacto_a_id); ids.add(r.contacto_b_id); });
    return contactos.filter(c => ids.has(c.id));
  }, [contactos, relaciones]);

  // Hub de la red
  const hub = useMemo(() => {
    if (contactosConRelaciones.length === 0) return null;
    const conteos: Record<string, number> = {};
    relaciones.forEach(r => {
      conteos[r.contacto_a_id] = (conteos[r.contacto_a_id] ?? 0) + 1;
      conteos[r.contacto_b_id] = (conteos[r.contacto_b_id] ?? 0) + 1;
    });
    const maxId = Object.entries(conteos).sort((a, b) => b[1] - a[1])[0];
    if (!maxId) return null;
    const c = getContacto(maxId[0]);
    return c ? { contacto: c, conexiones: maxId[1] } : null;
  }, [contactosConRelaciones, relaciones, getContacto]);

  function relacionesDeContacto(id: string): Relacion[] {
    return relaciones.filter(r => r.contacto_a_id === id || r.contacto_b_id === id);
  }

  function otroContacto(rel: Relacion, propioId: string): string {
    return rel.contacto_a_id === propioId ? rel.contacto_b_id : rel.contacto_a_id;
  }

  if (contactos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#666", fontFamily: "Inter, sans-serif" }}>
        <p style={{ fontSize: 16 }}>Aún no tenés contactos. Agregá contactos al CRM para ver tu red.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Estadísticas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20 }}>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 32, color: "#cc0000" }}>
            {relaciones.length}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#a0a0a0", marginTop: 4 }}>
            Relaciones registradas
          </div>
        </div>
        {hub && (
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#a0a0a0", marginBottom: 8 }}>
              Hub de la red
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar nombre={hub.contacto.nombre} tipo={hub.contacto.tipo} size={36} />
              <div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#e0e0e0" }}>
                  {hub.contacto.nombre}
                </div>
                <div style={{ fontSize: 12, color: "#a0a0a0", fontFamily: "Inter, sans-serif" }}>
                  {hub.conexiones} conexiones
                </div>
              </div>
            </div>
          </div>
        )}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20 }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#a0a0a0", marginBottom: 12 }}>
            Tipos más frecuentes
          </div>
          <DonutRelaciones relaciones={relaciones} />
        </div>
      </div>

      {relaciones.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#666", fontFamily: "Inter, sans-serif" }}>
          <p>Todavía no registraste ninguna relación entre tus contactos.</p>
          <p style={{ fontSize: 13 }}>Usá el botón "Agregar relación" en el Directorio o el botón de abajo.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {contactosConRelaciones.map(c => {
            const rels = relacionesDeContacto(c.id);
            return (
              <div key={c.id} style={{ background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
                {/* Header contacto */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderBottom: "1px solid #1a1a1a",
                  background: "#0d0d0d",
                }}>
                  <Avatar nombre={c.nombre} tipo={c.tipo} />
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#e0e0e0" }}>
                      {c.nombre}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", fontFamily: "Inter, sans-serif" }}>
                      {TIPO_LABELS[c.tipo]} · {rels.length} relación{rels.length !== 1 ? "es" : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => onAgregarRelacion(c.id)}
                    style={{
                      marginLeft: "auto", background: "transparent",
                      border: "1px solid #333", borderRadius: 8,
                      padding: "6px 12px", color: "#a0a0a0", cursor: "pointer",
                      fontFamily: "Inter, sans-serif", fontSize: 12,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#cc0000"; (e.currentTarget as HTMLButtonElement).style.color = "#cc0000"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#333"; (e.currentTarget as HTMLButtonElement).style.color = "#a0a0a0"; }}
                  >
                    + Relación
                  </button>
                </div>

                {/* Lista de relaciones */}
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {rels.map(rel => {
                    const otroId = otroContacto(rel, c.id);
                    const otro = getContacto(otroId);
                    if (!otro) return null;
                    return (
                      <div
                        key={rel.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 12px", background: "#0a0a0a",
                          borderRadius: 8, border: "1px solid #1a1a1a",
                        }}
                      >
                        <Avatar nombre={otro.nombre} tipo={otro.tipo} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, color: "#e0e0e0", marginBottom: 3 }}>
                            {otro.nombre}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <BadgeRelacion tipo={rel.tipo} />
                            {rel.descripcion && (
                              <span style={{ fontSize: 12, color: "#666", fontFamily: "Inter, sans-serif" }}>
                                {rel.descripcion}
                              </span>
                            )}
                          </div>
                        </div>
                        {confirmando === rel.id ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => { onEliminarRelacion(rel.id); setConfirmando(null); }}
                              style={{
                                background: "#cc0000", border: "none", borderRadius: 6,
                                padding: "4px 10px", color: "#fff", cursor: "pointer",
                                fontFamily: "Inter, sans-serif", fontSize: 12,
                              }}
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmando(null)}
                              style={{
                                background: "transparent", border: "1px solid #333",
                                borderRadius: 6, padding: "4px 10px", color: "#a0a0a0",
                                cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12,
                              }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmando(rel.id)}
                            title="Eliminar relación"
                            style={{
                              background: "transparent", border: "none",
                              color: "#555", cursor: "pointer", fontSize: 18,
                              lineHeight: 1, padding: "0 4px",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#cc0000"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#555"; }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab Referidos ─────────────────────────────────────────────────────────────

interface TabReferidosProps {
  contactos: Contacto[];
  relaciones: Relacion[];
}

function TabReferidos({ contactos, relaciones }: TabReferidosProps) {
  const getContacto = useCallback((id: string) => contactos.find(c => c.id === id), [contactos]);

  const referidos = useMemo(
    () => relaciones.filter(r => r.tipo === "referido"),
    [relaciones]
  );

  // Ranking de referidores: contacto_a_id es quien refirió
  const rankingReferidores = useMemo(() => {
    const conteos: Record<string, number> = {};
    referidos.forEach(r => {
      conteos[r.contacto_a_id] = (conteos[r.contacto_a_id] ?? 0) + 1;
    });
    return Object.entries(conteos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ contacto: getContacto(id), count }))
      .filter((x): x is { contacto: Contacto; count: number } => x.contacto !== undefined);
  }, [referidos, getContacto]);

  if (contactos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#666", fontFamily: "Inter, sans-serif" }}>
        <p style={{ fontSize: 16 }}>Aún no tenés contactos. Agregá contactos al CRM para ver tu red.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Top 5 referidores */}
      <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#e0e0e0", marginTop: 0, marginBottom: 16 }}>
        Top 5 referidores
      </h3>

      {rankingReferidores.length === 0 ? (
        <p style={{ color: "#666", fontFamily: "Inter, sans-serif", marginBottom: 32 }}>
          No hay relaciones de tipo "referido" registradas aún.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 32 }}>
          {rankingReferidores.map((item, idx) => (
            <div
              key={item.contacto.id}
              style={{
                background: "#111", border: "1px solid #222", borderRadius: 10,
                padding: 16, display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: idx === 0 ? "#d97706" : idx === 1 ? "#6b7280" : "#7c3aed22",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13,
                color: idx < 2 ? "#fff" : "#7c3aed", flexShrink: 0,
              }}>
                {idx + 1}
              </div>
              <Avatar nombre={item.contacto.nombre} tipo={item.contacto.tipo} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13,
                  color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {item.contacto.nombre}
                </div>
                <div style={{ fontSize: 12, color: "#a0a0a0", fontFamily: "Inter, sans-serif" }}>
                  {item.count} referido{item.count !== 1 ? "s" : ""}
                </div>
                <div style={{ fontSize: 11, color: "#555", fontFamily: "Inter, sans-serif" }}>
                  {TIPO_LABELS[item.contacto.tipo]}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de referidos */}
      <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#e0e0e0", marginBottom: 16 }}>
        Quién refirió a quién
      </h3>

      {referidos.length === 0 ? (
        <p style={{ color: "#666", fontFamily: "Inter, sans-serif", marginBottom: 32 }}>
          No hay referidos registrados todavía.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
          {referidos.map(rel => {
            const quien = getContacto(rel.contacto_a_id);
            const referido = getContacto(rel.contacto_b_id);
            if (!quien || !referido) return null;
            return (
              <div
                key={rel.id}
                style={{
                  background: "#111", border: "1px solid #222", borderRadius: 10,
                  padding: "14px 16px", display: "flex", alignItems: "center",
                  gap: 12, flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar nombre={quien.nombre} tipo={quien.tipo} size={32} />
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#e0e0e0" }}>
                      {quien.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", fontFamily: "Inter, sans-serif" }}>
                      {TIPO_LABELS[quien.tipo]}
                    </div>
                  </div>
                </div>

                <div style={{ color: "#cc0000", fontSize: 18, fontWeight: 700 }}>→</div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar nombre={referido.nombre} tipo={referido.tipo} size={32} />
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#e0e0e0" }}>
                      {referido.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", fontFamily: "Inter, sans-serif" }}>
                      {TIPO_LABELS[referido.tipo]}
                    </div>
                  </div>
                </div>

                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  {rel.descripcion && (
                    <div style={{ fontSize: 12, color: "#a0a0a0", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>
                      {rel.descripcion}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#555", fontFamily: "Inter, sans-serif" }}>
                    {formatearFecha(rel.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gráfico barras últimos 12 meses */}
      <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#e0e0e0", marginBottom: 16 }}>
        Nuevas relaciones por mes (últimos 12 meses)
      </h3>
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20 }}>
        <GraficoBarsas relaciones={relaciones} />
      </div>
    </div>
  );
}

// ── Page principal ────────────────────────────────────────────────────────────

export default function RedContactosPage() {
  const [tab, setTab] = useState<TabId>("directorio");
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [relaciones, setRelaciones] = useState<Relacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [preseleccionado, setPreseleccionado] = useState<string | null>(null);

  // Cargar contactos desde Supabase
  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCargando(false); return; }

      const { data, error } = await supabase
        .from("contactos")
        .select("id, nombre, email, telefono, tipo, created_at, perfil_id")
        .eq("perfil_id", user.id)
        .order("nombre");

      if (!error && data) {
        setContactos(
          data.map(row => ({
            id:         String(row.id),
            nombre:     String(row.nombre ?? ""),
            email:      row.email != null ? String(row.email) : null,
            telefono:   row.telefono != null ? String(row.telefono) : null,
            tipo:       (["propietario","comprador","inquilino","inversor","colega","otros"].includes(String(row.tipo))
                          ? String(row.tipo)
                          : "otros") as Contacto["tipo"],
            created_at: String(row.created_at ?? ""),
            perfil_id:  String(row.perfil_id ?? ""),
          }))
        );
      }
      setCargando(false);
    }
    cargar();
  }, []);

  // Cargar relaciones desde localStorage
  useEffect(() => {
    setRelaciones(cargarRelaciones());
  }, []);

  function handleGuardarRelacion(rel: Relacion) {
    const nueva = [...relaciones, rel];
    setRelaciones(nueva);
    guardarRelaciones(nueva);
    setModalAbierto(false);
    setPreseleccionado(null);
  }

  function handleEliminarRelacion(id: string) {
    const filtrada = relaciones.filter(r => r.id !== id);
    setRelaciones(filtrada);
    guardarRelaciones(filtrada);
  }

  function abrirModal(contactoId: string | null = null) {
    setPreseleccionado(contactoId);
    setModalAbierto(true);
  }

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: "directorio", label: "Directorio por tipo" },
    { id: "red",        label: "Red de relaciones"  },
    { id: "referidos",  label: "Referidos y valor"  },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{
        background: "#0a0a0a", minHeight: "100vh",
        color: "#e0e0e0", padding: "24px 20px",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{
                fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26,
                color: "#e0e0e0", margin: 0,
              }}>
                Red de Contactos
              </h1>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#666", margin: "4px 0 0" }}>
                Visualizá y gestioná las relaciones entre tus contactos
              </p>
            </div>
            <button
              onClick={() => abrirModal(null)}
              style={{
                background: "#cc0000", border: "none", borderRadius: 10,
                padding: "10px 20px", color: "#fff", cursor: "pointer",
                fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14,
              }}
            >
              + Nueva relación
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: "1px solid #222", paddingBottom: 0 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: "transparent", border: "none",
                  borderBottom: tab === t.id ? "2px solid #cc0000" : "2px solid transparent",
                  padding: "10px 16px", cursor: "pointer",
                  fontFamily: "Inter, sans-serif", fontWeight: tab === t.id ? 600 : 400,
                  fontSize: 14, color: tab === t.id ? "#e0e0e0" : "#666",
                  marginBottom: -1, transition: "color 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {cargando ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Skeleton width={48} height={48} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <Skeleton width="60%" height={14} />
                    <Skeleton width="40%" height={12} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {tab === "directorio" && (
                <TabDirectorio
                  contactos={contactos}
                  onAgregarRelacion={abrirModal}
                />
              )}
              {tab === "red" && (
                <TabRed
                  contactos={contactos}
                  relaciones={relaciones}
                  onAgregarRelacion={abrirModal}
                  onEliminarRelacion={handleEliminarRelacion}
                />
              )}
              {tab === "referidos" && (
                <TabReferidos
                  contactos={contactos}
                  relaciones={relaciones}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalAbierto && (
        <ModalRelacion
          contactos={contactos}
          preseleccionado={preseleccionado}
          onCerrar={() => { setModalAbierto(false); setPreseleccionado(null); }}
          onGuardar={handleGuardarRelacion}
        />
      )}
    </>
  );
}
