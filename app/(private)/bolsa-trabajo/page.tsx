"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type TipoContrato = "full" | "part" | "freelance" | "eventual" | "a_convenir";
type TipoOferta = "oferta" | "busqueda";

interface Oferta {
  id: string;
  perfil_id: string | null;
  tipo: TipoOferta;
  titulo: string;
  descripcion: string;
  zona: string | null;
  tipo_contrato: TipoContrato | null;
  remuneracion: string | null;
  requisitos: string | null;
  contacto_email: string | null;
  contacto_tel: string | null;
  activo: boolean;
  destacado: boolean;
  vistas: number;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; foto_url: string | null; matricula: string | null } | null;
}

const CONTRATO_LABEL: Record<TipoContrato, string> = {
  full: "Jornada completa",
  part: "Part-time",
  freelance: "Freelance",
  eventual: "Eventual",
  a_convenir: "A convenir",
};

const EMPTY: Partial<Oferta> = {
  tipo: "oferta",
  titulo: "",
  descripcion: "",
  zona: "",
  tipo_contrato: "a_convenir",
  remuneracion: "",
  requisitos: "",
  contacto_email: "",
  contacto_tel: "",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "#fff",
  fontFamily: "Inter,sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.4)",
  marginBottom: 5,
  fontFamily: "Montserrat,sans-serif",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

export default function BolsaTrabajoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TipoOferta | "todas">("todas");
  const [detalle, setDetalle] = useState<Oferta | null>(null);
  const [form, setForm] = useState<Partial<Oferta>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
      setUid(data.session?.user.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    cargar();
  }, [token]);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/bolsa-trabajo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    setOfertas(d.ofertas ?? []);
    setLoading(false);
  }

  async function guardar() {
    if (!form.tipo || !form.titulo?.trim() || !form.descripcion?.trim()) {
      setError("Completá tipo, título y descripción.");
      return;
    }
    setGuardando(true);
    setError("");
    const res = await fetch("/api/bolsa-trabajo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form }),
    });
    const d = await res.json();
    if (d.error) { setError(d.error); setGuardando(false); return; }
    setShowForm(false);
    setForm(EMPTY);
    cargar();
    setGuardando(false);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Desactivar esta publicación?")) return;
    await fetch("/api/bolsa-trabajo", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    cargar();
  }

  const filtradas = ofertas.filter(o => {
    if (tab !== "todas" && o.tipo !== tab) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return o.titulo.toLowerCase().includes(q) || o.descripcion.toLowerCase().includes(q) || (o.zona ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const TABS: { key: TipoOferta | "todas"; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "oferta", label: "Ofertas de empleo" },
    { key: "busqueda", label: "Búsquedas laborales" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <style>{`
        .bt-card { transition: border-color 0.15s, background 0.15s; }
        .bt-card:hover { border-color: rgba(255,255,255,0.15) !important; background: rgba(255,255,255,0.04) !important; }
        .bt-card:hover .bt-title { color: #fff !important; }
        .bt-input:focus { border-color: rgba(204,0,0,0.5) !important; }
        .bt-btn-ghost:hover { color: rgba(255,255,255,0.8) !important; background: rgba(255,255,255,0.05) !important; }
        .bt-link-email:hover { color: #60a5fa !important; }
        .bt-link-wa:hover { color: #4ade80 !important; }
        .bt-delete:hover { color: #f87171 !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26 }}>💼</span> Bolsa de Trabajo
          </h1>
          <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "6px 0 0" }}>
            Ofertas y búsquedas laborales de la comunidad GFI®
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setShowForm(true); setDetalle(null); }}
          style={{ background: "#cc0000", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}
        >
          + Publicar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total activas", val: ofertas.length },
          { label: "Ofertas empleo", val: ofertas.filter(o => o.tipo === "oferta").length },
          { label: "Búsquedas", val: ofertas.filter(o => o.tipo === "busqueda").length },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 26, fontWeight: 800, color: "#cc0000" }}>{s.val}</div>
            <div style={{ fontFamily: "Inter,sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Buscar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "7px 14px",
                borderRadius: 7,
                fontSize: 12,
                fontFamily: "Inter,sans-serif",
                fontWeight: 500,
                border: "1px solid",
                cursor: "pointer",
                transition: "all 0.15s",
                background: tab === t.key ? "#cc0000" : "rgba(255,255,255,0.04)",
                borderColor: tab === t.key ? "#cc0000" : "rgba(255,255,255,0.1)",
                color: tab === t.key ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar por título, zona..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="bt-input"
          style={{ flex: 1, minWidth: 180, ...inputStyle }}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", fontSize: 14 }}>
          Cargando publicaciones...
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
          <p style={{ fontFamily: "Inter,sans-serif", color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
            No hay publicaciones{tab !== "todas" ? ` de ${tab === "oferta" ? "ofertas" : "búsquedas"}` : ""} aún.
          </p>
          <button
            onClick={() => { setForm(EMPTY); setShowForm(true); }}
            style={{ marginTop: 12, background: "none", border: "none", color: "#cc0000", fontFamily: "Inter,sans-serif", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
          >
            Ser el primero en publicar
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtradas.map(o => (
            <div
              key={o.id}
              className="bt-card"
              onClick={() => setDetalle(o)}
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 600, fontFamily: "Montserrat,sans-serif",
                      background: o.tipo === "oferta" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)",
                      color: o.tipo === "oferta" ? "#60a5fa" : "#4ade80",
                    }}>
                      {o.tipo === "oferta" ? "Oferta" : "Búsqueda"}
                    </span>
                    {o.tipo_contrato && (
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                        {CONTRATO_LABEL[o.tipo_contrato]}
                      </span>
                    )}
                    {o.destacado && <span style={{ fontSize: 11, color: "#facc15", fontFamily: "Inter,sans-serif" }}>⭐ Destacado</span>}
                  </div>
                  <h3 className="bt-title" style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: 15, color: "rgba(255,255,255,0.9)", margin: "0 0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {o.titulo}
                  </h3>
                  <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 8px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {o.descripcion}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                    {o.zona && <span>📍 {o.zona}</span>}
                    {o.remuneracion && <span>💰 {o.remuneracion}</span>}
                    {o.perfiles && <span>👤 {o.perfiles.nombre} {o.perfiles.apellido}</span>}
                    <span>{new Date(o.created_at).toLocaleDateString("es-AR")}</span>
                  </div>
                </div>
                {o.perfil_id === uid && (
                  <button
                    className="bt-delete"
                    onClick={e => { e.stopPropagation(); eliminar(o.id); }}
                    style={{ fontSize: 11, color: "rgba(248,113,113,0.6)", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", flexShrink: 0, transition: "color 0.15s" }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 600, padding: 28, overflowY: "auto", maxHeight: "90vh" }}>
            <h2 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 20px" }}>
              {form.id ? "Editar publicación" : "Nueva publicación"}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoOferta }))}
                  className="bt-input"
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="oferta">Oferta de empleo</option>
                  <option value="busqueda">Búsqueda laboral</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo de contrato</label>
                <select
                  value={form.tipo_contrato ?? "a_convenir"}
                  onChange={e => setForm(f => ({ ...f, tipo_contrato: e.target.value as TipoContrato }))}
                  className="bt-input"
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  {Object.entries(CONTRATO_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Título *</label>
              <input
                type="text"
                value={form.titulo ?? ""}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej: Asistente inmobiliaria zona norte"
                className="bt-input"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Descripción *</label>
              <textarea
                value={form.descripcion ?? ""}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                rows={4}
                placeholder="Describí el puesto o el perfil que buscás..."
                className="bt-input"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Zona</label>
                <input
                  type="text"
                  value={form.zona ?? ""}
                  onChange={e => setForm(f => ({ ...f, zona: e.target.value }))}
                  placeholder="Ej: Centro, Norte Rosario"
                  className="bt-input"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Remuneración</label>
                <input
                  type="text"
                  value={form.remuneracion ?? ""}
                  onChange={e => setForm(f => ({ ...f, remuneracion: e.target.value }))}
                  placeholder="Ej: $300.000 / a convenir"
                  className="bt-input"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Requisitos</label>
              <textarea
                value={form.requisitos ?? ""}
                onChange={e => setForm(f => ({ ...f, requisitos: e.target.value }))}
                rows={2}
                placeholder="Ej: Experiencia en atención al cliente, manejo de redes sociales..."
                className="bt-input"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Email de contacto</label>
                <input
                  type="email"
                  value={form.contacto_email ?? ""}
                  onChange={e => setForm(f => ({ ...f, contacto_email: e.target.value }))}
                  className="bt-input"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Teléfono de contacto</label>
                <input
                  type="text"
                  value={form.contacto_tel ?? ""}
                  onChange={e => setForm(f => ({ ...f, contacto_tel: e.target.value }))}
                  className="bt-input"
                  style={inputStyle}
                />
              </div>
            </div>

            {error && <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "#f87171", marginBottom: 14 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="bt-btn-ghost"
                onClick={() => { setShowForm(false); setError(""); }}
                style={{ padding: "9px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter,sans-serif", cursor: "pointer", transition: "all 0.15s" }}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                style={{ padding: "9px 22px", background: guardando ? "rgba(204,0,0,0.5)" : "#cc0000", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer" }}
              >
                {guardando ? "Guardando..." : form.id ? "Actualizar" : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 620, padding: 28, overflowY: "auto", maxHeight: "90vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <span style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 20, fontWeight: 700, fontFamily: "Montserrat,sans-serif",
                background: detalle.tipo === "oferta" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)",
                color: detalle.tipo === "oferta" ? "#60a5fa" : "#4ade80",
              }}>
                {detalle.tipo === "oferta" ? "Oferta de empleo" : "Búsqueda laboral"}
              </span>
              <button onClick={() => setDetalle(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            <h2 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
              {detalle.titulo}
            </h2>

            {detalle.perfiles && (
              <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "0 0 16px" }}>
                Publicado por {detalle.perfiles.nombre} {detalle.perfiles.apellido}
                {detalle.perfiles.matricula ? ` · Mat. ${detalle.perfiles.matricula}` : ""}
              </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {detalle.tipo_contrato && (
                <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif" }}>
                  {CONTRATO_LABEL[detalle.tipo_contrato]}
                </span>
              )}
              {detalle.zona && (
                <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif" }}>
                  📍 {detalle.zona}
                </span>
              )}
              {detalle.remuneracion && (
                <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif" }}>
                  💰 {detalle.remuneracion}
                </span>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }}>Descripción</h3>
              <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{detalle.descripcion}</p>
            </div>

            {detalle.requisitos && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }}>Requisitos</h3>
                <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{detalle.requisitos}</p>
              </div>
            )}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
              <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>Contacto</h3>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {detalle.contacto_email && (
                  <a
                    href={`mailto:${detalle.contacto_email}`}
                    className="bt-link-email"
                    style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "#60a5fa", textDecoration: "none", transition: "color 0.15s" }}
                  >
                    ✉ {detalle.contacto_email}
                  </a>
                )}
                {detalle.contacto_tel && (
                  <a
                    href={`https://wa.me/${detalle.contacto_tel.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bt-link-wa"
                    style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "#4ade80", textDecoration: "none", transition: "color 0.15s" }}
                  >
                    💬 {detalle.contacto_tel}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
