"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

const EVENTOS_DISPONIBLES = [
  { id: "contact.created",     label: "Contacto creado" },
  { id: "contact.updated",     label: "Contacto actualizado" },
  { id: "property.created",    label: "Propiedad creada" },
  { id: "property.updated",    label: "Propiedad actualizada" },
  { id: "negocio.created",     label: "Negocio creado" },
  { id: "negocio.updated",     label: "Negocio actualizado" },
  { id: "visit.confirmed",     label: "Visita confirmada" },
  { id: "visit.cancelled",     label: "Visita cancelada" },
  { id: "lead.received",       label: "Lead recibido" },
  { id: "signature.completed", label: "Firma completada" },
];

interface Webhook {
  id: string;
  nombre: string;
  url: string;
  eventos: string[];
  activo: boolean;
  ultimo_envio: string | null;
  created_at: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  evento: string;
  status_code: number | null;
  ok: boolean;
  duracion_ms: number;
  created_at: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function WebhooksPage() {
  const [token, setToken] = useState<string | null>(null);
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Nuevo webhook
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [eventos, setEventos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; status: number }>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const auth = useCallback((): Record<string, string> => token ? { Authorization: `Bearer ${token}` } : {}, [token]);

  const cargar = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await fetch("/api/webhooks", { headers: auth() });
    const json = await res.json();
    setHooks(json.hooks ?? []);
    setLogs(json.logs ?? []);
    setLoading(false);
  }, [token, auth]);

  useEffect(() => { if (token) cargar(); }, [token, cargar]);

  async function crear() {
    if (!nombre.trim() || !url.trim() || !eventos.length) {
      setMsg({ tipo: "err", texto: "Completá nombre, URL y al menos un evento" });
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "crear", nombre, url, eventos }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      setNewSecret(json.secret);
      setNombre(""); setUrl(""); setEventos([]);
      cargar();
    } else {
      setMsg({ tipo: "err", texto: json.error });
    }
  }

  async function toggleActivo(hook: Webhook) {
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "actualizar", id: hook.id, activo: !hook.activo }),
    });
    cargar();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este webhook?")) return;
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "eliminar", id }),
    });
    cargar();
  }

  async function test(id: string) {
    setTestingId(id);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "test", id }),
    });
    const json = await res.json();
    setTestResult(prev => ({ ...prev, [id]: { ok: json.ok, status: json.status } }));
    setTestingId(null);
    cargar();
  }

  function toggleEvento(ev: string) {
    setEventos(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  return (
    <>
      <style>{`
        
        .wh-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 10px; padding: 20px; }
        .wh-input { background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 7px; color: #fff; padding: 9px 12px; font-family: var(--font-body); font-size: 13px; width: 100%; outline: none; }
        .wh-input:focus { border-color: rgba(153,0,0,0.5); }
        .wh-btn { padding: 8px 18px; border-radius: 7px; font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.07em; cursor: pointer; border: none; transition: all 0.15s; }
        .wh-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .wh-btn-red { background: #990000; color: #fff; }
        .wh-btn-red:hover:not(:disabled) { background: #aa0000; }
        .wh-btn-outline { background: transparent; color: var(--gfi-text-secondary); border: 1px solid rgba(255,255,255,0.15); }
        .wh-btn-outline:hover:not(:disabled) { background: var(--gfi-border-subtle); }
        .wh-badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 9px; font-weight: 700; font-family: var(--font-display); letter-spacing: 0.08em; }
        .wh-ev-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.06em; cursor: pointer; user-select: none; transition: all 0.15s; border: 1px solid var(--gfi-border); background: var(--gfi-border-subtle); color: var(--gfi-text-muted); }
        .wh-ev-chip.sel { border-color: rgba(153,0,0,0.5); background: rgba(153,0,0,0.12); color: #ff6666; }
        .wh-table { width: 100%; border-collapse: collapse; }
        .wh-table th { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-text-muted); padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left; }
        .wh-table td { color: rgba(255,255,255,0.65); padding: 10px 10px; border-bottom: 1px solid var(--gfi-border-subtle); font-family: var(--font-body); font-size: 12px; vertical-align: middle; }
        .wh-secret-box { background: rgba(153,0,0,0.08); border: 1px solid rgba(153,0,0,0.3); border-radius: 8px; padding: 16px; }
        .wh-mono { font-family: monospace; font-size: 12px; background: rgba(0,0,0,0.4); padding: 8px 12px; border-radius: 5px; word-break: break-all; color: #d4960c; }
      `}</style>

      <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "#fff" }}>
            Webhooks <span style={{ color: "#990000" }}>GFI®</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--gfi-text-muted)", marginTop: 3 }}>
            Registrá endpoints externos para recibir eventos en tiempo real desde GFI®
          </div>
        </div>

        {/* Secret recién creado — mostrar una sola vez */}
        {newSecret && (
          <div className="wh-secret-box">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#d4960c" }}>
                Copiá tu secret ahora — se muestra una sola vez
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--gfi-text-secondary)", marginBottom: 10, fontFamily: "Inter,sans-serif" }}>
              Usalo para verificar la firma <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>X-GFI-Signature: sha256=&lt;hmac&gt;</code> de cada request recibido.
            </div>
            <div className="wh-mono">{newSecret}</div>
            <button className="wh-btn wh-btn-outline" style={{ marginTop: 10 }} onClick={() => { navigator.clipboard.writeText(newSecret); }}>
              Copiar al portapapeles
            </button>
            <button className="wh-btn wh-btn-outline" style={{ marginTop: 10, marginLeft: 8 }} onClick={() => setNewSecret(null)}>
              Cerrar
            </button>
          </div>
        )}

        {/* Botón nuevo webhook */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="wh-btn wh-btn-red" onClick={() => { setShowForm(!showForm); setMsg(null); }}>
            {showForm ? "Cancelar" : "+ Nuevo Webhook"}
          </button>
        </div>

        {/* Formulario nuevo webhook */}
        {showForm && (
          <div className="wh-card" style={{ borderColor: "rgba(153,0,0,0.2)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, color: "var(--gfi-text-secondary)", letterSpacing: "0.1em", marginBottom: 16 }}>
              NUEVO WEBHOOK
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 5, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.08em" }}>NOMBRE</div>
                <input className="wh-input" placeholder="Ej: Mi sistema CRM" value={nombre} onChange={e => setNombre(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 5, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.08em" }}>URL DEL ENDPOINT</div>
                <input className="wh-input" placeholder="https://mi-sistema.com/webhook" value={url} onChange={e => setUrl(e.target.value)} />
                <div style={{ fontSize: 11, color: "var(--gfi-text-dim)", marginTop: 4, fontFamily: "Inter,sans-serif" }}>Debe ser HTTPS y aceptar POST con Content-Type: application/json</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 8, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.08em" }}>EVENTOS A RECIBIR</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {EVENTOS_DISPONIBLES.map(ev => (
                    <span key={ev.id} className={`wh-ev-chip${eventos.includes(ev.id) ? " sel" : ""}`} onClick={() => toggleEvento(ev.id)}>
                      {eventos.includes(ev.id) ? "✓ " : ""}{ev.label}
                    </span>
                  ))}
                </div>
              </div>
              {msg && (
                <div style={{ padding: "10px 14px", borderRadius: 7, background: msg.tipo === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.tipo === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, color: msg.tipo === "ok" ? "#3abab6" : "#b80000", fontFamily: "Inter,sans-serif", fontSize: 12 }}>
                  {msg.texto}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="wh-btn wh-btn-red" onClick={crear} disabled={saving}>
                  {saving ? "Creando…" : "Crear Webhook"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--gfi-text-dim)", fontFamily: "Inter,sans-serif" }}>
                El secret para verificar la firma HMAC se mostrará una sola vez al crear el webhook. Asegurate de copiarlo.
              </div>
            </div>
          </div>
        )}

        {/* Lista webhooks */}
        <div className="wh-card">
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>Cargando…</div>
          ) : hooks.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--gfi-text-dim)", fontFamily: "Inter,sans-serif", fontSize: 13, fontStyle: "italic" }}>
              No hay webhooks configurados todavía
            </div>
          ) : (
            <table className="wh-table">
              <thead>
                <tr>
                  <th>Nombre / URL</th>
                  <th>Eventos</th>
                  <th>Estado</th>
                  <th>Último envío</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hooks.map(hook => (
                  <tr key={hook.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "#fff", marginBottom: 2 }}>{hook.nombre}</div>
                      <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>{hook.url}</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {hook.eventos.map(ev => (
                          <span key={ev} className="wh-badge" style={{ background: "rgba(153,0,0,0.1)", border: "1px solid rgba(153,0,0,0.2)", color: "rgba(255,100,100,0.8)" }}>
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span
                        className="wh-badge"
                        style={{ background: hook.activo ? "rgba(34,197,94,0.1)" : "var(--gfi-border-subtle)", color: hook.activo ? "#3abab6" : "var(--gfi-text-muted)", border: `1px solid ${hook.activo ? "rgba(34,197,94,0.2)" : "var(--gfi-border)"}`, cursor: "pointer" }}
                        onClick={() => toggleActivo(hook)}
                        title="Click para activar/desactivar"
                      >
                        {hook.activo ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </td>
                    <td style={{ color: "var(--gfi-text-muted)", fontSize: 11 }}>
                      {hook.ultimo_envio ? fmt(hook.ultimo_envio) : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          className="wh-btn wh-btn-outline"
                          style={{ fontSize: 10, padding: "5px 10px" }}
                          onClick={() => test(hook.id)}
                          disabled={testingId === hook.id}
                        >
                          {testingId === hook.id ? "…" : testResult[hook.id] ? (testResult[hook.id].ok ? "✓ OK" : `✕ ${testResult[hook.id].status || "err"}`) : "Test"}
                        </button>
                        <button
                          className="wh-btn wh-btn-outline"
                          style={{ fontSize: 10, padding: "5px 10px", color: "rgba(239,68,68,0.7)", borderColor: "rgba(239,68,68,0.2)" }}
                          onClick={() => eliminar(hook.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Log de entregas */}
        {logs.length > 0 && (
          <div className="wh-card">
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, color: "var(--gfi-text-muted)", letterSpacing: "0.12em", marginBottom: 14 }}>
              ÚLTIMAS ENTREGAS
            </div>
            <table className="wh-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Estado</th>
                  <th>HTTP</th>
                  <th>Duración</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{log.evento}</td>
                    <td>
                      <span className="wh-badge" style={{ background: log.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: log.ok ? "#3abab6" : "#b80000", border: `1px solid ${log.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                        {log.ok ? "OK" : "ERROR"}
                      </span>
                    </td>
                    <td style={{ color: log.status_code && log.status_code < 300 ? "#3abab6" : "#b80000", fontFamily: "monospace" }}>
                      {log.status_code ?? "—"}
                    </td>
                    <td style={{ color: "var(--gfi-text-muted)", fontSize: 11 }}>{log.duracion_ms}ms</td>
                    <td style={{ color: "var(--gfi-text-muted)", fontSize: 11 }}>{fmt(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Guía de verificación */}
        <div className="wh-card" style={{ fontSize: 12, color: "var(--gfi-text-muted)", lineHeight: 1.8, fontFamily: "Inter,sans-serif" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, color: "var(--gfi-text-muted)", letterSpacing: "0.1em", marginBottom: 10 }}>VERIFICACIÓN HMAC</div>
          Cada request incluye el header <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>X-GFI-Signature: sha256=&lt;hmac-sha256&gt;</code> y <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>X-GFI-Event: &lt;nombre-del-evento&gt;</code>.<br />
          Para verificar: calculá <strong>HMAC-SHA256(secret, body)</strong> y compará con el valor del header.
        </div>
      </div>
    </>
  );
}
