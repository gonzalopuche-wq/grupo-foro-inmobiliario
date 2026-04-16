"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const ESPECIALIDADES_OPCIONES = [
  "Residencial", "Comercial", "Alquileres", "Ventas", "Tasaciones",
  "Permuta", "Campos y Rurales", "Desarrollos", "Inversiones", "Temporario",
];

interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  dni: string | null;
  telefono: string | null;
  matricula: string | null;
  inmobiliaria: string | null;
  especialidades: string[] | null;
  tipo: string;
  estado: string;
  created_at: string;
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    inmobiliaria: "",
    especialidades: [] as string[],
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      setEmail(session.user.email ?? "");

      const { data: p } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (p) {
        setPerfil(p as Perfil);
        setForm({
          nombre: p.nombre ?? "",
          apellido: p.apellido ?? "",
          telefono: p.telefono ?? "",
          inmobiliaria: p.inmobiliaria ?? "",
          especialidades: p.especialidades ?? [],
        });
      }
      setLoading(false);
    };
    init();
  }, []);

  const toggleEspecialidad = (e: string) => {
    setForm(prev => ({
      ...prev,
      especialidades: prev.especialidades.includes(e)
        ? prev.especialidades.filter(x => x !== e)
        : [...prev.especialidades, e],
    }));
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }
    if (!perfil) return;
    setGuardando(true);
    setError("");

    const { error: err } = await supabase.from("perfiles").update({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      telefono: form.telefono.trim() || null,
      inmobiliaria: form.inmobiliaria.trim() || null,
      especialidades: form.especialidades.length > 0 ? form.especialidades : null,
    }).eq("id", perfil.id);

    setGuardando(false);
    if (err) { setError("Error al guardar. Intentá de nuevo."); return; }

    setPerfil(prev => prev ? { ...prev, ...form } : prev);
    setEditando(false);
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 3000);
  };

  const estadoBadge = (estado: string) => {
    if (estado === "aprobado") return { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", color: "#22c55e", label: "Aprobado" };
    if (estado === "pendiente") return { bg: "rgba(234,179,8,0.07)", border: "rgba(234,179,8,0.3)", color: "#eab308", label: "Pendiente" };
    if (estado === "rechazado") return { bg: "rgba(200,0,0,0.08)", border: "rgba(200,0,0,0.3)", color: "#ff4444", label: "Rechazado" };
    return { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", label: estado };
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div style={{ padding: "64px 32px", textAlign: "center", color: "rgba(255,255,255,0.2)" }}>
        Cargando...
      </div>
    );
  }

  if (!perfil) return null;

  const badge = estadoBadge(perfil.estado);

  return (
    <>
      <style>{`
        .pf-max { max-width: 680px; display: flex; flex-direction: column; gap: 18px; }
        .pf-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 24px; }
        .pf-card-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; }
        .pf-header { display: flex; align-items: center; gap: 18px; }
        .pf-avatar { width: 56px; height: 56px; background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.25); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; color: #cc0000; flex-shrink: 0; }
        .pf-nombre { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .pf-mat { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 3px; }
        .pf-estado { display: inline-block; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; margin-top: 5px; }
        .pf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .pf-item { }
        .pf-item-label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 4px; }
        .pf-item-valor { font-size: 13px; color: rgba(255,255,255,0.8); }
        .pf-edit-btn { padding: 6px 14px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .pf-edit-btn:hover { border-color: rgba(200,0,0,0.4); color: #fff; }
        .pf-field { margin-bottom: 14px; }
        .pf-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-family: 'Montserrat', sans-serif; }
        .pf-label span { color: #cc0000; margin-left: 2px; }
        .pf-input { width: 100%; padding: 9px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .pf-input:focus { border-color: rgba(200,0,0,0.4); }
        .pf-input::placeholder { color: rgba(255,255,255,0.2); }
        .pf-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .pf-esp-grid { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 4px; }
        .pf-esp-tag { padding: 5px 12px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; }
        .pf-esp-tag.activo { border-color: rgba(200,0,0,0.5); background: rgba(200,0,0,0.1); color: #fff; }
        .pf-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 10px 12px; margin-bottom: 12px; }
        .pf-ok { font-size: 12px; color: #22c55e; background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.2); border-radius: 3px; padding: 10px 12px; margin-bottom: 12px; }
        .pf-btn-row { display: flex; gap: 10px; margin-top: 6px; }
        .pf-btn-save { flex: 2; padding: 11px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; }
        .pf-btn-save:hover:not(:disabled) { background: #e60000; }
        .pf-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .pf-btn-cancel { flex: 1; padding: 11px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .pf-read-only { font-size: 11px; color: rgba(255,255,255,0.25); margin-top: 6px; font-style: italic; }
        @media (max-width: 600px) { .pf-grid { grid-template-columns: 1fr; } .pf-form-row { grid-template-columns: 1fr; } }
      `}</style>

      <div className="pf-max">

        {/* Header */}
        <div className="pf-card">
          <div className="pf-header">
            <div className="pf-avatar">
              {perfil.nombre?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div style={{ flex: 1 }}>
              <div className="pf-nombre">{perfil.apellido}, {perfil.nombre}</div>
              {perfil.matricula && (
                <div className="pf-mat">Matrícula {perfil.matricula}</div>
              )}
              <span
                className="pf-estado"
                style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}
              >
                {badge.label}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat',sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Desde
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {formatFecha(perfil.created_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Info / Edición */}
        <div className="pf-card">
          <div className="pf-card-titulo">
            Información personal
            {!editando && (
              <button className="pf-edit-btn" onClick={() => setEditando(true)}>
                Editar
              </button>
            )}
          </div>

          {guardadoOk && <div className="pf-ok">✅ Cambios guardados correctamente.</div>}

          {editando ? (
            <>
              <div className="pf-form-row">
                <div className="pf-field">
                  <label className="pf-label">Nombre <span>*</span></label>
                  <input
                    className="pf-input"
                    value={form.nombre}
                    onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Apellido <span>*</span></label>
                  <input
                    className="pf-input"
                    value={form.apellido}
                    onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))}
                  />
                </div>
              </div>

              <div className="pf-form-row">
                <div className="pf-field">
                  <label className="pf-label">Teléfono / WhatsApp</label>
                  <input
                    className="pf-input"
                    placeholder="Ej: +54 9 341 000 0000"
                    value={form.telefono}
                    onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                  />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Inmobiliaria / Empresa</label>
                  <input
                    className="pf-input"
                    placeholder="Nombre de tu inmobiliaria"
                    value={form.inmobiliaria}
                    onChange={e => setForm(p => ({ ...p, inmobiliaria: e.target.value }))}
                  />
                </div>
              </div>

              <div className="pf-field">
                <label className="pf-label">Especialidades</label>
                <div className="pf-esp-grid">
                  {ESPECIALIDADES_OPCIONES.map(e => (
                    <button
                      key={e}
                      type="button"
                      className={`pf-esp-tag${form.especialidades.includes(e) ? " activo" : ""}`}
                      onClick={() => toggleEspecialidad(e)}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="pf-error">{error}</div>}

              <div className="pf-btn-row">
                <button className="pf-btn-save" onClick={handleGuardar} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  className="pf-btn-cancel"
                  onClick={() => {
                    setEditando(false);
                    setError("");
                    setForm({
                      nombre: perfil.nombre ?? "",
                      apellido: perfil.apellido ?? "",
                      telefono: perfil.telefono ?? "",
                      inmobiliaria: perfil.inmobiliaria ?? "",
                      especialidades: perfil.especialidades ?? [],
                    });
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div className="pf-grid">
              <div className="pf-item">
                <div className="pf-item-label">Nombre completo</div>
                <div className="pf-item-valor">{perfil.apellido}, {perfil.nombre}</div>
              </div>
              <div className="pf-item">
                <div className="pf-item-label">Email</div>
                <div className="pf-item-valor">{email || "—"}</div>
              </div>
              <div className="pf-item">
                <div className="pf-item-label">Teléfono</div>
                <div className="pf-item-valor">{perfil.telefono || "—"}</div>
              </div>
              <div className="pf-item">
                <div className="pf-item-label">Inmobiliaria</div>
                <div className="pf-item-valor">{perfil.inmobiliaria || "—"}</div>
              </div>
              {perfil.dni && (
                <div className="pf-item">
                  <div className="pf-item-label">DNI</div>
                  <div className="pf-item-valor">{perfil.dni}</div>
                </div>
              )}
              {perfil.matricula && (
                <div className="pf-item">
                  <div className="pf-item-label">Matrícula COCIR</div>
                  <div className="pf-item-valor">{perfil.matricula}</div>
                </div>
              )}
              {perfil.especialidades && perfil.especialidades.length > 0 && (
                <div className="pf-item" style={{ gridColumn: "1 / -1" }}>
                  <div className="pf-item-label">Especialidades</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {perfil.especialidades.map(e => (
                      <span
                        key={e}
                        style={{
                          padding: "3px 10px", borderRadius: 3,
                          background: "rgba(200,0,0,0.08)",
                          border: "1px solid rgba(200,0,0,0.2)",
                          color: "rgba(255,255,255,0.7)", fontSize: 11,
                        }}
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tipo y cuenta */}
        <div className="pf-card">
          <div className="pf-card-titulo">Cuenta</div>
          <div className="pf-grid">
            <div className="pf-item">
              <div className="pf-item-label">Tipo de cuenta</div>
              <div className="pf-item-valor" style={{ textTransform: "capitalize" }}>
                {perfil.tipo === "corredor" ? "Corredor Inmobiliario" :
                 perfil.tipo === "colaborador" ? "Colaborador" :
                 perfil.tipo === "admin" ? "Administrador" : perfil.tipo}
              </div>
            </div>
            <div className="pf-item">
              <div className="pf-item-label">Estado de cuenta</div>
              <div>
                <span
                  style={{
                    fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 10px",
                    borderRadius: 20, background: badge.bg,
                    border: `1px solid ${badge.border}`, color: badge.color,
                  }}
                >
                  {badge.label}
                </span>
              </div>
            </div>
          </div>
          <div className="pf-read-only">
            El email y la matrícula solo pueden ser modificados por el administrador.
            Para cambiar tu contraseña, cerrá sesión y usá "Olvidé mi contraseña".
          </div>
        </div>

      </div>
    </>
  );
}
