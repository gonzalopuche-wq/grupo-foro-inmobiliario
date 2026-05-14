"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Beneficio {
  id: string; titulo: string; descripcion: string | null; imagen_url: string | null;
  vigente_desde: string; vigente_hasta: string | null; activo: boolean;
  republica_frecuencia: string; created_at: string;
}

const FRECUENCIAS = [
  { val: "ninguna", label: "Sin republicación" },
  { val: "diaria", label: "Diaria" },
  { val: "2x_semana", label: "2 veces por semana" },
  { val: "semanal", label: "Semanal" },
];

const FORM_VACIO = { titulo:"", descripcion:"", imagen_url:"", vigente_desde: new Date().toISOString().slice(0,10), vigente_hasta:"", activo:true, republica_frecuencia:"ninguna" };

export default function SponsorBeneficiosPage() {
  const [provId, setProvId] = useState<string | null>(null);
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = (msg: string, tipo: "ok"|"err" = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500); };
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: prov } = await supabase.from("red_proveedores").select("id").eq("portal_user_id", data.user.id).maybeSingle();
      if (!prov) return;
      setProvId(prov.id);
      const { data: bens } = await supabase.from("sponsor_beneficios").select("*").eq("proveedor_id", prov.id).order("created_at", { ascending: false });
      setBeneficios((bens ?? []) as Beneficio[]);
      setLoading(false);
    };
    init();
  }, []);

  const guardar = async () => {
    if (!provId || !form.titulo) { showToast("El título es requerido", "err"); return; }
    setGuardando(true);
    const payload = {
      proveedor_id: provId,
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      imagen_url: form.imagen_url || null,
      vigente_desde: form.vigente_desde,
      vigente_hasta: form.vigente_hasta || null,
      activo: form.activo,
      republica_frecuencia: form.republica_frecuencia,
    };

    if (editandoId) {
      const { error } = await supabase.from("sponsor_beneficios").update(payload).eq("id", editandoId);
      if (error) { showToast("Error al guardar", "err"); setGuardando(false); return; }
      setBeneficios(prev => prev.map(b => b.id === editandoId ? { ...b, ...payload } as Beneficio : b));
      showToast("Beneficio actualizado");
    } else {
      const { data, error } = await supabase.from("sponsor_beneficios").insert(payload).select().single();
      if (error || !data) { showToast("Error al crear", "err"); setGuardando(false); return; }
      setBeneficios(prev => [data as Beneficio, ...prev]);
      showToast("Beneficio creado");
    }
    setGuardando(false);
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const toggleActivo = async (b: Beneficio) => {
    await supabase.from("sponsor_beneficios").update({ activo: !b.activo }).eq("id", b.id);
    setBeneficios(prev => prev.map(x => x.id === b.id ? { ...x, activo: !x.activo } : x));
  };

  if (loading) return <div style={{ color: "rgba(255,255,255,.3)" }}>Cargando...</div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500&display=swap');
        .sb-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .sb-title { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:800; color:#fff; }
        .sb-sub { font-size:12px; color:rgba(255,255,255,.35); margin-bottom:20px; }
        .btn-new { padding:10px 20px; background:#cc0000; border:none; border-radius:4px; color:#fff; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; }
        .sb-form { background:rgba(14,14,14,.95); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:24px; margin-bottom:20px; display:flex; flex-direction:column; gap:14px; }
        .sb-field { display:flex; flex-direction:column; gap:6px; }
        .sb-label { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,.35); }
        .sb-input { padding:10px 13px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:4px; color:#fff; font-size:13px; outline:none; font-family:'Inter',sans-serif; }
        .sb-input:focus { border-color:rgba(200,0,0,.4); }
        .sb-select { padding:10px 13px; background:#0f0f0f; border:1px solid rgba(255,255,255,.1); border-radius:4px; color:#fff; font-size:13px; outline:none; }
        .sb-textarea { padding:10px 13px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:4px; color:#fff; font-size:13px; outline:none; resize:vertical; min-height:80px; font-family:'Inter',sans-serif; }
        .sb-card { background:rgba(14,14,14,.95); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:18px 20px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:10px; }
        .sb-pill-on { padding:3px 10px; border-radius:10px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.2); color:#22c55e; font-size:9px; font-weight:700; font-family:'Montserrat',sans-serif; cursor:pointer; }
        .sb-pill-off { padding:3px 10px; border-radius:10px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.4); font-size:9px; font-weight:700; font-family:'Montserrat',sans-serif; cursor:pointer; }
        .btn-edit { padding:7px 14px; background:transparent; border:1px solid rgba(255,255,255,.12); border-radius:4px; color:rgba(255,255,255,.5); font-size:11px; font-family:'Montserrat',sans-serif; cursor:pointer; }
        .btn-save { padding:10px 24px; background:#cc0000; border:none; border-radius:4px; color:#fff; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; cursor:pointer; }
        .btn-cancel { padding:10px 18px; background:transparent; border:1px solid rgba(255,255,255,.14); border-radius:4px; color:rgba(255,255,255,.4); font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; cursor:pointer; }
        .toast { position:fixed; bottom:28px; right:28px; padding:12px 20px; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:12px; font-weight:700; z-index:999; }
        .toast.ok { background:rgba(34,197,94,.15); border:1px solid rgba(34,197,94,.35); color:#22c55e; }
        .toast.err { background:rgba(200,0,0,.15); border:1px solid rgba(200,0,0,.35); color:#ff6666; }
      `}</style>

      <div className="sb-hdr">
        <div className="sb-title">Beneficios para corredores</div>
        <button className="btn-new" onClick={() => { setMostrarForm(true); setEditandoId(null); setForm(FORM_VACIO); }}>+ Nuevo beneficio</button>
      </div>
      <div className="sb-sub">Los beneficios se muestran a todos los corredores en la plataforma. Podés cambiarlos en cualquier momento para adaptarte a la competencia.</div>

      {mostrarForm && (
        <div className="sb-form">
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, fontWeight: 800, color: "#fff" }}>
            {editandoId ? "Editar beneficio" : "Nuevo beneficio"}
          </div>
          <div className="sb-field">
            <label className="sb-label">Título *</label>
            <input className="sb-input" placeholder="Ej: 20% off en seguro de incendio para consorcios" value={form.titulo} onChange={e => setF("titulo", e.target.value)} />
          </div>
          <div className="sb-field">
            <label className="sb-label">Descripción</label>
            <textarea className="sb-textarea" placeholder="Condiciones, cómo acceder al beneficio, contacto..." value={form.descripcion ?? ""} onChange={e => setF("descripcion", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="sb-field">
              <label className="sb-label">Válido desde</label>
              <input className="sb-input" type="date" value={form.vigente_desde} onChange={e => setF("vigente_desde", e.target.value)} />
            </div>
            <div className="sb-field">
              <label className="sb-label">Válido hasta (opcional)</label>
              <input className="sb-input" type="date" value={form.vigente_hasta} onChange={e => setF("vigente_hasta", e.target.value)} />
            </div>
            <div className="sb-field">
              <label className="sb-label">Republicar en Foro</label>
              <select className="sb-select" value={form.republica_frecuencia} onChange={e => setF("republica_frecuencia", e.target.value)}>
                {FRECUENCIAS.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
              </select>
            </div>
            <div className="sb-field">
              <label className="sb-label">Imagen del beneficio (URL)</label>
              <input className="sb-input" placeholder="https://..." value={form.imagen_url ?? ""} onChange={e => setF("imagen_url", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-save" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : editandoId ? "Actualizar" : "Crear beneficio"}</button>
            <button className="btn-cancel" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {beneficios.length === 0
        ? <div style={{ color: "rgba(255,255,255,.2)", fontSize: 13, padding: "32px 0" }}>No tenés beneficios cargados. Creá el primero para que los corredores lo vean.</div>
        : beneficios.map(b => (
          <div key={b.id} className="sb-card">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 15, fontWeight: 800, color: "#fff" }}>{b.titulo}</div>
                <span className={b.activo ? "sb-pill-on" : "sb-pill-off"} onClick={() => toggleActivo(b)}>
                  {b.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              {b.descripcion && <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginBottom: 6 }}>{b.descripcion}</div>}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>
                Desde {new Date(b.vigente_desde + "T12:00:00").toLocaleDateString("es-AR")}
                {b.vigente_hasta && ` hasta ${new Date(b.vigente_hasta + "T12:00:00").toLocaleDateString("es-AR")}`}
                {b.republica_frecuencia !== "ninguna" && ` · Republicación ${FRECUENCIAS.find(f => f.val === b.republica_frecuencia)?.label.toLowerCase()}`}
              </div>
            </div>
            <button className="btn-edit" onClick={() => {
              setForm({ titulo: b.titulo, descripcion: b.descripcion ?? "", imagen_url: b.imagen_url ?? "", vigente_desde: b.vigente_desde, vigente_hasta: b.vigente_hasta ?? "", activo: b.activo, republica_frecuencia: b.republica_frecuencia });
              setEditandoId(b.id);
              setMostrarForm(true);
            }}>Editar</button>
          </div>
        ))
      }

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
