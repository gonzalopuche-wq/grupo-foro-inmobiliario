"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  fecha_nacimiento: string | null; // "YYYY-MM-DD"
  tipo: string | null;
  estado: string | null;
}

interface Felicitado {
  contactoId: string;
  anio: number;
  fecha: string;
}

interface ConfigLocal {
  agencia: string;
  firma: string;
}

interface Plantillas {
  whatsapp: string;
  email_asunto: string;
  email_cuerpo: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANTILLAS_DEFAULT: Plantillas = {
  whatsapp:
    "¡Hola {nombre}! 🎂 Desde {agencia} te deseamos un muy feliz cumpleaños. Que sea un día especial y que el próximo año esté lleno de alegrías. ¡Saludos! {firma}",
  email_asunto: "¡Feliz cumpleaños, {nombre}!",
  email_cuerpo:
    "Estimado/a {nombre},\n\nEn este día especial, todo el equipo de {agencia} te desea un muy feliz cumpleaños.\n\nQue este nuevo año esté lleno de logros y alegrías.\n\nSaludos cordiales,\n{firma}",
};

const CONFIG_DEFAULT: ConfigLocal = {
  agencia: "[Nombre Agencia]",
  firma: "[Tu nombre]",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function proximoCumple(fn: string): Date {
  const hoy = new Date();
  const [, mes, dia] = fn.split("-").map(Number);
  const este = new Date(hoy.getFullYear(), mes - 1, dia);
  if (este < hoy && !(este.getMonth() === hoy.getMonth() && este.getDate() === hoy.getDate())) {
    este.setFullYear(hoy.getFullYear() + 1);
  }
  return este;
}

function diasParaCumple(fn: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const proximo = proximoCumple(fn);
  proximo.setHours(0, 0, 0, 0);
  return Math.round((proximo.getTime() - hoy.getTime()) / 86400000);
}

function edad(fn: string): number {
  const hoy = new Date();
  const nac = new Date(fn);
  let e = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
  return e;
}

function edadQueVaCumplir(fn: string): number {
  const dias = diasParaCumple(fn);
  const e = edad(fn);
  return dias === 0 ? e : e + 1;
}

function esCumpleHoy(fn: string): boolean {
  const hoy = new Date();
  const [, mes, dia] = fn.split("-").map(Number);
  return hoy.getMonth() + 1 === mes && hoy.getDate() === dia;
}

function iniciales(nombre: string, apellido: string): string {
  return `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase();
}

function resolverPlantilla(
  texto: string,
  contacto: Contacto,
  config: ConfigLocal
): string {
  const e = contacto.fecha_nacimiento ? edadQueVaCumplir(contacto.fecha_nacimiento) : 0;
  return texto
    .replace(/\{nombre\}/g, contacto.nombre)
    .replace(/\{apellido\}/g, contacto.apellido)
    .replace(/\{edad\}/g, String(e))
    .replace(/\{agencia\}/g, config.agencia)
    .replace(/\{firma\}/g, config.firma);
}

function mesLabel(mes: number): string {
  return ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][mes];
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes + 1, 0).getDate();
}

function primerDiaSemana(anio: number, mes: number): number {
  const d = new Date(anio, mes, 1).getDay();
  return d === 0 ? 6 : d - 1; // lunes = 0
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ nombre, apellido }: { nombre: string; apellido: string }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #990000, #880000)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Montserrat, sans-serif",
        fontWeight: 700,
        fontSize: 16,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {iniciales(nombre, apellido)}
    </div>
  );
}

function DiasBadge({ dias }: { dias: number }) {
  const color = dias === 0 ? "#990000" : dias < 7 ? "#990000" : dias < 30 ? "#d4960c" : "#4ade80";
  const label = dias === 0 ? "¡HOY!" : dias === 1 ? "mañana" : `${dias}d`;
  return (
    <span
      style={{
        background: color,
        color: "#fff",
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "Montserrat, sans-serif",
        minWidth: 48,
        textAlign: "center",
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}

function TipoChip({ tipo }: { tipo: string | null }) {
  if (!tipo) return null;
  return (
    <span
      style={{
        background: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.7)",
        borderRadius: 999,
        padding: "1px 8px",
        fontSize: 11,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {tipo}
    </span>
  );
}

// ─── Calendar Month ───────────────────────────────────────────────────────────

function CalendarioMes({
  anio,
  mes,
  contactosPorDia,
  esActual,
}: {
  anio: number;
  mes: number;
  contactosPorDia: Record<number, Contacto[]>;
  esActual: boolean;
}) {
  const [tooltip, setTooltip] = useState<{ dia: number; x: number; y: number } | null>(null);
  const totalDias = diasEnMes(anio, mes);
  const offset = primerDiaSemana(anio, mes);
  const semanas: (number | null)[][] = [];
  let semana: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= totalDias; d++) {
    semana.push(d);
    if (semana.length === 7) { semanas.push(semana); semana = []; }
  }
  if (semana.length > 0) semanas.push([...semana, ...Array(7 - semana.length).fill(null)]);

  return (
    <div
      style={{
        background: esActual ? "rgba(153,0,0,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${esActual ? "#990000" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12,
        padding: "12px 10px",
        position: "relative",
      }}
    >
      <div
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          color: esActual ? "#990000" : "rgba(255,255,255,0.7)",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        {mesLabel(mes)}
      </div>
      {/* Header días */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif" }}>
            {d}
          </div>
        ))}
      </div>
      {/* Grid días */}
      {semanas.map((sem, si) => (
        <div key={si} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {sem.map((dia, di) => {
            const tieneCumple = dia !== null && contactosPorDia[dia] && contactosPorDia[dia].length > 0;
            const hoy = new Date();
            const esHoy = esActual && dia === hoy.getDate();
            return (
              <div
                key={di}
                style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 2 }}
                onMouseEnter={tieneCumple && dia !== null ? (e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTooltip({ dia, x: rect.left, y: rect.bottom });
                } : undefined}
                onMouseLeave={tieneCumple ? () => setTooltip(null) : undefined}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: esHoy ? "#990000" : dia === null ? "transparent" : "rgba(255,255,255,0.5)",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: esHoy ? 700 : 400,
                  }}
                >
                  {dia ?? "·"}
                </span>
                {tieneCumple && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#990000",
                      display: "inline-block",
                      cursor: "pointer",
                      boxShadow: "0 0 4px #990000",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
      {/* Tooltip inline */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a1a",
            border: "1px solid rgba(153,0,0,0.5)",
            borderRadius: 8,
            padding: "6px 10px",
            zIndex: 100,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            maxWidth: 200,
          }}
        >
          {contactosPorDia[tooltip.dia]?.map((c) => (
            <div
              key={c.id}
              style={{ fontSize: 12, color: "#fff", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}
            >
              🎂 {c.nombre} {c.apellido}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampanaCumpleanosPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [totalContactos, setTotalContactos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"proximos" | "calendario" | "config">("proximos");
  const [filtroProximos, setFiltroProximos] = useState<"semana" | "mes" | "tres_meses" | "todos">("semana");
  const [busqueda, setBusqueda] = useState("");
  const [felicitados, setFelicitados] = useState<Felicitado[]>([]);
  const [plantillas, setPlantillas] = useState<Plantillas>(PLANTILLAS_DEFAULT);
  const [config, setConfig] = useState<ConfigLocal>(CONFIG_DEFAULT);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [editandoPlantilla, setEditandoPlantilla] = useState<keyof Plantillas | null>(null);

  const anioActual = new Date().getFullYear();

  // ── Cargar datos ──────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const [{ data: conFecha }, { count }, { data: campanaRow }] = await Promise.all([
        supabase
          .from("crm_contactos")
          .select("id,nombre,apellido,telefono,email,fecha_nacimiento,tipo,estado")
          .eq("perfil_id", userId)
          .not("fecha_nacimiento", "is", null)
          .order("nombre"),
        supabase.from("crm_contactos").select("id", { count: "exact", head: true }).eq("perfil_id", userId),
        supabase
          .from("crm_campana_cumpleanos")
          .select("config, felicitados, plantillas")
          .eq("perfil_id", userId)
          .maybeSingle(),
      ]);
      setContactos((conFecha ?? []) as Contacto[]);
      setTotalContactos(count ?? 0);
      if (campanaRow) {
        if (campanaRow.felicitados && Array.isArray(campanaRow.felicitados)) setFelicitados(campanaRow.felicitados as Felicitado[]);
        if (campanaRow.plantillas && typeof campanaRow.plantillas === "object" && !Array.isArray(campanaRow.plantillas)) setPlantillas(campanaRow.plantillas as Plantillas);
        if (campanaRow.config && typeof campanaRow.config === "object" && !Array.isArray(campanaRow.config)) setConfig(campanaRow.config as ConfigLocal);
      }
      setLoading(false);
    });
  }, []);

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const cumpleHoy = useMemo(
    () => contactos.filter((c) => c.fecha_nacimiento && esCumpleHoy(c.fecha_nacimiento)),
    [contactos]
  );

  const cumpleSemana = useMemo(
    () => contactos.filter((c) => c.fecha_nacimiento && diasParaCumple(c.fecha_nacimiento) <= 7),
    [contactos]
  );

  const cumpleMes = useMemo(
    () => contactos.filter((c) => c.fecha_nacimiento && diasParaCumple(c.fecha_nacimiento) <= 30),
    [contactos]
  );

  const pctConFecha = useMemo(
    () => (totalContactos > 0 ? Math.round((contactos.length / totalContactos) * 100) : 0),
    [contactos.length, totalContactos]
  );

  const contactosFiltrados = useMemo(() => {
    let lista = contactos.filter((c) => c.fecha_nacimiento);
    lista = lista.sort((a, b) => {
      const da = diasParaCumple(a.fecha_nacimiento!);
      const db = diasParaCumple(b.fecha_nacimiento!);
      return da - db;
    });
    if (filtroProximos === "semana") lista = lista.filter((c) => diasParaCumple(c.fecha_nacimiento!) <= 7);
    else if (filtroProximos === "mes") lista = lista.filter((c) => diasParaCumple(c.fecha_nacimiento!) <= 30);
    else if (filtroProximos === "tres_meses") lista = lista.filter((c) => diasParaCumple(c.fecha_nacimiento!) <= 90);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter((c) =>
        `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
        (c.telefono ?? "").includes(q)
      );
    }
    return lista;
  }, [contactos, filtroProximos, busqueda]);

  // Calendario: cumpleaños por mes y día (mes = 0..11)
  const cumplePorMesYDia = useMemo(() => {
    const mapa: Record<number, Record<number, Contacto[]>> = {};
    for (let m = 0; m < 12; m++) mapa[m] = {};
    for (const c of contactos) {
      if (!c.fecha_nacimiento) continue;
      const [, mes, dia] = c.fecha_nacimiento.split("-").map(Number);
      const m = mes - 1;
      if (!mapa[m][dia]) mapa[m][dia] = [];
      mapa[m][dia].push(c);
    }
    return mapa;
  }, [contactos]);

  const felicitadosEsteAnio = useMemo(
    () => felicitados.filter((f) => f.anio === anioActual),
    [felicitados, anioActual]
  );

  const esFelicitado = (id: string) =>
    felicitadosEsteAnio.some((f) => f.contactoId === id);

  // ── Supabase save helper ──────────────────────────────────────────────────

  const guardarSB = useCallback(
    (data: { config?: ConfigLocal; felicitados?: Felicitado[]; plantillas?: Plantillas }) => {
      if (!uid) return;
      const payload: Record<string, unknown> = { perfil_id: uid, updated_at: new Date().toISOString() };
      if (data.config !== undefined) payload.config = data.config;
      if (data.felicitados !== undefined) payload.felicitados = data.felicitados;
      if (data.plantillas !== undefined) payload.plantillas = data.plantillas;
      supabase.from("crm_campana_cumpleanos").upsert(payload, { onConflict: "perfil_id" }).then(() => {});
    },
    [uid]
  );

  // ── Acciones ──────────────────────────────────────────────────────────────

  const marcarFelicitado = (id: string) => {
    const nuevo: Felicitado = {
      contactoId: id,
      anio: anioActual,
      fecha: new Date().toISOString(),
    };
    const actualizado = [...felicitados.filter((f) => !(f.contactoId === id && f.anio === anioActual)), nuevo];
    setFelicitados(actualizado);
    guardarSB({ felicitados: actualizado });
  };

  const desmarcarFelicitado = (id: string) => {
    const actualizado = felicitados.filter((f) => !(f.contactoId === id && f.anio === anioActual));
    setFelicitados(actualizado);
    guardarSB({ felicitados: actualizado });
  };

  const copiarMensaje = async (c: Contacto) => {
    const msg = resolverPlantilla(plantillas.whatsapp, c, config);
    await navigator.clipboard.writeText(msg);
    setCopiadoId(c.id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const abrirWhatsApp = (c: Contacto) => {
    if (!c.telefono) return;
    const tel = c.telefono.replace(/\D/g, "");
    const msg = resolverPlantilla(plantillas.whatsapp, c, config);
    window.open(`https://wa.me/54${tel}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const abrirEmail = (c: Contacto) => {
    if (!c.email) return;
    const asunto = resolverPlantilla(plantillas.email_asunto, c, config);
    const cuerpo = resolverPlantilla(plantillas.email_cuerpo, c, config);
    window.open(`mailto:${c.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`);
  };

  const guardarPlantillas = (p: Plantillas) => {
    setPlantillas(p);
    guardarSB({ plantillas: p });
  };

  const guardarConfig = (c: ConfigLocal) => {
    setConfig(c);
    guardarSB({ config: c });
  };

  // ── Estilos base ──────────────────────────────────────────────────────────

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "Inter, sans-serif",
      padding: "24px 20px 60px",
      maxWidth: 960,
      margin: "0 auto",
    } as React.CSSProperties,

    heading: {
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 800,
    } as React.CSSProperties,

    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: 20,
    } as React.CSSProperties,

    btn: (variant: "primary" | "ghost" | "danger" | "success") => ({
      border: "none",
      borderRadius: 8,
      padding: "7px 14px",
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      fontWeight: 600,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      ...(variant === "primary" && { background: "#990000", color: "#fff" }),
      ...(variant === "ghost" && { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)" }),
      ...(variant === "danger" && { background: "rgba(153,0,0,0.15)", color: "#990000", border: "1px solid rgba(153,0,0,0.3)" }),
      ...(variant === "success" && { background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }),
    } as React.CSSProperties),

    input: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "8px 12px",
      color: "#fff",
      fontFamily: "Inter, sans-serif",
      fontSize: 14,
      width: "100%",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,

    textarea: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "10px 12px",
      color: "#fff",
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      width: "100%",
      boxSizing: "border-box" as const,
      resize: "vertical" as const,
      lineHeight: 1.6,
    } as React.CSSProperties,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}>Cargando contactos...</div>
      </div>
    );
  }

  const mesActual = new Date().getMonth();

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ ...s.heading, fontSize: 26, margin: 0, marginBottom: 6, color: "#fff" }}>
          🎂 Campaña de Cumpleaños
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, margin: 0 }}>
          Felicitá a tus contactos en su día y fortalecé la relación
        </p>
      </div>

      {/* Banner cumpleaños HOY */}
      {cumpleHoy.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(153,0,0,0.18) 0%, rgba(136,0,0,0.10) 100%)",
            border: "1px solid rgba(153,0,0,0.6)",
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            boxShadow: "0 0 32px rgba(153,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>🎉</span>
            <div>
              <div style={{ ...s.heading, fontSize: 18, color: "#fff" }}>
                ¡Hay {cumpleHoy.length} cumpleaños hoy!
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                No olvides felicitarlos
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cumpleHoy.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  flexWrap: "wrap",
                }}
              >
                <Avatar nombre={c.nombre} apellido={c.apellido} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#fff" }}>
                    {c.nombre} {c.apellido}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    Cumple {c.fecha_nacimiento ? edadQueVaCumplir(c.fecha_nacimiento) : ""} años hoy
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {c.telefono && (
                    <button style={s.btn("primary")} onClick={() => abrirWhatsApp(c)}>
                      📱 WhatsApp
                    </button>
                  )}
                  {c.email && (
                    <button style={s.btn("ghost")} onClick={() => abrirEmail(c)}>
                      ✉️ Email
                    </button>
                  )}
                  <button style={s.btn("ghost")} onClick={() => copiarMensaje(c)}>
                    {copiadoId === c.id ? "✅ Copiado" : "📋 Copiar"}
                  </button>
                  {!esFelicitado(c.id) ? (
                    <button style={s.btn("success")} onClick={() => marcarFelicitado(c.id)}>
                      ✓ Marcar felicitado
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                      ✅ Felicitado
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          {
            label: "Cumpleaños hoy",
            value: cumpleHoy.length,
            color: cumpleHoy.length > 0 ? "#990000" : "rgba(255,255,255,0.7)",
            icon: "🎂",
          },
          { label: "Esta semana", value: cumpleSemana.length, color: "rgba(255,255,255,0.7)", icon: "📅" },
          { label: "Este mes", value: cumpleMes.length, color: "rgba(255,255,255,0.7)", icon: "🗓️" },
          { label: "Fechas registradas", value: `${pctConFecha}%`, color: pctConFecha < 50 ? "#d4960c" : "#4ade80", icon: "📊" },
        ].map((kpi) => (
          <div key={kpi.label} style={s.card}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{kpi.icon}</div>
            <div
              style={{
                ...s.heading,
                fontSize: 28,
                color: kpi.color,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {kpi.value}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Alerta fechas faltantes */}
      {pctConFecha < 70 && (
        <div
          style={{
            background: "rgba(234,179,8,0.08)",
            border: "1px solid rgba(234,179,8,0.25)",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 24,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: "#d4960c", fontFamily: "Montserrat, sans-serif", fontSize: 14, marginBottom: 4 }}>
              {100 - pctConFecha}% de tus contactos no tienen fecha de nacimiento
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
              Completar las fechas de nacimiento te permite automatizar felicitaciones, fortalecer vínculos y diferenciarte de la competencia.
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
          width: "fit-content",
        }}
      >
        {(
          [
            { id: "proximos", label: "Próximos cumpleaños" },
            { id: "calendario", label: "Calendario" },
            { id: "config", label: "Configuración" },
          ] as { id: typeof tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              background: tab === t.id ? "#990000" : "transparent",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.5)",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Próximos ─────────────────────────────────────────────────── */}
      {tab === "proximos" && (
        <div>
          {/* Filtros */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {(
                [
                  { id: "semana", label: "7 días" },
                  { id: "mes", label: "30 días" },
                  { id: "tres_meses", label: "3 meses" },
                  { id: "todos", label: "Todos" },
                ] as { id: typeof filtroProximos; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroProximos(f.id)}
                  style={{
                    border: `1px solid ${filtroProximos === f.id ? "#990000" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    background: filtroProximos === f.id ? "rgba(153,0,0,0.15)" : "transparent",
                    color: filtroProximos === f.id ? "#990000" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Buscar contacto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ ...s.input, maxWidth: 220 }}
            />
          </div>

          {/* Lista */}
          {contactosFiltrados.length === 0 ? (
            <div
              style={{
                ...s.card,
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                padding: 40,
              }}
            >
              Sin cumpleaños en el período seleccionado
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {contactosFiltrados.map((c) => {
                const dias = diasParaCumple(c.fecha_nacimiento!);
                const felicitado = esFelicitado(c.id);
                return (
                  <div
                    key={c.id}
                    style={{
                      ...s.card,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      flexWrap: "wrap",
                      opacity: felicitado ? 0.65 : 1,
                      borderColor: dias === 0 ? "rgba(153,0,0,0.4)" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Avatar nombre={c.nombre} apellido={c.apellido} />
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>
                          {c.nombre} {c.apellido}
                        </span>
                        <TipoChip tipo={c.tipo} />
                        {felicitado && (
                          <span style={{ fontSize: 11, color: "#4ade80" }}>✓ felicitado</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                        {c.fecha_nacimiento
                          ? `Cumple ${edadQueVaCumplir(c.fecha_nacimiento)} años · ${new Date(c.fecha_nacimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`
                          : ""}
                      </div>
                    </div>
                    <DiasBadge dias={dias} />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {c.telefono && (
                        <button
                          style={s.btn("primary")}
                          title="Abrir WhatsApp"
                          onClick={() => abrirWhatsApp(c)}
                        >
                          📱
                        </button>
                      )}
                      <button
                        style={s.btn("ghost")}
                        title="Copiar mensaje"
                        onClick={() => copiarMensaje(c)}
                      >
                        {copiadoId === c.id ? "✅" : "📋"}
                      </button>
                      {c.email && (
                        <button
                          style={s.btn("ghost")}
                          title="Enviar email"
                          onClick={() => abrirEmail(c)}
                        >
                          ✉️
                        </button>
                      )}
                      {felicitado ? (
                        <button
                          style={s.btn("danger")}
                          title="Desmarcar felicitado"
                          onClick={() => desmarcarFelicitado(c.id)}
                        >
                          ✗
                        </button>
                      ) : (
                        <button
                          style={s.btn("success")}
                          title="Marcar como felicitado"
                          onClick={() => marcarFelicitado(c.id)}
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Calendario ───────────────────────────────────────────────── */}
      {tab === "calendario" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i).map((mes) => (
              <CalendarioMes
                key={mes}
                anio={anioActual}
                mes={mes}
                contactosPorDia={cumplePorMesYDia[mes]}
                esActual={mes === mesActual}
              />
            ))}
          </div>

          {contactos.length === 0 && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", marginTop: 24 }}>
              No hay contactos con fecha de nacimiento registrada
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Configuración ────────────────────────────────────────────── */}
      {tab === "config" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Config agencia */}
          <div style={s.card}>
            <h3 style={{ ...s.heading, fontSize: 16, margin: "0 0 16px", color: "#fff" }}>
              Datos de la agencia
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>
                  Nombre de la agencia
                </label>
                <input
                  type="text"
                  value={config.agencia}
                  onChange={(e) => guardarConfig({ ...config, agencia: e.target.value })}
                  style={s.input}
                  placeholder="Ej: Grupo Foro Inmobiliario"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>
                  Firma / Corredor
                </label>
                <input
                  type="text"
                  value={config.firma}
                  onChange={(e) => guardarConfig({ ...config, firma: e.target.value })}
                  style={s.input}
                  placeholder="Ej: María García"
                />
              </div>
            </div>
          </div>

          {/* Plantilla WhatsApp */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ ...s.heading, fontSize: 16, margin: 0, color: "#fff" }}>
                📱 Plantilla WhatsApp
              </h3>
              <button
                style={s.btn("ghost")}
                onClick={() =>
                  setEditandoPlantilla(editandoPlantilla === "whatsapp" ? null : "whatsapp")
                }
              >
                {editandoPlantilla === "whatsapp" ? "Cerrar" : "Editar"}
              </button>
            </div>
            {editandoPlantilla === "whatsapp" ? (
              <div>
                <textarea
                  rows={5}
                  value={plantillas.whatsapp}
                  onChange={(e) => guardarPlantillas({ ...plantillas, whatsapp: e.target.value })}
                  style={s.textarea}
                />
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
                  Variables: <code style={{ color: "#990000" }}>{"{nombre}"}</code>,{" "}
                  <code style={{ color: "#990000" }}>{"{apellido}"}</code>,{" "}
                  <code style={{ color: "#990000" }}>{"{edad}"}</code>,{" "}
                  <code style={{ color: "#990000" }}>{"{agencia}"}</code>,{" "}
                  <code style={{ color: "#990000" }}>{"{firma}"}</code>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {plantillas.whatsapp}
              </div>
            )}
            {/* Preview */}
            {contactos.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
                  Preview con {contactos[0].nombre}:
                </div>
                <div
                  style={{
                    background: "rgba(37,211,102,0.07)",
                    border: "1px solid rgba(37,211,102,0.2)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.7)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {resolverPlantilla(plantillas.whatsapp, contactos[0], config)}
                </div>
              </div>
            )}
          </div>

          {/* Plantilla Email */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ ...s.heading, fontSize: 16, margin: 0, color: "#fff" }}>
                ✉️ Plantilla Email
              </h3>
              <button
                style={s.btn("ghost")}
                onClick={() =>
                  setEditandoPlantilla(editandoPlantilla === "email_asunto" ? null : "email_asunto")
                }
              >
                {editandoPlantilla === "email_asunto" ? "Cerrar" : "Editar"}
              </button>
            </div>
            {editandoPlantilla === "email_asunto" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>
                    Asunto
                  </label>
                  <input
                    type="text"
                    value={plantillas.email_asunto}
                    onChange={(e) => guardarPlantillas({ ...plantillas, email_asunto: e.target.value })}
                    style={s.input}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>
                    Cuerpo
                  </label>
                  <textarea
                    rows={7}
                    value={plantillas.email_cuerpo}
                    onChange={(e) => guardarPlantillas({ ...plantillas, email_cuerpo: e.target.value })}
                    style={s.textarea}
                  />
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                  Variables: <code style={{ color: "#990000" }}>{"{nombre}"}</code>,{" "}
                  <code style={{ color: "#990000" }}>{"{apellido}"}</code>,{" "}
                  <code style={{ color: "#990000" }}>{"{edad}"}</code>,{" "}
                  <code style={{ color: "#990000" }}>{"{agencia}"}</code>,{" "}
                  <code style={{ color: "#990000" }}>{"{firma}"}</code>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  Asunto:{" "}
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{plantillas.email_asunto}</span>
                </div>
                <div
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {plantillas.email_cuerpo}
                </div>
              </div>
            )}
            {/* Preview email */}
            {contactos.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
                  Preview con {contactos[0].nombre}:
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.7)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Asunto: {resolverPlantilla(plantillas.email_asunto, contactos[0], config)}
                  </div>
                  {resolverPlantilla(plantillas.email_cuerpo, contactos[0], config)}
                </div>
              </div>
            )}
          </div>

          {/* Historial de felicitaciones */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ ...s.heading, fontSize: 16, margin: 0, color: "#fff" }}>
                Historial {anioActual}
              </h3>
              {felicitadosEsteAnio.length > 0 && (
                <button
                  style={s.btn("danger")}
                  onClick={() => {
                    const resto = felicitados.filter((f) => f.anio !== anioActual);
                    setFelicitados(resto);
                    guardarSB({ felicitados: resto });
                  }}
                >
                  Limpiar historial
                </button>
              )}
            </div>
            {felicitadosEsteAnio.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                Aún no marcaste ningún contacto como felicitado este año.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {felicitadosEsteAnio.map((f) => {
                  const c = contactos.find((ct) => ct.id === f.contactoId);
                  return (
                    <div
                      key={f.contactoId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "rgba(74,222,128,0.05)",
                        border: "1px solid rgba(74,222,128,0.15)",
                        borderRadius: 8,
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#4ade80", fontSize: 16 }}>✅</span>
                        <span style={{ fontSize: 14, color: "#fff" }}>
                          {c ? `${c.nombre} ${c.apellido}` : f.contactoId}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                          {new Date(f.fecha).toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <button
                          style={s.btn("danger")}
                          onClick={() => desmarcarFelicitado(f.contactoId)}
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Restaurar defaults */}
          <div>
            <button
              style={s.btn("ghost")}
              onClick={() => {
                guardarPlantillas(PLANTILLAS_DEFAULT);
                setEditandoPlantilla(null);
              }}
            >
              Restaurar plantillas por defecto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
