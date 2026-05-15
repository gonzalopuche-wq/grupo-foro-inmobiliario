"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Portal {
  id: string;
  token: string;
  vendedor_nombre: string;
  vendedor_email: string | null;
  vendedor_telefono: string | null;
  titulo: string;
  mensaje_bienvenida: string | null;
  etapa_actual: string | null;
  activo: boolean;
  vistas: number;
  expires_at: string | null;
  created_at: string;
}

interface Novedad {
  id: string;
  portal_id: string;
  titulo: string;
  contenido: string | null;
  tipo: string;
  created_at: string;
}

interface Propiedad {
  id: string;
  titulo: string;
  direccion: string | null;
  barrio: string | null;
}

const TIPO_NOVEDAD: Record<string, { label: string; icon: string; color: string }> = {
  nota:      { label: "Nota",     icon: "📝", color: "#60a5fa" },
  visita:    { label: "Visita",   icon: "🗓",  color: "#22c55e" },
  oferta:    { label: "Oferta",   icon: "💰",  color: "#f59e0b" },
  escritura: { label: "Escritura",icon: "📋",  color: "#a78bfa" },
  otro:      { label: "Otro",     icon: "📌",  color: "#6b7280" },
};

const ETAPAS = [
  "Ingresada", "En tasación", "Lista para publicar", "Publicada",
  "Con visitas", "Con oferta", "En reserva", "En escritura", "Escriturada",
];

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

const FORM_VACIO = {
  vendedor_nombre: "", vendedor_email: "", vendedor_telefono: "",
  titulo: "", mensaje_bienvenida: "", etapa_actual: "Ingresada", expires_at: "",
};

const NOVEDAD_VACIO = { titulo: "", contenido: "", tipo: "nota" };

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 7, padding: "9px 12px", color: "#fff", fontFamily: "Inter,sans-serif",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif",
  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, display: "block",
};

