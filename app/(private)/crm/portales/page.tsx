"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useSearchParams } from "next/navigation";

export default function PortalesPage() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [tokkoKey, setTokkoKey] = useState("");
  const [kitepropKey, setKitepropKey] = useState("");
  const [mlAppId, setMlAppId] = useState("");
  const [mlAppSecret, setMlAppSecret] = useState("");
  const [mlConectado, setMlConectado] = useState(false);
  const [mlExpiresAt, setMlExpiresAt] = useState<string | null>(null);
  const [googleConectado, setGoogleConectado] = useState(false);
  const [googleExpiresAt, setGoogleExpiresAt] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [globalStatus, setGlobalStatus] = useState<any>(null);

  useEffect(() => {
    const mlOk = searchParams.get("ml_ok");
    const mlErr = searchParams.get("ml_error");
    const gOk = searchParams.get("google_ok");
    const gErr = searchParams.get("google_error");
    if (mlOk) setMsg("MercadoLibre conectado correctamente.");
    if (mlErr) setMsg(`Error al conectar ML: ${mlErr.replace(/_/g, " ")}`);
    if (gOk) setMsg("Google Calendar conectado correctamente. ¡Listo para sincronizar visitas!");
    if (gErr) setMsg(`Error al conectar Google: ${gErr.replace(/_/g, " ")}`);
  }, [searchParams]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);

      const { data: creds } = await supabase
        .from("portal_credenciales")
        .select("tokko_key,kiteprop_key,ml_app_id,ml_app_secret,ml_access_token,ml_token_expires_at")
        .eq("perfil_id", data.user.id)
        .maybeSingle();
      if (creds) {
        setTokkoKey(creds.tokko_key ?? "");
        setKitepropKey(creds.kiteprop_key ?? "");
        setMlAppId(creds.ml_app_id ?? "");
        setMlAppSecret(creds.ml_app_secret ?? "");
        setMlConectado(!!creds.ml_access_token);
        setMlExpiresAt(creds.ml_token_expires_at ?? null);
        setGoogleConectado(!!(creds as any).google_access_token);
        setGoogleExpiresAt((creds as any).google_token_expires_at ?? null);
      }

      const res = await fetch("/api/cartera/sync");
      if (res.ok) setGlobalStatus(await res.json());
    };
    init();
  }, []);

  const guardar = async () => {
    if (!userId) return;
    setGuardando(true);
    setMsg("");
    const { error } = await supabase
      .from("portal_credenciales")
      .upsert({
        perfil_id: userId,
        tokko_key: tokkoKey || null,
        kiteprop_key: kitepropKey || null,
        ml_app_id: mlAppId || null,
        ml_app_secret: mlAppSecret || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "perfil_id" });
    setGuardando(false);
    setMsg(error ? `Error: ${error.message}` : "Credenciales guardadas correctamente");
  };

  const conectarML = async () => {
    if (!userId || !mlAppId || !mlAppSecret) {
      setMsg("Guardá el App ID y App Secret antes de conectar.");
      return;
    }
    await guardar();
    window.location.href = `/api/ml-auth?perfil_id=${userId}`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .port-wrap { max-width:760px; }
        .port-title { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:800; color:#fff; margin-bottom:4px; }
        .port-sub { font-size:13px; color:rgba(255,255,255,0.35); font-family:'Inter',sans-serif; margin-bottom:24px; }
        .port-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px; margin-bottom:16px; }
        .port-card-title { font-family:'Montserrat',sans-serif; font-size:14px; font-weight:800; color:#fff; margin-bottom:4px; }
        .port-card-sub { font-size:12px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif; margin-bottom:14px; }
        .port-label { font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; color:rgba(255,255,255,0.4); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:5px; }
        .port-input { width:100%; padding:10px 12px; background:rgba(12,12,12,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:6px; color:#fff; font-size:13px; font-family:'Inter',sans-serif; outline:none; box-sizing:border-box; }
        .port-input:focus { border-color:rgba(200,0,0,0.4); }
        .port-input::placeholder { color:rgba(255,255,255,0.15); }
        .port-hint { font-size:11px; color:rgba(255,255,255,0.2); margin-top:4px; font-family:'Inter',sans-serif; }
        .port-status { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:4px; font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:0.06em; }
        .port-status-ok { background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); color:#22c55e; }
        .port-status-pending { background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.2); color:rgba(234,179,8,0.8); }
        .port-save-btn { padding:10px 24px; background:#cc0000; border:none; border-radius:6px; color:#fff; font-family:'Montserrat',sans-serif; font-size:12px; font-weight:800; letter-spacing:0.06em; cursor:pointer; transition:opacity 0.15s; }
        .port-save-btn:hover { opacity:0.85; }
        .port-save-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .port-msg { padding:10px 14px; border-radius:6px; font-family:'Inter',sans-serif; font-size:12px; margin-top:12px; }
        .port-msg-ok { background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); color:#22c55e; }
        .port-msg-err { background:rgba(200,0,0,0.1); border:1px solid rgba(200,0,0,0.2); color:#f87171; }
        .port-info-box { background:rgba(96,165,250,0.05); border:1px solid rgba(96,165,250,0.15); border-radius:8px; padding:12px 14px; font-size:12px; color:rgba(255,255,255,0.5); font-family:'Inter',sans-serif; line-height:1.6; margin-bottom:16px; }
        .port-connect-btn { padding:9px 18px; background:rgba(255,230,0,0.12); border:1px solid rgba(255,230,0,0.25); border-radius:6px; color:#fde047; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:800; letter-spacing:0.04em; cursor:pointer; transition:opacity 0.15s; }
        .port-connect-btn:hover { opacity:0.8; }
        .port-connect-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .port-connected-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.25); border-radius:6px; font-size:11px; font-family:'Montserrat',sans-serif; font-weight:700; color:#22c55e; }
      `}</style>

      <div className="port-wrap">
        <Link href="/crm" style={{ fontSize:11, color:"rgba(255,255,255,0.3)", textDecoration:"none", fontFamily:"Montserrat,sans-serif", fontWeight:700, letterSpacing:"0.06em", display:"inline-block", marginBottom:12 }}>
          ← CRM
        </Link>
        <div className="port-title">Configuración de Portales</div>
        <div className="port-sub">Conectá tu cartera con portales inmobiliarios externos</div>

        <div className="port-info-box">
          Tus API keys se guardan de forma segura en la plataforma GFI. Las podés obtener contactando directamente con cada portal.
          Si el administrador ya configuró claves globales, estas claves personales tienen prioridad y te permiten usar tu propia cuenta.
        </div>

        {/* Tokko Broker */}
        <div className="port-card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div className="port-card-title">🏢 Tokko Broker</div>
            {globalStatus && (
              <span className={`port-status ${globalStatus.tokko.configurado ? "port-status-ok" : "port-status-pending"}`}>
                {globalStatus.tokko.configurado ? "Global activo" : "Sin config. global"}
              </span>
            )}
          </div>
          <div className="port-card-sub">
            Sistema de gestión inmobiliaria. Necesitás el add-on "Acceso APIs" activo en tu plan Tokko Broker.
          </div>
          <div style={{ marginBottom:12 }}>
            <div className="port-label">API Key</div>
            <input
              className="port-input"
              type="password"
              placeholder="tu-api-key-de-tokko"
              value={tokkoKey}
              onChange={e => setTokkoKey(e.target.value)}
            />
            <div className="port-hint">
              Encontrala en Tokko Broker → Configuración → Acceso a APIs
            </div>
          </div>
        </div>

        {/* KiteProp */}
        <div className="port-card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div className="port-card-title">🪁 KiteProp</div>
            {globalStatus && (
              <span className={`port-status ${globalStatus.kiteprop.configurado ? "port-status-ok" : "port-status-pending"}`}>
                {globalStatus.kiteprop.configurado ? "Global activo" : "Sin config. global"}
              </span>
            )}
          </div>
          <div className="port-card-sub">
            Portal de propiedades. Contactá a KiteProp para obtener tu API key.
          </div>
          <div style={{ marginBottom:12 }}>
            <div className="port-label">API Key</div>
            <input
              className="port-input"
              type="password"
              placeholder="tu-api-key-de-kiteprop"
              value={kitepropKey}
              onChange={e => setKitepropKey(e.target.value)}
            />
            <div className="port-hint">
              Encontrala en tu panel de KiteProp → Configuración → Integraciones
            </div>
          </div>
        </div>

        {/* MercadoLibre OAuth */}
        <div className="port-card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div className="port-card-title">🛒 MercadoLibre Inmuebles</div>
            {mlConectado
              ? <span className="port-connected-badge">✓ Conectado</span>
              : <span className="port-status port-status-pending">Sin conectar</span>
            }
          </div>
          <div className="port-card-sub">
            Publicá propiedades en ML Inmuebles. Primero creá una app en developers.mercadolibre.com.ar,
            luego ingresá tu App ID y Secret, y hacé clic en "Conectar con MercadoLibre".
          </div>
          {mlConectado && mlExpiresAt && (
            <div style={{ marginBottom:10, fontSize:11, color:"rgba(255,255,255,0.3)", fontFamily:"Inter,sans-serif" }}>
              Token vigente hasta: {new Date(mlExpiresAt).toLocaleString("es-AR")} · Se renueva automáticamente
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <div className="port-label">App ID</div>
              <input className="port-input" type="text" placeholder="1234567" value={mlAppId} onChange={e => setMlAppId(e.target.value)} />
              <div className="port-hint">Desde tu app en ML Developers</div>
            </div>
            <div>
              <div className="port-label">App Secret</div>
              <input className="port-input" type="password" placeholder="tu-client-secret" value={mlAppSecret} onChange={e => setMlAppSecret(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button className="port-connect-btn" onClick={conectarML} disabled={!mlAppId || !mlAppSecret}>
              {mlConectado ? "Reconectar MercadoLibre" : "Conectar con MercadoLibre →"}
            </button>
            {mlConectado && (
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)", fontFamily:"Inter,sans-serif" }}>
                El token se renueva automáticamente al publicar
              </span>
            )}
          </div>
        </div>

        {/* Google Calendar */}
        <div className="port-card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div className="port-card-title">📅 Google Calendar</div>
            {googleConectado
              ? <span className="port-connected-badge">✓ Conectado</span>
              : <span className="port-status port-status-pending">Sin conectar</span>
            }
          </div>
          <div className="port-card-sub">
            Sincronizá tus visitas con Google Calendar automáticamente. Necesitás habilitar la API de Google Calendar en
            console.cloud.google.com y agregar GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET en las variables de Vercel.
          </div>
          {googleConectado && googleExpiresAt && (
            <div style={{ marginBottom:10, fontSize:11, color:"rgba(255,255,255,0.3)", fontFamily:"Inter,sans-serif" }}>
              Token vigente hasta: {new Date(googleExpiresAt).toLocaleString("es-AR")} · Se renueva automáticamente
            </div>
          )}
          <button
            className="port-connect-btn"
            onClick={() => { if (userId) window.location.href = `/api/google-auth?perfil_id=${userId}`; }}
            disabled={!userId}
          >
            {googleConectado ? "Reconectar Google Calendar" : "Conectar con Google Calendar →"}
          </button>
        </div>

        <button className="port-save-btn" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar credenciales"}
        </button>

        {msg && (
          <div className={`port-msg ${msg.startsWith("Error") ? "port-msg-err" : "port-msg-ok"}`}>
            {msg}
          </div>
        )}

        {/* Importar desde portales */}
        <div className="port-card" style={{ marginTop:24 }}>
          <div className="port-card-title">📥 Importar desde portales</div>
          <div className="port-card-sub" style={{ marginBottom:0 }}>
            Podés importar propiedades desde ZonaProp, Mercado Libre u otros portales
            pegando la URL de la publicación directamente en la Cartera.
          </div>
          <div style={{ marginTop:12, display:"flex", gap:8 }}>
            <Link href="/crm/cartera" style={{ padding:"8px 16px", background:"rgba(200,0,0,0.1)", border:"1px solid rgba(200,0,0,0.2)", borderRadius:6, color:"#cc0000", fontFamily:"Montserrat,sans-serif", fontSize:11, fontWeight:800, letterSpacing:"0.04em", textDecoration:"none", display:"inline-block" }}>
              Ir a mi Cartera
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
