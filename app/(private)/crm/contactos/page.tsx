"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo: string | null;
  estado: string | null;
  origen: string | null;
  interes: string | null;
  etiquetas: string[] | null;
  notas: string | null;
  inmobiliaria: string | null;
  created_at: string;
  updated_at: string;
}

const TIPO_COLOR: Record<string, string> = {
  cliente:    "#3b82f6",
  propietario:"#22c55e",
  colega:     "#8b5cf6",
  proveedor:  "#f59e0b",
  otro:       "#6b7280",
};

const ESTADO_COLOR: Record<string, string> = {
  "lead:nuevo":          "#6b7280",
  "lead:evolucionando":  "#10b981",
  "lead:esperando":      "#3b82f6",
  "lead:tomar_accion":   "#f97316",
  "lead:congelado":      "#94a3b8",
  "lead:cerrado_lead":   "#22c55e",
};

const ESTADO_LABEL: Record<string, string> = {
  "lead:nuevo":          "Nuevo",
  "lead:evolucionando":  "Evolucionando",
  "lead:esperando":      "Esperando",
  "lead:tomar_accion":   "Tomar acción",
  "lead:congelado":      "Congelado",
  "lead:cerrado_lead":   "Cerrado",
};

const FORM_VACIO = {
  nombre: "", apellido: "", telefono: "", email: "",
  tipo: "cliente", estado: "lead:nuevo", origen: "",
  interes: "", inmobiliaria: "", notas: "",
};

function iniciales(nombre: string, apellido: string) {
  return ((nombre[0] ?? "") + (apellido[0] ?? "")).toUpperCase();
}

