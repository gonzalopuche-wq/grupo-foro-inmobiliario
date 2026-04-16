"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface RegistroPadron {
  id: string;
  matricula: string | null;
  apellido: string;
  nombre: string;
  inmobiliaria: string | null;
  localidad: string | null;
  telefono: string | null;
  email: string | null;
  estado: string | null;
  actualizado_at: string;
}

interface MiembroGFI {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  tipo: string;
  en_padron: boolean;
  estado_padron: string | null;
}

const ESTADOS_ALERTA = ["suspendido", "suspension", "baja", "dado de baja", "inhabilitado", "inactivo"];

function estadoColor(estado: string | null | undefined, enPadron = true): string {
  if (!enPadron) return "#eab308";
  if (!estado) return "#22c55e";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "#ff4444";
  if (e.includes("habilitado") || e.includes("activo") || e.includes("vigente")) return "#22c55e";
  return "#eab308";
}

function estadoLabel(estado: string | null | undefined, enPadron: boolean): string {
  if (!enPadron) return "No en padrón";
  if (!estado) return "Habilitado";
  return estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase();
}

type VistaTab = "buscar" | "miembros";

export default function PadronPage() {
  const [tab, setTab] = useState<VistaTab>("buscar");
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<RegistroPadron[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [miembros, setMiembros] = useState<MiembroGFI[]>([]);
  const [loadingMiembros, setLoadingMiembros] = useState(false);
  const [miembrosBuscados, setMiembrosBuscados] = useState(false);
  const [busquedaMiembros, setBusquedaMiembros] = useState("");
  const [miPerfil, setMiPerfil] = useState<{ matricula: string | null; tipo: string } | null>(null);
  const [miEstado, setMiEstado] = useState<{ en_padron: boolean; estado: string | null } | null>(null);
  const [totalPadron, setTotalPadron] = useState<number>(0);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("matricula, tipo")
        .eq("id", session.user.id)
        .single();

      if (perfil) {
        setMiPerfil(perfil);
        if (perfil.matricula) {
          const { data: padronRow } = await supabase
            .from("cocir_padron")
            .select("estado")
            .eq("matricula", perfil.matricula)
            .maybeSingle();
          setMiEstado({ en_padron: !!padronRow, estado: padronRow?.estado ?? null });
        }
      }

      const { count } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true });
      setTotalPadron(count ?? 0);
    };
    init();
  }, []);

  const buscarEnPadron = async () => {
    const q = busqueda.trim();
    if (!q) return;
    setBuscando(true);
    setBuscado(false);

    const { data } = await supabase
      .from("cocir_padron")
      .select("*")
      .or(`apellido.ilike.%${q}%,nombre.ilike.%${q}%,matricula.ilike.%${q}%`)
      .order("apellido")
      .limit(50);

    setResultados(data ?? []);
    setBuscando(false);
    setBuscado(true);
  };

  const cargarMiembros = async () => {
    if (miembrosBuscados) return;
    setLoadingMiembros(true);
    const { data: profs } = await supabase
      .from("perfiles")
      .select("id,nombre,apellido,matricula,tipo")
      .eq("estado", "aprobado")
      .order("apellido");

    if (!profs) { setLoadingMiembros(false); return; }

    const con: MiembroGFI[] = [];
    for (const p of profs) {
      if (!p.matricula) { con.push({ ...p, en_padron: false, estado_padron: null }); continue; }
      const { data: row } = await supabase
        .from("cocir_padron")
        .select("estado")
        .eq("matricula", p.matricula)
        .maybeSingle();
      con.push({ ...p, en_padron: !!row, estado_padron: row?.estado ?? null });
    }
    setMiembros(con);
    setLoadingMiembros(false);
    setMiembrosBuscados(true);
  };

  const cambiarTab = (t: VistaTab) => {
    setTab(t);
    if (t === "miembros") cargarMiembros();
  };

  const miembrosFiltrados = miembros.filter(m =>
    !busquedaMiembros ||
    `${m.apellido} ${m.nombre} ${m.matricula ?? ""}`.toLowerCase().includes(busquedaMiembros.toLowerCase())
  );

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <style>{`
        .pad-mi-estado { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
        .pad-mi-label { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 6px; }
        .pad-mi-valor { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .pad-mi-mat { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 3px; }
        .pad-badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; }
        .pad-stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .pad-stat { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; }
        .pad-stat-num { font-family: 'Montserrat', sans-serif; font-size: 26px; font-weight: 800; color: #fff; line-height: 1; }
        .pad-stat-num.verde { color: #22c55e; }
        .pad-stat-num.rojo { color: #ff4444; }
        .pad-stat-lbl { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 5px; font-family: 'Montserrat', sans-serif; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
        .pad-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .pad-tab { padding: 8px 20px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .pad-tab.active { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .pad-search-row { display: flex; gap: 10px; margin-bottom: 20px; }
        .pad-search-input { flex: 1; padding: 10px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .pad-search-input:focus { border-color: rgba(200,0,0,0.4); }
        .pad-search-input::placeholder { color: rgba(255,255,255,0.2); }
        .pad-search-btn { padding: 10px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: background 0.2s; }
        .pad-search-btn:hover { background: #e60000; }
        .pad-search-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .pad-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .pad-tabla { width: 100%; border-collapse: collapse; }
        .pad-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .pad-tabla th { padding: 10px 14px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); white-space: nowrap; }
        .pad-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .pad-tabla tbody tr:last-child { border-bottom: none; }
        .pad-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .pad-tabla td { padding: 11px 14px; font-size: 12px; color: rgba(255,255,255,0.7); vertical-align: middle; }
        .pad-nombre { font-weight: 600; color: #fff; }
        .pad-sub { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .pad-empty { padding: 48px 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }
        .pad-aviso { font-size: 11px; color: rgba(255,255,255,0.25); text-align: center; margin-top: 12px; }
        @media (max-width: 700px) {
          .pad-stat-row { grid-template-columns: repeat(2, 1fr); }
          .pad-search-row { flex-direction: column; }
        }
      `}</style>

      {/* Mi estado en el padrón */}
      {miPerfil?.matricula && miEstado !== null && (
        <div className="pad-mi-estado">
          <div>
            <div className="pad-mi-label">Mi estado en padrón COCIR</div>
            <div className="pad-mi-valor">Mat. {miPerfil.matricula}</div>
            {miEstado.estado && <div className="pad-mi-mat">{miEstado.estado}</div>}
          </div>
          <span
            className="pad-badge"
            style={{
              background: `${estadoColor(miEstado.estado, miEstado.en_padron)}20`,
              border: `1px solid ${estadoColor(miEstado.estado, miEstado.en_padron)}50`,
              color: estadoColor(miEstado.estado, miEstado.en_padron),
              fontSize: 11,
              padding: "6px 16px",
            }}
          >
            {estadoLabel(miEstado.estado, miEstado.en_padron)}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="pad-stat-row">
        <div className="pad-stat">
          <div className="pad-stat-num">{totalPadron.toLocaleString("es-AR")}</div>
          <div className="pad-stat-lbl">Registros en padrón</div>
        </div>
        <div className="pad-stat">
          <div className="pad-stat-num verde">{miembros.filter(m => m.en_padron && !ESTADOS_ALERTA.some(s => (m.estado_padron ?? "").toLowerCase().includes(s))).length || "—"}</div>
          <div className="pad-stat-lbl">Miembros GFI habilitados</div>
        </div>
        <div className="pad-stat">
          <div className="pad-stat-num rojo">{miembros.filter(m => !m.en_padron || ESTADOS_ALERTA.some(s => (m.estado_padron ?? "").toLowerCase().includes(s))).length || "—"}</div>
          <div className="pad-stat-lbl">Con irregularidades</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="pad-tabs">
        <button className={`pad-tab${tab === "buscar" ? " active" : ""}`} onClick={() => cambiarTab("buscar")}>
          🔍 Consultar padrón
        </button>
        <button className={`pad-tab${tab === "miembros" ? " active" : ""}`} onClick={() => cambiarTab("miembros")}>
          👥 Miembros GFI
        </button>
      </div>

      {/* Tab: buscar en padrón */}
      {tab === "buscar" && (
        <>
          <div className="pad-search-row">
            <input
              className="pad-search-input"
              placeholder="Buscar por apellido, nombre o matrícula..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") buscarEnPadron(); }}
            />
            <button className="pad-search-btn" onClick={buscarEnPadron} disabled={buscando || !busqueda.trim()}>
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {buscado && (
            resultados.length === 0 ? (
              <div className="pad-tabla-wrap">
                <div className="pad-empty">No se encontraron resultados para "{busqueda}".</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                  {resultados.length} resultado{resultados.length !== 1 ? "s" : ""} encontrado{resultados.length !== 1 ? "s" : ""}
                </div>
                <div className="pad-tabla-wrap">
                  <table className="pad-tabla">
                    <thead>
                      <tr>
                        <th>Apellido y Nombre</th>
                        <th>Matrícula</th>
                        <th>Inmobiliaria</th>
                        <th>Localidad</th>
                        <th>Teléfono</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map(r => {
                        const color = estadoColor(r.estado);
                        return (
                          <tr key={r.id}>
                            <td>
                              <div className="pad-nombre">{r.apellido}, {r.nombre}</div>
                              {r.email && <div className="pad-sub">{r.email}</div>}
                            </td>
                            <td style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
                              {r.matricula ?? "—"}
                            </td>
                            <td style={{ color: "rgba(255,255,255,0.5)" }}>{r.inmobiliaria ?? "—"}</td>
                            <td style={{ color: "rgba(255,255,255,0.5)" }}>{r.localidad ?? "—"}</td>
                            <td style={{ color: "rgba(255,255,255,0.5)" }}>{r.telefono ?? "—"}</td>
                            <td>
                              <span
                                className="pad-badge"
                                style={{
                                  background: `${color}20`,
                                  border: `1px solid ${color}50`,
                                  color,
                                }}
                              >
                                {r.estado?.toUpperCase() || "HABILITADO"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="pad-aviso">
                  Datos del padrón COCIR · Actualizado {resultados[0] ? formatFecha(resultados[0].actualizado_at) : "—"}
                </div>
              </>
            )
          )}

          {!buscado && (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                Ingresá un nombre, apellido o matrícula para consultar el padrón COCIR.
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab: miembros GFI */}
      {tab === "miembros" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <input
              className="pad-search-input"
              style={{ maxWidth: 320 }}
              placeholder="Filtrar por nombre o matrícula..."
              value={busquedaMiembros}
              onChange={e => setBusquedaMiembros(e.target.value)}
            />
          </div>

          {loadingMiembros ? (
            <div className="pad-tabla-wrap">
              <div className="pad-empty">Verificando miembros en el padrón...</div>
            </div>
          ) : miembrosFiltrados.length === 0 ? (
            <div className="pad-tabla-wrap">
              <div className="pad-empty">
                {busquedaMiembros ? "Sin resultados para la búsqueda." : "No hay miembros aprobados."}
              </div>
            </div>
          ) : (
            <div className="pad-tabla-wrap">
              <table className="pad-tabla">
                <thead>
                  <tr>
                    <th>Corredor / Colaborador</th>
                    <th>Matrícula</th>
                    <th>Tipo</th>
                    <th>Estado COCIR</th>
                  </tr>
                </thead>
                <tbody>
                  {miembrosFiltrados.map(m => {
                    const color = estadoColor(m.estado_padron, m.en_padron);
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="pad-nombre">{m.apellido}, {m.nombre}</div>
                        </td>
                        <td style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
                          {m.matricula ?? "—"}
                        </td>
                        <td>
                          <span
                            className="pad-badge"
                            style={{
                              background: m.tipo === "corredor" ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.06)",
                              border: m.tipo === "corredor" ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.12)",
                              color: m.tipo === "corredor" ? "#818cf8" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {m.tipo === "corredor" ? "Corredor" : "Colaborador"}
                          </span>
                        </td>
                        <td>
                          <span
                            className="pad-badge"
                            style={{
                              background: `${color}20`,
                              border: `1px solid ${color}50`,
                              color,
                            }}
                          >
                            {estadoLabel(m.estado_padron, m.en_padron).toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