export default function PortalVendedorPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [portales, setPortales] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [portalAbierto, setPortalAbierto] = useState<string | null>(null);
  const [novedades, setNovedades] = useState<Record<string, Novedad[]>>({});
  const [novForm, setNovForm] = useState(NOVEDAD_VACIO);
  const [guardandoNov, setGuardandoNov] = useState(false);
  const [copiadoToken, setCopiadoToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_portal_vendedor")
      .select("*")
      .eq("corredor_id", userId)
      .order("created_at", { ascending: false });
    setPortales(data ?? []);
    setLoading(false);
  };

  const cargarNovedades = async (portalId: string) => {
    const { data } = await supabase
      .from("crm_portal_vendedor_novedades")
      .select("*")
      .eq("portal_id", portalId)
      .order("created_at", { ascending: false });
    setNovedades(prev => ({ ...prev, [portalId]: data ?? [] }));
  };

  const guardar = async () => {
    if (!uid || !form.vendedor_nombre.trim() || !form.titulo.trim()) return;
    setGuardando(true);
    const { error } = await supabase.from("crm_portal_vendedor").insert({
      corredor_id: uid,
      vendedor_nombre: form.vendedor_nombre.trim(),
      vendedor_email: form.vendedor_email.trim() || null,
      vendedor_telefono: form.vendedor_telefono.trim() || null,
      titulo: form.titulo.trim(),
      mensaje_bienvenida: form.mensaje_bienvenida.trim() || null,
      etapa_actual: form.etapa_actual,
      expires_at: form.expires_at || null,
    });
    setGuardando(false);
    if (error) {
      setMsg({ tipo: "err", texto: "Error al crear el portal." });
    } else {
      setMsg({ tipo: "ok", texto: "Portal creado correctamente." });
      setForm(FORM_VACIO);
      setMostrarForm(false);
      cargar(uid);
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const guardarNovedad = async (portalId: string) => {
    if (!novForm.titulo.trim()) return;
    setGuardandoNov(true);
    await supabase.from("crm_portal_vendedor_novedades").insert({
      portal_id: portalId,
      titulo: novForm.titulo.trim(),
      contenido: novForm.contenido.trim() || null,
      tipo: novForm.tipo,
    });
    setGuardandoNov(false);
    setNovForm(NOVEDAD_VACIO);
    cargarNovedades(portalId);
  };

  const toggleActivo = async (portal: Portal) => {
    await supabase.from("crm_portal_vendedor").update({ activo: !portal.activo }).eq("id", portal.id);
    setPortales(prev => prev.map(p => p.id === portal.id ? { ...p, activo: !p.activo } : p));
  };

  const actualizarEtapa = async (portal: Portal, etapa: string) => {
    await supabase.from("crm_portal_vendedor").update({ etapa_actual: etapa }).eq("id", portal.id);
    setPortales(prev => prev.map(p => p.id === portal.id ? { ...p, etapa_actual: etapa } : p));
  };

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/vendor/${token}`;
    navigator.clipboard.writeText(url);
    setCopiadoToken(token);
    setTimeout(() => setCopiadoToken(null), 2000);
  };

  const abrirPortal = (portalId: string) => {
    const nuevo = portalAbierto === portalId ? null : portalId;
    setPortalAbierto(nuevo);
    if (nuevo && !novedades[nuevo]) cargarNovedades(nuevo);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .pv-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; transition: border-color 0.15s; }
        .pv-card:hover { border-color: rgba(255,255,255,0.12); }
        .pv-btn { padding: 7px 16px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: Montserrat,sans-serif; border: none; transition: opacity 0.15s; }
        .pv-btn:hover { opacity: 0.85; }
      `}</style>

      <div style={{ maxWidth: 900, fontFamily: "Inter,sans-serif", color: "#fff" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>
              🏠 Portal Vendedor
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              Creá un link seguro para que tu cliente vendedor vea el estado de su propiedad.
            </p>
          </div>
          <button className="pv-btn" onClick={() => setMostrarForm(v => !v)}
            style={{ background: mostrarForm ? "rgba(255,255,255,0.08)" : "#cc0000", color: "#fff" }}>
            {mostrarForm ? "✕ Cancelar" : "+ Nuevo portal"}
          </button>
        </div>

        {msg && (
          <div style={{ background: msg.tipo === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.tipo === "ok" ? "#22c55e44" : "#ef444444"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: msg.tipo === "ok" ? "#22c55e" : "#ef4444" }}>
            {msg.texto}
          </div>
        )}

        {/* Formulario nuevo portal */}
        {mostrarForm && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>Nuevo portal</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Nombre del vendedor *</label>
                <input style={inputStyle} placeholder="María García" value={form.vendedor_nombre} onChange={e => setForm(p => ({ ...p, vendedor_nombre: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Título del portal *</label>
                <input style={inputStyle} placeholder="Ej: Seguimiento — Gral. Lagos 1234" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Email del vendedor</label>
                <input style={inputStyle} type="email" placeholder="vendedor@email.com" value={form.vendedor_email} onChange={e => setForm(p => ({ ...p, vendedor_email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input style={inputStyle} placeholder="+54 341..." value={form.vendedor_telefono} onChange={e => setForm(p => ({ ...p, vendedor_telefono: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Etapa actual</label>
                <select style={inputStyle} value={form.etapa_actual} onChange={e => setForm(p => ({ ...p, etapa_actual: e.target.value }))}>
                  {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Vence el (opcional)</label>
                <input style={inputStyle} type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Mensaje de bienvenida</label>
              <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 70 }} placeholder="Estimado/a {nombre}, aquí podrá seguir el progreso de su propiedad..." value={form.mensaje_bienvenida} onChange={e => setForm(p => ({ ...p, mensaje_bienvenida: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="pv-btn" onClick={guardar} disabled={guardando || !form.vendedor_nombre.trim() || !form.titulo.trim()} style={{ background: "#cc0000", color: "#fff", opacity: guardando ? 0.6 : 1 }}>
                {guardando ? "Creando…" : "Crear portal"}
              </button>
              <button className="pv-btn" onClick={() => setMostrarForm(false)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista portales */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>Cargando portales…</div>
        ) : portales.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏠</div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Sin portales creados</div>
            <div style={{ fontSize: 12 }}>Creá un portal para compartirle a tu cliente vendedor</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {portales.map(p => {
              const abierto = portalAbierto === p.id;
              const novsPortal = novedades[p.id] ?? [];
              return (
                <div key={p.id} className="pv-card">
                  {/* Cabecera */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "Montserrat,sans-serif", color: "#fff" }}>{p.titulo}</span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>— {p.vendedor_nombre}</span>
                        {!p.activo && <span style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 4, padding: "1px 6px", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.08em" }}>INACTIVO</span>}
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "rgba(255,255,255,0.35)", flexWrap: "wrap" }}>
                        <span>👁 {p.vistas} vistas</span>
                        <span>📅 {fmtFecha(p.created_at)}</span>
                        {p.etapa_actual && <span style={{ color: "#22c55e" }}>⬤ {p.etapa_actual}</span>}
                        {p.expires_at && <span style={{ color: new Date(p.expires_at) < new Date() ? "#ef4444" : "rgba(255,255,255,0.35)" }}>Vence {fmtFecha(p.expires_at)}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                      <button className="pv-btn" onClick={() => copiarLink(p.token)}
                        style={{ background: copiadoToken === p.token ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", color: copiadoToken === p.token ? "#22c55e" : "rgba(255,255,255,0.6)", border: `1px solid ${copiadoToken === p.token ? "#22c55e44" : "transparent"}` }}>
                        {copiadoToken === p.token ? "✓ Copiado" : "🔗 Link"}
                      </button>
                      <button className="pv-btn" onClick={() => toggleActivo(p)}
                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {p.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button className="pv-btn" onClick={() => abrirPortal(p.id)}
                        style={{ background: abierto ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.04)", color: abierto ? "#cc0000" : "rgba(255,255,255,0.5)", border: `1px solid ${abierto ? "rgba(200,0,0,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                        {abierto ? "▲ Cerrar" : "▼ Gestionar"}
                      </button>
                    </div>
                  </div>

                  {/* Panel expandido */}
                  {abierto && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                        {/* Cambiar etapa */}
                        <div>
                          <label style={labelStyle}>Actualizar etapa</label>
                          <select style={inputStyle} value={p.etapa_actual ?? ""} onChange={e => actualizarEtapa(p, e.target.value)}>
                            {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        </div>
                        {/* Info vendedor */}
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                          <div style={{ marginBottom: 4 }}>{p.vendedor_email && `✉ ${p.vendedor_email}`}</div>
                          <div>{p.vendedor_telefono && `📞 ${p.vendedor_telefono}`}</div>
                          <div style={{ marginTop: 6, wordBreak: "break-all", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                            {window.location.origin}/vendor/{p.token}
                          </div>
                        </div>
                      </div>

                      {/* Agregar novedad */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                          Agregar novedad
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                          {Object.entries(TIPO_NOVEDAD).map(([k, v]) => (
                            <button key={k} onClick={() => setNovForm(prev => ({ ...prev, tipo: k }))}
                              style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "Inter,sans-serif", border: `1px solid ${novForm.tipo === k ? v.color + "88" : "rgba(255,255,255,0.08)"}`, background: novForm.tipo === k ? v.color + "18" : "transparent", color: novForm.tipo === k ? v.color : "rgba(255,255,255,0.4)" }}>
                              {v.icon} {v.label}
                            </button>
                          ))}
                        </div>
                        <input style={{ ...inputStyle, marginBottom: 6 }} placeholder="Título de la novedad..." value={novForm.titulo} onChange={e => setNovForm(prev => ({ ...prev, titulo: e.target.value }))} />
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <textarea style={{ ...inputStyle, flex: 1, resize: "vertical", minHeight: 52 }} placeholder="Detalle (opcional)..." value={novForm.contenido} onChange={e => setNovForm(prev => ({ ...prev, contenido: e.target.value }))} />
                          <button className="pv-btn" onClick={() => guardarNovedad(p.id)} disabled={guardandoNov || !novForm.titulo.trim()}
                            style={{ background: "#cc0000", color: "#fff", opacity: guardandoNov ? 0.6 : 1, flexShrink: 0 }}>
                            {guardandoNov ? "…" : "Agregar"}
                          </button>
                        </div>
                      </div>

                      {/* Historial novedades */}
                      {novsPortal.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                            Historial ({novsPortal.length})
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {novsPortal.map(n => {
                              const tc = TIPO_NOVEDAD[n.tipo] ?? TIPO_NOVEDAD.otro;
                              return (
                                <div key={n.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${tc.color}22`, borderLeft: `3px solid ${tc.color}88`, borderRadius: 6, padding: "8px 12px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{tc.icon} {n.titulo}</span>
                                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmtFecha(n.created_at)}</span>
                                  </div>
                                  {n.contenido && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{n.contenido}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
