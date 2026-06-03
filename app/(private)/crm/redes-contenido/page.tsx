"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoContenido = "propiedad" | "mercado" | "consejo" | "personal" | "testimonio";
type Tono = "profesional" | "cercano" | "informal";
type Plataforma = "instagram" | "linkedin" | "whatsapp" | "facebook";
type TabId = "generar" | "historial";

interface Propiedad {
  id: string;
  titulo: string;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string;
  zona: string | null;
  ciudad: string | null;
}

interface ResultadoIA {
  texto_principal: string;
  hashtags: string[];
  llamada_a_accion: string;
  mejor_hora_publicar: string;
  alternativa: string;
  limite_caracteres: number;
  caracteres_usados: number;
}

interface PostHistorial {
  id: string;
  tipo: TipoContenido;
  plataforma: Plataforma;
  tono: Tono;
  texto_principal: string;
  hashtags: string[];
  llamada_a_accion: string;
  mejor_hora_publicar: string;
  alternativa: string;
  created_at: string;
  propiedad_titulo?: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS: { id: TipoContenido; label: string; icon: string; desc: string }[] = [
  { id: "propiedad", label: "Propiedad", icon: "🏠", desc: "Post de una propiedad de tu cartera" },
  { id: "mercado",   label: "Mercado",   icon: "📈", desc: "Tendencias del mercado inmobiliario" },
  { id: "consejo",   label: "Consejo",   icon: "💡", desc: "Tips para compradores o vendedores" },
  { id: "personal",  label: "Personal",  icon: "🙋", desc: "Marca personal y experiencia propia" },
  { id: "testimonio",label: "Testimonio",icon: "⭐", desc: "Caso de éxito de un cliente" },
];

const PLATAFORMAS: { id: Plataforma; label: string; icon: string; color: string }[] = [
  { id: "instagram", label: "Instagram", icon: "📸", color: "#E1306C" },
  { id: "linkedin",  label: "LinkedIn",  icon: "💼", color: "#0077B5" },
  { id: "whatsapp",  label: "WhatsApp",  icon: "💬", color: "#25D366" },
  { id: "facebook",  label: "Facebook",  icon: "👥", color: "#1877F2" },
];

const TONOS: { id: Tono; label: string; desc: string }[] = [
  { id: "profesional", label: "Profesional", desc: "Formal y experto" },
  { id: "cercano",     label: "Cercano",     desc: "Cálido y de confianza" },
  { id: "informal",    label: "Informal",    desc: "Descontracturado y local" },
];

const TIPO_LABEL: Record<TipoContenido, string> = {
  propiedad: "Propiedad",
  mercado: "Mercado",
  consejo: "Consejo",
  personal: "Personal",
  testimonio: "Testimonio",
};

const HISTORIAL_KEY = "gfi_posts_historial";
const MAX_HISTORIAL = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function saveToHistorial(post: PostHistorial) {
  try {
    const raw = localStorage.getItem(HISTORIAL_KEY);
    const arr: PostHistorial[] = raw ? JSON.parse(raw) : [];
    arr.unshift(post);
    localStorage.setItem(HISTORIAL_KEY, JSON.stringify(arr.slice(0, MAX_HISTORIAL)));
  } catch { /* localStorage puede fallar en SSR */ }
}

function loadHistorial(): PostHistorial[] {
  try {
    const raw = localStorage.getItem(HISTORIAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RedesContenidoPage() {
  const [tab, setTab] = useState<TabId>("generar");

  // Form state
  const [tipo, setTipo] = useState<TipoContenido>("propiedad");
  const [plataforma, setPlataforma] = useState<Plataforma>("instagram");
  const [tono, setTono] = useState<Tono>("cercano");
  const [propiedadId, setPropiedadId] = useState<string>("");
  const [propBusqueda, setPropBusqueda] = useState("");
  const [contextoExtra, setContextoExtra] = useState("");

  // Data
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);

  // Resultado
  const [resultado, setResultado] = useState<ResultadoIA | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [mostrarAlternativa, setMostrarAlternativa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Historial
  const [historial, setHistorial] = useState<PostHistorial[]>([]);
  const [postSeleccionado, setPostSeleccionado] = useState<PostHistorial | null>(null);

  // Copy feedback
  const [copied, setCopied] = useState<string | null>(null);

  // ─── Cargar propiedades ────────────────────────────────────────────────────

  const cargarPropiedades = useCallback(async () => {
    setLoadingProps(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("cartera_propiedades")
        .select("id, titulo, operacion, tipo, precio, moneda, zona, ciudad")
        .eq("perfil_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      setPropiedades(data ?? []);
      if (data?.[0] && !propiedadId) setPropiedadId(data[0].id);
    } finally {
      setLoadingProps(false);
    }
  }, [propiedadId]);

  useEffect(() => {
    cargarPropiedades();
    setHistorial(loadHistorial());
  }, [cargarPropiedades]);

  // ─── Filtrar propiedades por búsqueda ─────────────────────────────────────

  const propsFiltradas = propiedades.filter(p => {
    if (!propBusqueda) return true;
    const q = propBusqueda.toLowerCase();
    return (
      p.titulo?.toLowerCase().includes(q) ||
      p.tipo?.toLowerCase().includes(q) ||
      p.zona?.toLowerCase().includes(q) ||
      p.ciudad?.toLowerCase().includes(q)
    );
  });

  // ─── Generar con IA ────────────────────────────────────────────────────────

  async function generar() {
    setLoading(true);
    setError(null);
    setResultado(null);
    setMostrarAlternativa(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("No hay sesión activa"); return; }

      const body: Record<string, string | undefined> = {
        tipo,
        plataforma,
        tono,
        contexto_extra: contextoExtra || undefined,
      };
      if (tipo === "propiedad") body.propiedad_id = propiedadId;

      const res = await fetch("/api/ia-contenido-rrss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error al generar el contenido");
        return;
      }

      setResultado(data);
      setTextoEditado(data.texto_principal);

      // Guardar en historial
      const propTitulo = tipo === "propiedad"
        ? propiedades.find(p => p.id === propiedadId)?.titulo
        : undefined;

      const postHistorial: PostHistorial = {
        id: crypto.randomUUID(),
        tipo,
        plataforma,
        tono,
        texto_principal: data.texto_principal,
        hashtags: data.hashtags,
        llamada_a_accion: data.llamada_a_accion,
        mejor_hora_publicar: data.mejor_hora_publicar,
        alternativa: data.alternativa,
        created_at: new Date().toISOString(),
        propiedad_titulo: propTitulo,
      };
      saveToHistorial(postHistorial);
      setHistorial(loadHistorial());

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }

  // ─── Copiar ────────────────────────────────────────────────────────────────

  async function copiar(texto: string, id: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* Fallback */ }
  }

  function copiarTodo() {
    if (!resultado) return;
    const tags = resultado.hashtags.join(" ");
    const todo = `${textoEditado}\n\n${tags}`;
    copiar(todo, "todo");
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--gfi-bg-primary)", color: "var(--gfi-text-primary)", padding: "24px 20px" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>✨</span>
          Generador de Contenido para Redes
        </h1>
        <p style={{ color: "var(--gfi-text-secondary)", fontSize: 14, margin: "4px 0 0" }}>
          Creá posts profesionales para Instagram, LinkedIn, WhatsApp y Facebook con IA
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--gfi-border)", paddingBottom: 0 }}>
        {(["generar", "historial"] as TabId[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--gfi-text-primary)" : "var(--gfi-text-secondary)",
              borderBottom: tab === t ? "2px solid #990000" : "2px solid transparent",
              marginBottom: -1,
              transition: "all .15s",
            }}
          >
            {t === "generar" ? "✨ Generar post" : `🕒 Historial (${historial.length})`}
          </button>
        ))}
      </div>

      {/* ── TAB GENERAR ─────────────────────────────────────────────────────── */}
      {tab === "generar" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 1200 }}>

          {/* Panel izquierdo: formulario */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Tipo de contenido */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gfi-text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                Tipo de contenido
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {TIPOS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTipo(t.id)}
                    style={{
                      padding: "12px 14px",
                      background: tipo === t.id ? "rgba(153,0,0,0.15)" : "var(--gfi-bg-card)",
                      border: tipo === t.id ? "1px solid rgba(153,0,0,0.5)" : "1px solid var(--gfi-border)",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all .15s",
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 3 }}>{t.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: tipo === t.id ? "#ffaaaa" : "var(--gfi-text-primary)" }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 2 }}>
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de propiedad */}
            {tipo === "propiedad" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gfi-text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  Propiedad de tu cartera
                </label>
                <input
                  type="text"
                  placeholder="Buscar propiedad..."
                  value={propBusqueda}
                  onChange={e => setPropBusqueda(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", marginBottom: 8,
                    background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border)",
                    borderRadius: 8, color: "var(--gfi-text-primary)", fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
                {loadingProps ? (
                  <div style={{ color: "var(--gfi-text-muted)", fontSize: 13, padding: "8px 0" }}>Cargando propiedades...</div>
                ) : (
                  <select
                    value={propiedadId}
                    onChange={e => setPropiedadId(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px",
                      background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border)",
                      borderRadius: 8, color: "var(--gfi-text-primary)", fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">— Seleccioná una propiedad —</option>
                    {propsFiltradas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.titulo || "Sin título"} — {p.operacion} {p.tipo}
                        {p.zona ? ` | ${p.zona}` : ""}
                        {p.precio ? ` | ${p.moneda} ${p.precio.toLocaleString("es-AR")}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {propsFiltradas.length === 0 && !loadingProps && propBusqueda && (
                  <div style={{ color: "var(--gfi-text-muted)", fontSize: 12, marginTop: 4 }}>
                    Sin resultados para "{propBusqueda}"
                  </div>
                )}
              </div>
            )}

            {/* Plataforma */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gfi-text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                Plataforma
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PLATAFORMAS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPlataforma(p.id)}
                    style={{
                      padding: "10px 16px",
                      background: plataforma === p.id ? `${p.color}22` : "var(--gfi-bg-card)",
                      border: plataforma === p.id ? `1px solid ${p.color}88` : "1px solid var(--gfi-border)",
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all .15s",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{p.icon}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: plataforma === p.id ? p.color : "var(--gfi-text-primary)",
                    }}>
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tono */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gfi-text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                Tono de comunicación
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {TONOS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTono(t.id)}
                    style={{
                      flex: 1, padding: "10px 12px",
                      background: tono === t.id ? "rgba(58,186,182,0.12)" : "var(--gfi-bg-card)",
                      border: tono === t.id ? "1px solid rgba(58,186,182,0.4)" : "1px solid var(--gfi-border)",
                      borderRadius: 10, cursor: "pointer", textAlign: "center",
                      transition: "all .15s",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: tono === t.id ? "#3abab6" : "var(--gfi-text-primary)" }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 2 }}>
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Contexto extra */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gfi-text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                Contexto extra{" "}
                <span style={{ color: "var(--gfi-text-muted)", fontWeight: 400, textTransform: "none" }}>(opcional)</span>
              </label>
              <textarea
                value={contextoExtra}
                onChange={e => setContextoExtra(e.target.value)}
                placeholder="Ej: la propiedad tiene una terraza increíble con vista al río, ideal para familias..."
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border)",
                  borderRadius: 8, color: "var(--gfi-text-primary)", fontSize: 13,
                  resize: "vertical", boxSizing: "border-box", lineHeight: 1.5,
                }}
              />
            </div>

            {/* Botón generar */}
            <button
              onClick={generar}
              disabled={loading || (tipo === "propiedad" && !propiedadId)}
              style={{
                padding: "14px 24px",
                background: loading ? "rgba(153,0,0,0.5)" : "var(--gfi-red-gradient)",
                border: "none", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
                color: "#fff", fontSize: 15, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "opacity .15s",
                opacity: (tipo === "propiedad" && !propiedadId) ? 0.5 : 1,
              }}
            >
              {loading ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                  Generando con IA...
                </>
              ) : (
                <>✨ Generar con IA</>
              )}
            </button>

            {error && (
              <div style={{
                padding: "12px 16px",
                background: "rgba(153,0,0,0.12)",
                border: "1px solid rgba(153,0,0,0.3)",
                borderRadius: 8,
                color: "#ff8080",
                fontSize: 13,
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Panel derecho: resultado */}
          <div>
            {!resultado && !loading && (
              <div style={{
                background: "var(--gfi-bg-card)",
                border: "1px solid var(--gfi-border)",
                borderRadius: 12,
                padding: "48px 32px",
                textAlign: "center",
                color: "var(--gfi-text-muted)",
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: "var(--gfi-text-secondary)" }}>
                  Tu post aparecerá aquí
                </div>
                <div style={{ fontSize: 13 }}>
                  Configurá el tipo de contenido, la plataforma y el tono,<br />
                  luego presioná "Generar con IA"
                </div>
              </div>
            )}

            {loading && (
              <div style={{
                background: "var(--gfi-bg-card)",
                border: "1px solid var(--gfi-border)",
                borderRadius: 12,
                padding: "48px 32px",
                textAlign: "center",
                color: "var(--gfi-text-secondary)",
              }}>
                <div style={{ fontSize: 36, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }}>✨</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  Generando tu contenido...
                </div>
                <div style={{ fontSize: 13, color: "var(--gfi-text-muted)" }}>
                  La IA está creando tu post ideal para {PLATAFORMAS.find(p => p.id === plataforma)?.label}
                </div>
              </div>
            )}

            {resultado && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Card principal */}
                <div style={{
                  background: "var(--gfi-bg-card)",
                  border: "1px solid var(--gfi-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}>
                  {/* Header del resultado */}
                  <div style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--gfi-border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "var(--gfi-bg-elevated)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{PLATAFORMAS.find(p => p.id === plataforma)?.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                        Post para {PLATAFORMAS.find(p => p.id === plataforma)?.label}
                      </span>
                      <span style={{
                        fontSize: 11, padding: "2px 8px",
                        background: "rgba(58,186,182,0.12)", border: "1px solid rgba(58,186,182,0.25)",
                        borderRadius: 20, color: "#3abab6",
                      }}>
                        {TIPO_LABEL[tipo]}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 12, color: resultado.caracteres_usados > resultado.limite_caracteres ? "#ff8080" : "var(--gfi-text-muted)",
                    }}>
                      {textoEditado.length} / {resultado.limite_caracteres} car.
                    </span>
                  </div>

                  {/* Texto editable */}
                  <div style={{ padding: "16px 18px" }}>
                    <textarea
                      value={textoEditado}
                      onChange={e => setTextoEditado(e.target.value)}
                      rows={10}
                      style={{
                        width: "100%", padding: "12px",
                        background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border-bright)",
                        borderRadius: 8, color: "var(--gfi-text-primary)", fontSize: 14,
                        lineHeight: 1.6, resize: "vertical", boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  {/* Hashtags */}
                  {resultado.hashtags.length > 0 && (
                    <div style={{ padding: "0 18px 16px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gfi-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                        Hashtags sugeridos
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {resultado.hashtags.map((h, i) => (
                          <button
                            key={i}
                            onClick={() => copiar(h, `hash-${i}`)}
                            title="Click para copiar"
                            style={{
                              padding: "4px 10px",
                              background: "rgba(58,186,182,0.08)", border: "1px solid rgba(58,186,182,0.2)",
                              borderRadius: 20, cursor: "pointer",
                              color: "#3abab6", fontSize: 12, fontWeight: 500,
                              transition: "all .1s",
                            }}
                          >
                            {copied === `hash-${i}` ? "✓" : h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta info */}
                  <div style={{
                    padding: "14px 18px",
                    borderTop: "1px solid var(--gfi-border)",
                    background: "var(--gfi-bg-secondary)",
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 3 }}>CTA sugerida</div>
                      <div style={{ fontSize: 13, color: "var(--gfi-text-secondary)" }}>
                        {resultado.llamada_a_accion || "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 3 }}>Mejor hora para publicar</div>
                      <div style={{ fontSize: 13, color: "#3abab6", fontWeight: 500 }}>
                        🕐 {resultado.mejor_hora_publicar || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => copiar(textoEditado, "texto")}
                    style={{
                      flex: 1, padding: "11px 16px",
                      background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border)",
                      borderRadius: 8, cursor: "pointer",
                      color: "var(--gfi-text-primary)", fontSize: 13, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {copied === "texto" ? "✓ Copiado" : "📋 Copiar texto"}
                  </button>
                  <button
                    onClick={copiarTodo}
                    style={{
                      flex: 1, padding: "11px 16px",
                      background: "rgba(153,0,0,0.1)", border: "1px solid rgba(153,0,0,0.3)",
                      borderRadius: 8, cursor: "pointer",
                      color: "#ff9090", fontSize: 13, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {copied === "todo" ? "✓ Copiado" : "📋 Copiar texto + hashtags"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={generar}
                    disabled={loading}
                    style={{
                      flex: 1, padding: "10px 16px",
                      background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border-bright)",
                      borderRadius: 8, cursor: "pointer",
                      color: "var(--gfi-text-secondary)", fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    🔄 Regenerar
                  </button>
                  <button
                    onClick={() => setMostrarAlternativa(!mostrarAlternativa)}
                    style={{
                      flex: 1, padding: "10px 16px",
                      background: mostrarAlternativa ? "rgba(58,186,182,0.1)" : "var(--gfi-bg-card)",
                      border: mostrarAlternativa ? "1px solid rgba(58,186,182,0.3)" : "1px solid var(--gfi-border-bright)",
                      borderRadius: 8, cursor: "pointer",
                      color: mostrarAlternativa ? "#3abab6" : "var(--gfi-text-secondary)",
                      fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {mostrarAlternativa ? "▲ Ocultar alternativa" : "↕ Ver alternativa"}
                  </button>
                </div>

                {/* Versión alternativa */}
                {mostrarAlternativa && resultado.alternativa && (
                  <div style={{
                    background: "var(--gfi-bg-card)",
                    border: "1px solid rgba(58,186,182,0.25)",
                    borderRadius: 12, overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--gfi-border)",
                      background: "rgba(58,186,182,0.06)",
                      fontSize: 13, fontWeight: 600, color: "#3abab6",
                    }}>
                      ↕ Versión alternativa
                    </div>
                    <div style={{ padding: "16px" }}>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--gfi-text-secondary)", whiteSpace: "pre-wrap" }}>
                        {resultado.alternativa}
                      </p>
                      <button
                        onClick={() => copiar(resultado.alternativa, "alt")}
                        style={{
                          marginTop: 12, padding: "8px 14px",
                          background: "var(--gfi-bg-elevated)", border: "1px solid var(--gfi-border)",
                          borderRadius: 6, cursor: "pointer",
                          color: "var(--gfi-text-secondary)", fontSize: 12,
                        }}
                      >
                        {copied === "alt" ? "✓ Copiado" : "📋 Copiar alternativa"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB HISTORIAL ──────────────────────────────────────────────────── */}
      {tab === "historial" && (
        <div style={{ maxWidth: 1200 }}>
          {historial.length === 0 ? (
            <div style={{
              background: "var(--gfi-bg-card)",
              border: "1px solid var(--gfi-border)",
              borderRadius: 12, padding: "48px 32px",
              textAlign: "center", color: "var(--gfi-text-muted)",
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🕒</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--gfi-text-secondary)", marginBottom: 6 }}>
                Aún no generaste ningún post
              </div>
              <div style={{ fontSize: 13 }}>
                Tus últimos {MAX_HISTORIAL} posts generados aparecerán aquí
              </div>
              <button
                onClick={() => setTab("generar")}
                style={{
                  marginTop: 16, padding: "10px 20px",
                  background: "var(--gfi-red-gradient)", border: "none",
                  borderRadius: 8, cursor: "pointer",
                  color: "#fff", fontSize: 13, fontWeight: 600,
                }}
              >
                ✨ Generar mi primer post
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: postSeleccionado ? "340px 1fr" : "1fr", gap: 20 }}>

              {/* Lista */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {historial.map(post => (
                  <button
                    key={post.id}
                    onClick={() => setPostSeleccionado(postSeleccionado?.id === post.id ? null : post)}
                    style={{
                      textAlign: "left", padding: "14px 16px",
                      background: postSeleccionado?.id === post.id ? "rgba(153,0,0,0.1)" : "var(--gfi-bg-card)",
                      border: postSeleccionado?.id === post.id ? "1px solid rgba(153,0,0,0.35)" : "1px solid var(--gfi-border)",
                      borderRadius: 10, cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 15 }}>
                        {PLATAFORMAS.find(p => p.id === post.plataforma)?.icon}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gfi-text-primary)" }}>
                        {PLATAFORMAS.find(p => p.id === post.plataforma)?.label}
                      </span>
                      <span style={{
                        fontSize: 11, padding: "2px 8px",
                        background: "rgba(58,186,182,0.08)", border: "1px solid rgba(58,186,182,0.2)",
                        borderRadius: 20, color: "#3abab6",
                      }}>
                        {TIPO_LABEL[post.tipo]}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12, color: "var(--gfi-text-secondary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}>
                      {post.texto_principal.slice(0, 90)}…
                    </div>
                    {post.propiedad_titulo && (
                      <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 4 }}>
                        🏠 {post.propiedad_titulo}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 4 }}>
                      {fmtFecha(post.created_at)}
                    </div>
                  </button>
                ))}
              </div>

              {/* Detalle del post seleccionado */}
              {postSeleccionado && (
                <div style={{
                  background: "var(--gfi-bg-card)",
                  border: "1px solid var(--gfi-border)",
                  borderRadius: 12, overflow: "hidden",
                  alignSelf: "start",
                }}>
                  <div style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--gfi-border)",
                    background: "var(--gfi-bg-elevated)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {PLATAFORMAS.find(p => p.id === postSeleccionado.plataforma)?.icon}{" "}
                      Post para {PLATAFORMAS.find(p => p.id === postSeleccionado.plataforma)?.label}
                    </span>
                    <button
                      onClick={() => setPostSeleccionado(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gfi-text-muted)", fontSize: 18 }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ padding: "16px 18px" }}>
                    <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.7, color: "var(--gfi-text-primary)", whiteSpace: "pre-wrap" }}>
                      {postSeleccionado.texto_principal}
                    </p>

                    {postSeleccionado.hashtags.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Hashtags
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {postSeleccionado.hashtags.map((h, i) => (
                            <span key={i} style={{
                              padding: "3px 9px", background: "rgba(58,186,182,0.08)",
                              border: "1px solid rgba(58,186,182,0.2)", borderRadius: 20,
                              color: "#3abab6", fontSize: 12,
                            }}>
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, padding: "12px", background: "var(--gfi-bg-secondary)", borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 3 }}>CTA</div>
                        <div style={{ fontSize: 12, color: "var(--gfi-text-secondary)" }}>{postSeleccionado.llamada_a_accion || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 3 }}>Mejor hora</div>
                        <div style={{ fontSize: 12, color: "#3abab6" }}>🕐 {postSeleccionado.mejor_hora_publicar || "—"}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => copiar(postSeleccionado.texto_principal, "hist-texto")}
                        style={{
                          flex: 1, padding: "10px 14px",
                          background: "var(--gfi-bg-elevated)", border: "1px solid var(--gfi-border)",
                          borderRadius: 8, cursor: "pointer",
                          color: "var(--gfi-text-primary)", fontSize: 13, fontWeight: 600,
                        }}
                      >
                        {copied === "hist-texto" ? "✓ Copiado" : "📋 Copiar texto"}
                      </button>
                      <button
                        onClick={() => copiar(`${postSeleccionado.texto_principal}\n\n${postSeleccionado.hashtags.join(" ")}`, "hist-todo")}
                        style={{
                          flex: 1, padding: "10px 14px",
                          background: "rgba(153,0,0,0.08)", border: "1px solid rgba(153,0,0,0.25)",
                          borderRadius: 8, cursor: "pointer",
                          color: "#ff9090", fontSize: 13, fontWeight: 600,
                        }}
                      >
                        {copied === "hist-todo" ? "✓ Copiado" : "📋 Texto + hashtags"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        select option { background: #121820; color: #eef2f6; }
      `}</style>
    </div>
  );
}
