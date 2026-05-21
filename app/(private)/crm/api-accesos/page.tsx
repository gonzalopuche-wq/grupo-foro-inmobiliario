"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

interface Suscripcion {
  perfil_id: string;
  api_key: string;
  habilitada: boolean;
  habilitada_at: string | null;
  precio_mensual: number;
  notas: string | null;
}

interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  tipo: string;
  matricula: string | null;
  inmobiliaria: string | null;
  suscripcion: Suscripcion | null;
}

export default function ApiAccesosPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState<Record<string, boolean>>({});
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [precio, setPrecio] = useState<Record<string, string>>({});

  const API_DOCS_URL = typeof window !== "undefined"
    ? `${window.location.origin}/api/v1/propiedades`
    : "/api/v1/propiedades";

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", session.user.id).single();
      if (!p || !["admin", "master"].includes(p.tipo)) {
        setError("Sin acceso — solo administradores");
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      setToken(session.access_token);
      await cargarPerfiles(session.access_token);
    };
    init();
  }, []);

  async function cargarPerfiles(tk: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-suscripciones", {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const data: Perfil[] = json.perfiles;
      setPerfiles(data);
      // Inicializar estados locales
      const notasInit: Record<string, string> = {};
      const precioInit: Record<string, string> = {};
      data.forEach(p => {
        notasInit[p.id] = p.suscripcion?.notas ?? "";
        precioInit[p.id] = String(p.suscripcion?.precio_mensual ?? 50000);
      });
      setNotas(notasInit);
      setPrecio(precioInit);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    }
    setLoading(false);
  }

  async function toggleHabilitar(perfil: Perfil, habilitar: boolean) {
    if (!token) return;
    setGuardando(g => ({ ...g, [perfil.id]: true }));
    try {
      const res = await fetch("/api/admin/api-suscripciones", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          perfil_id: perfil.id,
          habilitada: habilitar,
          notas: notas[perfil.id] ?? "",
          precio_mensual: parseInt(precio[perfil.id] ?? "50000", 10) || 50000,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setPerfiles(prev => prev.map(p =>
        p.id === perfil.id ? { ...p, suscripcion: json.suscripcion } : p
      ));
      setMsg(m => ({ ...m, [perfil.id]: habilitar ? "✓ API habilitada" : "✓ API deshabilitada" }));
      setTimeout(() => setMsg(m => ({ ...m, [perfil.id]: "" })), 3000);
    } catch (e: unknown) {
      setMsg(m => ({ ...m, [perfil.id]: `Error: ${e instanceof Error ? e.message : "desconocido"}` }));
    }
    setGuardando(g => ({ ...g, [perfil.id]: false }));
  }

  async function regenerarKey(perfilId: string) {
    if (!token || !confirm("¿Regenerar la API key? El usuario deberá actualizar UrbixPro con la nueva key.")) return;
    setGuardando(g => ({ ...g, [perfilId]: true }));
    try {
      const res = await fetch("/api/admin/api-suscripciones", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ perfil_id: perfilId, habilitada: true, regenerar_key: true }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setPerfiles(prev => prev.map(p =>
        p.id === perfilId ? { ...p, suscripcion: json.suscripcion } : p
      ));
      setMsg(m => ({ ...m, [perfilId]: "✓ Key regenerada" }));
      setTimeout(() => setMsg(m => ({ ...m, [perfilId]: "" })), 3000);
    } catch (e: unknown) {
      setMsg(m => ({ ...m, [perfilId]: `Error: ${e instanceof Error ? e.message : "desconocido"}` }));
    }
    setGuardando(g => ({ ...g, [perfilId]: false }));
  }

  function copiar(texto: string, perfilId: string) {
    navigator.clipboard.writeText(texto);
    setMsg(m => ({ ...m, [perfilId]: "✓ Copiado" }));
    setTimeout(() => setMsg(m => ({ ...m, [perfilId]: "" })), 2000);
  }

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    if (!q) return perfiles;
    return perfiles.filter(p =>
      p.apellido?.toLowerCase().includes(q) ||
      p.nombre?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.inmobiliaria?.toLowerCase().includes(q) ||
      p.matricula?.toLowerCase().includes(q)
    );
  }, [perfiles, busqueda]);

  const habilitados = perfiles.filter(p => p.suscripcion?.habilitada).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .apiac-wrap { display: flex; flex-direction: column; gap: 20px; }
        .apiac-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .apiac-titulo span { color: #cc0000; }
        .apiac-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .apiac-stats { display: flex; gap: 16px; flex-wrap: wrap; }
        .apiac-stat { padding: 14px 20px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .apiac-stat-val { font-family: 'Montserrat',sans-serif; font-size: 24px; font-weight: 800; color: #fff; }
        .apiac-stat-label { font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; margin-top: 2px; }
        .apiac-docs { padding: 14px 18px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 6px; font-size: 12px; color: rgba(255,255,255,0.7); font-family: 'Inter',sans-serif; }
        .apiac-docs code { background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 3px; font-size: 11px; color: #818cf8; }
        .apiac-input { padding: 10px 14px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #fff; font-size: 14px; outline: none; font-family: 'Inter',sans-serif; width: 100%; transition: border-color 0.2s; }
        .apiac-input:focus { border-color: rgba(200,0,0,0.5); }
        .apiac-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow-x: auto; }
        .apiac-tabla { width: 100%; border-collapse: collapse; min-width: 900px; }
        .apiac-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .apiac-tabla th { padding: 10px 14px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .apiac-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
        .apiac-tabla tbody tr:last-child { border-bottom: none; }
        .apiac-tabla tbody tr:hover { background: rgba(255,255,255,0.015); }
        .apiac-tabla td { padding: 12px 14px; font-size: 12px; color: rgba(255,255,255,0.7); vertical-align: middle; }
        .apiac-nombre { font-weight: 600; color: #fff; font-size: 13px; }
        .apiac-mat { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .apiac-toggle { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
        .apiac-toggle input { opacity: 0; width: 0; height: 0; }
        .apiac-slider { position: absolute; inset: 0; background: rgba(255,255,255,0.1); border-radius: 24px; transition: 0.2s; border: 1px solid rgba(255,255,255,0.15); }
        .apiac-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background: rgba(255,255,255,0.6); border-radius: 50%; transition: 0.2s; }
        input:checked + .apiac-slider { background: rgba(34,197,94,0.25); border-color: rgba(34,197,94,0.5); }
        input:checked + .apiac-slider:before { transform: translateX(20px); background: #22c55e; }
        .apiac-key-wrap { display: flex; align-items: center; gap: 6px; }
        .apiac-key { font-family: monospace; font-size: 11px; color: #818cf8; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); padding: 4px 10px; border-radius: 4px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .apiac-btn { padding: 5px 12px; border-radius: 4px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); }
        .apiac-btn:hover { border-color: rgba(200,0,0,0.4); color: #fff; }
        .apiac-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .apiac-msg { font-size: 11px; color: #22c55e; font-family: 'Inter',sans-serif; }
        .apiac-msg.err { color: #f87171; }
        .apiac-nokey { font-size: 11px; color: rgba(255,255,255,0.2); font-style: italic; }
        .apiac-inp-sm { padding: 5px 10px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.7); font-size: 11px; font-family: 'Inter',sans-serif; outline: none; width: 90px; }
        .apiac-inp-sm:focus { border-color: rgba(200,0,0,0.4); }
      `}</style>

      <div className="apiac-wrap">
        <div>
          <div className="apiac-titulo">API <span>GFI®</span> — Accesos</div>
          <div className="apiac-sub">Habilitá la API pública por usuario · $50.000/mes adicionales · Solo propiedades propias</div>
        </div>

        {error && (
          <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 13, color: "#ef4444" }}>
            {error}
          </div>
        )}

        {isAdmin && !loading && (
          <>
            <div className="apiac-stats">
              <div className="apiac-stat">
                <div className="apiac-stat-val">{habilitados}</div>
                <div className="apiac-stat-label">Con API activa</div>
              </div>
              <div className="apiac-stat">
                <div className="apiac-stat-val" style={{ color: "#22c55e" }}>
                  ${(habilitados * 50000).toLocaleString("es-AR")}
                </div>
                <div className="apiac-stat-label">Facturación mensual</div>
              </div>
              <div className="apiac-stat">
                <div className="apiac-stat-val" style={{ color: "rgba(255,255,255,0.4)" }}>{perfiles.length}</div>
                <div className="apiac-stat-label">Total usuarios</div>
              </div>
            </div>

            <div className="apiac-docs">
              <strong style={{ color: "#818cf8" }}>Endpoint API:</strong>{" "}
              <code>{API_DOCS_URL}</code>
              <br /><br />
              <strong>Header de autenticación:</strong> <code>X-GFI-Key: &lt;api_key&gt;</code>
              <br />
              <strong>GET</strong> → lista propiedades del usuario &nbsp;|&nbsp;
              <strong>POST</strong> → crea/actualiza propiedad (upsert por <code>codigo</code>)<br /><br />
              <strong>Flujo UrbixPro:</strong>{" "}
              UrbixPro <strong>→</strong> POST <code>/api/v1/propiedades</code> (con X-GFI-Key){" "}
              <strong>→</strong> GFI almacena en cartera{" "}
              <strong>→</strong> sync a KiteProp{" "}
              <strong>→</strong> web
            </div>

            <input
              className="apiac-input"
              placeholder="Buscar por nombre, apellido, email, inmobiliaria o matrícula..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />

            <div className="apiac-tabla-wrap">
              <table className="apiac-tabla">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Matrícula / Inmobiliaria</th>
                    <th>Precio/mes</th>
                    <th>API habilitada</th>
                    <th>API Key</th>
                    <th>Habilitada desde</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(p => {
                    const sus = p.suscripcion;
                    const isGuardando = guardando[p.id];
                    const mensajeActual = msg[p.id] ?? "";
                    const esError = mensajeActual.startsWith("Error");

                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="apiac-nombre">{[p.apellido, p.nombre].filter(Boolean).join(", ") || "—"}</div>
                          <div className="apiac-mat" style={{ color: "rgba(255,255,255,0.3)" }}>{p.email}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 12 }}>{p.matricula || <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}</div>
                          <div className="apiac-mat">{p.inmobiliaria}</div>
                        </td>
                        <td>
                          <input
                            className="apiac-inp-sm"
                            type="number"
                            value={precio[p.id] ?? "50000"}
                            onChange={e => setPrecio(pr => ({ ...pr, [p.id]: e.target.value }))}
                            min={0}
                          />
                        </td>
                        <td>
                          <label className="apiac-toggle">
                            <input
                              type="checkbox"
                              checked={sus?.habilitada ?? false}
                              disabled={isGuardando}
                              onChange={e => toggleHabilitar(p, e.target.checked)}
                            />
                            <span className="apiac-slider" />
                          </label>
                        </td>
                        <td>
                          {sus?.api_key ? (
                            <div className="apiac-key-wrap">
                              <div className="apiac-key" title={sus.api_key}>
                                {keyVisible[p.id] ? sus.api_key : `${sus.api_key.slice(0, 8)}••••••••`}
                              </div>
                              <button
                                className="apiac-btn"
                                onClick={() => setKeyVisible(v => ({ ...v, [p.id]: !v[p.id] }))}
                                title="Mostrar/ocultar"
                              >
                                {keyVisible[p.id] ? "🙈" : "👁"}
                              </button>
                              <button
                                className="apiac-btn"
                                onClick={() => copiar(sus.api_key, p.id)}
                                title="Copiar key"
                              >
                                📋
                              </button>
                            </div>
                          ) : (
                            <span className="apiac-nokey">Sin key — habilitá para generar</span>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                          {sus?.habilitada_at
                            ? new Date(sus.habilitada_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
                            : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {sus?.api_key && (
                              <button
                                className="apiac-btn"
                                onClick={() => regenerarKey(p.id)}
                                disabled={isGuardando}
                                style={{ borderColor: "rgba(234,179,8,0.3)", color: "#eab308" }}
                              >
                                🔄 Nueva key
                              </button>
                            )}
                            {mensajeActual && (
                              <span className={`apiac-msg${esError ? " err" : ""}`}>
                                {mensajeActual}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                        {busqueda ? `Sin resultados para "${busqueda}"` : "Sin usuarios"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            <div style={{ width: 20, height: 20, border: "2px solid rgba(200,0,0,0.2)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            Cargando usuarios…
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
