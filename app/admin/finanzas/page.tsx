"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Ingreso {
  id: string;
  tipo: string;
  descripcion: string | null;
  monto_usd: number | null;
  monto_ars: number | null;
  cotizacion_usd: number | null;
  periodo: string;
  fecha: string;
  confirmado: boolean;
  perfil_id: string | null;
  perfiles?: { nombre: string; apellido: string } | null;
}

interface Egreso {
  id: string;
  descripcion: string;
  monto_ars: number;
  categoria: string | null;
  periodo: string;
  fecha: string;
}

interface Resumen {
  periodo: string;
  total_ingresos_ars: number;
  total_egresos_ars: number;
  ingreso_neto: number;
  reserva: number;
  ganancia: number;
  porcentaje_reserva: number;
  cerrado: boolean;
}

const TIPO_LABEL: Record<string, string> = {
  abono_corredor: "Abono CI",
  abono_colaborador: "Abono Colaborador",
  evento_ci: "Evento CI",
  otro: "Otro",
};

const TIPO_COLOR: Record<string, string> = {
  abono_corredor: "#22c55e",
  abono_colaborador: "#60a5fa",
  evento_ci: "#eab308",
  otro: "rgba(255,255,255,0.5)",
};

const periodoActual = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const FORM_INGRESO_VACIO = {
  tipo: "abono_corredor",
  descripcion: "",
  monto_usd: "",
  monto_ars: "",
  cotizacion_usd: "",
  periodo: periodoActual(),
};

const FORM_EGRESO_VACIO = {
  descripcion: "",
  monto_ars: "",
  categoria: "",
  periodo: periodoActual(),
};

