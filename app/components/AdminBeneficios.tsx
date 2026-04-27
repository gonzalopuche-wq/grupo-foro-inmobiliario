"use client";

// app/components/AdminBeneficios.tsx
// ═══════════════════════════════════════════════════════════════════════════
// GFI® — Gestión de Beneficios / Descuentos por corredor
// El admin puede:
// - Marcar un corredor como cortesía total (no paga)
// - Aplicar % de descuento
// - Aplicar múltiples bonificaciones acumulables (v17: El que aporta, gana)
// - Definir vigencia (con o sin fecha de expiración)
// - Ver historial de beneficios por corredor
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";

interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  email: string | null;
  tipo: string;
}

interface Beneficio {
  id: string;
  perfil_id: string;
  admin_id: string;
  tipo: string;
  descuento_pct: number;
  monto_fijo_usd: number;
  es_cortesia: boolean;
  fecha_desde: string;
  fecha_hasta: string | null;
  activo: boolean;
  motivo: string | null;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; };
}

const TIPOS_BENEFICIO = [
  { value: "cortesia",          label: "🎁 Cortesía total",         desc: "No paga nada — acceso gratuito completo" },
  { value: "descuento_pct",     label: "% Descuento",               desc: "Porcentaje de descuento sobre el precio base" },
  { value: "bonif_biblioteca",  label: "📚 Bonif. Biblioteca",       desc: "Documentos subidos y aprobados" },
  { value: "bonif_foro",        label: "🗣 Bonif. Foro",             desc: "Aportes en el foro de la comunidad" },
  { value: "bonif_comparables", label: "📈 Bonif. Comparables",      desc: "Comparables de venta cargados" },
  { value: "bonif_seniority",   label: "⭐ Bonif. Seniority",        desc: "Bonificación por antigüedad en GFI" },
  { value: "bonif_referidos",   label: "👥 Bonif. Referidos",        desc: "Referidos que se suscribieron" },
];

const TIPO_LABELS: Record<string, string> = {
  cortesia:           "🎁 Cortesía",
  descuento_pct:      "% Descuento",
  bonif_biblioteca:   "📚 Biblioteca",
  bonif_foro:         "🗣 Foro",
  bonif_comparables:  "📈 Comparables",
  bonif_seniority:    "⭐ Seniority",
  bonif_referidos:    "👥 Referidos",
};

const hoy = new Date().toISOString().split("T")[0];
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const FORM_VACIO = {
  perfil_id: "",
  tipo: "descuento_pct",
  descuento_pct: "0",
  monto_fijo_usd: "0",
  es_cortesia: false,
  fecha_desde: hoy,
  fecha_hasta: "",
  indefinido: true,
  motivo: "",
};

