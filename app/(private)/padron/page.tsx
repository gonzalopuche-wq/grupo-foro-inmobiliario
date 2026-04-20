"use client";

import { useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";

interface RegistroPadron {
  id: string;
  matricula: string | null;
  apellido: string;
  nombre: string;
  inmobiliaria: string | null;
  direccion: string | null;
  localidad: string | null;
  telefono: string | null;
  email: string | null;
  estado: string | null;
  actualizado_at: string;
}

type Col = "apellido" | "matricula" | "inmobiliaria" | "estado";

const ESTADOS_ALERTA = ["suspendido", "suspension", "baja", "dado de baja", "inhabilitado", "inactivo"];

const estadoColor = (estado: string | null) => {
  if (!estado) return "#22c55e";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "#ff4444";
  if (e.includes("habilitado") || e.includes("activo") || e.includes("vigente")) return "#22c55e";
  return "#eab308";
};

const estadoEmoji = (estado: string | null) => {
  if (!estado) return "✅";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "⛔";
  return "✅";
};

const abrirWhatsApp = (telefono: string) => {
  const numero = telefono.replace(/\D/g, "");
  // Si ya empieza con 54 no agregamos prefijo
  const wa = numero.startsWith("54") ? numero : `54${numero}`;
  window.open(`https://wa.me/${wa}`, "_blank");
};

export default function PadronPage() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<RegistroPadron[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [totalPadron, setTotalPadron] = useState<number | null>(null);

  // Ordenamiento
  const [sortCol, setSortCol] = useState<Col | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [lastClick, setLastClick] = useState<{ col: Col; time: number } | null>(null);

  useState(() => {
    supabase.from("cocir_padron").select("*", { count: "exact", head: true })
      .then(({ count }) => setTotalPadron(count));
  });

  const buscar = async () => {
    const q = busqueda.trim();
    if (!q) return;
    setLoading(true);
    setBuscado(true);
    const { data } = await supabase
      .from("cocir_padron")
      .select("*")
      .or(`matricula.ilike.%${q}%,apellido.ilike.%${q}%,nombre.ilike.%${q}%,inmobiliaria.ilike.%${q}%`)
      .order("apellido")
      .limit(50);
    setResultados(data ?? []);
    setLoading(false);
    setSortCol(null);
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") buscar(); };
  const limpiar = () => { setBusqueda(""); setResultados([]); setBuscado(false); setSortCol(null); };

  // Doble click en columna para ordenar
  const handleColClick = (col: Col) => {
    const now = Date.now();
    if (lastClick && lastClick.col === col && now - lastClick.time < 400) {
      // Doble click
      if (sortCol === col) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
      } else {
        setSortCol(col);
        setSortDir("asc");
      }
      setLastClick(null);
    } else {
      setLastClick({ col, time: now });
    }
  };

  const resultadosOrdenados = useMemo(() => {
    if (!sortCol) return resultados;
    return [...resultados].sort((a, b) => {
      const va = (a[sortCol] ?? "").toLowerCase();
      const vb = (b[sortCol] ?? "").toLowerCase();
      // Para matrícula ordenar numéricamente
      if (sortCol === "matricula") {
        const na = parseInt(va) || 0;
        const nb = parseInt(vb) || 0;
        return sortDir === "asc" ? na - nb : nb - na;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [resultados, sortCol, sortDir]);

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const SortIndicator = ({ col }: { col: Col }) => {
    if (sortCol !== col) return <span style={{color:"rgba(255,255,255,0.15)",marginLeft:4}}>⇅</span>;
    return <span style={{color:"#cc0000",marginLeft:4}}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .pad-wrap { display: flex; flex-direction: column; gap: 20px; }
        .pad-titulo { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .pad-titulo span { color: #cc0000; }
        .pad-sub { font-size: 13px; color: rgba(255,255,255,0.35); }
        .pad-statsbar { display: flex; align-items: center; gap: 20px; padding: 12px 18px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; flex-wrap: wrap; }
        .pad-stat { display: flex; flex-direction: column; gap: 2px; }
        .pad-stat-val { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1; }
        .pad-stat-label { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); font-family: 'Montserrat', sans-serif; }
        .pad-stat-sep { width: 1px; height: 36px; background: rgba(255,255,255,0.08); }
        .pad-cocir-nota { font-size: 11px; color: rgba(255,255,255,0.25); margin-left: auto; font-style: italic; }
        .pad-buscador { display: flex; gap: 10px; align-items: center; }
        .pad-search-wrap { flex: 1; position: relative; }
        .pad-search-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 14px; color: rgba(255,255,255,0.25); }
        .pad-input { width: 100%; padding: 12px 14px 12px 38px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #fff; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; }
        .pad-input:focus { border-color: rgba(200,0,0,0.5); box-shadow: 0 0 0 3px rgba(200,0,0,0.08); }
        .pad-input::placeholder { color: rgba(255,255,255,0.18); }
        .pad-btn-buscar { padding: 12px 24px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .pad-btn-buscar:hover:not(:disabled) { background: #e60000; }
        .pad-btn-buscar:disabled { opacity: 0.6; cursor: not-allowed; }
        .pad-btn-limpiar { padding: 12px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .pad-search-hint { font-size: 11px; color: rgba(255,255,255,0.2); margin-top: 6px; }
        .pad-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .pad-tabla { width: 100%; border-collapse: collapse; }
        .pad-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .pad-tabla th { padding: 11px 14px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); white-space: nowrap; }
        .pad-tabla th.sortable { cursor: pointer; user-select: none; }
        .pad-tabla th.sortable:hover { color: rgba(255,255,255,0.6); }
        .pad-tabla th.sorted { color: #fff; }
        .pad-sort-hint { font-size: 9px; color: rgba(255,255,255,0.2); margin-left: 4px; font-weight: 400; letter-spacing: 0; text-transform: none; font-family: 'Inter',sans-serif; }
        .pad-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        .pad-tabla tbody tr:last-child { border-bottom: none; }
        .pad-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .pad-tabla td { padding: 12px 14px; font-size: 12px; color: rgba(255,255,255,0.7); vertical-align: middle; }
        .pad-nombre { font-weight: 600; color: #fff; font-size: 13px; }
        .pad-mat { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; font-family: 'Montserrat', sans-serif; }
        .pad-estado-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-family: 'Montserrat', sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .pad-wa-btn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.25); border-radius: 4px; color: #25d366; font-size: 11px; font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.15s; text-decoration: none; white-space: nowrap; }
        .pad-wa-btn:hover { background: rgba(37,211,102,0.2); border-color: rgba(37,211,102,0.5); }
        .pad-email-link { color: rgba(200,0,0,0.7); text-decoration: none; font-size: 11px; }
        .pad-email-link:hover { color: #cc0000; }
        .pad-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.25); font-size: 13px; font-style: italic; }
        .pad-spinner { display: flex; align-items: center; justify-content: center; padding: 48px; }
        .pad-spin { width: 28px; height: 28px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pad-resultados-count { font-size: 12px; color: rgba(255,255,255,0.3); padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .pad-intro { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .pad-intro-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px; text-align: center; }
        .pad-intro-icon { font-size: 28px; margin-bottom: 10px; }
        .pad-intro-titulo { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
        .pad-intro-desc { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6; }
        @media (max-width: 700px) { .pad-buscador { flex-wrap: wrap; } .pad-intro { grid-template-columns: 1fr; } .pad-statsbar { gap: 12px; } .pad-cocir-nota { margin-left: 0; } }
      `}</style>

      <div className="pad-wrap">

        <div>
          <div className="pad-titulo">Padrón <span>COCIR</span></div>
          <div className="pad-sub">2da Circunscripción · Corredores matriculados habilitados</div>
        </div>

        {/* Stats */}
        <div className="pad-statsbar">
          <div className="pad-stat">
            <div className="pad-stat-val">{totalPadron?.toLocaleString("es-AR") ?? "..."}</div>
            <div className="pad-stat-label">Matriculados</div>
          </div>
          <div className="pad-stat-sep" />
          <div className="pad-stat">
            <div className="pad-stat-val" style={{color:"#22c55e"}}>✓</div>
            <div className="pad-stat-label">Actualizado</div>
          </div>
          <div className="pad-stat-sep" />
          <div className="pad-stat">
            <div className="pad-stat-val" style={{color:"#cc0000"}}>COCIR</div>
            <div className="pad-stat-label">Fuente oficial</div>
          </div>
          <div className="pad-cocir-nota">
            Datos sincronizados desde el padrón oficial de COCIR · Solo lectura
          </div>
        </div>

        {/* Buscador */}
        <div>
          <div className="pad-buscador">
            <div className="pad-search-wrap">
              <span className="pad-search-ico">🔍</span>
              <input
                className="pad-input"
                placeholder="Buscar por nombre, apellido, matrícula o inmobiliaria..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={handleKey}
              />
            </div>
            <button className="pad-btn-buscar" onClick={buscar} disabled={loading || !busqueda.trim()}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
            {buscado && <button className="pad-btn-limpiar" onClick={limpiar}>Limpiar</button>}
          </div>
          <div className="pad-search-hint">
            Presioná Enter o hacé click en Buscar · Doble click en columna para ordenar
          </div>
        </div>

        {/* Resultados */}
        {loading ? (
          <div className="pad-spinner"><div className="pad-spin" /></div>
        ) : buscado ? (
          resultados.length === 0 ? (
            <div className="pad-tabla-wrap">
              <div className="pad-empty">
                No se encontraron matriculados con ese criterio.<br />
                <span style={{fontSize:12,marginTop:8,display:"block"}}>
                  Intentá con el apellido, nombre completo o número de matrícula.
                </span>
              </div>
            </div>
          ) : (
            <div className="pad-tabla-wrap">
              <div className="pad-resultados-count">
                {resultadosOrdenados.length} resultado{resultadosOrdenados.length !== 1 ? "s" : ""} para &quot;{busqueda}&quot;
                {resultadosOrdenados.length === 50 && " (máx. 50)"}
                {sortCol && <span style={{marginLeft:8,color:"rgba(200,0,0,0.6)"}}>· Ordenado por {sortCol} {sortDir === "asc" ? "↑" : "↓"}</span>}
              </div>
              <table className="pad-tabla">
                <thead>
                  <tr>
                    <th
                      className={`sortable${sortCol === "apellido" ? " sorted" : ""}`}
                      onDoubleClick={() => handleColClick("apellido")}
                      onClick={() => handleColClick("apellido")}
                      title="Doble click para ordenar"
                    >
                      Nombre <SortIndicator col="apellido" />
                      {sortCol !== "apellido" && <span className="pad-sort-hint">(doble click)</span>}
                    </th>
                    <th
                      className={`sortable${sortCol === "matricula" ? " sorted" : ""}`}
                      onDoubleClick={() => handleColClick("matricula")}
                      onClick={() => handleColClick("matricula")}
                      title="Doble click para ordenar"
                    >
                      Matrícula <SortIndicator col="matricula" />
                    </th>
                    <th
                      className={`sortable${sortCol === "inmobiliaria" ? " sorted" : ""}`}
                      onDoubleClick={() => handleColClick("inmobiliaria")}
                      onClick={() => handleColClick("inmobiliaria")}
                      title="Doble click para ordenar"
                    >
                      Inmobiliaria <SortIndicator col="inmobiliaria" />
                    </th>
                    <th>Dirección</th>
                    <th>Contacto</th>
                    <th
                      className={`sortable${sortCol === "estado" ? " sorted" : ""}`}
                      onDoubleClick={() => handleColClick("estado")}
                      onClick={() => handleColClick("estado")}
                      title="Doble click para ordenar"
                    >
                      Estado <SortIndicator col="estado" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultadosOrdenados.map(r => {
                    const color = estadoColor(r.estado);
                    const emoji = estadoEmoji(r.estado);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="pad-nombre">{r.apellido}, {r.nombre}</div>
                          <div className="pad-mat">Act: {formatFecha(r.actualizado_at)}</div>
                        </td>
                        <td>
                          <span style={{fontFamily:"Montserrat,sans-serif",fontWeight:700,fontSize:13}}>
                            {r.matricula ?? "—"}
                          </span>
                        </td>
                        <td style={{color:"rgba(255,255,255,0.6)"}}>
                          {r.inmobiliaria || <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                        </td>
                        <td style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>
                          {r.direccion
                            ? <>{r.direccion}{r.localidad ? <><br /><span style={{color:"rgba(255,255,255,0.3)"}}>{r.localidad}</span></> : ""}</>
                            : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>
                          }
                        </td>
                        <td>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {r.telefono && (
                              <button
                                className="pad-wa-btn"
                                onClick={() => abrirWhatsApp(r.telefono!)}
                                title={`Abrir WhatsApp con ${r.nombre}`}
                              >
                                <span style={{fontSize:14}}>💬</span>
                                {r.telefono}
                              </button>
                            )}
                            {r.email && (
                              <a href={`mailto:${r.email}`} className="pad-email-link">
                                ✉ {r.email}
                              </a>
                            )}
                            {!r.telefono && !r.email && (
                              <span style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="pad-estado-pill" style={{
                            background: `${color}18`,
                            border: `1px solid ${color}45`,
                            color,
                          }}>
                            {emoji} {r.estado?.toUpperCase() || "HABILITADO"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="pad-intro">
            <div className="pad-intro-card">
              <div className="pad-intro-icon">🔍</div>
              <div className="pad-intro-titulo">Buscar corredor</div>
              <div className="pad-intro-desc">
                Encontrá cualquier corredor matriculado en la 2da Circunscripción por nombre, apellido o matrícula.
              </div>
            </div>
            <div className="pad-intro-card">
              <div className="pad-intro-icon">✅</div>
              <div className="pad-intro-titulo">Verificar habilitación</div>
              <div className="pad-intro-desc">
                Consultá el estado de matrícula de un colega antes de cerrar una operación compartida.
              </div>
            </div>
            <div className="pad-intro-card">
              <div className="pad-intro-icon">💬</div>
              <div className="pad-intro-titulo">Contacto directo</div>
              <div className="pad-intro-desc">
                Tocá el número de teléfono para abrir WhatsApp directamente. También podés escribir por email.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
