"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ───────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  tipo: string;
  estado: string;
  filas_importadas: number;
  filas_error: number;
  detalle: Record<string, unknown>;
  created_at: string;
}

interface ConfigEntry {
  tipo: string;
  activo: boolean;
  ultima_sincronizacion: string | null;
  created_at: string;
}

type Tab = "tokko" | "importar" | "exportar" | "historial";
type ImportTipo = "contactos" | "propiedades";

// Mapeo automático de columnas CSV → campo interno
const CONTACT_MAP: Record<string, string> = {
  nombre: "nombre", name: "nombre", "first name": "nombre", "first_name": "nombre",
  apellido: "apellido", surname: "apellido", "last name": "apellido", "last_name": "apellido",
  email: "email", correo: "email", mail: "email",
  telefono: "telefono", phone: "telefono", tel: "telefono", celular: "telefono", móvil: "telefono",
  notas: "notas", notes: "notas", observaciones: "notas", comentarios: "notas",
};
const PROP_MAP: Record<string, string> = {
  titulo: "titulo", title: "titulo", nombre: "titulo",
  tipo: "tipo", type: "tipo",
  operacion: "operacion", operation: "operacion", "tipo operación": "operacion",
  precio: "precio", price: "precio",
  moneda: "moneda", currency: "moneda",
  direccion: "direccion", address: "direccion", domicilio: "direccion",
  zona: "zona", barrio: "zona", neighborhood: "zona",
  ciudad: "ciudad", city: "ciudad",
  dormitorios: "dormitorios", rooms: "dormitorios", habitaciones: "dormitorios", ambientes: "dormitorios",
  banos: "banos", bathrooms: "banos", "baños": "banos",
  superficie: "superficie_cubierta", "superficie cubierta": "superficie_cubierta", roofed: "superficie_cubierta",
  "superficie total": "superficie_total", total_surface: "superficie_total",
  descripcion: "descripcion", description: "descripcion",
  codigo: "codigo", code: "codigo", referencia: "codigo",
};

