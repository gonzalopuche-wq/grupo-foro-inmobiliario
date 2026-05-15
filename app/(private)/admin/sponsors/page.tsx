"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Sponsor {
  id: string; nombre: string; rubro: string; telefono: string | null; email: string | null;
  zona: string | null; notas: string | null; nota_admin: string | null;
  tipo: string; suscripcion_estado: string | null; suscripcion_vencimiento: string | null;
  monto_mensual_usd: number | null; logo_url: string | null; sitio_web: string | null;
  descripcion: string | null; destacado: boolean; activo: boolean; created_at: string;
  beneficio: string | null;
}
interface Solicitud {
  id: string; empresa: string; rubro: string; descripcion: string | null;
  contacto_nombre: string; contacto_email: string; contacto_telefono: string | null;
  sitio_web: string | null; mensaje: string | null; estado: string; nota_admin: string | null; created_at: string;
}
interface SponsorBeneficio {
  id: string; proveedor_id: string; titulo: string; descripcion: string | null;
  imagen_url: string | null; vigente_desde: string; vigente_hasta: string | null;
  activo: boolean; republica_frecuencia: string; republica_proxima: string | null; created_at: string;
}

const RUBROS = ["Electricista","Plomero","Gasista","Pintor","Carpintero","Albañil","Arquitecto","Ingeniero","Escribano","Abogado","Contador","Tasador","Fotógrafo","Marketing / Publicidad","Informática / Tecnología","Mudanza","Cerrajero","Seguros","Financiero / Inversiones","Otro"];
const FORM_VACIO = { nombre:"", rubro:"", telefono:"", email:"", zona:"", notas:"", nota_admin:"", logo_url:"", sitio_web:"", descripcion:"", beneficio:"", monto_mensual_usd:"", suscripcion_vencimiento:"", destacado: false };
const FORM_BEN_VACIO = { titulo:"", descripcion:"", imagen_url:"", vigente_desde: new Date().toISOString().slice(0,10), vigente_hasta:"", activo: true, republica_frecuencia:"ninguna" };

