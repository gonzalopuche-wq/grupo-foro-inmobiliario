"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Llave {
  id: string;
  propiedad_id: string | null;
  titulo: string;
  responsable_nombre: string;
  responsable_telefono: string | null;
  responsable_tipo: string;
  fecha_entrega: string;
  fecha_devolucion: string | null;
  devuelta: boolean;
  fecha_devolucion_real: string | null;
  notas: string | null;
  created_at: string;
}

interface Propiedad {
  id: string;
  titulo: string;
  direccion: string | null;
}

const TIPO_OPCIONES = ["cliente", "colega", "propietario", "otro"];

const FORM_VACIO = {
  propiedad_id: "",
  titulo: "",
  responsable_nombre: "",
  responsable_telefono: "",
  responsable_tipo: "cliente",
  fecha_entrega: new Date().toISOString().slice(0, 10),
  fecha_devolucion: "",
  notas: "",
};

export default function LlavesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [llaves, setLlaves] = useState<Llave[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof FORM_VACIO>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState<"pendientes" | "todas">("pendientes");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = "/login"; return; }
      const uid = auth.user.id;
      setUserId(uid);
      await cargar(uid);
      const { data: props } = await supabase
        .from("cartera_propiedades")
        .select("id,titulo,direccion")
        .eq("perfil_id", uid)
        .eq("estado", "activa")
        .order("titulo");
      setPropiedades((props ?? []) as Propiedad[]);
      setLoading(false);
    };
    init();
  }, []);

  const cargar = async (uid: string) => {
    const { data } = await supabase
      .from("crm_llaves")
      .select("*")
      .eq("perfil_id", uid)
      .order("fecha_entrega", { ascending: false });
    setLlaves((data ?? []) as Llave[]);
  };

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const abrirNueva = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setMostrarForm(true);
  };

  const abrirEditar = (l: Llave) => {
    setEditandoId(l.id);
    setForm({
      propiedad_id: l.propiedad_id ?? "",
      titulo: l.titulo,
      responsable_nombre: l.responsable_nombre,
      responsable_telefono: l.responsable_telefono ?? "",
      responsable_tipo: l.responsable_tipo,
      fecha_entrega: l.fecha_entrega,
      fecha_devolucion: l.fecha_devolucion ?? "",
      notas: l.notas ?? "",
    });
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!userId || !form.titulo || !form.responsable_nombre) return;
    setGuardando(true);
    const datos = {
      perfil_id: userId,
      propiedad_id: form.propiedad_id || null,
      titulo: form.titulo,
      responsable_nombre: form.responsable_nombre,
      responsable_telefono: form.responsable_telefono || null,
      responsable_tipo: form.responsable_tipo,
      fecha_entrega: form.fecha_entrega,
      fecha_devolucion: form.fecha_devolucion || null,
      notas: form.notas || null,
      updated_at: new Date().toISOString(),
    };
    if (editandoId) {
      await supabase.from("crm_llaves").update(datos).eq("id", editandoId);
    } else {
      await supabase.from("crm_llaves").insert(datos);
    }
    setGuardando(false);
    setMostrarForm(false);
    mostrarToast(editandoId ? "Llave actualizada" : "Llave registrada");
    await cargar(userId);
  };

  const marcarDevuelta = async (id: string) => {
    if (!userId) return;
    await supabase.from("crm_llaves").update({
      devuelta: true,
      fecha_devolucion_real: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    mostrarToast("Marcada como devuelta");
    await cargar(userId);
  };

  const eliminar = async (id: string) => {
    if (!userId || !confirm("¿Eliminar este registro de llave?")) return;
    await supabase.from("crm_llaves").delete().eq("id", id);
    mostrarToast("Eliminada");
    await cargar(userId);
  };

  const llavesVisibles = useMemo(() => {
    if (filtro === "pendientes") return llaves.filter(l => !l.devuelta);
    return llaves;
  }, [llaves, filtro]);

  const ahora = new Date();
  const vencidas = llavesVisibles.filter(l => !l.devuelta && l.fecha_devolucion && new Date(l.fecha_devolucion) < ahora);
  const proximas = llavesVisibles.filter(l => !l.devuelta && l.fecha_devolucion && new Date(l.fecha_devolucion) >= ahora && new Date(l.fecha_devolucion) <= new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000));

  const diasRestantes = (fecha: string) => {
    const d = Math.ceil((new Date(fecha).getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
    return d;
  };

  const propLabel = (id: string | null) => {
    if (!id) return null;
    const p = propiedades.find(x => x.id === id);
    return p ? (p.titulo || p.direccion || "Propiedad") : null;
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.2)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .lv-root { display: flex; flex-direction: column; gap: 0; }
        .lv-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 0 14px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; gap: 10px; }
        .lv-titulo { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .lv-titulo span { color: #cc0000; }
        .lv-tabs { display: flex; gap: 6px; margin: 14px 0; }
        .lv-tab { padding: 7px 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; }
        .lv-tab.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .lv-btn-nueva { padding: 9px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .lv-btn-nueva:hover { background: #e60000; }
        .lv-alerta { padding: 12px 18px; border-radius: 6px; margin-bottom: 8px; font-size: 12px; line-height: 1.5; }
        .lv-alerta.vencida { background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); color: #ff6b6b; }
        .lv-alerta.proxima { background: rgba(234,179,8,0.07); border: 1px solid rgba(234,179,8,0.2); color: #eab308; }
        .lv-lista { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
        .lv-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 16px 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; transition: border-color 0.15s; }
        .lv-card:hover { border-color: rgba(255,255,255,0.12); }
        .lv-card.vencida { border-color: rgba(200,0,0,0.3); background: rgba(200,0,0,0.04); }
        .lv-card.devuelta { opacity: 0.5; }
        .lv-info { flex: 1; min-width: 0; }
        .lv-prop { font-size: 10px; color: #cc0000; font-family: 'Montserrat',sans-serif; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.06em; text-transform: uppercase; }
        .lv-titulo-card { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .lv-resp { font-size: 12px; color: rgba(255,255,255,0.5); }
        .lv-fechas { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 4px; }
        .lv-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-left: 6px; }
        .lv-badge.vencida { background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.25); color: #ff6b6b; }
        .lv-badge.proxima { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.25); color: #eab308; }
        .lv-badge.devuelta { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); color: #22c55e; }
        .lv-acciones { display: flex; gap: 6px; flex-shrink: 0; flex-direction: column; align-items: flex-end; }
        .lv-btn { padding: 6px 12px; border-radius: 4px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 1px solid transparent; white-space: nowrap; }
        .lv-btn.devolver { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.25); color: #22c55e; }
        .lv-btn.devolver:hover { background: rgba(34,197,94,0.2); }
        .lv-btn.editar { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); }
        .lv-btn.editar:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .lv-btn.eliminar { background: transparent; border-color: rgba(200,0,0,0.2); color: rgba(200,0,0,0.5); }
        .lv-btn.eliminar:hover { border-color: rgba(200,0,0,0.5); color: #ff4444; }
        .lv-empty { text-align: center; padding: 48px 24px; color: rgba(255,255,255,0.2); font-size: 13px; }
        .lv-empty-ico { font-size: 36px; margin-bottom: 12px; }
        /* Modal */
        .lv-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
        .lv-modal { background: #111; border: 1px solid rgba(200,0,0,0.2); border-radius: 10px; padding: 28px; width: 100%; max-width: 480px; position: relative; }
        .lv-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 10px 10px 0 0; }
        .lv-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .lv-modal-titulo span { color: #cc0000; }
        .lv-field { margin-bottom: 14px; }
        .lv-label { display: block; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
        .lv-input { width: 100%; padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .lv-input:focus { border-color: rgba(200,0,0,0.4); }
        .lv-input::placeholder { color: rgba(255,255,255,0.2); }
        .lv-select { width: 100%; padding: 10px 13px; background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .lv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .lv-modal-acciones { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .lv-btn-cancelar { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .lv-btn-guardar { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .lv-btn-guardar:hover { background: #e60000; }
        .lv-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
        .toast-lv { position: fixed; bottom: 24px; right: 24px; background: #22c55e; color: #fff; padding: 12px 20px; border-radius: 6px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; z-index: 9999; animation: slideup 0.3s ease; }
        @keyframes slideup { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div className="lv-root">
        <div className="lv-header">
          <div>
            <div className="lv-titulo">🔑 Gestión de <span>Llaves</span></div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
              Registrá a quién entregaste las llaves de cada propiedad y controlá su devolución
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/crm/cartera" style={{ padding: "7px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>← Cartera</Link>
            <button className="lv-btn-nueva" onClick={abrirNueva}>+ Registrar entrega</button>
          </div>
        </div>

        {/* Alertas vencidas */}
        {vencidas.length > 0 && (
          <div className="lv-alerta vencida" style={{ marginTop: 14 }}>
            🔴 <strong>{vencidas.length} llave{vencidas.length > 1 ? "s" : ""} con devolución vencida:</strong>{" "}
            {vencidas.map(l => `${l.titulo} (${l.responsable_nombre})`).join(", ")}
          </div>
        )}
        {proximas.length > 0 && (
          <div className="lv-alerta proxima" style={{ marginTop: vencidas.length > 0 ? 6 : 14 }}>
            ⚠️ <strong>{proximas.length} llave{proximas.length > 1 ? "s" : ""} a devolver en los próximos 3 días:</strong>{" "}
            {proximas.map(l => `${l.titulo}`).join(", ")}
          </div>
        )}

        <div className="lv-tabs">
          <button className={`lv-tab${filtro === "pendientes" ? " activo" : ""}`} onClick={() => setFiltro("pendientes")}>
            Pendientes de devolución ({llaves.filter(l => !l.devuelta).length})
          </button>
          <button className={`lv-tab${filtro === "todas" ? " activo" : ""}`} onClick={() => setFiltro("todas")}>
            Todas ({llaves.length})
          </button>
        </div>

        {llavesVisibles.length === 0 ? (
          <div className="lv-empty">
            <div className="lv-empty-ico">🔑</div>
            {filtro === "pendientes" ? "No hay llaves pendientes de devolución." : "No hay registros de llaves. Hacé clic en + Registrar entrega."}
          </div>
        ) : (
          <div className="lv-lista">
            {llavesVisibles.map(l => {
              const dias = l.fecha_devolucion ? diasRestantes(l.fecha_devolucion) : null;
              const esVencida = !l.devuelta && dias !== null && dias < 0;
              const esProxima = !l.devuelta && dias !== null && dias >= 0 && dias <= 3;
              return (
                <div key={l.id} className={`lv-card${esVencida ? " vencida" : ""}${l.devuelta ? " devuelta" : ""}`}>
                  <div className="lv-info">
                    {propLabel(l.propiedad_id) && (
                      <div className="lv-prop">🏠 {propLabel(l.propiedad_id)}</div>
                    )}
                    <div className="lv-titulo-card">
                      {l.titulo}
                      {l.devuelta && <span className="lv-badge devuelta">✓ Devuelta</span>}
                      {!l.devuelta && esVencida && <span className="lv-badge vencida">Vencida {Math.abs(dias!)}d</span>}
                      {!l.devuelta && esProxima && <span className="lv-badge proxima">Devolver en {dias}d</span>}
                    </div>
                    <div className="lv-resp">
                      👤 {l.responsable_nombre}
                      {l.responsable_telefono && (
                        <a href={`https://wa.me/${l.responsable_telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft: 8, color: "#25d366", fontSize: 11, textDecoration: "none" }}>
                          📲 WhatsApp
                        </a>
                      )}
                      <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "capitalize" }}>({l.responsable_tipo})</span>
                    </div>
                    <div className="lv-fechas">
                      Entregada: {new Date(l.fecha_entrega).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      {l.fecha_devolucion && ` · Devolver: ${new Date(l.fecha_devolucion).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
                      {l.fecha_devolucion_real && ` · Devuelta: ${new Date(l.fecha_devolucion_real).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
                    </div>
                    {l.notas && <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>{l.notas}</div>}
                  </div>
                  <div className="lv-acciones">
                    {!l.devuelta && (
                      <button className="lv-btn devolver" onClick={() => marcarDevuelta(l.id)}>✓ Devuelta</button>
                    )}
                    <button className="lv-btn editar" onClick={() => abrirEditar(l)}>✏ Editar</button>
                    <button className="lv-btn eliminar" onClick={() => eliminar(l.id)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nueva/editar llave */}
      {mostrarForm && (
        <div className="lv-modal-bg" onClick={() => setMostrarForm(false)}>
          <div className="lv-modal" onClick={e => e.stopPropagation()}>
            <div className="lv-modal-titulo">{editandoId ? "Editar" : "Registrar"} <span>entrega de llave</span></div>

            {propiedades.length > 0 && (
              <div className="lv-field">
                <label className="lv-label">Propiedad (opcional)</label>
                <select className="lv-select" value={form.propiedad_id} onChange={e => setForm(f => ({ ...f, propiedad_id: e.target.value }))}>
                  <option value="">Sin asociar a propiedad</option>
                  {propiedades.map(p => <option key={p.id} value={p.id}>{p.titulo || p.direccion || p.id}</option>)}
                </select>
              </div>
            )}

            <div className="lv-field">
              <label className="lv-label">Descripción / Referencia *</label>
              <input className="lv-input" placeholder="Ej: Llave depto 4B Av. Corrientes 1234"
                value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div className="lv-row">
              <div className="lv-field">
                <label className="lv-label">Nombre del responsable *</label>
                <input className="lv-input" placeholder="Nombre y apellido"
                  value={form.responsable_nombre} onChange={e => setForm(f => ({ ...f, responsable_nombre: e.target.value }))} />
              </div>
              <div className="lv-field">
                <label className="lv-label">Teléfono (WhatsApp)</label>
                <input className="lv-input" placeholder="Ej: 1160001234"
                  value={form.responsable_telefono} onChange={e => setForm(f => ({ ...f, responsable_telefono: e.target.value }))} />
              </div>
            </div>

            <div className="lv-row">
              <div className="lv-field">
                <label className="lv-label">Tipo de responsable</label>
                <select className="lv-select" value={form.responsable_tipo} onChange={e => setForm(f => ({ ...f, responsable_tipo: e.target.value }))}>
                  {TIPO_OPCIONES.map(t => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="lv-field">
                <label className="lv-label">Fecha de entrega</label>
                <input className="lv-input" type="date"
                  value={form.fecha_entrega} onChange={e => setForm(f => ({ ...f, fecha_entrega: e.target.value }))} />
              </div>
            </div>

            <div className="lv-field">
              <label className="lv-label">Fecha de devolución esperada</label>
              <input className="lv-input" type="date" placeholder="Dejar en blanco si no hay plazo"
                value={form.fecha_devolucion} onChange={e => setForm(f => ({ ...f, fecha_devolucion: e.target.value }))} />
            </div>

            <div className="lv-field">
              <label className="lv-label">Notas</label>
              <input className="lv-input" placeholder="Observaciones opcionales"
                value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            <div className="lv-modal-acciones">
              <button className="lv-btn-cancelar" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="lv-btn-guardar" disabled={guardando || !form.titulo || !form.responsable_nombre} onClick={guardar}>
                {guardando ? "Guardando..." : editandoId ? "Actualizar" : "Registrar entrega"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-lv">{toast}</div>}
    </>
  );
}
