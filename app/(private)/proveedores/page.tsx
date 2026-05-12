"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Proveedor {
  id: string; nombre: string; rubro: string; telefono: string | null; email: string | null;
  zona: string | null; notas: string | null; activo: boolean; created_at: string;
  referenciado_por: string;
  tipo: string; suscripcion_estado: string | null; suscripcion_vencimiento: string | null;
  monto_mensual_usd: number | null; logo_url: string | null; sitio_web: string | null;
  descripcion: string | null; destacado: boolean;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
  resenas?: Resena[]; total_resenas?: number; resenas_negativas?: number;
}
interface Resena {
  id: string; proveedor_id: string; perfil_id: string; positiva: boolean;
  comentario: string | null; created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
}

const RUBROS = ["Electricista","Plomero","Gasista","Pintor","Carpintero","Herrero","Albañil","Arquitecto","Ingeniero","Escribano","Abogado","Contador","Tasador","Fotógrafo","Marketing / Publicidad","Informática / Tecnología","Mudanza","Cerrajero","Aire acondicionado","Impermeabilizaciones","Jardín / Paisajismo","Limpieza","Seguridad","Seguros","Financiero / Inversiones","Otro"];
const FORM_VACIO = { nombre:"", rubro:"", rubro_custom:"", telefono:"", email:"", zona:"", notas:"" };

