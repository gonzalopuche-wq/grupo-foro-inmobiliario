"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Entrada {
  id: string;
  nombre: string;
  documento: string | null;
  tipo: string;
  motivo: string;
  nivel: string;
  alerta: boolean;
  notas: string | null;
  created_at: string;
}

const NIVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bajo:  { label: "Bajo",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  medio: { label: "Medio", color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  alto:  { label: "Alto",  color: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
};

const TIPO_CONFIG: Record<string, { label: string; icon: string }> = {
  persona:  { label: "Persona",  icon: "👤" },
  empresa:  { label: "Empresa",  icon: "🏢" },
};

const FORM_VACIO = {
  nombre: "", documento: "", tipo: "persona",
  motivo: "", nivel: "medio", alerta: true, notas: "",
};

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

export default function ListaNegraPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroNivel, setFiltroNivel] = useState<string>("todos");
  const [eliminando, setEliminando] = useState<string | null>(null);

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
      .from("crm_lista_negra")
      .select("*")
      .eq("perfil_id", userId)
      .order("created_at", { ascending: false });
    setEntradas(data ?? []);
    setLoading(false);
  };

  const guardar = async () => {
    if (!uid || !form.nombre.trim() || !form.motivo.trim()) return;
    setGuardando(true);
    const { error } = await supabase.from("crm_lista_negra").insert({
      perfil_id: uid,
      nombre: form.nombre.trim(),
      documento: form.documento.trim() || null,
      tipo: form.tipo,
      motivo: form.motivo.trim(),
      nivel: form.nivel,
      alerta: form.alerta,
      notas: form.notas.trim() || null,
    });
    setGuardando(false);
    if (error) {
      setMsg({ tipo: "err", texto: "Error al guardar. Intentá de nuevo." });
    } else {
      setMsg({ tipo: "ok", texto: "Entrada agregada a la lista negra." });
      setForm(FORM_VACIO);
      setMostrarForm(false);
      cargar(uid);
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const eliminar = async (id: string) => {
    if (!uid) return;
    setEliminando(id);
    await supabase.from("crm_lista_negra").delete().eq("id", id).eq("perfil_id", uid);
    setEntradas(prev => prev.filter(e => e.id !== id));
    setEliminando(null);
  };

  const toggleAlerta = async (entrada: Entrada) => {
    if (!uid) return;
    await supabase
      .from("crm_lista_negra")
      .update({ alerta: !entrada.alerta })
      .eq("id", entrada.id)
      .eq("perfil_id", uid);
    setEntradas(prev => prev.map(e => e.id === entrada.id ? { ...e, alerta: !e.alerta } : e));
  };

  const entradasFiltradas = entradas.filter(e => {
    const matchBusq = !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.motivo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (e.documento ?? "").includes(busqueda);
    const matchNivel = filtroNivel === "todos" || e.nivel === filtroNivel;
    return matchBusq && matchNivel;
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7, padding: "9px 12px", color: "#fff", fontFamily: "Inter,sans-serif",
    fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)",
    fontFamily: "Montserrat,sans-serif", letterSpacing: "0.08em",
    textTransform: "uppercase", marginBottom: 4, display: "block",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .ln-row { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; transition: border-color 0.15s; }
        .ln-row:hover { border-color: rgba(255,255,255,0.1); }
        .ln-btn { padding: 7px 16px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: Montserrat,sans-serif; border: none; transition: opacity 0.15s; }
        .ln-btn:hover { opacity: 0.85; }
      `}</style>

      <div style={{ maxWidth: 860, fontFamily: "Inter,sans-serif", color: "#fff" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>
              🚫 Lista Negra
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              Personas o empresas con las que no querés trabajar. Se usan para alertarte en CRM y MIR.
            </p>
          </div>
          <button
            className="ln-btn"
            onClick={() => setMostrarForm(v => !v)}
            style={{ background: mostrarForm ? "rgba(255,255,255,0.08)" : "#cc0000", color: "#fff" }}
          >
            {mostrarForm ? "✕ Cancelar" : "+ Agregar"}
          </button>
        </div>

        {/* Mensaje */}
        {msg && (
          <div style={{ background: msg.tipo === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.tipo === "ok" ? "#22c55e44" : "#ef444444"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: msg.tipo === "ok" ? "#22c55e" : "#ef4444", fontFamily: "Inter,sans-serif" }}>
            {msg.texto}
          </div>
        )}

        {/* Formulario */}
        {mostrarForm && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>
              Nueva entrada
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Nombre / Razón social *</label>
                <input style={inputStyle} placeholder="Juan Pérez" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>DNI / CUIT</label>
                <input style={inputStyle} placeholder="20-12345678-9" value={form.documento} onChange={e => setForm(p => ({ ...p, documento: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select style={inputStyle} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="persona">Persona</option>
                  <option value="empresa">Empresa</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Nivel de alerta</label>
                <select style={inputStyle} value={form.nivel} onChange={e => setForm(p => ({ ...p, nivel: e.target.value }))}>
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Motivo *</label>
              <input style={inputStyle} placeholder="Ej: No pagó comisión, conflicto de ética, etc." value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Notas adicionales</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                placeholder="Detalles adicionales..."
                value={form.notas}
                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <input
                type="checkbox"
                id="alerta-check"
                checked={form.alerta}
                onChange={e => setForm(p => ({ ...p, alerta: e.target.checked }))}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <label htmlFor="alerta-check" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "Inter,sans-serif" }}>
                Activar alerta cuando esta persona aparezca en CRM o MIR
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="ln-btn"
                onClick={guardar}
                disabled={guardando || !form.nombre.trim() || !form.motivo.trim()}
                style={{ background: "#cc0000", color: "#fff", opacity: guardando ? 0.6 : 1 }}
              >
                {guardando ? "Guardando…" : "Agregar a lista negra"}
              </button>
              <button className="ln-btn" onClick={() => setMostrarForm(false)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inputStyle, width: 240, flex: "0 0 auto" }}
            placeholder="Buscar nombre, motivo, documento…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {["todos", "bajo", "medio", "alto"].map(n => (
            <button
              key={n}
              onClick={() => setFiltroNivel(n)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                fontFamily: "Montserrat,sans-serif", cursor: "pointer", border: "1px solid",
                borderColor: filtroNivel === n ? (n === "todos" ? "#cc0000" : NIVEL_CONFIG[n]?.color ?? "#cc0000") : "rgba(255,255,255,0.1)",
                background: filtroNivel === n ? (n === "todos" ? "rgba(200,0,0,0.15)" : NIVEL_CONFIG[n]?.bg ?? "rgba(200,0,0,0.15)") : "transparent",
                color: filtroNivel === n ? "#fff" : "rgba(255,255,255,0.4)",
                textTransform: "capitalize",
              }}
            >
              {n === "todos" ? "Todos" : NIVEL_CONFIG[n]?.label}
            </button>
          ))}
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", marginLeft: "auto" }}>
            {entradasFiltradas.length} entrada{entradasFiltradas.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.3)" }}>Cargando…</div>
        ) : entradasFiltradas.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif" }}>
            {entradas.length === 0 ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🚫</div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>Tu lista negra está vacía</div>
                <div style={{ fontSize: 12 }}>Agregá personas o empresas para evitar trabajar con ellas</div>
              </>
            ) : "Sin resultados para los filtros aplicados"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entradasFiltradas.map(e => {
              const nivel = NIVEL_CONFIG[e.nivel] ?? NIVEL_CONFIG.medio;
              const tipo = TIPO_CONFIG[e.tipo] ?? TIPO_CONFIG.persona;
              return (
                <div key={e.id} className="ln-row">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Icono tipo */}
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      {tipo.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#fff", fontFamily: "Montserrat,sans-serif" }}>
                          {e.nombre}
                        </span>
                        {e.documento && (
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                            {e.documento}
                          </span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "Montserrat,sans-serif", letterSpacing: "0.08em", color: nivel.color, background: nivel.bg, border: `1px solid ${nivel.color}44`, borderRadius: 4, padding: "2px 7px" }}>
                          {nivel.label.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>
                          {tipo.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: e.notas ? 4 : 0 }}>
                        {e.motivo}
                      </div>
                      {e.notas && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                          {e.notas}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                        Agregado {fmtFecha(e.created_at)}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => toggleAlerta(e)}
                        title={e.alerta ? "Alerta activa — clic para desactivar" : "Alerta desactivada — clic para activar"}
                        style={{ background: e.alerta ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${e.alerta ? "#ef444444" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: e.alerta ? "#ef4444" : "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}
                      >
                        {e.alerta ? "🔔 Alerta" : "🔕 Sin alerta"}
                      </button>
                      <button
                        onClick={() => eliminar(e.id)}
                        disabled={eliminando === e.id}
                        title="Eliminar de lista negra"
                        style={{ background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", opacity: eliminando === e.id ? 0.5 : 1 }}
                      >
                        {eliminando === e.id ? "…" : "✕"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {entradas.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", textAlign: "center" }}>
            Esta lista es privada — solo vos podés verla. Las alertas te avisarán si una persona aparece en tu CRM.
          </div>
        )}
      </div>
    </>
  );
}
