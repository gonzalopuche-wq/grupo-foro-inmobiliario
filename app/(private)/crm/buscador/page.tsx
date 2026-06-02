"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TipoResultado = "contacto" | "negocio" | "propiedad";
type OrdenResultado = "relevancia" | "fecha";

interface Resultado {
  id: string;
  tipo: TipoResultado;
  titulo: string;
  subtitulo: string;
  badge: string;
  badgeColor: string;
  href: string;
  fecha: string;
  highlight: string;
}

interface ContactoRow {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  tipo: string | null;
  etiquetas: string[] | null;
  notas: string | null;
  created_at: string;
}

interface NegocioRow {
  id: string;
  titulo: string;
  tipo_operacion: string | null;
  etapa: string | null;
  valor_operacion: number | null;
  moneda: string | null;
  notas: string | null;
  updated_at: string;
}

interface PropiedadRow {
  id: string;
  tipo: string | null;
  operacion: string | null;
  zona: string | null;
  precio: number | null;
  moneda: string | null;
  descripcion: string | null;
  estado: string | null;
  updated_at: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const LS_KEY = "crm_busquedas_recientes_v1";
const MAX_RECIENTES = 10;

const TIPO_CONFIG: Record<TipoResultado, { badge: string; color: string }> = {
  contacto:  { badge: "Contacto",  color: "#3b82f6" },
  negocio:   { badge: "Negocio",   color: "#d4960c" },
  propiedad: { badge: "Propiedad", color: "#3abab6" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extraerHighlight(texto: string | null | undefined, query: string): string {
  if (!texto || !query) return "";
  const idx = texto.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - 30);
  const end = Math.min(texto.length, idx + query.length + 30);
  const fragment = texto.slice(start, end);
  return fragment;
}

function fmtMoneda(precio: number | null | undefined, moneda: string | null | undefined): string {
  if (precio == null) return "";
  return `${moneda ?? ""}${moneda ? " " : ""}${precio.toLocaleString("es-AR")}`;
}

function leerRecientes(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function guardarReciente(q: string) {
  const prev = leerRecientes().filter((r) => r !== q);
  const next = [q, ...prev].slice(0, MAX_RECIENTES);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ── Componente de highlight ───────────────────────────────────────────────────

function TextoHighlight({ texto, query }: { texto: string; query: string }) {
  if (!query) return <>{texto}</>;
  const idx = texto.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, idx)}
      <mark
        style={{
          background: "#990000",
          color: "#fff",
          borderRadius: 2,
          padding: "0 1px",
        }}
      >
        {texto.slice(idx, idx + query.length)}
      </mark>
      {texto.slice(idx + query.length)}
    </>
  );
}

// ── Card de resultado ─────────────────────────────────────────────────────────

function ResultadoCard({
  resultado,
  query,
  onClick,
}: {
  resultado: Resultado;
  query: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        background: hovered ? "#1a1a1a" : "#111",
        borderRadius: 8,
        border: `1px solid ${hovered ? "#2a2a2a" : "#1e1e1e"}`,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        marginBottom: 8,
      }}
    >
      <span
        style={{
          background: resultado.badgeColor + "22",
          color: resultado.badgeColor,
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 700,
          alignSelf: "flex-start",
          marginTop: 2,
          whiteSpace: "nowrap",
          fontFamily: "Montserrat, sans-serif",
        }}
      >
        {resultado.badge}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14, fontFamily: "Inter, sans-serif", color: "#fff" }}>
          <TextoHighlight texto={resultado.titulo} query={query} />
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>
          {resultado.subtitulo}
        </p>
        {resultado.highlight && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              fontStyle: "italic",
              fontFamily: "Inter, sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            &ldquo;...
            <TextoHighlight texto={resultado.highlight} query={query} />
            ...&rdquo;
          </p>
        )}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "rgba(255,255,255,0.3)",
          alignSelf: "flex-end",
          whiteSpace: "nowrap",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {new Date(resultado.fecha).toLocaleDateString("es-AR")}
      </p>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid rgba(153,0,0,0.2)",
          borderTopColor: "#990000",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          margin: "40px auto",
        }}
      />
    </>
  );
}

// ── Sección agrupada ──────────────────────────────────────────────────────────

function SeccionResultados({
  titulo,
  resultados,
  query,
  onCardClick,
}: {
  titulo: string;
  resultados: Resultado[];
  query: string;
  onCardClick: (href: string) => void;
}) {
  if (resultados.length === 0) return null;
  return (
    <div style={{ marginBottom: 28 }}>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "Montserrat, sans-serif",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
        }}
      >
        {titulo}{" "}
        <span
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "1px 7px",
            fontSize: 10,
          }}
        >
          {resultados.length}
        </span>
      </p>
      {resultados.map((r) => (
        <ResultadoCard
          key={r.id}
          resultado={r}
          query={query}
          onClick={() => onCardClick(r.href)}
        />
      ))}
    </div>
  );
}

// ── Toggle de filtro ──────────────────────────────────────────────────────────