export default function ProveedoresPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("todos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [mostrarResena, setMostrarResena] = useState<string | null>(null);
  const [formResena, setFormResena] = useState({ positiva: true, comentario: "" });
  const [enviandoResena, setEnviandoResena] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (perfil?.tipo === "admin") setEsAdmin(true);
    };
    init();
    cargarProveedores();
  }, []);

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const cargarProveedores = async () => {
    setLoading(true);
    const { data } = await supabase.from("red_proveedores")
      .select(`*, perfiles!red_proveedores_referenciado_por_fkey(nombre,apellido,matricula), resenas:red_proveedores_resenas(id,positiva,comentario,created_at,perfil_id, perfiles!red_proveedores_resenas_perfil_id_fkey(nombre,apellido,matricula))`)
      .eq("activo", true).order("created_at", { ascending: false });
    setProveedores((data ?? []).map((p: any) => ({ ...p, total_resenas: p.resenas?.length ?? 0, resenas_negativas: p.resenas?.filter((r: any) => !r.positiva).length ?? 0 })) as Proveedor[]);
    setLoading(false);
  };

  const abrirEditar = (p: Proveedor) => {
    const esCustom = !RUBROS.slice(0,-1).includes(p.rubro);
    setForm({ nombre: p.nombre, rubro: esCustom ? "Otro" : p.rubro, rubro_custom: esCustom ? p.rubro : "", telefono: p.telefono ?? "", email: p.email ?? "", zona: p.zona ?? "", notas: p.notas ?? "" });
    setEditandoId(p.id);
    setMostrarForm(true);
  };

  const guardar = async () => {
    const rubroFinal = form.rubro === "Otro" ? form.rubro_custom : form.rubro;
    if (!form.nombre || !rubroFinal || !userId) return;
    setGuardando(true);
    const payload = { nombre: form.nombre, rubro: rubroFinal, telefono: form.telefono || null, email: form.email || null, zona: form.zona || null, notas: form.notas || null };
    if (editandoId) {
      await supabase.from("red_proveedores").update(payload).eq("id", editandoId);
      mostrarToast("Proveedor actualizado");
    } else {
      await supabase.from("red_proveedores").insert({ ...payload, referenciado_por: userId, activo: true });
      mostrarToast("Proveedor agregado");
    }
    setGuardando(false); setMostrarForm(false); setEditandoId(null); setForm(FORM_VACIO);
    cargarProveedores();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este proveedor definitivamente?")) return;
    await supabase.from("red_proveedores").delete().eq("id", id);
    mostrarToast("Proveedor eliminado");
    cargarProveedores();
  };

  const enviarResena = async (proveedorId: string) => {
    if (!userId) return;
    setEnviandoResena(true);
    const { data: yaReseno } = await supabase.from("red_proveedores_resenas").select("id").eq("proveedor_id", proveedorId).eq("perfil_id", userId).maybeSingle();
    if (yaReseno) { mostrarToast("Ya dejaste una reseña para este proveedor", "err"); setEnviandoResena(false); return; }
    await supabase.from("red_proveedores_resenas").insert({ proveedor_id: proveedorId, perfil_id: userId, positiva: formResena.positiva, comentario: formResena.comentario || null });
    const { data: resenas } = await supabase.from("red_proveedores_resenas").select("positiva").eq("proveedor_id", proveedorId);
    const negativas = (resenas ?? []).filter((r: any) => !r.positiva).length;
    if (negativas >= 3) { await supabase.from("red_proveedores").update({ activo: false }).eq("id", proveedorId); mostrarToast("El proveedor fue dado de baja por 3 reseñas negativas.", "err"); }
    else { mostrarToast("Reseña enviada"); }
    setEnviandoResena(false); setMostrarResena(null); setFormResena({ positiva: true, comentario: "" });
    cargarProveedores();
  };

  const rubrosUnicos = ["todos", ...Array.from(new Set(proveedores.map(p => p.rubro))).sort()];
  const filtrados = proveedores.filter(p => {
    if (filtroRubro !== "todos" && p.rubro !== filtroRubro) return false;
    if (busqueda.trim()) { const q = busqueda.toLowerCase(); return p.nombre.toLowerCase().includes(q) || p.rubro.toLowerCase().includes(q) || p.zona?.toLowerCase().includes(q) || p.notas?.toLowerCase().includes(q) || `${p.perfiles?.nombre} ${p.perfiles?.apellido}`.toLowerCase().includes(q); }
    return true;
  });
  const sponsors = filtrados.filter(p => p.tipo === "sponsor" && p.suscripcion_estado === "activa");
  const regulares = filtrados.filter(p => !(p.tipo === "sponsor" && p.suscripcion_estado === "activa"));

  const ff = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });
  const diasHasta = (fecha: string) => Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .pv-wrap{display:flex;flex-direction:column;gap:20px}
        .pv-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .pv-titulo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:#fff}
        .pv-titulo span{color:#cc0000}
        .pv-sub{font-size:13px;color:rgba(255,255,255,0.35);margin-top:4px}
        .pv-btn-agregar{padding:10px 20px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
        .pv-btn-agregar:hover{background:#e60000}
        .pv-barra{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .pv-search-wrap{flex:1;min-width:200px;position:relative}
        .pv-search-ico{position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px;color:rgba(255,255,255,0.25)}
        .pv-search{width:100%;padding:9px 12px 9px 34px;background:rgba(14,14,14,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;font-size:13px;outline:none;font-family:'Inter',sans-serif}
        .pv-search:focus{border-color:rgba(200,0,0,0.4)}
        .pv-search::placeholder{color:rgba(255,255,255,0.2)}
        .pv-select{padding:9px 12px;background:rgba(14,14,14,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);font-size:12px;outline:none;font-family:'Inter',sans-serif;cursor:pointer}
        .pv-count{font-size:11px;color:rgba(255,255,255,0.25);white-space:nowrap}
        .pv-grid{display:flex;flex-direction:column;gap:10px}
        .pv-card{background:rgba(14,14,14,0.95);border:1px solid rgba(255,255,255,0.07);border-radius:6px;overflow:hidden;transition:border-color 0.2s}
        .pv-card:hover{border-color:rgba(255,255,255,0.12)}
        .pv-card-main{padding:16px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .pv-card-left{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}
        .pv-card-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .pv-card-nombre{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:800;color:#fff}
        .pv-rubro-badge{font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 9px;border-radius:20px;background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.25);color:#cc0000;flex-shrink:0}
        .pv-card-meta{display:flex;gap:14px;flex-wrap:wrap}
        .pv-meta-item{font-size:12px;color:rgba(255,255,255,0.45)}
        .pv-notas{font-size:12px;color:rgba(255,255,255,0.5);line-height:1.6;font-style:italic;background:rgba(255,255,255,0.03);border-left:2px solid rgba(200,0,0,0.3);padding:8px 12px;border-radius:0 4px 4px 0}
        .pv-referenciado{font-size:11px;color:rgba(255,255,255,0.3);display:flex;align-items:center;gap:5px;flex-wrap:wrap}
        .pv-referenciado strong{color:rgba(255,255,255,0.6)}
        .pv-resenas-bar{display:flex;align-items:center;gap:8px}
        .pv-card-right{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0}
        .pv-btn{padding:6px 12px;border-radius:3px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;white-space:nowrap}
        .pv-btn-wa{display:flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);border-radius:3px;color:#25d366;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;transition:all 0.2s;white-space:nowrap}
        .pv-btn-wa:hover{background:rgba(37,211,102,0.2)}
        .pv-btn-resena{background:transparent;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.4)}
        .pv-btn-resena:hover{border-color:rgba(255,255,255,0.3);color:#fff}
        .pv-btn-editar{background:transparent;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.45)}
        .pv-btn-editar:hover{border-color:rgba(255,255,255,0.3);color:#fff}
        .pv-btn-eliminar{background:transparent;border:1px solid rgba(200,0,0,0.25);color:rgba(200,0,0,0.6)}
        .pv-btn-eliminar:hover{background:rgba(200,0,0,0.1);color:#ff4444;border-color:#ff4444}
        .pv-btn-expandir{background:transparent;border:none;color:rgba(255,255,255,0.25);cursor:pointer;padding:4px 8px;transition:color 0.2s;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em}
        .pv-btn-expandir:hover{color:rgba(255,255,255,0.6)}
        .pv-detalle{border-top:1px solid rgba(255,255,255,0.06);padding:14px 20px;background:rgba(0,0,0,0.15);animation:fadeIn 0.2s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .pv-detalle-titulo{font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:10px}
        .pv-resenas-lista{display:flex;flex-direction:column;gap:8px}
        .pv-resena-item{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:4px;padding:10px 14px;display:flex;flex-direction:column;gap:4px}
        .pv-resena-item.positiva{border-left:2px solid rgba(34,197,94,0.4)}
        .pv-resena-item.negativa{border-left:2px solid rgba(200,0,0,0.4)}
        .pv-resena-header{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
        .pv-resena-autor{font-size:11px;color:rgba(255,255,255,0.5)}
        .pv-resena-tipo{font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;font-family:'Montserrat',sans-serif}
        .pv-resena-tipo.pos{color:#22c55e}
        .pv-resena-tipo.neg{color:#ff4444}
        .pv-resena-comentario{font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5}
        .pv-sin-resenas{font-size:12px;color:rgba(255,255,255,0.2);font-style:italic}
        .pv-empty{padding:64px 32px;text-align:center;color:rgba(255,255,255,0.2);font-size:14px;font-style:italic;background:rgba(14,14,14,0.9);border:1px solid rgba(255,255,255,0.07);border-radius:6px}
        .pv-spinner{display:flex;align-items:center;justify-content:center;padding:48px}
        .pv-spin{width:28px;height:28px;border:2px solid rgba(200,0,0,0.2);border-top-color:#cc0000;border-radius:50%;animation:spin 0.7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:400;padding:24px}
        .modal{background:#0f0f0f;border:1px solid rgba(200,0,0,0.25);border-radius:6px;padding:28px 30px;width:100%;max-width:520px;position:relative;max-height:92vh;overflow-y:auto}
        .modal::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#cc0000,transparent);border-radius:6px 6px 0 0}
        .modal-titulo{font-family:'Montserrat',sans-serif;font-size:16px;font-weight:800;color:#fff;margin-bottom:20px}
        .modal-titulo span{color:#cc0000}
        .modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .modal-grid .full{grid-column:1/-1}
        .field{display:flex;flex-direction:column;gap:5px}
        .field label{font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.35)}
        .field input,.field select,.field textarea{padding:9px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;font-size:13px;outline:none;font-family:'Inter',sans-serif;transition:border-color 0.2s;width:100%}
        .field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(200,0,0,0.4)}
        .field input::placeholder,.field textarea::placeholder{color:rgba(255,255,255,0.2)}
        .field select{background:#0f0f0f}
        .field textarea{resize:vertical;min-height:90px}
        .modal-nota{font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:4px;border:1px solid rgba(255,255,255,0.07)}
        .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.07)}
        .btn-cancel{padding:9px 18px;background:transparent;border:1px solid rgba(255,255,255,0.14);border-radius:4px;color:rgba(255,255,255,0.45);font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer}
        .btn-save{padding:9px 22px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer}
        .btn-save:hover:not(:disabled){background:#e60000}
        .btn-save:disabled{opacity:0.6;cursor:not-allowed}
        .resena-toggle{display:flex;gap:8px;margin-bottom:12px}
        .resena-toggle-btn{flex:1;padding:10px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:transparent;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s}
        .resena-toggle-btn.pos.activo{border-color:rgba(34,197,94,0.5);background:rgba(34,197,94,0.1);color:#22c55e}
        .resena-toggle-btn.neg.activo{border-color:rgba(200,0,0,0.5);background:rgba(200,0,0,0.1);color:#ff4444}
        .resena-toggle-btn:not(.activo){color:rgba(255,255,255,0.3)}
        .toast{position:fixed;bottom:28px;right:28px;padding:12px 20px;border-radius:5px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;z-index:999;animation:toastIn 0.3s ease}
        .toast.ok{background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.35);color:#22c55e}
        .toast.err{background:rgba(200,0,0,0.15);border:1px solid rgba(200,0,0,0.35);color:#ff6666}
        @keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:600px){.pv-card-main{flex-direction:column}.pv-card-right{flex-direction:row;align-items:center;flex-wrap:wrap}.modal-grid{grid-template-columns:1fr}.modal-grid .full{grid-column:1}}
        .pv-seccion-label{font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:10px;display:flex;align-items:center;gap:8px}
        .pv-seccion-label::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.07)}
        .pv-sponsors-grid{display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
        .pv-sponsor-card{background:rgba(14,14,14,0.98);border:1px solid rgba(200,0,0,0.25);border-radius:8px;overflow:hidden;transition:border-color 0.2s;position:relative}
        .pv-sponsor-card:hover{border-color:rgba(200,0,0,0.5)}
        .pv-sponsor-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#cc0000 40%,transparent)}
        .pv-sponsor-inner{padding:18px 20px;display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap}
        .pv-sponsor-logo{width:56px;height:56px;border-radius:8px;object-fit:cover;background:rgba(255,255,255,0.05);flex-shrink:0;border:1px solid rgba(255,255,255,0.08)}
        .pv-sponsor-logo-placeholder{width:56px;height:56px;border-radius:8px;background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
        .pv-sponsor-body{flex:1;min-width:0}
        .pv-sponsor-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
        .pv-sponsor-nombre{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:800;color:#fff}
        .pv-sponsor-badge{font-family:'Montserrat',sans-serif;font-size:8px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;padding:2px 8px;border-radius:20px;background:rgba(200,0,0,0.15);border:1px solid rgba(200,0,0,0.4);color:#cc0000}
        .pv-sponsor-desc{font-size:12px;color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:10px}
        .pv-sponsor-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .pv-sponsor-web{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.3);border-radius:4px;color:#cc0000;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-decoration:none;text-transform:uppercase;transition:all 0.2s;white-space:nowrap}
        .pv-sponsor-web:hover{background:rgba(200,0,0,0.2)}
        .pv-sponsor-venc{font-size:10px;color:rgba(255,255,255,0.25);font-family:'Inter',sans-serif}
        .pv-sponsor-venc.pronto{color:#f59e0b}
        .pv-destacado-star{color:#eab308;font-size:14px}
      `}</style>

      <div className="pv-wrap">
        <div className="pv-header">
          <div>
            <div className="pv-titulo">Red de <span>Proveedores</span></div>
            <div className="pv-sub">Referenciados por corredores de la red GFI®</div>
          </div>
          <button className="pv-btn-agregar" onClick={() => { setForm(FORM_VACIO); setEditandoId(null); setMostrarForm(true); }}>+ Agregar proveedor</button>
        </div>

        <div className="pv-barra">
          <div className="pv-search-wrap">
            <span className="pv-search-ico">🔍</span>
            <input className="pv-search" placeholder="Buscar por nombre, rubro, zona o referente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select className="pv-select" value={filtroRubro} onChange={e => setFiltroRubro(e.target.value)}>
            {rubrosUnicos.map(r => <option key={r} value={r}>{r === "todos" ? "Todos los rubros" : r}</option>)}
          </select>
          <span className="pv-count">{filtrados.length} proveedor{filtrados.length !== 1 ? "es" : ""}</span>
        </div>

        {loading ? <div className="pv-spinner"><div className="pv-spin"/></div>
         : filtrados.length === 0 ? <div className="pv-empty">{proveedores.length === 0 ? "Todavía no hay proveedores. ¡Sé el primero en agregar uno!" : "No hay proveedores con ese filtro."}</div>
         : <>
          {sponsors.length > 0 && <>
            <div className="pv-seccion-label">Sponsors GFI®</div>
            <div className="pv-sponsors-grid">
              {sponsors.map(p => {
                const dias = p.suscripcion_vencimiento ? diasHasta(p.suscripcion_vencimiento) : null;
                return (
                  <div key={p.id} className="pv-sponsor-card">
                    <div className="pv-sponsor-inner">
                      {p.logo_url
                        ? <img src={p.logo_url} alt={p.nombre} className="pv-sponsor-logo" />
                        : <div className="pv-sponsor-logo-placeholder">🏢</div>}
                      <div className="pv-sponsor-body">
                        <div className="pv-sponsor-top">
                          {p.destacado && <span className="pv-destacado-star">★</span>}
                          <span className="pv-sponsor-nombre">{p.nombre}</span>
                          <span className="pv-sponsor-badge">Sponsor GFI®</span>
                          <span className="pv-rubro-badge">{p.rubro}</span>
                        </div>
                        {p.descripcion && <p className="pv-sponsor-desc">{p.descripcion}</p>}
                        <div className="pv-sponsor-actions">
                          {p.sitio_web && <a href={p.sitio_web} target="_blank" rel="noopener noreferrer" className="pv-sponsor-web">🌐 Visitar sitio</a>}
                          {p.telefono && <a className="pv-btn-wa" href={`https://wa.me/54${p.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer">📱 WhatsApp</a>}
                          {p.email && <span className="pv-meta-item" style={{fontSize:11}}>✉️ {p.email}</span>}
                          {dias !== null && <span className={`pv-sponsor-venc${dias <= 15 ? " pronto" : ""}`}>Vigente hasta {ff(p.suscripcion_vencimiento!)}{dias <= 15 ? ` · ${dias}d` : ""}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>}
          {regulares.length > 0 && sponsors.length > 0 && <div className="pv-seccion-label">Red de proveedores</div>}
          <div className="pv-grid">
          {regulares.map(p => {
            const abierto = expandido === p.id;
            const positivas = (p.resenas ?? []).filter(r => r.positiva).length;
            const negativas = p.resenas_negativas ?? 0;
            const esPropio = p.referenciado_por === userId;
            const puedeModificar = esPropio || esAdmin;
            return (
              <div key={p.id} className="pv-card">
                <div className="pv-card-main">
                  <div className="pv-card-left">
                    <div className="pv-card-top">
                      <div className="pv-card-nombre">{p.nombre}</div>
                      <span className="pv-rubro-badge">{p.rubro}</span>
                    </div>
                    <div className="pv-card-meta">
                      {p.telefono && <span className="pv-meta-item">📞 {p.telefono}</span>}
                      {p.email && <span className="pv-meta-item">✉️ {p.email}</span>}
                      {p.zona && <span className="pv-meta-item">📍 {p.zona}</span>}
                      <span className="pv-meta-item">📅 {ff(p.created_at)}</span>
                    </div>
                    {p.notas && <div className="pv-notas">💬 {p.notas}</div>}
                    <div className="pv-referenciado">
                      <span>Referenciado por</span>
                      <strong>{p.perfiles ? `${p.perfiles.apellido}, ${p.perfiles.nombre}${p.perfiles.matricula ? ` · Mat. ${p.perfiles.matricula}` : ""}` : "—"}</strong>
                      {esPropio && <span style={{fontSize:9,color:"#cc0000",fontWeight:700,background:"rgba(200,0,0,0.1)",border:"1px solid rgba(200,0,0,0.25)",padding:"1px 6px",borderRadius:10,fontFamily:"'Montserrat',sans-serif",letterSpacing:"0.08em"}}>TU REFERIDO</span>}
                    </div>
                    {(p.total_resenas ?? 0) > 0 && (
                      <div className="pv-resenas-bar">
                        {positivas > 0 && <span style={{fontSize:11,color:"#22c55e"}}>👍 {positivas} positiva{positivas!==1?"s":""}</span>}
                        {negativas > 0 && <span style={{fontSize:11,color:"#ff4444"}}>👎 {negativas} negativa{negativas!==1?"s":""}{negativas>=2&&<span style={{marginLeft:4,fontSize:9,fontWeight:700,fontFamily:"'Montserrat',sans-serif"}}>{3-negativas===1?" ⚠️ 1 más = baja automática":""}</span>}</span>}
                      </div>
                    )}
                  </div>
                  <div className="pv-card-right">
                    {p.telefono && <a className="pv-btn-wa" href={`https://wa.me/54${p.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer">📱 WhatsApp</a>}
                    <button className="pv-btn pv-btn-resena" onClick={() => { setMostrarResena(p.id); setFormResena({positiva:true,comentario:""}); }}>⭐ Reseñar</button>
                    {puedeModificar && <>
                      <button className="pv-btn pv-btn-editar" onClick={() => abrirEditar(p)}>✏️ Editar</button>
                      <button className="pv-btn pv-btn-eliminar" onClick={() => eliminar(p.id)}>🗑 Eliminar</button>
                    </>}
                    {(p.total_resenas ?? 0) > 0 && <button className="pv-btn-expandir" onClick={() => setExpandido(abierto?null:p.id)}>{abierto?"▲ Ocultar":"▼ Ver reseñas"}</button>}
                  </div>
                </div>
                {abierto && (
                  <div className="pv-detalle">
                    <div className="pv-detalle-titulo">Reseñas de la red</div>
                    {(p.resenas ?? []).length === 0 ? <div className="pv-sin-resenas">Todavía no hay reseñas.</div>
                     : <div className="pv-resenas-lista">
                      {(p.resenas ?? []).map(r => (
                        <div key={r.id} className={`pv-resena-item ${r.positiva?"positiva":"negativa"}`}>
                          <div className="pv-resena-header">
                            <span className="pv-resena-autor">{r.perfiles?`${r.perfiles.apellido}, ${r.perfiles.nombre}${r.perfiles.matricula?` · Mat. ${r.perfiles.matricula}`:""}`:"-"}</span>
                            <span className={`pv-resena-tipo ${r.positiva?"pos":"neg"}`}>{r.positiva?"👍 Positiva":"👎 Negativa"}</span>
                          </div>
                          {r.comentario && <div className="pv-resena-comentario">{r.comentario}</div>}
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.2)"}}>{ff(r.created_at)}</div>
                        </div>
                      ))}
                    </div>}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </>}
      </div>

      {mostrarForm && (
        <div className="modal-bg" onClick={e => { if(e.target===e.currentTarget){setMostrarForm(false);setEditandoId(null);} }}>
          <div className="modal">
            <div className="modal-titulo">{editandoId?"Editar":"Agregar"} <span>proveedor</span></div>
            <div className="modal-grid">
              <div className="field full"><label>Nombre *</label><input placeholder="Nombre completo o empresa" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></div>
              <div className="field full"><label>Rubro *</label><select value={form.rubro} onChange={e=>setForm(f=>({...f,rubro:e.target.value}))}><option value="">Seleccioná el rubro</option>{RUBROS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
              {form.rubro==="Otro"&&<div className="field full"><label>Especificá el rubro</label><input placeholder="Ej: Técnico en climatización" value={form.rubro_custom} onChange={e=>setForm(f=>({...f,rubro_custom:e.target.value}))}/></div>}
              <div className="field"><label>Teléfono / WhatsApp</label><input placeholder="3412345678" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}/></div>
              <div className="field"><label>Email</label><input type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="field full"><label>Zona</label><input placeholder="Ej: Fisherton, Centro..." value={form.zona} onChange={e=>setForm(f=>({...f,zona:e.target.value}))}/></div>
              <div className="field full"><label>Notas y recomendaciones</label><textarea placeholder="Contá tu experiencia, trabajos, precios..." value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/></div>
              {!editandoId&&<div className="modal-nota full">Tu nombre y matrícula quedarán asociados como referente. Con 3 reseñas negativas el proveedor se da de baja automáticamente.</div>}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>{setMostrarForm(false);setEditandoId(null);setForm(FORM_VACIO);}}>Cancelar</button>
              <button className="btn-save" onClick={guardar} disabled={guardando||!form.nombre||!form.rubro||(form.rubro==="Otro"&&!form.rubro_custom)}>{guardando?"Guardando...":editandoId?"Guardar cambios":"Agregar proveedor"}</button>
            </div>
          </div>
        </div>
      )}

      {mostrarResena && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setMostrarResena(null);}}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-titulo">Dejar <span>reseña</span></div>
            <div className="resena-toggle">
              <button className={`resena-toggle-btn pos${formResena.positiva?" activo":""}`} onClick={()=>setFormResena(f=>({...f,positiva:true}))}>👍 Positiva</button>
              <button className={`resena-toggle-btn neg${!formResena.positiva?" activo":""}`} onClick={()=>setFormResena(f=>({...f,positiva:false}))}>👎 Negativa</button>
            </div>
            <div className="field"><label>Comentario (opcional)</label><textarea placeholder="Contá tu experiencia..." value={formResena.comentario} onChange={e=>setFormResena(f=>({...f,comentario:e.target.value}))} style={{minHeight:80}}/></div>
            {!formResena.positiva&&<div style={{fontSize:11,color:"#ff6666",padding:"8px 12px",background:"rgba(200,0,0,0.07)",borderRadius:4,border:"1px solid rgba(200,0,0,0.2)",marginTop:8}}>⚠️ Con 3 reseñas negativas el proveedor se da de baja automáticamente.</div>}
            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>setMostrarResena(null)}>Cancelar</button>
              <button className="btn-save" onClick={()=>enviarResena(mostrarResena)} disabled={enviandoResena}>{enviandoResena?"Enviando...":"Enviar reseña"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
