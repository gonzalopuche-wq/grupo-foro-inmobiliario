"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface PerfilBusqueda {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  foto_url: string | null;
  inmobiliaria: string | null;
}

interface Valoracion {
  id: string;
  valorador_id: string;
  valorado_id: string;
  puntuacion: number;
  relacion: string;
  comentario: string | null;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; foto_url: string | null } | null;
}

const RELACIONES = [
  { value: "cliente",   label: "Cliente",    icon: "🏠" },
  { value: "colega",    label: "Colega",     icon: "🤝" },
  { value: "aliado",    label: "Aliado",     icon: "🌟" },
  { value: "comprador", label: "Comprador",  icon: "💰" },
  { value: "vendedor",  label: "Vendedor",   icon: "📋" },
  { value: "otro",      label: "Otro",       icon: "💬" },
];

function Estrellas({ puntuacion, max = 5, size = 16 }: { puntuacion: number; max?: number; size?: number }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < puntuacion ? "#f59e0b" : "rgba(255,255,255,0.15)" }}>★</span>
      ))}
    </span>
  );
}

function EstrellasPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 28, padding: 0, color: n <= (hover || value) ? "#f59e0b" : "rgba(255,255,255,0.2)", transition: "color 0.1s" }}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function ValoracionesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"buscar" | "recibidas" | "dadas">("recibidas");

  // Valoraciones propias
  const [recibidas, setRecibidas] = useState<Valoracion[]>([]);
  const [dadas, setDadas] = useState<Valoracion[]>([]);
  const [loadingPropias, setLoadingPropias] = useState(true);

  // Búsqueda de corredor para valorar
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<PerfilBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [corredorSeleccionado, setCorredorSeleccionado] = useState<PerfilBusqueda | null>(null);

  // Form nueva valoración
  const [puntuacion, setPuntuacion] = useState(0);
  const [relacion, setRelacion] = useState("colega");
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [valoracionExistente, setValoracionExistente] = useState<Valoracion | null>(null);

  // Detalle de corredor
  const [verDetalle, setVerDetalle] = useState<{ perfil: PerfilBusqueda; vals: Valoracion[]; promedio: number | null; total: number } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);
      setUserId(session.user.id);
      await cargarPropias(session.access_token);
    };
    init();
  }, []);

  const cargarPropias = async (tok: string) => {
    setLoadingPropias(true);
    const res = await fetch("/api/valoraciones", { headers: { Authorization: `Bearer ${tok}` } });
    if (res.ok) {
      const d = await res.json();
      setRecibidas(d.recibidas ?? []);
      setDadas(d.dadas ?? []);
    }
    setLoadingPropias(false);
  };

  const buscarCorredores = async (q: string) => {
    if (q.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    const { data } = await supabase
      .from("perfiles")
      .select("id, nombre, apellido, matricula, foto_url, inmobiliaria")
      .eq("tipo", "corredor")
      .neq("id", userId ?? "")
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,matricula.ilike.%${q}%`)
      .limit(8);
    setResultados(data ?? []);
    setBuscando(false);
  };

  useEffect(() => {
    const t = setTimeout(() => buscarCorredores(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const seleccionarCorredor = async (p: PerfilBusqueda) => {
    setCorredorSeleccionado(p);
    setResultados([]);
    setBusqueda("");
    // Verificar si ya lo valoré
    const existente = dadas.find(d => d.valorado_id === p.id);
    if (existente) {
      setPuntuacion(existente.puntuacion);
      setRelacion(existente.relacion);
      setComentario(existente.comentario ?? "");
      setValoracionExistente(existente);
    } else {
      setPuntuacion(0); setRelacion("colega"); setComentario(""); setValoracionExistente(null);
    }
  };

  const guardarValoracion = async () => {
    if (!corredorSeleccionado || puntuacion === 0 || !token) return;
    setGuardando(true);
    const res = await fetch("/api/valoraciones", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ valorado_id: corredorSeleccionado.id, puntuacion, relacion, comentario }),
    });
    const d = await res.json();
    if (!d.error) {
      await cargarPropias(token);
      setCorredorSeleccionado(null); setPuntuacion(0); setRelacion("colega"); setComentario(""); setValoracionExistente(null);
      setTab("dadas");
    }
    setGuardando(false);
  };

  const verValoracionesCorredor = async (p: PerfilBusqueda) => {
    const res = await fetch(`/api/valoraciones?perfil_id=${p.id}`);
    if (res.ok) {
      const d = await res.json();
      setVerDetalle({ perfil: p, vals: d.valoraciones, promedio: d.promedio, total: d.total });
    }
  };

  const promedioRecibido = recibidas.length > 0 ? recibidas.reduce((s, v) => s + v.puntuacion, 0) / recibidas.length : null;

  return (
    <div style={{ fontFamily: "Inter,sans-serif", color: "#fff", maxWidth: 900, margin: "0 auto" }}>
      <style>{`
        .val-tab { padding: 8px 18px; border: none; border-bottom: 2px solid transparent; background: transparent; color: rgba(255,255,255,0.4); font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .val-tab.active { color: #fff; border-bottom-color: #f59e0b; }
        .val-search { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; font-size: 14px; font-family: Inter,sans-serif; box-sizing: border-box; }
        .val-search:focus { outline: none; border-color: rgba(200,0,0,0.5); }
        .val-result-item { padding: 10px 14px; display: flex; align-items: center; gap: 10; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
        .val-result-item:hover { background: rgba(255,255,255,0.06); }
        .val-avatar { width: 36px; height: 36px; border-radius: 8px; background: rgba(200,0,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #cc0000; font-family: Montserrat,sans-serif; overflow: hidden; flex-shrink: 0; }
      `}</style>

      {/* Header con mi resumen */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
        <div style={{ fontSize: 36 }}>⭐</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>Valoraciones entre Corredores</h1>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Tu reputación en la red GFI®</p>
        </div>
        {promedioRecibido !== null && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#f59e0b", fontFamily: "Montserrat,sans-serif" }}>{promedioRecibido.toFixed(1)}</div>
            <Estrellas puntuacion={Math.round(promedioRecibido)} size={14} />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{recibidas.length} valoración{recibidas.length !== 1 ? "es" : ""}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 24, display: "flex", gap: 0 }}>
        {(["recibidas","dadas","buscar"] as const).map(t => (
          <button key={t} className={`val-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "recibidas" ? `Recibidas (${recibidas.length})` : t === "dadas" ? `Dadas (${dadas.length})` : "Valorar un corredor"}
          </button>
        ))}
      </div>

      {tab === "recibidas" && (
        loadingPropias ? <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>Cargando...</div> :
        recibidas.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
            <p>Aún no recibiste valoraciones</p>
          </div>
        ) : recibidas.map(v => (
          <div key={v.id} style={{ display: "flex", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 8 }}>
            <div className="val-avatar">
              {v.perfiles?.foto_url
                ? <img src={v.perfiles.foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : `${v.perfiles?.nombre?.charAt(0) ?? ""}${v.perfiles?.apellido?.charAt(0) ?? ""}`}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{v.perfiles?.nombre} {v.perfiles?.apellido}</span>
                <Estrellas puntuacion={v.puntuacion} size={14} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{new Date(v.created_at).toLocaleDateString("es-AR")}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: v.comentario ? 4 : 0 }}>
                {RELACIONES.find(r => r.value === v.relacion)?.icon} {RELACIONES.find(r => r.value === v.relacion)?.label}
              </div>
              {v.comentario && <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{v.comentario}</p>}
            </div>
          </div>
        ))
      )}

      {tab === "dadas" && (
        loadingPropias ? <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>Cargando...</div> :
        dadas.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
            <p>Aún no valoraste a ningún corredor</p>
            <button onClick={() => setTab("buscar")} style={{ marginTop: 8, padding: "8px 16px", background: "#cc0000", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Valorar un corredor</button>
          </div>
        ) : dadas.map(v => (
          <div key={v.id} style={{ display: "flex", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 8 }}>
            <div className="val-avatar">
              {v.perfiles?.foto_url
                ? <img src={v.perfiles.foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : `${v.perfiles?.nombre?.charAt(0) ?? ""}${v.perfiles?.apellido?.charAt(0) ?? ""}`}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{v.perfiles?.nombre} {v.perfiles?.apellido}</span>
                <Estrellas puntuacion={v.puntuacion} size={14} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{new Date(v.created_at).toLocaleDateString("es-AR")}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: v.comentario ? 4 : 0 }}>
                {RELACIONES.find(r => r.value === v.relacion)?.icon} {RELACIONES.find(r => r.value === v.relacion)?.label}
              </div>
              {v.comentario && <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{v.comentario}</p>}
              <button onClick={() => {
                setTab("buscar");
                // Pre-seleccionar el perfil
                const p: PerfilBusqueda = { id: v.valorado_id, nombre: v.perfiles?.nombre ?? "", apellido: v.perfiles?.apellido ?? "", matricula: null, foto_url: v.perfiles?.foto_url ?? null, inmobiliaria: null };
                seleccionarCorredor(p);
              }} style={{ marginTop: 6, fontSize: 11, color: "rgba(200,0,0,0.7)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                ✏️ Editar valoración
              </button>
            </div>
          </div>
        ))
      )}

      {tab === "buscar" && (
        <div>
          {!corredorSeleccionado ? (
            <>
              <div style={{ position: "relative", marginBottom: 16 }}>
                <input
                  className="val-search"
                  placeholder="Buscar corredor por nombre o matrícula..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
                {buscando && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>...</div>}
              </div>
              {resultados.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                  {resultados.map(p => (
                    <div key={p.id} className="val-result-item" onClick={() => seleccionarCorredor(p)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="val-avatar">
                        {p.foto_url ? <img src={p.foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : `${p.nombre.charAt(0)}${p.apellido.charAt(0)}`}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre} {p.apellido}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                          {p.matricula ? `Mat. ${p.matricula}` : "Sin matrícula"}
                          {p.inmobiliaria ? ` · ${p.inmobiliaria}` : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Ver valoraciones →</div>
                    </div>
                  ))}
                </div>
              )}
              {busqueda.length >= 2 && resultados.length === 0 && !buscando && (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No se encontraron corredores</p>
              )}
            </>
          ) : (
            <div style={{ maxWidth: 500 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, marginBottom: 24 }}>
                <div className="val-avatar">
                  {corredorSeleccionado.foto_url
                    ? <img src={corredorSeleccionado.foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : `${corredorSeleccionado.nombre.charAt(0)}${corredorSeleccionado.apellido.charAt(0)}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{corredorSeleccionado.nombre} {corredorSeleccionado.apellido}</div>
                  {corredorSeleccionado.matricula && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Mat. {corredorSeleccionado.matricula}</div>}
                </div>
                <button onClick={() => setCorredorSeleccionado(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18 }}>&times;</button>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Puntuación *
                </label>
                <EstrellasPicker value={puntuacion} onChange={setPuntuacion} />
                {puntuacion > 0 && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
                    {["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"][puntuacion]}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Relación *
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {RELACIONES.map(r => (
                    <button key={r.value} onClick={() => setRelacion(r.value)} style={{
                      padding: "6px 12px", borderRadius: 20, fontSize: 12, border: "1px solid",
                      borderColor: relacion === r.value ? "#cc0000" : "rgba(255,255,255,0.1)",
                      background: relacion === r.value ? "rgba(200,0,0,0.15)" : "transparent",
                      color: relacion === r.value ? "#fff" : "rgba(255,255,255,0.5)", cursor: "pointer",
                    }}>
                      {r.icon} {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Comentario (opcional)
                </label>
                <textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  placeholder="Contá tu experiencia trabajando con este corredor..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              <button
                onClick={guardarValoracion}
                disabled={guardando || puntuacion === 0}
                style={{ width: "100%", padding: "12px", background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", cursor: guardando || puntuacion === 0 ? "not-allowed" : "pointer", opacity: guardando || puntuacion === 0 ? 0.5 : 1 }}>
                {guardando ? "Guardando..." : valoracionExistente ? "Actualizar valoración" : "Publicar valoración"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal detalle valoraciones */}
      {verDetalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setVerDetalle(null); }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 500, maxHeight: "80vh", overflow: "auto", position: "relative" }}>
            <button style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }} onClick={() => setVerDetalle(null)}>&times;</button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div className="val-avatar" style={{ width: 44, height: 44 }}>
                {verDetalle.perfil.foto_url
                  ? <img src={verDetalle.perfil.foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : `${verDetalle.perfil.nombre.charAt(0)}${verDetalle.perfil.apellido.charAt(0)}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{verDetalle.perfil.nombre} {verDetalle.perfil.apellido}</div>
                {verDetalle.promedio !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Estrellas puntuacion={Math.round(verDetalle.promedio)} size={14} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>{verDetalle.promedio.toFixed(1)}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>({verDetalle.total})</span>
                  </div>
                )}
              </div>
            </div>
            {verDetalle.vals.map(v => (
              <div key={v.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <div className="val-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                    {(v.perfiles as any)?.foto_url
                      ? <img src={(v.perfiles as any).foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : `${(v.perfiles as any)?.nombre?.charAt(0) ?? ""}${(v.perfiles as any)?.apellido?.charAt(0) ?? ""}`}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{(v.perfiles as any)?.nombre} {(v.perfiles as any)?.apellido}</span>
                  <Estrellas puntuacion={v.puntuacion} size={12} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{new Date(v.created_at).toLocaleDateString("es-AR")}</span>
                </div>
                {v.comentario && <p style={{ margin: "4px 0 0 38px", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{v.comentario}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
