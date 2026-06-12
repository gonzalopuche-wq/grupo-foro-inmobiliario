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

interface Lista {
  id: string;
  nombre: string;
  color: string;
  orden: number;
}

// Paleta tipo "Listas" de WhatsApp Business.
const COLORES_LISTA = [
  "#a0846b", "#8b5cf6", "#c084fc", "#a3e635", "#f97316",
  "#d946ef", "#c0b94d", "#3b82f6", "#14b8a6", "#ef4444",
];

const TIPO_BADGE: Record<string, string> = {
  cliente:    "gfi-badge--blue",
  propietario:"gfi-badge--green",
  colega:     "gfi-badge--gray",
  proveedor:  "gfi-badge--orange",
  otro:       "gfi-badge--gray",
};

const ESTADO_BADGE: Record<string, string> = {
  "lead:nuevo":          "gfi-badge--gray",
  "lead:evolucionando":  "gfi-badge--green",
  "lead:esperando":      "gfi-badge--blue",
  "lead:tomar_accion":   "gfi-badge--orange",
  "lead:congelado":      "gfi-badge--gray",
  "lead:cerrado_lead":   "gfi-badge--green",
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

function avatarHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const hues = [210, 145, 265, 25, 330, 185, 15];
  return hues[Math.abs(h) % hues.length];
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
  // Listas de colores (estilo WhatsApp Business)
  const [listas, setListas] = useState<Lista[]>([]);
  const [itemsPorContacto, setItemsPorContacto] = useState<Record<string, string[]>>({});
  const [filtroLista, setFiltroLista] = useState("");
  const [popoverContacto, setPopoverContacto] = useState<string | null>(null);
  const [gestionarListas, setGestionarListas] = useState(false);
  const [nuevaListaNombre, setNuevaListaNombre] = useState("");
  const [nuevaListaColor, setNuevaListaColor] = useState(COLORES_LISTA[1]);
  const [guardandoLista, setGuardandoLista] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return; }
      setUserId(data.user.id);
      cargar(data.user.id);
      cargarListas(data.user.id);
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

  async function cargarListas(uid: string) {
    const [{ data: ls }, { data: items }] = await Promise.all([
      supabase.from("crm_listas").select("id,nombre,color,orden").eq("perfil_id", uid).order("orden").order("created_at"),
      supabase.from("crm_listas_items").select("lista_id,contacto_id").eq("perfil_id", uid).not("contacto_id", "is", null),
    ]);
    setListas((ls ?? []) as Lista[]);
    const mapa: Record<string, string[]> = {};
    (items ?? []).forEach((it: any) => {
      if (!it.contacto_id) return;
      (mapa[it.contacto_id] ??= []).push(it.lista_id);
    });
    setItemsPorContacto(mapa);
  }

  async function crearLista() {
    if (!userId || !nuevaListaNombre.trim()) return;
    setGuardandoLista(true);
    const { data, error } = await supabase.from("crm_listas")
      .insert({ perfil_id: userId, nombre: nuevaListaNombre.trim(), color: nuevaListaColor, orden: listas.length })
      .select("id,nombre,color,orden").single();
    setGuardandoLista(false);
    if (error || !data) { alert("No se pudo crear la lista: " + (error?.message ?? "error desconocido")); return; }
    setListas(prev => [...prev, data as Lista]);
    setNuevaListaNombre("");
  }

  async function eliminarLista(id: string) {
    if (!confirm("¿Eliminar esta lista? Se quita de todos los contactos (no los borra).")) return;
    const { error } = await supabase.from("crm_listas").delete().eq("id", id);
    if (error) { alert("No se pudo eliminar la lista: " + error.message); return; }
    setListas(prev => prev.filter(l => l.id !== id));
    setItemsPorContacto(prev => {
      const next: Record<string, string[]> = {};
      for (const k of Object.keys(prev)) next[k] = prev[k].filter(lid => lid !== id);
      return next;
    });
    if (filtroLista === id) setFiltroLista("");
  }

  async function toggleContactoEnLista(contactoId: string, listaId: string) {
    if (!userId) return;
    const yaEsta = (itemsPorContacto[contactoId] ?? []).includes(listaId);
    // Optimista
    setItemsPorContacto(prev => {
      const actuales = prev[contactoId] ?? [];
      return { ...prev, [contactoId]: yaEsta ? actuales.filter(l => l !== listaId) : [...actuales, listaId] };
    });
    if (yaEsta) {
      const { error } = await supabase.from("crm_listas_items").delete()
        .eq("lista_id", listaId).eq("contacto_id", contactoId);
      if (error) cargarListas(userId);
    } else {
      const { error } = await supabase.from("crm_listas_items")
        .insert({ lista_id: listaId, perfil_id: userId, contacto_id: contactoId });
      if (error) cargarListas(userId);
    }
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
    if (filtroLista) list = list.filter(c => (itemsPorContacto[c.id] ?? []).includes(filtroLista));
    return list;
  }, [contactos, busqueda, filtroTipo, filtroLista, itemsPorContacto]);

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
        /* ── Contactos GFI ── */
        .con-header {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px; margin-bottom: 22px;
        }
        .con-titulo {
          font-family: var(--font-display);
          font-size: 22px; font-weight: 800; color: var(--gfi-text-primary);
          letter-spacing: -0.01em;
        }
        .con-titulo span { color: var(--gfi-red); }
        .con-subtitulo {
          font-size: 12px; color: var(--gfi-text-secondary);
          margin-top: 2px; font-family: var(--font-body);
        }

        /* Filter bar */
        .con-filter-bar {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          padding: 10px 14px;
          background: var(--gfi-bg-card);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg);
          margin-bottom: 16px;
        }
        .con-search {
          flex: 1; min-width: 180px;
          padding: 7px 12px;
          background: var(--gfi-bg-input);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md);
          color: var(--gfi-text-primary);
          font-size: 13px; outline: none;
          font-family: var(--font-body);
          transition: var(--gfi-transition);
        }
        .con-search:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px rgba(153,0,0,0.1); }
        .con-search::placeholder { color: var(--gfi-text-muted); }

        /* List */
        .con-lista { display: flex; flex-direction: column; gap: 6px; }
        .con-item {
          background: var(--gfi-bg-card);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg);
          padding: 13px 16px;
          display: flex; align-items: center; gap: 13px;
          transition: var(--gfi-transition);
          animation: gfi-fade-in 0.2s ease both;
        }
        .con-item:hover {
          border-color: var(--gfi-border-bright);
          background: var(--gfi-bg-elevated);
          box-shadow: var(--gfi-shadow-sm);
        }
        .con-avatar {
          width: 42px; height: 42px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 13px; font-weight: 800;
          flex-shrink: 0; position: relative;
        }
        .con-info { flex: 1; min-width: 0; }
        .con-nombre {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700; color: var(--gfi-text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .con-meta {
          display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 5px;
        }
        .con-contact-data {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--gfi-text-secondary);
        }
        .con-inmob {
          font-size: 11px; color: var(--gfi-text-muted);
          font-family: var(--font-body);
        }
        .con-acciones { display: flex; gap: 5px; flex-shrink: 0; }
        .con-btn-sm {
          padding: 5px 10px; border-radius: var(--gfi-radius-sm);
          font-size: 10px; font-weight: 700; cursor: pointer;
          border: 1px solid; font-family: var(--font-display);
          letter-spacing: 0.06em; text-transform: uppercase;
          transition: var(--gfi-transition); text-decoration: none;
          display: inline-flex; align-items: center;
        }
        .con-btn-ver {
          background: transparent;
          border-color: var(--gfi-border);
          color: var(--gfi-text-secondary);
        }
        .con-btn-ver:hover { border-color: var(--gfi-red-border); color: var(--gfi-red); background: var(--gfi-red-soft); }
        .con-btn-edit {
          background: transparent;
          border-color: var(--gfi-border);
          color: var(--gfi-text-muted);
        }
        .con-btn-edit:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-secondary); background: var(--gfi-bg-hover); }
        .con-btn-del {
          background: transparent;
          border-color: rgba(153,0,0,0.2);
          color: rgba(153,0,0,0.5);
        }
        .con-btn-del:hover { background: var(--gfi-red-soft); border-color: var(--gfi-red-border); color: var(--gfi-red); }
        .con-wa {
          color: #25d366; text-decoration: none; font-size: 14px;
          display: inline-flex; align-items: center;
        }
        .con-empty {
          text-align: center; padding: 52px 24px;
          color: var(--gfi-text-muted); font-size: 13px;
          font-family: var(--font-body);
          border: 1px dashed var(--gfi-border-subtle);
          border-radius: var(--gfi-radius-lg);
        }

        /* Modal */
        .con-modal-bg {
          position: fixed; inset: 0; background: rgba(0,0,0,0.78);
          z-index: 200; display: flex; align-items: flex-end;
          justify-content: center; padding: 0;
          backdrop-filter: blur(4px);
        }
        @media(min-width:600px){ .con-modal-bg { align-items: center; padding: 24px; } }
        .con-modal {
          background: var(--gfi-bg-card);
          border: 1px solid var(--gfi-border);
          border-radius: 16px 16px 0 0;
          width: 100%; max-width: 540px; max-height: 90vh;
          overflow-y: auto; padding: 26px; position: relative;
          box-shadow: var(--gfi-shadow-lg);
        }
        @media(min-width:600px){ .con-modal { border-radius: var(--gfi-radius-xl); } }
        .con-modal::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: var(--gfi-red-gradient);
          border-radius: 16px 16px 0 0;
        }
        .con-modal h2 {
          font-family: var(--font-display); font-size: 16px; font-weight: 800;
          margin-bottom: 20px; color: var(--gfi-text-primary);
        }
        .con-modal h2 span { color: var(--gfi-red); }
        .con-field { margin-bottom: 13px; }
        .con-label {
          display: block; font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--gfi-text-muted); margin-bottom: 5px;
          font-family: var(--font-display);
        }
        .con-input {
          width: 100%; padding: 9px 12px;
          background: var(--gfi-bg-input);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md);
          color: var(--gfi-text-primary); font-size: 13px; outline: none;
          font-family: var(--font-body); box-sizing: border-box;
          transition: var(--gfi-transition);
        }
        .con-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px rgba(153,0,0,0.10); }
        .con-input::placeholder { color: var(--gfi-text-muted); }
        .con-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .con-modal-footer {
          display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;
          padding-top: 16px; border-top: 1px solid var(--gfi-border-subtle);
        }

        /* ── Listas de colores ── */
        .con-listas-bar {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          margin: -6px 0 16px; padding: 0 2px;
        }
        .con-listas-label {
          font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--gfi-text-muted); font-family: var(--font-display); margin-right: 2px;
        }
        .con-lista-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex-shrink: 0; margin-right: 5px; }
        .con-listas-gestionar {
          padding: 5px 12px; border-radius: 999px; border: 1px dashed var(--gfi-border);
          background: transparent; color: var(--gfi-text-secondary); font-size: 11px; cursor: pointer;
          font-family: var(--font-display); font-weight: 600; transition: var(--gfi-transition);
        }
        .con-listas-gestionar:hover { border-color: var(--gfi-red-border); color: var(--gfi-red); }
        .con-lista-badge {
          display: inline-flex; align-items: center; font-size: 10px; font-weight: 700;
          padding: 2px 8px; border-radius: 999px; font-family: var(--font-display);
        }
        /* Popover "Agregar a lista" */
        .con-pop-overlay { position: fixed; inset: 0; z-index: 90; }
        .con-pop {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 91;
          width: 230px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg); box-shadow: var(--gfi-shadow-lg); padding: 8px;
        }
        .con-pop-titulo {
          font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--gfi-text-muted); font-family: var(--font-display); padding: 4px 6px 8px;
        }
        .con-pop-vacio { font-size: 12px; color: var(--gfi-text-muted); padding: 4px 6px 8px; font-family: var(--font-body); }
        .con-pop-item {
          display: flex; align-items: center; gap: 4px; padding: 8px 6px; border-radius: var(--gfi-radius-md);
          cursor: pointer; transition: background 0.12s;
        }
        .con-pop-item:hover { background: var(--gfi-bg-hover); }
        .con-pop-nombre { flex: 1; font-size: 13px; color: var(--gfi-text-primary); font-family: var(--font-body); }
        .con-pop-check {
          width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px;
        }
        .con-pop-nueva {
          width: 100%; margin-top: 4px; padding: 8px; border-radius: var(--gfi-radius-md);
          border: none; background: transparent; color: var(--gfi-red); font-size: 12px; font-weight: 700;
          cursor: pointer; font-family: var(--font-display); text-align: left;
        }
        .con-pop-nueva:hover { background: var(--gfi-red-soft); }
        /* Gestionar listas */
        .con-colores { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .con-color-swatch { width: 26px; height: 26px; border-radius: 50%; border: none; cursor: pointer; flex-shrink: 0; }
        .con-gest-item { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px solid var(--gfi-border-subtle); }
        .con-gest-nombre { flex: 1; font-size: 13px; color: var(--gfi-text-primary); font-family: var(--font-body); }

        @media(max-width:500px){
          .con-acciones .con-btn-ver,
          .con-acciones .con-btn-edit { display: none; }
          .con-row2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="con-header">
        <div>
          <div className="con-titulo">
            Contactos <span>CRM</span>
          </div>
          <div className="con-subtitulo">
            {filtrados.length} contacto{filtrados.length !== 1 ? "s" : ""} encontrado{filtrados.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button className="gfi-btn gfi-btn--primary" onClick={() => { setForm(FORM_VACIO); setEditandoId(null); setMostrarForm(true); }}>
          + Nuevo contacto
        </button>
      </div>

      {/* Filter bar */}
      <div className="con-filter-bar">
        <input
          className="con-search"
          placeholder="Buscar por nombre, teléfono, email..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        {["", "cliente", "propietario", "colega", "proveedor", "otro"].map(t => (
          <button
            key={t}
            className={`gfi-filter-chip${filtroTipo === t ? " active" : ""}`}
            onClick={() => setFiltroTipo(t)}
          >
            {t === "" ? "Todos" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Filtro por Listas (estilo WhatsApp) */}
      <div className="con-listas-bar">
        <span className="con-listas-label">Listas</span>
        <button className={`gfi-filter-chip${filtroLista === "" ? " active" : ""}`} onClick={() => setFiltroLista("")}>Todas</button>
        {listas.map(l => (
          <button key={l.id} className={`gfi-filter-chip${filtroLista === l.id ? " active" : ""}`} onClick={() => setFiltroLista(filtroLista === l.id ? "" : l.id)}>
            <span className="con-lista-dot" style={{ background: l.color }} />
            {l.nombre}
          </button>
        ))}
        <button className="con-listas-gestionar" onClick={() => setGestionarListas(true)}>＋ Gestionar listas</button>
      </div>

      {loading ? (
        <div className="con-empty">
          <div className="gfi-skeleton" style={{ width: "100%", height: 60, borderRadius: "var(--gfi-radius-lg)", marginBottom: 6 }} />
          <div className="gfi-skeleton" style={{ width: "100%", height: 60, borderRadius: "var(--gfi-radius-lg)", marginBottom: 6 }} />
          <div className="gfi-skeleton" style={{ width: "100%", height: 60, borderRadius: "var(--gfi-radius-lg)" }} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="con-empty">
          {busqueda || filtroTipo ? "Sin resultados para esa búsqueda" : "Todavía no hay contactos — creá el primero"}
        </div>
      ) : (
        <div className="con-lista">
          {filtrados.map(c => {
            const hue = avatarHue(c.id);
            const estadoLbl = ESTADO_LABEL[c.estado ?? ""] ?? c.estado;
            const estadoBadge = ESTADO_BADGE[c.estado ?? ""] ?? "gfi-badge--gray";
            const tipoBadge = TIPO_BADGE[c.tipo ?? ""] ?? "gfi-badge--gray";
            const misListaIds = itemsPorContacto[c.id] ?? [];
            const misListas = listas.filter(l => misListaIds.includes(l.id));
            return (
              <div key={c.id} className="con-item">
                <div
                  className="con-avatar"
                  style={{
                    background: `hsla(${hue},60%,45%,0.15)`,
                    border: `1px solid hsla(${hue},60%,45%,0.30)`,
                    color: `hsl(${hue},60%,65%)`,
                  }}
                >
                  {iniciales(c.nombre, c.apellido)}
                </div>
                <div className="con-info">
                  <div className="con-nombre">{c.nombre} {c.apellido}</div>
                  <div className="con-meta">
                    {c.tipo && (
                      <span className={`gfi-badge gfi-badge--dot ${tipoBadge}`}>
                        {c.tipo}
                      </span>
                    )}
                    {c.estado && (
                      <span className={`gfi-badge ${estadoBadge}`}>
                        {estadoLbl}
                      </span>
                    )}
                    {c.telefono && (
                      <span className="con-contact-data">{c.telefono}</span>
                    )}
                    {c.email && (
                      <span className="con-contact-data">{c.email}</span>
                    )}
                    {c.inmobiliaria && <span className="con-inmob">{c.inmobiliaria}</span>}
                    {c.telefono && (
                      <a href={`https://wa.me/${c.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="con-wa" title="WhatsApp">
                        💬
                      </a>
                    )}
                    {misListas.map(l => (
                      <span key={l.id} className="con-lista-badge" style={{ background: `${l.color}22`, color: l.color, border: `1px solid ${l.color}55` }}>
                        <span className="con-lista-dot" style={{ background: l.color }} />{l.nombre}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="con-acciones" style={{ position: "relative" }}>
                  <button className="con-btn-sm con-btn-edit" onClick={() => setPopoverContacto(popoverContacto === c.id ? null : c.id)} title="Listas">🏷</button>
                  <Link href={`/crm/contactos/${c.id}`} className="con-btn-sm con-btn-ver">Ver</Link>
                  <button className="con-btn-sm con-btn-edit" onClick={() => editar(c)} title="Editar">✏</button>
                  <button className="con-btn-sm con-btn-del" onClick={() => eliminar(c.id)} title="Eliminar">×</button>

                  {popoverContacto === c.id && (
                    <>
                      <div className="con-pop-overlay" onClick={() => setPopoverContacto(null)} />
                      <div className="con-pop">
                        <div className="con-pop-titulo">Agregar a lista</div>
                        {listas.length === 0 ? (
                          <div className="con-pop-vacio">No tenés listas todavía.</div>
                        ) : listas.map(l => {
                          const on = misListaIds.includes(l.id);
                          return (
                            <div key={l.id} className="con-pop-item" onClick={() => toggleContactoEnLista(c.id, l.id)}>
                              <span className="con-lista-dot" style={{ background: l.color }} />
                              <span className="con-pop-nombre">{l.nombre}</span>
                              <span className="con-pop-check" style={{ borderColor: on ? l.color : "var(--gfi-border)", background: on ? l.color : "transparent" }}>{on ? "✓" : ""}</span>
                            </div>
                          );
                        })}
                        <button className="con-pop-nueva" onClick={() => { setPopoverContacto(null); setGestionarListas(true); }}>＋ Nueva lista</button>
                      </div>
                    </>
                  )}
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
              <button className="gfi-btn gfi-btn--secondary" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
              <button className="gfi-btn gfi-btn--primary" onClick={guardar} disabled={guardando || !form.nombre.trim()}>
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear contacto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: gestionar listas */}
      {gestionarListas && (
        <div className="con-modal-bg" onClick={e => { if (e.target === e.currentTarget) setGestionarListas(false); }}>
          <div className="con-modal" style={{ maxWidth: 460 }}>
            <h2>Tus <span>listas</span></h2>

            {/* Crear nueva */}
            <div className="con-field">
              <label className="con-label">Nueva lista</label>
              <input className="con-input" value={nuevaListaNombre} onChange={e => setNuevaListaNombre(e.target.value)}
                placeholder="Ej: Venta en curso, Propietarios…" maxLength={40}
                onKeyDown={e => { if (e.key === "Enter") crearLista(); }} />
              <div className="con-colores">
                {COLORES_LISTA.map(c => (
                  <button key={c} type="button" onClick={() => setNuevaListaColor(c)}
                    className="con-color-swatch" style={{ background: c, outline: nuevaListaColor === c ? "2px solid #fff" : "none", outlineOffset: 2 }} />
                ))}
              </div>
              <button className="gfi-btn gfi-btn--primary" style={{ marginTop: 12, width: "100%" }}
                onClick={crearLista} disabled={guardandoLista || !nuevaListaNombre.trim()}>
                {guardandoLista ? "Creando..." : "＋ Crear lista"}
              </button>
            </div>

            {/* Listas existentes */}
            {listas.length > 0 && (
              <div style={{ marginTop: 18, borderTop: "1px solid var(--gfi-border-subtle)", paddingTop: 14 }}>
                {listas.map(l => (
                  <div key={l.id} className="con-gest-item">
                    <span className="con-lista-dot" style={{ background: l.color, width: 12, height: 12 }} />
                    <span className="con-gest-nombre">{l.nombre}</span>
                    <button className="con-btn-sm con-btn-del" onClick={() => eliminarLista(l.id)} title="Eliminar lista">×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="con-modal-footer">
              <button className="gfi-btn gfi-btn--secondary" onClick={() => setGestionarListas(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ContactosPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 40, color: "var(--gfi-text-muted)", textAlign: "center", fontFamily: "var(--font-body)" }}>
        Cargando...
      </div>
    }>
      <ContactosContent />
    </Suspense>
  );
}
