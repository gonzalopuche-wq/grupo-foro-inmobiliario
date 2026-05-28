"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────

type TipoContacto = "llamada" | "whatsapp" | "email" | "visita" | "aniversario" | "felicitacion";
type EstadoSeguimiento = "activo" | "pausado" | "completado" | "sin_respuesta";

interface ContactoPost {
  id: string;
  fecha: string;
  tipo: TipoContacto;
  descripcion: string;
  resultado: "positivo" | "neutro" | "negativo" | "sin_respuesta";
  generaReferido: boolean;
  notas: string;
}

interface SeguimientoPost {
  id: string;
  negocioId: string;
  clienteNombre: string;
  clienteRol: "comprador" | "vendedor" | "inquilino" | "propietario";
  clienteTelefono: string;
  clienteEmail: string;
  tipoOperacion: string;
  direccionInmueble: string;
  fechaCierre: string;
  estado: EstadoSeguimiento;
  nps: number | null;
  generaReferido: boolean;
  referidoNombre: string;
  contactos: ContactoPost[];
  proximoContacto: string | null;
  notas: string;
  createdAt: string;
}

interface NegocioCerrado {
  id: string;
  titulo: string;
  tipo_operacion: string;
  fecha_cierre: string | null;
  etapa: string;
}

// ── constantes ────────────────────────────────────────────────────────────────

const TIPO_CONTACTO_LABELS: Record<TipoContacto, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  email: "Email",
  visita: "Visita",
  aniversario: "Aniversario",
  felicitacion: "Felicitación",
};

const TIPO_CONTACTO_ICONS: Record<TipoContacto, string> = {
  llamada: "📞",
  whatsapp: "💬",
  email: "✉️",
  visita: "🏠",
  aniversario: "🎂",
  felicitacion: "🎉",
};

