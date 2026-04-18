"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PerfilRapidoModal from "../foro/PerfilRapidoModal";

interface Corredor {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  telefono: string | null;
  email: string | null;
  inmobiliaria: string | null;
  especialidades: string[] | null;
  foto_url: string | null;
  zona_trabajo: string | null;
  anos_experiencia: number | null;
  bio: string | null;
  socio_cir: boolean;
  tipo: string;
  estado: string;
  created_at: string;
}

export default function PadronGFIPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [corredores, setCorredores] = useState<Corredor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [perfilRapidoId, setPerfilRapidoId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      cargarCorredores();
    };
    init();
  }, []);

  const cargarCorredores = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("perfiles")
      .select("id,nombre,apellido,matricula,telefono,email,inmobiliaria,especialidades,foto_url,zona_trabajo,anos_experiencia,bio,socio_cir,tipo,estado,created_at")
      .order("apellido", { ascending: true });
    setCorredores((data as Corredor[]) ?? []);
    setLoading(false);
  };

  const filtrados = corredores.filter(c => {
    if (filtroEstado !== "todos" && c.estado !== filtroEstado) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (
        c.nombre?.toLowerCase().includes(q) ||
        c.apellido?.toLowerCase().includes(q) ||
        c.matricula?.toLowerCase().includes(q) ||
        c.inmobiliaria?.toLowerCase().includes(q) ||
        c.zona_trabajo?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activos = corredores.filter(c => c.estado === "activo").length;
  const pendientes = corredores.filter(c => c.estado !== "activo").length;

  const iniciales = (c: Corredor) =>
    `${c.nombre?.charAt(0) ?? ""}${c.apellido?.charAt(0) ?? ""}`.toUpperCase();

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { month: "short", year: "numeric" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .gfi-wrap { display: flex; flex-direction: column; gap: 20px; }
        .gfi-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .gfi-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .gfi-titulo span { color: #cc0000; }
        .gfi-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .gfi-stats { display: flex; gap: 16px; flex-wrap: wrap; }
        .gfi-stat { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 12px 18px; text-align: center; min-width: 90px; }
        .gfi-stat-val { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; color: #cc0000; }
        .gfi-stat-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; font-family: 'Montserrat',sans-serif; }
        .gfi-barra { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .gfi-search-wrap { flex: 1; min-width: 220px; position: relative; }
        .gfi-search-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 13px; color: rgba(255,255,255,0.25); }
        .gfi-search { width: 100%; padding: 9px 12px 9px 34px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .gfi-search:focus { border-color: rgba(200,0,0,0.4); }
        .gfi-search::placeholder { color: rgba(255,255,255,0.2); }
        .gfi-filtros { display: flex; gap: 6px; flex-wrap: wrap; }
        .gfi-filtro { padding: 7px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .gfi-filtro:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .gfi-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .gfi-count { font-size: 11px; color: rgba(255,255,255,0.25); white-space: nowrap; }
        .gfi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .gfi-card { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 18px 20px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .gfi-card:hover { border-color: rgba(200,0,0,0.3); transform: translateY(-2px); }
        .gfi-card.yo { border-color: rgba(200,0,0,0.35); background: rgba(200,0,0,0.04); }
        .gfi-card-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 12px; }
        .gfi-avatar { width: 44px; height: 44px; border-radius: 8px; background: rgba(200,0,0,0.15); border: 2px solid rgba(200,0,0,0.25); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #cc0000; flex-shrink: 0; overflow: hidden; }
        .gfi-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .gfi-card-info { flex: 1; min-width: 0; }
        .gfi-card-nombre { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gfi-card-mat { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; font-family: 'Montserrat',sans-serif; }
        .gfi-card-inm { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gfi-card-badges { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px; }
        .gfi-badge { font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; }
        .gfi-badge-activo { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); color: #22c55e; }
        .gfi-badge-pendiente { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.25); color: #eab308; }
        .gfi-badge-cir { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); color: #818cf8; }
        .gfi-badge-admin { background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.3); color: #eab308; }
        .gfi-badge-yo { background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); color: #cc0000; }
        .gfi-card-meta { display: flex; gap: 10px; flex-wrap: wrap; }
        .gfi-card-meta-item { font-size: 11px; color: rgba(255,255,255,0.35); display: flex; align-items: center; gap: 4px; }
        .gfi-card-esp { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .gfi-esp { font-size: 9px; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); }
        .gfi-card-desde { position: absolute; bottom: 10px; right: 12px; font-size: 9px; color: rgba(255,255,255,0.18); font-family: 'Montserrat',sans-serif; }
        .gfi-empty { padding: 64px 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .gfi-spinner { display: flex; align-items: center; justify-content: center; padding: 64px; }
        .gfi-spin { width: 28px; height: 28px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) { .gfi-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="gfi-wrap">

        {/* Header */}
        <div className="gfi-header">
          <div>
            <div className="gfi-titulo">Padrón <span>GFI®</span></div>
            <div className="gfi-sub">Corredores registrados en la plataforma</div>
          </div>
          <div className="gfi-stats">
            <div className="gfi-stat">
              <div className="gfi-stat-val">{corredores.length}</div>
              <div className="gfi-stat-label">Miembros</div>
            </div>
            <div className="gfi-stat">
              <div className="gfi-stat-val" style={{ color: "#22c55e" }}>{corredores.filter(c => c.matricula).length}</div>
              <div className="gfi-stat-label">Matriculados</div>
            </div>
            <div className="gfi-stat">
              <div className="gfi-stat-val" style={{ color: "#818cf8" }}>{corredores.filter(c => c.socio_cir).length}</div>
              <div className="gfi-stat-label">Socios CIR</div>
            </div>
          </div>
        </div>

        {/* Barra */}
        <div className="gfi-barra">
          <div className="gfi-search-wrap">
            <span className="gfi-search-ico">🔍</span>
            <input
              className="gfi-search"
              placeholder="Buscar por nombre, matrícula, inmobiliaria o zona..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <span className="gfi-count">{filtrados.length} corredor{filtrados.length !== 1 ? "es" : ""}</span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="gfi-spinner"><div className="gfi-spin" /></div>
        ) : filtrados.length === 0 ? (
          <div className="gfi-empty">No hay corredores con ese filtro.</div>
        ) : (
          <div className="gfi-grid">
            {filtrados.map(c => {
              const esYo = c.id === userId;
              return (
                <div
                  key={c.id}
                  className={`gfi-card${esYo ? " yo" : ""}`}
                  onClick={() => setPerfilRapidoId(c.id)}
                >
                  <div className="gfi-card-top">
                    <div className="gfi-avatar">
                      {c.foto_url ? <img src={c.foto_url} alt="Foto" /> : iniciales(c)}
                    </div>
                    <div className="gfi-card-info">
                      <div className="gfi-card-nombre">{c.apellido}, {c.nombre}</div>
                      {c.matricula && <div className="gfi-card-mat">Mat. {c.matricula}</div>}
                      {c.inmobiliaria && <div className="gfi-card-inm">🏢 {c.inmobiliaria}</div>}
                    </div>
                  </div>

                  <div className="gfi-card-badges">
                    {esYo && <span className="gfi-badge gfi-badge-yo">Vos</span>}
                    {c.matricula && <span className="gfi-badge" style={{ background: "rgba(200,0,0,0.08)", border: "1px solid rgba(200,0,0,0.2)", color: "#cc0000" }}>✓ COCIR</span>}
                    {c.socio_cir && <span className="gfi-badge gfi-badge-cir">CIR</span>}
                    {c.tipo === "admin" && <span className="gfi-badge gfi-badge-admin">Admin</span>}
                  </div>

                  <div className="gfi-card-meta">
                    {c.zona_trabajo && <span className="gfi-card-meta-item">📍 {c.zona_trabajo}</span>}
                    {c.anos_experiencia && <span className="gfi-card-meta-item">🏆 {c.anos_experiencia} años</span>}
                    {c.telefono && <span className="gfi-card-meta-item">📞 {c.telefono}</span>}
                  </div>

                  {(c.especialidades ?? []).length > 0 && (
                    <div className="gfi-card-esp">
                      {(c.especialidades ?? []).slice(0, 3).map(e => (
                        <span key={e} className="gfi-esp">{e}</span>
                      ))}
                      {(c.especialidades ?? []).length > 3 && (
                        <span className="gfi-esp">+{(c.especialidades ?? []).length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className="gfi-card-desde">Desde {formatFecha(c.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal perfil rápido */}
      {perfilRapidoId && (
        <PerfilRapidoModal
          perfilId={perfilRapidoId}
          miUserId={userId}
          onClose={() => setPerfilRapidoId(null)}
        />
      )}
    </>
  );
}
