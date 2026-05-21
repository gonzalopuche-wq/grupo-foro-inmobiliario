"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PadronEntry {
  matricula: string;
  apellido: string | null;
  nombre: string | null;
  estado: string | null;
  inmobiliaria: string | null;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  localidad: string | null;
}

interface SyncResult {
  actualizados: number;
  omitidos: number;
  errores: number;
  total_perfiles: number;
  total_padron: number;
  detalle: { id: string; matricula: string; cambios: Record<string, string> }[];
}

interface PadronStats {
  total: number;
  activos: number;
  conTelefono: number;
  conCelular: number;
  conEmail: number;
  ultimaSync: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function estadoColor(estado: string | null) {
  if (!estado) return "#94a3b8";
  const e = estado.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (e.includes("activ") || e.includes("habili") || e.includes("vigente")) return "#22c55e";
  if (e.includes("suspen") || e.includes("inhab")) return "#ef4444";
  return "#eab308";
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function COCIRPage() {
  const [stats, setStats] = useState<PadronStats | null>(null);
  const [cargandoStats, setCargandoStats] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<PadronEntry[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [tab, setTab] = useState<"padron" | "sync" | "buscar">("padron");
  const [syncCampos, setSyncCampos] = useState<string[]>(["telefono"]);
  const [syncForzar, setSyncForzar] = useState(false);
  const [syncCargando, setSyncCargando] = useState(false);
  const [syncResultado, setSyncResultado] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [perfilCargado, setPerfilCargado] = useState(false);

  // Verificar rol admin
  useEffect(() => {
    const verificar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPerfilCargado(true); return; }
      const { data } = await supabase.from("perfiles").select("tipo").eq("id", user.id).single();
      setEsAdmin(data?.tipo === "admin" || data?.tipo === "master");
      setPerfilCargado(true);
    };
    verificar();
  }, []);

  // Stats del padrón
  const cargarStats = useCallback(async () => {
    setCargandoStats(true);
    try {
      // Total
      const { count: total } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true });

      // Activos
      const { count: activos } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true })
        .ilike("estado", "%activ%");

