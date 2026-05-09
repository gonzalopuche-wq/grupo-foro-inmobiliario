"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default function PortalesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tokkoKey, setTokkoKey] = useState("");
  const [kitepropKey, setKitepropKey] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [globalStatus, setGlobalStatus] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);

      // Load saved keys
      const { data: creds } = await supabase
        .from("portal_credenciales")
        .select("tokko_key, kiteprop_key")
        .eq("perfil_id", data.user.id)
        .maybeSingle();
      if (creds) {
        setTokkoKey(creds.tokko_key ?? "");
        setKitepropKey(creds.kiteprop_key ?? "");
      }

      // Check global status
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
        updated_at: new Date().toISOString(),
      }, { onConflict: "perfil_id" });
    setGuardando(false);
    setMsg(error ? `Error: ${error.message}` : "Credenciales guardadas correctamente");
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
