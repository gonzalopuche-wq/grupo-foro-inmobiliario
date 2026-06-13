"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface ApiKey {
  id: string;
  nombre: string;
  prefijo: string;
  scopes: string[];
  activa: boolean;
  ultimo_uso: string | null;
  cant_usos: number;
  created_at: string;
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

export default function ApiAccesosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevaKey, setNuevaKey] = useState<string | null>(null);
  const [nombreInput, setNombreInput] = useState("");
  const [creando, setCreando] = useState(false);
  const [revocando, setRevocando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      setUserId(session.user.id);
      setToken(session.access_token);
      await cargarKeys(session.access_token);
    };
    init();
  }, []);

  async function cargarKeys(tk: string) {
    setLoading(true);
    const res = await fetch("/api/admin/api-keys", { headers: { Authorization: `Bearer ${tk}` } });
    const json = await res.json();
    if (json.ok) setKeys(json.keys);
    setLoading(false);
  }

  async function crearKey() {
    if (!token || !nombreInput.trim()) return;
    setCreando(true);
    setError(null);
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreInput.trim() }),
    });
    const json = await res.json();
    if (json.ok) {
      setNuevaKey(json.key);
      setNombreInput("");
      await cargarKeys(token);
    } else {
      setError(json.error ?? "Error al crear key");
    }
    setCreando(false);
  }

  async function revocarKey(keyId: string) {
    if (!token || !confirm("¿Revocar esta key? Los sistemas externos que la usen dejarán de poder sincronizar.")) return;
    setRevocando(keyId);
    try {
      const res = await fetch(`/api/admin/api-keys?key_id=${keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Error al revocar");
        return;
      }
      await cargarKeys(token!);
    } finally {
      setRevocando(null);
    }
  }

  function copiarKey() {
    if (!nuevaKey) return;
    navigator.clipboard.writeText(nuevaKey);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const activas = keys.filter(k => k.activa);
  const revocadas = keys.filter(k => !k.activa);

  return (
    <>
      <style>{`
        
        .ak-wrap { display: flex; flex-direction: column; gap: 24px; max-width: 820px; }
        .ak-titulo { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: #fff; }
        .ak-titulo span { color: #990000; }
        .ak-sub { font-size: 13px; color: var(--gfi-text-muted); margin-top: 4px; }
        .ak-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; padding: 20px; }
        .ak-card-titulo { font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 14px; }
        .ak-endpoint { font-family: monospace; font-size: 12px; color: #818cf8; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); padding: 10px 14px; border-radius: 6px; word-break: break-all; }
        .ak-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .ak-input { flex: 1; min-width: 200px; padding: 10px 14px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 4px; color: #fff; font-size: 14px; font-family: var(--font-body); outline: none; transition: border-color 0.2s; }
        .ak-input:focus { border-color: rgba(153,0,0,0.5); }
        .ak-input::placeholder { color: var(--gfi-text-dim); }
        .ak-btn { padding: 10px 18px; border-radius: 4px; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(153,0,0,0.5); background: rgba(153,0,0,0.12); color: #fff; transition: all 0.15s; white-space: nowrap; }
        .ak-btn:hover:not(:disabled) { background: rgba(153,0,0,0.22); }
        .ak-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ak-btn-sm { padding: 5px 12px; border-radius: 3px; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 1px solid var(--gfi-border); background: var(--gfi-border-subtle); color: var(--gfi-text-secondary); transition: all 0.15s; }
        .ak-btn-sm:hover:not(:disabled) { border-color: rgba(239,68,68,0.5); color: #b80000; }
        .ak-btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
        .ak-nueva-key { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.3); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
        .ak-nueva-key-titulo { font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #3abab6; }
        .ak-nueva-key-aviso { font-size: 12px; color: var(--gfi-text-secondary); font-family: var(--font-body); }
        .ak-key-display { display: flex; align-items: center; gap: 10px; }
        .ak-key-value { font-family: monospace; font-size: 13px; color: #3abab6; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); padding: 10px 14px; border-radius: 4px; flex: 1; word-break: break-all; }
        .ak-btn-copy { padding: 10px 16px; border-radius: 4px; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(34,197,94,0.4); background: rgba(34,197,94,0.1); color: #3abab6; transition: all 0.15s; white-space: nowrap; }
        .ak-btn-copy:hover { background: rgba(34,197,94,0.18); }
        .ak-tabla { width: 100%; border-collapse: collapse; }
        .ak-tabla th { padding: 8px 12px; text-align: left; font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-dim); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .ak-tabla td { padding: 11px 12px; font-size: 12px; color: var(--gfi-text-primary); border-bottom: 1px solid var(--gfi-border-subtle); vertical-align: middle; }
        .ak-tabla tbody tr:last-child td { border-bottom: none; }
        .ak-tabla tbody tr:hover td { background: rgba(255,255,255,0.015); }
        .ak-prefijo { font-family: monospace; font-size: 12px; color: #818cf8; }
        .ak-scope { font-size: 9px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.08em; padding: 2px 6px; border-radius: 10px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25); color: #818cf8; }
        .ak-pill-activa { font-size: 9px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.08em; padding: 2px 8px; border-radius: 10px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); color: #3abab6; }
        .ak-pill-revocada { font-size: 9px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.08em; padding: 2px 8px; border-radius: 10px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171; }
        .ak-empty { padding: 32px; text-align: center; color: var(--gfi-text-dim); font-size: 13px; font-style: italic; }
        .ak-error { padding: 10px 14px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; font-size: 12px; color: #f87171; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="ak-wrap">
        <div>
          <div className="ak-titulo"><span>GFI®</span> API Keys</div>
          <div className="ak-sub">Conectá sistemas externos al CRM GFI. La key se muestra una sola vez al crearla.</div>
        </div>

        {/* Endpoint info */}
        <div className="ak-card">
          <div className="ak-card-titulo">Endpoint de integración</div>
          <div className="ak-endpoint">{BASE_URL}/api/v1/propiedades</div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", lineHeight: 1.6 }}>
            Header: <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3, color: "#a5b4fc" }}>X-GFI-Key: &lt;tu key&gt;</code>
            &nbsp;·&nbsp; POST crea/actualiza · PUT actualiza por id · DELETE retira (soft)
          </div>
        </div>

        {/* Crear nueva key */}
        <div className="ak-card">
          <div className="ak-card-titulo">Nueva API Key</div>
          <div className="ak-row">
            <input
              className="ak-input"
              placeholder="Nombre · ej: Integración Tokko, Script propio..."
              value={nombreInput}
              onChange={e => setNombreInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") crearKey(); }}
              disabled={creando}
            />
            <button className="ak-btn" onClick={crearKey} disabled={creando || !nombreInput.trim()}>
              {creando ? "Generando…" : "Generar key"}
            </button>
          </div>
          {error && <div className="ak-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>

        {/* Mostrar key recién generada */}
        {nuevaKey && (
          <div className="ak-nueva-key">
            <div className="ak-nueva-key-titulo">⚠️ Copiá esta key ahora — no se mostrará de nuevo</div>
            <div className="ak-key-display">
              <div className="ak-key-value">{nuevaKey}</div>
              <button className="ak-btn-copy" onClick={copiarKey}>
                {copiado ? "✓ Copiado" : "📋 Copiar"}
              </button>
            </div>
            <div className="ak-nueva-key-aviso">
              Pegá este valor como <strong>X-GFI-Key</strong> en la configuración del sistema externo. Una vez cerrado este mensaje no hay forma de recuperarla.
            </div>
            <button
              className="ak-btn-sm"
              onClick={() => setNuevaKey(null)}
              style={{ alignSelf: "flex-start", borderColor: "rgba(34,197,94,0.3)", color: "#3abab6" }}
            >
              ✓ Ya la guardé, cerrar
            </button>
          </div>
        )}

        {/* Lista de keys activas */}
        <div className="ak-card">
          <div className="ak-card-titulo">Keys activas ({activas.length})</div>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", color: "var(--gfi-text-muted)", fontSize: 12 }}>
              <div style={{ width: 16, height: 16, border: "2px solid rgba(153,0,0,0.2)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              Cargando…
            </div>
          ) : activas.length === 0 ? (
            <div className="ak-empty">Sin keys activas — generá una arriba</div>
          ) : (
            <table className="ak-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Prefijo</th>
                  <th>Scopes</th>
                  <th>Último uso</th>
                  <th>Usos</th>
                  <th>Creada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activas.map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 600, color: "#fff" }}>{k.nombre}</td>
                    <td><span className="ak-prefijo">{k.prefijo}••••</span></td>
                    <td>{k.scopes.map(s => <span key={s} className="ak-scope">{s}</span>)}</td>
                    <td style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>
                      {k.ultimo_uso
                        ? new Date(k.ultimo_uso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "Nunca"}
                    </td>
                    <td style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
                      {k.cant_usos.toLocaleString("es-AR")}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>
                      {new Date(k.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td>
                      <button
                        className="ak-btn-sm"
                        onClick={() => revocarKey(k.id)}
                        disabled={revocando === k.id}
                      >
                        {revocando === k.id ? "…" : "Revocar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Keys revocadas */}
        {revocadas.length > 0 && (
          <div className="ak-card">
            <div className="ak-card-titulo">Keys revocadas ({revocadas.length})</div>
            <table className="ak-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Prefijo</th>
                  <th>Estado</th>
                  <th>Creada</th>
                </tr>
              </thead>
              <tbody>
                {revocadas.map(k => (
                  <tr key={k.id} style={{ opacity: 0.5 }}>
                    <td>{k.nombre}</td>
                    <td><span className="ak-prefijo">{k.prefijo}••••</span></td>
                    <td><span className="ak-pill-revocada">Revocada</span></td>
                    <td style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>
                      {new Date(k.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Datos de integración */}
        {userId && (
          <div className="ak-card" style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)" }}>
            <div className="ak-card-titulo" style={{ color: "#818cf8" }}>Datos para configurar la integración</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, fontFamily: "Inter,sans-serif", color: "var(--gfi-text-secondary)" }}>
              <div>
                <span style={{ color: "var(--gfi-text-muted)" }}>URL base GFI → </span>
                <code style={{ color: "#818cf8", background: "rgba(99,102,241,0.1)", padding: "2px 6px", borderRadius: 3 }}>{BASE_URL}</code>
              </div>
              <div>
                <span style={{ color: "var(--gfi-text-muted)" }}>inmobiliaria_id → </span>
                <code
                  style={{ color: "#a5b4fc", background: "rgba(99,102,241,0.1)", padding: "2px 6px", borderRadius: 3, cursor: "pointer" }}
                  onClick={() => { navigator.clipboard.writeText(userId); }}
                  title="Click para copiar"
                >{userId}</code>
              </div>
              <div>
                <span style={{ color: "var(--gfi-text-muted)" }}>X-GFI-Key → </span>
                <span style={{ color: "var(--gfi-text-muted)", fontStyle: "italic" }}>generá una key arriba y copiala</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
