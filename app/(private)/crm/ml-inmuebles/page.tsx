"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Propiedad {
  id: string;
  titulo: string;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string;
  zona: string | null;
  ciudad: string | null;
  fotos: string[] | null;
}

interface PublicacionML {
  propiedad_id: string;
  ml_item_id: string | null;
  ml_estado: "publicado" | "pausado" | "finalizado" | "no_publicado";
  ml_vistas: number;
  ml_consultas: number;
  ml_favoritos: number;
  ml_link: string | null;
  ml_updated_at: string | null;
}

type MapPublicaciones = Record<string, PublicacionML>;

// ── Colores de estado ─────────────────────────────────────────────────────────

const ESTADO_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  publicado:    { color: "#25d366", bg: "rgba(37,211,102,0.12)",  label: "Publicado" },
  pausado:      { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  label: "Pausado" },
  finalizado:   { color: "#6b7280", bg: "rgba(107,114,128,0.12)", label: "Finalizado" },
  no_publicado: { color: "#4b5563", bg: "rgba(75,85,99,0.12)",    label: "No publicado" },
};

function fmtPrecio(p: number | null, moneda: string): string {
  if (!p) return "—";
  const sym = moneda === "USD" ? "U$D" : "$";
  return `${sym} ${p.toLocaleString("es-AR")}`;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function MLInmueblesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [publicaciones, setPublicaciones] = useState<MapPublicaciones>({});
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [mlClientId, setMlClientId] = useState("");
  const [mlClientSecret, setMlClientSecret] = useState("");
  const [guardandoCred, setGuardandoCred] = useState(false);
  const [credGuardadas, setCredGuardadas] = useState(false);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await Promise.all([
        cargarPropiedades(data.user.id),
        cargarCredenciales(data.user.id),
        cargarPublicaciones(data.user.id),
      ]);
      setLoading(false);
    };
    init();
  }, []);

  const cargarPropiedades = async (uid: string) => {
    const { data } = await supabase
      .from("cartera_propiedades")
      .select("id, titulo, operacion, tipo, precio, moneda, zona, ciudad, fotos")
      .eq("perfil_id", uid)
      .order("created_at", { ascending: false });
    setPropiedades((data as Propiedad[]) ?? []);
  };

  const cargarCredenciales = async (uid: string) => {
    const { data } = await supabase
      .from("indicadores")
      .select("clave, valor")
      .eq("perfil_id", uid)
      .in("clave", ["ml_client_id", "ml_client_secret"]);
    if (!data) return;
    const map: Record<string, string> = {};
    for (const r of data as { clave: string; valor: string }[]) map[r.clave] = r.valor;
    setMlClientId(map.ml_client_id ?? "");
    setMlClientSecret(map.ml_client_secret ?? "");
  };

  const cargarPublicaciones = async (uid: string) => {
    const { data } = await supabase
      .from("ml_publicaciones")
      .select("*")
      .eq("perfil_id", uid);
    if (!data) return;
    const map: MapPublicaciones = {};
    for (const r of data as (PublicacionML & { perfil_id: string })[]) {
      map[r.propiedad_id] = r;
    }
    setPublicaciones(map);
  };

  const guardarCredenciales = useCallback(async () => {
    if (!userId) return;
    setGuardandoCred(true);
    await supabase.from("indicadores").upsert(
      { perfil_id: userId, clave: "ml_client_id", valor: mlClientId },
      { onConflict: "perfil_id,clave" }
    );
    await supabase.from("indicadores").upsert(
      { perfil_id: userId, clave: "ml_client_secret", valor: mlClientSecret },
      { onConflict: "perfil_id,clave" }
    );
    setGuardandoCred(false);
    setCredGuardadas(true);
    setTimeout(() => setCredGuardadas(false), 2500);
  }, [userId, mlClientId, mlClientSecret]);

  const publicarEnML = async (propId: string) => {
    setPublicandoId(propId);
    // Scaffold: en producción llamaría a la ML API para crear el aviso
    await new Promise(r => setTimeout(r, 1200));
    const pub: PublicacionML = {
      propiedad_id: propId,
      ml_item_id: null,
      ml_estado: "no_publicado",
      ml_vistas: 0,
      ml_consultas: 0,
      ml_favoritos: 0,
      ml_link: null,
      ml_updated_at: new Date().toISOString(),
    };
    setPublicaciones(prev => ({ ...prev, [propId]: pub }));
    setPublicandoId(null);
    alert("Publicación en ML requiere autenticación con tu cuenta de MercadoLibre. Conectá tu cuenta desde la sección Credenciales.");
  };

  const sincronizarEstados = async () => {
    setSincronizando(true);
    // Scaffold: en producción consultaría la API de ML para actualizar estados
    await new Promise(r => setTimeout(r, 1500));
    setSincronizando(false);
    alert("Sincronización lista. (Requiere credenciales ML activas para actualizar datos reales.)");
  };

  // Métricas totales
  const pubs = Object.values(publicaciones);
  const totalVistas    = pubs.reduce((a, p) => a + (p.ml_vistas ?? 0), 0);
  const totalConsultas = pubs.reduce((a, p) => a + (p.ml_consultas ?? 0), 0);
  const totalFavoritos = pubs.reduce((a, p) => a + (p.ml_favoritos ?? 0), 0);
  const totalPublicados = pubs.filter(p => p.ml_estado === "publicado").length;

  const propsFiltradas = propiedades.filter(p => {
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!(p.titulo.toLowerCase().includes(q) || (p.zona ?? "").toLowerCase().includes(q))) return false;
    }
    if (filtroEstado) {
      const estado = publicaciones[p.id]?.ml_estado ?? "no_publicado";
      if (estado !== filtroEstado) return false;
    }
    return true;
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .ml-wrap { min-height: 100vh; background: #0a0a0a; color: #fff; font-family: Inter,sans-serif; }
        .ml-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--gfi-border-subtle); }
        .ml-back { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; color: var(--gfi-text-muted); text-decoration: none; text-transform: uppercase; }
        .ml-back:hover { color: #fff; }
        .ml-titulo { font-family: Montserrat,sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .ml-spacer { flex: 1; }
        .ml-btn { padding: 8px 18px; border-radius: 6px; background: #ffe600; color: #111; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; border: none; }
        .ml-btn:disabled { opacity: .5; cursor: default; }
        .ml-btn-ghost { padding: 8px 14px; border-radius: 6px; background: var(--gfi-border-subtle); color: rgba(255,255,255,.65); font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; border: 1px solid var(--gfi-border); }
        .ml-btn-ghost:hover { color: #fff; }
        .ml-body { max-width: 960px; margin: 0 auto; padding: 24px 20px; }
        .ml-aviso { background: rgba(255,230,0,.06); border: 1px solid rgba(255,230,0,.2); border-radius: 10px; padding: 14px 18px; font-size: 13px; color: rgba(255,255,255,.7); line-height: 1.6; margin-bottom: 20px; }
        .ml-aviso a { color: #ffe600; }
        .ml-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 12px; padding: 22px; margin-bottom: 16px; }
        .ml-section-title { font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 800; color: #fff; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .ml-label { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 6px; display: block; }
        .ml-input { width: 100%; padding: 10px 14px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 8px; color: #fff; font-size: 13px; outline: none; font-family: Inter,sans-serif; }
        .ml-input:focus { border-color: rgba(255,230,0,.4); }
        .ml-field { margin-bottom: 14px; }
        .ml-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .ml-stat-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 10px; padding: 18px; }
        .ml-stat-num { font-family: Montserrat,sans-serif; font-size: 28px; font-weight: 800; color: #ffe600; }
        .ml-stat-label { font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gfi-text-muted); margin-top: 4px; }
        .ml-toolbar { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .ml-search { flex: 1; min-width: 200px; padding: 9px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 6px; color: #fff; font-size: 13px; outline: none; font-family: Inter,sans-serif; }
        .ml-sel { padding: 9px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 6px; color: #fff; font-size: 12px; outline: none; cursor: pointer; }
        .ml-prop-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--gfi-border-subtle); }
        .ml-prop-row:last-child { border-bottom: none; }
        .ml-prop-info { flex: 1; min-width: 0; }
        .ml-prop-titulo { font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ml-prop-sub { font-size: 11px; color: var(--gfi-text-muted); margin-top: 3px; }
        .ml-estado-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 12px; font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
        .ml-prop-metricas { display: flex; gap: 12px; font-size: 11px; color: var(--gfi-text-muted); flex-shrink: 0; }
        .ml-prop-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .ml-empty { text-align: center; color: var(--gfi-text-muted); font-size: 13px; padding: 40px 20px; }
        .ml-saved { color: #ffe600; font-size: 12px; font-family: Montserrat,sans-serif; font-weight: 700; }
        .ml-logo { display: flex; align-items: center; gap: 6px; }
        .ml-logo-mark { background: #ffe600; color: #111; font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; }
      `}</style>

      <div className="ml-wrap">
        <div className="ml-header">
          <Link href="/crm" className="ml-back">← CRM</Link>
          <span style={{ color: "var(--gfi-border)", fontSize: 14 }}>/</span>
          <div className="ml-logo">
            <span className="ml-logo-mark">ML</span>
            <div className="ml-titulo">MercadoLibre Inmuebles</div>
          </div>
          <div className="ml-spacer" />
          <button
            className="ml-btn-ghost"
            onClick={sincronizarEstados}
            disabled={sincronizando}
          >
            {sincronizando ? "Sincronizando..." : "Sincronizar estado"}
          </button>
        </div>

        <div className="ml-body">
          {/* Aviso */}
          <div className="ml-aviso">
            Requiere autenticación con tu cuenta de MercadoLibre.{" "}
            <a href="https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion" target="_blank" rel="noreferrer">
              Ver guía de integración →
            </a>
          </div>

          {/* Métricas */}
          <div className="ml-stat-grid">
            {[
              { num: totalPublicados, label: "Publicaciones activas", color: "#ffe600" },
              { num: totalVistas,     label: "Vistas totales",        color: "#4ab8d8" },
              { num: totalConsultas,  label: "Consultas recibidas",   color: "#a78bfa" },
              { num: totalFavoritos,  label: "Favoritos",             color: "#f97316" },
            ].map(s => (
              <div key={s.label} className="ml-stat-card">
                <div className="ml-stat-num" style={{ color: s.color }}>{s.num || "—"}</div>
                <div className="ml-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Credenciales */}
          <div className="ml-card">
            <div className="ml-section-title">
              <span style={{ fontSize: 16 }}>🔑</span> Credenciales API
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="ml-field" style={{ flex: 1, minWidth: 200 }}>
                <label className="ml-label">Client ID</label>
                <input
                  className="ml-input"
                  placeholder="Tu App ID de MercadoLibre"
                  value={mlClientId}
                  onChange={e => setMlClientId(e.target.value)}
                />
              </div>
              <div className="ml-field" style={{ flex: 1, minWidth: 200 }}>
                <label className="ml-label">Client Secret</label>
                <input
                  className="ml-input"
                  type="password"
                  placeholder="Secret key"
                  value={mlClientSecret}
                  onChange={e => setMlClientSecret(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 14 }}>
                <button className="ml-btn" onClick={guardarCredenciales} disabled={guardandoCred}>
                  {guardandoCred ? "Guardando..." : "Guardar"}
                </button>
                {credGuardadas && <span className="ml-saved" style={{ marginLeft: 10 }}>Guardado</span>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: -4 }}>
              Obtenés las credenciales en{" "}
              <a href="https://developers.mercadolibre.com.ar" target="_blank" rel="noreferrer" style={{ color: "#ffe600" }}>
                developers.mercadolibre.com.ar
              </a>
              {" "}creando una aplicación con permisos de <em>Listados</em>.
            </div>
          </div>

          {/* Lista de propiedades */}
          <div className="ml-card">
            <div className="ml-section-title">
              <span style={{ fontSize: 16 }}>🏠</span> Propiedades de cartera
            </div>

            <div className="ml-toolbar">
              <input
                className="ml-search"
                placeholder="Buscar propiedad..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
              <select
                className="ml-sel"
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="publicado">Publicado</option>
                <option value="pausado">Pausado</option>
                <option value="finalizado">Finalizado</option>
                <option value="no_publicado">No publicado</option>
              </select>
            </div>

            {loading ? (
              <div className="ml-empty">Cargando propiedades...</div>
            ) : propsFiltradas.length === 0 ? (
              <div className="ml-empty">
                {propiedades.length === 0
                  ? "Sin propiedades en cartera. Agregá propiedades desde la sección Cartera."
                  : "No hay propiedades con esos filtros."}
              </div>
            ) : propsFiltradas.map(p => {
              const pub = publicaciones[p.id];
              const estado = pub?.ml_estado ?? "no_publicado";
              const es = ESTADO_STYLE[estado] ?? ESTADO_STYLE.no_publicado;
              const foto = p.fotos?.[0] ?? null;
              return (
                <div key={p.id} className="ml-prop-row">
                  <div style={{
                    width: 52, height: 52, borderRadius: 6, flexShrink: 0,
                    background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)",
                    overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {foto
                      ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 22, opacity: 0.25 }}>🏠</span>
                    }
                  </div>
                  <div className="ml-prop-info">
                    <div className="ml-prop-titulo">{p.titulo}</div>
                    <div className="ml-prop-sub">
                      {p.tipo} · {p.operacion} · {fmtPrecio(p.precio, p.moneda)}
                      {p.zona ? ` · ${p.zona}` : ""}
                      {p.ciudad ? `, ${p.ciudad}` : ""}
                    </div>
                  </div>

                  {pub && (
                    <div className="ml-prop-metricas">
                      <span title="Vistas">👁 {pub.ml_vistas}</span>
                      <span title="Consultas">💬 {pub.ml_consultas}</span>
                      <span title="Favoritos">❤️ {pub.ml_favoritos}</span>
                    </div>
                  )}

                  <span className="ml-estado-badge" style={{ color: es.color, background: es.bg }}>
                    {es.label}
                  </span>

                  <div className="ml-prop-actions">
                    {pub?.ml_link && (
                      <a
                        href={pub.ml_link}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-btn-ghost"
                        style={{ textDecoration: "none", padding: "4px 10px", fontSize: 9 }}
                      >
                        Ver en ML
                      </a>
                    )}
                    <button
                      className="ml-btn"
                      style={{ padding: "5px 12px", fontSize: 9 }}
                      onClick={() => publicarEnML(p.id)}
                      disabled={publicandoId === p.id}
                    >
                      {publicandoId === p.id ? "..." : "Publicar en ML"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info publicación */}
          <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", lineHeight: 1.6, padding: "8px 0" }}>
            Las publicaciones en MercadoLibre Inmuebles requieren cuenta verificada y saldo disponible en ML.
            El formato de aviso se genera automáticamente desde los datos de la propiedad en cartera.
            <br />
            <a href="https://www.mercadolibre.com.ar/ayuda/Publicar-inmuebles_1569" target="_blank" rel="noreferrer" style={{ color: "#ffe600" }}>
              Más info sobre publicación de inmuebles en ML →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
