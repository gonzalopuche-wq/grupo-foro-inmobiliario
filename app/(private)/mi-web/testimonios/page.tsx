"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Testimonio {
  id: string;
  nombre_cliente: string;
  cargo_cliente: string | null;
  texto: string;
  rating: number;
  activo: boolean;
  orden: number;
  created_at: string;
}

const FORM_VACIO = {
  nombre_cliente: "",
  cargo_cliente: "",
  texto: "",
  rating: 5,
  activo: true,
  orden: 0,
};

export default function TestimoniosPage() {
  const [items, setItems] = useState<Testimonio[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tablaNoExiste, setTablaNoExiste] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mi_web_testimonios")
        .select("*")
        .eq("perfil_id", userId)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === "42P01") setTablaNoExiste(true);
        setItems([]);
      } else {
        setItems((data as Testimonio[]) ?? []);
      }
    } catch { setTablaNoExiste(true); }
    setLoading(false);
  };

  const abrirNuevo = () => {
    setForm({ ...FORM_VACIO, orden: items.length });
    setEditandoId(null);
    setModal(true);
  };

  const abrirEditar = (t: Testimonio) => {
    setForm({
      nombre_cliente: t.nombre_cliente,
      cargo_cliente: t.cargo_cliente ?? "",
      texto: t.texto,
      rating: t.rating,
      activo: t.activo,
      orden: t.orden,
    });
    setEditandoId(t.id);
    setModal(true);
  };

  const cerrar = () => { setModal(false); setEditandoId(null); setForm(FORM_VACIO); };

  const guardar = async () => {
    if (!uid || !form.nombre_cliente.trim() || !form.texto.trim()) return;
    setGuardando(true);
    const payload = {
      perfil_id: uid,
      nombre_cliente: form.nombre_cliente.trim(),
      cargo_cliente: form.cargo_cliente.trim() || null,
      texto: form.texto.trim(),
      rating: form.rating,
      activo: form.activo,
      orden: form.orden,
    };
    if (editandoId) {
      await supabase.from("mi_web_testimonios").update(payload).eq("id", editandoId);
      showToast("Testimonio actualizado");
    } else {
      await supabase.from("mi_web_testimonios").insert(payload);
      showToast("Testimonio agregado");
    }
    cerrar();
    await cargar(uid);
    setGuardando(false);
  };

  const toggleActivo = async (t: Testimonio) => {
    await supabase.from("mi_web_testimonios").update({ activo: !t.activo }).eq("id", t.id);
    setItems(prev => prev.map(i => i.id === t.id ? { ...i, activo: !t.activo } : i));
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este testimonio?")) return;
    await supabase.from("mi_web_testimonios").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    showToast("Testimonio eliminado");
  };

  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>Cargando…</div>;

  if (tablaNoExiste) return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Tabla no creada</div>
      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Ejecutá la migración <code>075_mi_web_testimonios.sql</code> en Supabase.</p>
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 740, margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "var(--gfi-bg-secondary)", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--gfi-bg-secondary)", margin: 0 }}>Testimonios</h1>
            <span style={{ background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
              {items.filter(i => i.activo).length} activos
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Opiniones de clientes que se muestran en tu web pública</p>
        </div>
        <button
          onClick={abrirNuevo}
          style={{ padding: "8px 16px", background: "#990000", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + Nuevo testimonio
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <div style={{ fontWeight: 600, color: "#374151" }}>Aún no hay testimonios</div>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
            Agregá las opiniones de tus clientes para mostrarlas en tu web.
          </p>
          <button onClick={abrirNuevo} style={{ marginTop: 16, padding: "9px 20px", background: "#990000", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Agregar primero
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(t => (
            <div
              key={t.id}
              style={{ background: "#fff", border: `1px solid ${t.activo ? "#e5e7eb" : "#f3f4f6"}`, borderRadius: 10, padding: "16px 20px", opacity: t.activo ? 1 : 0.6, display: "flex", gap: 16, alignItems: "flex-start" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gfi-bg-secondary)" }}>{t.nombre_cliente}</span>
                  {t.cargo_cliente && (
                    <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "1px 7px", borderRadius: 10 }}>{t.cargo_cliente}</span>
                  )}
                  <span style={{ fontSize: 14, color: "#d4960c", letterSpacing: 1 }}>{stars(t.rating)}</span>
                  {!t.activo && <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>OCULTO</span>}
                </div>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0, borderLeft: "3px solid #e5e7eb", paddingLeft: 10 }}>
                  {t.texto}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => toggleActivo(t)}
                  title={t.activo ? "Ocultar" : "Publicar"}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: t.activo ? "#f0fdf4" : "#f9fafb", color: t.activo ? "#22807c" : "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 700 }}
                >
                  {t.activo ? "👁" : "🙈"}
                </button>
                <button
                  onClick={() => abrirEditar(t)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminar(t.id)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #fee2e2", background: "#fff", color: "#dc2626", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && cerrar()}
        >
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--gfi-bg-secondary)", margin: 0 }}>
                {editandoId ? "Editar testimonio" : "Nuevo testimonio"}
              </h2>
              <button onClick={cerrar} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Nombre del cliente *</label>
                <input
                  value={form.nombre_cliente}
                  onChange={e => setForm(f => ({ ...f, nombre_cliente: e.target.value }))}
                  placeholder="Ej: María García"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Rol o contexto</label>
                <input
                  value={form.cargo_cliente}
                  onChange={e => setForm(f => ({ ...f, cargo_cliente: e.target.value }))}
                  placeholder="Ej: Compradora, Vendedor, Inquilino…"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Testimonio *</label>
                <textarea
                  value={form.texto}
                  onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
                  placeholder="Escribí la opinión del cliente…"
                  rows={4}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Calificación</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setForm(f => ({ ...f, rating: n }))}
                      style={{ fontSize: 24, cursor: "pointer", background: "none", border: "none", color: n <= form.rating ? "#d4960c" : "#d1d5db", padding: 0, lineHeight: 1 }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id="activo-check"
                  checked={form.activo}
                  onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="activo-check" style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>Visible en mi web</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={cerrar} style={{ padding: "9px 18px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando || !form.nombre_cliente.trim() || !form.texto.trim()}
                style={{ padding: "9px 20px", borderRadius: 7, background: "#990000", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.7 : 1 }}
              >
                {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
