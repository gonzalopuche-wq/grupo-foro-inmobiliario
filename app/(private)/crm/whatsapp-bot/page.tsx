"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface RespuestaAutomatica {
  id: string;
  trigger: string;
  respuesta: string;
  activo: boolean;
}

interface Config {
  wb_numero: string;
  wb_bot_nombre: string;
  wb_mensaje_bienvenida: string;
  wb_ia_activo: boolean;
  wb_ia_score_umbral: number;
}

const CONFIG_DEFAULT: Config = {
  wb_numero: "",
  wb_bot_nombre: "Asistente GFI",
  wb_mensaje_bienvenida: "Hola! Soy el asistente de {inmobiliaria}. ¿En qué puedo ayudarte? Podés consultarme sobre propiedades disponibles, precios o coordinar una visita.",
  wb_ia_activo: false,
  wb_ia_score_umbral: 70,
};

const RESPUESTAS_DEFAULT: RespuestaAutomatica[] = [
  { id: "1", trigger: "precio", respuesta: "Te paso la lista de propiedades disponibles con precios actualizados. ¿Qué tipo de propiedad estás buscando? (depto, casa, local...)", activo: true },
  { id: "2", trigger: "visita", respuesta: "Con gusto coordinamos una visita. ¿Qué días y horarios te vienen bien? Un asesor te confirmará a la brevedad.", activo: true },
  { id: "3", trigger: "alquiler", respuesta: "Tenemos propiedades en alquiler en varias zonas. ¿Cuál es tu presupuesto y la zona de preferencia?", activo: true },
  { id: "4", trigger: "venta", respuesta: "Tenemos excelentes opciones en venta. ¿Buscás casa, departamento u otro tipo de propiedad?", activo: true },
  { id: "5", trigger: "gracias", respuesta: "Con gusto! Quedo a disposición para cualquier consulta. Hasta pronto!", activo: true },
];

type TabId = "configuracion" | "respuestas" | "ia" | "estadisticas";

// ── Helpers ───────────────────────────────────────────────────────────────────

