"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface KPIs {
  propiedades: number;
  contactos: number;
  negocios: number;
  tareas: number;
  honorarios: number;
}

interface UltimaActividad {
  id: string;
  tipo: string;
  descripcion: string;
  created_at: string;
  contacto_nombre?: string;
}

interface TareaPendiente {
  id: string;
  titulo: string;
  prioridad: string;
  fecha_vencimiento: string | null;
  tipo: string;
}

const PRIORIDAD_COLOR: Record<string, string> = {
  urgente: "#ef4444",
  alta:    "#f97316",
  normal:  "#3b82f6",
  baja:    "#6b7280",
};

const ACCIONES_RAPIDAS = [
  { href: "/crm/contactos?nuevo=1",  icon: "👤", label: "Nuevo contacto",   color: "#3b82f6" },
  { href: "/crm/negocios?nuevo=1",   icon: "💼", label: "Nuevo negocio",    color: "#22c55e" },
  { href: "/crm/tareas?nueva=1",     icon: "✅", label: "Nueva tarea",      color: "#f59e0b" },
  { href: "/crm/cartera",            icon: "🏠", label: "Ver propiedades",  color: "#8b5cf6" },
  { href: "/crm/autorizaciones",     icon: "📋", label: "Autorizaciones",   color: "#06b6d4" },
  { href: "/crm/hoy",                icon: "📅", label: "Agenda de hoy",    color: "#ec4899" },
];

