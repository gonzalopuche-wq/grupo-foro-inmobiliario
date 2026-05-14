"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type TipoContrato = "full" | "part" | "freelance" | "eventual" | "a_convenir";
type TipoOferta = "oferta" | "busqueda";

interface Oferta {
  id: string;
  perfil_id: string | null;
  tipo: TipoOferta;
  titulo: string;
  descripcion: string;
  zona: string | null;
  tipo_contrato: TipoContrato | null;
  remuneracion: string | null;
  requisitos: string | null;
  contacto_email: string | null;
  contacto_tel: string | null;
  activo: boolean;
  destacado: boolean;
  vistas: number;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; foto_url: string | null; matricula: string | null } | null;
}

const CONTRATO_LABEL: Record<TipoContrato, string> = {
  full: "Jornada completa",
  part: "Part-time",
  freelance: "Freelance",
  eventual: "Eventual",
  a_convenir: "A convenir",
};

const EMPTY: Partial<Oferta> = {
  tipo: "oferta",
  titulo: "",
  descripcion: "",
  zona: "",
  tipo_contrato: "a_convenir",
  remuneracion: "",
  requisitos: "",
  contacto_email: "",
  contacto_tel: "",
};

export default function BolsaTrabajoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TipoOferta | "todas">("todas");
  const [detalle, setDetalle] = useState<Oferta | null>(null);
  const [form, setForm] = useState<Partial<Oferta>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
      setUid(data.session?.user.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    cargar();
  }, [token]);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/bolsa-trabajo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    setOfertas(d.ofertas ?? []);
    setLoading(false);
  }

  async function guardar() {
    if (!form.tipo || !form.titulo?.trim() || !form.descripcion?.trim()) {
      setError("Completá tipo, título y descripción.");
      return;
    }
    setGuardando(true);
    setError("");
    const res = await fetch("/api/bolsa-trabajo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form }),
    });
    const d = await res.json();
    if (d.error) { setError(d.error); setGuardando(false); return; }
    setShowForm(false);
    setForm(EMPTY);
    cargar();
    setGuardando(false);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Desactivar esta publicación?")) return;
    await fetch("/api/bolsa-trabajo", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    cargar();
  }

  const filtradas = ofertas.filter(o => {
    if (tab !== "todas" && o.tipo !== tab) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return o.titulo.toLowerCase().includes(q) || o.descripcion.toLowerCase().includes(q) || (o.zona ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-3xl">💼</span> Bolsa de Trabajo
            </h1>
            <p className="text-gray-400 mt-1">Ofertas y búsquedas laborales de la comunidad GFI®</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY); setShowForm(true); setDetalle(null); }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-semibold transition"
          >
            + Publicar
          </button>
        </div>

        {/* Tabs + Buscar */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex gap-2">
            {(["todas", "oferta", "busqueda"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
              >
                {t === "todas" ? "Todas" : t === "oferta" ? "Ofertas de empleo" : "Búsquedas laborales"}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Buscar por título, zona..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total activas", val: ofertas.length },
            { label: "Ofertas empleo", val: ofertas.filter(o => o.tipo === "oferta").length },
            { label: "Búsquedas", val: ofertas.filter(o => o.tipo === "busqueda").length },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{s.val}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Formulario publicar */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
              <h2 className="text-xl font-bold mb-4">
                {form.id ? "Editar publicación" : "Nueva publicación"}
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Tipo *</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoOferta }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="oferta">Oferta de empleo</option>
                    <option value="busqueda">Búsqueda laboral</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Tipo de contrato</label>
                  <select
                    value={form.tipo_contrato ?? "a_convenir"}
                    onChange={e => setForm(f => ({ ...f, tipo_contrato: e.target.value as TipoContrato }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {Object.entries(CONTRATO_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1 block">Título *</label>
                <input
                  type="text"
                  value={form.titulo ?? ""}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej: Asistente inmobiliaria zona norte"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1 block">Descripción *</label>
                <textarea
                  value={form.descripcion ?? ""}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={4}
                  placeholder="Describí el puesto o el perfil que buscás..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Zona</label>
                  <input
                    type="text"
                    value={form.zona ?? ""}
                    onChange={e => setForm(f => ({ ...f, zona: e.target.value }))}
                    placeholder="Ej: Centro, Norte Rosario"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Remuneración</label>
                  <input
                    type="text"
                    value={form.remuneracion ?? ""}
                    onChange={e => setForm(f => ({ ...f, remuneracion: e.target.value }))}
                    placeholder="Ej: $300.000 / a convenir"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1 block">Requisitos</label>
                <textarea
                  value={form.requisitos ?? ""}
                  onChange={e => setForm(f => ({ ...f, requisitos: e.target.value }))}
                  rows={2}
                  placeholder="Ej: Experiencia en atención al cliente, manejo de redes sociales..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Email de contacto</label>
                  <input
                    type="email"
                    value={form.contacto_email ?? ""}
                    onChange={e => setForm(f => ({ ...f, contacto_email: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Teléfono de contacto</label>
                  <input
                    type="text"
                    value={form.contacto_tel ?? ""}
                    onChange={e => setForm(f => ({ ...f, contacto_tel: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowForm(false); setError(""); }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition"
                >
                  {guardando ? "Guardando..." : form.id ? "Actualizar" : "Publicar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detalle oferta */}
        {detalle && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-start mb-4">
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${detalle.tipo === "oferta" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
                  {detalle.tipo === "oferta" ? "Oferta de empleo" : "Búsqueda laboral"}
                </span>
                <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>
              <h2 className="text-2xl font-bold mb-2">{detalle.titulo}</h2>

              {detalle.perfiles && (
                <p className="text-gray-400 text-sm mb-4">
                  Publicado por {detalle.perfiles.nombre} {detalle.perfiles.apellido}
                  {detalle.perfiles.matricula ? ` · Mat. ${detalle.perfiles.matricula}` : ""}
                </p>
              )}

              <div className="flex flex-wrap gap-3 mb-4">
                {detalle.tipo_contrato && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                    {CONTRATO_LABEL[detalle.tipo_contrato]}
                  </span>
                )}
                {detalle.zona && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">📍 {detalle.zona}</span>
                )}
                {detalle.remuneracion && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">💰 {detalle.remuneracion}</span>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Descripción</h3>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{detalle.descripcion}</p>
              </div>

              {detalle.requisitos && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Requisitos</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{detalle.requisitos}</p>
                </div>
              )}

              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Contacto</h3>
                <div className="flex gap-4 flex-wrap">
                  {detalle.contacto_email && (
                    <a href={`mailto:${detalle.contacto_email}`} className="text-blue-400 hover:underline text-sm">
                      ✉ {detalle.contacto_email}
                    </a>
                  )}
                  {detalle.contacto_tel && (
                    <a href={`https://wa.me/${detalle.contacto_tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-green-400 hover:underline text-sm">
                      💬 {detalle.contacto_tel}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando publicaciones...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">💼</div>
            <p className="text-gray-400">No hay publicaciones{tab !== "todas" ? ` de ${tab === "oferta" ? "ofertas" : "búsquedas"}` : ""} aún.</p>
            <button
              onClick={() => { setForm(EMPTY); setShowForm(true); }}
              className="mt-4 text-purple-400 hover:text-purple-300 text-sm underline"
            >
              Ser el primero en publicar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtradas.map(o => (
              <div
                key={o.id}
                onClick={() => setDetalle(o)}
                className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 cursor-pointer transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.tipo === "oferta" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
                        {o.tipo === "oferta" ? "Oferta" : "Búsqueda"}
                      </span>
                      {o.tipo_contrato && (
                        <span className="text-xs text-gray-500">{CONTRATO_LABEL[o.tipo_contrato]}</span>
                      )}
                      {o.destacado && <span className="text-xs text-yellow-400">⭐ Destacado</span>}
                    </div>
                    <h3 className="font-semibold text-white group-hover:text-purple-300 transition truncate">{o.titulo}</h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{o.descripcion}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      {o.zona && <span>📍 {o.zona}</span>}
                      {o.remuneracion && <span>💰 {o.remuneracion}</span>}
                      {o.perfiles && <span>👤 {o.perfiles.nombre} {o.perfiles.apellido}</span>}
                      <span>{new Date(o.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                  </div>
                  {o.perfil_id === uid && (
                    <button
                      onClick={e => { e.stopPropagation(); eliminar(o.id); }}
                      className="text-xs text-red-400 hover:text-red-300 shrink-0"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
