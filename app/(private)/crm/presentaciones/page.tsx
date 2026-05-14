"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Propiedad {
  id: string;
  titulo: string;
  tipo_operacion: string;
  tipo_propiedad: string;
  precio: number | null;
  moneda: string | null;
  dormitorios: number | null;
  superficie_total: number | null;
  fotos: string[] | null;
  direccion: string | null;
  barrio: string | null;
  localidad: string | null;
  estado: string;
}

interface Presentacion {
  id: string;
  titulo: string;
  mensaje: string | null;
  propiedades_ids: string[];
  token: string;
  valid_until: string | null;
  vistas: number;
  activa: boolean;
  created_at: string;
}

export default function PresentacionesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null;
      const uid = data.session?.user.id;
      setToken(t);
      if (!t || !uid) return;
      cargarDatos(t, uid);
    });
  }, []);

  async function cargarDatos(tok: string, uid: string) {
    setLoading(true);
    const [resProps, resPres] = await Promise.all([
      supabase
        .from("cartera_propiedades")
        .select("id, titulo, tipo_operacion, tipo_propiedad, precio, moneda, dormitorios, superficie_total, fotos, direccion, barrio, localidad, estado")
        .eq("perfil_id", uid)
        .eq("estado", "activa")
        .order("created_at", { ascending: false }),
      fetch("/api/crm/presentaciones", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()),
    ]);

    setPropiedades(resProps.data ?? []);
    setPresentaciones(resPres.presentaciones ?? []);
    setLoading(false);
  }

  async function crear() {
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    if (seleccionadas.size === 0) { setError("Seleccioná al menos una propiedad."); return; }
    setGuardando(true);
    setError("");
    const res = await fetch("/api/crm/presentaciones", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo,
        mensaje: mensaje || null,
        propiedades_ids: Array.from(seleccionadas),
        valid_until: validUntil || null,
      }),
    });
    const d = await res.json();
    if (d.error) { setError(d.error); setGuardando(false); return; }
    setPresentaciones(prev => [d.presentacion, ...prev]);
    setShowForm(false);
    setSeleccionadas(new Set());
    setTitulo("");
    setMensaje("");
    setValidUntil("");
    setGuardando(false);
  }

  async function desactivar(id: string) {
    if (!confirm("¿Desactivar esta presentación?")) return;
    await fetch("/api/crm/presentaciones", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPresentaciones(prev => prev.filter(p => p.id !== id));
  }

  function copiarLink(tok: string) {
    const url = `${window.location.origin}/p/${tok}`;
    navigator.clipboard.writeText(url);
    setCopiado(tok);
    setTimeout(() => setCopiado(null), 2000);
  }

  const filtradas = propiedades.filter(p => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (p.titulo ?? "").toLowerCase().includes(q) ||
      (p.barrio ?? "").toLowerCase().includes(q) ||
      (p.direccion ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-3xl">📊</span> Presentaciones Comerciales
            </h1>
            <p className="text-gray-400 mt-1">Creá presentaciones con tus propiedades y compartí un link personalizado con tus clientes.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold transition"
          >
            + Nueva presentación
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : (
          <>
            {/* Modal crear */}
            {showForm && (
              <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl p-6 overflow-y-auto max-h-[92vh]">
                  <h2 className="text-xl font-bold mb-4">Nueva presentación</h2>

                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Título de la presentación *</label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={e => setTitulo(e.target.value)}
                      placeholder="Ej: Selección de departamentos zona norte"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Mensaje personalizado para el cliente</label>
                    <textarea
                      value={mensaje}
                      onChange={e => setMensaje(e.target.value)}
                      rows={3}
                      placeholder="Ej: Estimado Juan, te acerco una selección de propiedades que coinciden con tu búsqueda..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Válida hasta (opcional)</label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={e => setValidUntil(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>

                  {/* Selección de propiedades */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-400">Propiedades a incluir * ({seleccionadas.size}/15 seleccionadas)</label>
                      <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar..."
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-xs text-white w-40"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {filtradas.map(p => {
                        const sel = seleccionadas.has(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              const next = new Set(seleccionadas);
                              if (sel) next.delete(p.id);
                              else if (next.size < 15) next.add(p.id);
                              setSeleccionadas(next);
                            }}
                            className={`text-left p-3 rounded-xl border text-sm transition ${sel ? "bg-blue-900/40 border-blue-500 text-white" : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"}`}
                          >
                            <div className="font-medium truncate">{p.titulo}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {p.tipo_operacion} · {p.tipo_propiedad}
                              {p.precio ? ` · ${p.moneda === "USD" ? "U$S" : "$"} ${p.precio.toLocaleString("es-AR")}` : ""}
                            </div>
                          </button>
                        );
                      })}
                      {filtradas.length === 0 && (
                        <p className="text-gray-500 text-sm col-span-2">No hay propiedades activas en tu cartera.</p>
                      )}
                    </div>
                  </div>

                  {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

                  <div className="flex gap-3 justify-end">
                    <button onClick={() => { setShowForm(false); setError(""); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">
                      Cancelar
                    </button>
                    <button
                      onClick={crear}
                      disabled={guardando}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition"
                    >
                      {guardando ? "Creando..." : "Crear presentación"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista presentaciones */}
            {presentaciones.length === 0 ? (
              <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-gray-300 font-semibold">Sin presentaciones aún</p>
                <p className="text-gray-500 text-sm mt-1">Creá tu primera presentación y compartí el link con tus clientes.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {presentaciones.map(p => (
                  <div key={p.id} className={`bg-gray-900 border rounded-xl p-5 transition ${p.activa ? "border-gray-800" : "border-gray-800 opacity-50"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white">{p.titulo}</h3>
                          {!p.activa && <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">Inactiva</span>}
                        </div>
                        <div className="text-xs text-gray-400 flex flex-wrap gap-3 mt-1">
                          <span>📄 {p.propiedades_ids.length} propiedades</span>
                          <span>👁 {p.vistas} vistas</span>
                          <span>📅 {new Date(p.created_at).toLocaleDateString("es-AR")}</span>
                          {p.valid_until && <span>⏳ Hasta {new Date(p.valid_until).toLocaleDateString("es-AR")}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copiarLink(p.token)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${copiado === p.token ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                        >
                          {copiado === p.token ? "¡Copiado!" : "Copiar link"}
                        </button>
                        <a
                          href={`/p/${p.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition"
                        >
                          Ver
                        </a>
                        {p.activa && (
                          <button
                            onClick={() => desactivar(p.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