function avatarColor(str: string) {
  const colors = ["#3b82f6","#22c55e","#8b5cf6","#f59e0b","#ec4899","#06b6d4","#f97316"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function ContactosContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(sp.get("q") ?? "");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [mostrarForm, setMostrarForm] = useState(sp.get("nuevo") === "1");
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return; }
      setUserId(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  async function cargar(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("crm_contactos")
      .select("id,nombre,apellido,telefono,email,tipo,estado,origen,interes,etiquetas,notas,inmobiliaria,created_at,updated_at")
      .eq("perfil_id", uid)
      .order("updated_at", { ascending: false });
    setContactos((data ?? []) as Contacto[]);
    setLoading(false);
  }

  const filtrados = useMemo(() => {
    let list = contactos;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(c =>
        `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
        (c.telefono ?? "").includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.inmobiliaria ?? "").toLowerCase().includes(q)
      );
    }
    if (filtroTipo) list = list.filter(c => c.tipo === filtroTipo);
    return list;
  }, [contactos, busqueda, filtroTipo]);

  async function guardar() {
    if (!userId || !form.nombre.trim()) return;
    setGuardando(true);
    const payload = {
      perfil_id:   userId,
      nombre:      form.nombre.trim(),
      apellido:    form.apellido.trim(),
      telefono:    form.telefono.trim() || null,
      email:       form.email.trim() || null,
      tipo:        form.tipo,
      estado:      form.estado,
      origen:      form.origen || null,
      interes:     form.interes || null,
      inmobiliaria:form.inmobiliaria.trim() || null,
      notas:       form.notas.trim() || null,
    };
    if (editandoId) {
      await supabase.from("crm_contactos").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editandoId);
    } else {
      await supabase.from("crm_contactos").insert(payload);
    }
    setGuardando(false);
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    cargar(userId);
  }

  function editar(c: Contacto) {
    setForm({
      nombre: c.nombre, apellido: c.apellido,
      telefono: c.telefono ?? "", email: c.email ?? "",
      tipo: c.tipo ?? "cliente", estado: c.estado ?? "lead:nuevo",
      origen: c.origen ?? "", interes: c.interes ?? "",
      inmobiliaria: c.inmobiliaria ?? "", notas: c.notas ?? "",
    });
    setEditandoId(c.id);
    setMostrarForm(true);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este contacto?")) return;
    await supabase.from("crm_contactos").delete().eq("id", id);
    setContactos(prev => prev.filter(c => c.id !== id));
  }

  const inp = (field: keyof typeof FORM_VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <>
      <style>{`
        .con-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:18px; }
        .con-titulo { font-family:'Montserrat',sans-serif; font-size:18px; font-weight:800; color:#fff; }
        .con-titulo span { color:#cc0000; }
        .con-btn-nuevo { padding:10px 20px; background:#cc0000; border:none; border-radius:6px; color:#fff; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; }
        .con-btn-nuevo:hover { background:#e60000; }
        .con-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
        .con-search { flex:1; min-width:200px; padding:9px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-size:13px; outline:none; font-family:'Inter',sans-serif; }
        .con-search:focus { border-color:rgba(204,0,0,0.4); }
        .con-search::placeholder { color:rgba(255,255,255,0.25); }
        .con-filtro { padding:9px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:rgba(255,255,255,0.7); font-size:13px; outline:none; font-family:'Inter',sans-serif; }
        .con-count { font-size:12px; color:rgba(255,255,255,0.3); align-self:center; }

        .con-lista { display:flex; flex-direction:column; gap:6px; }
        .con-item { background:#111; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px 16px; display:flex; align-items:center; gap:12px; transition:border-color 0.15s; }
        .con-item:hover { border-color:rgba(255,255,255,0.15); }
        .con-avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Montserrat',sans-serif; font-size:13px; font-weight:800; color:#fff; flex-shrink:0; }
        .con-info { flex:1; min-width:0; }
        .con-nombre { font-size:14px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .con-meta { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:3px; }
        .con-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; font-family:'Montserrat',sans-serif; }
        .con-sub { font-size:11px; color:rgba(255,255,255,0.4); }
        .con-acciones { display:flex; gap:6px; flex-shrink:0; }
        .con-btn-sm { padding:6px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; border:1px solid; font-family:'Inter',sans-serif; transition:all 0.15s; }
        .con-btn-ver { background:transparent; border-color:rgba(255,255,255,0.15); color:rgba(255,255,255,0.6); text-decoration:none; }
        .con-btn-ver:hover { border-color:rgba(255,255,255,0.4); color:#fff; }
        .con-btn-edit { background:transparent; border-color:rgba(59,130,246,0.3); color:#3b82f6; }
        .con-btn-edit:hover { background:rgba(59,130,246,0.1); }
        .con-btn-del { background:transparent; border-color:rgba(239,68,68,0.2); color:rgba(239,68,68,0.6); }
        .con-btn-del:hover { background:rgba(239,68,68,0.1); color:#ef4444; border-color:rgba(239,68,68,0.5); }

        .con-empty { text-align:center; padding:48px 24px; color:rgba(255,255,255,0.2); font-size:13px; }

        /* Modal */
        .con-modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:200; display:flex; align-items:flex-end; justify-content:center; padding:0; }
        @media(min-width:600px){ .con-modal-bg { align-items:center; padding:24px; } }
        .con-modal { background:#111; border:1px solid rgba(255,255,255,0.1); border-radius:16px 16px 0 0; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; padding:24px; position:relative; }
        @media(min-width:600px){ .con-modal { border-radius:12px; } }
        .con-modal::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#cc0000,transparent); border-radius:12px 12px 0 0; }
        .con-modal h2 { font-family:'Montserrat',sans-serif; font-size:16px; font-weight:800; margin-bottom:18px; }
        .con-modal h2 span { color:#cc0000; }
        .con-field { margin-bottom:12px; }
        .con-label { display:block; font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:5px; font-family:'Montserrat',sans-serif; }
        .con-input { width:100%; padding:10px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-size:13px; outline:none; font-family:'Inter',sans-serif; box-sizing:border-box; }
        .con-input:focus { border-color:rgba(204,0,0,0.4); }
        .con-row2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .con-modal-footer { display:flex; gap:10px; justify-content:flex-end; margin-top:18px; }
        .con-btn-cancelar { padding:10px 18px; background:transparent; border:1px solid rgba(255,255,255,0.15); border-radius:6px; color:rgba(255,255,255,0.5); font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; cursor:pointer; }
        .con-btn-guardar { padding:10px 22px; background:#cc0000; border:none; border-radius:6px; color:#fff; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; cursor:pointer; }
        .con-btn-guardar:disabled { opacity:0.6; cursor:not-allowed; }
        .con-wa { color:#25d366; text-decoration:none; font-size:16px; }

        @media(max-width:500px){
          .con-acciones .con-btn-ver,
          .con-acciones .con-btn-edit { display:none; }
          .con-row2 { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="con-header">
        <div className="con-titulo">Contactos <span>({filtrados.length})</span></div>
        <button className="con-btn-nuevo" onClick={() => { setForm(FORM_VACIO); setEditandoId(null); setMostrarForm(true); }}>
          + Nuevo contacto
        </button>
      </div>

      <div className="con-toolbar">
        <input
          className="con-search"
          placeholder="🔍  Buscar por nombre, teléfono, email..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select className="con-filtro" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="cliente">Cliente</option>
          <option value="propietario">Propietario</option>
          <option value="colega">Colega</option>
          <option value="proveedor">Proveedor</option>
          <option value="otro">Otro</option>
        </select>
      </div>

      {loading ? (
        <div className="con-empty">Cargando contactos...</div>
      ) : filtrados.length === 0 ? (
        <div className="con-empty">
          {busqueda || filtroTipo ? "No hay resultados para esa búsqueda" : "Todavía no hay contactos — creá el primero"}
        </div>
      ) : (
        <div className="con-lista">
          {filtrados.map(c => {
            const color = avatarColor(c.id);
            const estadoLbl = ESTADO_LABEL[c.estado ?? ""] ?? c.estado;
            const estadoColor = ESTADO_COLOR[c.estado ?? ""] ?? "#6b7280";
            const tipoColor = TIPO_COLOR[c.tipo ?? ""] ?? "#6b7280";
            return (
              <div key={c.id} className="con-item">
                <div className="con-avatar" style={{background: color + "33", color}}>
                  {iniciales(c.nombre, c.apellido)}
                </div>
                <div className="con-info">
                  <div className="con-nombre">{c.nombre} {c.apellido}</div>
                  <div className="con-meta">
                    {c.tipo && (
                      <span className="con-badge" style={{background: tipoColor + "22", color: tipoColor}}>
                        {c.tipo}
                      </span>
                    )}
                    {c.estado && (
                      <span className="con-badge" style={{background: estadoColor + "22", color: estadoColor}}>
                        {estadoLbl}
                      </span>
                    )}
                    {c.inmobiliaria && <span className="con-sub">{c.inmobiliaria}</span>}
                    {c.telefono && (
                      <a href={`https://wa.me/${c.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="con-wa" title="WhatsApp">
                        📱
                      </a>
                    )}
                  </div>
                </div>
                <div className="con-acciones">
                  <Link href={`/crm/contactos/${c.id}`} className="con-btn-sm con-btn-ver">Ver</Link>
                  <button className="con-btn-sm con-btn-edit" onClick={() => editar(c)}>✏️</button>
                  <button className="con-btn-sm con-btn-del" onClick={() => eliminar(c.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mostrarForm && (
        <div className="con-modal-bg" onClick={e => { if (e.target === e.currentTarget) { setMostrarForm(false); setEditandoId(null); } }}>
          <div className="con-modal">
            <h2>{editandoId ? "Editar" : "Nuevo"} <span>contacto</span></h2>
            <div className="con-row2">
              <div className="con-field">
                <label className="con-label">Nombre *</label>
                <input className="con-input" value={form.nombre} onChange={inp("nombre")} placeholder="Juan" autoFocus />
              </div>
              <div className="con-field">
                <label className="con-label">Apellido</label>
                <input className="con-input" value={form.apellido} onChange={inp("apellido")} placeholder="García" />
              </div>
            </div>
            <div className="con-row2">
              <div className="con-field">
                <label className="con-label">Teléfono / WhatsApp</label>
                <input className="con-input" value={form.telefono} onChange={inp("telefono")} placeholder="+54 341..." type="tel" />
              </div>
              <div className="con-field">
                <label className="con-label">Email</label>
                <input className="con-input" value={form.email} onChange={inp("email")} placeholder="juan@email.com" type="email" />
              </div>
            </div>
            <div className="con-row2">
              <div className="con-field">
                <label className="con-label">Tipo</label>
                <select className="con-input" value={form.tipo} onChange={inp("tipo")}>
                  <option value="cliente">Cliente</option>
                  <option value="propietario">Propietario</option>
                  <option value="colega">Colega</option>
                  <option value="proveedor">Proveedor</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="con-field">
                <label className="con-label">Estado</label>
                <select className="con-input" value={form.estado} onChange={inp("estado")}>
                  <option value="lead:nuevo">Nuevo</option>
                  <option value="lead:evolucionando">Evolucionando</option>
                  <option value="lead:esperando">Esperando</option>
                  <option value="lead:tomar_accion">Tomar acción</option>
                  <option value="lead:congelado">Congelado</option>
                  <option value="lead:cerrado_lead">Cerrado</option>
                </select>
              </div>
            </div>
            <div className="con-row2">
              <div className="con-field">
                <label className="con-label">Origen</label>
                <select className="con-input" value={form.origen} onChange={inp("origen")}>
                  <option value="">— Origen —</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Referido">Referido</option>
                  <option value="Portal">Portal</option>
                  <option value="Web propia">Web propia</option>
                  <option value="Redes">Redes</option>
                  <option value="Directo">Directo</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="con-field">
                <label className="con-label">Interés</label>
                <select className="con-input" value={form.interes} onChange={inp("interes")}>
                  <option value="">— Interés —</option>
                  <option value="Comprar">Comprar</option>
                  <option value="Vender">Vender</option>
                  <option value="Alquilar">Alquilar</option>
                  <option value="Alquilar (dueño)">Alquilar (dueño)</option>
                  <option value="Invertir">Invertir</option>
                </select>
              </div>
            </div>
            <div className="con-field">
              <label className="con-label">Inmobiliaria / Empresa</label>
              <input className="con-input" value={form.inmobiliaria} onChange={inp("inmobiliaria")} placeholder="Opcional" />
            </div>
            <div className="con-field">
              <label className="con-label">Notas</label>
              <textarea className="con-input" rows={2} value={form.notas} onChange={inp("notas")} placeholder="Notas internas..." style={{resize:"vertical"}} />
            </div>
            <div className="con-modal-footer">
              <button className="con-btn-cancelar" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
              <button className="con-btn-guardar" onClick={guardar} disabled={guardando || !form.nombre.trim()}>
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear contacto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ContactosPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>Cargando...</div>}>
      <ContactosContent />
    </Suspense>
  );
}