function autoMap(headers: string[], mapDic: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers) {
    const key = h.toLowerCase().trim();
    if (mapDic[key]) result[h] = mapDic[key];
  }
  return result;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const TIPO_LABEL: Record<string, string> = {
  csv_contactos: "CSV — Contactos",
  csv_propiedades: "CSV — Propiedades",
  tokko_contactos: "Tokko — Contactos",
  tokko_propiedades: "Tokko — Propiedades",
  export: "Exportación",
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function IntegracionesPage() {
  const [tab, setTab] = useState<Tab>("tokko");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  // Tokko
  const [tokkoKey, setTokkoKey] = useState("");
  const [tokkoSaving, setTokkoSaving] = useState(false);
  const [tokkoSaved, setTokkoSaved] = useState(false);
  const [tokkoSyncing, setTokkoSyncing] = useState<string | null>(null);
  const [tokkoMsg, setTokkoMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  // Import
  const [importTipo, setImportTipo] = useState<ImportTipo>("contactos");
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Export
  const [exporting, setExporting] = useState<string | null>(null);

  const authHeader = useCallback((): Record<string, string> => {
    return token ? { "Authorization": `Bearer ${token}` } : {};
  }, [token]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/crm/integraciones", { headers: authHeader() });
    const json = await res.json();
    setLogs(json.logs ?? []);
    setConfigs(json.configs ?? []);
    setLoading(false);
  }, [authHeader]);

  useEffect(() => { if (token !== null) cargarDatos(); }, [token, cargarDatos]);

  // ── Tokko ─────────────────────────────────────────────────────────────────

  async function guardarTokko() {
    if (!tokkoKey.trim()) return;
    setTokkoSaving(true);
    const res = await fetch("/api/crm/integraciones", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardar_config", tipo: "tokko", config: { api_key: tokkoKey.trim() } }),
    });
    const json = await res.json();
    setTokkoSaving(false);
    if (json.ok) { setTokkoSaved(true); setTimeout(() => setTokkoSaved(false), 2500); cargarDatos(); }
    else setTokkoMsg({ tipo: "err", texto: json.error });
  }

  async function syncTokko(action: "propiedades" | "contactos") {
    setTokkoSyncing(action);
    setTokkoMsg(null);
    try {
      const res = await fetch(`/api/crm/tokko?action=${action}`, { headers: authHeader() });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const items = json.data?.objects ?? json.data?.results ?? [];
      let mapped: Record<string, string>[] = [];
      if (action === "propiedades") {
        mapped = items.map((p: Record<string, unknown>) => ({
          codigo: String(p.reference_code ?? ""),
          titulo: String((p.address_to_show ?? p.address) ?? ""),
          tipo: String((p.type as Record<string, unknown>)?.code ?? "Otro"),
          operacion: String(((p.operations as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.operation_type ?? "Venta"),
          precio: String(((((p.operations as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.prices as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.price ?? ""),
          moneda: String(((((p.operations as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.prices as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.currency ?? "USD"),
          direccion: String(p.address ?? ""),
          zona: String((p.location as Record<string, unknown>)?.name ?? ""),
          dormitorios: String(p.suite_amount ?? ""),
          banos: String(p.bathroom_amount ?? ""),
          superficie_cubierta: String(p.roofed_surface ?? ""),
          superficie_total: String(p.total_surface ?? ""),
          descripcion: String(p.description ?? ""),
        }));
      } else {
        mapped = items.map((c: Record<string, unknown>) => ({
          nombre: String(c.first_name ?? ""),
          apellido: String(c.last_name ?? ""),
          email: String((c.email as string[])?.[0] ?? c.email ?? ""),
          telefono: String((c.phone as string[])?.[0] ?? c.phone ?? ""),
        }));
      }
      if (mapped.length === 0) {
        setTokkoMsg({ tipo: "err", texto: "No se encontraron registros en Tokko" });
        setTokkoSyncing(null);
        return;
      }
      const impRes = await fetch("/api/crm/integraciones", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ accion: action === "propiedades" ? "importar_propiedades" : "importar_contactos", [action]: mapped, fuente: "tokko" }),
      });
      const impJson = await impRes.json();
      await fetch("/api/crm/integraciones", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "update_sync", tipo: "tokko" }),
      });
      setTokkoMsg({ tipo: "ok", texto: `${action === "propiedades" ? "Propiedades" : "Contactos"} sincronizados: ${impJson.importados} importados${impJson.errores > 0 ? `, ${impJson.errores} con error` : ""}` });
      cargarDatos();
    } catch (e: unknown) {
      setTokkoMsg({ tipo: "err", texto: e instanceof Error ? e.message : "Error al conectar con Tokko" });
    }
    setTokkoSyncing(null);
  }

  const tokkoConfig = configs.find(c => c.tipo === "tokko");

  // ── Import CSV/Excel ──────────────────────────────────────────────────────

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(null);
    const XLSX = (await import("xlsx")).default ?? await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
    if (data.length < 2) { setImportMsg({ tipo: "err", texto: "El archivo no tiene datos suficientes" }); return; }
    const headers = data[0].map(h => String(h));
    const rows = data.slice(1).filter(r => r.some(c => String(c).trim() !== ""));
    setImportHeaders(headers);
    setImportRows(rows.slice(0, 5));
    const dic = importTipo === "contactos" ? CONTACT_MAP : PROP_MAP;
    setImportMapping(autoMap(headers, dic));
  }

  async function ejecutarImport() {
    if (!fileRef.current?.files?.[0]) return;
    setImporting(true);
    setImportMsg(null);
    const XLSX = (await import("xlsx")).default ?? await import("xlsx");
    const buffer = await fileRef.current.files[0].arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
    const headers = raw[0].map(h => String(h));
    const rows = raw.slice(1).filter(r => r.some(c => String(c).trim() !== ""));
    const items = rows.map(row => {
      const obj: Record<string, string> = {};
      for (const [srcCol, dstField] of Object.entries(importMapping)) {
        const idx = headers.indexOf(srcCol);
        if (idx >= 0) obj[dstField] = String(row[idx] ?? "");
      }
      return obj;
    });
    const accion = importTipo === "contactos" ? "importar_contactos" : "importar_propiedades";
    const key = importTipo === "contactos" ? "contactos" : "propiedades";
    const res = await fetch("/api/crm/integraciones", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ accion, [key]: items, fuente: "csv" }),
    });
    const json = await res.json();
    setImporting(false);
    if (json.ok) {
      setImportMsg({ tipo: "ok", texto: `Importados: ${json.importados}${json.errores > 0 ? ` — ${json.errores} con error` : ""}` });
      setImportHeaders([]);
      setImportRows([]);
      if (fileRef.current) fileRef.current.value = "";
      cargarDatos();
    } else {
      setImportMsg({ tipo: "err", texto: json.error ?? "Error al importar" });
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function exportar(tipo: "contactos" | "propiedades" | "negocios") {
    setExporting(tipo);
    const res = await fetch(`/api/crm/integraciones?export=${tipo}`, { headers: authHeader() });
    const json = await res.json();
    if (!json.data?.length) {
      setExporting(null);
      alert("No hay datos para exportar.");
      return;
    }
    const XLSX = (await import("xlsx")).default ?? await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(json.data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipo.charAt(0).toUpperCase() + tipo.slice(1));
    XLSX.writeFile(wb, `GFI_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    await fetch("/api/crm/integraciones", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "log", tipo: "export", estado: "completado", filas_importadas: json.data.length, filas_error: 0, detalle: { subtipo: tipo } }),
    });
    cargarDatos();
    setExporting(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "tokko", label: "Tokko Broker", icon: "🔗" },
    { id: "importar", label: "Importar", icon: "📥" },
    { id: "exportar", label: "Exportar", icon: "📤" },
    { id: "historial", label: "Historial", icon: "📋" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .int-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 20px; }
        .int-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 9px 12px; font-family: 'Inter',sans-serif; font-size: 13px; width: 100%; outline: none; }
        .int-input:focus { border-color: rgba(204,0,0,0.5); }
        .int-btn { padding: 8px 18px; border-radius: 7px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; cursor: pointer; border: none; transition: opacity 0.15s; }
        .int-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .int-btn-red { background: #cc0000; color: #fff; }
        .int-btn-red:hover:not(:disabled) { background: #aa0000; }
        .int-btn-outline { background: transparent; color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15); }
        .int-btn-outline:hover:not(:disabled) { background: rgba(255,255,255,0.05); }
        .int-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 7px 10px; font-family: 'Inter',sans-serif; font-size: 13px; }
        .int-select option { background: #1a1a1a; }
        .int-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.08em; }
        .int-table { width: 100%; border-collapse: collapse; font-family: 'Inter',sans-serif; font-size: 12px; }
        .int-table th { color: rgba(255,255,255,0.35); font-weight: 600; text-align: left; padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .int-table td { color: rgba(255,255,255,0.7); padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .int-msg-ok { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 7px; padding: 10px 14px; color: #22c55e; font-family: 'Inter',sans-serif; font-size: 12px; }
        .int-msg-err { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 7px; padding: 10px 14px; color: #ef4444; font-family: 'Inter',sans-serif; font-size: 12px; }
        .int-file-zone { border: 2px dashed rgba(255,255,255,0.12); border-radius: 10px; padding: 30px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .int-file-zone:hover { border-color: rgba(204,0,0,0.4); }
      `}</style>

      <div style={{ maxWidth: 860, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#fff" }}>
            Integraciones <span style={{ color: "#cc0000" }}>CRM</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
            Conectá con Tokko Broker, importá desde CSV/Excel y exportá tus datos
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="int-btn" style={{
              background: tab === t.id ? "rgba(204,0,0,0.15)" : "rgba(255,255,255,0.04)",
              color: tab === t.id ? "#cc0000" : "rgba(255,255,255,0.5)",
              border: `1px solid ${tab === t.id ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.08)"}`,
              padding: "8px 16px",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Tokko Broker ─────────────────────────────────────────── */}
        {tab === "tokko" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="int-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏢</div>
                <div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Tokko Broker</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Sincronizá propiedades y contactos desde tu cuenta Tokko</div>
                </div>
                {tokkoConfig && (
                  <span className="int-badge" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", marginLeft: "auto" }}>CONECTADO</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 5, fontFamily: "Montserrat,sans-serif", fontWeight: 600, letterSpacing: "0.08em" }}>API KEY</div>
                  <input
                    className="int-input"
                    type="password"
                    placeholder="Ingresá tu API Key de Tokko Broker"
                    value={tokkoKey}
                    onChange={e => setTokkoKey(e.target.value)}
                  />
                </div>
                <button className="int-btn int-btn-red" onClick={guardarTokko} disabled={tokkoSaving || !tokkoKey.trim()}>
                  {tokkoSaving ? "Guardando…" : tokkoSaved ? "✓ Guardado" : "Guardar"}
                </button>
              </div>

              {tokkoConfig?.ultima_sincronizacion && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
                  Última sincronización: {formatFecha(tokkoConfig.ultima_sincronizacion)}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="int-btn int-btn-red" onClick={() => syncTokko("propiedades")} disabled={!tokkoConfig || tokkoSyncing !== null}>
                  {tokkoSyncing === "propiedades" ? "Sincronizando…" : "🏠 Sincronizar Propiedades"}
                </button>
                <button className="int-btn int-btn-outline" onClick={() => syncTokko("contactos")} disabled={!tokkoConfig || tokkoSyncing !== null}>
                  {tokkoSyncing === "contactos" ? "Sincronizando…" : "👥 Sincronizar Contactos"}
                </button>
              </div>

              {!tokkoConfig && (
                <div style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                  ℹ️ Para obtener tu API Key ingresá a Tokko Broker → Configuración → Integraciones → API
                </div>
              )}

              {tokkoMsg && (
                <div className={tokkoMsg.tipo === "ok" ? "int-msg-ok" : "int-msg-err"} style={{ marginTop: 14 }}>
                  {tokkoMsg.tipo === "ok" ? "✓ " : "✕ "}{tokkoMsg.texto}
                </div>
              )}
            </div>

            {/* Otras integraciones — próximamente */}
            <div className="int-card" style={{ opacity: 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔌</div>
                <div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Otras integraciones</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Properati, ZonaProp, MercadoLibre — próximamente</div>
                </div>
                <span className="int-badge" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>PRÓXIMAMENTE</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Importar ─────────────────────────────────────────────── */}
        {tab === "importar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="int-card">
              {/* Tipo de import */}
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                {(["contactos", "propiedades"] as ImportTipo[]).map(t => (
                  <button key={t} className="int-btn" onClick={() => { setImportTipo(t); setImportHeaders([]); setImportRows([]); setImportMsg(null); if (fileRef.current) fileRef.current.value = ""; }} style={{
                    background: importTipo === t ? "rgba(204,0,0,0.15)" : "rgba(255,255,255,0.04)",
                    color: importTipo === t ? "#cc0000" : "rgba(255,255,255,0.5)",
                    border: `1px solid ${importTipo === t ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                    {t === "contactos" ? "👥 Contactos" : "🏠 Propiedades"}
                  </button>
                ))}
              </div>

              {/* Zona de archivo */}
              <div className="int-file-zone" onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
                  Seleccioná un archivo CSV o Excel
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                  .xlsx, .xls, .csv — La primera fila debe ser el encabezado
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFile} />
              </div>

              {/* Preview + mapping */}
              {importHeaders.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 12 }}>
                    MAPEO DE COLUMNAS — {importHeaders.length} columnas detectadas
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                    {importHeaders.map(h => {
                      const camposContacto = ["nombre", "apellido", "email", "telefono", "notas"];
                      const camposProp = ["titulo", "tipo", "operacion", "precio", "moneda", "direccion", "zona", "ciudad", "dormitorios", "banos", "superficie_cubierta", "superficie_total", "descripcion", "codigo"];
                      const campos = importTipo === "contactos" ? camposContacto : camposProp;
                      return (
                        <div key={h} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.04)", borderRadius: 5, padding: "5px 8px", fontFamily: "Inter,sans-serif" }}>
                            {h}
                          </div>
                          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>→</span>
                          <select className="int-select" style={{ flex: 1, fontSize: 12 }}
                            value={importMapping[h] ?? ""}
                            onChange={e => setImportMapping(prev => {
                              const updated = { ...prev };
                              if (e.target.value) updated[h] = e.target.value;
                              else delete updated[h];
                              return updated;
                            })}>
                            <option value="">— ignorar —</option>
                            {campos.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mini preview */}
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", marginBottom: 8 }}>
                    VISTA PREVIA (primeras {importRows.length} filas)
                  </div>
                  <div style={{ overflowX: "auto", marginBottom: 16 }}>
                    <table className="int-table">
                      <thead>
                        <tr>
                          {importHeaders.map(h => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => <td key={j}>{String(cell).slice(0, 40)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button className="int-btn int-btn-red" onClick={ejecutarImport} disabled={importing || Object.keys(importMapping).length === 0}>
                    {importing ? "Importando…" : `📥 Importar ${importTipo === "contactos" ? "Contactos" : "Propiedades"}`}
                  </button>
                </div>
              )}

              {importMsg && (
                <div className={importMsg.tipo === "ok" ? "int-msg-ok" : "int-msg-err"} style={{ marginTop: 14 }}>
                  {importMsg.tipo === "ok" ? "✓ " : "✕ "}{importMsg.texto}
                </div>
              )}
            </div>

            {/* Guía de columnas esperadas */}
            <div className="int-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 12 }}>
                COLUMNAS RECONOCIDAS AUTOMÁTICAMENTE
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#cc0000", marginBottom: 6, fontFamily: "Montserrat,sans-serif" }}>Contactos</div>
                  {["nombre / first_name", "apellido / last_name", "email / correo", "telefono / phone / celular", "notas / observaciones"].map(c => (
                    <div key={c} style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "3px 0", fontFamily: "Inter,sans-serif" }}>• {c}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", marginBottom: 6, fontFamily: "Montserrat,sans-serif" }}>Propiedades</div>
                  {["titulo / nombre", "tipo / type", "operacion", "precio / price", "direccion / address", "zona / barrio", "dormitorios / rooms", "superficie cubierta"].map(c => (
                    <div key={c} style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "3px 0", fontFamily: "Inter,sans-serif" }}>• {c}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Exportar ─────────────────────────────────────────────── */}
        {tab === "exportar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {([
              { id: "contactos", label: "Contactos CRM", desc: "Nombre, email, teléfono, estado, zona, presupuesto, notas", icon: "👥", color: "#cc0000" },
              { id: "propiedades", label: "Cartera de Propiedades", desc: "Código, dirección, tipo, precio, moneda, superficies, estado", icon: "🏠", color: "#3b82f6" },
              { id: "negocios", label: "Negocios / Pipeline", desc: "Título, etapa, monto, honorarios, fecha estimada", icon: "🤝", color: "#f97316" },
            ] as const).map(item => (
              <div key={item.id} className="int-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: 9, background: `${item.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{item.desc}</div>
                </div>
                <button className="int-btn int-btn-outline" onClick={() => exportar(item.id)} disabled={exporting === item.id} style={{ flexShrink: 0 }}>
                  {exporting === item.id ? "Generando…" : "📥 Descargar Excel"}
                </button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", textAlign: "center", paddingTop: 4 }}>
              Los archivos se descargan en formato .xlsx compatible con Excel, Google Sheets y otros sistemas
            </div>
          </div>
        )}

        {/* ── Tab: Historial ────────────────────────────────────────────── */}
        {tab === "historial" && (
          <div className="int-card">
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>Cargando…</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>No hay operaciones registradas todavía</div>
            ) : (
              <table className="int-table">
                <thead>
                  <tr>
                    <th>Operación</th>
                    <th>Estado</th>
                    <th style={{ textAlign: "right" }}>Importados</th>
                    <th style={{ textAlign: "right" }}>Errores</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ color: "#fff", fontWeight: 500 }}>{TIPO_LABEL[log.tipo] ?? log.tipo}</td>
                      <td>
                        <span className="int-badge" style={{
                          background: log.estado === "completado" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                          color: log.estado === "completado" ? "#22c55e" : "#ef4444",
                        }}>{log.estado}</span>
                      </td>
                      <td style={{ textAlign: "right", color: "#22c55e" }}>{log.filas_importadas}</td>
                      <td style={{ textAlign: "right", color: log.filas_error > 0 ? "#ef4444" : "rgba(255,255,255,0.3)" }}>{log.filas_error}</td>
                      <td style={{ color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>{formatFecha(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}
