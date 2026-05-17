"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Negocio {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  titulo: string;
  tipo_operacion: string;
  etapa: string;
  descripcion: string | null;
  direccion: string | null;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  split_pct: number | null;
  colega_id: string | null;
  fecha_primer_contacto: string | null;
  fecha_visita: string | null;
  fecha_reserva: string | null;
  fecha_escritura: string | null;
  fecha_cierre: string | null;
  etiquetas: string[] | null;
  notas: string | null;
  archivado: boolean;
  created_at: string;
  updated_at: string;
}

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo: string | null;
}

interface Hito {
  id: string;
  tipo: string;
  fecha: string;
  completado: boolean;
  notas: string | null;
}

interface PostCierre {
  id: string;
  titulo: string;
  tipo: string;
  completado: boolean;
  fecha_limite: string | null;
}

// ── constantes ────────────────────────────────────────────────────────────────
const ETAPAS = [
  { value: "prospecto",         label: "Prospecto",        color: "#6b7280" },
  { value: "contactado",        label: "Contactado",       color: "#3b82f6" },
  { value: "visita_coordinada", label: "Visita coord.",    color: "#8b5cf6" },
  { value: "visita_realizada",  label: "Visita realiz.",   color: "#a78bfa" },
  { value: "oferta_enviada",    label: "Oferta enviada",   color: "#f59e0b" },
  { value: "negociacion",       label: "Negociación",      color: "#f97316" },
  { value: "reserva",           label: "Reserva",          color: "#06b6d4" },
  { value: "escritura",         label: "Escritura",        color: "#10b981" },
  { value: "cerrado",           label: "Cerrado ✓",        color: "#22c55e" },
  { value: "perdido",           label: "Perdido",          color: "#ef4444" },
];

const TIPOS_HITO = [
  { value: "reserva",     label: "Reserva",         icon: "📝", color: "#f59e0b" },
  { value: "boleto",      label: "Boleto",          icon: "📋", color: "#06b6d4" },
  { value: "escritura",   label: "Escritura",       icon: "⚖️", color: "#6366f1" },
  { value: "posesion",    label: "Posesión",        icon: "🔑", color: "#10b981" },
  { value: "liquidacion", label: "Liquidación",     icon: "💰", color: "#22c55e" },
  { value: "otro",        label: "Otro",            icon: "📌", color: "#94a3b8" },
];

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtFecha = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtMon = (v: number | null, m: string) => {
  if (!v) return "—";
  return m === "USD" ? `USD ${v.toLocaleString("es-AR")}` : `$ ${v.toLocaleString("es-AR")}`;
};
const diasEntre = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
};