function formatFechaCorta(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const hoy = new Date();
  const diff = Math.floor((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  if (diff < 0) return `hace ${Math.abs(diff)}d`;
  return `en ${diff}d`;
}

function formatHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " " +
         d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export default function CrmDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [actividad, setActividad] = useState<UltimaActividad[]>([]);
  const [tareasPendientes, setTareasPendientes] = useState<TareaPendiente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/"; return; }
      setUserId(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  async function cargar(uid: string) {
    setLoading(true);

    const [
      { count: cProps },
      { count: cContactos },
      { count: cNegocios },
      { count: cTareas },
      { data: tareas },
      { data: interacciones },
    ] = await Promise.all([
      supabase.from("propiedades").select("*", { count: "exact", head: true })
        .eq("perfil_id", uid).eq("activa", true),
      supabase.from("crm_contactos").select("*", { count: "exact", head: true })
        .eq("perfil_id", uid),
      supabase.from("crm_negocios").select("*", { count: "exact", head: true })
        .eq("perfil_id", uid).eq("archivado", false)
        .not("etapa", "in", '("cerrado","perdido")'),
      supabase.from("crm_tareas").select("*", { count: "exact", head: true })
        .eq("perfil_id", uid).eq("estado", "pendiente"),
      supabase.from("crm_tareas").select("id,titulo,prioridad,fecha_vencimiento,tipo")
        .eq("perfil_id", uid).eq("estado", "pendiente")
        .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
        .limit(5),
      supabase.from("crm_interacciones")
        .select("id,tipo,descripcion,created_at,crm_contactos(nombre,apellido)")
        .eq("perfil_id", uid)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    setKpis({
      propiedades: cProps ?? 0,
      contactos:   cContactos ?? 0,
      negocios:    cNegocios ?? 0,
      tareas:      cTareas ?? 0,
      honorarios:  0,
    });

    setTareasPendientes((tareas ?? []) as TareaPendiente[]);

    setActividad((interacciones ?? []).map((i: any) => ({
      id:            i.id,
      tipo:          i.tipo,
      descripcion:   i.descripcion,
      created_at:    i.created_at,
      contacto_nombre: i.crm_contactos
        ? `${i.crm_contactos.nombre} ${i.crm_contactos.apellido}`
        : undefined,
    })));

    setLoading(false);
  }

  const tipoIcon: Record<string, string> = {
    nota: "📝", llamada: "📞", whatsapp: "💬",
    email: "✉️", reunion: "🤝", visita: "🏠",
  };

  return (
    <>
      <style>{`
        .dash-titulo {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px; font-weight: 800; color: #fff;
          margin-bottom: 20px;
        }
        .dash-titulo span { color: #cc0000; }

        /* KPIs */
        .dash-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 24px;
        }
        .dash-kpi {
          background: #111; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 16px 18px;
          display: flex; flex-direction: column; gap: 6px;
          transition: border-color 0.2s;
          text-decoration: none;
        }
        .dash-kpi:hover { border-color: rgba(204,0,0,0.3); }
        .dash-kpi-num {
          font-family: 'Montserrat', sans-serif;
          font-size: 28px; font-weight: 800; color: #fff;
        }
        .dash-kpi-lbl {
          font-size: 11px; color: rgba(255,255,255,0.45);
          font-family: 'Inter', sans-serif; font-weight: 500;
        }
        .dash-kpi-ico { font-size: 20px; }

        /* Acciones rápidas */
        .dash-acciones-titulo {
          font-family: 'Montserrat', sans-serif;
          font-size: 9px; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,0.3);
          margin-bottom: 10px; margin-top: 4px;
        }
        .dash-acciones {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px; margin-bottom: 24px;
        }
        .dash-accion {
          background: #111; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 14px 16px;
          display: flex; align-items: center; gap: 12px;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
        }
        .dash-accion:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.15); }
        .dash-accion-ico {
          width: 36px; height: 36px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; flex-shrink: 0;
        }
        .dash-accion-lbl {
          font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.8);
          font-family: 'Inter', sans-serif;
        }

        /* Grid inferior */
        .dash-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        /* Sección card */
        .dash-card {
          background: #111; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; overflow: hidden;
        }
        .dash-card-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .dash-card-head-lbl {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.5);
        }
        .dash-card-head a {
          font-size: 11px; color: #cc0000; text-decoration: none;
        }
        .dash-card-body { padding: 0; }

        /* Ítem de tarea */
        .dash-tarea {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .dash-tarea:last-child { border-bottom: none; }
        .dash-tarea-dot {
          width: 8px; height: 8px; border-radius: 50%;
          flex-shrink: 0; margin-top: 4px;
        }
        .dash-tarea-info { flex: 1; min-width: 0; }
        .dash-tarea-titulo {
          font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.85);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dash-tarea-meta { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .dash-tarea-vence {
          font-size: 11px; font-weight: 600; flex-shrink: 0;
          font-family: 'Montserrat', sans-serif;
        }

        /* Ítem de actividad */
        .dash-act-item {
          display: flex; gap: 10px; padding: 11px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .dash-act-item:last-child { border-bottom: none; }
        .dash-act-ico { font-size: 15px; flex-shrink: 0; padding-top: 1px; }
        .dash-act-info { flex: 1; min-width: 0; }
        .dash-act-txt {
          font-size: 12px; color: rgba(255,255,255,0.75);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dash-act-meta { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; }

        .dash-empty {
          padding: 24px 16px; text-align: center;
          font-size: 12px; color: rgba(255,255,255,0.2);
          font-style: italic;
        }

        .dash-skeleton {
          background: rgba(255,255,255,0.06); border-radius: 4px;
          animation: skp 1.4s ease-in-out infinite;
        }
        @keyframes skp { 0%,100%{opacity:0.4} 50%{opacity:0.8} }

        @media (max-width: 768px) {
          .dash-kpis { grid-template-columns: repeat(2, 1fr); }
          .dash-acciones { grid-template-columns: repeat(2, 1fr); }
          .dash-grid2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 400px) {
          .dash-kpis { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .dash-acciones { grid-template-columns: repeat(2, 1fr); gap: 8px; }
        }
      `}</style>

      <div className="dash-titulo">
        Buen día <span>GFI®</span>
      </div>

      {/* KPIs */}
      <div className="dash-kpis">
        {[
          { href: "/crm/cartera",   ico: "🏠", num: kpis?.propiedades, lbl: "Propiedades activas" },
          { href: "/crm/contactos", ico: "👥", num: kpis?.contactos,   lbl: "Contactos" },
          { href: "/crm/negocios",  ico: "💼", num: kpis?.negocios,    lbl: "Negocios activos" },
          { href: "/crm/tareas",    ico: "✅", num: kpis?.tareas,      lbl: "Tareas pendientes" },
        ].map(({ href, ico, num, lbl }) => (
          <Link key={href} href={href} className="dash-kpi">
            <span className="dash-kpi-ico">{ico}</span>
            <span className="dash-kpi-num">
              {loading ? <span className="dash-skeleton" style={{width:40,height:28,display:"inline-block"}} /> : (num ?? 0)}
            </span>
            <span className="dash-kpi-lbl">{lbl}</span>
          </Link>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div className="dash-acciones-titulo">Acciones rápidas</div>
      <div className="dash-acciones">
        {ACCIONES_RAPIDAS.map(a => (
          <Link key={a.href} href={a.href} className="dash-accion">
            <div className="dash-accion-ico" style={{background: a.color + "22"}}>
              {a.icon}
            </div>
            <span className="dash-accion-lbl">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Tareas próximas + Actividad reciente */}
      <div className="dash-grid2">

        {/* Tareas */}
        <div className="dash-card">
          <div className="dash-card-head">
            <span className="dash-card-head-lbl">✅ Tareas pendientes</span>
            <Link href="/crm/tareas">Ver todas →</Link>
          </div>
          <div className="dash-card-body">
            {loading ? (
              <div className="dash-empty">Cargando...</div>
            ) : tareasPendientes.length === 0 ? (
              <div className="dash-empty">Sin tareas pendientes 🎉</div>
            ) : tareasPendientes.map(t => {
              const fechaLabel = formatFechaCorta(t.fecha_vencimiento);
              const venceColor = t.fecha_vencimiento && new Date(t.fecha_vencimiento) < new Date()
                ? "#ef4444" : "rgba(255,255,255,0.4)";
              return (
                <Link key={t.id} href={`/crm/tareas#${t.id}`} style={{textDecoration:"none"}}>
                  <div className="dash-tarea">
                    <div className="dash-tarea-dot" style={{background: PRIORIDAD_COLOR[t.prioridad] ?? "#6b7280"}} />
                    <div className="dash-tarea-info">
                      <div className="dash-tarea-titulo">{t.titulo}</div>
                      <div className="dash-tarea-meta">{t.tipo}</div>
                    </div>
                    {fechaLabel && (
                      <span className="dash-tarea-vence" style={{color: venceColor}}>{fechaLabel}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="dash-card">
          <div className="dash-card-head">
            <span className="dash-card-head-lbl">⚡ Actividad reciente</span>
            <Link href="/crm/actividad">Ver todo →</Link>
          </div>
          <div className="dash-card-body">
            {loading ? (
              <div className="dash-empty">Cargando...</div>
            ) : actividad.length === 0 ? (
              <div className="dash-empty">Sin actividad registrada</div>
            ) : actividad.map(a => (
              <div key={a.id} className="dash-act-item">
                <span className="dash-act-ico">{tipoIcon[a.tipo] ?? "💬"}</span>
                <div className="dash-act-info">
                  <div className="dash-act-txt">
                    {a.contacto_nombre && <strong>{a.contacto_nombre}: </strong>}
                    {a.descripcion}
                  </div>
                  <div className="dash-act-meta">{formatHora(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