function FiltroToggle({
  label,
  activo,
  color,
  onClick,
}: {
  label: string;
  activo: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        border: `1px solid ${activo ? color : "rgba(255,255,255,0.1)"}`,
        background: activo ? color + "22" : "transparent",
        color: activo ? color : "rgba(255,255,255,0.4)",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "Inter, sans-serif",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BuscadorCRMPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [recientes, setRecientes] = useState<string[]>([]);
  const [filtros, setFiltros] = useState<Record<TipoResultado, boolean>>({
    contacto: true,
    negocio: true,
    propiedad: true,
  });
  const [orden, setOrden] = useState<OrdenResultado>("relevancia");
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUid(data.user.id);
    });
  }, []);

  // Cargar recientes
  useEffect(() => {
    setRecientes(leerRecientes());
  }, []);

  // Búsqueda
  const buscar = useCallback(
    async (q: string) => {
      if (!uid || q.trim().length < 2) {
        setResultados([]);
        return;
      }
      setCargando(true);
      try {
        const term = q.trim();
        const [resContactos, resNegocios, resPropiedades] = await Promise.all([
          supabase
            .from("crm_contactos")
            .select("id, nombre, apellido, email, telefono, tipo, etiquetas, notas, created_at")
            .eq("perfil_id", uid)
            .or(
              `nombre.ilike.%${term}%,apellido.ilike.%${term}%,email.ilike.%${term}%,telefono.ilike.%${term}%`
            )
            .limit(10),
          supabase
            .from("crm_negocios")
            .select("id, titulo, tipo_operacion, etapa, valor_operacion, moneda, notas, updated_at")
            .eq("perfil_id", uid)
            .or(`titulo.ilike.%${term}%,notas.ilike.%${term}%`)
            .limit(10),
          supabase
            .from("cartera_propiedades")
            .select("id, tipo, operacion, zona, precio, moneda, descripcion, estado, updated_at")
            .eq("perfil_id", uid)
            .or(`zona.ilike.%${term}%,descripcion.ilike.%${term}%`)
            .limit(10),
        ]);

        const lista: Resultado[] = [];

        for (const c of (resContactos.data ?? []) as ContactoRow[]) {
          const nombre = [c.nombre, c.apellido].filter(Boolean).join(" ") || "Sin nombre";
          const subtitulo = [c.email, c.tipo].filter(Boolean).join(" · ") || "";
          const highlight =
            extraerHighlight(c.notas, term) ||
            extraerHighlight(c.email, term) ||
            extraerHighlight(c.telefono, term);
          lista.push({
            id: c.id,
            tipo: "contacto",
            titulo: nombre,
            subtitulo,
            badge: TIPO_CONFIG.contacto.badge,
            badgeColor: TIPO_CONFIG.contacto.color,
            href: `/crm?contacto=${c.id}`,
            fecha: c.created_at,
            highlight,
          });
        }

        for (const n of (resNegocios.data ?? []) as NegocioRow[]) {
          const precio = fmtMoneda(n.valor_operacion, n.moneda);
          const subtitulo = [n.etapa, precio].filter(Boolean).join(" · ");
          const highlight = extraerHighlight(n.notas, term);
          lista.push({
            id: n.id,
            tipo: "negocio",
            titulo: n.titulo || "Sin título",
            subtitulo,
            badge: TIPO_CONFIG.negocio.badge,
            badgeColor: TIPO_CONFIG.negocio.color,
            href: `/crm?negocio=${n.id}`,
            fecha: n.updated_at,
            highlight,
          });
        }

        for (const p of (resPropiedades.data ?? []) as PropiedadRow[]) {
          const titulo = [p.tipo, "en", p.zona].filter(Boolean).join(" ") || "Propiedad";
          const precio = fmtMoneda(p.precio, p.moneda);
          const subtitulo = [p.zona, precio].filter(Boolean).join(" · ");
          const highlight =
            extraerHighlight(p.descripcion, term) ||
            extraerHighlight(p.zona, term);
          lista.push({
            id: p.id,
            tipo: "propiedad",
            titulo,
            subtitulo,
            badge: TIPO_CONFIG.propiedad.badge,
            badgeColor: TIPO_CONFIG.propiedad.color,
            href: `/cartera?prop=${p.id}`,
            fecha: p.updated_at,
            highlight,
          });
        }

        setResultados(lista);
      } finally {
        setCargando(false);
      }
    },
    [uid]
  );

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 2) {
        buscar(query);
        guardarReciente(query.trim());
        setRecientes(leerRecientes());
      } else {
        setResultados([]);
        setCargando(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, buscar]);

  const handleReciente = (r: string) => {
    setQuery(r);
    inputRef.current?.focus();
  };

  const limpiarHistorial = () => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    setRecientes([]);
  };

  // Filtrar y ordenar resultados
  const resultadosFiltrados = resultados.filter((r) => filtros[r.tipo]);

  const resultadosOrdenados = [...resultadosFiltrados].sort((a, b) => {
    if (orden === "fecha") {
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    }
    return 0; // relevancia: mantener orden original (del backend)
  });

  const porTipo = (tipo: TipoResultado) =>
    resultadosOrdenados.filter((r) => r.tipo === tipo);

  const mostrarRecientes =
    query.length === 0 && recientes.length > 0 && inputFocused;
  const mostrarAyuda = query.length === 0 && !inputFocused;
  const queryCorta = query.length > 0 && query.trim().length < 2;
  const sinResultados =
    query.trim().length >= 2 &&
    !cargando &&
    resultadosFiltrados.length === 0;
  const hayResultados = resultadosFiltrados.length > 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        padding: "40px 24px",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              margin: "0 0 6px",
              fontSize: 28,
              fontWeight: 800,
              fontFamily: "Montserrat, sans-serif",
              color: "#fff",
            }}
          >
            Buscador del CRM
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Buscá contactos, negocios y propiedades en un solo lugar
          </p>
        </div>

        {/* Input de búsqueda */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <span
            style={{
              position: "absolute",
              left: 18,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 20,
              color: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => setInputFocused(false), 150)}
            style={{
              width: "100%",
              padding: "16px 20px 16px 52px",
              background: "#111",
              border: `2px solid ${inputFocused ? "#990000" : "#333"}`,
              borderRadius: 12,
              color: "#fff",
              fontSize: 18,
              fontFamily: "Inter, sans-serif",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            placeholder="Buscar contactos, negocios, propiedades..."
            autoFocus
          />
          {cargando && (
            <div
              style={{
                position: "absolute",
                right: 18,
                top: "50%",
                transform: "translateY(-50%)",
                width: 20,
                height: 20,
                border: "2px solid rgba(153,0,0,0.2)",
                borderTopColor: "#990000",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          )}
          {query.length > 0 && !cargando && (
            <button
              onClick={() => setQuery("")}
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.08)",
                border: "none",
                borderRadius: "50%",
                width: 26,
                height: 26,
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Recientes */}
        {mostrarRecientes && (
          <div
            style={{
              background: "#111",
              border: "1px solid #1e1e1e",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "Montserrat, sans-serif",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                Búsquedas recientes
              </span>
              <button
                onClick={limpiarHistorial}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  textDecoration: "underline",
                }}
              >
                Limpiar historial
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {recientes.map((r) => (
                <button
                  key={r}
                  onClick={() => handleReciente(r)}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: "4px 12px",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  🕐 {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtros y orden (solo cuando hay query) */}
        {query.trim().length >= 2 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              FILTRAR:
            </span>
            {(["contacto", "negocio", "propiedad"] as TipoResultado[]).map(
              (tipo) => (
                <FiltroToggle
                  key={tipo}
                  label={TIPO_CONFIG[tipo].badge + "s"}
                  activo={filtros[tipo]}
                  color={TIPO_CONFIG[tipo].color}
                  onClick={() =>
                    setFiltros((prev) => ({ ...prev, [tipo]: !prev[tipo] }))
                  }
                />
              )
            )}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                ORDEN:
              </span>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as OrdenResultado)}
                style={{
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 12,
                  padding: "4px 10px",
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                }}
              >
                <option value="relevancia">Relevancia</option>
                <option value="fecha">Fecha reciente</option>
              </select>
            </div>
          </div>
        )}

        {/* Estados de la UI */}
        {mostrarAyuda && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "rgba(255,255,255,0.2)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p
              style={{
                fontSize: 16,
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Búsqueda unificada del CRM
            </p>
            <p style={{ fontSize: 13, fontFamily: "Inter, sans-serif" }}>
              Escribí para buscar en contactos, negocios y propiedades
            </p>
          </div>
        )}

        {queryCorta && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
            }}
          >
            Escribí al menos 2 caracteres para buscar
          </div>
        )}

        {cargando && !queryCorta && <Spinner />}

        {sinResultados && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
            }}
          >
            Sin resultados para{" "}
            <strong style={{ color: "rgba(255,255,255,0.5)" }}>
              &ldquo;{query}&rdquo;
            </strong>
          </div>
        )}

        {/* Resultados agrupados */}
        {hayResultados && !cargando && (
          <>
            <div
              style={{
                marginBottom: 16,
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {resultadosFiltrados.length} resultado
              {resultadosFiltrados.length !== 1 ? "s" : ""} para{" "}
              <strong style={{ color: "rgba(255,255,255,0.5)" }}>
                &ldquo;{query}&rdquo;
              </strong>
            </div>

            <SeccionResultados
              titulo="Contactos"
              resultados={porTipo("contacto")}
              query={query.trim()}
              onCardClick={(href) => router.push(href)}
            />
            <SeccionResultados
              titulo="Negocios"
              resultados={porTipo("negocio")}
              query={query.trim()}
              onCardClick={(href) => router.push(href)}
            />
            <SeccionResultados
              titulo="Propiedades"
              resultados={porTipo("propiedad")}
              query={query.trim()}
              onCardClick={(href) => router.push(href)}
            />
          </>
        )}
      </div>
    </div>
  );
}
