"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Proveedor {
  id: string;
  nombre: string;
  rubro: string;
  telefono: string | null;
  email: string | null;
  zona: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  referenciado_por: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
  resenas?: Resena[];
  total_resenas?: number;
  resenas_negativas?: number;
}

interface Resena {
  id: string;
  proveedor_id: string;
  perfil_id: string;
  positiva: boolean;
  comentario: string | null;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
}

interface Rubro {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

const FORM_VACIO = {
  nombre: "", rubro: "", rubro_custom: "",
  telefono: "", email: "", zona: "", notas: "",
};

export default function ProveedoresPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("todos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [mostrarResena, setMostrarResena] = useState<string | null>(null);
  const [formResena, setFormResena] = useState({ positiva: true, comentario: "" });
  const [enviandoResena, setEnviandoResena] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [mostrarAdminRubros, setMostrarAdminRubros] = useState(false);
  const [nuevoRubro, setNuevoRubro] = useState("");
  const [guardandoRubro, setGuardandoRubro] = useState(false);
  const [editandoRubro, setEditandoRubro] = useState<{ id: string; nombre: string } | null>(null);

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
    cargarRubros();
  }, []);

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const cargarRubros = async () => {
    const { data } = await supabase.from("red_proveedores_rubros").select("*").eq("activo", true).order("orden");
    setRubros((data as Rubro[]) ?? []);
  };

  const cargarProveedores = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("red_proveedores")
      .select(`*, perfiles!red_proveedores_referenciado_por_fkey(nombre, apellido, matricula),
        resenas:red_proveedores_resenas(id, positiva, comentario, created_at, perfil_id,
          perfiles!red_proveedores_resenas_perfil_id_fkey(nombre, apellido, matricula))`)
      .eq("activo", true).order("created_at", { ascending: false });
    const provs = (data ?? []).map((p: any) => ({
      ...p,
      total_resenas: p.resenas?.length ?? 0,
      resenas_negativas: p.resenas?.filter((r: any) => !r.positiva).length ?? 0,
    }));
    setProveedores(provs as Proveedor[]);
    setLoading(false);
  };

  const guardar = async () => {
    const rubroFinal = form.rubro === "__otro__" ? form.rubro_custom : form.rubro;
    if (!form.nombre || !rubroFinal || !userId) return;
    setGuardando(true);
    const { error } = await supabase.from("red_proveedores").insert({
      nombre: form.nombre, rubro: rubroFinal,
      telefono: form.telefono || null, email: form.email || null,
      zona: form.zona || null, notas: form.notas || null,
      referenciado_por: userId, activo: true,
    });
    setGuardando(false);
    if (error) { mostrarToast("Error al guardar", "err"); return; }
    mostrarToast("Proveedor agregado");
    setMostrarForm(false);
    setForm(FORM_VACIO);
    cargarProveedores();
  };

  const darDeBaja = async (id: string) => {
    await supabase.from("red_proveedores").update({ activo: false }).eq("id", id);
    mostrarToast("Proveedor dado de baja");
    cargarProveedores();
  };

  const enviarResena = async (proveedorId: string) => {
    if (!userId) return;
    setEnviandoResena(true);
    const { data: yaReseno } = await supabase.from("red_proveedores_resenas")
      .select("id").eq("proveedor_id", proveedorId).eq("perfil_id", userId).maybeSingle();
    if (yaReseno) { mostrarToast("Ya dejaste una reseña para este proveedor", "err"); setEnviandoResena(false); return; }
    await supabase.from("red_proveedores_resenas").insert({
      proveedor_id: proveedorId, perfil_id: userId,
      positiva: formResena.positiva, comentario: formResena.comentario || null,
    });
    const { data: resenas } = await supabase.from("red_proveedores_resenas").select("positiva").eq("proveedor_id", proveedorId);
    const negativas = (resenas ?? []).filter(r => !r.positiva).length;
    if (negativas >= 3) {
      await supabase.from("red_proveedores").update({ activo: false }).eq("id", proveedorId);
      mostrarToast("Reseña enviada. El proveedor fue dado de baja por 3 reseñas negativas.", "err");
    } else { mostrarToast("Reseña enviada"); }
    setEnviandoResena(false);
    setMostrarResena(null);
    setFormResena({ positiva: true, comentario: "" });
    cargarProveedores();
  };

  const agregarRubro = async () => {
    if (!nuevoRubro.trim()) return;
    setGuardandoRubro(true);
    const maxOrden = rubros.length > 0 ? Math.max(...rubros.map(r => r.orden)) + 1 : 1;
    const { error } = await supabase.from("red_proveedores_rubros").insert({ nombre: nuevoRubro.trim(), orden: maxOrden, activo: true });
    setGuardandoRubro(false);
    if (error) { mostrarToast("Error al agregar rubro", "err"); return; }
    mostrarToast("Rubro agregado");
    setNuevoRubro("");
    cargarRubros();
  };

  const guardarEdicionRubro = async () => {
    if (!editandoRubro || !editandoRubro.nombre.trim()) return;
    setGuardandoRubro(true);
    await supabase.from("red_proveedores_rubros").update({ nombre: editandoRubro.nombre.trim() }).eq("id", editandoRubro.id);
    setGuardandoRubro(false);
    setEditandoRubro(null);
    mostrarToast("Rubro actualizado");
    cargarRubros();
  };

  const eliminarRubro = async (id: string) => {
    await supabase.from("red_proveedores_rubros").update({ activo: false }).eq("id", id);
    mostrarToast("Rubro eliminado");
    cargarRubros();
  };

  const rubrosUnicos = ["todos", ...Array.from(new Set(proveedores.map(p => p.rubro))).sort()];
  const filtrados = proveedores.filter(p => {
    if (filtroRubro !== "todos" && p.rubro !== filtroRubro) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return p.nombre.toLowerCase().includes(q) || p.rubro.toLowerCase().includes(q) ||
        p.zona?.toLowerCase().includes(q) || p.notas?.toLowerCase().includes(q) ||
        `${p.perfiles?.nombre} ${p.perfiles?.apellido}`.toLowerCase().includes(q);
    }
    return true;
  });

  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .pv-wrap{display:flex;flex-direction:column;gap:20px}
        .pv-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .pv-titulo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:#fff}
        .pv-titulo span{color:#cc0000}
        .pv-sub{font-size:13px;color:rgba(255,255,255,0.35);margin-top:4px}
        .pv-header-btns{display:flex;gap:8px;flex-wrap:wrap}
        .pv-btn-agregar{padding:10px 20px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;transition:background 0.2s;white-space:nowrap}
        .pv-btn-agregar:hover{background:#e60000}
        .pv-btn-rubros{padding:10px 16px;background:transparent;border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:rgba(255,255,255,0.5);font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;white-space:nowrap}
        .pv-btn-rubros:hover{border-color:rgba(255,255,255,0.3);color:#fff}
        .rubros-panel{background:rgba(14,14,14,0.95);border:1px solid rgba(200,0,0,0.2);border-radius:6px;padding:20px 22px}
        .rubros-panel-title{font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;color:#fff;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
        .rubros-panel-title span{color:#cc0000}
        .rubros-agregar{display:flex;gap:8px;margin-bottom:16px}
        .rubros-input{flex:1;padding:9px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;font-size:13px;outline:none;font-family:'Inter',sans-serif}
        .rubros-input:focus{border-color:rgba(200,0,0,0.4)}
        .rubros-input::placeholder{color:rgba(255,255,255,0.2)}
        .rubros-btn-add{padding:9px 18px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
        .rubros-btn-add:hover:not(:disabled){background:#e60000}
        .rubros-btn-add:disabled{opacity:0.5;cursor:not-allowed}
        .rubros-lista{display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto}
        .rubro-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:4px}
        .rubro-item-nombre{font-size:13px;color:rgba(255,255,255,0.7);flex:1}
        .rubro-item-edit{display:flex;gap:6px}
        .rubro-btn{padding:4px 10px;border-radius:3px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;border:1px solid;transition:all 0.15s}
        .rubro-btn-edit{border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.4);background:transparent}
        .rubro-btn-edit:hover{border-color:rgba(255,255,255,0.3);color:#fff}
        .rubro-btn-del{border-color:rgba(200,0,0,0.25);color:rgba(200,0,0,0.6);background:transparent}
        .rubro-btn-del:hover{background:rgba(200,0,0,0.1);color:#ff4444}
        .rubro-edit-wrap{display:flex;gap:6px;flex:1}
        .rubro-edit-input{flex:1;padding:5px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,0,0,0.4);border-radius:3px;color:#fff;font-size:12px;outline:none;font-family:'Inter',sans-serif}
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
        .pv-meta-item{font-size:12px;color:rgba(255,255,255,0.45);display:flex;align-items:center;gap:5px}
        .pv-notas{font-size:12px;color:rgba(255,255,255,0.5);line-height:1.6;font-style:italic;background:rgba(255,255,255,0.03);border-left:2px solid rgba(200,0,0,0.3);padding:8px 12px;border-radius:0 4px 4px 0}
        .pv-referenciado{font-size:11px;color:rgba(255,255,255,0.3);display:flex;align-items:center;gap:5px;flex-wrap:wrap}
        .pv-referenciado strong{color:rgba(255,255,255,0.6)}
        .pv-resenas-bar{display:flex;align-items:center;gap:8px}
        .pv-card-right{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0}
        .pv-btn-wa{display:flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);border-radius:3px;color:#25d366;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;transition:all 0.2s;white-space:nowrap}
        .pv-btn-wa:hover{background:rgba(37,211,102,0.2)}
        .pv-btn-resena{padding:7px 14px;background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:3px;color:rgba(255,255,255,0.4);font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;white-space:nowrap}
        .pv-btn-resena:hover{border-color:rgba(255,255,255,0.3);color:#fff}
        .pv-btn-expandir{background:transparent;border:none;color:rgba(255,255,255,0.25);font-size:14px;cursor:pointer;transition:color 0.2s;padding:4px}
        .pv-btn-expandir:hover{color:rgba(255,255,255,0.6)}
        .pv-btn-baja{padding:5px 10px;background:transparent;border:1px solid rgba(200,0,0,0.25);border-radius:3px;color:rgba(200,0,0,0.6);font-family:'Montserrat',sans-serif;font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s}
        .pv-btn-baja:hover{background:rgba(200,0,0,0.1);color:#ff4444}
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
      `}</style>

      <div className="pv-wrap">
        <div className="pv-header">
          <div>
            <div className="pv-titulo">Red de <span>Proveedores</span></div>
            <div className="pv-sub">Referenciados por corredores de la red GFI®</div>
          </div>
          <div className="pv-header-btns">
            {esAdmin && (
              <button className="pv-btn-rubros" onClick={() => setMostrarAdminRubros(v => !v)}>
                {mostrarAdminRubros ? "✕ Cerrar rubros" : "⚙ Gestionar rubros"}
              </button>
            )}
            <button className="pv-btn-agregar" onClick={() => setMostrarForm(true)}>+ Agregar proveedor</button>
          </div>
        </div>

        {/* Panel admin rubros */}
        {esAdmin && mostrarAdminRubros && (
          <div className="rubros-panel">
            <div className="rubros-panel-title">
              Gestión de <span>rubros</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>{rubros.length} rubros activos</span>
            </div>
            <div className="rubros-agregar">
              <input className="rubros-input" placeholder="Nuevo rubro (ej: Técnico en climatización)"
                value={nuevoRubro} onChange={e => setNuevoRubro(e.target.value)}
                onKeyDown={e => e.key === "Enter" && agregarRubro()} />
              <button className="rubros-btn-add" onClick={agregarRubro} disabled={guardandoRubro || !nuevoRubro.trim()}>
                + Agregar
              </button>
            </div>
            <div className="rubros-lista">
              {rubros.map(r => (
                <div key={r.id} className="rubro-item">
                  {editandoRubro?.id === r.id ? (
                    <div className="rubro-edit-wrap">
                      <input className="rubro-edit-input" value={editandoRubro.nombre}
                        onChange={e => setEditandoRubro({ ...editandoRubro, nombre: e.target.value })}
                        onKeyDown={e => e.key === "Enter" && guardarEdicionRubro()} autoFocus />
                      <button className="rubro-btn rubro-btn-edit" onClick={guardarEdicionRubro} disabled={guardandoRubro}>✓ Guardar</button>
                      <button className="rubro-btn rubro-btn-del" onClick={() => setEditandoRubro(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <span className="rubro-item-nombre">{r.nombre}</span>
                      <div className="rubro-item-edit">
                        <button className="rubro-btn rubro-btn-edit" onClick={() => setEditandoRubro({ id: r.id, nombre: r.nombre })}>Editar</button>
                        <button className="rubro-btn rubro-btn-del" onClick={() => eliminarRubro(r.id)}>Eliminar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pv-barra">
          <div className="pv-search-wrap">
            <span className="pv-search-ico">🔍</span>
            <input className="pv-search" placeholder="Buscar por nombre, rubro, zona o quién lo recomendó..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select className="pv-select" value={filtroRubro} onChange={e => setFiltroRubro(e.target.value)}>
            {rubrosUnicos.map(r => <option key={r} value={r}>{r === "todos" ? "Todos los rubros" : r}</option>)}
          </select>
          <span className="pv-count">{filtrados.length} proveedor{filtrados.length !== 1 ? "es" : ""}</span>
        </div>

        {loading ? (
          <div className="pv-spinner"><div className="pv-spin" /></div>
        ) : filtrados.length === 0 ? (
          <div className="pv-empty">{proveedores.length === 0 ? "Todavía no hay proveedores. ¡Sé el primero en agregar uno!" : "No hay proveedores con ese filtro."}</div>
        ) : (
          <div className="pv-grid">
            {filtrados.map(p => {
              const abierto = expandido === p.id;
              const positivas = (p.resenas ?? []).filter(r => r.positiva).length;
              const negativas = p.resenas_negativas ?? 0;
              const esPropio = p.referenciado_por === userId;
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
                        <span className="pv-meta-item">📅 {formatFecha(p.created_at)}</span>
                      </div>
                      {p.notas && <div className="pv-notas">💬 {p.notas}</div>}
                      <div className="pv-referenciado">
                        <span>Referenciado por</span>
                        <strong>{p.perfiles ? `${p.perfiles.apellido}, ${p.perfiles.nombre}${p.perfiles.matricula ? ` · Mat. ${p.perfiles.matricula}` : ""}` : "—"}</strong>
                        {esPropio && <span style={{ fontSize: 9, color: "#cc0000", fontWeight: 700, background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.25)", padding: "1px 6px", borderRadius: 10, fontFamily: "'Montserrat',sans-serif", letterSpacing: "0.08em" }}>TU REFERIDO</span>}
                      </div>
                      {(p.total_resenas ?? 0) > 0 && (
                        <div className="pv-resenas-bar">
                          {positivas > 0 && <span style={{ fontSize: 11, color: "#22c55e" }}>👍 {positivas} positiva{positivas !== 1 ? "s" : ""}</span>}
                          {negativas > 0 && <span style={{ fontSize: 11, color: "#ff4444" }}>👎 {negativas} negativa{negativas !== 1 ? "s" : ""}{negativas >= 2 && <span style={{ marginLeft: 4, fontSize: 9, color: "#ff4444", fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>⚠️ {3 - negativas === 1 ? "1 más = baja automática" : ""}</span>}</span>}
                        </div>
                      )}
                    </div>
                    <div className="pv-card-right">
                      {p.telefono && <a className="pv-btn-wa" href={`https://wa.me/54${p.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">📱 WhatsApp</a>}
                      <button className="pv-btn-resena" onClick={() => { setMostrarResena(p.id); setFormResena({ positiva: true, comentario: "" }); }}>⭐ Reseñar</button>
                      {(esPropio || esAdmin) && <button className="pv-btn-baja" onClick={() => darDeBaja(p.id)}>Dar de baja</button>}
                      {(p.total_resenas ?? 0) > 0 && <button className="pv-btn-expandir" onClick={() => setExpandido(abierto ? null : p.id)}>{abierto ? "▲" : "▼"} Ver reseñas</button>}
                    </div>
                  </div>
                  {abierto && (
                    <div className="pv-detalle">
                      <div className="pv-detalle-titulo">Reseñas de la red</div>
                      {(p.resenas ?? []).length === 0 ? <div className="pv-sin-resenas">Todavía no hay reseñas.</div> : (
                        <div className="pv-resenas-lista">
                          {(p.resenas ?? []).map(r => (
                            <div key={r.id} className={`pv-resena-item ${r.positiva ? "positiva" : "negativa"}`}>
                              <div className="pv-resena-header">
                                <span className="pv-resena-autor">{r.perfiles ? `${r.perfiles.apellido}, ${r.perfiles.nombre}${r.perfiles.matricula ? ` · Mat. ${r.perfiles.matricula}` : ""}` : "—"}</span>
                                <span className={`pv-resena-tipo ${r.positiva ? "pos" : "neg"}`}>{r.positiva ? "👍 Positiva" : "👎 Negativa"}</span>
                              </div>
                              {r.comentario && <div className="pv-resena-comentario">{r.comentario}</div>}
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{formatFecha(r.created_at)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mostrarForm && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="modal">
            <div className="modal-titulo">Agregar <span>proveedor</span></div>
            <div className="modal-grid">
              <div className="field full"><label>Nombre *</label><input placeholder="Nombre completo o empresa" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
              <div className="field full">
                <label>Rubro *</label>
                <select value={form.rubro} onChange={e => setForm(f => ({ ...f, rubro: e.target.value }))}>
                  <option value="">Seleccioná el rubro</option>
                  {rubros.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                  <option value="__otro__">Otro (especificar)</option>
                </select>
              </div>
              {form.rubro === "__otro__" && (
                <div className="field full"><label>Especificá el rubro</label><input placeholder="Ej: Técnico en climatización" value={form.rubro_custom} onChange={e => setForm(f => ({ ...f, rubro_custom: e.target.value }))} /></div>
              )}
              <div className="field"><label>Teléfono / WhatsApp</label><input placeholder="3412345678" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div>
              <div className="field"><label>Email</label><input type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="field full"><label>Zona / Barrio donde trabaja</label><input placeholder="Ej: Fisherton, Centro, Rosario Norte..." value={form.zona} onChange={e => setForm(f => ({ ...f, zona: e.target.value }))} /></div>
              <div className="field full"><label>Notas y recomendaciones</label><textarea placeholder="Contá tu experiencia, qué trabajos hace, precios, disponibilidad..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
              <div className="modal-nota full">Tu nombre y matrícula quedarán asociados como referente. Con 3 reseñas negativas se da de baja automáticamente.</div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setMostrarForm(false); setForm(FORM_VACIO); }}>Cancelar</button>
              <button className="btn-save" onClick={guardar} disabled={guardando || !form.nombre || !form.rubro || (form.rubro === "__otro__" && !form.rubro_custom)}>
                {guardando ? "Guardando..." : "Agregar proveedor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarResena && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarResena(null); }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-titulo">Dejar <span>reseña</span></div>
            <div className="resena-toggle">
              <button className={`resena-toggle-btn pos${formResena.positiva ? " activo" : ""}`} onClick={() => setFormResena(f => ({ ...f, positiva: true }))}>👍 Positiva</button>
              <button className={`resena-toggle-btn neg${!formResena.positiva ? " activo" : ""}`} onClick={() => setFormResena(f => ({ ...f, positiva: false }))}>👎 Negativa</button>
            </div>
            <div className="field">
              <label>Comentario (opcional)</label>
              <textarea placeholder="Contá tu experiencia..." value={formResena.comentario} onChange={e => setFormResena(f => ({ ...f, comentario: e.target.value }))} style={{ minHeight: 80 }} />
            </div>
            {!formResena.positiva && <div style={{ fontSize: 11, color: "#ff6666", padding: "8px 12px", background: "rgba(200,0,0,0.07)", borderRadius: 4, border: "1px solid rgba(200,0,0,0.2)", marginTop: 8 }}>⚠️ Con 3 reseñas negativas el proveedor se da de baja automáticamente.</div>}
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setMostrarResena(null)}>Cancelar</button>
              <button className="btn-save" onClick={() => enviarResena(mostrarResena)} disabled={enviandoResena}>{enviandoResena ? "Enviando..." : "Enviar reseña"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
