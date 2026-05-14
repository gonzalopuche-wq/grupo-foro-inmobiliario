"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Campana {
  id: string; titulo: string; descripcion: string | null;
  tipo_beneficio: string; valor_descuento_pct: number | null;
  detalle_beneficio: string; imagen_url: string | null;
  presupuesto_usd: number; costo_por_admin_usd: number;
  vigente_desde: string; vigente_hasta: string | null; activa: boolean; created_at: string;
}

const TIPOS = ["descuento","producto_gratis","servicio_gratis","cashback","otro"];
const TIPO_LABEL: Record<string, string> = { descuento:"% Descuento", producto_gratis:"Producto gratis", servicio_gratis:"Servicio gratis", cashback:"Cashback", otro:"Otro beneficio" };
const FORM_VACIO = { titulo:"", descripcion:"", tipo_beneficio:"descuento", valor_descuento_pct:"", detalle_beneficio:"", imagen_url:"", presupuesto_usd:"", costo_por_admin_usd:"1", vigente_desde: new Date().toISOString().slice(0,10), vigente_hasta:"", activa:true };

export default function SponsorCampanasPage() {
  const [provId, setProvId] = useState<string | null>(null);
  const [campanas, setCampanas] = useState<Campana[]>([]);
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
      const { data: cams } = await supabase.from("sponsor_campanas").select("*").eq("proveedor_id", prov.id).order("created_at", { ascending: false });
      setCampanas((cams ?? []) as Campana[]);
      setLoading(false);
    };
    init();
  }, []);

  const guardar = async () => {
    if (!provId) return;
    if (!form.titulo || !form.detalle_beneficio || !form.presupuesto_usd) {
      showToast("Completá título, beneficio y presupuesto", "err"); return;
    }
    setGuardando(true);
    const payload = {
      proveedor_id: provId,
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      tipo_beneficio: form.tipo_beneficio,
      valor_descuento_pct: form.valor_descuento_pct ? parseFloat(form.valor_descuento_pct) : null,
      detalle_beneficio: form.detalle_beneficio,
      imagen_url: form.imagen_url || null,
      presupuesto_usd: parseFloat(form.presupuesto_usd),
      costo_por_admin_usd: parseFloat(form.costo_por_admin_usd) || 1,
      vigente_desde: form.vigente_desde,
      vigente_hasta: form.vigente_hasta || null,
      activa: form.activa,
      updated_at: new Date().toISOString(),
    };

    if (editandoId) {
      const { error } = await supabase.from("sponsor_campanas").update(payload).eq("id", editandoId);
      if (error) { showToast("Error al guardar", "err"); setGuardando(false); return; }
      setCampanas(prev => prev.map(c => c.id === editandoId ? { ...c, ...payload } as Campana : c));
      showToast("Campaña actualizada");
    } else {
      const { data, error } = await supabase.from("sponsor_campanas").insert(payload).select().single();
      if (error || !data) { showToast("Error al crear", "err"); setGuardando(false); return; }
      setCampanas(prev => [data as Campana, ...prev]);
      showToast("Campaña creada");
    }
    setGuardando(false);
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const toggleActiva = async (c: Campana) => {
    await supabase.from("sponsor_campanas").update({ activa: !c.activa, updated_at: new Date().toISOString() }).eq("id", c.id);
    setCampanas(prev => prev.map(x => x.id === c.id ? { ...x, activa: !x.activa } : x));
  };

  const editar = (c: Campana) => {
    setForm({ ...FORM_VACIO, titulo: c.titulo, descripcion: c.descripcion ?? "", tipo_beneficio: c.tipo_beneficio, valor_descuento_pct: c.valor_descuento_pct?.toString() ?? "", detalle_beneficio: c.detalle_beneficio, imagen_url: c.imagen_url ?? "", presupuesto_usd: c.presupuesto_usd.toString(), costo_por_admin_usd: c.costo_por_admin_usd.toString(), vigente_desde: c.vigente_desde, vigente_hasta: c.vigente_hasta ?? "", activa: c.activa });
    setEditandoId(c.id);
    setMostrarForm(true);
  };

  if (loading) return <div style={{ color: "rgba(255,255,255,.3)" }}>Cargando...</div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500&display=swap');
        .sc-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .sc-title { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:800; color:#fff; }
        .btn-new { padding:10px 20px; background:#cc0000; border:none; border-radius:4px; color:#fff; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; }
        .sc-form { background:rgba(14,14,14,.95); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:24px; margin-bottom:20px; }
        .sc-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .sc-field { display:flex; flex-direction:column; gap:6px; }
        .sc-label { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,.35); }
        .sc-input { padding:10px 13px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:4px; color:#fff; font-size:13px; outline:none; font-family:'Inter',sans-serif; }
        .sc-input:focus { border-color:rgba(200,0,0,.4); }
        .sc-select { padding:10px 13px; background:#0f0f0f; border:1px solid rgba(255,255,255,.1); border-radius:4px; color:#fff; font-size:13px; outline:none; }
        .sc-card { background:rgba(14,14,14,.95); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:18px 20px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:10px; }
        .sc-card-titulo { font-family:'Montserrat',sans-serif; font-size:15px; font-weight:800; color:#fff; margin-bottom:4px; }
        .sc-card-tipo { font-size:11px; color:rgba(255,255,255,.4); }
        .sc-card-detalle { font-size:13px; color:rgba(255,255,255,.7); margin-top:8px; }
        .sc-card-meta { font-size:11px; color:rgba(255,255,255,.3); margin-top:6px; }
        .sc-pill-on { padding:3px 10px; border-radius:10px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.2); color:#22c55e; font-size:9px; font-weight:700; font-family:'Montserrat',sans-serif; cursor:pointer; }
        .sc-pill-off { padding:3px 10px; border-radius:10px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.4); font-size:9px; font-weight:700; font-family:'Montserrat',sans-serif; cursor:pointer; }
        .sc-actions { display:flex; gap:8px; flex-shrink:0; }
        .btn-edit { padding:7px 14px; background:transparent; border:1px solid rgba(255,255,255,.12); border-radius:4px; color:rgba(255,255,255,.5); font-size:11px; font-family:'Montserrat',sans-serif; cursor:pointer; }
        .btn-save { padding:10px 24px; background:#cc0000; border:none; border-radius:4px; color:#fff; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; letter-spacing:.12em; cursor:pointer; }
        .btn-cancel { padding:10px 18px; background:transparent; border:1px solid rgba(255,255,255,.14); border-radius:4px; color:rgba(255,255,255,.4); font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; cursor:pointer; }
        .toast { position:fixed; bottom:28px; right:28px; padding:12px 20px; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:12px; font-weight:700; z-index:999; }
        .toast.ok { background:rgba(34,197,94,.15); border:1px solid rgba(34,197,94,.35); color:#22c55e; }
        .toast.err { background:rgba(200,0,0,.15); border:1px solid rgba(200,0,0,.35); color:#ff6666; }
      `}</style>

      <div className="sc-hdr">
        <div className="sc-title">Campañas</div>
        <button className="btn-new" onClick={() => { setMostrarForm(true); setEditandoId(null); setForm(FORM_VACIO); }}>+ Nueva campaña</button>
      </div>

      {mostrarForm && (
        <div className="sc-form">
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 16 }}>
            {editandoId ? "Editar campaña" : "Nueva campaña"}
          </div>
          <div className="sc-grid">
            <div className="sc-field" style={{ gridColumn: "1/-1" }}>
              <label className="sc-label">Título *</label>
              <input className="sc-input" placeholder="Ej: Seguro de incendio para consorcios" value={form.titulo} onChange={e => setF("titulo", e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">Tipo de beneficio *</label>
              <select className="sc-select" value={form.tipo_beneficio} onChange={e => setF("tipo_beneficio", e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            {form.tipo_beneficio === "descuento" && (
              <div className="sc-field">
                <label className="sc-label">Porcentaje de descuento</label>
                <input className="sc-input" type="number" min="1" max="100" placeholder="Ej: 15" value={form.valor_descuento_pct} onChange={e => setF("valor_descuento_pct", e.target.value)} />
              </div>
            )}
            <div className="sc-field" style={{ gridColumn: "1/-1" }}>
              <label className="sc-label">Detalle del beneficio * (lo que ve el corredor)</label>
              <input className="sc-input" placeholder="Ej: 15% off en seguro de incendio para consorcios, con inspección gratis" value={form.detalle_beneficio} onChange={e => setF("detalle_beneficio", e.target.value)} />
            </div>
            <div className="sc-field" style={{ gridColumn: "1/-1" }}>
              <label className="sc-label">Descripción adicional</label>
              <input className="sc-input" placeholder="Info extra, condiciones, etc." value={form.descripcion} onChange={e => setF("descripcion", e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">Presupuesto total (USD) *</label>
              <input className="sc-input" type="number" min="1" placeholder="Ej: 5000" value={form.presupuesto_usd} onChange={e => setF("presupuesto_usd", e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">Costo por administración (USD)</label>
              <input className="sc-input" type="number" min="0.1" step="0.1" value={form.costo_por_admin_usd} onChange={e => setF("costo_por_admin_usd", e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">Vigente desde</label>
              <input className="sc-input" type="date" value={form.vigente_desde} onChange={e => setF("vigente_desde", e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">Vigente hasta (opcional)</label>
              <input className="sc-input" type="date" value={form.vigente_hasta} onChange={e => setF("vigente_hasta", e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">URL imagen del banner (opcional)</label>
              <input className="sc-input" placeholder="https://..." value={form.imagen_url} onChange={e => setF("imagen_url", e.target.value)} />
            </div>
          </div>

          {form.presupuesto_usd && form.costo_por_admin_usd && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(200,0,0,.06)", border: "1px solid rgba(200,0,0,.15)", borderRadius: 6, fontSize: 12, color: "rgba(255,255,255,.5)" }}>
              Con ${form.costo_por_admin_usd} por administración y un presupuesto de ${form.presupuesto_usd},
              podés financiar hasta <strong style={{ color: "#cc0000" }}>{Math.floor(parseFloat(form.presupuesto_usd || "0") / parseFloat(form.costo_por_admin_usd || "1")).toLocaleString("es-AR")}</strong> administraciones en total.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn-save" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : editandoId ? "Actualizar" : "Crear campaña"}</button>
            <button className="btn-cancel" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {campanas.length === 0
        ? <div style={{ color: "rgba(255,255,255,.2)", fontSize: 13, padding: "32px 0" }}>No tenés campañas todavía. Creá la primera.</div>
        : campanas.map(c => (
          <div key={c.id} className="sc-card">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div className="sc-card-titulo">{c.titulo}</div>
                <span className={c.activa ? "sc-pill-on" : "sc-pill-off"} onClick={() => toggleActiva(c)}>
                  {c.activa ? "Activa" : "Pausada"}
                </span>
              </div>
              <div className="sc-card-tipo">{TIPO_LABEL[c.tipo_beneficio]}{c.valor_descuento_pct ? ` — ${c.valor_descuento_pct}%` : ""}</div>
              <div className="sc-card-detalle">{c.detalle_beneficio}</div>
              <div className="sc-card-meta">
                Presupuesto: <strong style={{ color: "#fff" }}>${c.presupuesto_usd}</strong>
                {" · "}Costo/admin: <strong style={{ color: "#cc0000" }}>${c.costo_por_admin_usd}</strong>
                {c.vigente_hasta && ` · Hasta ${new Date(c.vigente_hasta + "T12:00:00").toLocaleDateString("es-AR")}`}
              </div>
            </div>
            <div className="sc-actions">
              <button className="btn-edit" onClick={() => editar(c)}>Editar</button>
            </div>
          </div>
        ))
      }

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