      // Con teléfono
      const { count: conTelefono } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true })
        .not("telefono", "is", null);

      // Con celular
      const { count: conCelular } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true })
        .not("celular", "is", null);

      // Con email
      const { count: conEmail } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true })
        .not("email", "is", null);

      // Última sync — buscamos el updated_at más reciente
      const { data: ultima } = await supabase
        .from("cocir_padron")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1);

      setStats({
        total: total ?? 0,
        activos: activos ?? 0,
        conTelefono: conTelefono ?? 0,
        conCelular: conCelular ?? 0,
        conEmail: conEmail ?? 0,
        ultimaSync: ultima?.[0]?.updated_at ?? null,
      });
    } catch {
      setStats(null);
    } finally {
      setCargandoStats(false);
    }
  }, []);

  useEffect(() => { cargarStats(); }, [cargarStats]);

  // Búsqueda en padrón
  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const isNumero = /^\d+$/.test(q.trim());
      let query = supabase
        .from("cocir_padron")
        .select("matricula, apellido, nombre, estado, inmobiliaria, telefono, celular, email, localidad")
        .limit(30);

      if (isNumero) {
        query = query.ilike("matricula", `%${q.trim()}%`);
      } else {
        query = query.or(
          `apellido.ilike.%${q}%,nombre.ilike.%${q}%,inmobiliaria.ilike.%${q}%`
        );
      }

      const { data } = await query;
      setResultados((data ?? []) as PadronEntry[]);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => buscar(busqueda), 350);
    return () => clearTimeout(timeout);
  }, [busqueda, buscar]);

  // Phone sync
  const ejecutarSync = async () => {
    if (!esAdmin) return;
    setSyncCargando(true);
    setSyncError("");
    setSyncResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setSyncError("Sesión expirada."); return; }
      const url = `/api/admin/sync-phones-cocir${syncForzar ? "?forzar=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ campos: syncCampos }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setSyncError(data.error ?? "Error"); return; }
      setSyncResultado(data as SyncResult);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setSyncCargando(false);
    }
  };

  const toggleCampo = (campo: string) => {
    setSyncCampos(prev =>
      prev.includes(campo) ? prev.filter(c => c !== campo) : [...prev, campo]
    );
  };

  if (!perfilCargado) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .cc-wrap { max-width: 900px; display: flex; flex-direction: column; gap: 20px; font-family: 'Inter',sans-serif; }
        .cc-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .cc-titulo span { color: #cc0000; }
        .cc-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 3px; }
        /* KPIs */
        .cc-kpis { display: grid; grid-template-columns: repeat(6,1fr); gap: 10px; }
        .cc-kpi { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 13px 15px; }
        .cc-kpi-val { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; color: #fff; }
        .cc-kpi-label { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-top: 3px; font-family: 'Montserrat',sans-serif; }
        /* Tabs */
        .cc-tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .cc-tab { padding: 10px 18px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); cursor: pointer; border-bottom: 2px solid transparent; background: none; border-top: none; border-left: none; border-right: none; transition: all 0.15s; }
        .cc-tab.on { color: #fff; border-bottom-color: #cc0000; }
        /* Card */
        .cc-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 18px 20px; }
        /* Input */
        .cc-input { width: 100%; padding: 11px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #fff; font-family: 'Inter',sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .cc-input:focus { border-color: rgba(204,0,0,0.4); }
        .cc-input::placeholder { color: rgba(255,255,255,0.2); }
        /* Tabla */
        .cc-tabla { width: 100%; border-collapse: collapse; font-size: 12px; }
        .cc-tabla th { padding: 8px 10px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .cc-tabla td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        /* Badge */
        .cc-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; }
        /* Checkbox */
        .cc-cb-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; cursor: pointer; transition: background 0.15s; }
        .cc-cb-row:hover { background: rgba(255,255,255,0.06); }
        .cc-cb-row input { accent-color: #cc0000; width: 15px; height: 15px; cursor: pointer; }
        /* Button */
        .cc-btn { padding: 11px 22px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; cursor: pointer; border: none; transition: all 0.15s; }
        .cc-btn-primary { background: #cc0000; color: #fff; }
        .cc-btn-primary:hover { background: #e00; }
        .cc-btn-primary:disabled { background: rgba(204,0,0,0.3); cursor: not-allowed; }
        /* Spinner */
        .cc-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 6px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Resultado sync */
        .cc-sync-stat { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 12px 16px; text-align: center; }
        .cc-sync-stat-val { font-family: 'Montserrat',sans-serif; font-size: 28px; font-weight: 800; }
        .cc-sync-stat-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 3px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        @media (max-width: 700px) {
          .cc-kpis { grid-template-columns: repeat(3,1fr); }
        }
      `}</style>

      <div className="cc-wrap">
        {/* Header */}
        <div>
          <div className="cc-titulo">Padrón <span>COCIR</span></div>
          <div className="cc-sub">Gestión del padrón de corredores matriculados · Colegio de Corredores Inmobiliarios de CABA.</div>
        </div>

        {/* KPIs */}
        {cargandoStats ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            <div className="cc-spinner" /> Cargando estadísticas del padrón...
          </div>
        ) : stats ? (
          <div className="cc-kpis">
            <div className="cc-kpi">
              <div className="cc-kpi-val">{stats.total.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Total matriculados</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ color: "#22c55e" }}>{stats.activos.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Activos / habilitados</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ color: "#3b82f6" }}>{stats.conTelefono.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Con teléfono</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ color: "#06b6d4" }}>{stats.conCelular.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Con celular</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ color: "#a78bfa" }}>{stats.conEmail.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Con email</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ fontSize: 13, color: stats.ultimaSync ? "#eab308" : "rgba(255,255,255,0.3)" }}>
                {stats.ultimaSync
                  ? new Date(stats.ultimaSync).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
                  : "—"}
              </div>
              <div className="cc-kpi-label">Última actualización</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            {stats === null && !cargandoStats ? "El padrón COCIR aún no fue sincronizado." : ""}
          </div>
        )}

        {/* Tabs */}
        <div className="cc-tabs">
          <button className={`cc-tab${tab === "padron" ? " on" : ""}`} onClick={() => setTab("padron")}>📋 Padrón</button>
          <button className={`cc-tab${tab === "buscar" ? " on" : ""}`} onClick={() => setTab("buscar")}>🔍 Buscar matriculado</button>
          {esAdmin && <button className={`cc-tab${tab === "sync" ? " on" : ""}`} onClick={() => setTab("sync")}>🔄 Sincronizar teléfonos</button>}
        </div>

        {/* ═══ PADRÓN ═══ */}
        {tab === "padron" && (
          <div className="cc-card">
            {stats && stats.total > 0 ? (
              <div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                  Muestra del padrón — últimos 20 registros
                </div>
                <PadronMuestra />
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>📭</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                  Padrón vacío
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                  {esAdmin
                    ? "El padrón COCIR no ha sido sincronizado. Ejecutá la sincronización desde el panel de administración (/admin/sync)."
                    : "El padrón aún no fue cargado. Contactá al administrador."}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ BUSCAR ═══ */}
        {tab === "buscar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              className="cc-input"
              placeholder="Nombre, apellido, inmobiliaria o número de matrícula..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {buscando && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                <div className="cc-spinner" /> Buscando en el padrón...
              </div>
            )}
            {!buscando && busqueda.length >= 2 && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                {resultados.length === 0 ? "Sin resultados." : `${resultados.length} resultado${resultados.length > 1 ? "s" : ""}`}
              </div>
            )}
            {resultados.length > 0 && (
              <div className="cc-card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="cc-tabla">
                  <thead>
                    <tr>
                      <th>Matrícula</th>
                      <th>Apellido y Nombre</th>
                      <th>Estado</th>
                      <th>Inmobiliaria</th>
                      <th>Teléfono</th>
                      <th>Celular</th>
                      <th>Email</th>
                      <th>Localidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map(r => (
                      <tr key={r.matricula}>
                        <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#cc0000" }}>{r.matricula}</td>
                        <td style={{ color: "#fff", fontWeight: 600, fontFamily: "Montserrat,sans-serif", fontSize: 12 }}>
                          {[r.apellido, r.nombre].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td>
                          <span className="cc-badge" style={{ background: `${estadoColor(r.estado)}18`, color: estadoColor(r.estado), border: `1px solid ${estadoColor(r.estado)}35` }}>
                            {r.estado ?? "—"}
                          </span>
                        </td>
                        <td style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>{r.inmobiliaria || "—"}</td>
                        <td>
                          {r.telefono
                            ? <span style={{color:"rgba(255,255,255,0.7)",fontFamily:"Montserrat,sans-serif",fontWeight:600,fontSize:11}}>{r.telefono}</span>
                            : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                        </td>
                        <td>
                          {r.celular
                            ? <a href={`https://wa.me/${r.celular.replace(/\D/g,"").replace(/^0/,"549").replace(/^54(?!9)/,"549")}`} target="_blank" rel="noopener noreferrer" style={{color:"#25d366",textDecoration:"none",fontFamily:"Montserrat,sans-serif",fontWeight:700,fontSize:12}}>{r.celular}</a>
                            : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                        </td>
                        <td>
                          {r.email
                            ? <a href={`mailto:${r.email}`} style={{color:"#f87171",textDecoration:"none",fontSize:11,wordBreak:"break-all"}}>{r.email}</a>
                            : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                        </td>
                        <td style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{r.localidad || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {busqueda.length < 2 && (
              <div style={{ padding: "30px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>🔍</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                  Ingresá al menos 2 caracteres para buscar
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SYNC TELÉFONOS (solo admin) ═══ */}
        {tab === "sync" && esAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="cc-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                Sincronización de datos desde padrón COCIR → perfiles
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.6 }}>
                Copia los datos del padrón COCIR hacia los perfiles de usuarios registrados, cruzando por número de matrícula. Por defecto solo actualiza campos vacíos.
              </div>

              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                Campos a sincronizar
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {[
                  { id: "telefono", label: "Teléfono fijo", desc: "Teléfono fijo del padrón COCIR → perfil.telefono" },
                  { id: "celular", label: "Celular", desc: "Celular del padrón COCIR → perfil.celular_oficina" },
                  { id: "email", label: "Email", desc: "Dirección de email del padrón → perfil.email" },
                  { id: "inmobiliaria", label: "Inmobiliaria", desc: "Razón social de la inmobiliaria → perfil.inmobiliaria" },
                ].map(campo => (
                  <label key={campo.id} className="cc-cb-row">
                    <input
                      type="checkbox"
                      checked={syncCampos.includes(campo.id)}
                      onChange={() => toggleCampo(campo.id)}
                    />
                    <div>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: syncCampos.includes(campo.id) ? "#fff" : "rgba(255,255,255,0.5)" }}>
                        {campo.label}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{campo.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <label className="cc-cb-row" style={{ marginBottom: 16, borderColor: syncForzar ? "rgba(234,179,8,0.3)" : undefined, background: syncForzar ? "rgba(234,179,8,0.05)" : undefined }}>
                <input type="checkbox" checked={syncForzar} onChange={e => setSyncForzar(e.target.checked)} />
                <div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: syncForzar ? "#eab308" : "rgba(255,255,255,0.5)" }}>
                    ⚠ Forzar sobreescritura
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Actualiza aunque el perfil ya tenga el dato cargado</div>
                </div>
              </label>

              {syncError && (
                <div style={{ padding: "10px 14px", background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.25)", borderRadius: 6, fontSize: 12, color: "rgba(255,100,100,0.9)", marginBottom: 12 }}>
                  ⚠ {syncError}
                </div>
              )}

              <button
                className="cc-btn cc-btn-primary"
                onClick={ejecutarSync}
                disabled={syncCargando || syncCampos.length === 0}
              >
                {syncCargando ? <><span className="cc-spinner" />Sincronizando...</> : `▶ Ejecutar sincronización (${syncCampos.join(", ")})`}
              </button>
            </div>

            {/* Resultado */}
            {syncResultado && (
              <div className="cc-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
                  Resultado de la sincronización
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
                  <div className="cc-sync-stat">
                    <div className="cc-sync-stat-val" style={{ color: "#22c55e" }}>{syncResultado.actualizados}</div>
                    <div className="cc-sync-stat-label">Actualizados</div>
                  </div>
                  <div className="cc-sync-stat">
                    <div className="cc-sync-stat-val" style={{ color: "rgba(255,255,255,0.4)" }}>{syncResultado.omitidos}</div>
                    <div className="cc-sync-stat-label">Omitidos</div>
                  </div>
                  <div className="cc-sync-stat">
                    <div className="cc-sync-stat-val" style={{ color: syncResultado.errores > 0 ? "#ef4444" : "rgba(255,255,255,0.4)" }}>{syncResultado.errores}</div>
                    <div className="cc-sync-stat-label">Errores</div>
                  </div>
                  <div className="cc-sync-stat">
                    <div className="cc-sync-stat-val" style={{ color: "#3b82f6" }}>{syncResultado.total_perfiles}</div>
                    <div className="cc-sync-stat-label">Perfiles totales</div>
                  </div>
                </div>

                {syncResultado.detalle.length > 0 && (
                  <>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                      Detalle de cambios ({syncResultado.detalle.length})
                    </div>
                    <div style={{ maxHeight: 250, overflowY: "auto" }}>
                      {syncResultado.detalle.map(d => (
                        <div key={d.id} style={{ padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 800, color: "#cc0000", flexShrink: 0 }}>#{d.matricula}</span>
                          <div style={{ flex: 1 }}>
                            {Object.entries(d.cambios).map(([campo, valor]) => (
                              <span key={campo} style={{ fontSize: 11, color: "#22c55e", fontFamily: "Montserrat,sans-serif", marginRight: 10 }}>
                                {campo}: <strong>{valor}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-componente: muestra del padrón ───────────────────────────────────────

function PadronMuestra() {
  const [filas, setFilas] = useState<PadronEntry[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from("cocir_padron")
        .select("matricula, apellido, nombre, estado, inmobiliaria, telefono, celular, email, localidad")
        .order("matricula", { ascending: false })
        .limit(20);
      setFilas((data ?? []) as PadronEntry[]);
      setCargando(false);
    };
    cargar();
  }, []);

  if (cargando) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Cargando...</div>;
  if (filas.length === 0) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Sin datos en el padrón.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {["Matrícula", "Apellido y Nombre", "Estado", "Inmobiliaria", "Teléfono", "Celular", "Email", "Localidad"].map(h => (
              <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(r => (
            <tr key={r.matricula}>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#cc0000" }}>{r.matricula}</td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#fff", fontWeight: 600, fontFamily: "Montserrat,sans-serif", fontSize: 12 }}>
                {[r.apellido, r.nombre].filter(Boolean).join(", ") || "—"}
              </td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 10, fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, background: `${estadoColor(r.estado)}18`, color: estadoColor(r.estado), border: `1px solid ${estadoColor(r.estado)}35` }}>
                  {r.estado ?? "—"}
                </span>
              </td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{r.inmobiliaria || "—"}</td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {r.telefono
                  ? <span style={{color:"rgba(255,255,255,0.7)",fontFamily:"Montserrat,sans-serif",fontWeight:600,fontSize:11}}>{r.telefono}</span>
                  : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
              </td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {r.celular
                  ? <a href={`https://wa.me/${r.celular.replace(/\D/g,"").replace(/^0/,"549").replace(/^54(?!9)/,"549")}`} target="_blank" rel="noopener noreferrer" style={{color:"#25d366",textDecoration:"none",fontFamily:"Montserrat,sans-serif",fontWeight:700,fontSize:11}}>{r.celular}</a>
                  : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
              </td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {r.email
                  ? <a href={`mailto:${r.email}`} style={{color:"#f87171",textDecoration:"none",fontSize:11,wordBreak:"break-all"}}>{r.email}</a>
                  : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
              </td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{r.localidad || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
