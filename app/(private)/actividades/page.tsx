"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type FiltroActivo = "todos" | "interacciones" | "tareas" | "contactos" | "negocios";

interface Interaccion {
  id: string;
  tipo: string;
  descripcion: string;
  created_at: string;
  crm_contactos: { nombre: string; apellido: string } | null;
}

interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_vencimiento: string | null;
  estado: string;
  prioridad: string | null;
  created_at: string;
  crm_contactos: { nombre: string; apellido: string } | null;
}

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  tipo: string | null;
  created_at: string;
}

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  updated_at: string;
}

type ItemFeed =
  | { kind: "interaccion"; date: string; data: Interaccion }
  | { kind: "tarea"; date: string; data: Tarea }
  | { kind: "contacto"; date: string; data: Contacto }
  | { kind: "negocio"; date: string; data: Negocio };

const TIPO_INT_LABELS: Record<string, string> = {
  llamada: "Llamada", email: "Email", reunion: "Reunión", whatsapp: "WhatsApp",
  visita: "Visita", nota: "Nota", otro: "Otro",
};

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  const ahora = new Date();
  const diff = Math.floor((ahora.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Ahora mismo";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtFechaVenc = (iso: string) => {
  const d = new Date(iso);
  const ahora = new Date();
  const diff = d.getTime() - ahora.getTime();
  const dias = Math.floor(diff / 86400000);
  if (dias < 0) return `Vencida (${Math.abs(dias)}d)`;
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
};

export default function ActividadesPage() {
  const router = useRouter();
  const [filtro, setFiltro] = useState<FiltroActivo>("todos");
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.push("/login"); return; }
      const uid = userData.user.id;

      try {
        const [ints, tareas, contactosRes, negociosRes] = await Promise.all([
          supabase.from("crm_interacciones").select("*, crm_contactos(nombre, apellido)").eq("perfil_id", uid).order("created_at", { ascending: false }).limit(20),
          supabase.from("crm_tareas").select("*, crm_contactos(nombre, apellido)").eq("perfil_id", uid).eq("estado", "pendiente").order("fecha_vencimiento", { ascending: true, nullsFirst: false }).limit(10),
          supabase.from("crm_contactos").select("id, nombre, apellido, tipo, created_at").eq("perfil_id", uid).order("created_at", { ascending: false }).limit(10),
          supabase.from("crm_negocios").select("id, titulo, etapa, updated_at").eq("perfil_id", uid).eq("archivado", false).order("updated_at", { ascending: false }).limit(10),
        ]);

        setInteracciones((ints.data as unknown as Interaccion[]) ?? []);
        setTareas((tareas.data as unknown as Tarea[]) ?? []);
        setContactos((contactosRes.data as unknown as Contacto[]) ?? []);
        setNegocios((negociosRes.data as unknown as Negocio[]) ?? []);
      } catch {
        setError("Error cargando actividades. Algunas tablas pueden no existir aún.");
      }

      setLoading(false);
    };
    cargar();
  }, []);

  const buildFeed = (): ItemFeed[] => {
    const items: ItemFeed[] = [];

    if (filtro === "todos" || filtro === "interacciones") {
      interacciones.forEach(i => items.push({ kind: "interaccion", date: i.created_at, data: i }));
    }
    if (filtro === "todos" || filtro === "tareas") {
      tareas.forEach(t => items.push({ kind: "tarea", date: t.fecha_vencimiento ?? t.created_at, data: t }));
    }
    if (filtro === "todos" || filtro === "contactos") {
      contactos.forEach(c => items.push({ kind: "contacto", date: c.created_at, data: c }));
    }
    if (filtro === "todos" || filtro === "negocios") {
      negocios.forEach(n => items.push({ kind: "negocio", date: n.updated_at, data: n }));
    }

    // Sort descending by date for all except tareas (which are ascending by vencimiento)
    if (filtro === "tareas") {
      return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const feed = buildFeed();

  const FILTROS: { key: FiltroActivo; label: string; icon: string; count: number }[] = [
    { key: "todos", label: "Todos", icon: "🔵", count: interacciones.length + tareas.length + contactos.length + negocios.length },
    { key: "interacciones", label: "Interacciones", icon: "💬", count: interacciones.length },
    { key: "tareas", label: "Tareas", icon: "✅", count: tareas.length },
    { key: "contactos", label: "Contactos", icon: "👤", count: contactos.length },
    { key: "negocios", label: "Negocios", icon: "🤝", count: negocios.length },
  ];

  return (
    <>
      <style>{`
        
        *, *::before, *::after { box-sizing: border-box; }
        .act-root { min-height: 100vh; background: #0a0a0a; color: #fff; font-family: var(--font-body); }
        .act-header { margin-bottom: 28px; }
        .act-title { font-family: var(--font-display); font-size: 24px; font-weight: 800; margin-bottom: 6px; }
        .act-title span { color: #990000; }
        .act-subtitle { font-size: 13px; color: var(--gfi-text-muted); }
        .act-layout { display: flex; gap: 24px; align-items: flex-start; }
        .act-sidebar { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 6px; position: sticky; top: 24px; }
        .act-sidebar-title { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gfi-text-dim); margin-bottom: 8px; padding: 0 2px; }
        .act-filter-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--gfi-bg-secondary); border: 1px solid var(--gfi-border-subtle); border-radius: 6px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--gfi-text-secondary); transition: all 0.15s; text-align: left; }
        .act-filter-btn:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.8); }
        .act-filter-btn.active { border-color: #990000; background: rgba(153,0,0,0.08); color: #fff; }
        .act-filter-count { margin-left: auto; font-size: 11px; font-weight: 700; font-family: var(--font-display); background: var(--gfi-border); padding: 2px 8px; border-radius: 10px; }
        .act-filter-btn.active .act-filter-count { background: rgba(153,0,0,0.25); }
        .act-feed { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
        .act-item { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; padding: 16px 20px; display: flex; gap: 14px; align-items: flex-start; transition: border-color 0.15s; }
        .act-item:hover { border-color: var(--gfi-border); }
        .act-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .act-icon-interaccion { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); }
        .act-icon-tarea { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.2); }
        .act-icon-contacto { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); }
        .act-icon-negocio { background: rgba(153,0,0,0.1); border: 1px solid rgba(153,0,0,0.2); }
        .act-body { flex: 1; min-width: 0; }
        .act-item-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
        .act-badge { font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; }
        .act-badge-interaccion { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; }
        .act-badge-tarea { background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.3); color: #d4960c; }
        .act-badge-contacto { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); color: #3abab6; }
        .act-badge-negocio { background: rgba(153,0,0,0.1); border: 1px solid rgba(153,0,0,0.25); color: #ff6666; }
        .act-item-title { font-size: 14px; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px; }
        .act-item-sub { font-size: 12px; color: var(--gfi-text-muted); margin-top: 3px; line-height: 1.4; }
        .act-item-desc { font-size: 12px; color: var(--gfi-text-secondary); margin-top: 4px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .act-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .act-date { font-size: 11px; color: var(--gfi-text-dim); white-space: nowrap; }
        .act-link { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(153,0,0,0.7); text-decoration: none; padding: 4px 10px; border: 1px solid rgba(153,0,0,0.2); border-radius: 4px; transition: all 0.15s; }
        .act-link:hover { color: #990000; border-color: rgba(153,0,0,0.5); background: rgba(153,0,0,0.06); }
        .act-empty { text-align: center; padding: 60px 20px; color: var(--gfi-text-dim); font-size: 14px; font-style: italic; }
        .act-loading { display: flex; align-items: center; justify-content: center; padding: 60px; }
        .act-spinner { width: 32px; height: 32px; border: 2px solid rgba(153,0,0,0.2); border-top-color: #990000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .act-venc-ok { color: #3abab6; font-size: 11px; font-weight: 600; }
        .act-venc-warn { color: #d4960c; font-size: 11px; font-weight: 600; }
        .act-venc-late { color: #ff4444; font-size: 11px; font-weight: 600; }
        @media (max-width: 768px) {
          .act-layout { flex-direction: column; }
          .act-sidebar { width: 100%; position: static; flex-direction: row; flex-wrap: wrap; }
          .act-filter-btn { width: auto; flex: 1; min-width: 100px; }
        }
      `}</style>

      <div className="act-root">
        <div className="act-header">
          <h1 className="act-title">Centro de <span>Actividades</span></h1>
          <p className="act-subtitle">Seguimiento unificado de interacciones, tareas, contactos y negocios</p>
        </div>

        {loading ? (
          <div className="act-loading">
            <div className="act-spinner" />
          </div>
        ) : (
          <div className="act-layout">
            {/* Sidebar filtros */}
            <aside className="act-sidebar">
              <div className="act-sidebar-title">Filtrar por</div>
              {FILTROS.map(f => (
                <button
                  key={f.key}
                  className={`act-filter-btn${filtro === f.key ? " active" : ""}`}
                  onClick={() => setFiltro(f.key)}
                >
                  <span>{f.icon}</span>
                  <span style={{ flex: 1 }}>{f.label}</span>
                  <span className="act-filter-count">{f.count}</span>
                </button>
              ))}
            </aside>

            {/* Feed */}
            <section className="act-feed">
              {error && (
                <div style={{ background: "rgba(153,0,0,0.08)", border: "1px solid rgba(153,0,0,0.2)", borderRadius: 6, padding: "12px 16px", fontSize: 13, color: "rgba(255,100,100,0.8)" }}>
                  {error}
                </div>
              )}

              {feed.length === 0 && !error ? (
                <div className="act-empty">
                  No hay actividades para mostrar en esta categoría.
                </div>
              ) : (
                feed.map((item, idx) => {
                  if (item.kind === "interaccion") {
                    const i = item.data;
                    const contactNombre = i.crm_contactos ? `${i.crm_contactos.nombre} ${i.crm_contactos.apellido}` : null;
                    return (
                      <div key={`int-${i.id}-${idx}`} className="act-item">
                        <div className="act-icon act-icon-interaccion">💬</div>
                        <div className="act-body">
                          <div className="act-item-top">
                            <span className="act-badge act-badge-interaccion">Interacción</span>
                            <span className="act-badge" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--gfi-border)", color: "var(--gfi-text-muted)" }}>
                              {TIPO_INT_LABELS[i.tipo] ?? i.tipo}
                            </span>
                          </div>
                          <div className="act-item-title">
                            {contactNombre ?? "Sin contacto asignado"}
                          </div>
                          {i.descripcion && <div className="act-item-desc">{i.descripcion}</div>}
                        </div>
                        <div className="act-item-right">
                          <span className="act-date">{fmtFecha(i.created_at)}</span>
                          <Link href="/crm" className="act-link">Ver CRM →</Link>
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === "tarea") {
                    const t = item.data;
                    const contactNombre = t.crm_contactos ? `${t.crm_contactos.nombre} ${t.crm_contactos.apellido}` : null;
                    const vencLabel = t.fecha_vencimiento ? fmtFechaVenc(t.fecha_vencimiento) : null;
                    const esVencida = t.fecha_vencimiento && new Date(t.fecha_vencimiento) < new Date();
                    const esHoy = vencLabel === "Hoy" || vencLabel === "Mañana";
                    return (
                      <div key={`tar-${t.id}-${idx}`} className="act-item">
                        <div className="act-icon act-icon-tarea">✅</div>
                        <div className="act-body">
                          <div className="act-item-top">
                            <span className="act-badge act-badge-tarea">Tarea</span>
                            {t.prioridad && (
                              <span className="act-badge" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--gfi-border)", color: "var(--gfi-text-muted)" }}>
                                {t.prioridad}
                              </span>
                            )}
                          </div>
                          <div className="act-item-title">{t.titulo}</div>
                          <div className="act-item-sub">
                            {contactNombre && <span>👤 {contactNombre}</span>}
                            {vencLabel && (
                              <span className={esVencida ? "act-venc-late" : esHoy ? "act-venc-warn" : "act-venc-ok"} style={{ marginLeft: contactNombre ? 10 : 0 }}>
                                📅 {vencLabel}
                              </span>
                            )}
                          </div>
                          {t.descripcion && <div className="act-item-desc">{t.descripcion}</div>}
                        </div>
                        <div className="act-item-right">
                          <span className="act-date">{t.fecha_vencimiento ? new Date(t.fecha_vencimiento).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "Sin venc."}</span>
                          <Link href="/crm" className="act-link">Ver CRM →</Link>
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === "contacto") {
                    const c = item.data;
                    return (
                      <div key={`con-${c.id}-${idx}`} className="act-item">
                        <div className="act-icon act-icon-contacto">👤</div>
                        <div className="act-body">
                          <div className="act-item-top">
                            <span className="act-badge act-badge-contacto">Contacto nuevo</span>
                            {c.tipo && (
                              <span className="act-badge" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--gfi-border)", color: "var(--gfi-text-muted)" }}>
                                {c.tipo}
                              </span>
                            )}
                          </div>
                          <div className="act-item-title">{c.nombre} {c.apellido}</div>
                        </div>
                        <div className="act-item-right">
                          <span className="act-date">{fmtFecha(c.created_at)}</span>
                          <Link href="/crm" className="act-link">Ver CRM →</Link>
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === "negocio") {
                    const n = item.data;
                    return (
                      <div key={`neg-${n.id}-${idx}`} className="act-item">
                        <div className="act-icon act-icon-negocio">🤝</div>
                        <div className="act-body">
                          <div className="act-item-top">
                            <span className="act-badge act-badge-negocio">Negocio</span>
                            <span className="act-badge" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--gfi-border)", color: "var(--gfi-text-muted)" }}>
                              {n.etapa}
                            </span>
                          </div>
                          <div className="act-item-title">{n.titulo}</div>
                          <div className="act-item-sub">Actualizado {fmtFecha(n.updated_at)}</div>
                        </div>
                        <div className="act-item-right">
                          <span className="act-date">{fmtFecha(n.updated_at)}</span>
                          <Link href="/crm" className="act-link">Ver CRM →</Link>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
