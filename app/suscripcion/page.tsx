"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const CBU_DATOS = {
  titular: "Gonzalo Leandro Puche",
  cvu: "0000003100046173873221",
  alias: "foroinmobiliario.gp",
  cuit: "20-25750876-6",
  banco: "Mercado Pago",
};

export default function SuscripcionPage() {
  const [perfil, setPerfil] = useState<any>(null);
  const [suscripcion, setSuscripcion] = useState<any>(null);
  const [dolarBlue, setDolarBlue] = useState<number | null>(null);
  const [precioUsd, setPrecioUsd] = useState<number | null>(null);
  const [declarando, setDeclarando] = useState(false);
  const [fechaPago, setFechaPago] = useState("");
  const [montoDeclarado, setMontoDeclarado] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [cbuOrigen, setCbuOrigen] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/"; return; }

      const { data: p } = await supabase.from("perfiles")
        .select("*").eq("id", session.user.id).single();
      setPerfil(p);

      const { data: s } = await supabase.from("suscripciones")
        .select("*").eq("perfil_id", session.user.id)
        .order("creado_at", { ascending: false }).limit(1).maybeSingle();
      setSuscripcion(s);

      const tipoPerfil = p?.tipo ?? "corredor";
      const clavePrecio = tipoPerfil === "colaborador" ? "precio_colaborador_usd" : "precio_corredor_usd";
      const { data: precioData } = await supabase.from("indicadores")
        .select("valor").eq("clave", clavePrecio).single();
      setPrecioUsd(precioData?.valor ?? (tipoPerfil === "colaborador" ? 5 : 15));

      fetch("https://dolarapi.com/v1/dolares/blue")
        .then(r => r.json())
        .then(d => setDolarBlue(Math.round((d.compra + d.venta) / 2)));
    };
    init();
  }, []);

  const montoUsd = precioUsd ?? (perfil?.tipo === "colaborador" ? 5 : 15);
  const montoArs = dolarBlue ? Math.round(montoUsd * dolarBlue) : null;

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
      monto_usd: montoUsd,
      monto_ars: montoArs,
      monto_declarado_ars: isNaN(montoNum) ? null : montoNum,
      dolar_ref: dolarBlue,
      estado: "pendiente",
      fecha_pago_declarado: fechaPago,
      comprobante: comprobante,
      cbu_origen: cbuOrigen || null,
      periodo,
    });

    setEnviando(false);
    if (err) { setError("Error al registrar el pago. Intentá de nuevo."); return; }
    setEnviado(true);
    setDeclarando(false);
  };

  const estadoColor = (estado: string) => {
    if (estado === "activa") return "#22c55e";
    if (estado === "pendiente") return "#eab308";
    if (estado === "suspendida" || estado === "vencida") return "#ff4444";
    return "rgba(255,255,255,0.3)";
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

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
        .sus-content { flex: 1; padding: 32px; max-width: 700px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
        .sus-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .sus-header h1 span { color: #cc0000; }
        .sus-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .sus-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 24px; }
        .sus-card-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 16px; }
        .sus-estado-badge { display: inline-block; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; }
        .sus-monto { font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 800; color: #fff; line-height: 1; }
        .sus-monto span { font-size: 14px; color: rgba(255,255,255,0.35); font-weight: 400; margin-left: 8px; }
        .sus-ars { font-size: 14px; color: rgba(255,255,255,0.5); margin-top: 6px; }
        .sus-ars strong { color: #22c55e; }
        .sus-cbu-grid { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
        .sus-cbu-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; }
        .sus-cbu-label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .sus-cbu-valor { font-size: 13px; color: #fff; font-weight: 500; letter-spacing: 0.02em; }
        .sus-cbu-copy { padding: 4px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-size: 10px; cursor: pointer; transition: all 0.2s; }
        .sus-cbu-copy:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .sus-aviso { background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.2); border-radius: 4px; padding: 12px 16px; font-size: 12px; color: rgba(234,179,8,0.8); line-height: 1.5; }
        .sus-btn-declarar { width: 100%; padding: 13px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; }
        .sus-btn-declarar:hover:not(:disabled) { background: #e60000; }
        .sus-btn-declarar:disabled { opacity: 0.6; cursor: not-allowed; }
        .sus-field { margin-bottom: 14px; }
        .sus-label { display: block; font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; font-family: 'Montserrat', sans-serif; }
        .sus-label span { color: #cc0000; margin-left: 2px; }
        .sus-input { width: 100%; padding: 11px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .sus-input:focus { border-color: rgba(200,0,0,0.5); }
        .sus-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 10px 14px; margin-bottom: 14px; }
        .sus-ok { text-align: center; padding: 20px; font-size: 13px; color: #22c55e; background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.2); border-radius: 6px; }
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

          {suscripcion && (
            <div className="sus-card">
              <div className="sus-card-titulo">Estado actual</div>
              <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                <span className="sus-estado-badge" style={{
                  background:`${estadoColor(suscripcion.estado)}20`,
                  border:`1px solid ${estadoColor(suscripcion.estado)}50`,
                  color:estadoColor(suscripcion.estado)
                }}>
                  {suscripcion.estado.toUpperCase()}
                </span>
                {suscripcion.periodo && (
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Período: {suscripcion.periodo}</span>
                )}
                {suscripcion.fecha_vencimiento && (
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>
                    Vence: {formatFecha(suscripcion.fecha_vencimiento)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="sus-card">
            <div className="sus-card-titulo">Monto mensual</div>
            <div className="sus-monto">USD {montoUsd}<span>/ mes</span></div>
            {dolarBlue && montoArs && (
              <div className="sus-ars">
                Equivale a <strong>${montoArs.toLocaleString("es-AR")}</strong> al dólar blue de hoy (${dolarBlue.toLocaleString("es-AR")})
              </div>
            )}
          </div>

          <div className="sus-card">
            <div className="sus-card-titulo">Datos para transferir</div>
            <div className="sus-cbu-grid">
              {[
                { label: "Titular", valor: CBU_DATOS.titular },
                { label: "CVU", valor: CBU_DATOS.cvu },
                { label: "Alias", valor: CBU_DATOS.alias },
                { label: "CUIT/CUIL", valor: CBU_DATOS.cuit },
                { label: "Banco", valor: CBU_DATOS.banco },
              ].map(({ label, valor }) => (
                <div key={label} className="sus-cbu-row">
                  <div>
                    <div className="sus-cbu-label">{label}</div>
                    <div className="sus-cbu-valor">{valor}</div>
                  </div>
                  <button className="sus-cbu-copy" onClick={() => navigator.clipboard.writeText(valor)}>Copiar</button>
                </div>
              ))}
            </div>
          </div>

          <div className="sus-aviso">
            ⚠️ Una vez realizada la transferencia, declarala acá abajo. El administrador la confirmará dentro del día hábil. Tenés 3 días de gracia ante vencimiento.
          </div>

          {enviado ? (
            <div className="sus-ok">✅ Pago declarado correctamente. El admin lo confirmará en breve.</div>
          ) : declarando ? (
            <div className="sus-card">
              <div className="sus-card-titulo">Declarar transferencia</div>
              <div className="sus-field">
                <label className="sus-label">Fecha de la transferencia <span>*</span></label>
                <input className="sus-input" type="date" value={fechaPago}
                  onChange={e => setFechaPago(e.target.value)} />
              </div>
              <div className="sus-field">
                <label className="sus-label">Monto transferido (ARS) <span>*</span></label>
                <input className="sus-input" type="text"
                  placeholder={montoArs ? `Ej: ${montoArs.toLocaleString("es-AR")}` : "Ej: 20000"}
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
              <div style={{display:"flex",gap:10}}>
                <button className="sus-btn-declarar" onClick={handleDeclarar} disabled={enviando}>
                  {enviando && <span className="sus-spinner" />}
                  {enviando ? "Enviando..." : "Confirmar declaración"}
                </button>
                <button className="sus-btn-declarar"
                  style={{background:"transparent",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.4)"}}
                  onClick={() => setDeclarando(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button className="sus-btn-declarar" onClick={() => setDeclarando(true)}>
              Ya transferí — declarar pago
            </button>
          )}
        </main>
      </div>
    </>
  );
}
