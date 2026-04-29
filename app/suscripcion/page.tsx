"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Suscripcion {
  id: string;
  perfil_id: string;
  tipo: string;
  monto_usd: number | null;
  monto_ars: number | null;
  monto_declarado_ars: number | null;
  dolar_ref: number | null;
  estado: string;
  fecha_pago_declarado: string | null;
  fecha_confirmacion: string | null;
  fecha_vencimiento: string | null;
  periodo: string | null;
  cbu_origen: string | null;
  comprobante: string | null;
  comprobante_url: string | null;
  nota_admin: string | null;
  creado_at: string;
  actualizado_at: string;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  activa:     { label: "Activa",              color: "#22c55e", bg: "rgba(34,197,94,0.1)",    icon: "✓" },
  pendiente:  { label: "Pago en verificación",color: "#eab308", bg: "rgba(234,179,8,0.1)",   icon: "⏳" },
  gracia:     { label: "Período de gracia",   color: "#eab308", bg: "rgba(234,179,8,0.1)",   icon: "⚠️" },
  vencida:    { label: "Vencida",             color: "#ff4444", bg: "rgba(200,0,0,0.1)",     icon: "✕" },
  suspendida: { label: "Suspendida",          color: "#ff4444", bg: "rgba(200,0,0,0.1)",     icon: "🔒" },
  bloqueado:  { label: "Bloqueada",           color: "#ff4444", bg: "rgba(200,0,0,0.1)",     icon: "🔒" },
};

