"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useSearchParams } from "next/navigation";

interface SyncState {
  cargando: boolean;
  resultado: string;
  ultimaSync: string | null;
}

const syncInicio: SyncState = { cargando: false, resultado: "", ultimaSync: null };

function PortalesInner() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokkoKey, setTokkoKey] = useState("");
  const [kitepropKey, setKitepropKey] = useState("");
  const [mlAppId, setMlAppId] = useState("");
  const [mlAppSecret, setMlAppSecret] = useState("");
  const [mlConectado, setMlConectado] = useState(false);
  const [mlExpiresAt, setMlExpiresAt] = useState<string | null>(null);
  const [googleConectado, setGoogleConectado] = useState(false);
  const [googleExpiresAt, setGoogleExpiresAt] = useState<string | null>(null);
  const [propiaKey, setPropiaKey] = useState("");
  const [propiaUsuario, setPropiaUsuario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [globalStatus, setGlobalStatus] = useState<{ tokko: { configurado: boolean }; kiteprop: { configurado: boolean } } | null>(null);
  const [syncKP, setSyncKP] = useState<SyncState>(syncInicio);
  const [syncTK, setSyncTK] = useState<SyncState>(syncInicio);
  const [syncAll, setSyncAll] = useState<SyncState>(syncInicio);

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
      const { data: sessionData } = await supabase.auth.getSession();
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      setToken(sessionData.session?.access_token ?? null);

      const { data: creds } = await supabase
        .from("portal_credenciales")
        .select("tokko_key,kiteprop_key,ml_app_id,ml_app_secret,ml_access_token,ml_token_expires_at,propia_api_key,propia_usuario")
        .eq("perfil_id", data.user.id)
        .maybeSingle();
      if (creds) {
        setTokkoKey(creds.tokko_key ?? "");
        setKitepropKey(creds.kiteprop_key ?? "");
        setMlAppId(creds.ml_app_id ?? "");
        setMlAppSecret(creds.ml_app_secret ?? "");
        setMlConectado(!!creds.ml_access_token);
        setMlExpiresAt(creds.ml_token_expires_at ?? null);
        setGoogleConectado(!!(creds as Record<string, unknown>).google_access_token);
        setGoogleExpiresAt((creds as Record<string, string | null>).google_token_expires_at ?? null);
        setPropiaKey((creds as Record<string, string>).propia_api_key ?? "");
        setPropiaUsuario((creds as Record<string, string>).propia_usuario ?? "");
      }

      // Estado de sync de portales
      if (sessionData.session?.access_token) {
        const [kpRes, tkRes] = await Promise.all([
          fetch("/api/crm/kiteprop/sync-leads", { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }),
          fetch("/api/crm/tokko/sync-leads", { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }),
        ]);
        if (kpRes.ok) {
          const kpData = await kpRes.json();
          setSyncKP(prev => ({ ...prev, ultimaSync: kpData.ultima_sincronizacion ?? null }));
        }
        if (tkRes.ok) {
          const tkData = await tkRes.json();
          setSyncTK(prev => ({ ...prev, ultimaSync: tkData.ultima_sincronizacion ?? null }));
        }
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
        propia_api_key: propiaKey || null,
        propia_usuario: propiaUsuario || null,
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

  const sincronizarKP = async () => {
    if (!token) return;
    setSyncKP({ cargando: true, resultado: "", ultimaSync: syncKP.ultimaSync });
    try {
      const res = await fetch("/api/crm/kiteprop/sync-leads", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setSyncKP({ cargando: false, resultado: `Error: ${json.error}`, ultimaSync: syncKP.ultimaSync });
        return;
      }
      const ahora = new Date().toISOString();
      const msg = json.total === 0
        ? "Sin leads nuevos en KiteProp"
        : `${json.importados} nuevos · ${json.actualizados} actualizados${json.errores ? ` · ${json.errores} errores` : ""}`;
      setSyncKP({ cargando: false, resultado: msg, ultimaSync: ahora });
    } catch {
      setSyncKP(prev => ({ ...prev, cargando: false, resultado: "Error de red" }));
    }
  };

  const sincronizarTK = async () => {
    if (!token) return;
    setSyncTK({ cargando: true, resultado: "", ultimaSync: syncTK.ultimaSync });
    try {
      const res = await fetch("/api/crm/tokko/sync-leads", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setSyncTK({ cargando: false, resultado: `Error: ${json.error}`, ultimaSync: syncTK.ultimaSync });
        return;
      }
      const ahora = new Date().toISOString();
      const msg = json.total === 0
        ? "Sin contactos en Tokko"
        : `${json.importados} nuevos · ${json.actualizados} actualizados${json.errores ? ` · ${json.errores} errores` : ""}`;
      setSyncTK({ cargando: false, resultado: msg, ultimaSync: ahora });
    } catch {
      setSyncTK(prev => ({ ...prev, cargando: false, resultado: "Error de red" }));
    }
  };

  const sincronizarTodo = async () => {
    if (!token) return;
    setSyncAll({ cargando: true, resultado: "", ultimaSync: null });
    await Promise.all([sincronizarKP(), sincronizarTK()]);
    setSyncAll({ cargando: false, resultado: "Sincronización completa", ultimaSync: new Date().toISOString() });
  };

  function fmtSync(iso: string | null): string {
    if (!iso) return "Nunca sincronizado";
    return `Última sync: ${new Date(iso).toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}`;
  }

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
        .port-sync-bar { display:flex; align-items:center; gap:10px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.06); margin-top:14px; flex-wrap:wrap; }
        .port-sync-btn { padding:7px 16px; background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.2); border-radius:6px; color:#60a5fa; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:800; letter-spacing:0.06em; cursor:pointer; transition:opacity 0.15s; white-space:nowrap; }
        .port-sync-btn:hover { opacity:0.8; }
        .port-sync-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .port-sync-info { font-size:11px; color:rgba(255,255,255,0.25); font-family:'Inter',sans-serif; }
        .port-sync-ok   { font-size:11px; color:#22c55e; font-family:'Inter',sans-serif; }
        .port-sync-err  { font-size:11px; color:#f87171; font-family:'Inter',sans-serif; }
        .port-tag-kp { display:inline-flex; align-items:center; padding:2px 7px; background:rgba(96,165,250,0.12); border:1px solid rgba(96,165,250,0.25); border-radius:4px; font-family:'Montserrat',sans-serif; font-size:9px; font-weight:800; color:#60a5fa; letter-spacing:0.08em; margin-left:6px; }
        .port-sync-all-btn { padding:10px 22px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); border-radius:6px; color:#22c55e; font-family:'Montserrat',sans-serif; font-size:12px; font-weight:800; letter-spacing:0.06em; cursor:pointer; transition:opacity 0.15s; }
        .port-sync-all-btn:hover { opacity:0.85; }
        .port-sync-all-btn:disabled { opacity:0.4; cursor:not-allowed; }
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
          <div style={{ marginBottom:0 }}>
            <div className="port-label">API Key</div>
            <input
              className="port-input"
              type="password"
              placeholder="tu-api-key-de-tokko"
              value={tokkoKey}
              onChange={e => setTokkoKey(e.target.value)}
            />
            <div className="port-hint">Encontrala en Tokko Broker → Configuración → Acceso a APIs</div>
          </div>
          <div className="port-sync-bar">
            <button
              className="port-sync-btn"
              onClick={sincronizarTK}
              disabled={syncTK.cargando || (!tokkoKey && !!globalStatus && !globalStatus.tokko.configurado)}
            >
              {syncTK.cargando ? "Sincronizando..." : "↻ Sincronizar contactos TK"}
            </button>
            {syncTK.resultado
              ? <span className={syncTK.resultado.startsWith("Error") ? "port-sync-err" : "port-sync-ok"}>
                  {syncTK.resultado}
                </span>
              : <span className="port-sync-info">{fmtSync(syncTK.ultimaSync)}</span>
            }
          </div>
        </div>

        {/* KiteProp */}
        <div className="port-card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div className="port-card-title">
              🪁 KiteProp
              <span className="port-tag-kp">KP</span>
            </div>
            {globalStatus && (
              <span className={`port-status ${globalStatus.kiteprop.configurado ? "port-status-ok" : "port-status-pending"}`}>
                {globalStatus.kiteprop.configurado ? "Global activo" : "Sin config. global"}
              </span>
            )}
          </div>
          <div className="port-card-sub">
            Portal de propiedades. Los interesados se importan automáticamente como contactos con tag <strong style={{ color:"#60a5fa" }}>KP</strong> y se crea una búsqueda con sus criterios.
          </div>
          <div style={{ marginBottom:0 }}>
            <div className="port-label">API Key</div>
            <input
              className="port-input"
              type="password"
              placeholder="tu-api-key-de-kiteprop"
              value={kitepropKey}
              onChange={e => setKitepropKey(e.target.value)}
            />
            <div className="port-hint">Encontrala en tu panel de KiteProp → Configuración → Integraciones</div>
          </div>
          <div className="port-sync-bar">
            <button
              className="port-sync-btn"
              onClick={sincronizarKP}
              disabled={syncKP.cargando || (!kitepropKey && !!globalStatus && !globalStatus.kiteprop.configurado)}
            >
              {syncKP.cargando ? "Sincronizando..." : "↻ Sincronizar interesados KP"}
            </button>
            {syncKP.resultado
              ? <span className={syncKP.resultado.startsWith("Error") ? "port-sync-err" : "port-sync-ok"}>
                  {syncKP.resultado}
                </span>
              : <span className="port-sync-info">{fmtSync(syncKP.ultimaSync)}</span>
            }
          </div>
        </div>

        {/* Propia MLS */}
        <div className="port-card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div className="port-card-title">🏛️ Propia MLS</div>
            <span className={`port-status ${propiaKey ? "port-status-ok" : "port-status-pending"}`}>
              {propiaKey ? "Configurado" : "Sin configurar"}
            </span>
          </div>
          <div className="port-card-sub">
            Red MLS del colegio de corredores inmobiliarios. Con la API key podés buscar en toda la red, ver tus publicaciones e importar propiedades a tu cartera.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:0 }}>
            <div>
              <div className="port-label">API Key</div>
              <input
                className="port-input"
                type="password"
                placeholder="Tu API key de Propia MLS"
                value={propiaKey}
                onChange={e => setPropiaKey(e.target.value)}
              />
              <div className="port-hint">El colegio te la facilita al darte acceso a la API</div>
            </div>
            <div>
              <div className="port-label">Usuario / Matrícula</div>
              <input
                className="port-input"
                type="text"
                placeholder="Tu usuario en Propia"
                value={propiaUsuario}
                onChange={e => setPropiaUsuario(e.target.value)}
              />
              <div className="port-hint">Opcional — para filtrar tus propias publicaciones</div>
            </div>
          </div>
          {propiaKey && (
            <div style={{ marginTop:12 }}>
              <Link
                href="/crm/propia"
                style={{ display:"inline-block", padding:"8px 16px", background:"rgba(200,0,0,0.1)", border:"1px solid rgba(200,0,0,0.2)", borderRadius:6, color:"#cc0000", fontFamily:"Montserrat,sans-serif", fontSize:11, fontWeight:800, letterSpacing:"0.04em", textDecoration:"none" }}
              >
                Abrir Propia MLS →
              </Link>
            </div>
          )}
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
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <button className="port-connect-btn" onClick={conectarML} disabled={!mlAppId || !mlAppSecret}>
              {mlConectado ? "Reconectar MercadoLibre" : "Conectar con MercadoLibre →"}
            </button>
            {mlConectado && (
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)", fontFamily:"Inter,sans-serif" }}>
                El token se renueva automáticamente al publicar
              </span>
            )}
          </div>
          <div className="port-sync-bar">
            {mlConectado
              ? <Link href="/crm/mercadolibre" style={{ padding:"7px 16px", background:"rgba(96,165,250,0.1)", border:"1px solid rgba(96,165,250,0.2)", borderRadius:6, color:"#60a5fa", fontFamily:"Montserrat,sans-serif", fontSize:10, fontWeight:800, letterSpacing:"0.06em", textDecoration:"none", whiteSpace:"nowrap" }}>
                  → Gestionar publicaciones ML
                </Link>
              : <span className="port-sync-info">Conectá ML para gestionar publicaciones</span>
            }
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

        {/* Acciones globales */}
        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginTop:4, marginBottom:8 }}>
          <button className="port-save-btn" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar credenciales"}
          </button>
          <button className="port-sync-all-btn" onClick={sincronizarTodo} disabled={syncAll.cargando}>
            {syncAll.cargando ? "Sincronizando todos..." : "↻ Sincronizar todos los portales"}
          </button>
        </div>

        {syncAll.resultado && (
          <div className="port-msg port-msg-ok">{syncAll.resultado}</div>
        )}

        {msg && (
          <div className={`port-msg ${msg.startsWith("Error") ? "port-msg-err" : "port-msg-ok"}`}>
            {msg}
          </div>
        )}

        {/* Importar desde portales */}
        <div className="port-card" style={{ marginTop:20 }}>
          <div className="port-card-title">📥 Importar propiedades desde portales</div>
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

export default function PortalesPage() {
  return (
    <Suspense fallback={null}>
      <PortalesInner />
    </Suspense>
  );
}