export default function AdminBeneficios({ adminId }: { adminId: string }) {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<any>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [perfilDetalle, setPerfilDetalle] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<"activos" | "todos">("activos");

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const [{ data: profs }, { data: bens }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre, apellido, matricula, email, tipo").order("apellido"),
      supabase.from("suscripcion_beneficios").select("*, perfiles(nombre, apellido, matricula)").order("created_at", { ascending: false }),
    ]);
    setPerfiles((profs as Perfil[]) ?? []);
    setBeneficios((bens as Beneficio[]) ?? []);
    setLoading(false);
  };

  const guardar = async () => {
    if (!adminId || !form.perfil_id || !form.tipo) return;
    setGuardando(true);
    const esCortesia = form.tipo === "cortesia";
    const datos = {
      perfil_id: form.perfil_id,
      admin_id: adminId,
      tipo: form.tipo,
      descuento_pct: esCortesia ? 100 : parseFloat(form.descuento_pct) || 0,
      monto_fijo_usd: parseFloat(form.monto_fijo_usd) || 0,
      es_cortesia: esCortesia,
      fecha_desde: form.fecha_desde || hoy,
      fecha_hasta: form.indefinido ? null : (form.fecha_hasta || null),
      activo: true,
      motivo: form.motivo || null,
    };
    await supabase.from("suscripcion_beneficios").insert(datos);
    setGuardando(false);
    setMostrarForm(false);
    setForm(FORM_VACIO);
    await cargar();
  };

  const toggleActivo = async (b: Beneficio) => {
    await supabase.from("suscripcion_beneficios").update({ activo: !b.activo }).eq("id", b.id);
    await cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este beneficio?")) return;
    await supabase.from("suscripcion_beneficios").delete().eq("id", id);
    await cargar();
  };

  // ── Cálculo descuento efectivo por perfil ────────────────────────────────
  const descuentoEfectivo = useMemo(() => {
    const m: Record<string, { total: number; cortesia: boolean; items: Beneficio[] }> = {};
    beneficios
      .filter(b => b.activo && (!b.fecha_hasta || b.fecha_hasta >= hoy))
      .forEach(b => {
        if (!m[b.perfil_id]) m[b.perfil_id] = { total: 0, cortesia: false, items: [] };
        if (b.es_cortesia) m[b.perfil_id].cortesia = true;
        m[b.perfil_id].total = Math.min(100, m[b.perfil_id].total + b.descuento_pct);
        m[b.perfil_id].items.push(b);
      });
    return m;
  }, [beneficios]);

  const perfilesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return perfiles;
    const q = busqueda.toLowerCase();
    return perfiles.filter(p =>
      p.nombre?.toLowerCase().includes(q) ||
      p.apellido?.toLowerCase().includes(q) ||
      p.matricula?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  }, [perfiles, busqueda]);

  const beneficiosFiltrados = useMemo(() => {
    let list = perfilDetalle
      ? beneficios.filter(b => b.perfil_id === perfilDetalle)
      : beneficios;
    if (filtroActivo === "activos") list = list.filter(b => b.activo && (!b.fecha_hasta || b.fecha_hasta >= hoy));
    return list;
  }, [beneficios, perfilDetalle, filtroActivo]);

  const perfilSeleccionado = perfiles.find(p => p.id === perfilDetalle);
  const precioBase = 10; // USD

  const setF = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <>
      <style>{`
        .ben-root { display: flex; gap: 0; min-height: 400px; }
        .ben-lista { flex: 1; display: flex; flex-direction: column; gap: 0; }

        /* Header */
        .ben-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .ben-titulo { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .ben-titulo span { color: #cc0000; }
        .ben-sub { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px; font-family: 'Inter',sans-serif; }
        .ben-btn-nuevo { padding: 7px 16px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .ben-btn-nuevo:hover { background: #e60000; }

        /* Resumen perfiles */
        .ben-perfiles-header { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
        .ben-search { padding: 7px 11px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; width: 220px; }
        .ben-search:focus { border-color: rgba(200,0,0,0.35); }
        .ben-search::placeholder { color: rgba(255,255,255,0.2); }

        /* Grid de perfiles con beneficios */
        .ben-perfiles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; margin-bottom: 20px; }
        .ben-perfil-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 12px 14px; cursor: pointer; transition: border-color 0.12s; }
        .ben-perfil-card:hover { border-color: rgba(255,255,255,0.15); }
        .ben-perfil-card.seleccionado { border-color: #cc0000; background: rgba(200,0,0,0.04); }
        .ben-perfil-nombre { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #fff; }
        .ben-perfil-mat { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; }
        .ben-perfil-precio { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
        .ben-precio-original { font-size: 11px; color: rgba(255,255,255,0.25); text-decoration: line-through; }
        .ben-precio-final { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 800; }
        .ben-cortesia-badge { font-size: 9px; padding: 2px 7px; border-radius: 10px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .ben-pct-badge { font-size: 9px; padding: 2px 7px; border-radius: 10px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.2); color: rgba(200,0,0,0.8); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .ben-items-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
        .ben-item-chip { font-size: 8px; padding: 1px 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.35); font-family: 'Montserrat',sans-serif; font-weight: 700; }

        /* Tabla beneficios */
        .ben-filtros { display: flex; gap: 6px; margin-bottom: 10px; align-items: center; }
        .ben-filtro-btn { padding: 5px 12px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.35); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; cursor: pointer; }
        .ben-filtro-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .ben-table { width: 100%; border-collapse: collapse; }
        .ben-table th { padding: 8px 12px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .ben-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; color: rgba(255,255,255,0.6); vertical-align: middle; }
        .ben-table tr:hover td { background: rgba(255,255,255,0.02); }
        .ben-tipo-badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-weight: 700; white-space: nowrap; }
        .ben-activo-badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .ben-activo-badge.on { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
        .ben-activo-badge.off { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); }
        .ben-acc-btn { padding: 3px 9px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; cursor: pointer; margin-right: 4px; }
        .ben-acc-toggle { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.45); }
        .ben-acc-del { background: transparent; border: 1px solid rgba(200,0,0,0.15); color: rgba(200,0,0,0.45); }
        .ben-volver { background: none; border: none; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; padding: 0; margin-bottom: 12px; display: flex; align-items: center; gap: 5px; }
        .ben-volver:hover { color: #fff; }

        /* Modal */
        .ben-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: flex-start; justify-content: center; z-index: 400; padding: 20px; overflow-y: auto; }
        .ben-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.22); border-radius: 8px; padding: 26px 30px; width: 100%; max-width: 520px; margin: auto; position: relative; }
        .ben-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .ben-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 18px; }
        .ben-modal-titulo span { color: #cc0000; }
        .ben-field { margin-bottom: 12px; }
        .ben-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .ben-input { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; }
        .ben-input:focus { border-color: rgba(200,0,0,0.45); }
        .ben-input::placeholder { color: rgba(255,255,255,0.18); }
        .ben-select { width: 100%; padding: 8px 11px; background: rgba(12,12,12,0.95); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .ben-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ben-tipo-grid { display: flex; flex-direction: column; gap: 6px; }
        .ben-tipo-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.07); cursor: pointer; transition: all 0.12s; background: rgba(255,255,255,0.02); }
        .ben-tipo-item:hover { background: rgba(255,255,255,0.04); }
        .ben-tipo-item.on { border-color: rgba(200,0,0,0.3); background: rgba(200,0,0,0.07); }
        .ben-tipo-radio { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); flex-shrink: 0; margin-top: 2px; transition: all 0.12s; }
        .ben-tipo-radio.on { background: #cc0000; border-color: #cc0000; }
        .ben-tipo-info { flex: 1; }
        .ben-tipo-label { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); }
        .ben-tipo-item.on .ben-tipo-label { color: #fff; }
        .ben-tipo-desc { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 1px; font-family: 'Inter',sans-serif; }
        .ben-preview { background: rgba(200,0,0,0.05); border: 1px solid rgba(200,0,0,0.15); border-radius: 5px; padding: 10px 14px; margin-top: 12px; }
        .ben-preview-label { font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 4px; }
        .ben-preview-val { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; }
        .ben-preview-val span { color: #22c55e; }
        .ben-modal-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 18px; }
        .ben-btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.13); border-radius: 3px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .ben-btn-save { padding: 8px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .ben-btn-save:disabled { opacity: 0.45; cursor: not-allowed; }
        .ben-spinner { display: inline-block; width: 9px; height: 9px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ben-check-row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .ben-check-box { width: 15px; height: 15px; border-radius: 3px; border: 2px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ben-check-box.on { background: #cc0000; border-color: #cc0000; }
        .ben-check-label { font-size: 12px; color: rgba(255,255,255,0.55); font-family: 'Inter',sans-serif; }
        .ben-empty { padding: 32px; text-align: center; color: rgba(255,255,255,0.18); font-family: 'Inter',sans-serif; font-size: 12px; }
      `}</style>

      <div className="ben-root">
        <div className="ben-lista">

          {/* Header */}
          <div className="ben-header">
            <div>
              <div className="ben-titulo">Beneficios <span>& Descuentos</span></div>
              <div className="ben-sub">Cortesías, descuentos y bonificaciones por corredor · El que aporta, gana</div>
            </div>
            <button className="ben-btn-nuevo" onClick={() => { setForm(FORM_VACIO); setMostrarForm(true); }}>+ Nuevo beneficio</button>
          </div>

          {perfilDetalle ? (
            /* ── Vista detalle de un perfil ── */
            <>
              <button className="ben-volver" onClick={() => setPerfilDetalle(null)}>← Volver a todos</button>
              {perfilSeleccionado && (
                <div style={{marginBottom:14,padding:"12px 16px",background:"#0f0f0f",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6}}>
                  <div style={{fontFamily:"Montserrat,sans-serif",fontSize:14,fontWeight:800,color:"#fff"}}>{perfilSeleccionado.apellido}, {perfilSeleccionado.nombre}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>Mat. {perfilSeleccionado.matricula ?? "—"} · {perfilSeleccionado.email ?? "—"}</div>
                  {descuentoEfectivo[perfilDetalle] && (
                    <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                      {descuentoEfectivo[perfilDetalle].cortesia
                        ? <span className="ben-cortesia-badge">🎁 Cortesía total — no paga</span>
                        : descuentoEfectivo[perfilDetalle].total > 0
                        ? <>
                            <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",textDecoration:"line-through"}}>USD {precioBase}</span>
                            <span style={{fontFamily:"Montserrat,sans-serif",fontSize:15,fontWeight:800,color:"#22c55e"}}>USD {(precioBase * (1 - descuentoEfectivo[perfilDetalle].total / 100)).toFixed(2)}</span>
                            <span className="ben-pct-badge">-{descuentoEfectivo[perfilDetalle].total}%</span>
                          </>
                        : <span style={{fontFamily:"Montserrat,sans-serif",fontSize:13,color:"rgba(255,255,255,0.4)"}}>Sin descuento activo</span>
                      }
                    </div>
                  )}
                </div>
              )}
              <div className="ben-filtros">
                {(["activos","todos"] as const).map(f => (
                  <button key={f} className={`ben-filtro-btn${filtroActivo === f ? " activo" : ""}`} onClick={() => setFiltroActivo(f)}>
                    {f === "activos" ? "Activos" : "Todos"}
                  </button>
                ))}
                <button className="ben-btn-nuevo" style={{marginLeft:"auto"}} onClick={() => { setForm({...FORM_VACIO, perfil_id: perfilDetalle}); setMostrarForm(true); }}>+ Agregar</button>
              </div>
              {beneficiosFiltrados.length === 0
                ? <div className="ben-empty">No hay beneficios para este corredor.</div>
                : <TablaBeneficios items={beneficiosFiltrados} onToggle={toggleActivo} onEliminar={eliminar} hoy={hoy} />
              }
            </>
          ) : (
            /* ── Vista general ── */
            <>
              <div className="ben-perfiles-header">
                <input className="ben-search" placeholder="Buscar corredor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                <span style={{fontSize:10,color:"rgba(255,255,255,0.22)",fontFamily:"Inter,sans-serif",marginLeft:4}}>
                  {Object.keys(descuentoEfectivo).length} con beneficios activos
                </span>
              </div>

              {/* Cards de perfiles con beneficios */}
              {Object.keys(descuentoEfectivo).length > 0 && (
                <div className="ben-perfiles-grid">
                  {perfilesFiltrados
                    .filter(p => descuentoEfectivo[p.id])
                    .map(p => {
                      const d = descuentoEfectivo[p.id];
                      const precioFinal = d.cortesia ? 0 : precioBase * (1 - d.total / 100);
                      return (
                        <div key={p.id} className={`ben-perfil-card${perfilDetalle === p.id ? " seleccionado" : ""}`} onClick={() => setPerfilDetalle(p.id)}>
                          <div className="ben-perfil-nombre">{p.apellido}, {p.nombre}</div>
                          <div className="ben-perfil-mat">Mat. {p.matricula ?? "—"}</div>
                          <div className="ben-perfil-precio">
                            {d.cortesia ? (
                              <span className="ben-cortesia-badge">🎁 Cortesía — USD 0</span>
                            ) : (
                              <>
                                <span className="ben-precio-original">USD {precioBase}</span>
                                <span className="ben-precio-final" style={{color:"#22c55e"}}>USD {precioFinal.toFixed(2)}</span>
                                <span className="ben-pct-badge">-{d.total}%</span>
                              </>
                            )}
                          </div>
                          <div className="ben-items-chips">
                            {d.items.map(b => <span key={b.id} className="ben-item-chip">{TIPO_LABELS[b.tipo]}</span>)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Tabla completa */}
              <div className="ben-filtros">
                {(["activos","todos"] as const).map(f => (
                  <button key={f} className={`ben-filtro-btn${filtroActivo === f ? " activo" : ""}`} onClick={() => setFiltroActivo(f)}>
                    {f === "activos" ? "Activos" : "Todos"}
                  </button>
                ))}
              </div>
              {loading
                ? <div className="ben-empty">Cargando...</div>
                : beneficiosFiltrados.length === 0
                ? <div className="ben-empty">No hay beneficios {filtroActivo === "activos" ? "activos" : "registrados"}.</div>
                : <TablaBeneficios items={beneficiosFiltrados} onToggle={toggleActivo} onEliminar={eliminar} hoy={hoy} onPerfilClick={setPerfilDetalle} />
              }
            </>
          )}
        </div>
      </div>

      {/* ── Modal nuevo beneficio ── */}
      {mostrarForm && (
        <div className="ben-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="ben-modal">
            <div className="ben-modal-titulo">Nuevo <span>beneficio</span></div>

            <div className="ben-field">
              <label className="ben-label">Corredor *</label>
              <select className="ben-select" value={form.perfil_id} onChange={e => setF("perfil_id", e.target.value)}>
                <option value="">Seleccioná un corredor...</option>
                {perfiles.map(p => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} — Mat. {p.matricula ?? "s/m"}</option>)}
              </select>
            </div>

            <div className="ben-field">
              <label className="ben-label">Tipo de beneficio *</label>
              <div className="ben-tipo-grid">
                {TIPOS_BENEFICIO.map(t => (
                  <div key={t.value} className={`ben-tipo-item${form.tipo === t.value ? " on" : ""}`} onClick={() => setF("tipo", t.value)}>
                    <div className={`ben-tipo-radio${form.tipo === t.value ? " on" : ""}`} />
                    <div className="ben-tipo-info">
                      <div className="ben-tipo-label">{t.label}</div>
                      <div className="ben-tipo-desc">{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {form.tipo !== "cortesia" && (
              <div className="ben-row" style={{marginTop:12}}>
                <div className="ben-field">
                  <label className="ben-label">% Descuento</label>
                  <input className="ben-input" type="number" min="0" max="100" step="5" value={form.descuento_pct} onChange={e => setF("descuento_pct", e.target.value)} placeholder="0" />
                </div>
                <div className="ben-field">
                  <label className="ben-label">Monto fijo USD</label>
                  <input className="ben-input" type="number" min="0" step="0.5" value={form.monto_fijo_usd} onChange={e => setF("monto_fijo_usd", e.target.value)} placeholder="0" />
                </div>
              </div>
            )}

            <div className="ben-field" style={{marginTop:12}}>
              <label className="ben-label">Vigencia</label>
              <div className="ben-row">
                <div>
                  <label className="ben-label" style={{fontSize:8}}>Desde</label>
                  <input type="date" className="ben-input" value={form.fecha_desde} onChange={e => setF("fecha_desde", e.target.value)} />
                </div>
                <div>
                  <label className="ben-label" style={{fontSize:8}}>Hasta</label>
                  <input type="date" className="ben-input" value={form.fecha_hasta} onChange={e => setF("fecha_hasta", e.target.value)} disabled={form.indefinido} style={{opacity:form.indefinido?0.35:1}} />
                </div>
              </div>
              <div className="ben-check-row" style={{marginTop:8}} onClick={() => setF("indefinido", !form.indefinido)}>
                <div className={`ben-check-box${form.indefinido ? " on" : ""}`}>{form.indefinido && <span style={{fontSize:8,color:"#fff"}}>✓</span>}</div>
                <span className="ben-check-label">Sin fecha de expiración (indefinido)</span>
              </div>
            </div>

            <div className="ben-field">
              <label className="ben-label">Motivo / Nota interna</label>
              <input className="ben-input" value={form.motivo} onChange={e => setF("motivo", e.target.value)} placeholder="Ej: Referido activo, aporte especial a la comunidad..." />
            </div>

            {/* Preview precio */}
            {form.perfil_id && (
              <div className="ben-preview">
                <div className="ben-preview-label">Precio resultante</div>
                {form.tipo === "cortesia" ? (
                  <div className="ben-preview-val">🎁 <span>USD 0</span> — Cortesía total</div>
                ) : (
                  (() => {
                    const pctNuevo = parseFloat(form.descuento_pct) || 0;
                    const existente = descuentoEfectivo[form.perfil_id]?.total ?? 0;
                    const total = Math.min(100, existente + pctNuevo);
                    const final = precioBase * (1 - total / 100);
                    return (
                      <div className="ben-preview-val">
                        <span>USD {final.toFixed(2)}</span>
                        {total > 0 && <span style={{fontSize:12,color:"rgba(255,255,255,0.4)",fontWeight:400,marginLeft:8}}>(-{total}% total acumulado)</span>}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            <div className="ben-modal-actions">
              <button className="ben-btn-cancel" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="ben-btn-save" onClick={guardar} disabled={guardando || !form.perfil_id || !form.tipo}>
                {guardando ? <><span className="ben-spinner"/>Guardando...</> : "Aplicar beneficio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-componente tabla ───────────────────────────────────────────────────
function TablaBeneficios({
  items, onToggle, onEliminar, hoy, onPerfilClick
}: {
  items: Beneficio[];
  onToggle: (b: Beneficio) => void;
  onEliminar: (id: string) => void;
  hoy: string;
  onPerfilClick?: (id: string) => void;
}) {
  return (
    <table className="ben-table">
      <thead>
        <tr>
          <th>Corredor</th>
          <th>Tipo</th>
          <th>Descuento</th>
          <th>Vigencia</th>
          <th>Estado</th>
          <th>Motivo</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map(b => {
          const vencido = b.fecha_hasta && b.fecha_hasta < hoy;
          return (
            <tr key={b.id}>
              <td>
                <span
                  style={{cursor: onPerfilClick ? "pointer" : "default", color: onPerfilClick ? "rgba(200,0,0,0.7)" : "inherit"}}
                  onClick={() => onPerfilClick && onPerfilClick(b.perfil_id)}
                >
                  {b.perfiles ? `${b.perfiles.apellido ?? ""}, ${b.perfiles.nombre ?? ""}` : "—"}
                </span>
                {b.perfiles?.matricula && <div style={{fontSize:10,color:"rgba(255,255,255,0.22)"}}>Mat. {b.perfiles.matricula}</div>}
              </td>
              <td><span className="ben-tipo-badge">{TIPO_LABELS[b.tipo] ?? b.tipo}</span></td>
              <td>
                {b.es_cortesia
                  ? <span style={{color:"#22c55e",fontFamily:"Montserrat,sans-serif",fontWeight:700,fontSize:11}}>🎁 Gratis</span>
                  : <span style={{fontFamily:"Montserrat,sans-serif",fontWeight:700,fontSize:12}}>{b.descuento_pct > 0 ? `-${b.descuento_pct}%` : ""}{b.monto_fijo_usd > 0 ? ` -USD ${b.monto_fijo_usd}` : ""}</span>
                }
              </td>
              <td style={{fontSize:11}}>
                {new Date(b.fecha_desde).toLocaleDateString("es-AR", {day:"2-digit",month:"2-digit",year:"2-digit"})}
                {" → "}
                {b.fecha_hasta
                  ? <span style={{color: vencido ? "#ef4444" : "inherit"}}>{new Date(b.fecha_hasta).toLocaleDateString("es-AR", {day:"2-digit",month:"2-digit",year:"2-digit"})}{vencido ? " ⚠️" : ""}</span>
                  : <span style={{color:"rgba(255,255,255,0.3)"}}>indefinido</span>
                }
              </td>
              <td>
                <span className={`ben-activo-badge${b.activo && !vencido ? " on" : " off"}`}>
                  {b.activo && !vencido ? "Activo" : vencido ? "Vencido" : "Inactivo"}
                </span>
              </td>
              <td style={{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"rgba(255,255,255,0.3)",fontSize:11}}>
                {b.motivo ?? "—"}
              </td>
              <td>
                <button className="ben-acc-btn ben-acc-toggle" onClick={() => onToggle(b)}>
                  {b.activo ? "Pausar" : "Activar"}
                </button>
                <button className="ben-acc-btn ben-acc-del" onClick={() => onEliminar(b.id)}>×</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