export default function AdminSponsorsPage() {
  const [tab, setTab] = useState<"sponsors"|"solicitudes">("sponsors");
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [filtro, setFiltro] = useState<"todos"|"activa"|"vencida"|"suspendida">("todos");
  const [interesadosCounts, setInteresadosCounts] = useState<Record<string,number>>({});
  const [viendoLista, setViendoLista] = useState<string | null>(null);
  const [listaInteresados, setListaInteresados] = useState<any[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  // Solicitudes
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  // Beneficios por sponsor
  const [viendoBeneficios, setViendoBeneficios] = useState<string | null>(null);
  const [beneficiosSponsor, setBeneficios] = useState<SponsorBeneficio[]>([]);
  const [loadingBeneficios, setLoadingBeneficios] = useState(false);
  const [formBen, setFormBen] = useState(FORM_BEN_VACIO);
  const [editandoBenId, setEditandoBenId] = useState<string | null>(null);
  const [mostrarFormBen, setMostrarFormBen] = useState(false);
  const [guardandoBen, setGuardandoBen] = useState(false);

  const showToast = (msg: string, tipo: "ok"|"err" = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (!p || !["admin","master"].includes(p.tipo)) { window.location.href = "/dashboard"; return; }
      setEsAdmin(true);
      cargar();
      cargarSolicitudes();
    })();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const [sponsorsRes, interesadosRes] = await Promise.all([
      supabase.from("red_proveedores").select("*").eq("tipo","sponsor").order("destacado",{ascending:false}).order("created_at",{ascending:false}),
      supabase.from("sponsor_beneficio_interesados").select("proveedor_id"),
    ]);
    setSponsors((sponsorsRes.data ?? []) as Sponsor[]);
    const counts: Record<string,number> = {};
    for (const row of (interesadosRes.data ?? [])) counts[row.proveedor_id] = (counts[row.proveedor_id]??0)+1;
    setInteresadosCounts(counts);
    setLoading(false);
  };

  const cargarSolicitudes = async () => {
    setLoadingSolicitudes(true);
    const { data } = await supabase.from("sponsor_solicitudes").select("*").order("created_at",{ascending:false});
    setSolicitudes((data ?? []) as Solicitud[]);
    setLoadingSolicitudes(false);
  };

  const aprobarSolicitud = async (s: Solicitud) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("red_proveedores").insert({
      nombre: s.empresa, rubro: s.rubro, descripcion: s.descripcion, telefono: s.contacto_telefono,
      email: s.contacto_email, sitio_web: s.sitio_web, tipo: "sponsor", suscripcion_estado: "pendiente",
      activo: true, referenciado_por: u.user!.id,
    });
    await supabase.from("sponsor_solicitudes").update({ estado: "aprobada" }).eq("id", s.id);
    showToast(`${s.empresa} creado como sponsor (pendiente pago)`);
    cargar(); cargarSolicitudes();
  };

  const rechazarSolicitud = async (id: string) => {
    await supabase.from("sponsor_solicitudes").update({ estado: "rechazada" }).eq("id", id);
    cargarSolicitudes();
  };

  const verListaInteresados = async (sponsorId: string) => {
    setViendoLista(sponsorId); setCargandoLista(true);
    const { data } = await supabase.from("sponsor_beneficio_interesados")
      .select("created_at, perfiles!sponsor_beneficio_interesados_perfil_id_fkey(numero_gfi,nombre,apellido,matricula,email)")
      .eq("proveedor_id", sponsorId).order("created_at");
    setListaInteresados((data ?? []) as any[]); setCargandoLista(false);
  };

  // ── Beneficios por sponsor ─────────────────────────────────────────────
  const abrirBeneficios = async (sponsorId: string) => {
    setViendoBeneficios(sponsorId); setLoadingBeneficios(true); setMostrarFormBen(false);
    const { data } = await supabase.from("sponsor_beneficios").select("*").eq("proveedor_id", sponsorId).order("created_at",{ascending:false});
    setBeneficios((data ?? []) as SponsorBeneficio[]); setLoadingBeneficios(false);
  };

  const guardarBeneficio = async () => {
    if (!formBen.titulo || !viendoBeneficios) return;
    setGuardandoBen(true);
    const payload = {
      proveedor_id: viendoBeneficios,
      titulo: formBen.titulo, descripcion: formBen.descripcion || null,
      imagen_url: formBen.imagen_url || null,
      vigente_desde: formBen.vigente_desde,
      vigente_hasta: formBen.vigente_hasta || null,
      activo: formBen.activo,
      republica_frecuencia: formBen.republica_frecuencia,
      republica_proxima: formBen.republica_frecuencia !== "ninguna" ? formBen.vigente_desde : null,
    };
    if (editandoBenId) {
      await supabase.from("sponsor_beneficios").update(payload).eq("id", editandoBenId);
      showToast("Beneficio actualizado");
    } else {
      await supabase.from("sponsor_beneficios").insert(payload);
      showToast("Beneficio publicado");
    }
    setGuardandoBen(false); setMostrarFormBen(false); setEditandoBenId(null); setFormBen(FORM_BEN_VACIO);
    abrirBeneficios(viendoBeneficios);
  };

  const eliminarBeneficio = async (id: string) => {
    if (!confirm("¿Eliminar este beneficio?")) return;
    await supabase.from("sponsor_beneficios").delete().eq("id", id);
    showToast("Beneficio eliminado");
    abrirBeneficios(viendoBeneficios!);
  };

  const toggleActivoBeneficio = async (b: SponsorBeneficio) => {
    await supabase.from("sponsor_beneficios").update({ activo: !b.activo }).eq("id", b.id);
    abrirBeneficios(viendoBeneficios!);
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const gfiNum = (n: number | null) => n ? `GFI-${String(n).padStart(3,"0")}` : "GFI-—";
  const abrirNuevo = () => { setForm(FORM_VACIO); setEditandoId(null); setMostrarForm(true); };
  const abrirEditar = (s: Sponsor) => {
    setForm({ nombre:s.nombre, rubro:s.rubro, telefono:s.telefono??"", email:s.email??"", zona:s.zona??"", notas:s.notas??"", nota_admin:s.nota_admin??"", logo_url:s.logo_url??"", sitio_web:s.sitio_web??"", descripcion:s.descripcion??"", beneficio:s.beneficio??"", monto_mensual_usd:s.monto_mensual_usd?.toString()??"", suscripcion_vencimiento:s.suscripcion_vencimiento??"", destacado:s.destacado });
    setEditandoId(s.id); setMostrarForm(true);
  };
  const guardar = async () => {
    if (!form.nombre||!form.rubro) return;
    setGuardando(true);
    const payload = { nombre:form.nombre, rubro:form.rubro, telefono:form.telefono||null, email:form.email||null, zona:form.zona||null, notas:form.notas||null, nota_admin:form.nota_admin||null, logo_url:form.logo_url||null, sitio_web:form.sitio_web||null, descripcion:form.descripcion||null, beneficio:form.beneficio||null, monto_mensual_usd:form.monto_mensual_usd?parseInt(form.monto_mensual_usd):null, suscripcion_vencimiento:form.suscripcion_vencimiento||null, destacado:form.destacado, tipo:"sponsor" };
    if (editandoId) { await supabase.from("red_proveedores").update(payload).eq("id",editandoId); showToast("Sponsor actualizado"); }
    else { const { data:u } = await supabase.auth.getUser(); await supabase.from("red_proveedores").insert({...payload,referenciado_por:u.user!.id,activo:true,suscripcion_estado:"activa"}); showToast("Sponsor creado"); }
    setGuardando(false); setMostrarForm(false); setEditandoId(null); cargar();
  };
  const cambiarEstado = async (id: string, estado: "activa"|"vencida"|"suspendida") => { await supabase.from("red_proveedores").update({suscripcion_estado:estado}).eq("id",id); showToast(`Estado: ${estado}`); cargar(); };
  const toggleDestacado = async (s: Sponsor) => { await supabase.from("red_proveedores").update({destacado:!s.destacado}).eq("id",s.id); cargar(); };
  const extenderMes = async (s: Sponsor) => {
    const base = s.suscripcion_vencimiento && new Date(s.suscripcion_vencimiento)>new Date() ? new Date(s.suscripcion_vencimiento) : new Date();
    base.setMonth(base.getMonth()+1);
    const nueva = base.toISOString().slice(0,10);
    await supabase.from("red_proveedores").update({suscripcion_vencimiento:nueva,suscripcion_estado:"activa"}).eq("id",s.id);
    showToast(`Extendido hasta ${nueva}`); cargar();
  };
  const ff = (iso: string) => new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
  const diasHasta = (fecha: string) => Math.ceil((new Date(fecha).getTime()-Date.now())/86400000);

  const filtrados = sponsors.filter(s => filtro==="todos"||s.suscripcion_estado===filtro);
  const stats = { total:sponsors.length, activos:sponsors.filter(s=>s.suscripcion_estado==="activa").length, vencidos:sponsors.filter(s=>s.suscripcion_estado==="vencida").length, suspendidos:sponsors.filter(s=>s.suscripcion_estado==="suspendida").length };
  const solicitudesPendientes = solicitudes.filter(s=>s.estado==="pendiente").length;

  const FRECUENCIAS = [{ v:"ninguna", l:"No publicar en Foro" },{ v:"diaria", l:"Una vez por día" },{ v:"2x_semana", l:"2 veces por semana" },{ v:"semanal", l:"Una vez por semana" }];

  if (!esAdmin) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .sp-wrap{display:flex;flex-direction:column;gap:20px}
        .sp-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .sp-titulo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:#fff}
        .sp-titulo span{color:#cc0000}
        .sp-sub{font-size:13px;color:rgba(255,255,255,0.35);margin-top:4px}
        .sp-tabs{display:flex;gap:4px;background:rgba(255,255,255,0.04);border-radius:6px;padding:4px;width:fit-content}
        .sp-tab{padding:7px 18px;border-radius:4px;border:none;background:transparent;color:rgba(255,255,255,0.4);font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;position:relative}
        .sp-tab.activo{background:rgba(200,0,0,0.15);color:#fff;border:1px solid rgba(200,0,0,0.3)}
        .sp-tab-badge{position:absolute;top:-4px;right:-4px;background:#cc0000;color:#fff;font-size:8px;font-weight:800;border-radius:10px;padding:1px 5px;min-width:16px;text-align:center}
        .sp-stats{display:flex;gap:10px;flex-wrap:wrap}
        .sp-stat{background:rgba(14,14,14,0.95);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:12px 18px;text-align:center;min-width:90px}
        .sp-stat-num{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:800;color:#fff}
        .sp-stat-num.verde{color:#22c55e} .sp-stat-num.rojo{color:#cc0000} .sp-stat-num.amarillo{color:#f59e0b}
        .sp-stat-label{font-size:9px;color:rgba(255,255,255,0.3);font-family:'Montserrat',sans-serif;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px}
        .sp-filtros{display:flex;gap:6px;flex-wrap:wrap}
        .sp-filtro-btn{padding:6px 14px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.4);font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s}
        .sp-filtro-btn.activo{border-color:rgba(200,0,0,0.4);background:rgba(200,0,0,0.1);color:#cc0000}
        .sp-btn-nuevo{padding:10px 20px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
        .sp-grid{display:flex;flex-direction:column;gap:10px}
        .sp-card{background:rgba(14,14,14,0.98);border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden}
        .sp-card.activa{border-color:rgba(34,197,94,0.2)} .sp-card.vencida{border-color:rgba(245,158,11,0.25)} .sp-card.suspendida{border-color:rgba(200,0,0,0.2)}
        .sp-card-top{padding:16px 20px;display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
        .sp-logo{width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.08);flex-shrink:0}
        .sp-logo-ph{width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .sp-info{flex:1;min-width:0}
        .sp-nombre{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .sp-badge-estado{font-size:8px;font-family:'Montserrat',sans-serif;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:20px}
        .sp-badge-estado.activa{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e}
        .sp-badge-estado.vencida{background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#f59e0b}
        .sp-badge-estado.suspendida{background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.3);color:#ff6666}
        .sp-badge-estado.sin-estado,.sp-badge-estado.pendiente{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4)}
        .sp-destacado{color:#eab308;font-size:14px}
        .sp-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px}
        .sp-meta-item{font-size:11px;color:rgba(255,255,255,0.4)}
        .sp-desc{font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;margin-top:6px;font-style:italic}
        .sp-nota-admin{font-size:11px;color:rgba(245,158,11,0.6);background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:4px;padding:6px 10px;margin-top:6px}
        .sp-beneficio{display:flex;align-items:flex-start;gap:7px;font-size:11px;color:rgba(255,255,255,0.65);background:rgba(200,0,0,0.06);border:1px solid rgba(200,0,0,0.2);border-radius:4px;padding:6px 10px;margin-top:6px;line-height:1.5}
        .sp-beneficio strong{font-family:'Montserrat',sans-serif;font-size:8px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#cc0000;margin-right:4px;flex-shrink:0}
        .sp-interesados-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:#22c55e;margin-top:6px;cursor:pointer;transition:background 0.2s}
        .sp-interesados-chip:hover{background:rgba(34,197,94,0.18)}
        .sp-interesados-chip.cero{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);cursor:default}
        .sp-lista-tabla{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
        .sp-lista-tabla th{font-family:'Montserrat',sans-serif;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.3);padding:6px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.07)}
        .sp-lista-tabla td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.75);vertical-align:middle}
        .sp-lista-tabla tr:last-child td{border-bottom:none}
        .sp-lista-tabla tr:hover td{background:rgba(255,255,255,0.02)}
        .sp-gfi-num{font-family:'Montserrat',sans-serif;font-weight:800;color:#cc0000;font-size:11px}
        .sp-lista-empty{padding:28px;text-align:center;color:rgba(255,255,255,0.2);font-style:italic;font-size:13px}
        .sp-acciones{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0}
        .sp-btn{padding:6px 12px;border-radius:3px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;white-space:nowrap;border:1px solid}
        .sp-btn-editar{background:transparent;border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.5)}
        .sp-btn-editar:hover{border-color:rgba(255,255,255,0.3);color:#fff}
        .sp-btn-extender{background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.3);color:#22c55e}
        .sp-btn-extender:hover{background:rgba(34,197,94,0.2)}
        .sp-btn-activar{background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.3);color:#22c55e}
        .sp-btn-suspender{background:rgba(200,0,0,0.1);border-color:rgba(200,0,0,0.3);color:#ff6666}
        .sp-btn-star{background:transparent;border-color:rgba(234,179,8,0.3);color:#eab308}
        .sp-btn-beneficios{background:rgba(200,0,0,0.08);border-color:rgba(200,0,0,0.3);color:#cc0000}
        .sp-btn-beneficios:hover{background:rgba(200,0,0,0.18)}
        .sp-venc{font-size:10px;padding:4px 8px;border-radius:3px;font-family:'Inter',sans-serif}
        .sp-venc.ok{background:rgba(34,197,94,0.07);color:rgba(34,197,94,0.7)}
        .sp-venc.pronto{background:rgba(245,158,11,0.1);color:#f59e0b}
        .sp-venc.vencido{background:rgba(200,0,0,0.07);color:rgba(200,0,0,0.7)}
        .sp-empty{padding:48px;text-align:center;color:rgba(255,255,255,0.2);font-size:13px;font-style:italic;background:rgba(14,14,14,0.9);border:1px solid rgba(255,255,255,0.07);border-radius:6px}
        .sp-spin-wrap{padding:48px;display:flex;justify-content:center}
        .sp-spin{width:28px;height:28px;border:2px solid rgba(200,0,0,0.2);border-top-color:#cc0000;border-radius:50%;animation:spin 0.7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        /* Solicitudes */
        .sol-card{background:rgba(14,14,14,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .sol-card.pendiente{border-color:rgba(245,158,11,0.25)}
        .sol-card.aprobada{border-color:rgba(34,197,94,0.15);opacity:0.6}
        .sol-card.rechazada{border-color:rgba(200,0,0,0.1);opacity:0.45}
        .sol-empresa{font-family:'Montserrat',sans-serif;font-size:14px;font-weight:800;color:#fff}
        .sol-rubro{font-size:9px;font-family:'Montserrat',sans-serif;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-left:8px}
        .sol-meta{font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap}
        .sol-desc{font-size:12px;color:rgba(255,255,255,0.5);margin-top:6px;line-height:1.5}
        .sol-msg{font-size:11px;color:rgba(255,255,255,0.4);margin-top:6px;padding:7px 10px;background:rgba(255,255,255,0.03);border-radius:4px;border-left:2px solid rgba(200,0,0,0.3);font-style:italic}
        .sol-acciones{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap}
        .sol-btn-aprobar{padding:7px 14px;border-radius:3px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#22c55e;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s}
        .sol-btn-aprobar:hover{background:rgba(34,197,94,0.22)}
        .sol-btn-rechazar{padding:7px 14px;border-radius:3px;background:transparent;border:1px solid rgba(200,0,0,0.2);color:rgba(200,0,0,0.6);font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer}
        .sol-estado-badge{font-size:9px;font-family:'Montserrat',sans-serif;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:20px}
        .sol-estado-badge.pendiente{background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#f59e0b}
        .sol-estado-badge.aprobada{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e}
        .sol-estado-badge.rechazada{background:rgba(200,0,0,0.08);border:1px solid rgba(200,0,0,0.2);color:rgba(200,0,0,0.7)}
        /* Beneficios modal */
        .ben-lista{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
        .ben-item{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;overflow:hidden}
        .ben-item.inactivo{opacity:0.5}
        .ben-item-img{width:100%;height:100px;object-fit:cover;display:block;background:rgba(200,0,0,0.07)}
        .ben-item-body{padding:10px 14px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
        .ben-item-info{flex:1;min-width:0}
        .ben-item-titulo{font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;color:#fff}
        .ben-item-desc{font-size:11px;color:rgba(255,255,255,0.45);margin-top:3px;line-height:1.5}
        .ben-item-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
        .ben-item-chip{font-size:9px;font-family:'Montserrat',sans-serif;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:2px 7px;border-radius:10px}
        .ben-item-chip.activo{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#22c55e}
        .ben-item-chip.inactivo{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.3)}
        .ben-item-chip.freq{background:rgba(200,0,0,0.08);border:1px solid rgba(200,0,0,0.2);color:#cc0000}
        .ben-item-chip.venc{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);color:#f59e0b}
        .ben-item-actions{display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0}
        /* Modals */
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:400;padding:24px}
        .modal{background:#0f0f0f;border:1px solid rgba(200,0,0,0.25);border-radius:8px;padding:28px 30px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;position:relative}
        .modal::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#cc0000,transparent);border-radius:8px 8px 0 0}
        .modal-titulo{font-family:'Montserrat',sans-serif;font-size:16px;font-weight:800;color:#fff;margin-bottom:20px}
        .modal-titulo span{color:#cc0000}
        .modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .modal-grid .full{grid-column:1/-1}
        .field{display:flex;flex-direction:column;gap:5px}
        .field label{font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.35)}
        .field input,.field select,.field textarea{padding:9px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;font-size:13px;outline:none;font-family:'Inter',sans-serif;transition:border-color 0.2s;width:100%}
        .field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(200,0,0,0.4)}
        .field input::placeholder,.field textarea::placeholder{color:rgba(255,255,255,0.2)}
        .field select{background:#0f0f0f} .field textarea{resize:vertical;min-height:80px}
        .field-check{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:4px;cursor:pointer}
        .field-check input{width:16px;height:16px;flex-shrink:0}
        .field-check-label{font-size:12px;color:rgba(255,255,255,0.6);font-family:'Inter',sans-serif}
        .field-check-label strong{color:#eab308}
        .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.07)}
        .btn-cancel{padding:9px 18px;background:transparent;border:1px solid rgba(255,255,255,0.14);border-radius:4px;color:rgba(255,255,255,0.45);font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer}
        .btn-save{padding:9px 22px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer}
        .btn-save:disabled{opacity:0.6;cursor:not-allowed}
        .toast{position:fixed;bottom:28px;right:28px;padding:12px 20px;border-radius:5px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;z-index:999}
        .toast.ok{background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.35);color:#22c55e}
        .toast.err{background:rgba(200,0,0,0.15);border:1px solid rgba(200,0,0,0.35);color:#ff6666}
        @media(max-width:600px){.sp-card-top{flex-direction:column}.sp-acciones{flex-direction:row;flex-wrap:wrap}.modal-grid{grid-template-columns:1fr}.modal-grid .full{grid-column:1}}
      `}</style>

      <div className="sp-wrap">
        <div className="sp-header">
          <div>
            <div className="sp-titulo">Sponsors <span>GFI®</span></div>
            <div className="sp-sub">Proveedores con suscripción activa — directorio, beneficios y solicitudes</div>
          </div>
          {tab === "sponsors" && <button className="sp-btn-nuevo" onClick={abrirNuevo}>+ Nuevo sponsor</button>}
        </div>

        {/* Tabs */}
        <div className="sp-tabs">
          <button className={`sp-tab${tab==="sponsors"?" activo":""}`} onClick={()=>setTab("sponsors")}>Sponsors</button>
          <button className={`sp-tab${tab==="solicitudes"?" activo":""}`} onClick={()=>setTab("solicitudes")} style={{position:"relative"}}>
            Solicitudes
            {solicitudesPendientes > 0 && <span className="sp-tab-badge">{solicitudesPendientes}</span>}
          </button>
        </div>

        {/* ── TAB SPONSORS ── */}
        {tab === "sponsors" && <>
          <div className="sp-stats">
            <div className="sp-stat"><div className="sp-stat-num">{stats.total}</div><div className="sp-stat-label">Total</div></div>
            <div className="sp-stat"><div className="sp-stat-num verde">{stats.activos}</div><div className="sp-stat-label">Activos</div></div>
            <div className="sp-stat"><div className="sp-stat-num amarillo">{stats.vencidos}</div><div className="sp-stat-label">Vencidos</div></div>
            <div className="sp-stat"><div className="sp-stat-num rojo">{stats.suspendidos}</div><div className="sp-stat-label">Suspendidos</div></div>
            <div className="sp-stat"><div className="sp-stat-num" style={{color:"#cc0000"}}>USD {sponsors.filter(s=>s.suscripcion_estado==="activa").reduce((a,s)=>a+(s.monto_mensual_usd??0),0)}</div><div className="sp-stat-label">Ingresos/mes</div></div>
          </div>
          <div className="sp-filtros">
            {(["todos","activa","vencida","suspendida"] as const).map(f=>(
              <button key={f} className={`sp-filtro-btn${filtro===f?" activo":""}`} onClick={()=>setFiltro(f)}>
                {f==="todos"?"Todos":f.charAt(0).toUpperCase()+f.slice(1)}{f!=="todos"&&<span style={{marginLeft:5,opacity:0.6}}>({f==="activa"?stats.activos:f==="vencida"?stats.vencidos:stats.suspendidos})</span>}
              </button>
            ))}
          </div>

          {loading ? <div className="sp-spin-wrap"><div className="sp-spin"/></div>
           : filtrados.length===0 ? <div className="sp-empty">{sponsors.length===0?"No hay sponsors todavía.":"No hay sponsors con ese estado."}</div>
           : <div className="sp-grid">
            {filtrados.map(s=>{
              const estado = s.suscripcion_estado??"sin-estado";
              const dias = s.suscripcion_vencimiento ? diasHasta(s.suscripcion_vencimiento) : null;
              return (
                <div key={s.id} className={`sp-card ${estado}`}>
                  <div className="sp-card-top">
                    {s.logo_url ? <img src={s.logo_url} alt={s.nombre} className="sp-logo"/> : <div className="sp-logo-ph">🏢</div>}
                    <div className="sp-info">
                      <div className="sp-nombre">
                        {s.destacado && <span className="sp-destacado">★</span>}
                        {s.nombre}
                        <span className={`sp-badge-estado ${estado}`}>{estado==="sin-estado"?"Sin estado":estado}</span>
                        <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>{s.rubro}</span>
                      </div>
                      <div className="sp-meta">
                        {s.monto_mensual_usd ? <span className="sp-meta-item">💰 USD {s.monto_mensual_usd}/mes</span> : null}
                        {s.telefono && <span className="sp-meta-item">📞 {s.telefono}</span>}
                        {s.email && <span className="sp-meta-item">✉️ {s.email}</span>}
                        {s.sitio_web && <a href={s.sitio_web} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#cc0000",textDecoration:"none"}}>🌐 {s.sitio_web.replace(/https?:\/\//,"")}</a>}
                      </div>
                      {s.descripcion && <div className="sp-desc">"{s.descripcion}"</div>}
                      {s.beneficio && <div className="sp-beneficio"><strong>🎁 Beneficio</strong>{s.beneficio}</div>}
                      {s.beneficio && (
                        <div className={`sp-interesados-chip${!interesadosCounts[s.id]?" cero":""}`} onClick={()=>interesadosCounts[s.id]?verListaInteresados(s.id):undefined}>
                          👥 {interesadosCounts[s.id]??0} interesado{(interesadosCounts[s.id]??0)!==1?"s":""}{ interesadosCounts[s.id]?" — ver lista":""}
                        </div>
                      )}
                      {s.nota_admin && <div className="sp-nota-admin">📝 {s.nota_admin}</div>}
                      {s.suscripcion_vencimiento && (
                        <div style={{marginTop:6}}>
                          <span className={`sp-venc ${dias===null?"":dias<=0?"vencido":dias<=15?"pronto":"ok"}`}>
                            {dias!==null&&dias<=0?`Venció ${ff(s.suscripcion_vencimiento)}`:`Vence ${ff(s.suscripcion_vencimiento)}${dias!==null&&dias<=30?` · ${dias}d`:""}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="sp-acciones">
                      <button className="sp-btn sp-btn-beneficios" onClick={()=>abrirBeneficios(s.id)}>🎁 Beneficios</button>
                      <button className="sp-btn sp-btn-editar" onClick={()=>abrirEditar(s)}>✏️ Editar</button>
                      <button className="sp-btn sp-btn-extender" onClick={()=>extenderMes(s)}>+1 mes</button>
                      <button className="sp-btn sp-btn-star" onClick={()=>toggleDestacado(s)}>{s.destacado?"★ Quitar":"☆ Destacar"}</button>
                      {estado!=="activa" && <button className="sp-btn sp-btn-activar" onClick={()=>cambiarEstado(s.id,"activa")}>✓ Activar</button>}
                      {estado==="activa" && <button className="sp-btn sp-btn-suspender" onClick={()=>cambiarEstado(s.id,"suspendida")}>⏸ Suspender</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>}
        </>}

        {/* ── TAB SOLICITUDES ── */}
        {tab === "solicitudes" && <>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",padding:"8px 0"}}>
            Solicitudes de proveedores que quieren ser sponsors. Al aprobar se crea el registro sponsor (en estado pendiente de pago).
          </div>
          {loadingSolicitudes ? <div className="sp-spin-wrap"><div className="sp-spin"/></div>
           : solicitudes.length===0 ? <div className="sp-empty">No hay solicitudes todavía.</div>
           : <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {solicitudes.map(s=>(
              <div key={s.id} className={`sol-card ${s.estado}`}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span className="sol-empresa">{s.empresa}</span>
                    <span className="sol-rubro">{s.rubro}</span>
                    <span className={`sol-estado-badge ${s.estado}`}>{s.estado}</span>
                  </div>
                  <div className="sol-meta">
                    <span>👤 {s.contacto_nombre}</span>
                    <span>✉️ {s.contacto_email}</span>
                    {s.contacto_telefono && <span>📞 {s.contacto_telefono}</span>}
                    {s.sitio_web && <a href={s.sitio_web} target="_blank" rel="noopener noreferrer" style={{color:"#cc0000",textDecoration:"none",fontSize:11}}>🌐 {s.sitio_web.replace(/https?:\/\//,"")}</a>}
                    <span style={{marginLeft:"auto",color:"rgba(255,255,255,0.2)",fontSize:10}}>{ff(s.created_at)}</span>
                  </div>
                  {s.descripcion && <div className="sol-desc">{s.descripcion}</div>}
                  {s.mensaje && <div className="sol-msg">"{s.mensaje}"</div>}
                </div>
                {s.estado === "pendiente" && (
                  <div className="sol-acciones">
                    <button className="sol-btn-aprobar" onClick={()=>aprobarSolicitud(s)}>✓ Aprobar</button>
                    <button className="sol-btn-rechazar" onClick={()=>rechazarSolicitud(s.id)}>✗ Rechazar</button>
                  </div>
                )}
              </div>
            ))}
          </div>}
        </>}
      </div>

      {/* Modal editar/crear sponsor */}
      {mostrarForm && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setMostrarForm(false);setEditandoId(null);}}}>
          <div className="modal">
            <div className="modal-titulo">{editandoId?"Editar":"Nuevo"} <span>sponsor</span></div>
            <div className="modal-grid">
              <div className="field full"><label>Nombre / Empresa *</label><input placeholder="Ej: Seguros del Sur" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></div>
              <div className="field full"><label>Rubro *</label><select value={form.rubro} onChange={e=>setForm(f=>({...f,rubro:e.target.value}))}><option value="">Seleccioná el rubro</option>{RUBROS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
              <div className="field full"><label>Descripción (visible en el directorio)</label><textarea placeholder="Breve presentación del sponsor..." value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}/></div>
              <div className="field full"><label>Beneficio exclusivo para corredores GFI® 🎁</label><textarea placeholder="Ej: 10% de descuento en seguros..." value={form.beneficio} onChange={e=>setForm(f=>({...f,beneficio:e.target.value}))} style={{minHeight:64}}/></div>
              <div className="field"><label>Teléfono / WhatsApp</label><input placeholder="3412345678" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}/></div>
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="field full"><label>Sitio web</label><input placeholder="https://..." value={form.sitio_web} onChange={e=>setForm(f=>({...f,sitio_web:e.target.value}))}/></div>
              <div className="field full"><label>URL del logo</label><input placeholder="https://... (imagen cuadrada recomendada)" value={form.logo_url} onChange={e=>setForm(f=>({...f,logo_url:e.target.value}))}/></div>
              <div className="field"><label>Monto mensual (USD)</label><input type="number" placeholder="0" value={form.monto_mensual_usd} onChange={e=>setForm(f=>({...f,monto_mensual_usd:e.target.value}))}/></div>
              <div className="field"><label>Vencimiento suscripción</label><input type="date" value={form.suscripcion_vencimiento} onChange={e=>setForm(f=>({...f,suscripcion_vencimiento:e.target.value}))}/></div>
              <div className="field full"><label>Zona / Cobertura</label><input placeholder="Ej: Rosario y Gran Rosario" value={form.zona} onChange={e=>setForm(f=>({...f,zona:e.target.value}))}/></div>
              <div className="field full"><label>Nota interna (solo admin)</label><input placeholder="Contacto comercial, condiciones, etc." value={form.nota_admin} onChange={e=>setForm(f=>({...f,nota_admin:e.target.value}))}/></div>
              <div className="full"><label className="field-check" onClick={()=>setForm(f=>({...f,destacado:!f.destacado}))}><input type="checkbox" checked={form.destacado} onChange={()=>{}}/><span className="field-check-label"><strong>★ Sponsor Destacado</strong> — aparece primero con estrella</span></label></div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>{setMostrarForm(false);setEditandoId(null);}}>Cancelar</button>
              <button className="btn-save" onClick={guardar} disabled={guardando||!form.nombre||!form.rubro}>{guardando?"Guardando...":editandoId?"Guardar cambios":"Crear sponsor"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gestión de beneficios del sponsor */}
      {viendoBeneficios && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setViendoBeneficios(null);setMostrarFormBen(false);}}}>
          <div className="modal" style={{maxWidth:620}}>
            <div className="modal-titulo">
              Beneficios — <span>{sponsors.find(s=>s.id===viendoBeneficios)?.nombre??""}</span>
            </div>

            {loadingBeneficios ? <div style={{padding:"20px",display:"flex",justifyContent:"center"}}><div className="sp-spin"/></div>
             : <div className="ben-lista">
              {beneficiosSponsor.length===0 && !mostrarFormBen && <div className="sp-lista-empty">No hay beneficios publicados para este sponsor.</div>}
              {beneficiosSponsor.map(b=>(
                <div key={b.id} className={`ben-item${!b.activo?" inactivo":""}`}>
                  {b.imagen_url && <img src={b.imagen_url} alt={b.titulo} className="ben-item-img"/>}
                  <div className="ben-item-body">
                    <div className="ben-item-info">
                      <div className="ben-item-titulo">{b.titulo}</div>
                      {b.descripcion && <div className="ben-item-desc">{b.descripcion}</div>}
                      <div className="ben-item-meta">
                        <span className={`ben-item-chip ${b.activo?"activo":"inactivo"}`}>{b.activo?"Activo":"Inactivo"}</span>
                        {b.republica_frecuencia !== "ninguna" && <span className="ben-item-chip freq">🔄 {FRECUENCIAS.find(f=>f.v===b.republica_frecuencia)?.l}</span>}
                        {b.vigente_hasta && <span className="ben-item-chip venc">hasta {ff(b.vigente_hasta)}</span>}
                        {b.republica_proxima && b.republica_frecuencia!=="ninguna" && <span style={{fontSize:9,color:"rgba(255,255,255,0.25)"}}>próx. {ff(b.republica_proxima)}</span>}
                      </div>
                    </div>
                    <div className="ben-item-actions">
                      <button className="sp-btn sp-btn-editar" style={{fontSize:8}} onClick={()=>{setFormBen({titulo:b.titulo,descripcion:b.descripcion??"",imagen_url:b.imagen_url??"",vigente_desde:b.vigente_desde,vigente_hasta:b.vigente_hasta??"",activo:b.activo,republica_frecuencia:b.republica_frecuencia});setEditandoBenId(b.id);setMostrarFormBen(true);}}>✏️</button>
                      <button className="sp-btn" style={{fontSize:8,background:b.activo?"rgba(200,0,0,0.1)":"rgba(34,197,94,0.1)",borderColor:b.activo?"rgba(200,0,0,0.3)":"rgba(34,197,94,0.3)",color:b.activo?"#ff6666":"#22c55e"}} onClick={()=>toggleActivoBeneficio(b)}>{b.activo?"⏸":"▶"}</button>
                      <button className="sp-btn sp-btn-suspender" style={{fontSize:8}} onClick={()=>eliminarBeneficio(b.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>}

            {/* Formulario agregar/editar beneficio */}
            {mostrarFormBen ? (
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(200,0,0,0.2)",borderRadius:6,padding:"16px",marginTop:8}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>
                  {editandoBenId?"Editar beneficio":"Nuevo beneficio"}
                </div>
                <div className="modal-grid" style={{gap:10}}>
                  <div className="field full"><label>Título del beneficio *</label><input placeholder="Ej: 10% de descuento en seguros para corredores GFI®" value={formBen.titulo} onChange={e=>setFormBen(f=>({...f,titulo:e.target.value}))}/></div>
                  <div className="field full"><label>Descripción</label><textarea placeholder="Detallá cómo funciona el beneficio, condiciones, etc." value={formBen.descripcion} onChange={e=>setFormBen(f=>({...f,descripcion:e.target.value}))} style={{minHeight:60}}/></div>
                  <div className="field full"><label>URL de imagen (banner/flyer)</label><input placeholder="https://... (JPG, PNG recomendado 1200x600)" value={formBen.imagen_url} onChange={e=>setFormBen(f=>({...f,imagen_url:e.target.value}))}/></div>
                  <div className="field"><label>Válido desde</label><input type="date" value={formBen.vigente_desde} onChange={e=>setFormBen(f=>({...f,vigente_desde:e.target.value}))}/></div>
                  <div className="field"><label>Válido hasta (vacío = sin límite)</label><input type="date" value={formBen.vigente_hasta} onChange={e=>setFormBen(f=>({...f,vigente_hasta:e.target.value}))}/></div>
                  <div className="field full"><label>🔄 Publicar en Foro con frecuencia</label>
                    <select value={formBen.republica_frecuencia} onChange={e=>setFormBen(f=>({...f,republica_frecuencia:e.target.value}))}>
                      {FRECUENCIAS.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                    </select>
                  </div>
                  <div className="full"><label className="field-check" onClick={()=>setFormBen(f=>({...f,activo:!f.activo}))}><input type="checkbox" checked={formBen.activo} onChange={()=>{}}/><span className="field-check-label">Beneficio <strong>activo</strong> (visible para corredores)</span></label></div>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
                  <button className="btn-cancel" onClick={()=>{setMostrarFormBen(false);setEditandoBenId(null);setFormBen(FORM_BEN_VACIO);}}>Cancelar</button>
                  <button className="btn-save" onClick={guardarBeneficio} disabled={guardandoBen||!formBen.titulo}>{guardandoBen?"Guardando...":editandoBenId?"Guardar cambios":"Publicar beneficio"}</button>
                </div>
              </div>
            ) : (
              <button style={{width:"100%",padding:"10px",background:"rgba(200,0,0,0.1)",border:"1px dashed rgba(200,0,0,0.3)",borderRadius:5,color:"#cc0000",fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",marginTop:4}} onClick={()=>{setFormBen(FORM_BEN_VACIO);setEditandoBenId(null);setMostrarFormBen(true);}}>+ Agregar beneficio</button>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>{setViendoBeneficios(null);setMostrarFormBen(false);}}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lista de interesados */}
      {viendoLista && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setViendoLista(null);}}>
          <div className="modal" style={{maxWidth:620}}>
            <div className="modal-titulo">Interesados — <span>{sponsors.find(s=>s.id===viendoLista)?.nombre??""}</span></div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:12,lineHeight:1.6}}>Lista para enviar al sponsor: Nro. GFI, nombre, matrícula COCIR y email.</div>
            {cargandoLista ? <div style={{padding:"28px",display:"flex",justifyContent:"center"}}><div className="sp-spin"/></div>
             : listaInteresados.length===0 ? <div className="sp-lista-empty">Todavía no hay corredores interesados.</div>
             : <table className="sp-lista-tabla">
              <thead><tr><th>Nro. GFI</th><th>Corredor</th><th>Mat. COCIR</th><th>Email</th></tr></thead>
              <tbody>
                {listaInteresados.map((row,i)=>{
                  const p = row.perfiles as any;
                  return <tr key={i}><td><span className="sp-gfi-num">{gfiNum(p?.numero_gfi??null)}</span></td><td>{p?.apellido?`${p.apellido}, ${p.nombre}`:"—"}</td><td style={{color:"rgba(255,255,255,0.5)"}}>{p?.matricula??"—"}</td><td style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>{p?.email??"—"}</td></tr>;
                })}
              </tbody>
            </table>}
            <div className="modal-actions"><button className="btn-cancel" onClick={()=>setViendoLista(null)}>Cerrar</button></div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