export default function SuscripcionPage() {
  const [perfil, setPerfil] = useState<any>(null);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [dolarBlue, setDolarBlue] = useState<number | null>(null);
  const [precioUsd, setPrecioUsd] = useState<number>(15);
  const [cbuDatos, setCbuDatos] = useState<Record<string, string>>({
    titular: "Gonzalo Leandro Puche",
    cvu: "0000003100046173873221",
    alias: "foroinmobiliario.gp",
    cuit: "20-25750876-6",
    banco: "Mercado Pago",
  });
  const [declarando, setDeclarando] = useState(false);
  const [fechaPago, setFechaPago] = useState("");
  const [montoDeclarado, setMontoDeclarado] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [cbuOrigen, setCbuOrigen] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  const suscripcionActual = suscripciones[0] ?? null;
  const historial = suscripciones.slice(1);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/"; return; }

      const [{ data: p }, { data: s }, { data: ind }] = await Promise.all([
        supabase.from("perfiles").select("*").eq("id", session.user.id).single(),
        supabase.from("suscripciones").select("*").eq("perfil_id", session.user.id).order("creado_at", { ascending: false }),
        supabase.from("indicadores").select("clave,valor"),
      ]);

      if (p) setPerfil(p);
      if (s) setSuscripciones(s as Suscripcion[]);

      if (ind) {
        const get = (k: string) => ind.find((i: any) => i.clave === k)?.valor;
        const tipoPerfil = p?.tipo ?? "corredor";
        const precio = get(tipoPerfil === "colaborador" ? "precio_colaborador_usd" : "precio_corredor_usd") ?? (tipoPerfil === "colaborador" ? 5 : 15);
        setPrecioUsd(precio);

        // CBU desde indicadores si existen
        const titular = get("cbu_titular");
        const cvu = get("cbu_cvu");
        const alias = get("cbu_alias");
        const cuit = get("cbu_cuit");
        const banco = get("cbu_banco");
        if (titular || cvu) {
          setCbuDatos({
            titular: titular ?? "Gonzalo Leandro Puche",
            cvu: cvu ?? "0000003100046173873221",
            alias: alias ?? "foroinmobiliario.gp",
            cuit: cuit ?? "20-25750876-6",
            banco: banco ?? "Mercado Pago",
          });
        }
      }

      fetch("https://dolarapi.com/v1/dolares/blue")
        .then(r => r.json())
        .then(d => setDolarBlue(Math.round((d.compra + d.venta) / 2)));
    };
    init();
  }, []);

  const montoArs = dolarBlue ? Math.round(precioUsd * dolarBlue) : null;

  const copiar = (valor: string, key: string) => {
    navigator.clipboard.writeText(valor);
    setCopiado(key);
    setTimeout(() => setCopiado(null), 2000);
  };

  const diasRestantes = () => {
    if (!suscripcionActual?.fecha_vencimiento) return null;
    const hoy = new Date();
    const venc = new Date(suscripcionActual.fecha_vencimiento);
    const diff = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleDeclarar = async () => {
    if (!fechaPago) { setError("Ingresá la fecha de la transferencia."); return; }
    if (!montoDeclarado) { setError("Ingresá el monto transferido."); return; }
    if (!comprobante) { setError("Ingresá el número de comprobante."); return; }
    setEnviando(true);
    setError("");

    const periodo = new Date().toISOString().slice(0, 7);
    const montoNum = parseFloat(montoDeclarado.replace(/\./g, "").replace(",", "."));

    const { error: err } = await supabase.from("suscripciones").insert({
      perfil_id: perfil.id,
      tipo: perfil.tipo,
      monto_usd: precioUsd,
      monto_ars: montoArs,
      monto_declarado_ars: isNaN(montoNum) ? null : montoNum,
      dolar_ref: dolarBlue,
      estado: "pendiente",
      fecha_pago_declarado: fechaPago,
      comprobante,
      cbu_origen: cbuOrigen || null,
      periodo,
    });

    if (err) { setError("Error al registrar el pago. Intentá de nuevo."); setEnviando(false); return; }

    // Email al admin
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "admin@foroinmobiliario.com.ar",
          subject: `💰 Pago declarado — ${perfil.apellido}, ${perfil.nombre}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f0f0f;color:#fff;padding:32px;border-radius:8px;border:1px solid rgba(200,0,0,0.2);">
              <h2 style="color:#cc0000;margin-bottom:20px;font-family:sans-serif;">GFI® — Nuevo pago declarado</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);width:140px;">Corredor</td><td style="color:#fff;font-weight:600;">${perfil.apellido}, ${perfil.nombre}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Matrícula</td><td style="color:#fff;">${perfil.matricula ?? "—"}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Monto USD</td><td style="color:#fff;">USD ${precioUsd}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Monto ARS</td><td style="color:#22c55e;font-weight:700;">$ ${montoNum.toLocaleString("es-AR")}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Comprobante</td><td style="color:#fff;">${comprobante}</td></tr>
                <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Fecha</td><td style="color:#fff;">${new Date(fechaPago).toLocaleDateString("es-AR")}</td></tr>
                ${cbuOrigen ? `<tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">CBU origen</td><td style="color:#fff;">${cbuOrigen}</td></tr>` : ""}
              </table>
              <div style="margin-top:24px;">
                <a href="https://www.foroinmobiliario.com.ar/admin/suscripciones" style="display:inline-block;background:#cc0000;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:700;font-family:sans-serif;">
                  ✓ Confirmar en el panel admin
                </a>
              </div>
            </div>
          `,
        }),
      });
    } catch {}

    setEnviando(false);
    setEnviado(true);
    setDeclarando(false);

    // Recargar suscripciones
    const { data: s } = await supabase.from("suscripciones").select("*").eq("perfil_id", perfil.id).order("creado_at", { ascending: false });
    if (s) setSuscripciones(s as Suscripcion[]);
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const estadoConf = suscripcionActual ? (ESTADO_CONFIG[suscripcionActual.estado] ?? ESTADO_CONFIG["vencida"]) : null;
  const dias = diasRestantes();
  const tienePendiente = suscripcionActual?.estado === "pendiente";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .sus-root { min-height: 100vh; display: flex; flex-direction: column; }
        .sus-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .sus-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .sus-topbar-logo span { color: #cc0000; }
        .sus-btn-back { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .sus-btn-back:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
        .sus-content { flex: 1; padding: 32px; max-width: 700px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        .sus-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .sus-header h1 span { color: #cc0000; }
        .sus-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .sus-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 22px 24px; }
        .sus-card-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 16px; }

        /* Estado */
        .sus-estado-wrap { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .sus-estado-left { display: flex; flex-direction: column; gap: 6px; }
        .sus-estado-badge { display: inline-flex; align-items: center; gap: 6px; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 14px; border-radius: 20px; }
        .sus-estado-info { font-size: 12px; color: rgba(255,255,255,0.35); }
        .sus-dias { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; text-align: right; line-height: 1; }
        .sus-dias-label { font-size: 10px; color: rgba(255,255,255,0.3); text-align: right; margin-top: 3px; font-family: 'Montserrat',sans-serif; }

        /* Monto */
        .sus-monto { font-family: 'Montserrat', sans-serif; font-size: 36px; font-weight: 800; color: #fff; line-height: 1; }
        .sus-monto span { font-size: 14px; color: rgba(255,255,255,0.35); font-weight: 400; margin-left: 8px; }
        .sus-ars { font-size: 14px; color: rgba(255,255,255,0.5); margin-top: 8px; }
        .sus-ars strong { color: #22c55e; }

        /* CBU */
        .sus-cbu-grid { display: flex; flex-direction: column; gap: 8px; }
        .sus-cbu-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; gap: 12px; }
        .sus-cbu-label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 3px; }
        .sus-cbu-valor { font-size: 13px; color: #fff; font-weight: 500; word-break: break-all; }
        .sus-cbu-copy { padding: 5px 12px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-size: 10px; cursor: pointer; transition: all 0.2s; white-space: nowrap; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.08em; flex-shrink: 0; }
        .sus-cbu-copy:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .sus-cbu-copy.copiado { border-color: rgba(34,197,94,0.4); color: #22c55e; }

        /* Aviso */
        .sus-aviso { background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.18); border-radius: 4px; padding: 12px 16px; font-size: 12px; color: rgba(234,179,8,0.8); line-height: 1.6; }
        .sus-aviso-pendiente { background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.2); border-radius: 6px; padding: 16px 20px; }
        .sus-aviso-pendiente-titulo { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: #eab308; margin-bottom: 8px; letter-spacing: 0.1em; text-transform: uppercase; }
        .sus-aviso-pendiente-body { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.6; }

        /* Formulario */
        .sus-btn-declarar { width: 100%; padding: 13px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; }
        .sus-btn-declarar:hover:not(:disabled) { background: #e60000; }
        .sus-btn-declarar:disabled { opacity: 0.6; cursor: not-allowed; }
        .sus-field { margin-bottom: 14px; }
        .sus-label { display: block; font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; font-family: 'Montserrat', sans-serif; }
        .sus-label span { color: #cc0000; margin-left: 2px; }
        .sus-input { width: 100%; padding: 11px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .sus-input:focus { border-color: rgba(200,0,0,0.5); }
        .sus-input::placeholder { color: rgba(255,255,255,0.2); }
        .sus-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 10px 14px; margin-bottom: 14px; }
        .sus-ok { text-align: center; padding: 20px; font-size: 13px; color: #22c55e; background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.2); border-radius: 6px; }

        /* Historial */
        .sus-hist-tabla { width: 100%; border-collapse: collapse; }
        .sus-hist-tabla th { padding: 8px 12px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.25); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .sus-hist-tabla td { padding: 10px 12px; font-size: 12px; color: rgba(255,255,255,0.6); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .sus-hist-tabla tr:last-child td { border-bottom: none; }
        .sus-hist-badge { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; }

        .sus-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="sus-root">
        <header className="sus-topbar">
          <div className="sus-topbar-logo"><span>GFI</span>® · Mi Suscripción</div>
          <a className="sus-btn-back" href="/dashboard">← Dashboard</a>
        </header>

        <main className="sus-content">
          <div className="sus-header">
            <h1>Mi <span>suscripción</span></h1>
            <p>Plan único GFI® — acceso completo a todos los módulos</p>
          </div>

          {/* Estado actual */}
          {suscripcionActual && estadoConf && (
            <div className="sus-card" style={{ borderColor: `${estadoConf.color}30` }}>
              <div className="sus-card-titulo">Estado de membresía</div>
              <div className="sus-estado-wrap">
                <div className="sus-estado-left">
                  <span className="sus-estado-badge" style={{ background: estadoConf.bg, border: `1px solid ${estadoConf.color}40`, color: estadoConf.color }}>
                    {estadoConf.icon} {estadoConf.label}
                  </span>
                  <div className="sus-estado-info">
                    {suscripcionActual.periodo && `Período: ${suscripcionActual.periodo}`}
                    {suscripcionActual.fecha_vencimiento && ` · Vence: ${formatFecha(suscripcionActual.fecha_vencimiento)}`}
                  </div>
                  {suscripcionActual.nota_admin && (
                    <div style={{ fontSize: 12, color: "#ff4444", marginTop: 4 }}>
                      📋 Nota del admin: {suscripcionActual.nota_admin}
                    </div>
                  )}
                </div>
                {dias !== null && (
                  <div>
                    <div className="sus-dias" style={{ color: dias <= 3 ? "#ff4444" : dias <= 7 ? "#eab308" : "#22c55e" }}>
                      {dias > 0 ? dias : 0}
                    </div>
                    <div className="sus-dias-label">días restantes</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Monto */}
          <div className="sus-card">
            <div className="sus-card-titulo">Monto mensual</div>
            <div className="sus-monto">USD {precioUsd}<span>/ mes</span></div>
            {dolarBlue && montoArs && (
              <div className="sus-ars">
                Equivale a <strong>${montoArs.toLocaleString("es-AR")}</strong> al dólar blue de hoy (${dolarBlue.toLocaleString("es-AR")})
              </div>
            )}
          </div>

          {/* CBU */}
          <div className="sus-card">
            <div className="sus-card-titulo">Datos para transferir</div>
            <div className="sus-cbu-grid">
              {Object.entries({
                "Titular": cbuDatos.titular,
                "CVU": cbuDatos.cvu,
                "Alias": cbuDatos.alias,
                "CUIT/CUIL": cbuDatos.cuit,
                "Banco": cbuDatos.banco,
              }).map(([label, valor]) => (
                <div key={label} className="sus-cbu-row">
                  <div>
                    <div className="sus-cbu-label">{label}</div>
                    <div className="sus-cbu-valor">{valor}</div>
                  </div>
                  <button
                    className={`sus-cbu-copy${copiado === label ? " copiado" : ""}`}
                    onClick={() => copiar(valor, label)}
                  >
                    {copiado === label ? "✓ Copiado" : "Copiar"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Aviso */}
          <div className="sus-aviso">
            ⚠️ Una vez realizada la transferencia, declarala acá abajo. El administrador la confirmará dentro del día hábil. Tenés 3 días de gracia ante vencimiento.
          </div>

          {/* Pago pendiente */}
          {tienePendiente && (
            <div className="sus-aviso-pendiente">
              <div className="sus-aviso-pendiente-titulo">⏳ Pago en verificación</div>
              <div className="sus-aviso-pendiente-body">
                Declaraste un pago el {suscripcionActual.fecha_pago_declarado ? formatFecha(suscripcionActual.fecha_pago_declarado) : "—"} por $ {suscripcionActual.monto_declarado_ars?.toLocaleString("es-AR") ?? "—"} ARS (Comprobante: {suscripcionActual.comprobante ?? "—"}).
                <br />El admin lo confirmará dentro del día hábil. Si tenés alguna consulta escribí a <strong>admin@foroinmobiliario.com.ar</strong>.
              </div>
            </div>
          )}

          {/* Formulario declarar pago */}
          {!tienePendiente && (
            enviado ? (
              <div className="sus-ok">
                ✅ Pago declarado correctamente. El admin lo confirmará en breve y recibirás una notificación.
              </div>
            ) : declarando ? (
              <div className="sus-card">
                <div className="sus-card-titulo">Declarar transferencia</div>
                <div className="sus-field">
                  <label className="sus-label">Fecha de la transferencia <span>*</span></label>
                  <input className="sus-input" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
                </div>
                <div className="sus-field">
                  <label className="sus-label">Monto transferido (ARS) <span>*</span></label>
                  <input className="sus-input" type="text"
                    placeholder={montoArs ? `Ej: ${montoArs.toLocaleString("es-AR")}` : "Ej: 21000"}
                    value={montoDeclarado} onChange={e => setMontoDeclarado(e.target.value)} />
                </div>
                <div className="sus-field">
                  <label className="sus-label">Número de comprobante <span>*</span></label>
                  <input className="sus-input" type="text" placeholder="Ej: 12345678 o MP-ABC123"
                    value={comprobante} onChange={e => setComprobante(e.target.value)} />
                </div>
                <div className="sus-field">
                  <label className="sus-label">CBU/CVU desde donde transferiste</label>
                  <input className="sus-input" type="text" placeholder="Opcional"
                    value={cbuOrigen} onChange={e => setCbuOrigen(e.target.value)} />
                </div>
                {error && <div className="sus-error">{error}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="sus-btn-declarar" onClick={handleDeclarar} disabled={enviando}>
                    {enviando && <span className="sus-spinner" />}
                    {enviando ? "Enviando..." : "Confirmar declaración"}
                  </button>
                  <button className="sus-btn-declarar"
                    style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)" }}
                    onClick={() => setDeclarando(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button className="sus-btn-declarar" onClick={() => setDeclarando(true)}>
                Ya transferí — declarar pago
              </button>
            )
          )}

          {/* Historial */}
          {historial.length > 0 && (
            <div className="sus-card">
              <div className="sus-card-titulo">Historial de pagos</div>
              <table className="sus-hist-tabla">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Monto</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(s => {
                    const conf = ESTADO_CONFIG[s.estado] ?? ESTADO_CONFIG["vencida"];
                    return (
                      <tr key={s.id}>
                        <td>{s.periodo ?? "—"}</td>
                        <td>
                          {s.monto_usd ? `USD ${s.monto_usd}` : "—"}
                          {s.monto_declarado_ars ? <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>$ {s.monto_declarado_ars.toLocaleString("es-AR")}</div> : null}
                        </td>
                        <td>{s.fecha_pago_declarado ? formatFecha(s.fecha_pago_declarado) : "—"}</td>
                        <td>
                          <span className="sus-hist-badge" style={{ background: conf.bg, border: `1px solid ${conf.color}40`, color: conf.color }}>
                            {s.estado}
                          </span>
                        </td>
                        <td style={{ fontSize: 11 }}>{s.comprobante ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
