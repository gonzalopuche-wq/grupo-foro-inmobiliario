"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Perfil {
  id: string;
  tipo: string;
  estado: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  dni: string | null;
  telefono: string | null;
  inmobiliaria: string | null;
  especialidades: string[] | null;
  created_at: string;
}

interface Indicador {
  clave: string;
  valor: number;
  label: string;
}

interface Pago {
  id: string;
  perfil_id: string;
  tipo: string;
  monto_usd: number;
  monto_ars: number | null;
  monto_declarado_ars: number | null;
  dolar_ref: number | null;
  estado: string;
  fecha_pago_declarado: string | null;
  fecha_confirmacion: string | null;
  fecha_vencimiento: string | null;
  periodo: string | null;
  comprobante: string | null;
  cbu_origen: string | null;
  nota_admin: string | null;
  creado_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; };
}

const INDICADORES_CONFIG = [
  { clave: "valor_jus", label: "Valor JUS" },
  { clave: "precio_corredor_usd", label: "Precio Corredor (USD)" },
  { clave: "precio_colaborador_usd", label: "Precio Colaborador (USD)" },
];

const ESTADO_BADGE: Record<string, string> = {
  pendiente: "badge-pendiente",
  aprobado: "badge-aprobado",
  rechazado: "badge-rechazado",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export default function AdminPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "pendiente" | "aprobado" | "rechazado">("pendiente");
  const [procesando, setProcesando] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);

  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState<string | null>(null);

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loadingPagos, setLoadingPagos] = useState(true);
  const [filtroPagos, setFiltroPagos] = useState<"pendiente" | "activa" | "todos">("pendiente");
  const [procesandoPago, setProcesandoPago] = useState<string | null>(null);
  const [notaAdmin, setNotaAdmin] = useState<Record<string, string>>({});

  useEffect(() => {
    const verificar = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", userData.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      setEsAdmin(true);
      cargarPerfiles();
      cargarIndicadores();
      cargarPagos();
    };
    verificar();
  }, []);

  const cargarPerfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from("perfiles").select("*").order("created_at", { ascending: false });
    setPerfiles(data ?? []);
    setLoading(false);
  };

  const cargarIndicadores = async () => {
    const claves = INDICADORES_CONFIG.map(i => i.clave);
    const { data } = await supabase.from("indicadores").select("clave, valor").in("clave", claves);
    if (!data) return;
    const result: Indicador[] = INDICADORES_CONFIG.map(cfg => {
      const row = data.find(r => r.clave === cfg.clave);
      return { clave: cfg.clave, label: cfg.label, valor: row?.valor ?? 0 };
    });
    setIndicadores(result);
    const editInit: Record<string, string> = {};
    result.forEach(i => {
      editInit[i.clave] = i.clave.includes("_usd")
        ? i.valor.toString()
        : i.valor.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
    setEditando(editInit);
  };

  const cargarPagos = async () => {
    setLoadingPagos(true);
    const { data } = await supabase
      .from("suscripciones")
      .select("*, perfiles(nombre, apellido, matricula)")
      .order("creado_at", { ascending: false });
    setPagos((data as unknown as Pago[]) ?? []);
    setLoadingPagos(false);
  };

  const confirmarPago = async (pago: Pago) => {
    setProcesandoPago(pago.id);
    const hoy = new Date().toISOString().slice(0, 10);
    const vencimiento = new Date();
    vencimiento.setMonth(vencimiento.getMonth() + 1);
    vencimiento.setDate(vencimiento.getDate() + 3);
    const fechaVenc = vencimiento.toISOString().slice(0, 10);

    await supabase.from("suscripciones").update({
      estado: "activa",
      fecha_confirmacion: hoy,
      fecha_vencimiento: fechaVenc,
      nota_admin: notaAdmin[pago.id] || null,
    }).eq("id", pago.id);

    await supabase.from("perfiles").update({ estado: "aprobado" }).eq("id", pago.perfil_id);

    setProcesandoPago(null);
    cargarPagos();
  };

  const rechazarPago = async (pagoId: string) => {
    if (!confirm("¿Rechazar este pago declarado?")) return;
    setProcesandoPago(pagoId);
    await supabase.from("suscripciones").update({
      estado: "rechazado",
      nota_admin: notaAdmin[pagoId] || null,
    }).eq("id", pagoId);
    setProcesandoPago(null);
    cargarPagos();
  };

  const guardarIndicador = async (clave: string) => {
    const raw = editando[clave]?.replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(raw);
    if (isNaN(valor)) return;
    setGuardando(clave);
    await supabase.from("indicadores").update({ valor }).eq("clave", clave);
    setGuardando(null);
    setGuardadoOk(clave);
    setTimeout(() => setGuardadoOk(null), 2000);
    cargarIndicadores();
  };

  const cambiarEstado = async (id: string, nuevoEstado: "aprobado" | "rechazado") => {
    setProcesando(id);
    await supabase.from("perfiles").update({ estado: nuevoEstado }).eq("id", id);
    await cargarPerfiles();
    setProcesando(null);
  };

  const pagosFiltrados = filtroPagos === "todos"
    ? pagos
    : pagos.filter(p => p.estado === filtroPagos);

  const contadoresPagos = {
    pendiente: pagos.filter(p => p.estado === "pendiente").length,
    activa: pagos.filter(p => p.estado === "activa").length,
    todos: pagos.length,
  };

  const perfilesFiltrados = filtro === "todos" ? perfiles : perfiles.filter(p => p.estado === filtro);
  const contadores = {
    todos: perfiles.length,
    pendiente: perfiles.filter(p => p.estado === "pendiente").length,
    aprobado: perfiles.filter(p => p.estado === "aprobado").length,
    rechazado: perfiles.filter(p => p.estado === "rechazado").length,
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const estadoPagoColor = (estado: string) => {
    if (estado === "activa") return "#22c55e";
    if (estado === "pendiente") return "#eab308";
    if (estado === "rechazado" || estado === "suspendida" || estado === "vencida") return "#ff4444";
    return "rgba(255,255,255,0.3)";
  };

  if (!esAdmin) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .adm-root { min-height: 100vh; display: flex; flex-direction: column; background: #0a0a0a; }
        .adm-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .adm-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .adm-topbar-logo span { color: #cc0000; }
        .adm-topbar-right { display: flex; align-items: center; gap: 16px; }
        .adm-topbar-tag { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3); color: #cc0000; }
        .adm-btn-volver { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; text-decoration: none; display: flex; align-items: center; }
        .adm-btn-volver:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .adm-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 40px; }
        .adm-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .adm-header h1 span { color: #cc0000; }
        .adm-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 6px; }
        .adm-filtros { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
        .adm-filtro-btn { padding: 8px 18px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
        .adm-filtro-btn:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .adm-filtro-btn.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .adm-filtro-count { font-size: 10px; font-weight: 800; background: rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 10px; }
        .adm-filtro-btn.activo .adm-filtro-count { background: rgba(200,0,0,0.3); }
        .adm-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .adm-tabla { width: 100%; border-collapse: collapse; }
        .adm-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .adm-tabla th { padding: 12px 16px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .adm-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .adm-tabla tbody tr:last-child { border-bottom: none; }
        .adm-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .adm-tabla td { padding: 14px 16px; font-size: 13px; color: rgba(255,255,255,0.8); vertical-align: middle; }
        .adm-nombre { font-weight: 500; color: #fff; }
        .adm-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 9px; border-radius: 20px; }
        .badge-pendiente { background: rgba(234,179,8,0.15); border: 1px solid rgba(234,179,8,0.3); color: #eab308; }
        .badge-aprobado { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
        .badge-rechazado { background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.3); color: #ff4444; }
        .badge-corredor { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; }
        .badge-colaborador { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.5); }
        .adm-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
        .adm-btn-aprobar { padding: 6px 14px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 3px; color: #22c55e; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .adm-btn-aprobar:hover { background: rgba(34,197,94,0.2); border-color: #22c55e; }
        .adm-btn-rechazar { padding: 6px 14px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: #ff4444; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .adm-btn-rechazar:hover { background: rgba(200,0,0,0.18); border-color: #ff4444; }
        .adm-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .adm-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.25); font-size: 13px; font-style: italic; }
        .adm-loading { padding: 48px; text-align: center; color: rgba(255,255,255,0.25); font-size: 13px; }
        .adm-esp { font-size: 10px; color: rgba(255,255,255,0.35); }
        .adm-ind-titulo { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 6px; }
        .adm-ind-titulo span { color: #cc0000; }
        .adm-ind-subtitulo { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 24px; }
        .adm-ind-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .adm-ind-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 24px; }
        .adm-ind-label { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 12px; }
        .adm-ind-actual { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 14px; }
        .adm-ind-form { display: flex; gap: 8px; align-items: center; }
        .adm-ind-input { flex: 1; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: #fff; font-size: 14px; font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.2s; }
        .adm-ind-input:focus { border-color: rgba(200,0,0,0.5); }
        .adm-ind-btn { padding: 9px 16px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .adm-ind-btn:hover { background: #e60000; }
        .adm-ind-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .adm-ind-ok { font-size: 11px; color: #22c55e; margin-top: 8px; font-family: 'Montserrat', sans-serif; font-weight: 700; }
        .adm-nota-input { width: 100%; padding: 6px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; color: rgba(255,255,255,0.6); font-size: 11px; font-family: 'Inter', sans-serif; outline: none; margin-bottom: 6px; }
        .adm-nota-input:focus { border-color: rgba(200,0,0,0.4); }
        .adm-comprobante { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5); }
      `}</style>

      <div className="adm-root">
        <header className="adm-topbar">
          <div className="adm-topbar-logo"><span>GFI</span>® Admin</div>
          <div className="adm-topbar-right">
            <span className="adm-topbar-tag">Admin Master</span>
            <a className="adm-btn-volver" href="/dashboard">← Dashboard</a>
          </div>
        </header>

        <main className="adm-content">

          {/* PAGOS */}
          <div>
            <div className="adm-header">
              <h1>Gestión de <span>pagos</span></h1>
              <p>Confirmá o rechazá los pagos declarados por los corredores.</p>
            </div>
            <div className="adm-filtros">
              {(["pendiente","activa","todos"] as const).map(f => (
                <button key={f} className={`adm-filtro-btn${filtroPagos === f ? " activo" : ""}`} onClick={() => setFiltroPagos(f)}>
                  {f === "pendiente" ? "Pendientes" : f === "activa" ? "Confirmados" : "Todos"}
                  <span className="adm-filtro-count">{contadoresPagos[f]}</span>
                </button>
              ))}
            </div>
            <div className="adm-tabla-wrap">
              {loadingPagos ? (
                <div className="adm-loading">Cargando pagos...</div>
              ) : pagosFiltrados.length === 0 ? (
                <div className="adm-empty">No hay pagos en esta categoría.</div>
              ) : (
                <table className="adm-tabla">
                  <thead>
                    <tr>
                      <th>Corredor</th>
                      <th>Período</th>
                      <th>Monto declarado</th>
                      <th>Comprobante</th>
                      <th>Fecha pago</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagosFiltrados.map(p => {
                      const color = estadoPagoColor(p.estado);
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="adm-nombre">
                              {p.perfiles ? `${p.perfiles.apellido}, ${p.perfiles.nombre}` : "—"}
                            </div>
                            <div className="adm-sub">Mat. {p.perfiles?.matricula ?? "—"} · {p.tipo}</div>
                          </td>
                          <td style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:12}}>
                            {p.periodo ?? "—"}
                          </td>
                          <td>
                            {p.monto_declarado_ars
                              ? <div>${p.monto_declarado_ars.toLocaleString("es-AR")}</div>
                              : <div style={{color:"rgba(255,255,255,0.3)"}}>—</div>
                            }
                            <div className="adm-sub">USD {p.monto_usd} · ref ${p.dolar_ref?.toLocaleString("es-AR") ?? "—"}</div>
                          </td>
                          <td>
                            <div className="adm-comprobante">{p.comprobante ?? "—"}</div>
                            {p.cbu_origen && <div className="adm-sub">{p.cbu_origen}</div>}
                          </td>
                          <td style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>
                            {p.fecha_pago_declarado ? formatFecha(p.fecha_pago_declarado) : "—"}
                            {p.fecha_confirmacion && (
                              <div className="adm-sub">Conf: {formatFecha(p.fecha_confirmacion)}</div>
                            )}
                            {p.fecha_vencimiento && (
                              <div className="adm-sub">Vence: {formatFecha(p.fecha_vencimiento)}</div>
                            )}
                          </td>
                          <td>
                            <span className="badge" style={{
                              background:`${color}20`,
                              border:`1px solid ${color}50`,
                              color
                            }}>
                              {p.estado.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {procesandoPago === p.id ? (
                              <span className="adm-spinner" />
                            ) : p.estado === "pendiente" ? (
                              <div>
                                <input
                                  className="adm-nota-input"
                                  placeholder="Nota interna (opcional)"
                                  value={notaAdmin[p.id] ?? ""}
                                  onChange={e => setNotaAdmin(prev => ({ ...prev, [p.id]: e.target.value }))}
                                />
                                <div className="adm-acciones">
                                  <button className="adm-btn-aprobar" onClick={() => confirmarPago(p)}>✓ Confirmar</button>
                                  <button className="adm-btn-rechazar" onClick={() => rechazarPago(p.id)}>✗ Rechazar</button>
                                </div>
                              </div>
                            ) : (
                              <span style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>
                                {p.nota_admin ?? "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* SOLICITUDES */}
          <div>
            <div className="adm-header">
              <h1>Solicitudes de <span>registro</span></h1>
              <p>Revisá y aprobá o rechazá cada solicitud manualmente.</p>
            </div>
            <div className="adm-filtros">
              {(["pendiente","aprobado","rechazado","todos"] as const).map(f => (
                <button key={f} className={`adm-filtro-btn${filtro === f ? " activo" : ""}`} onClick={() => setFiltro(f)}>
                  {f === "todos" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="adm-filtro-count">{contadores[f]}</span>
                </button>
              ))}
            </div>
            <div className="adm-tabla-wrap">
              {loading ? (
                <div className="adm-loading">Cargando solicitudes...</div>
              ) : perfilesFiltrados.length === 0 ? (
                <div className="adm-empty">No hay solicitudes en esta categoría.</div>
              ) : (
                <table className="adm-tabla">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Matrícula / DNI</th>
                      <th>Contacto</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfilesFiltrados.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div className="adm-nombre">{p.apellido}, {p.nombre}</div>
                          {p.inmobiliaria && <div className="adm-sub">{p.inmobiliaria}</div>}
                          {p.especialidades && p.especialidades.length > 0 && (
                            <div className="adm-esp">📌 {p.especialidades.join(", ")}</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${p.tipo}`}>
                            {p.tipo === "corredor" ? "Corredor" : p.tipo === "colaborador" ? "Colaborador" : "Admin"}
                          </span>
                        </td>
                        <td>
                          {p.matricula && <div>Mat. {p.matricula}</div>}
                          {p.dni && <div>DNI {p.dni}</div>}
                        </td>
                        <td>{p.telefono && <div>{p.telefono}</div>}</td>
                        <td style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{formatFecha(p.created_at)}</td>
                        <td>
                          <span className={`badge ${ESTADO_BADGE[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span>
                        </td>
                        <td>
                          {procesando === p.id ? (
                            <span className="adm-spinner" />
                          ) : p.estado === "pendiente" ? (
                            <div className="adm-acciones">
                              <button className="adm-btn-aprobar" onClick={() => cambiarEstado(p.id, "aprobado")}>✓ Aprobar</button>
                              <button className="adm-btn-rechazar" onClick={() => cambiarEstado(p.id, "rechazado")}>✗ Rechazar</button>
                            </div>
                          ) : p.estado === "aprobado" ? (
                            <button className="adm-btn-rechazar" onClick={() => cambiarEstado(p.id, "rechazado")}>Revocar</button>
                          ) : (
                            <button className="adm-btn-aprobar" onClick={() => cambiarEstado(p.id, "aprobado")}>Reactivar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* INDICADORES */}
          <div>
            <div className="adm-ind-titulo">Indicadores <span>y precios</span></div>
            <div className="adm-ind-subtitulo">Actualizá los valores del dashboard y los precios de suscripción.</div>
            <div className="adm-ind-grid">
              {indicadores.map(ind => (
                <div key={ind.clave} className="adm-ind-card">
                  <div className="adm-ind-label">{ind.label}</div>
                  <div className="adm-ind-actual">
                    {ind.clave.includes("_usd")
                      ? `USD ${ind.valor}`
                      : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(ind.valor)
                    }
                  </div>
                  <div className="adm-ind-form">
                    <input
                      className="adm-ind-input"
                      value={editando[ind.clave] ?? ""}
                      onChange={e => setEditando(prev => ({ ...prev, [ind.clave]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") guardarIndicador(ind.clave); }}
                      placeholder={ind.clave.includes("_usd") ? "Ej: 15" : "Ej: 124873,05"}
                    />
                    <button
                      className="adm-ind-btn"
                      onClick={() => guardarIndicador(ind.clave)}
                      disabled={guardando === ind.clave}
                    >
                      {guardando === ind.clave ? "..." : "Guardar"}
                    </button>
                  </div>
                  {guardadoOk === ind.clave && <div className="adm-ind-ok">✓ Guardado correctamente</div>}
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>
    </>
  );
}