function seccionCard(children: React.ReactNode) {
  return (
    <div style={{
      background: "var(--gfi-bg-card)",
      border: "1px solid var(--gfi-border-subtle)",
      borderRadius: 12,
      padding: 24,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function WhatsAppBotPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("configuracion");
  const [config, setConfig] = useState<Config>(CONFIG_DEFAULT);
  const [respuestas, setRespuestas] = useState<RespuestaAutomatica[]>(RESPUESTAS_DEFAULT);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [editandoRespuesta, setEditandoRespuesta] = useState<string | null>(null);
  const [nuevoTrigger, setNuevoTrigger] = useState("");
  const [nuevaRespuesta, setNuevaRespuesta] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargarConfig(data.user.id);
    };
    init();
  }, []);

  const cargarConfig = async (uid: string) => {
    const { data } = await supabase
      .from("indicadores")
      .select("clave, valor")
      .eq("perfil_id", uid)
      .in("clave", ["wb_numero", "wb_bot_nombre", "wb_mensaje_bienvenida", "wb_ia_activo", "wb_ia_score_umbral", "wb_respuestas"]);

    if (!data || data.length === 0) return;

    const map: Record<string, string> = {};
    for (const row of data as { clave: string; valor: string }[]) {
      map[row.clave] = row.valor;
    }

    setConfig({
      wb_numero: map.wb_numero ?? "",
      wb_bot_nombre: map.wb_bot_nombre ?? CONFIG_DEFAULT.wb_bot_nombre,
      wb_mensaje_bienvenida: map.wb_mensaje_bienvenida ?? CONFIG_DEFAULT.wb_mensaje_bienvenida,
      wb_ia_activo: map.wb_ia_activo === "true",
      wb_ia_score_umbral: Number(map.wb_ia_score_umbral ?? 70),
    });

    if (map.wb_respuestas) {
      try {
        setRespuestas(JSON.parse(map.wb_respuestas));
      } catch {
        // usa defaults
      }
    }
  };

  const guardarConfig = useCallback(async () => {
    if (!userId) return;
    setGuardando(true);
    const filas = [
      { perfil_id: userId, clave: "wb_numero",              valor: config.wb_numero },
      { perfil_id: userId, clave: "wb_bot_nombre",          valor: config.wb_bot_nombre },
      { perfil_id: userId, clave: "wb_mensaje_bienvenida",  valor: config.wb_mensaje_bienvenida },
      { perfil_id: userId, clave: "wb_ia_activo",           valor: String(config.wb_ia_activo) },
      { perfil_id: userId, clave: "wb_ia_score_umbral",     valor: String(config.wb_ia_score_umbral) },
      { perfil_id: userId, clave: "wb_respuestas",          valor: JSON.stringify(respuestas) },
    ];
    for (const fila of filas) {
      await supabase.from("indicadores").upsert(fila, { onConflict: "perfil_id,clave" });
    }
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }, [userId, config, respuestas]);

  const agregarRespuesta = () => {
    if (!nuevoTrigger.trim() || !nuevaRespuesta.trim()) return;
    setRespuestas(prev => [...prev, {
      id: Date.now().toString(),
      trigger: nuevoTrigger.trim().toLowerCase(),
      respuesta: nuevaRespuesta.trim(),
      activo: true,
    }]);
    setNuevoTrigger("");
    setNuevaRespuesta("");
  };

  const toggleRespuesta = (id: string) => {
    setRespuestas(prev => prev.map(r => r.id === id ? { ...r, activo: !r.activo } : r));
  };

  const eliminarRespuesta = (id: string) => {
    setRespuestas(prev => prev.filter(r => r.id !== id));
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: "configuracion", label: "Configuracion" },
    { id: "respuestas",    label: "Respuestas automáticas" },
    { id: "ia",            label: "Panel IA" },
    { id: "estadisticas",  label: "Estadísticas" },
  ];

  return (
    <>
      <style>{`
        
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .wb-wrap { min-height: 100vh; background: #0a0a0a; color: #fff; font-family: Inter,sans-serif; }
        .wb-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--gfi-border-subtle); }
        .wb-back { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; color: var(--gfi-text-muted); text-decoration: none; text-transform: uppercase; }
        .wb-back:hover { color: #fff; }
        .wb-titulo { font-family: Montserrat,sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .wb-spacer { flex: 1; }
        .wb-btn { padding: 8px 20px; border-radius: 6px; background: #990000; color: #fff; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; border: none; }
        .wb-btn:disabled { opacity: .5; }
        .wb-btn-ghost { padding: 8px 16px; border-radius: 6px; background: var(--gfi-border-subtle); color: rgba(255,255,255,.65); font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; border: 1px solid var(--gfi-border); }
        .wb-btn-ghost:hover { color: #fff; }
        .wb-tabs { display: flex; gap: 2px; padding: 10px 20px 0; border-bottom: 1px solid var(--gfi-border-subtle); overflow-x: auto; }
        .wb-tab { padding: 8px 16px; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; border: none; background: transparent; color: var(--gfi-text-muted); border-bottom: 2px solid transparent; white-space: nowrap; }
        .wb-tab:hover { color: #fff; }
        .wb-tab.active { color: #fff; border-bottom-color: #25d366; }
        .wb-body { max-width: 820px; margin: 0 auto; padding: 24px 20px; }
        .wb-label { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 6px; display: block; }
        .wb-input { width: 100%; padding: 10px 14px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 8px; color: #fff; font-size: 13px; outline: none; font-family: Inter,sans-serif; }
        .wb-input:focus { border-color: rgba(37,211,102,.4); }
        .wb-field { margin-bottom: 16px; }
        .wb-section-title { font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 800; color: #fff; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .wb-aviso { background: rgba(37,211,102,.06); border: 1px solid rgba(37,211,102,.2); border-radius: 10px; padding: 14px 18px; font-size: 13px; color: rgba(255,255,255,.7); line-height: 1.6; margin-bottom: 20px; }
        .wb-aviso a { color: #25d366; }
        .wb-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--gfi-border-subtle); }
        .wb-toggle-label { font-size: 13px; color: rgba(255,255,255,.8); }
        .wb-toggle-sub { font-size: 11px; color: var(--gfi-text-muted); margin-top: 2px; }
        .wb-toggle { position: relative; width: 44px; height: 24px; }
        .wb-toggle input { opacity: 0; width: 0; height: 0; }
        .wb-toggle-slider { position: absolute; inset: 0; background: var(--gfi-border); border-radius: 24px; cursor: pointer; transition: background .2s; }
        .wb-toggle input:checked + .wb-toggle-slider { background: #25d366; }
        .wb-toggle-slider::before { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: transform .2s; }
        .wb-toggle input:checked + .wb-toggle-slider::before { transform: translateX(20px); }
        .wb-resp-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; margin-bottom: 8px; }
        .wb-resp-trigger { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 12px; background: rgba(37,211,102,.12); color: #25d366; white-space: nowrap; margin-top: 2px; }
        .wb-resp-body { flex: 1; min-width: 0; }
        .wb-resp-text { font-size: 12px; color: rgba(255,255,255,.7); line-height: 1.5; }
        .wb-resp-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .wb-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .wb-stat-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 10px; padding: 18px; }
        .wb-stat-num { font-family: Montserrat,sans-serif; font-size: 28px; font-weight: 800; color: #fff; }
        .wb-stat-label { font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gfi-text-muted); margin-top: 4px; }
        .wb-slider { width: 100%; accent-color: #25d366; }
        .wb-saved { color: #25d366; font-size: 12px; font-family: Montserrat,sans-serif; font-weight: 700; }
      `}</style>

      <div className="wb-wrap">
        <div className="wb-header">
          <Link href="/crm" className="wb-back">← CRM</Link>
          <span style={{ color: "var(--gfi-border)", fontSize: 14 }}>/</span>
          <div className="wb-titulo">WhatsApp Business IA</div>
          <div className="wb-spacer" />
          {guardado && <span className="wb-saved">Guardado</span>}
          <button className="wb-btn" onClick={guardarConfig} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar config"}
          </button>
        </div>

        <div className="wb-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`wb-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="wb-body">

          {/* ── Tab: Configuracion ── */}
          {tab === "configuracion" && (
            <>
              <div className="wb-aviso">
                Para activar el bot conectá tu número via <strong>WhatsApp Business API (Meta)</strong>.{" "}
                <a href="https://developers.facebook.com/docs/whatsapp" target="_blank" rel="noreferrer">
                  Ver documentación →
                </a>
              </div>

              {seccionCard(
                <>
                  <div className="wb-section-title">
                    <span style={{ fontSize: 16 }}>📱</span> Número y Bot
                  </div>
                  <div className="wb-field">
                    <label className="wb-label">Número de WhatsApp Business</label>
                    <input
                      className="wb-input"
                      placeholder="+54 9 341 000-0000"
                      value={config.wb_numero}
                      onChange={e => setConfig(c => ({ ...c, wb_numero: e.target.value }))}
                    />
                    <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 6 }}>
                      Formato internacional con código de país (ej: +54 9 341...)
                    </div>
                  </div>
                  <div className="wb-field">
                    <label className="wb-label">Nombre del bot</label>
                    <input
                      className="wb-input"
                      placeholder="Asistente GFI"
                      value={config.wb_bot_nombre}
                      onChange={e => setConfig(c => ({ ...c, wb_bot_nombre: e.target.value }))}
                    />
                  </div>
                  <div className="wb-field">
                    <label className="wb-label">Mensaje de bienvenida</label>
                    <textarea
                      className="wb-input"
                      rows={4}
                      style={{ resize: "vertical" }}
                      value={config.wb_mensaje_bienvenida}
                      onChange={e => setConfig(c => ({ ...c, wb_mensaje_bienvenida: e.target.value }))}
                    />
                    <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 6 }}>
                      Podés usar {"{inmobiliaria}"} y {"{agente}"} como variables dinámicas.
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Tab: Respuestas automáticas ── */}
          {tab === "respuestas" && (
            <>
              {seccionCard(
                <>
                  <div className="wb-section-title">
                    <span style={{ fontSize: 16 }}>⚡</span> Nueva respuesta automática
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: "0 0 160px" }}>
                      <label className="wb-label">Trigger (palabra clave)</label>
                      <input
                        className="wb-input"
                        placeholder="precio, visita..."
                        value={nuevoTrigger}
                        onChange={e => setNuevoTrigger(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && agregarRespuesta()}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="wb-label">Respuesta automática</label>
                      <input
                        className="wb-input"
                        placeholder="Texto que enviará el bot cuando detecte el trigger..."
                        value={nuevaRespuesta}
                        onChange={e => setNuevaRespuesta(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && agregarRespuesta()}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button className="wb-btn" onClick={agregarRespuesta}>Agregar</button>
                    </div>
                  </div>
                </>
              )}

              {respuestas.map(r => (
                <div key={r.id} className="wb-resp-row" style={{ opacity: r.activo ? 1 : 0.45 }}>
                  <span className="wb-resp-trigger">{r.trigger}</span>
                  <div className="wb-resp-body">
                    {editandoRespuesta === r.id ? (
                      <textarea
                        className="wb-input"
                        rows={2}
                        style={{ resize: "vertical" }}
                        defaultValue={r.respuesta}
                        onBlur={e => {
                          setRespuestas(prev => prev.map(x => x.id === r.id ? { ...x, respuesta: e.target.value } : x));
                          setEditandoRespuesta(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="wb-resp-text">{r.respuesta}</div>
                    )}
                  </div>
                  <div className="wb-resp-actions">
                    <button className="wb-btn-ghost" style={{ padding: "4px 10px", fontSize: 9 }} onClick={() => setEditandoRespuesta(editandoRespuesta === r.id ? null : r.id)}>
                      Editar
                    </button>
                    <button
                      className="wb-btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 9, color: r.activo ? "#25d366" : "var(--gfi-text-muted)" }}
                      onClick={() => toggleRespuesta(r.id)}
                    >
                      {r.activo ? "Activo" : "Pausado"}
                    </button>
                    <button className="wb-btn-ghost" style={{ padding: "4px 10px", fontSize: 9, color: "#ef4444" }} onClick={() => eliminarRespuesta(r.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Tab: Panel IA ── */}
          {tab === "ia" && (
            <>
              {seccionCard(
                <>
                  <div className="wb-section-title">
                    <span style={{ fontSize: 16 }}>🤖</span> Análisis de leads con IA
                  </div>
                  <div className="wb-toggle-row">
                    <div>
                      <div className="wb-toggle-label">Análisis IA de conversaciones</div>
                      <div className="wb-toggle-sub">
                        El motor Claude Haiku analiza cada conversación para detectar la intención y calidad del lead.
                      </div>
                    </div>
                    <label className="wb-toggle">
                      <input
                        type="checkbox"
                        checked={config.wb_ia_activo}
                        onChange={e => setConfig(c => ({ ...c, wb_ia_activo: e.target.checked }))}
                      />
                      <span className="wb-toggle-slider" />
                    </label>
                  </div>

                  {config.wb_ia_activo && (
                    <div style={{ marginTop: 20 }}>
                      <div className="wb-field">
                        <label className="wb-label">
                          Umbral de score para escalado humano: <strong style={{ color: "#fff" }}>{config.wb_ia_score_umbral}%</strong>
                        </label>
                        <input
                          type="range"
                          className="wb-slider"
                          min={0}
                          max={100}
                          step={5}
                          value={config.wb_ia_score_umbral}
                          onChange={e => setConfig(c => ({ ...c, wb_ia_score_umbral: Number(e.target.value) }))}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--gfi-text-muted)", marginTop: 4 }}>
                          <span>0% — todos a humano</span>
                          <span>100% — sólo bot</span>
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 10, padding: "10px 14px", background: "rgba(255,255,255,.04)", borderRadius: 8 }}>
                          Cuando la IA evalúe un lead con score superior al {config.wb_ia_score_umbral}%, será escalado automáticamente al asesor humano vía notificación.
                        </div>
                      </div>

                      <div className="wb-section-title" style={{ marginTop: 20 }}>Criterios de evaluación IA</div>
                      {[
                        ["Intención de compra/alquiler clara", "Alta ponderación"],
                        ["Presupuesto mencionado", "Alta ponderación"],
                        ["Urgencia o plazo definido", "Media ponderación"],
                        ["Zona o tipo de propiedad especificado", "Media ponderación"],
                        ["Consulta genérica o especulativa", "Baja ponderación"],
                      ].map(([criterio, peso]) => (
                        <div key={criterio} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--gfi-border-subtle)", fontSize: 12, color: "rgba(255,255,255,.7)" }}>
                          <span>{criterio}</span>
                          <span style={{ fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{peso}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Tab: Estadísticas ── */}
          {tab === "estadisticas" && (
            <>
              <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 16, fontStyle: "italic" }}>
                Estadísticas del mes en curso. Se actualizan cuando el bot esté activo y conectado.
              </div>
              <div className="wb-stat-grid">
                {[
                  { num: "—", label: "Conversaciones del mes", color: "#25d366" },
                  { num: "—", label: "Leads calificados por IA", color: "#4ab8d8" },
                  { num: "—", label: "Tasa de conversión", color: "#a78bfa" },
                  { num: "—", label: "Tiempo respuesta promedio", color: "#fbbf24" },
                  { num: "—", label: "Escalados a humano", color: "#f97316" },
                  { num: "—", label: "Respuestas automáticas enviadas", color: "#3abab6" },
                ].map(s => (
                  <div key={s.label} className="wb-stat-card">
                    <div className="wb-stat-num" style={{ color: s.color }}>{s.num}</div>
                    <div className="wb-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {seccionCard(
                <>
                  <div className="wb-section-title">Estado de conexión</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,.6)" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6b7280", flexShrink: 0 }} />
                    Bot desconectado — requiere configuración de WhatsApp Business API
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <a
                      href="https://developers.facebook.com/docs/whatsapp/getting-started"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#25d366", fontSize: 12 }}
                    >
                      Guía de activación WhatsApp Business API →
                    </a>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
