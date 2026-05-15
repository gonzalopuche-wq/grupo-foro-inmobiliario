"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface MirMatch {
  id: string;
  ofrecido_id: string;
  busqueda_id: string;
  costo_desbloqueo: number | null;
  created_at: string;
  ofrecido?: { tipo_propiedad: string; operacion: string; ciudad: string; zona: string | null; precio: number | null; moneda: string | null; dormitorios: number | null; sup_cubierta: number | null; perfil_id: string; perfiles?: { nombre: string; apellido: string; } } | null;
  busqueda?: { tipo_propiedad: string; operacion: string; ciudad: string; zona: string | null; presupuesto_max: number | null; moneda: string | null; perfil_id: string; perfiles?: { nombre: string; apellido: string; } } | null;
}

interface BarrioAlert {
  barrio: string;
  count: number;
  precio_m2_avg: number;
  variacion: number | null;
}

type VistaAlerta = "mis_matches" | "mercado" | "configuracion";

const fmtUSD = (n: number) => `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AlertasMercadoPage() {
  const [userId, setUserId]  = useState<string | null>(null);
  const [vista, setVista]    = useState<VistaAlerta>("mis_matches");
  const [matches, setMatches] = useState<MirMatch[]>([]);
  const [barrioAlerts, setBarrioAlerts] = useState<BarrioAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertaZonas, setAlertaZonas] = useState<string[]>([]);
  const [zonaInput, setZonaInput]     = useState("");
  const [guardandoConf, setGuardandoConf] = useState(false);
  const [confOk, setConfOk]           = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/"; return; }
      setUserId(user.id);
      await Promise.all([
        cargarMatches(user.id),
        cargarBarrioAlerts(),
        cargarConfiguracion(user.id),
      ]);
      setLoading(false);
    };
    init();
  }, []);

  const cargarMatches = async (uid: string) => {
    const [{ data: misOfertas }, { data: misBusquedas }] = await Promise.all([
      supabase.from("mir_matches")
        .select("*, ofrecido:ofrecido_id(tipo_propiedad, operacion, ciudad, zona, precio, moneda, dormitorios, sup_cubierta, perfil_id), busqueda:busqueda_id(tipo_propiedad, operacion, ciudad, zona, presupuesto_max, moneda, perfil_id, perfiles!perfil_id(nombre, apellido))")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("mir_matches")
        .select("*, ofrecido:ofrecido_id(tipo_propiedad, operacion, ciudad, zona, precio, moneda, dormitorios, sup_cubierta, perfil_id, perfiles!perfil_id(nombre, apellido)), busqueda:busqueda_id(tipo_propiedad, operacion, ciudad, zona, presupuesto_max, moneda, perfil_id)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    // Filtrar: matches donde yo soy parte (ofrecido o busqueda mía)
    const misOfertasItems = (misOfertas ?? []).filter((m: any) => m.ofrecido?.perfil_id === uid);
    const misBusquedasItems = (misBusquedas ?? []).filter((m: any) => m.busqueda?.perfil_id === uid);
    const todos = [...misOfertasItems, ...misBusquedasItems];
    const uniqueIds = new Set<string>();
    const unique = todos.filter(m => { if (uniqueIds.has(m.id)) return false; uniqueIds.add(m.id); return true; });
    setMatches(unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const cargarBarrioAlerts = async () => {
    const { data } = await supabase
      .from("comparables")
      .select("barrio, precio_venta, sup_cubierta")
      .not("barrio", "is", null)
      .not("precio_venta", "is", null)
      .gt("precio_venta", 0)
      .order("created_at", { ascending: false })
      .limit(1000);
    const barrioMap: Record<string, { precios: number[]; m2s: number[] }> = {};
    (data ?? []).forEach((r: any) => {
      if (!r.barrio) return;
      if (!barrioMap[r.barrio]) barrioMap[r.barrio] = { precios: [], m2s: [] };
      barrioMap[r.barrio].precios.push(r.precio_venta);
      if (r.sup_cubierta > 0) barrioMap[r.barrio].m2s.push(r.precio_venta / r.sup_cubierta);
    });
    const alerts: BarrioAlert[] = Object.entries(barrioMap)
      .filter(([, v]) => v.precios.length >= 2)
      .map(([barrio, v]) => ({
        barrio,
        count: v.precios.length,
        precio_m2_avg: v.m2s.length > 0 ? Math.round(v.m2s.reduce((a, b) => a + b) / v.m2s.length) : 0,
        variacion: null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    setBarrioAlerts(alerts);
  };

  const cargarConfiguracion = async (uid: string) => {
    const { data } = await supabase.from("perfiles").select("configuracion").eq("id", uid).single();
    const zonas = data?.configuracion?.alertas_zonas ?? [];
    setAlertaZonas(zonas);
  };

  const guardarConfiguracion = async () => {
    if (!userId) return;
    setGuardandoConf(true);
    const { data: perfil } = await supabase.from("perfiles").select("configuracion").eq("id", userId).single();
    const confActual = perfil?.configuracion ?? {};
    await supabase.from("perfiles").update({ configuracion: { ...confActual, alertas_zonas: alertaZonas } }).eq("id", userId);
    setGuardandoConf(false);
    setConfOk(true);
    setTimeout(() => setConfOk(false), 2500);
  };

  const agregarZona = () => {
    const z = zonaInput.trim();
    if (!z || alertaZonas.includes(z)) return;
    setAlertaZonas(prev => [...prev, z]);
    setZonaInput("");
  };

  const quitarZona = (z: string) => setAlertaZonas(prev => prev.filter(x => x !== z));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #fff; font-family: Inter,sans-serif; }
        .am-root { min-height: 100vh; background: #0a0a0a; padding: 0 0 60px; }
        .am-header { background: rgba(6,6,6,0.98); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12; }
        .am-logo { font-family: Montserrat,sans-serif; font-size: 13px; font-weight: 800; }
        .am-logo span { color: #cc0000; }
        .am-body { max-width: 900px; margin: 0 auto; padding: 28px 20px; }
        .am-title { font-family: Montserrat,sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 6px; }
        .am-title span { color: #cc0000; }
        .am-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 22px; }
        .am-tabs { display: flex; gap: 6px; margin-bottom: 24px; }
        .am-tab { padding: 8px 18px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .am-tab.activo { background: #cc0000; border-color: #cc0000; color: #fff; }
        .am-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 16px 18px; margin-bottom: 10px; }
        .am-card:hover { border-color: rgba(255,255,255,0.12); }
        .am-empty { padding: 48px 20px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; }
        .am-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; text-transform: uppercase; }
        .am-input { padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #fff; font-size: 13px; font-family: Inter,sans-serif; outline: none; }
        .am-input:focus { border-color: rgba(204,0,0,0.5); }
        .am-btn { padding: 8px 16px; background: #cc0000; border: none; border-radius: 5px; color: #fff; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .am-btn-sm { padding: 5px 12px; background: transparent; border: 1px solid rgba(239,68,68,0.3); border-radius: 5px; color: rgba(239,68,68,0.8); font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; cursor: pointer; }
        .am-zona-tag { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background: rgba(204,0,0,0.1); border: 1px solid rgba(204,0,0,0.2); border-radius: 20px; font-size: 12px; color: #cc0000; font-family: Montserrat,sans-serif; font-weight: 700; }
        .am-zona-x { background: none; border: none; color: rgba(239,68,68,0.6); cursor: pointer; font-size: 13px; padding: 0; line-height: 1; }
      `}</style>

      <div className="am-root">
        <header className="am-header">
          <div className="am-logo">GFI<span>®</span> — Alertas de Mercado</div>
          <Link href="/dashboard" style={{ padding: "6px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, textTransform: "uppercase", textDecoration: "none" }}>← Dashboard</Link>
        </header>

        <div className="am-body">
          <div className="am-title">Alertas de <span>Mercado</span></div>
          <div className="am-sub">Matches MIR, actividad por zona y configuración de alertas personalizadas.</div>

          <div className="am-tabs">
            <button className={`am-tab${vista === "mis_matches" ? " activo" : ""}`} onClick={() => setVista("mis_matches")}>🔔 Mis matches MIR ({matches.length})</button>
            <button className={`am-tab${vista === "mercado" ? " activo" : ""}`} onClick={() => setVista("mercado")}>📊 Actividad por zona</button>
            <button className={`am-tab${vista === "configuracion" ? " activo" : ""}`} onClick={() => setVista("configuracion")}>⚙ Configurar alertas</button>
          </div>

          {loading ? (
            <div className="am-empty">Cargando alertas...</div>
          ) : vista === "mis_matches" ? (
            <>
              {matches.length === 0 ? (
                <div className="am-empty">
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
                  <div>No tenés matches MIR aún.</div>
                  <div style={{ fontSize: 12, marginTop: 6, color: "rgba(255,255,255,0.15)" }}>
                    Publicá una oferta o búsqueda en el <Link href="/mir" style={{ color: "#cc0000" }}>MIR</Link> para generar matches.
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {matches.length} match{matches.length !== 1 ? "es" : ""} encontrado{matches.length !== 1 ? "s" : ""}
                  </div>
                  {matches.map(m => {
                    const esOfrecido = m.ofrecido?.perfil_id === userId;
                    const prop = m.ofrecido;
                    const busq = m.busqueda;
                    return (
                      <div key={m.id} className="am-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <span className="am-badge" style={{ background: esOfrecido ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)", color: esOfrecido ? "#60a5fa" : "#22c55e" }}>
                                {esOfrecido ? "Tu oferta" : "Tu búsqueda"}
                              </span>
                              {prop && <span className="am-badge" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>{prop.tipo_propiedad}</span>}
                            </div>

                            {prop && (
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                                  {prop.tipo_propiedad} en {prop.zona ?? prop.ciudad}
                                  {prop.dormitorios && ` · ${prop.dormitorios} dorm.`}
                                  {prop.sup_cubierta && ` · ${prop.sup_cubierta}m²`}
                                </div>
                                {prop.precio && (
                                  <div style={{ fontSize: 13, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                                    {fmtUSD(prop.precio)}
                                  </div>
                                )}
                              </div>
                            )}

                            {busq && !esOfrecido && (
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                Búsqueda: {busq.tipo_propiedad} en {busq.zona ?? busq.ciudad}
                                {busq.presupuesto_max && ` · hasta ${fmtUSD(busq.presupuesto_max)}`}
                              </div>
                            )}

                            {!esOfrecido && m.ofrecido?.perfiles && (
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                                Corredor que oferta: {(m.ofrecido.perfiles as any).nombre} {(m.ofrecido.perfiles as any).apellido}
                              </div>
                            )}
                            {esOfrecido && m.busqueda?.perfiles && (
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                                Corredor interesado: {(m.busqueda.perfiles as any).nombre} {(m.busqueda.perfiles as any).apellido}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>{fmtFecha(m.created_at)}</div>
                            {m.costo_desbloqueo && m.costo_desbloqueo > 0 && (
                              <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, color: "#f59e0b", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                                Desbloqueo: ${m.costo_desbloqueo}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                          <Link href="/mir" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 5, color: "#cc0000", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Ver en MIR →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : vista === "mercado" ? (
            <>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Actividad de comparables por barrio — Rosario
              </div>
              {barrioAlerts.length === 0 ? (
                <div className="am-empty">No hay datos de comparables cargados.</div>
              ) : (
                <div>
                  {barrioAlerts.map((b, i) => {
                    const esAlertado = alertaZonas.some(z => b.barrio.toLowerCase().includes(z.toLowerCase()));
                    return (
                      <div key={b.barrio} className="am-card" style={{ borderColor: esAlertado ? "rgba(204,0,0,0.25)" : undefined }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ width: 28, fontSize: 14, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: i < 3 ? "#f59e0b" : "rgba(255,255,255,0.25)" }}>#{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{b.barrio}</span>
                              {esAlertado && <span className="am-badge" style={{ background: "rgba(204,0,0,0.15)", color: "#cc0000" }}>🔔 Seguido</span>}
                            </div>
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{b.count} comparables</span>
                              {b.precio_m2_avg > 0 && <span style={{ fontSize: 12, color: "#22c55e", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{fmtUSD(b.precio_m2_avg)}/m²</span>}
                            </div>
                          </div>
                          <div style={{ width: 120 }}>
                            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                              <div style={{ height: "100%", width: `${Math.round((b.count / barrioAlerts[0].count) * 100)}%`, background: "#cc0000", borderRadius: 2 }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 12, textAlign: "center" }}>
                    <Link href="/observatorio" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                      Ver datos completos en el Observatorio →
                    </Link>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Configuración */
            <div>
              <div className="am-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>Zonas que seguís</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
                  Agregá barrios o zonas para que se resalten en la vista de actividad de mercado.
                </div>

                {alertaZonas.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {alertaZonas.map(z => (
                      <span key={z} className="am-zona-tag">
                        {z}
                        <button className="am-zona-x" onClick={() => quitarZona(z)}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="am-input"
                    placeholder="Ej: Fisherton, Centro, Puerto Norte..."
                    value={zonaInput}
                    onChange={e => setZonaInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") agregarZona(); }}
                    style={{ flex: 1 }}
                  />
                  <button className="am-btn" onClick={agregarZona}>Agregar</button>
                </div>
              </div>

              <div className="am-card" style={{ marginTop: 12 }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Alertas MIR</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                  Cuando publiques una oferta o búsqueda en el MIR, el sistema cruza automáticamente con el resto de la comunidad.
                  Los nuevos matches aparecen en la pestaña <strong style={{ color: "#fff" }}>Mis matches MIR</strong>.
                </div>
                <div style={{ marginTop: 14 }}>
                  <Link href="/mir" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "rgba(204,0,0,0.1)", border: "1px solid rgba(204,0,0,0.25)", borderRadius: 6, color: "#cc0000", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Ir al MIR →
                  </Link>
                </div>
              </div>

              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                {confOk && <span style={{ fontSize: 12, color: "#22c55e", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>✓ Guardado</span>}
                <button className="am-btn" onClick={guardarConfiguracion} disabled={guardandoConf}>
                  {guardandoConf ? "Guardando..." : "Guardar configuración"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