const ESTADO_CONFIG: Record<EstadoSeguimiento, { label: string; color: string; bg: string }> = {
  activo:        { label: "Activo",        color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  pausado:       { label: "Pausado",       color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  completado:    { label: "Completado",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  sin_respuesta: { label: "Sin respuesta", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
};

const ROL_LABELS: Record<SeguimientoPost["clienteRol"], string> = {
  comprador:   "Comprador",
  vendedor:    "Vendedor",
  inquilino:   "Inquilino",
  propietario: "Propietario",
};

const RESULTADO_CONFIG: Record<ContactoPost["resultado"], { label: string; color: string }> = {
  positivo:     { label: "Positivo",     color: "#22c55e" },
  neutro:       { label: "Neutro",       color: "#6b7280" },
  negativo:     { label: "Negativo",     color: "#cc0000" },
  sin_respuesta: { label: "Sin respuesta", color: "#f97316" },
};

// ── utilidades ────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

function fmtFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtFechaMes(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function npsColor(nps: number): string {
  if (nps >= 8) return "#22c55e";
  if (nps >= 6) return "#eab308";
  return "#cc0000";
}

function diasHasta(fecha: string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
}

// ── estado nuevo contacto ─────────────────────────────────────────────────────

function nuevoContactoVacio(): Omit<ContactoPost, "id"> {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    tipo: "llamada",
    descripcion: "",
    resultado: "neutro",
    generaReferido: false,
    notas: "",
  };
}

// ── estado nuevo seguimiento ──────────────────────────────────────────────────

function nuevoSeguimientoVacio(): Omit<SeguimientoPost, "id" | "createdAt"> {
  return {
    negocioId: "",
    clienteNombre: "",
    clienteRol: "comprador",
    clienteTelefono: "",
    clienteEmail: "",
    tipoOperacion: "venta",
    direccionInmueble: "",
    fechaCierre: new Date().toISOString().slice(0, 10),
    estado: "activo",
    nps: null,
    generaReferido: false,
    referidoNombre: "",
    contactos: [],
    proximoContacto: null,
    notas: "",
  };
}

// ── componente principal ──────────────────────────────────────────────────────

export default function SeguimientoPostVentaPage() {
  const [seguimientos, setSeguimientos] = useState<SeguimientoPost[]>([]);
  const [negocios, setNegocios] = useState<NegocioCerrado[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"lista" | "calendario" | "analytics">("lista");

  // lista
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoSeguimiento>("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [nuevoContactoForm, setNuevoContactoForm] = useState<Record<string, Omit<ContactoPost, "id">>>({});
  const [npsLocal, setNpsLocal] = useState<Record<string, number>>({});
  const [proxContactoLocal, setProxContactoLocal] = useState<Record<string, string>>({});

  // modal nuevo seguimiento
  const [modalAbierto, setModalAbierto] = useState(false);
  const [draftSeg, setDraftSeg] = useState<Omit<SeguimientoPost, "id" | "createdAt">>(nuevoSeguimientoVacio());

  const ahora = useMemo(() => new Date(), []);

  // ── carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_seguimiento_post_venta")
        .select("seguimientos")
        .eq("perfil_id", userId)
        .maybeSingle();
      if (row?.seguimientos && Array.isArray(row.seguimientos)) {
        setSeguimientos(row.seguimientos as SeguimientoPost[]);
      }
      const { data: negData } = await supabase
        .from("crm_negocios")
        .select("id,titulo,tipo_operacion,fecha_cierre,etapa")
        .eq("etapa", "cerrado")
        .order("fecha_cierre", { ascending: false })
        .limit(100);
      setNegocios((negData ?? []) as NegocioCerrado[]);
      setLoading(false);
    });
  }, []);

  // ── persistencia ──────────────────────────────────────────────────────────

  const guardarSB = useCallback((items: SeguimientoPost[]) => {
    if (!uid) return;
    supabase.from("crm_seguimiento_post_venta").upsert(
      { perfil_id: uid, seguimientos: items, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id" }
    ).then(() => {});
  }, [uid]);

  const persistir = useCallback((lista: SeguimientoPost[]) => {
    setSeguimientos(lista);
    guardarSB(lista);
  }, [guardarSB]);

  // ── kpis ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const activos = seguimientos.filter(s => s.estado === "activo").length;

    const conNps = seguimientos.filter(s => s.nps !== null);
    const npsPromedio = conNps.length > 0
      ? Math.round((conNps.reduce((acc, s) => acc + (s.nps ?? 0), 0) / conNps.length) * 10) / 10
      : null;

    const referidos = seguimientos.filter(s => s.generaReferido).length;

    const enSieteDias = seguimientos.filter(s => {
      if (!s.proximoContacto) return false;
      const diff = diasHasta(s.proximoContacto);
      return diff >= 0 && diff <= 7;
    }).length;

    return { activos, npsPromedio, referidos, enSieteDias };
  }, [seguimientos]);

  // ── alertas ───────────────────────────────────────────────────────────────

  const alertas = useMemo(() => {
    const vencidos: SeguimientoPost[] = [];
    const aniversarios: SeguimientoPost[] = [];

    seguimientos.forEach(s => {
      if (s.proximoContacto && diasHasta(s.proximoContacto) < 0 && s.estado === "activo") {
        vencidos.push(s);
      }
      const cierre = new Date(s.fechaCierre);
      for (let anio = 1; anio <= 10; anio++) {
        const anivFecha = new Date(cierre);
        anivFecha.setFullYear(anivFecha.getFullYear() + anio);
        const diffDias = Math.ceil((anivFecha.getTime() - ahora.getTime()) / 86400000);
        if (diffDias >= -3 && diffDias <= 7) {
          aniversarios.push(s);
          break;
        }
      }
    });

    return { vencidos, aniversarios };
  }, [seguimientos, ahora]);

  // ── filtrado ──────────────────────────────────────────────────────────────

  const filtrados = useMemo(() => {
    return seguimientos.filter(s => {
      if (filtroEstado !== "todos" && s.estado !== filtroEstado) return false;
      if (filtroTipo !== "todos" && s.tipoOperacion !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (
          !s.clienteNombre.toLowerCase().includes(q) &&
          !s.direccionInmueble.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [seguimientos, filtroEstado, filtroTipo, busqueda]);

  const tiposOperacion = useMemo(() => {
    const set = new Set(seguimientos.map(s => s.tipoOperacion));
    return Array.from(set);
  }, [seguimientos]);

  // ── acciones ──────────────────────────────────────────────────────────────

  const toggleExpandido = (id: string) => {
    setExpandido(prev => {
      if (prev === id) return null;
      const seg = seguimientos.find(s => s.id === id);
      if (seg) {
        setNpsLocal(n => ({ ...n, [id]: seg.nps ?? 7 }));
        setProxContactoLocal(p => ({ ...p, [id]: seg.proximoContacto ?? "" }));
        if (!nuevoContactoForm[id]) {
          setNuevoContactoForm(f => ({ ...f, [id]: nuevoContactoVacio() }));
        }
      }
      return id;
    });
  };

  const agregarContacto = (segId: string) => {
    const form = nuevoContactoForm[segId];
    if (!form || !form.descripcion.trim()) return;

    const nuevoC: ContactoPost = { id: genId(),...form };
    const lista = seguimientos.map(s => {
      if (s.id !== segId) return s;
      const generaRef = s.generaReferido || nuevoC.generaReferido;
      return {
        ...s,
        contactos: [nuevoC, ...s.contactos],
        generaReferido: generaRef,
        nps: npsLocal[segId] !== undefined ? npsLocal[segId] : s.nps,
        proximoContacto: proxContactoLocal[segId] || s.proximoContacto,
      };
    });
    persistir(lista);
    setNuevoContactoForm(f => ({ ...f, [segId]: nuevoContactoVacio() }));
  };

  const actualizarNpsYProximo = (segId: string) => {
    const lista = seguimientos.map(s => {
      if (s.id !== segId) return s;
      return {
        ...s,
        nps: npsLocal[segId] !== undefined ? npsLocal[segId] : s.nps,
        proximoContacto: proxContactoLocal[segId] || s.proximoContacto,
      };
    });
    persistir(lista);
  };

  const cambiarEstado = (segId: string, estado: EstadoSeguimiento) => {
    persistir(seguimientos.map(s => s.id === segId ? { ...s, estado } : s));
  };

  const toggleReferido = (segId: string) => {
    persistir(seguimientos.map(s => s.id === segId ? { ...s, generaReferido: !s.generaReferido } : s));
  };

  const guardarNuevoSeguimiento = () => {
    if (!draftSeg.clienteNombre.trim()) return;
    const nuevo: SeguimientoPost = {
      id: genId(),
      createdAt: new Date().toISOString(),
      ...draftSeg,
    };
    persistir([nuevo, ...seguimientos]);
    setModalAbierto(false);
    setDraftSeg(nuevoSeguimientoVacio());
  };

  const eliminarSeguimiento = (segId: string) => {
    persistir(seguimientos.filter(s => s.id !== segId));
    setExpandido(null);
  };

  // ── calendar data ─────────────────────────────────────────────────────────

  const semanas = useMemo(() => {
    const lunes = startOfWeek(ahora);
    const result: Date[][] = [];
    for (let w = 0; w < 4; w++) {
      const semana: Date[] = [];
      for (let d = 0; d < 7; d++) {
        semana.push(addDays(lunes, w * 7 + d));
      }
      result.push(semana);
    }
    return result;
  }, [ahora]);

  const eventosPorDia = useMemo(() => {
    const map: Record<string, { tipo: "contacto" | "aniversario"; label: string; color: string }[]> = {};

    seguimientos.forEach(s => {
      if (s.proximoContacto) {
        const d = new Date(s.proximoContacto);
        const key = d.toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push({ tipo: "contacto", label: s.clienteNombre, color: "#cc0000" });
      }

      const cierre = new Date(s.fechaCierre);
      for (let anio = 1; anio <= 10; anio++) {
        const anivFecha = new Date(cierre);
        anivFecha.setFullYear(anivFecha.getFullYear() + anio);
        semanas.flat().forEach(dia => {
          if (isSameDay(dia, anivFecha)) {
            const key = dia.toISOString().slice(0, 10);
            if (!map[key]) map[key] = [];
            map[key].push({ tipo: "aniversario", label: `${anio}° aniv. ${s.clienteNombre}`, color: "#3b82f6" });
          }
        });
      }
    });

    return map;
  }, [seguimientos, semanas]);

  // ── analytics ─────────────────────────────────────────────────────────────

  const analytics = useMemo(() => {
    // NPS distribution
    const npsDist: Record<string, number> = { "0-6": 0, "7-8": 0, "9-10": 0 };
    seguimientos.forEach(s => {
      if (s.nps === null) return;
      if (s.nps <= 6) npsDist["0-6"]++;
      else if (s.nps <= 8) npsDist["7-8"]++;
      else npsDist["9-10"]++;
    });

    // Tasa de respuesta por tipo
    const tiposContacto: TipoContacto[] = ["llamada", "whatsapp", "email"];
    const tasaRespuesta: Record<string, { total: number; respuestas: number }> = {};
    tiposContacto.forEach(t => { tasaRespuesta[t] = { total: 0, respuestas: 0 }; });
    seguimientos.forEach(s => {
      s.contactos.forEach(c => {
        if (tiposContacto.includes(c.tipo)) {
          tasaRespuesta[c.tipo].total++;
          if (c.resultado !== "sin_respuesta") tasaRespuesta[c.tipo].respuestas++;
        }
      });
    });

    // Referidos por mes (últimos 6 meses)
    const meses: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
      let count = 0;
      seguimientos.forEach(s => {
        s.contactos.forEach(c => {
          if (c.generaReferido && c.fecha.startsWith(key)) count++;
        });
      });
      meses.push({ label, count });
    }

    // Sin contacto > 90 días
    const sinContacto90: SeguimientoPost[] = seguimientos.filter(s => {
      if (s.estado !== "activo") return false;
      if (s.contactos.length === 0) return diasDesde(s.fechaCierre) > 90;
      const ultimo = s.contactos[0].fecha;
      return diasDesde(ultimo) > 90;
    });

    return { npsDist, tasaRespuesta, meses, sinContacto90 };
  }, [seguimientos, ahora]);

  const maxReferidosMes = useMemo(() =>
    Math.max(1, ...analytics.meses.map(m => m.count)),
  [analytics.meses]);

  // ── render ────────────────────────────────────────────────────────────────

  const S = styles;

  return (
    <div style={S.page}>
      {/* encabezado */}
      <div style={S.header}>
        <div>
          <h1 style={S.titulo}>Seguimiento Post-Venta</h1>
          <p style={S.subtitulo}>Mantené el vínculo con clientes después del cierre para generar referidos y fidelización</p>
        </div>
        <button style={S.btnPrimario} onClick={() => setModalAbierto(true)}>
          + Nuevo seguimiento
        </button>
      </div>

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <KpiCard titulo="En seguimiento activo" valor={String(kpis.activos)} color="#cc0000" />
        <KpiCard
          titulo="NPS promedio"
          valor={kpis.npsPromedio !== null ? String(kpis.npsPromedio) : "—"}
          color={kpis.npsPromedio !== null ? npsColor(kpis.npsPromedio) : "#6b7280"}
          subtitulo={kpis.npsPromedio !== null
            ? kpis.npsPromedio >= 8 ? "Promotores" : kpis.npsPromedio >= 6 ? "Pasivos" : "Detractores"
            : "Sin datos"}
        />
        <KpiCard titulo="Referidos generados" valor={String(kpis.referidos)} color="#22c55e" />
        <KpiCard titulo="Contactos próx. 7 días" valor={String(kpis.enSieteDias)} color="#3b82f6" />
      </div>

      {/* alertas */}
      {(alertas.vencidos.length > 0 || alertas.aniversarios.length > 0) && (
        <div style={S.alertasContainer}>
          {alertas.vencidos.length > 0 && (
            <div style={{ ...S.alertaItem, borderColor: "#cc0000" }}>
              <span style={S.alertaIcon}>⚠️</span>
              <span style={S.alertaTexto}>
                <strong style={{ color: "#cc0000" }}>{alertas.vencidos.length} seguimiento{alertas.vencidos.length > 1 ? "s" : ""}</strong>
                {" "}con contacto programado vencido:{" "}
                {alertas.vencidos.slice(0, 3).map(s => s.clienteNombre).join(", ")}
                {alertas.vencidos.length > 3 && ` y ${alertas.vencidos.length - 3} más`}
              </span>
            </div>
          )}
          {alertas.aniversarios.length > 0 && (
            <div style={{ ...S.alertaItem, borderColor: "#3b82f6" }}>
              <span style={S.alertaIcon}>🎂</span>
              <span style={S.alertaTexto}>
                <strong style={{ color: "#3b82f6" }}>{alertas.aniversarios.length} aniversario{alertas.aniversarios.length > 1 ? "s" : ""}</strong>
                {" "}esta semana:{" "}
                {alertas.aniversarios.slice(0, 3).map(s => s.clienteNombre).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* tabs */}
      <div style={S.tabsBar}>
        {(["lista", "calendario", "analytics"] as const).map(t => (
          <button
            key={t}
            style={{ ...S.tab, ...(activeTab === t ? S.tabActivo : {}) }}
            onClick={() => setActiveTab(t)}
          >
            {t === "lista" ? "Seguimientos" : t === "calendario" ? "Calendario" : "Analytics"}
          </button>
        ))}
      </div>

      {/* ── TAB: LISTA ─────────────────────────────────────────────────────── */}
      {activeTab === "lista" && (
        <div>
          {/* filtros */}
          <div style={S.filtrosRow}>
            <input
              style={S.input}
              placeholder="Buscar por nombre o dirección..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <select
              style={S.select}
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as "todos" | EstadoSeguimiento)}
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="completado">Completado</option>
              <option value="sin_respuesta">Sin respuesta</option>
            </select>
            <select
              style={S.select}
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todos los tipos</option>
              {tiposOperacion.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {loading && <p style={S.empty}>Cargando...</p>}
          {!loading && filtrados.length === 0 && (
            <p style={S.empty}>No hay seguimientos. Creá el primero con "+ Nuevo seguimiento".</p>
          )}

          {filtrados.map(seg => {
            const isOpen = expandido === seg.id;
            const cfg = ESTADO_CONFIG[seg.estado];
            const diasCierre = diasDesde(seg.fechaCierre);
            const ultimoContacto = seg.contactos[0] ?? null;
            const diasUltimo = ultimoContacto ? diasDesde(ultimoContacto.fecha) : null;
            const formC = nuevoContactoForm[seg.id] ?? nuevoContactoVacio();

            return (
              <div key={seg.id} style={S.segCard}>
                {/* cabecera card */}
                <div style={S.segCardHeader} onClick={() => toggleExpandido(seg.id)}>
                  <div style={S.segCardInfo}>
                    <div style={S.segNombre}>{seg.clienteNombre}</div>
                    <div style={S.segMeta}>
                      <span style={S.segRol}>{ROL_LABELS[seg.clienteRol]}</span>
                      <span style={S.metaSep}>·</span>
                      <span>{seg.tipoOperacion}</span>
                      <span style={S.metaSep}>·</span>
                      <span>{seg.direccionInmueble || "Sin dirección"}</span>
                    </div>
                    <div style={S.segMeta}>
                      <span>Cierre: {fmtFecha(seg.fechaCierre)}</span>
                      <span style={S.metaSep}>·</span>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>{diasCierre}d desde cierre</span>
                      {diasUltimo !== null && (
                        <>
                          <span style={S.metaSep}>·</span>
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>
                            Último contacto hace {diasUltimo}d
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={S.segCardChips}>
                    <span style={{ ...S.chip, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                    {seg.nps !== null && (
                      <span style={{ ...S.chip, color: npsColor(seg.nps), background: "rgba(0,0,0,0.3)" }}>
                        NPS {seg.nps}
                      </span>
                    )}
                    {seg.generaReferido && (
                      <span style={{ ...S.chip, color: "#22c55e", background: "rgba(34,197,94,0.12)" }}>
                        Referido
                      </span>
                    )}
                    <button style={S.btnSecundario} onClick={e => { e.stopPropagation(); }}>
                      Contactar
                    </button>
                    <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* panel expandido */}
                {isOpen && (
                  <div style={S.panelExpandido}>
                    {/* info + controles */}
                    <div style={S.panelGrid}>
                      {/* columna izq: info + timeline */}
                      <div>
                        <div style={S.panelSeccion}>
                          <div style={S.panelSectionTitle}>Datos del cliente</div>
                          <div style={S.infoGrid}>
                            {seg.clienteTelefono && (
                              <div style={S.infoItem}><span style={S.infoLabel}>Teléfono</span><span>{seg.clienteTelefono}</span></div>
                            )}
                            {seg.clienteEmail && (
                              <div style={S.infoItem}><span style={S.infoLabel}>Email</span><span>{seg.clienteEmail}</span></div>
                            )}
                            <div style={S.infoItem}><span style={S.infoLabel}>Inmueble</span><span>{seg.direccionInmueble || "—"}</span></div>
                            <div style={S.infoItem}><span style={S.infoLabel}>Operación</span><span>{seg.tipoOperacion}</span></div>
                          </div>
                          {seg.notas && <p style={S.notasTexto}>{seg.notas}</p>}
                        </div>

                        {/* timeline */}
                        <div style={S.panelSeccion}>
                          <div style={S.panelSectionTitle}>Historial de contactos</div>
                          {seg.contactos.length === 0 && (
                            <p style={S.empty}>Sin contactos aún.</p>
                          )}
                          {seg.contactos.map(c => {
                            const resCfg = RESULTADO_CONFIG[c.resultado];
                            return (
                              <div key={c.id} style={S.timelineItem}>
                                <div style={S.timelineIcono}>{TIPO_CONTACTO_ICONS[c.tipo]}</div>
                                <div style={S.timelineBody}>
                                  <div style={S.timelineHeader}>
                                    <span style={S.timelineTipo}>{TIPO_CONTACTO_LABELS[c.tipo]}</span>
                                    <span style={{ color: resCfg.color, fontSize: 11 }}>{resCfg.label}</span>
                                    {c.generaReferido && <span style={{ color: "#22c55e", fontSize: 11 }}>· Referido</span>}
                                    <span style={S.timelineFecha}>{fmtFecha(c.fecha)}</span>
                                  </div>
                                  {c.descripcion && <p style={S.timelineDesc}>{c.descripcion}</p>}
                                  {c.notas && <p style={S.timelineNotas}>{c.notas}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* columna der: formulario nuevo contacto + controls */}
                      <div>
                        <div style={S.panelSeccion}>
                          <div style={S.panelSectionTitle}>Registrar nuevo contacto</div>
                          <div style={S.formGrid}>
                            <div style={S.formField}>
                              <label style={S.label}>Fecha</label>
                              <input
                                type="date"
                                style={S.input}
                                value={formC.fecha}
                                onChange={e => setNuevoContactoForm(f => ({
                                  ...f, [seg.id]: { ...formC, fecha: e.target.value }
                                }))}
                              />
                            </div>
                            <div style={S.formField}>
                              <label style={S.label}>Tipo</label>
                              <select
                                style={S.select}
                                value={formC.tipo}
                                onChange={e => setNuevoContactoForm(f => ({
                                  ...f, [seg.id]: { ...formC, tipo: e.target.value as TipoContacto }
                                }))}
                              >
                                {(["llamada", "whatsapp", "email", "visita", "aniversario", "felicitacion"] as TipoContacto[]).map(t => (
                                  <option key={t} value={t}>{TIPO_CONTACTO_LABELS[t]}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ ...S.formField, gridColumn: "1 / -1" }}>
                              <label style={S.label}>Descripción</label>
                              <textarea
                                style={{ ...S.input, height: 60, resize: "vertical" }}
                                value={formC.descripcion}
                                onChange={e => setNuevoContactoForm(f => ({
                                  ...f, [seg.id]: { ...formC, descripcion: e.target.value }
                                }))}
                                placeholder="Qué se habló, acordó o informó..."
                              />
                            </div>
                            <div style={S.formField}>
                              <label style={S.label}>Resultado</label>
                              <select
                                style={S.select}
                                value={formC.resultado}
                                onChange={e => setNuevoContactoForm(f => ({
                                  ...f, [seg.id]: { ...formC, resultado: e.target.value as ContactoPost["resultado"] }
                                }))}
                              >
                                <option value="positivo">Positivo</option>
                                <option value="neutro">Neutro</option>
                                <option value="negativo">Negativo</option>
                                <option value="sin_respuesta">Sin respuesta</option>
                              </select>
                            </div>
                            <div style={{ ...S.formField, gridColumn: "1 / -1" }}>
                              <label style={S.label}>Notas adicionales</label>
                              <input
                                style={S.input}
                                value={formC.notas}
                                onChange={e => setNuevoContactoForm(f => ({
                                  ...f, [seg.id]: { ...formC, notas: e.target.value }
                                }))}
                                placeholder="Notas opcionales..."
                              />
                            </div>
                            <div style={{ ...S.formField, gridColumn: "1 / -1" }}>
                              <label style={S.toggleLabel}>
                                <input
                                  type="checkbox"
                                  checked={formC.generaReferido}
                                  onChange={e => setNuevoContactoForm(f => ({
                                    ...f, [seg.id]: { ...formC, generaReferido: e.target.checked }
                                  }))}
                                  style={{ accentColor: "#cc0000" }}
                                />
                                Este contacto genera un referido
                              </label>
                            </div>
                          </div>
                          <button
                            style={S.btnPrimario}
                            onClick={() => agregarContacto(seg.id)}
                          >
                            Registrar contacto
                          </button>
                        </div>

                        {/* NPS + próximo contacto */}
                        <div style={S.panelSeccion}>
                          <div style={S.panelSectionTitle}>NPS y seguimiento</div>
                          <div style={S.formField}>
                            <label style={S.label}>
                              NPS: <strong style={{ color: npsColor(npsLocal[seg.id] ?? seg.nps ?? 7) }}>
                                {npsLocal[seg.id] ?? seg.nps ?? "—"}
                              </strong>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={10}
                              step={1}
                              value={npsLocal[seg.id] ?? seg.nps ?? 7}
                              onChange={e => setNpsLocal(n => ({ ...n, [seg.id]: Number(e.target.value) }))}
                              style={{ width: "100%", accentColor: npsColor(npsLocal[seg.id] ?? seg.nps ?? 7) }}
                            />
                            <div style={S.npsLabels}>
                              <span>0</span><span>5</span><span>10</span>
                            </div>
                          </div>
                          <div style={S.formField}>
                            <label style={S.label}>Próximo contacto programado</label>
                            <input
                              type="date"
                              style={S.input}
                              value={proxContactoLocal[seg.id] ?? seg.proximoContacto ?? ""}
                              onChange={e => setProxContactoLocal(p => ({ ...p, [seg.id]: e.target.value }))}
                            />
                          </div>
                          <div style={S.formField}>
                            <label style={S.label}>Estado del seguimiento</label>
                            <select
                              style={S.select}
                              value={seg.estado}
                              onChange={e => cambiarEstado(seg.id, e.target.value as EstadoSeguimiento)}
                            >
                              <option value="activo">Activo</option>
                              <option value="pausado">Pausado</option>
                              <option value="completado">Completado</option>
                              <option value="sin_respuesta">Sin respuesta</option>
                            </select>
                          </div>
                          <label style={S.toggleLabel}>
                            <input
                              type="checkbox"
                              checked={seg.generaReferido}
                              onChange={() => toggleReferido(seg.id)}
                              style={{ accentColor: "#22c55e" }}
                            />
                            Este cliente generó un referido
                          </label>
                          {seg.generaReferido && (
                            <input
                              style={{ ...S.input, marginTop: 8 }}
                              placeholder="Nombre del referido..."
                              value={seg.referidoNombre}
                              onChange={e => {
                                const val = e.target.value;
                                persistir(seguimientos.map(s => s.id === seg.id ? { ...s, referidoNombre: val } : s));
                              }}
                            />
                          )}
                          <button style={{ ...S.btnSecundario, marginTop: 12 }} onClick={() => actualizarNpsYProximo(seg.id)}>
                            Guardar cambios
                          </button>
                        </div>

                        {/* eliminar */}
                        <div style={{ textAlign: "right", marginTop: 8 }}>
                          <button
                            style={{ ...S.btnDanger }}
                            onClick={() => { if (confirm("¿Eliminar este seguimiento?")) eliminarSeguimiento(seg.id); }}
                          >
                            Eliminar seguimiento
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: CALENDARIO ────────────────────────────────────────────────── */}
      {activeTab === "calendario" && (
        <div>
          <div style={S.calLeyenda}>
            <span style={{ ...S.chip, background: "rgba(204,0,0,0.15)", color: "#cc0000" }}>● Contacto programado</span>
            <span style={{ ...S.chip, background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>● Aniversario</span>
          </div>
          <div style={S.calGrid}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
              <div key={d} style={S.calDiaHeader}>{d}</div>
            ))}
            {semanas.flat().map((dia, i) => {
              const key = dia.toISOString().slice(0, 10);
              const eventos = eventosPorDia[key] ?? [];
              const esHoy = isSameDay(dia, ahora);
              return (
                <div
                  key={i}
                  style={{
                    ...S.calCelda,
                    ...(esHoy ? S.calHoy : {}),
                  }}
                >
                  <div style={S.calDiaNum}>{dia.getDate()}</div>
                  {eventos.slice(0, 3).map((ev, j) => (
                    <div
                      key={j}
                      style={{
                        ...S.calEvento,
                        background: ev.color === "#cc0000" ? "rgba(204,0,0,0.18)" : "rgba(59,130,246,0.18)",
                        color: ev.color,
                      }}
                      title={ev.label}
                    >
                      {ev.label.length > 14 ? ev.label.slice(0, 13) + "…" : ev.label}
                    </div>
                  ))}
                  {eventos.length > 3 && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>+{eventos.length - 3}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB: ANALYTICS ─────────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div style={S.analyticsGrid}>
          {/* NPS Distribution */}
          <div style={S.analyticsCard}>
            <div style={S.analyticsTitle}>Distribución NPS</div>
            <svg viewBox="0 0 300 140" style={{ width: "100%", maxHeight: 160 }}>
              {[
                { label: "0–6\nDetractores", val: analytics.npsDist["0-6"], color: "#cc0000", x: 30 },
                { label: "7–8\nPasivos",     val: analytics.npsDist["7-8"], color: "#eab308", x: 130 },
                { label: "9–10\nPromotores", val: analytics.npsDist["9-10"], color: "#22c55e", x: 220 },
              ].map(({ label, val, color, x }) => {
                const total = Object.values(analytics.npsDist).reduce((a, b) => a + b, 0) || 1;
                const pct = val / total;
                const maxH = 80;
                const barH = Math.max(pct * maxH, val > 0 ? 4 : 0);
                const barY = 100 - barH;
                return (
                  <g key={x}>
                    <rect x={x} y={barY} width={60} height={barH} rx={4} fill={color} fillOpacity={0.8} />
                    <text x={x + 30} y={barY - 4} textAnchor="middle" fill={color} fontSize={12} fontWeight={700}>{val}</text>
                    {label.split("\n").map((line, li) => (
                      <text key={li} x={x + 30} y={112 + li * 14} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10}>{line}</text>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Tasa de respuesta */}
          <div style={S.analyticsCard}>
            <div style={S.analyticsTitle}>Tasa de respuesta por canal</div>
            {(["llamada", "whatsapp", "email"] as TipoContacto[]).map(tipo => {
              const { total, respuestas } = analytics.tasaRespuesta[tipo] ?? { total: 0, respuestas: 0 };
              const pct = total > 0 ? Math.round((respuestas / total) * 100) : 0;
              return (
                <div key={tipo} style={S.tasaRow}>
                  <span style={S.tasaLabel}>{TIPO_CONTACTO_ICONS[tipo]} {TIPO_CONTACTO_LABELS[tipo]}</span>
                  <div style={S.tasaBarOuter}>
                    <div style={{ ...S.tasaBarInner, width: `${pct}%` }} />
                  </div>
                  <span style={S.tasaPct}>{pct}%</span>
                  <span style={S.tasaTotal}>({total})</span>
                </div>
              );
            })}
          </div>

          {/* Referidos por mes */}
          <div style={S.analyticsCard}>
            <div style={S.analyticsTitle}>Referidos por mes (últimos 6 meses)</div>
            <svg viewBox="0 0 340 140" style={{ width: "100%", maxHeight: 160 }}>
              {analytics.meses.map(({ label, count }, i) => {
                const barW = 40;
                const gap = 17;
                const x = i * (barW + gap) + 10;
                const maxH = 80;
                const barH = Math.max((count / maxReferidosMes) * maxH, count > 0 ? 4 : 0);
                const barY = 95 - barH;
                return (
                  <g key={i}>
                    <rect x={x} y={barY} width={barW} height={barH} rx={4} fill="#cc0000" fillOpacity={0.8} />
                    {count > 0 && (
                      <text x={x + barW / 2} y={barY - 4} textAnchor="middle" fill="#cc0000" fontSize={11} fontWeight={700}>{count}</text>
                    )}
                    <text x={x + barW / 2} y={110} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={10}>{label}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Sin contacto > 90 días */}
          <div style={S.analyticsCard}>
            <div style={S.analyticsTitle}>Sin contacto hace más de 90 días</div>
            {analytics.sinContacto90.length === 0 && (
              <p style={S.empty}>Todos los seguimientos activos tienen contacto reciente.</p>
            )}
            {analytics.sinContacto90.map(s => {
              const diasUltimo = s.contactos[0]
                ? diasDesde(s.contactos[0].fecha)
                : diasDesde(s.fechaCierre);
              return (
                <div key={s.id} style={S.alertRow}>
                  <div>
                    <div style={S.alertNombre}>{s.clienteNombre}</div>
                    <div style={S.alertSub}>{s.direccionInmueble || s.tipoOperacion}</div>
                  </div>
                  <span style={{ color: "#cc0000", fontWeight: 700, fontSize: 13 }}>{diasUltimo}d sin contacto</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL NUEVO SEGUIMIENTO ─────────────────────────────────────────── */}
      {modalAbierto && (
        <div style={S.overlay} onClick={() => setModalAbierto(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitulo}>Nuevo seguimiento post-venta</h2>
              <button style={S.btnCerrar} onClick={() => setModalAbierto(false)}>✕</button>
            </div>

            <div style={S.modalBody}>
              {/* seleccionar negocio */}
              <div style={S.formField}>
                <label style={S.label}>Negocio cerrado (Supabase)</label>
                <select
                  style={S.select}
                  value={draftSeg.negocioId}
                  onChange={e => {
                    const neg = negocios.find(n => n.id === e.target.value);
                    setDraftSeg(d => ({
                      ...d,
                      negocioId: e.target.value,
                      tipoOperacion: neg?.tipo_operacion ?? d.tipoOperacion,
                      direccionInmueble: neg
                        ? (neg.titulo ?? "")
                        : d.direccionInmueble,
                      fechaCierre: neg?.fecha_cierre ?? d.fechaCierre,
                    }));
                  }}
                >
                  <option value="">— Seleccionar negocio (opcional) —</option>
                  {negocios.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.titulo} · {n.tipo_operacion ?? ""} · {n.fecha_cierre ? fmtFechaMes(n.fecha_cierre) : "sin fecha"}
                    </option>
                  ))}
                </select>
              </div>

              <div style={S.modalGrid}>
                <div style={S.formField}>
                  <label style={S.label}>Nombre del cliente *</label>
                  <input
                    style={S.input}
                    value={draftSeg.clienteNombre}
                    onChange={e => setDraftSeg(d => ({ ...d, clienteNombre: e.target.value }))}
                    placeholder="Nombre completo..."
                  />
                </div>
                <div style={S.formField}>
                  <label style={S.label}>Rol del cliente</label>
                  <select
                    style={S.select}
                    value={draftSeg.clienteRol}
                    onChange={e => setDraftSeg(d => ({ ...d, clienteRol: e.target.value as SeguimientoPost["clienteRol"] }))}
                  >
                    <option value="comprador">Comprador</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="inquilino">Inquilino</option>
                    <option value="propietario">Propietario</option>
                  </select>
                </div>
                <div style={S.formField}>
                  <label style={S.label}>Teléfono</label>
                  <input
                    style={S.input}
                    value={draftSeg.clienteTelefono}
                    onChange={e => setDraftSeg(d => ({ ...d, clienteTelefono: e.target.value }))}
                    placeholder="+54 9 11..."
                  />
                </div>
                <div style={S.formField}>
                  <label style={S.label}>Email</label>
                  <input
                    style={S.input}
                    value={draftSeg.clienteEmail}
                    onChange={e => setDraftSeg(d => ({ ...d, clienteEmail: e.target.value }))}
                    placeholder="cliente@email.com"
                  />
                </div>
                <div style={S.formField}>
                  <label style={S.label}>Tipo de operación</label>
                  <input
                    style={S.input}
                    value={draftSeg.tipoOperacion}
                    onChange={e => setDraftSeg(d => ({ ...d, tipoOperacion: e.target.value }))}
                    placeholder="venta, alquiler, etc."
                  />
                </div>
                <div style={S.formField}>
                  <label style={S.label}>Fecha de cierre</label>
                  <input
                    type="date"
                    style={S.input}
                    value={draftSeg.fechaCierre}
                    onChange={e => setDraftSeg(d => ({ ...d, fechaCierre: e.target.value }))}
                  />
                </div>
                <div style={{ ...S.formField, gridColumn: "1 / -1" }}>
                  <label style={S.label}>Dirección del inmueble</label>
                  <input
                    style={S.input}
                    value={draftSeg.direccionInmueble}
                    onChange={e => setDraftSeg(d => ({ ...d, direccionInmueble: e.target.value }))}
                    placeholder="Calle 1234, Barrio..."
                  />
                </div>
                <div style={{ ...S.formField, gridColumn: "1 / -1" }}>
                  <label style={S.label}>Notas iniciales</label>
                  <textarea
                    style={{ ...S.input, height: 60, resize: "vertical" }}
                    value={draftSeg.notas}
                    onChange={e => setDraftSeg(d => ({ ...d, notas: e.target.value }))}
                    placeholder="Notas sobre el cierre, particularidades del cliente..."
                  />
                </div>
                <div style={{ ...S.formField, gridColumn: "1 / -1" }}>
                  <label style={S.label}>Próximo contacto programado</label>
                  <input
                    type="date"
                    style={S.input}
                    value={draftSeg.proximoContacto ?? ""}
                    onChange={e => setDraftSeg(d => ({ ...d, proximoContacto: e.target.value || null }))}
                  />
                </div>
              </div>
            </div>

            <div style={S.modalFooter}>
              <button style={S.btnSecundario} onClick={() => setModalAbierto(false)}>Cancelar</button>
              <button
                style={{ ...S.btnPrimario, opacity: draftSeg.clienteNombre.trim() ? 1 : 0.5 }}
                onClick={guardarNuevoSeguimiento}
                disabled={!draftSeg.clienteNombre.trim()}
              >
                Crear seguimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── sub-componente KPI ────────────────────────────────────────────────────────

function KpiCard({ titulo, valor, color, subtitulo }: {
  titulo: string;
  valor: string;
  color: string;
  subtitulo?: string;
}) {
  return (
    <div style={{
      background: "#141414",
      border: "1px solid #1f1f1f",
      borderRadius: 10,
      padding: "18px 20px",
    }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
        {titulo}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "Montserrat, sans-serif", lineHeight: 1 }}>
        {valor}
      </div>
      {subtitulo && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
          {subtitulo}
        </div>
      )}
    </div>
  );
}

// ── estilos ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    background: "#0a0a0a",
    minHeight: "100vh",
    color: "#ffffff",
    fontFamily: "Inter, sans-serif",
    padding: "24px 20px",
    maxWidth: 1200,
    margin: "0 auto",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  titulo: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 26,
    color: "#ffffff",
    margin: 0,
  } as React.CSSProperties,

  subtitulo: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    margin: "4px 0 0",
  } as React.CSSProperties,

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 20,
  } as React.CSSProperties,

  alertasContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    marginBottom: 20,
  } as React.CSSProperties,

  alertaItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#141414",
    border: "1px solid",
    borderRadius: 8,
    padding: "10px 14px",
  } as React.CSSProperties,

  alertaIcon: {
    fontSize: 16,
    flexShrink: 0,
  } as React.CSSProperties,

  alertaTexto: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  } as React.CSSProperties,

  tabsBar: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid #1f1f1f",
    marginBottom: 20,
  } as React.CSSProperties,

  tab: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.45)",
    padding: "10px 18px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    borderBottom: "2px solid transparent",
    transition: "color 0.15s",
  } as React.CSSProperties,

  tabActivo: {
    color: "#ffffff",
    borderBottom: "2px solid #cc0000",
  } as React.CSSProperties,

  filtrosRow: {
    display: "flex",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  input: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    color: "#ffffff",
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  select: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    color: "#ffffff",
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    cursor: "pointer",
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  } as React.CSSProperties,

  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    cursor: "pointer",
  } as React.CSSProperties,

  empty: {
    textAlign: "center" as const,
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    padding: "24px 0",
  } as React.CSSProperties,

  segCard: {
    background: "#111111",
    border: "1px solid #1f1f1f",
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  } as React.CSSProperties,

  segCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    cursor: "pointer",
    gap: 12,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  segCardInfo: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  segNombre: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 15,
    color: "#ffffff",
    marginBottom: 3,
  } as React.CSSProperties,

  segMeta: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    alignItems: "center",
  } as React.CSSProperties,

  segRol: {
    color: "#cc0000",
    fontWeight: 600,
  } as React.CSSProperties,

  metaSep: {
    color: "rgba(255,255,255,0.2)",
  } as React.CSSProperties,

  segCardChips: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  chip: {
    display: "inline-block",
    borderRadius: 20,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.4,
  } as React.CSSProperties,

  panelExpandido: {
    borderTop: "1px solid #1f1f1f",
    padding: "20px 18px",
  } as React.CSSProperties,

  panelGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  } as React.CSSProperties,

  panelSeccion: {
    marginBottom: 20,
  } as React.CSSProperties,

  panelSectionTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: 10,
  } as React.CSSProperties,

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  } as React.CSSProperties,

  infoItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  } as React.CSSProperties,

  infoLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  } as React.CSSProperties,

  notasTexto: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    margin: "8px 0 0",
    fontStyle: "italic",
  } as React.CSSProperties,

  timelineItem: {
    display: "flex",
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "1px solid #1a1a1a",
  } as React.CSSProperties,

  timelineIcono: {
    fontSize: 18,
    flexShrink: 0,
    marginTop: 1,
  } as React.CSSProperties,

  timelineBody: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  timelineHeader: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap" as const,
    marginBottom: 3,
  } as React.CSSProperties,

  timelineTipo: {
    fontWeight: 600,
    fontSize: 12,
    color: "#ffffff",
  } as React.CSSProperties,

  timelineFecha: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginLeft: "auto",
  } as React.CSSProperties,

  timelineDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    margin: 0,
  } as React.CSSProperties,

  timelineNotas: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    margin: "3px 0 0",
    fontStyle: "italic",
  } as React.CSSProperties,

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 12,
  } as React.CSSProperties,

  formField: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  } as React.CSSProperties,

  npsLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  } as React.CSSProperties,

  btnPrimario: {
    background: "#cc0000",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "9px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,

  btnSecundario: {
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,

  btnDanger: {
    background: "transparent",
    color: "#cc0000",
    border: "1px solid rgba(204,0,0,0.3)",
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,

  // calendario
  calLeyenda: {
    display: "flex",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
  } as React.CSSProperties,

  calDiaHeader: {
    textAlign: "center" as const,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    padding: "6px 0",
    fontWeight: 600,
    letterSpacing: "0.04em",
  } as React.CSSProperties,

  calCelda: {
    background: "#111111",
    border: "1px solid #1a1a1a",
    borderRadius: 6,
    padding: "6px 5px",
    minHeight: 70,
  } as React.CSSProperties,

  calHoy: {
    border: "1px solid rgba(204,0,0,0.5)",
    background: "rgba(204,0,0,0.05)",
  } as React.CSSProperties,

  calDiaNum: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
    fontWeight: 600,
  } as React.CSSProperties,

  calEvento: {
    fontSize: 10,
    borderRadius: 3,
    padding: "2px 5px",
    marginBottom: 2,
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,

  // analytics
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  } as React.CSSProperties,

  analyticsCard: {
    background: "#111111",
    border: "1px solid #1f1f1f",
    borderRadius: 10,
    padding: "18px 20px",
  } as React.CSSProperties,

  analyticsTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 14,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,

  tasaRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  } as React.CSSProperties,

  tasaLabel: {
    width: 90,
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    flexShrink: 0,
  } as React.CSSProperties,

  tasaBarOuter: {
    flex: 1,
    height: 8,
    background: "#1f1f1f",
    borderRadius: 4,
    overflow: "hidden",
  } as React.CSSProperties,

  tasaBarInner: {
    height: "100%",
    background: "#cc0000",
    borderRadius: 4,
    transition: "width 0.3s",
  } as React.CSSProperties,

  tasaPct: {
    width: 36,
    fontSize: 12,
    color: "#ffffff",
    fontWeight: 600,
    textAlign: "right" as const,
  } as React.CSSProperties,

  tasaTotal: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    width: 28,
  } as React.CSSProperties,

  alertRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #1a1a1a",
  } as React.CSSProperties,

  alertNombre: {
    fontSize: 13,
    fontWeight: 600,
    color: "#ffffff",
  } as React.CSSProperties,

  alertSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  } as React.CSSProperties,

  // modal
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  } as React.CSSProperties,

  modal: {
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    width: "100%",
    maxWidth: 680,
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
  } as React.CSSProperties,

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 22px",
    borderBottom: "1px solid #1f1f1f",
  } as React.CSSProperties,

  modalTitulo: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 17,
    color: "#ffffff",
    margin: 0,
  } as React.CSSProperties,

  btnCerrar: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
  } as React.CSSProperties,

  modalBody: {
    padding: "20px 22px",
    overflowY: "auto" as const,
    flex: 1,
  } as React.CSSProperties,

  modalGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 12,
  } as React.CSSProperties,

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "14px 22px",
    borderTop: "1px solid #1f1f1f",
  } as React.CSSProperties,
};