export default function FinanzasPage() {
  const [periodo, setPeriodo] = useState(periodoActual());
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"resumen" | "ingresos" | "egresos">("resumen");
  const [mostrarFormIngreso, setMostrarFormIngreso] = useState(false);
  const [mostrarFormEgreso, setMostrarFormEgreso] = useState(false);
  const [formIngreso, setFormIngreso] = useState(FORM_INGRESO_VACIO);
  const [formEgreso, setFormEgreso] = useState(FORM_EGRESO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [dolarHoy, setDolarHoy] = useState<number | null>(null);

  useEffect(() => {
    const verificar = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      cargarDatos();
    };
    verificar();

    fetch("https://dolarapi.com/v1/dolares/blue")
      .then(r => r.json())
      .then(d => {
        const promedio = (parseFloat(d.compra) + parseFloat(d.venta)) / 2;
        setDolarHoy(Math.round(promedio));
        setFormIngreso(prev => ({ ...prev, cotizacion_usd: String(Math.round(promedio)) }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { cargarDatos(); }, [periodo]);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: ing }, { data: egr }] = await Promise.all([
      supabase.from("finanzas_ingresos").select("*, perfiles(nombre, apellido)").eq("periodo", periodo).order("fecha", { ascending: false }),
      supabase.from("finanzas_egresos").select("*").eq("periodo", periodo).order("fecha", { ascending: false }),
    ]);
    setIngresos((ing as unknown as Ingreso[]) ?? []);
    setEgresos(egr ?? []);
    calcularResumen(ing ?? [], egr ?? []);
    setLoading(false);
  };

  const calcularResumen = (ing: Ingreso[], egr: Egreso[]) => {
    const totalIngresos = ing.filter(i => i.confirmado).reduce((a, i) => a + (i.monto_ars ?? 0), 0);
    const totalEgresos = egr.reduce((a, e) => a + e.monto_ars, 0);
    const neto = totalIngresos - totalEgresos;
    const pct = 20;
    const reserva = Math.max(0, neto * pct / 100);
    const ganancia = Math.max(0, neto * (100 - pct) / 100);
    setResumen({ periodo, total_ingresos_ars: totalIngresos, total_egresos_ars: totalEgresos, ingreso_neto: neto, reserva, ganancia, porcentaje_reserva: pct, cerrado: false });
  };

  const guardarIngreso = async () => {
    if (!formIngreso.monto_ars && !formIngreso.monto_usd) return;
    setGuardando(true);
    let montoArs = formIngreso.monto_ars ? parseFloat(formIngreso.monto_ars) : 0;
    if (!montoArs && formIngreso.monto_usd && formIngreso.cotizacion_usd) {
      montoArs = parseFloat(formIngreso.monto_usd) * parseFloat(formIngreso.cotizacion_usd);
    }
    await supabase.from("finanzas_ingresos").insert({
      tipo: formIngreso.tipo,
      descripcion: formIngreso.descripcion || null,
      monto_usd: formIngreso.monto_usd ? parseFloat(formIngreso.monto_usd) : null,
      monto_ars: montoArs,
      cotizacion_usd: formIngreso.cotizacion_usd ? parseFloat(formIngreso.cotizacion_usd) : null,
      periodo: formIngreso.periodo,
      confirmado: true,
    });
    setGuardando(false);
    setMostrarFormIngreso(false);
    setFormIngreso(FORM_INGRESO_VACIO);
    cargarDatos();
  };

  const guardarEgreso = async () => {
    if (!formEgreso.descripcion || !formEgreso.monto_ars) return;
    setGuardando(true);
    await supabase.from("finanzas_egresos").insert({
      descripcion: formEgreso.descripcion,
      monto_ars: parseFloat(formEgreso.monto_ars),
      categoria: formEgreso.categoria || null,
      periodo: formEgreso.periodo,
    });
    setGuardando(false);
    setMostrarFormEgreso(false);
    setFormEgreso(FORM_EGRESO_VACIO);
    cargarDatos();
  };

  const eliminarIngreso = async (id: string) => {
    await supabase.from("finanzas_ingresos").delete().eq("id", id);
    cargarDatos();
  };

  const eliminarEgreso = async (id: string) => {
    await supabase.from("finanzas_egresos").delete().eq("id", id);
    cargarDatos();
  };

  const formatARS = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const formatPeriodo = (p: string) => {
    const [y, m] = p.split("-");
    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return `${meses[parseInt(m) - 1]} ${y}`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .fn-root { min-height: 100vh; display: flex; flex-direction: column; }
        .fn-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .fn-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .fn-topbar-logo span { color: #cc0000; }
        .fn-topbar-right { display: flex; gap: 12px; align-items: center; }
        .fn-btn-back { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .fn-btn-back:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

        .fn-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
        .fn-header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .fn-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .fn-header h1 span { color: #cc0000; }
        .fn-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .fn-periodo { display: flex; align-items: center; gap: 10px; }
        .fn-periodo-label { font-size: 11px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
        .fn-periodo-input { padding: 7px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: #fff; font-size: 13px; outline: none; }

        /* TABS */
        .fn-tabs { display: flex; gap: 10px; }
        .fn-tab { padding: 8px 20px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .fn-tab:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .fn-tab.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }

        /* RESUMEN CARDS */
        .fn-resumen-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
        .fn-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px; }
        .fn-card.ganancia { border-color: rgba(34,197,94,0.25); background: rgba(34,197,94,0.04); }
        .fn-card.reserva { border-color: rgba(234,179,8,0.2); background: rgba(234,179,8,0.03); }
        .fn-card-label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 8px; }
        .fn-card-valor { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; color: #fff; line-height: 1; }
        .fn-card-valor.verde { color: #22c55e; }
        .fn-card-valor.amarillo { color: #eab308; }
        .fn-card-valor.rojo { color: #ff4444; }
        .fn-card-sub { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 6px; }

        /* TABLA */
        .fn-tabla-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .fn-tabla-titulo { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 800; }
        .fn-tabla-titulo span { color: #cc0000; }
        .fn-btn-agregar { padding: 8px 18px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .fn-btn-agregar:hover { background: #e60000; }
        .fn-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .fn-tabla { width: 100%; border-collapse: collapse; }
        .fn-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .fn-tabla th { padding: 11px 16px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .fn-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .fn-tabla tbody tr:last-child { border-bottom: none; }
        .fn-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .fn-tabla td { padding: 12px 16px; font-size: 13px; vertical-align: middle; }
        .fn-desc { font-weight: 500; color: #fff; }
        .fn-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .fn-monto { font-family: 'Montserrat', sans-serif; font-weight: 700; }
        .fn-monto.positivo { color: #22c55e; }
        .fn-monto.negativo { color: #ff4444; }
        .fn-btn-del { padding: 4px 10px; background: transparent; border: 1px solid rgba(200,0,0,0.3); border-radius: 3px; color: rgba(200,0,0,0.6); font-size: 10px; cursor: pointer; transition: all 0.2s; }
        .fn-btn-del:hover { background: rgba(200,0,0,0.1); color: #ff4444; }
        .fn-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }

        /* MODAL */
        .fn-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; }
        .fn-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 36px; width: 100%; max-width: 480px; position: relative; }
        .fn-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .fn-modal h2 { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 24px; }
        .fn-modal h2 span { color: #cc0000; }
        .fn-field { margin-bottom: 14px; }
        .fn-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-family: 'Montserrat', sans-serif; }
        .fn-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter', sans-serif; }
        .fn-input:focus { border-color: rgba(200,0,0,0.5); }
        .fn-input::placeholder { color: rgba(255,255,255,0.2); }
        .fn-select { width: 100%; padding: 10px 14px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .fn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fn-dolar-hint { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 4px; }
        .fn-modal-actions { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; }
        .fn-btn-cancelar { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .fn-btn-cancelar:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .fn-btn-guardar { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .fn-btn-guardar:hover { background: #e60000; }
        .fn-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }

        .badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; }

        @media (max-width: 900px) { .fn-resumen-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 600px) { .fn-content { padding: 16px; } .fn-resumen-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <div className="fn-root">
        <header className="fn-topbar">
          <div className="fn-topbar-logo"><span>GFI</span>® · Finanzas</div>
          <div className="fn-topbar-right">
            <a className="fn-btn-back" href="/admin">← Panel Admin</a>
          </div>
        </header>

        <main className="fn-content">
          <div className="fn-header">
            <div>
              <h1>Administración <span>financiera</span></h1>
              <p>Ingresos, egresos, reserva y ganancia de GFI®</p>
            </div>
            <div className="fn-periodo">
              <span className="fn-periodo-label">Período</span>
              <input className="fn-periodo-input" type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} />
            </div>
          </div>

          <div className="fn-tabs">
            <button className={`fn-tab${vista === "resumen" ? " activo" : ""}`} onClick={() => setVista("resumen")}>📊 Resumen</button>
            <button className={`fn-tab${vista === "ingresos" ? " activo" : ""}`} onClick={() => setVista("ingresos")}>💚 Ingresos</button>
            <button className={`fn-tab${vista === "egresos" ? " activo" : ""}`} onClick={() => setVista("egresos")}>🔴 Egresos</button>
          </div>

          {/* RESUMEN */}
          {vista === "resumen" && (
            <>
              <div className="fn-resumen-grid">
                <div className="fn-card">
                  <div className="fn-card-label">Total ingresos</div>
                  <div className="fn-card-valor verde">{resumen ? formatARS(resumen.total_ingresos_ars) : "—"}</div>
                  <div className="fn-card-sub">{formatPeriodo(periodo)}</div>
                </div>
                <div className="fn-card">
                  <div className="fn-card-label">Total egresos</div>
                  <div className="fn-card-valor rojo">{resumen ? formatARS(resumen.total_egresos_ars) : "—"}</div>
                  <div className="fn-card-sub">Gastos del período</div>
                </div>
                <div className="fn-card reserva">
                  <div className="fn-card-label">Reserva 20%</div>
                  <div className="fn-card-valor amarillo">{resumen ? formatARS(resumen.reserva) : "—"}</div>
                  <div className="fn-card-sub">Fondo de reserva</div>
                </div>
                <div className="fn-card ganancia">
                  <div className="fn-card-label">Ganancia neta 80%</div>
                  <div className="fn-card-valor verde">{resumen ? formatARS(resumen.ganancia) : "—"}</div>
                  <div className="fn-card-sub">Tu retiro del mes</div>
                </div>
              </div>

              {/* RESUMEN DETALLE */}
              <div style={{background:"rgba(14,14,14,0.9)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,padding:"20px 24px"}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase" as const,color:"rgba(255,255,255,0.3)",marginBottom:16}}>
                  Fórmula del período
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {[
                    ["Ingresos confirmados", resumen?.total_ingresos_ars ?? 0, "verde"],
                    ["− Egresos", -(resumen?.total_egresos_ars ?? 0), "rojo"],
                    ["= Ingreso neto", resumen?.ingreso_neto ?? 0, ""],
                    ["− Reserva (20%)", -(resumen?.reserva ?? 0), "amarillo"],
                    ["= Ganancia (80%)", resumen?.ganancia ?? 0, "verde"],
                  ].map(([label, valor, color], i) => (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none"}}>
                      <span style={{fontSize:13,color:i === 4 ? "#fff" : "rgba(255,255,255,0.6)",fontWeight:i === 4 ? 700 : 400}}>{label as string}</span>
                      <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:14,color:color === "verde" ? "#22c55e" : color === "rojo" ? "#ff4444" : color === "amarillo" ? "#eab308" : "#fff"}}>
                        {formatARS(Number(valor))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {dolarHoy && (
                <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center" as const}}>
                  USD Blue hoy: {formatARS(dolarHoy)} · Usado para conversión de abonos en USD
                </div>
              )}
            </>
          )}

          {/* INGRESOS */}
          {vista === "ingresos" && (
            <div>
              <div className="fn-tabla-header">
                <div className="fn-tabla-titulo">Ingresos de <span>{formatPeriodo(periodo)}</span></div>
                <button className="fn-btn-agregar" onClick={() => setMostrarFormIngreso(true)}>+ Registrar ingreso</button>
              </div>
              <div className="fn-tabla-wrap">
                {loading ? (
                  <div className="fn-empty">Cargando...</div>
                ) : ingresos.length === 0 ? (
                  <div className="fn-empty">No hay ingresos registrados en este período.</div>
                ) : (
                  <table className="fn-tabla">
                    <thead>
                      <tr>
                        <th>Descripción</th>
                        <th>Tipo</th>
                        <th>Fecha</th>
                        <th>Monto ARS</th>
                        <th>USD</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingresos.map(ing => (
                        <tr key={ing.id}>
                          <td>
                            <div className="fn-desc">{ing.descripcion ?? TIPO_LABEL[ing.tipo]}</div>
                            {ing.perfiles && <div className="fn-sub">{ing.perfiles.apellido}, {ing.perfiles.nombre}</div>}
                          </td>
                          <td>
                            <span className="badge" style={{background:`${TIPO_COLOR[ing.tipo]}20`,border:`1px solid ${TIPO_COLOR[ing.tipo]}50`,color:TIPO_COLOR[ing.tipo]}}>
                              {TIPO_LABEL[ing.tipo]}
                            </span>
                          </td>
                          <td style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{formatFecha(ing.fecha)}</td>
                          <td><span className="fn-monto positivo">{formatARS(ing.monto_ars ?? 0)}</span></td>
                          <td style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{ing.monto_usd ? `USD ${ing.monto_usd}` : "—"}</td>
                          <td><button className="fn-btn-del" onClick={() => eliminarIngreso(ing.id)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* EGRESOS */}
          {vista === "egresos" && (
            <div>
              <div className="fn-tabla-header">
                <div className="fn-tabla-titulo">Egresos de <span>{formatPeriodo(periodo)}</span></div>
                <button className="fn-btn-agregar" onClick={() => setMostrarFormEgreso(true)}>+ Registrar egreso</button>
              </div>
              <div className="fn-tabla-wrap">
                {loading ? (
                  <div className="fn-empty">Cargando...</div>
                ) : egresos.length === 0 ? (
                  <div className="fn-empty">No hay egresos registrados en este período.</div>
                ) : (
                  <table className="fn-tabla">
                    <thead>
                      <tr>
                        <th>Descripción</th>
                        <th>Categoría</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {egresos.map(egr => (
                        <tr key={egr.id}>
                          <td><div className="fn-desc">{egr.descripcion}</div></td>
                          <td style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{egr.categoria ?? "—"}</td>
                          <td style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{formatFecha(egr.fecha)}</td>
                          <td><span className="fn-monto negativo">{formatARS(egr.monto_ars)}</span></td>
                          <td><button className="fn-btn-del" onClick={() => eliminarEgreso(egr.id)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL INGRESO */}
      {mostrarFormIngreso && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormIngreso(false); }}>
          <div className="fn-modal">
            <h2>Registrar <span>ingreso</span></h2>
            <div className="fn-field">
              <label className="fn-label">Tipo</label>
              <select className="fn-select" value={formIngreso.tipo} onChange={e => setFormIngreso(p => ({ ...p, tipo: e.target.value }))}>
                <option value="abono_corredor">Abono corredor (USD 10)</option>
                <option value="abono_colaborador">Abono colaborador (USD 5)</option>
                <option value="evento_ci">Evento de CI</option>
                <option value="otro">Otro ingreso</option>
              </select>
            </div>
            <div className="fn-field">
              <label className="fn-label">Descripción</label>
              <input className="fn-input" placeholder="Ej: Abono abril - García, Juan" value={formIngreso.descripcion} onChange={e => setFormIngreso(p => ({ ...p, descripcion: e.target.value }))} />
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Monto USD</label>
                <input className="fn-input" type="number" placeholder="10" value={formIngreso.monto_usd} onChange={e => setFormIngreso(p => ({ ...p, monto_usd: e.target.value }))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Cotización USD</label>
                <input className="fn-input" type="number" placeholder="1400" value={formIngreso.cotizacion_usd} onChange={e => setFormIngreso(p => ({ ...p, cotizacion_usd: e.target.value }))} />
                {dolarHoy && <div className="fn-dolar-hint">Blue hoy: {formatARS(dolarHoy)}</div>}
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">O ingresá monto ARS directo</label>
              <input className="fn-input" type="number" placeholder="14000" value={formIngreso.monto_ars} onChange={e => setFormIngreso(p => ({ ...p, monto_ars: e.target.value }))} />
            </div>
            <div className="fn-field">
              <label className="fn-label">Período</label>
              <input className="fn-input" type="month" value={formIngreso.periodo} onChange={e => setFormIngreso(p => ({ ...p, periodo: e.target.value }))} />
            </div>
            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => setMostrarFormIngreso(false)}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={guardarIngreso} disabled={guardando}>
                {guardando ? "Guardando..." : "Registrar ingreso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EGRESO */}
      {mostrarFormEgreso && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormEgreso(false); }}>
          <div className="fn-modal">
            <h2>Registrar <span>egreso</span></h2>
            <div className="fn-field">
              <label className="fn-label">Descripción *</label>
              <input className="fn-input" placeholder="Ej: Hosting Railway" value={formEgreso.descripcion} onChange={e => setFormEgreso(p => ({ ...p, descripcion: e.target.value }))} />
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Monto ARS *</label>
                <input className="fn-input" type="number" placeholder="5000" value={formEgreso.monto_ars} onChange={e => setFormEgreso(p => ({ ...p, monto_ars: e.target.value }))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Categoría</label>
                <input className="fn-input" placeholder="Hosting, Dominio, etc." value={formEgreso.categoria} onChange={e => setFormEgreso(p => ({ ...p, categoria: e.target.value }))} />
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Período</label>
              <input className="fn-input" type="month" value={formEgreso.periodo} onChange={e => setFormEgreso(p => ({ ...p, periodo: e.target.value }))} />
            </div>
            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => setMostrarFormEgreso(false)}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={guardarEgreso} disabled={guardando || !formEgreso.descripcion || !formEgreso.monto_ars}>
                {guardando ? "Guardando..." : "Registrar egreso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