// ── componente ────────────────────────────────────────────────────────────────
export default function NegocioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [uid, setUid] = useState<string | null>(null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [postCierre, setPostCierre] = useState<PostCierre[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"hitos" | "financiero" | "postcierrer">("hitos");
  const [guardandoEtapa, setGuardandoEtapa] = useState(false);
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notas, setNotas] = useState("");
  const [toast, setToast] = useState("");
  const [modalHito, setModalHito] = useState<{ tipo: string; fecha: string; notas: string } | null>(null);
  const [guardandoHito, setGuardandoHito] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, [id]);

  const cargar = async (userId: string) => {
    setLoading(true);
    const { data: neg } = await supabase
      .from("crm_negocios").select("*").eq("id", id).eq("perfil_id", userId).single();
    if (!neg) { setLoading(false); return; }
    setNegocio(neg as Negocio);
    setNotas(neg.notas ?? "");

    const p1 = supabase.from("crm_escritura_hitos").select("*").eq("negocio_id", id).order("fecha").then(({ data }) => setHitos((data ?? []) as Hito[]));
    const p2 = supabase.from("crm_post_cierre").select("id,titulo,tipo,completado,fecha_limite").eq("negocio_id", id).order("completado").then(({ data }) => setPostCierre((data ?? []) as PostCierre[]));
    const extras: Promise<void>[] = [];
    if (neg.contacto_id) {
      extras.push(
        Promise.resolve(
          supabase.from("crm_contactos").select("id,nombre,apellido,telefono,email,tipo").eq("id", neg.contacto_id).single()
        ).then(({ data }) => setContacto((data as Contacto) ?? null))
      );
    }
    await Promise.all([p1, p2, ...extras]);
    setLoading(false);
  };

  const avanzarEtapa = async () => {
    if (!negocio || !uid) return;
    const idx = ETAPAS.findIndex(e => e.value === negocio.etapa);
    if (idx < 0 || idx >= ETAPAS.length - 1) return;
    const nueva = ETAPAS[idx + 1].value;
    setGuardandoEtapa(true);
    await supabase.from("crm_negocios").update({ etapa: nueva, updated_at: new Date().toISOString() }).eq("id", id);
    setNegocio(prev => prev ? { ...prev, etapa: nueva } : prev);
    setGuardandoEtapa(false);
    showToast(`Etapa → ${ETAPAS[idx + 1].label}`);
  };

  const guardarNotas = async () => {
    if (!uid) return;
    await supabase.from("crm_negocios").update({ notas, updated_at: new Date().toISOString() }).eq("id", id);
    setNegocio(prev => prev ? { ...prev, notas } : prev);
    setEditandoNotas(false);
    showToast("Notas guardadas");
  };

  const toggleHito = async (hito: Hito) => {
    await supabase.from("crm_escritura_hitos").update({ completado: !hito.completado }).eq("id", hito.id);
    setHitos(prev => prev.map(h => h.id === hito.id ? { ...h, completado: !h.completado } : h));
  };

  const agregarHito = async () => {
    if (!modalHito || !uid) return;
    setGuardandoHito(true);
    await supabase.from("crm_escritura_hitos").insert({
      negocio_id: id, perfil_id: uid,
      tipo: modalHito.tipo, fecha: modalHito.fecha,
      notas: modalHito.notas || null, completado: false,
    });
    setGuardandoHito(false);
    setModalHito(null);
    cargar(uid);
    showToast("Hito agregado");
  };

  const etapaInfo = useMemo(() =>
    ETAPAS.find(e => e.value === negocio?.etapa) ?? ETAPAS[0],
  [negocio?.etapa]);

  const siguienteEtapa = useMemo(() => {
    const idx = ETAPAS.findIndex(e => e.value === negocio?.etapa);
    return idx >= 0 && idx < ETAPAS.length - 1 ? ETAPAS[idx + 1] : null;
  }, [negocio?.etapa]);

  // ── financiero ────────────────────────────────────────────────────────────
  const fin = useMemo(() => {
    if (!negocio) return null;
    const v = negocio.valor_operacion ?? 0;
    const hPct = negocio.honorarios_pct ?? 0;
    const sPct = negocio.split_pct ?? 0;
    const honBruto = v * hPct / 100;
    const miParte = sPct > 0 ? honBruto * (1 - sPct / 100) : honBruto;
    const iibb = honBruto * 0.055;
    const iva  = (honBruto + iibb) * 0.21;
    const honNeto = honBruto - iibb - iva;
    return { v, hPct, sPct, honBruto, miParte, iibb, iva, honNeto };
  }, [negocio]);

  // ── timeline de fechas ────────────────────────────────────────────────────
  const timeline = useMemo(() => {
    if (!negocio) return [];
    return [
      { label: "Primer contacto",   fecha: negocio.fecha_primer_contacto, icon: "📞", color: "#3b82f6" },
      { label: "Visita",            fecha: negocio.fecha_visita,          icon: "🏠", color: "#8b5cf6" },
      { label: "Reserva",           fecha: negocio.fecha_reserva,         icon: "📝", color: "#f59e0b" },
      { label: "Escritura prevista",fecha: negocio.fecha_escritura,       icon: "⚖️", color: "#10b981" },
      { label: "Cierre",            fecha: negocio.fecha_cierre,          icon: "✓",  color: "#22c55e" },
    ].filter(t => !!t.fecha);
  }, [negocio]);

  const duracionDias = useMemo(() =>
    diasEntre(negocio?.fecha_primer_contacto ?? null, negocio?.fecha_cierre ?? new Date().toISOString().slice(0,10)),
  [negocio]);

  if (loading) return (
    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 60, fontFamily: "Inter,sans-serif" }}>Cargando negocio...</div>
  );
  if (!negocio) return (
    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 60, fontFamily: "Inter,sans-serif" }}>
      Negocio no encontrado. <Link href="/crm/negocios" style={{ color: "#cc0000" }}>← Volver</Link>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .nd-card { background:rgba(14,14,14,0.9); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:18px; }
        .nd-btn { padding:7px 14px; border:none; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; letter-spacing:0.08em; cursor:pointer; transition:opacity 0.15s; }
        .nd-label { font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.3); font-family:'Montserrat',sans-serif; margin-bottom:4px; display:block; }
        .nd-input { width:100%; padding:8px 10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:13px; font-family:'Inter',sans-serif; outline:none; box-sizing:border-box; }
        .nd-input:focus { border-color:rgba(204,0,0,0.5); }
        .nd-select { width:100%; padding:8px 10px; background:rgba(14,14,14,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:13px; font-family:'Inter',sans-serif; outline:none; }
        .nd-tab { padding:8px 16px; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; letter-spacing:0.08em; cursor:pointer; border:1px solid transparent; transition:all 0.15s; }
        .nd-row { display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
        .nd-row:last-child { border-bottom:none; }
        @media(max-width:700px){.nd-layout{flex-direction:column!important;}}
      `}</style>

      <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Breadcrumb ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/crm/negocios" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif", textDecoration: "none" }}>← Negocios</Link>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif" }}>{negocio.titulo}</span>
        </div>

        {/* ── Header del negocio ── */}
        <div className="nd-card">
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Dot de etapa */}
            <div style={{ width: 48, height: 48, borderRadius: 10, background: `${etapaInfo.color}18`, border: `2px solid ${etapaInfo.color}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: etapaInfo.color }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 6 }}>{negocio.titulo}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, background: `${etapaInfo.color}18`, color: etapaInfo.color, border: `1px solid ${etapaInfo.color}40` }}>
                  {etapaInfo.label}
                </span>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {negocio.tipo_operacion}
                </span>
                {negocio.archivado && (
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.3)" }}>Archivado</span>
                )}
              </div>
              {negocio.direccion && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", marginTop: 6 }}>📍 {negocio.direccion}</div>}
            </div>

            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              {siguienteEtapa && !["cerrado","perdido"].includes(negocio.etapa) && (
                <button className="nd-btn"
                  style={{ background: `${siguienteEtapa.color}15`, color: siguienteEtapa.color, border: `1px solid ${siguienteEtapa.color}35`, opacity: guardandoEtapa ? 0.6 : 1 }}
                  onClick={avanzarEtapa} disabled={guardandoEtapa}>
                  → {siguienteEtapa.label}
                </button>
              )}
              <Link href="/crm/negocios"
                style={{ padding: "7px 14px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textDecoration: "none" }}>
                ← Volver
              </Link>
            </div>
          </div>
        </div>

        {/* ── Layout de 2 columnas ── */}
        <div className="nd-layout" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

          {/* ── Panel izquierdo ── */}
          <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Contacto vinculado */}
            {contacto && (
              <div className="nd-card">
                <div className="nd-label" style={{ marginBottom: 10 }}>Contacto</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(204,0,0,0.1)", border: "1px solid rgba(204,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 800, color: "#cc0000", flexShrink: 0 }}>
                    {contacto.nombre[0]}{contacto.apellido[0]}
                  </div>
                  <div>
                    <Link href={`/crm/contactos/${contacto.id}`} style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#cc0000"}
                      onMouseLeave={e => e.currentTarget.style.color = "#fff"}>
                      {contacto.nombre} {contacto.apellido}
                    </Link>
                    {contacto.tipo && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif", marginTop: 1 }}>{contacto.tipo}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {contacto.telefono && (
                    <a href={`https://wa.me/${contacto.telefono.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                      style={{ flex: 1, padding: "7px 0", textAlign: "center", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 5, fontSize: 13, textDecoration: "none" }}>💬</a>
                  )}
                  {contacto.telefono && (
                    <a href={`tel:${contacto.telefono}`}
                      style={{ flex: 1, padding: "7px 0", textAlign: "center", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 5, fontSize: 13, textDecoration: "none" }}>📞</a>
                  )}
                  {contacto.email && (
                    <a href={`mailto:${contacto.email}`}
                      style={{ flex: 1, padding: "7px 0", textAlign: "center", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 5, fontSize: 13, textDecoration: "none" }}>✉️</a>
                  )}
                </div>
              </div>
            )}

            {/* KPIs rápidos */}
            <div className="nd-card">
              <div className="nd-label" style={{ marginBottom: 12 }}>Resumen</div>
              {[
                { l: "Valor operación",   v: fmtMon(negocio.valor_operacion, negocio.moneda) },
                { l: "Honorarios",        v: negocio.honorarios_pct ? `${negocio.honorarios_pct}%` : "—" },
                { l: "Días en pipeline",  v: duracionDias !== null ? `${duracionDias}d` : "—" },
                { l: "Hitos completados", v: hitos.length > 0 ? `${hitos.filter(h=>h.completado).length}/${hitos.length}` : "—" },
                { l: "Post-cierre",       v: postCierre.length > 0 ? `${postCierre.filter(p=>p.completado).length}/${postCierre.length}` : "—" },
                { l: "Última actualiz.",  v: fmtFecha(negocio.updated_at) ?? "—" },
              ].map(row => (
                <div key={row.l} className="nd-row">
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>{row.l}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "Montserrat,sans-serif" }}>{row.v}</span>
                </div>
              ))}
            </div>

            {/* Timeline de fechas */}
            {timeline.length > 0 && (
              <div className="nd-card">
                <div className="nd-label" style={{ marginBottom: 12 }}>Cronología</div>
                <div style={{ position: "relative", paddingLeft: 20 }}>
                  <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1 }} />
                  {timeline.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, position: "relative" }}>
                      <div style={{ position: "absolute", left: -16, top: 2, width: 10, height: 10, borderRadius: "50%", background: t.color, border: "2px solid #0a0a0a" }} />
                      <div>
                        <div style={{ fontSize: 10, color: t.color, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.06em" }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif" }}>{fmtFecha(t.fecha)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
            <div className="nd-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="nd-label">Notas internas</div>
                <button className="nd-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
                  onClick={() => setEditandoNotas(v => !v)}>
                  {editandoNotas ? "Cancelar" : "Editar"}
                </button>
              </div>
              {editandoNotas ? (
                <>
                  <textarea className="nd-input" rows={4} style={{ resize: "vertical" }} value={notas} onChange={e => setNotas(e.target.value)} />
                  <button className="nd-btn" style={{ background: "#cc0000", color: "#fff", marginTop: 8, width: "100%" }} onClick={guardarNotas}>Guardar</button>
                </>
              ) : (
                <div style={{ fontSize: 12, color: negocio.notas ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {negocio.notas || "Sin notas. Hacé click en Editar para agregar."}
                </div>
              )}
            </div>
          </div>

          {/* ── Panel derecho: tabs ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { key: "hitos",      label: `Hitos (${hitos.length})` },
                { key: "financiero", label: "Financiero" },
                { key: "postcierrer", label: `Post-cierre (${postCierre.length})` },
              ] as const).map(t => (
                <button key={t.key} className="nd-tab"
                  style={{
                    background: tab === t.key ? "rgba(204,0,0,0.12)" : "rgba(255,255,255,0.04)",
                    color: tab === t.key ? "#cc0000" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${tab === t.key ? "rgba(204,0,0,0.35)" : "rgba(255,255,255,0.08)"}`,
                  }}
                  onClick={() => setTab(t.key)}>{t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Hitos de escritura ── */}
            {tab === "hitos" && (
              <div className="nd-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Hitos de la operación</div>
                  <button className="nd-btn" style={{ background: "rgba(204,0,0,0.1)", color: "#cc0000", border: "1px solid rgba(204,0,0,0.25)" }}
                    onClick={() => setModalHito({ tipo: "reserva", fecha: new Date().toISOString().slice(0,10), notas: "" })}>
                    + Agregar hito
                  </button>
                </div>

                {hitos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", fontSize: 12 }}>
                    Sin hitos registrados. Agregá reserva, boleto, escritura, posesión, etc.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {hitos.map(h => {
                      const info = TIPOS_HITO.find(t => t.value === h.tipo) ?? TIPOS_HITO[TIPOS_HITO.length - 1];
                      const diasRestantes = Math.ceil((new Date(h.fecha).getTime() - Date.now()) / 86400000);
                      return (
                        <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: h.completado ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${h.completado ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`, borderRadius: 6, transition: "all 0.15s" }}>
                          <button onClick={() => toggleHito(h)} style={{ width: 22, height: 22, borderRadius: 4, border: `2px solid ${h.completado ? "#22c55e" : info.color}`, background: h.completado ? "#22c55e" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 12 }}>
                            {h.completado ? "✓" : ""}
                          </button>
                          <span style={{ fontSize: 18 }}>{info.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: h.completado ? "rgba(255,255,255,0.4)" : "#fff", textDecoration: h.completado ? "line-through" : "none" }}>
                              {info.label}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>
                              {fmtFecha(h.fecha)}
                              {!h.completado && diasRestantes <= 7 && diasRestantes >= 0 && (
                                <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 600 }}>· en {diasRestantes}d</span>
                              )}
                              {!h.completado && diasRestantes < 0 && (
                                <span style={{ marginLeft: 8, color: "#ef4444", fontWeight: 600 }}>· vencido hace {Math.abs(diasRestantes)}d</span>
                              )}
                            </div>
                            {h.notas && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>{h.notas}</div>}
                          </div>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, background: `${info.color}15`, color: info.color, border: `1px solid ${info.color}30` }}>
                            {info.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Financiero ── */}
            {tab === "financiero" && fin && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="nd-card" style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Valor de la operación</div>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#fff" }}>{fmtMon(fin.v, negocio.moneda)}</div>
                  </div>
                  <div className="nd-card" style={{ textAlign: "center", border: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.04)" }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(34,197,94,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Honorario neto estimado</div>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{fmtMon(fin.honNeto, negocio.moneda)}</div>
                  </div>
                </div>

                {/* Desglose */}
                <div className="nd-card">
                  <div className="nd-label" style={{ marginBottom: 12 }}>Desglose de honorarios</div>
                  <div className="nd-row">
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>Honorario bruto ({fin.hPct}%)</span>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>{fmtMon(fin.honBruto, negocio.moneda)}</span>
                  </div>
                  <div className="nd-row">
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>IIBB (5.5%)</span>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#ef4444" }}>− {fmtMon(fin.iibb, negocio.moneda)}</span>
                  </div>
                  <div className="nd-row">
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>IVA (21%)</span>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#ef4444" }}>− {fmtMon(fin.iva, negocio.moneda)}</span>
                  </div>
                  <div className="nd-row" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#22c55e" }}>Honorario neto</span>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: "#22c55e" }}>{fmtMon(fin.honNeto, negocio.moneda)}</span>
                  </div>
                  {fin.sPct > 0 && (
                    <div className="nd-row">
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Mi parte ({100 - fin.sPct}% del bruto)</span>
                      <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{fmtMon(fin.miParte, negocio.moneda)}</span>
                    </div>
                  )}
                </div>

                {/* Link a split */}
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Calculá el split exacto con la calculadora de honorarios:</span>
                  <Link href="/calculadoras/split" style={{ fontSize: 11, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textDecoration: "none" }}>Split Honorarios ↗</Link>
                </div>
              </div>
            )}

            {/* ── Tab: Post-cierre ── */}
            {tab === "postcierrer" && (
              <div className="nd-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Checklist post-cierre</div>
                  <Link href="/crm/post-cierre" style={{ padding: "7px 12px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textDecoration: "none" }}>
                    Gestionar ↗
                  </Link>
                </div>
                {postCierre.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", fontSize: 12 }}>
                    Sin items post-cierre. Usá <Link href="/crm/post-cierre" style={{ color: "#cc0000" }}>Post-Cierre</Link> para agregar.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {postCierre.map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: p.completado ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${p.completado ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)"}`, borderRadius: 6 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 3, border: `2px solid ${p.completado ? "#22c55e" : "rgba(255,255,255,0.2)"}`, background: p.completado ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>
                          {p.completado ? "✓" : ""}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontFamily: "Inter,sans-serif", color: p.completado ? "rgba(255,255,255,0.35)" : "#fff", textDecoration: p.completado ? "line-through" : "none" }}>{p.titulo}</div>
                          {p.fecha_limite && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>Límite: {fmtFecha(p.fecha_limite)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: agregar hito ── */}
      {modalHito && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 24, width: "100%", maxWidth: 420 }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 18 }}>Agregar hito</div>
            <div style={{ marginBottom: 12 }}>
              <label className="nd-label">Tipo de hito</label>
              <select className="nd-select" value={modalHito.tipo} onChange={e => setModalHito(prev => prev ? { ...prev, tipo: e.target.value } : null)}>
                {TIPOS_HITO.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="nd-label">Fecha</label>
              <input className="nd-input" type="date" value={modalHito.fecha} onChange={e => setModalHito(prev => prev ? { ...prev, fecha: e.target.value } : null)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="nd-label">Notas (opcional)</label>
              <input className="nd-input" placeholder="Ej: Ante escribano Martínez" value={modalHito.notas} onChange={e => setModalHito(prev => prev ? { ...prev, notas: e.target.value } : null)} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="nd-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }} onClick={() => setModalHito(null)}>Cancelar</button>
              <button className="nd-btn" style={{ background: "#cc0000", color: "#fff", opacity: guardandoHito ? 0.6 : 1 }} onClick={agregarHito} disabled={guardandoHito}>
                {guardandoHito ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}
    </>
  );
}
