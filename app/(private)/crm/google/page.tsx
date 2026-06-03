"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../../lib/supabase";

type Tab = "gmail" | "calendar" | "contacts" | "drive" | "config";

interface GmailThread { id: string; snippet: string; subject: string; date: string; }
interface CalEvent { id: string; summary: string; start: string; end: string; description?: string; htmlLink?: string; }
interface GContact { resourceName: string; displayName: string; email?: string; phone?: string; company?: string; }
interface DriveFile { id: string; name: string; mimeType: string; size?: string; modifiedTime: string; webViewLink?: string; }

const G_COLORS = {
  gmail:    { color: "#ea4335", bg: "rgba(234,67,53,0.12)",    border: "rgba(234,67,53,0.25)" },
  calendar: { color: "#4285f4", bg: "rgba(66,133,244,0.12)",   border: "rgba(66,133,244,0.25)" },
  contacts: { color: "#34a853", bg: "rgba(52,168,83,0.12)",    border: "rgba(52,168,83,0.25)" },
  drive:    { color: "#fbbc05", bg: "rgba(251,188,5,0.12)",     border: "rgba(251,188,5,0.25)" },
  config:   { color: "#888",    bg: "rgba(136,136,136,0.08)",   border: "rgba(136,136,136,0.2)" },
};

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "gmail",    label: "Gmail",     icon: "✉️" },
  { id: "calendar", label: "Calendar",  icon: "📅" },
  { id: "contacts", label: "Contacts",  icon: "👥" },
  { id: "drive",    label: "Drive",     icon: "📁" },
  { id: "config",   label: "Config",    icon: "⚙️" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function GoogleWorkspacePage() {
  const [tab, setTab] = useState<Tab>("gmail");
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [conectado, setConectado] = useState<boolean | null>(null);

  // Gmail
  const [gmailSearch, setGmailSearch] = useState("");
  const [gmailThreads, setGmailThreads] = useState<GmailThread[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeOk, setComposeOk] = useState(false);

  // Calendar
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventForm, setEventForm] = useState({ summary: "", description: "", location: "", start: "", end: "", open: false });
  const [eventSaving, setEventSaving] = useState(false);
  const [eventOk, setEventOk] = useState(false);

  // Contacts
  const [gcontacts, setGcontacts] = useState<GContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ importados: number; duplicados: number } | null>(null);
  const [contactsPage, setContactsPage] = useState<string | undefined>();

  // Drive
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return; }
      setToken(session.access_token);
      setUserId(session.user.id);
      // check google connected
      supabase.from("portal_credenciales")
        .select("google_access_token")
        .eq("perfil_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => setConectado(!!data?.google_access_token));
    });
  }, []);

  // Gmail: buscar threads
  async function buscarGmail() {
    if (!gmailSearch.trim()) return;
    setGmailLoading(true);
    const r = await fetch(`/api/google/gmail?contact_email=${encodeURIComponent(gmailSearch)}`, { headers: authHeader });
    const d = await r.json();
    setGmailThreads(d.threads ?? []);
    setGmailLoading(false);
  }

  // Gmail: enviar
  async function enviarEmail() {
    if (!composeTo || !composeSubject || !composeBody) return;
    setComposeSending(true);
    const r = await fetch("/api/google/gmail", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody }),
    });
    const d = await r.json();
    if (d.ok) { setComposeOk(true); setTimeout(() => { setComposeOpen(false); setComposeOk(false); setComposeTo(""); setComposeSubject(""); setComposeBody(""); }, 2000); }
    setComposeSending(false);
  }

  // Calendar: cargar eventos
  useEffect(() => {
    if (tab !== "calendar" || !token) return;
    setEventsLoading(true);
    fetch("/api/google/calendar?days=7", { headers: authHeader })
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setEventsLoading(false); })
      .catch(() => setEventsLoading(false));
  }, [tab, token]);

  // Calendar: crear evento
  async function crearEvento() {
    if (!eventForm.summary || !eventForm.start || !eventForm.end) return;
    setEventSaving(true);
    const r = await fetch("/api/google/calendar", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ summary: eventForm.summary, description: eventForm.description, location: eventForm.location, start: eventForm.start, end: eventForm.end }),
    });
    const d = await r.json();
    if (d.ok) {
      setEventOk(true);
      // reload
      fetch("/api/google/calendar?days=7", { headers: authHeader }).then(r => r.json()).then(d => setEvents(d.events ?? []));
      setTimeout(() => { setEventOk(false); setEventForm({ summary: "", description: "", location: "", start: "", end: "", open: false }); }, 2000);
    }
    setEventSaving(false);
  }

  // Contacts: cargar
  useEffect(() => {
    if (tab !== "contacts" || !token || gcontacts.length > 0) return;
    setContactsLoading(true);
    fetch(`/api/google/contacts${contactsPage ? `?pageToken=${contactsPage}` : ""}`, { headers: authHeader })
      .then(r => r.json())
      .then(d => { setGcontacts(d.contacts ?? []); setContactsLoading(false); })
      .catch(() => setContactsLoading(false));
  }, [tab, token]);

  // Contacts: importar
  async function importarContactos() {
    if (selected.size === 0) return;
    setImporting(true);
    const toImport = gcontacts.filter(c => selected.has(c.resourceName));
    const r = await fetch("/api/google/contacts", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: toImport.map(c => ({ displayName: c.displayName, email: c.email, phone: c.phone, company: c.company })) }),
    });
    const d = await r.json();
    setImportResult(d);
    setSelected(new Set());
    setImporting(false);
  }

  // Drive: cargar archivos
  useEffect(() => {
    if (tab !== "drive" || !token || files.length > 0) return;
    setFilesLoading(true);
    fetch("/api/google/drive", { headers: authHeader })
      .then(r => r.json())
      .then(d => { setFiles(d.files ?? []); setFilesLoading(false); })
      .catch(() => setFilesLoading(false));
  }, [tab, token]);

  // Drive: subir archivo
  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = (ev.target?.result as string).split(",")[1];
      const r = await fetch("/api/google/drive", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload", name: file.name, content_base64: b64, mimeType: file.type }),
      });
      const d = await r.json();
      if (d.id) { setFiles(prev => [d, ...prev]); }
      setUploadingFile(false);
    };
    reader.readAsDataURL(file);
  }

  // Drive: crear carpeta
  async function crearCarpeta() {
    if (!newFolderName.trim()) return;
    const r = await fetch("/api/google/drive", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_folder", name: newFolderName }),
    });
    const d = await r.json();
    if (d.id) { setFiles(prev => [d, ...prev]); setNewFolderName(""); }
  }

  const c = G_COLORS[tab];
  const noConectado = conectado === false;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "#e0e0e0", margin: 0, marginBottom: 6 }}>
          Google <span style={{ color: "#990000" }}>Workspace</span>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
          Gmail · Calendar · Contacts · Drive integrados en tu CRM
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #222", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "transparent", border: "none",
            borderBottom: tab === t.id ? `2px solid ${G_COLORS[t.id].color}` : "2px solid transparent",
            color: tab === t.id ? "#fff" : "#666",
            padding: "10px 16px", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: tab === t.id ? 700 : 400,
            cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1, transition: "color 0.15s",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* No conectado */}
      {noConectado && (
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: 12, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
          <div style={{ fontSize: 16, color: "#e0e0e0", fontWeight: 700, marginBottom: 8, fontFamily: "var(--font-display)" }}>
            Conectá tu cuenta de Google
          </div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
            Para usar Gmail, Calendar, Contacts y Drive desde el CRM necesitás autorizar el acceso.
          </div>
          <button onClick={() => userId && (window.location.href = `/api/google-auth?perfil_id=${userId}`)}
            style={{ padding: "12px 28px", background: "#4285f4", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer" }}>
            Conectar Google Workspace →
          </button>
        </div>
      )}

      {/* ── GMAIL ── */}
      {!noConectado && tab === "gmail" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Buscar */}
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={gmailSearch}
              onChange={e => setGmailSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && buscarGmail()}
              placeholder="Email del contacto (ej: juan@gmail.com)"
              style={{ flex: 1, padding: "10px 14px", background: "#111", border: "1px solid #333", borderRadius: 8, color: "#e0e0e0", fontSize: 14, fontFamily: "var(--font-body)", outline: "none" }}
            />
            <button onClick={buscarGmail} disabled={gmailLoading}
              style={{ padding: "10px 18px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.color, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer" }}>
              {gmailLoading ? "..." : "Buscar"}
            </button>
            <button onClick={() => setComposeOpen(true)}
              style={{ padding: "10px 18px", background: "rgba(234,67,53,0.12)", border: "1px solid rgba(234,67,53,0.3)", borderRadius: 8, color: "#ea4335", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer" }}>
              ✉️ Redactar
            </button>
          </div>

          {/* Threads */}
          {gmailThreads.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
              {gmailThreads.map((t, i) => (
                <div key={t.id} style={{ padding: "12px 16px", borderBottom: i < gmailThreads.length - 1 ? "1px solid #222" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, color: "#e0e0e0", fontWeight: 600, fontFamily: "var(--font-display)" }}>{t.subject || "(sin asunto)"}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{t.date}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.snippet}</div>
                </div>
              ))}
            </div>
          )}

          {gmailThreads.length === 0 && !gmailLoading && gmailSearch && (
            <div style={{ textAlign: "center", padding: "32px", color: "#555", fontSize: 13 }}>Sin emails encontrados para ese contacto</div>
          )}

          {/* Compose modal */}
          {composeOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100 }} onClick={() => setComposeOpen(false)} />
              <div style={{ position: "fixed", bottom: 24, right: 24, width: 440, background: "#141414", border: "1px solid #333", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.8)", zIndex: 101, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", background: "#1a1a1a", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e0", fontFamily: "var(--font-display)" }}>Nuevo mensaje</span>
                  <button onClick={() => setComposeOpen(false)} style={{ background: "none", border: "none", color: "#666", fontSize: 16, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Para", value: composeTo, set: setComposeTo, placeholder: "destinatario@email.com" },
                    { label: "Asunto", value: composeSubject, set: setComposeSubject, placeholder: "Asunto del email" },
                  ].map(f => (
                    <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #222", paddingBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "#555", width: 48, fontFamily: "var(--font-display)", fontWeight: 700 }}>{f.label}</span>
                      <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                        style={{ flex: 1, background: "none", border: "none", color: "#e0e0e0", fontSize: 13, outline: "none", fontFamily: "var(--font-body)" }} />
                    </div>
                  ))}
                  <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Escribí tu mensaje..." rows={6}
                    style={{ background: "none", border: "none", color: "#e0e0e0", fontSize: 13, resize: "none", outline: "none", fontFamily: "var(--font-body)", lineHeight: 1.6 }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={enviarEmail} disabled={composeSending || composeOk}
                      style={{ padding: "9px 22px", background: composeOk ? "rgba(52,168,83,0.2)" : "rgba(234,67,53,0.15)", border: `1px solid ${composeOk ? "rgba(52,168,83,0.4)" : "rgba(234,67,53,0.3)"}`, borderRadius: 6, color: composeOk ? "#34a853" : "#ea4335", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer" }}>
                      {composeOk ? "✓ Enviado" : composeSending ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CALENDAR ── */}
      {!noConectado && tab === "calendar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#666" }}>Próximos 7 días</div>
            <button onClick={() => setEventForm(f => ({ ...f, open: true }))}
              style={{ padding: "9px 18px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.color, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer" }}>
              + Nuevo evento
            </button>
          </div>

          {eventsLoading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#555" }}>Cargando...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#555", fontSize: 13 }}>Sin eventos en los próximos 7 días</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
              {events.map((ev, i) => (
                <div key={ev.id} style={{ padding: "12px 16px", borderBottom: i < events.length - 1 ? "1px solid #222" : "none", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ background: "rgba(66,133,244,0.12)", border: "1px solid rgba(66,133,244,0.2)", borderRadius: 8, padding: "6px 10px", textAlign: "center", minWidth: 52 }}>
                    <div style={{ fontSize: 9, color: "#4285f4", fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" }}>
                      {fmtDate(ev.start).split(" ")[0]}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#4285f4", fontFamily: "var(--font-display)" }}>
                      {new Date(ev.start).getDate()}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "#e0e0e0", fontWeight: 600, marginBottom: 3 }}>{ev.summary}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {fmtTime(ev.start)} – {fmtTime(ev.end)}
                      {ev.description && <span style={{ marginLeft: 8 }}>· {ev.description.slice(0, 60)}</span>}
                    </div>
                  </div>
                  {ev.htmlLink && (
                    <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "#4285f4", textDecoration: "none", padding: "4px 10px", border: "1px solid rgba(66,133,244,0.2)", borderRadius: 6, whiteSpace: "nowrap" }}>
                      Ver →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Crear evento modal */}
          {eventForm.open && (
            <>
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100 }} onClick={() => setEventForm(f => ({ ...f, open: false }))} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, background: "#141414", border: "1px solid #333", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.8)", zIndex: 101, padding: "24px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "#e0e0e0", marginBottom: 20 }}>Nuevo evento en Calendar</div>
                {[
                  { label: "Título", key: "summary", placeholder: "Visita propiedad..." },
                  { label: "Descripción", key: "description", placeholder: "Detalles..." },
                  { label: "Lugar", key: "location", placeholder: "Dirección o link..." },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 5, fontFamily: "var(--font-display)", fontWeight: 700 }}>{f.label}</label>
                    <input value={(eventForm as any)[f.key]} onChange={e => setEventForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: "100%", padding: "8px 12px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, color: "#e0e0e0", fontSize: 13, fontFamily: "var(--font-body)", outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  {(["start", "end"] as const).map(k => (
                    <div key={k}>
                      <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 5, fontFamily: "var(--font-display)", fontWeight: 700 }}>{k === "start" ? "Inicio" : "Fin"}</label>
                      <input type="datetime-local" value={eventForm[k]} onChange={e => setEventForm(prev => ({ ...prev, [k]: e.target.value }))}
                        style={{ width: "100%", padding: "8px 10px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, color: "#e0e0e0", fontSize: 13, fontFamily: "var(--font-body)", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setEventForm(f => ({ ...f, open: false }))}
                    style={{ padding: "9px 18px", background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#666", fontSize: 13, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button onClick={crearEvento} disabled={eventSaving}
                    style={{ padding: "9px 22px", background: eventOk ? "rgba(52,168,83,0.2)" : c.bg, border: `1px solid ${eventOk ? "rgba(52,168,83,0.4)" : c.border}`, borderRadius: 6, color: eventOk ? "#34a853" : c.color, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer" }}>
                    {eventOk ? "✓ Creado" : eventSaving ? "Guardando..." : "Crear evento"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CONTACTS ── */}
      {!noConectado && tab === "contacts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#666" }}>{gcontacts.length} contactos de Google · {selected.size} seleccionados</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setSelected(new Set(gcontacts.map(c => c.resourceName)))}
                style={{ padding: "7px 14px", background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#888", fontSize: 12, cursor: "pointer" }}>
                Seleccionar todos
              </button>
              <button onClick={importarContactos} disabled={selected.size === 0 || importing}
                style={{ padding: "7px 16px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, color: c.color, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", cursor: selected.size === 0 ? "not-allowed" : "pointer", opacity: selected.size === 0 ? 0.5 : 1 }}>
                {importing ? "Importando..." : `Importar ${selected.size > 0 ? selected.size : ""} al CRM`}
              </button>
            </div>
          </div>

          {importResult && (
            <div style={{ padding: "10px 16px", background: "rgba(52,168,83,0.1)", border: "1px solid rgba(52,168,83,0.2)", borderRadius: 8, fontSize: 13, color: "#34a853" }}>
              ✓ {importResult.importados} contactos importados · {importResult.duplicados} ya existían
            </div>
          )}

          {contactsLoading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#555" }}>Cargando contactos...</div>
          ) : gcontacts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#555", fontSize: 13 }}>Sin contactos disponibles. Verificá los permisos de Google.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
              {gcontacts.map((c, i) => (
                <div key={c.resourceName}
                  onClick={() => setSelected(prev => { const n = new Set(prev); n.has(c.resourceName) ? n.delete(c.resourceName) : n.add(c.resourceName); return n; })}
                  style={{ padding: "11px 16px", borderBottom: i < gcontacts.length - 1 ? "1px solid #222" : "none", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: selected.has(c.resourceName) ? "rgba(52,168,83,0.06)" : "transparent", transition: "background 0.1s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected.has(c.resourceName) ? "#34a853" : "#444"}`, background: selected.has(c.resourceName) ? "#34a853" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "#fff" }}>
                    {selected.has(c.resourceName) && "✓"}
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(52,168,83,0.15)", border: "1px solid rgba(52,168,83,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#34a853", fontFamily: "var(--font-display)", flexShrink: 0 }}>
                    {(c.displayName[0] ?? "?").toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#e0e0e0", fontWeight: 600 }}>{c.displayName}</div>
                    <div style={{ fontSize: 11, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[c.email, c.phone, c.company].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DRIVE ── */}
      {!noConectado && tab === "drive" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flex: 1 }}>
              <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && crearCarpeta()}
                placeholder="Nueva carpeta..."
                style={{ flex: 1, padding: "9px 12px", background: "#111", border: "1px solid #333", borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "var(--font-body)", outline: "none" }} />
              <button onClick={crearCarpeta}
                style={{ padding: "9px 16px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.color, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer" }}>
                + Carpeta
              </button>
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
              style={{ padding: "9px 16px", background: "rgba(251,188,5,0.12)", border: "1px solid rgba(251,188,5,0.25)", borderRadius: 8, color: "#fbbc05", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer" }}>
              {uploadingFile ? "Subiendo..." : "⬆ Subir archivo"}
            </button>
            <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={subirArchivo} />
          </div>

          {filesLoading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#555" }}>Cargando Drive...</div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#555", fontSize: 13 }}>Sin archivos. Subí tu primer documento o creá una carpeta.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
              {files.map((f, i) => {
                const isFolder = f.mimeType === "application/vnd.google-apps.folder";
                return (
                  <div key={f.id} style={{ padding: "11px 16px", borderBottom: i < files.length - 1 ? "1px solid #222" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{isFolder ? "📁" : f.mimeType.includes("pdf") ? "📄" : f.mimeType.includes("sheet") ? "📊" : f.mimeType.includes("doc") ? "📝" : "📎"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#e0e0e0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>
                        {f.size ? `${Math.round(parseInt(f.size) / 1024)} KB · ` : ""}{fmt(f.modifiedTime)}
                      </div>
                    </div>
                    {f.webViewLink && (
                      <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "#fbbc05", textDecoration: "none", padding: "4px 10px", border: "1px solid rgba(251,188,5,0.2)", borderRadius: 6, whiteSpace: "nowrap" }}>
                        Abrir →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONFIG ── */}
      {tab === "config" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Estado conexión */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "#990000", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Estado de conexión
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Gmail", icon: "✉️", desc: "Enviar emails y ver historial de conversaciones" },
                { label: "Google Calendar", icon: "📅", desc: "Sincronizar visitas, citas y eventos" },
                { label: "Google Contacts", icon: "👥", desc: "Importar y sincronizar contactos" },
                { label: "Google Drive", icon: "📁", desc: "Guardar documentos, contratos y presentaciones" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#1a1a1a", borderRadius: 8 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#e0e0e0", fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>{s.desc}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: conectado ? "#34a853" : "#555" }} />
                    <span style={{ fontSize: 11, color: conectado ? "#34a853" : "#555" }}>{conectado ? "Conectado" : "Sin conectar"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scopes */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "#990000", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Permisos requeridos
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "calendar.events — Crear y leer eventos de Calendar",
                "gmail.compose — Redactar y enviar emails",
                "gmail.readonly — Leer historial de conversaciones",
                "contacts — Leer y sincronizar contactos",
                "drive.file — Gestionar archivos creados por GFI",
              ].map(s => (
                <div key={s} style={{ fontSize: 12, color: "#666", padding: "6px 10px", background: "#1a1a1a", borderRadius: 6, fontFamily: "monospace" }}>
                  <span style={{ color: "#3abab6" }}>{s.split(" — ")[0]}</span>
                  <span style={{ color: "#555" }}> — {s.split(" — ")[1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Acción */}
          <button onClick={() => userId && (window.location.href = `/api/google-auth?perfil_id=${userId}`)}
            style={{ padding: "12px 24px", background: conectado ? "rgba(234,67,53,0.1)" : "#4285f4", border: conectado ? "1px solid rgba(234,67,53,0.2)" : "none", borderRadius: 8, color: conectado ? "#ea4335" : "#fff", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", cursor: "pointer", alignSelf: "flex-start" }}>
            {conectado ? "Reconectar / Actualizar permisos →" : "Conectar Google Workspace →"}
          </button>

          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.6 }}>
            Google Keep no está disponible via API pública. Como alternativa, las notas del CRM se pueden guardar en Google Drive como archivos de texto.
          </div>
        </div>
      )}
    </div>
  );
}
