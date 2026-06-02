"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PerfilCRM {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  matricula: string | null;
  inmobiliaria: string | null;
  cargo: string | null;
  zona_trabajo: string | null;
  foto_url: string | null;
  created_at?: string | null;
}

interface ConfigExtra {
  tipoCambioDefault: number;
  monedaDefault: "USD" | "ARS";
  honorariosDefault: number;
  splitDefault: number;
  firmaEmail: string;
  whatsappTemplate: string;
  zonasTrabajo: string[];
  alertasHabilitadas: boolean;
  diasAlertaVencimiento: number;
}

interface DatosAgencia {
  nombre: string;
  direccion: string;
  telefonoCentral: string;
  emailAgencia: string;
  web: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  cuit: string;
  matriculaAgencia: string;
}

type TabId = "perfil" | "preferencias" | "agencia" | "cuenta";

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultConfigExtra: ConfigExtra = {
  tipoCambioDefault: 1300,
  monedaDefault: "USD",
  honorariosDefault: 3,
  splitDefault: 0,
  firmaEmail: "",
  whatsappTemplate: "Hola {nombre}, te contacto de {inmobiliaria}...",
  zonasTrabajo: [],
  alertasHabilitadas: true,
  diasAlertaVencimiento: 30,
};

const defaultAgencia: DatosAgencia = {
  nombre: "",
  direccion: "",
  telefonoCentral: "",
  emailAgencia: "",
  web: "",
  logoUrl: "",
  colorPrimario: "#990000",
  colorSecundario: "#0a0a0a",
  cuit: "",
  matriculaAgencia: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function iniciales(nombre: string | null, apellido: string | null): string {
  const n = (nombre ?? "").trim().charAt(0).toUpperCase();
  const a = (apellido ?? "").trim().charAt(0).toUpperCase();
  return (n + a) || "?";
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<TabId>("perfil");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "error" } | null>(null);

  // Perfil
  const [perfil, setPerfil] = useState<PerfilCRM>({
    id: "",
    nombre: null,
    apellido: null,
    email: null,
    telefono: null,
    matricula: null,
    inmobiliaria: null,
    cargo: null,
    zona_trabajo: null,
    foto_url: null,
    created_at: null,
  });

  // Config extra
  const [config, setConfig] = useState<ConfigExtra>(defaultConfigExtra);
  const [zonaInput, setZonaInput] = useState("");

  // Agencia
  const [agencia, setAgencia] = useState<DatosAgencia>(defaultAgencia);

  const showToast = useCallback((msg: string, tipo: "ok" | "error") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Carga inicial ───────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setUserId(user.id);

      const { data: perfilData } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (perfilData) {
        setPerfil({
          id: perfilData.id ?? user.id,
          nombre: perfilData.nombre ?? null,
          apellido: perfilData.apellido ?? null,
          email: perfilData.email ?? user.email ?? null,
          telefono: perfilData.telefono ?? null,
          matricula: perfilData.matricula ?? null,
          inmobiliaria: perfilData.inmobiliaria ?? null,
          cargo: perfilData.cargo ?? null,
          zona_trabajo: perfilData.zona_trabajo ?? null,
          foto_url: perfilData.foto_url ?? null,
          created_at: perfilData.created_at ?? null,
        });
      } else {
        setPerfil((prev) => ({ ...prev, id: user.id, email: user.email ?? null }));
      }

      const { data: cfgRow } = await supabase
        .from("crm_configuracion")
        .select("config_extra, datos_agencia")
        .eq("perfil_id", user.id)
        .maybeSingle();
      if (cfgRow?.config_extra) setConfig({ ...defaultConfigExtra, ...(cfgRow.config_extra as Partial<ConfigExtra>) });
      if (cfgRow?.datos_agencia) setAgencia({ ...defaultAgencia, ...(cfgRow.datos_agencia as Partial<DatosAgencia>) });
      setLoading(false);
    })();
  }, []);

  // ── Guardar perfil ──────────────────────────────────────────────────────────

  const guardarPerfil = async () => {
    if (!userId) return;
    const { error } = await supabase.from("perfiles").upsert({
      id: userId,
      nombre: perfil.nombre,
      apellido: perfil.apellido,
      telefono: perfil.telefono,
      matricula: perfil.matricula,
      inmobiliaria: perfil.inmobiliaria,
      cargo: perfil.cargo,
      zona_trabajo: perfil.zona_trabajo,
    });
    if (error) {
      showToast("Error al guardar: " + error.message, "error");
    } else {
      showToast("Perfil guardado correctamente", "ok");
    }
  };

  // ── Guardar preferencias ────────────────────────────────────────────────────

  const guardarPreferencias = async () => {
    if (!userId) return;
    const { error } = await supabase.from("crm_configuracion").upsert({
      perfil_id: userId,
      config_extra: config,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      showToast("Error al guardar: " + error.message, "error");
    } else {
      showToast("Preferencias guardadas", "ok");
    }
  };

  // ── Guardar agencia ─────────────────────────────────────────────────────────

  const guardarAgencia = async () => {
    if (!userId) return;
    const { error } = await supabase.from("crm_configuracion").upsert({
      perfil_id: userId,
      datos_agencia: agencia,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      showToast("Error al guardar: " + error.message, "error");
    } else {
      showToast("Datos de agencia guardados", "ok");
    }
  };

  // ── Helpers zonas ───────────────────────────────────────────────────────────

  const agregarZona = () => {
    const z = zonaInput.trim();
    if (!z || config.zonasTrabajo.includes(z)) return;
    setConfig((prev) => ({ ...prev, zonasTrabajo: [...prev.zonasTrabajo, z] }));
    setZonaInput("");
  };

  const quitarZona = (zona: string) => {
    setConfig((prev) => ({
      ...prev,
      zonasTrabajo: prev.zonasTrabajo.filter((z) => z !== zona),
    }));
  };

  // ── Exportar datos ──────────────────────────────────────────────────────────

  const exportarDatos = () => {
    const todos: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      try { todos[k] = JSON.parse(localStorage.getItem(k) ?? "null"); } catch { todos[k] = localStorage.getItem(k); }
    }
    const blob = new Blob([JSON.stringify({ perfil, localStorage: todos }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crm_datos.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const limpiarDatos = async () => {
    if (!window.confirm("¿Seguro? Esto borrará todas tus preferencias locales y en la nube.")) return;
    localStorage.clear();
    setConfig(defaultConfigExtra);
    setAgencia(defaultAgencia);
    if (userId) {
      await supabase.from("crm_configuracion").upsert({
        perfil_id: userId,
        config_extra: defaultConfigExtra,
        datos_agencia: defaultAgencia,
        updated_at: new Date().toISOString(),
      });
    }
    showToast("Datos eliminados", "ok");
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // ── Estilos ───────────────────────────────────────────────────────────────────

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "Inter, sans-serif",
      padding: "32px 24px 80px",
      maxWidth: 760,
      margin: "0 auto",
    } as React.CSSProperties,
    h1: {
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: 28,
      color: "#fff",
      margin: "0 0 8px",
    } as React.CSSProperties,
    subtitle: {
      color: "rgba(255,255,255,0.45)",
      fontSize: 14,
      marginBottom: 32,
    } as React.CSSProperties,
    tabBar: {
      display: "flex",
      gap: 8,
      marginBottom: 32,
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    tabPill: (active: boolean): React.CSSProperties => ({
      padding: "8px 18px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      fontWeight: 600,
      background: active ? "#990000" : "var(--gfi-border-subtle)",
      color: active ? "#fff" : "var(--gfi-text-secondary)",
      transition: "all .15s",
    }),
    card: {
      background: "var(--gfi-border-subtle)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 12,
      padding: 24,
      marginBottom: 20,
    } as React.CSSProperties,
    cardTitle: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: 15,
      color: "#fff",
      marginBottom: 18,
    } as React.CSSProperties,
    row2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
    } as React.CSSProperties,
    label: {
      display: "block",
      color: "rgba(255,255,255,0.55)",
      fontSize: 12,
      marginBottom: 6,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
    } as React.CSSProperties,
    input: {
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 8,
      padding: "10px 12px",
      color: "#fff",
      fontSize: 14,
      fontFamily: "Inter, sans-serif",
      outline: "none",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,
    inputReadonly: {
      width: "100%",
      background: "var(--gfi-bg-card)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8,
      padding: "10px 12px",
      color: "var(--gfi-text-muted)",
      fontSize: 14,
      fontFamily: "Inter, sans-serif",
      outline: "none",
      boxSizing: "border-box" as const,
      cursor: "not-allowed",
    } as React.CSSProperties,
    textarea: {
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 8,
      padding: "10px 12px",
      color: "#fff",
      fontSize: 14,
      fontFamily: "Inter, sans-serif",
      outline: "none",
      boxSizing: "border-box" as const,
      resize: "vertical" as const,
      minHeight: 80,
    } as React.CSSProperties,
    select: {
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 8,
      padding: "10px 12px",
      color: "#fff",
      fontSize: 14,
      fontFamily: "Inter, sans-serif",
      outline: "none",
      boxSizing: "border-box" as const,
      cursor: "pointer",
    } as React.CSSProperties,
    btn: {
      background: "#990000",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "11px 24px",
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      letterSpacing: "0.03em",
    } as React.CSSProperties,
    btnSecondary: {
      background: "var(--gfi-border-subtle)",
      color: "rgba(255,255,255,0.75)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 8,
      padding: "10px 20px",
      fontFamily: "Inter, sans-serif",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
    } as React.CSSProperties,
    btnDanger: {
      background: "rgba(153,0,0,0.15)",
      color: "#ff4444",
      border: "1px solid rgba(153,0,0,0.3)",
      borderRadius: 8,
      padding: "10px 20px",
      fontFamily: "Inter, sans-serif",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
    } as React.CSSProperties,
    fieldWrap: {
      marginBottom: 16,
    } as React.CSSProperties,
    avatar: {
      width: 72,
      height: 72,
      borderRadius: "50%",
      background: "#990000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: 24,
      color: "#fff",
      flexShrink: 0,
    } as React.CSSProperties,
    toggle: (active: boolean): React.CSSProperties => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      userSelect: "none",
    }),
    toggleTrack: (active: boolean): React.CSSProperties => ({
      width: 44,
      height: 24,
      borderRadius: 12,
      background: active ? "#990000" : "rgba(255,255,255,0.15)",
      position: "relative",
      transition: "background .2s",
      flexShrink: 0,
    }),
    toggleThumb: (active: boolean): React.CSSProperties => ({
      position: "absolute",
      top: 2,
      left: active ? 22 : 2,
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: "#fff",
      transition: "left .2s",
    }),
    tag: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(153,0,0,0.15)",
      border: "1px solid rgba(153,0,0,0.3)",
      color: "#ff6666",
      borderRadius: 20,
      padding: "4px 10px",
      fontSize: 12,
      fontWeight: 600,
    } as React.CSSProperties,
    tagX: {
      cursor: "pointer",
      color: "rgba(255,100,100,0.7)",
      fontWeight: 700,
      lineHeight: 1,
    } as React.CSSProperties,
    badge: {
      display: "inline-block",
      background: "var(--gfi-border)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 20,
      padding: "4px 12px",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--gfi-text-secondary)",
    } as React.CSSProperties,
    separator: {
      borderTop: "1px solid var(--gfi-border-subtle)",
      margin: "20px 0",
    } as React.CSSProperties,
    sectionTitle: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: 13,
      color: "var(--gfi-text-secondary)",
      textTransform: "uppercase" as const,
      letterSpacing: "0.08em",
      marginBottom: 14,
    } as React.CSSProperties,
    previewCard: {
      background: "var(--gfi-bg-secondary)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 10,
      padding: 20,
      fontSize: 13,
      color: "var(--gfi-text-primary)",
      lineHeight: 1.6,
    } as React.CSSProperties,
    toastBox: (tipo: "ok" | "error"): React.CSSProperties => ({
      position: "fixed",
      bottom: 28,
      right: 28,
      zIndex: 9999,
      background: tipo === "ok" ? "#166534" : "#7f1d1d",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: 10,
      fontWeight: 600,
      fontSize: 14,
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      fontFamily: "Inter, sans-serif",
    }),
    colorPickerWrap: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    } as React.CSSProperties,
    colorPreview: (color: string): React.CSSProperties => ({
      width: 32,
      height: 32,
      borderRadius: 6,
      background: color,
      border: "1px solid rgba(255,255,255,0.15)",
      flexShrink: 0,
    }),
    colorInput: {
      width: 48,
      height: 36,
      padding: 2,
      border: "1px solid var(--gfi-border)",
      borderRadius: 6,
      background: "rgba(255,255,255,0.06)",
      cursor: "pointer",
    } as React.CSSProperties,
    agenciaCard: {
      background: "var(--gfi-bg-secondary)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 12,
      padding: 24,
      display: "flex",
      gap: 16,
      alignItems: "flex-start",
    } as React.CSSProperties,
    monedaToggle: (active: boolean): React.CSSProperties => ({
      padding: "8px 18px",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 13,
      fontFamily: "var(--font-display)",
      background: active ? "#990000" : "var(--gfi-border-subtle)",
      color: active ? "#fff" : "var(--gfi-text-secondary)",
    }),
  };

  if (loading) {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--gfi-text-muted)", fontSize: 15 }}>Cargando configuración…</span>
      </div>
    );
  }

  // ── Tab: Mi Perfil ────────────────────────────────────────────────────────────

  const TabPerfil = () => (
    <>
      <div style={s.card}>
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 24 }}>
          <div style={s.avatar}>{iniciales(perfil.nombre, perfil.apellido)}</div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#fff" }}>
              {perfil.nombre || perfil.apellido ? `${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim() : "Sin nombre"}
            </div>
            <div style={{ color: "var(--gfi-text-muted)", fontSize: 13, marginTop: 4 }}>{perfil.cargo ?? "Corredor"}</div>
          </div>
        </div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Nombre</label>
            <input style={s.input} value={perfil.nombre ?? ""} onChange={(e) => setPerfil((p) => ({ ...p, nombre: e.target.value }))} placeholder="Tu nombre" />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Apellido</label>
            <input style={s.input} value={perfil.apellido ?? ""} onChange={(e) => setPerfil((p) => ({ ...p, apellido: e.target.value }))} placeholder="Tu apellido" />
          </div>
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Email</label>
          <input style={s.inputReadonly} value={perfil.email ?? ""} readOnly />
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Teléfono / WhatsApp</label>
          <input style={s.input} value={perfil.telefono ?? ""} onChange={(e) => setPerfil((p) => ({ ...p, telefono: e.target.value }))} placeholder="+54 11 0000-0000" />
        </div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Matrícula CUCICBA/CMCPSI</label>
            <input style={s.input} value={perfil.matricula ?? ""} onChange={(e) => setPerfil((p) => ({ ...p, matricula: e.target.value }))} placeholder="N° matrícula" />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Cargo</label>
            <select style={s.select} value={perfil.cargo ?? ""} onChange={(e) => setPerfil((p) => ({ ...p, cargo: e.target.value }))}>
              <option value="">Seleccionar…</option>
              <option value="Corredor">Corredor</option>
              <option value="Asesor">Asesor</option>
              <option value="Broker">Broker</option>
              <option value="Dueño">Dueño</option>
              <option value="Gerente">Gerente</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Inmobiliaria / Agencia</label>
          <input style={s.input} value={perfil.inmobiliaria ?? ""} onChange={(e) => setPerfil((p) => ({ ...p, inmobiliaria: e.target.value }))} placeholder="Nombre de la inmobiliaria" />
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Zona de trabajo principal</label>
          <input style={s.input} value={perfil.zona_trabajo ?? ""} onChange={(e) => setPerfil((p) => ({ ...p, zona_trabajo: e.target.value }))} placeholder="Ej: Palermo, Belgrano..." />
        </div>

        <button style={s.btn} onClick={guardarPerfil}>Guardar perfil</button>
      </div>
    </>
  );

  // ── Tab: Preferencias ─────────────────────────────────────────────────────────

  const TabPreferencias = () => (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Operaciones</div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Tipo de cambio default (USD)</label>
            <input
              style={s.input}
              type="number"
              min={0}
              value={config.tipoCambioDefault}
              onChange={(e) => setConfig((c) => ({ ...c, tipoCambioDefault: Number(e.target.value) }))}
            />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Moneda default</label>
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              <button style={s.monedaToggle(config.monedaDefault === "USD")} onClick={() => setConfig((c) => ({ ...c, monedaDefault: "USD" }))}>USD</button>
              <button style={s.monedaToggle(config.monedaDefault === "ARS")} onClick={() => setConfig((c) => ({ ...c, monedaDefault: "ARS" }))}>ARS</button>
            </div>
          </div>
        </div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Honorarios default (%)</label>
            <input
              style={s.input}
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={config.honorariosDefault}
              onChange={(e) => setConfig((c) => ({ ...c, honorariosDefault: Number(e.target.value) }))}
            />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Split default (%)</label>
            <input
              style={s.input}
              type="number"
              min={0}
              max={100}
              step={1}
              value={config.splitDefault}
              onChange={(e) => setConfig((c) => ({ ...c, splitDefault: Number(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Comunicaciones</div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Firma de email</label>
          <textarea
            style={s.textarea}
            value={config.firmaEmail}
            onChange={(e) => setConfig((c) => ({ ...c, firmaEmail: e.target.value }))}
            placeholder="Tu firma personalizada para emails..."
            rows={4}
          />
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Template WhatsApp</label>
          <textarea
            style={s.textarea}
            value={config.whatsappTemplate}
            onChange={(e) => setConfig((c) => ({ ...c, whatsappTemplate: e.target.value }))}
            placeholder="Hola {nombre}, te contacto de {inmobiliaria}..."
            rows={3}
          />
          <div style={{ color: "var(--gfi-text-muted)", fontSize: 11, marginTop: 6 }}>
            Variables: {"{nombre}"}, {"{apellido}"}, {"{inmobiliaria}"}, {"{cargo}"}
          </div>
        </div>

        {config.firmaEmail && (
          <div style={s.fieldWrap}>
            <div style={{ ...s.sectionTitle, marginBottom: 10 }}>Tu firma aparecerá así:</div>
            <div style={s.previewCard}>
              <div style={{ whiteSpace: "pre-wrap" }}>{config.firmaEmail}</div>
            </div>
          </div>
        )}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Zonas de trabajo</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            style={{ ...s.input, flex: 1 }}
            value={zonaInput}
            onChange={(e) => setZonaInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarZona(); } }}
            placeholder="Escribir zona y presionar Enter…"
          />
          <button style={s.btn} onClick={agregarZona}>+</button>
        </div>
        {config.zonasTrabajo.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {config.zonasTrabajo.map((z) => (
              <span key={z} style={s.tag}>
                {z}
                <span style={s.tagX} onClick={() => quitarZona(z)}>×</span>
              </span>
            ))}
          </div>
        )}
        {config.zonasTrabajo.length === 0 && (
          <div style={{ color: "var(--gfi-text-dim)", fontSize: 13 }}>Sin zonas agregadas aún.</div>
        )}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Alertas</div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Alertas habilitadas</div>
            <div style={{ color: "var(--gfi-text-muted)", fontSize: 12 }}>Recibir notificaciones de vencimientos</div>
          </div>
          <div
            style={s.toggle(config.alertasHabilitadas)}
            onClick={() => setConfig((c) => ({ ...c, alertasHabilitadas: !c.alertasHabilitadas }))}
          >
            <div style={s.toggleTrack(config.alertasHabilitadas)}>
              <div style={s.toggleThumb(config.alertasHabilitadas)} />
            </div>
          </div>
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Días antes del vencimiento para alertar</label>
          <input
            style={s.input}
            type="number"
            min={1}
            max={365}
            value={config.diasAlertaVencimiento}
            onChange={(e) => setConfig((c) => ({ ...c, diasAlertaVencimiento: Number(e.target.value) }))}
          />
        </div>
      </div>

      <button style={s.btn} onClick={guardarPreferencias}>Guardar preferencias</button>
    </>
  );

  // ── Tab: Datos de la agencia ──────────────────────────────────────────────────

  const TabAgencia = () => (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Datos de la agencia</div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Nombre de la agencia</label>
          <input style={s.input} value={agencia.nombre} onChange={(e) => setAgencia((a) => ({ ...a, nombre: e.target.value }))} placeholder="Inmobiliaria Ejemplo" />
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Dirección</label>
          <input style={s.input} value={agencia.direccion} onChange={(e) => setAgencia((a) => ({ ...a, direccion: e.target.value }))} placeholder="Av. Corrientes 1234, CABA" />
        </div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Teléfono central</label>
            <input style={s.input} value={agencia.telefonoCentral} onChange={(e) => setAgencia((a) => ({ ...a, telefonoCentral: e.target.value }))} placeholder="+54 11 0000-0000" />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Email agencia</label>
            <input style={s.input} value={agencia.emailAgencia} onChange={(e) => setAgencia((a) => ({ ...a, emailAgencia: e.target.value }))} placeholder="info@ejemplo.com.ar" />
          </div>
        </div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Sitio web</label>
            <input style={s.input} value={agencia.web} onChange={(e) => setAgencia((a) => ({ ...a, web: e.target.value }))} placeholder="www.ejemplo.com.ar" />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>CUIT</label>
            <input style={s.input} value={agencia.cuit} onChange={(e) => setAgencia((a) => ({ ...a, cuit: e.target.value }))} placeholder="30-00000000-0" />
          </div>
        </div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Matrícula agencia</label>
            <input style={s.input} value={agencia.matriculaAgencia} onChange={(e) => setAgencia((a) => ({ ...a, matriculaAgencia: e.target.value }))} placeholder="N° matrícula" />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>URL del logo</label>
            <input style={s.input} value={agencia.logoUrl} onChange={(e) => setAgencia((a) => ({ ...a, logoUrl: e.target.value }))} placeholder="https://..." />
          </div>
        </div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Color primario</label>
            <div style={s.colorPickerWrap}>
              <input
                type="color"
                style={s.colorInput}
                value={agencia.colorPrimario}
                onChange={(e) => setAgencia((a) => ({ ...a, colorPrimario: e.target.value }))}
              />
              <div style={s.colorPreview(agencia.colorPrimario)} />
              <span style={{ color: "var(--gfi-text-secondary)", fontSize: 13 }}>{agencia.colorPrimario}</span>
            </div>
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Color secundario</label>
            <div style={s.colorPickerWrap}>
              <input
                type="color"
                style={s.colorInput}
                value={agencia.colorSecundario}
                onChange={(e) => setAgencia((a) => ({ ...a, colorSecundario: e.target.value }))}
              />
              <div style={s.colorPreview(agencia.colorSecundario)} />
              <span style={{ color: "var(--gfi-text-secondary)", fontSize: 13 }}>{agencia.colorSecundario}</span>
            </div>
          </div>
        </div>

        <button style={s.btn} onClick={guardarAgencia}>Guardar datos de agencia</button>
      </div>

      {/* Preview tarjeta */}
      <div style={s.card}>
        <div style={s.cardTitle}>Preview — Tarjeta de presentación</div>
        <div
          style={{
            background: agencia.colorPrimario,
            borderRadius: 12,
            padding: "24px 28px",
            color: "#fff",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -20,
              right: -20,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "var(--gfi-border)",
            }}
          />
          {agencia.logoUrl && (
            <img
              src={agencia.logoUrl}
              alt="Logo"
              style={{ height: 36, marginBottom: 12, objectFit: "contain" }}
            />
          )}
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, marginBottom: 4 }}>
            {agencia.nombre || "Nombre de la agencia"}
          </div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>{agencia.matriculaAgencia ? `Mat. ${agencia.matriculaAgencia}` : ""}</div>
          <div style={{ borderTop: "1px solid var(--gfi-text-dim)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {agencia.direccion && <div style={{ fontSize: 12, opacity: 0.85 }}>📍 {agencia.direccion}</div>}
            {agencia.telefonoCentral && <div style={{ fontSize: 12, opacity: 0.85 }}>📞 {agencia.telefonoCentral}</div>}
            {agencia.emailAgencia && <div style={{ fontSize: 12, opacity: 0.85 }}>✉ {agencia.emailAgencia}</div>}
            {agencia.web && <div style={{ fontSize: 12, opacity: 0.85 }}>🌐 {agencia.web}</div>}
            {agencia.cuit && <div style={{ fontSize: 12, opacity: 0.75 }}>CUIT: {agencia.cuit}</div>}
          </div>
        </div>

        {/* Corredor preview dentro */}
        {(perfil.nombre || perfil.apellido) && (
          <div
            style={{
              marginTop: 12,
              background: agencia.colorSecundario || "var(--gfi-bg-secondary)",
              border: "1px solid var(--gfi-border)",
              borderRadius: 10,
              padding: "16px 20px",
              display: "flex",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div style={{ ...s.avatar, width: 44, height: 44, fontSize: 16 }}>{iniciales(perfil.nombre, perfil.apellido)}</div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#fff" }}>
                {`${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim()}
              </div>
              <div style={{ color: "var(--gfi-text-secondary)", fontSize: 12 }}>{perfil.cargo ?? ""}</div>
              {perfil.telefono && <div style={{ color: "var(--gfi-text-secondary)", fontSize: 12 }}>{perfil.telefono}</div>}
            </div>
          </div>
        )}
      </div>
    </>
  );

  // ── Tab: Cuenta ───────────────────────────────────────────────────────────────

  const TabCuenta = () => (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Información de cuenta</div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Email</label>
          <input style={s.inputReadonly} value={perfil.email ?? ""} readOnly />
        </div>

        <div style={s.row2}>
          <div style={s.fieldWrap}>
            <label style={s.label}>Fecha de registro</label>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, paddingTop: 8 }}>{fmtFecha(perfil.created_at)}</div>
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Plan actual</label>
            <div style={{ paddingTop: 6 }}>
              <span style={s.badge}>Plan Gratuito</span>
            </div>
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>Datos y privacidad</div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 16 }}>
          Todos tus datos locales (preferencias, agencia, etc.) están guardados en este dispositivo.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button style={s.btnSecondary} onClick={exportarDatos}>
            Exportar mis datos
          </button>
          <button style={s.btnDanger} onClick={limpiarDatos}>
            Limpiar datos locales
          </button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>Sesión</div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 16 }}>
          Al cerrar sesión deberás ingresar nuevamente con tus credenciales.
        </div>
        <button style={s.btnDanger} onClick={cerrarSesion}>Cerrar sesión</button>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  const TABS: { id: TabId; label: string }[] = [
    { id: "perfil", label: "Mi Perfil" },
    { id: "preferencias", label: "Preferencias CRM" },
    { id: "agencia", label: "Datos de la agencia" },
    { id: "cuenta", label: "Cuenta" },
  ];

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Configuración</h1>
      <p style={s.subtitle}>Personalizá tu perfil, preferencias y datos de la agencia.</p>

      <div style={s.tabBar}>
        {TABS.map((t) => (
          <button key={t.id} style={s.tabPill(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "perfil" && <TabPerfil />}
      {tab === "preferencias" && <TabPreferencias />}
      {tab === "agencia" && <TabAgencia />}
      {tab === "cuenta" && <TabCuenta />}

      {toast && (
        <div style={s.toastBox(toast.tipo)}>
          {toast.tipo === "ok" ? "✓ " : "✗ "}{toast.msg}
        </div>
      )}
    </div>
  );
}
