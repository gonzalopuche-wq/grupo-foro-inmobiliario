"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

interface Paso {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
  icon: string;
  color: string;
  verificar: () => Promise<boolean>;
}

export default function OnboardingPage() {
  const [completados, setCompletados] = useState<Record<string, boolean>>({});
  const [cargando, setCargando] = useState(true);
  const [perfil, setPerfil] = useState<{ nombre: string; foto_url: string | null; bio: string | null; zona_trabajo: string | null; especialidades: string[] | null; inmobiliaria: string | null; matricula: string | null } | null>(null);

  const PASOS: Paso[] = [
    {
      id: "perfil_completo",
      titulo: "Completá tu perfil",
      descripcion: "Añadí foto, bio, zona de trabajo, especialidades e inmobiliaria para generar confianza en la red.",
      href: "/perfil",
      icon: "👤",
      color: "#cc0000",
      verificar: async () => {
        if (!perfil) return false;
        return !!(perfil.foto_url && perfil.bio && perfil.zona_trabajo && (perfil.especialidades?.length ?? 0) > 0 && perfil.inmobiliaria);
      },
    },
    {
      id: "primera_propiedad",
      titulo: "Cargá tu primera propiedad",
      descripcion: "Subí al menos una propiedad a tu cartera CRM para empezar a gestionarla en la plataforma.",
      href: "/crm/cartera",
      icon: "🏠",
      color: "#3b82f6",
      verificar: async () => {
        const { data: uid } = await supabase.auth.getUser();
        if (!uid.user) return false;
        const { count } = await supabase.from("cartera_propiedades").select("id", { count: "exact", head: true }).eq("perfil_id", uid.user.id);
        return (count ?? 0) > 0;
      },
    },
    {
      id: "primer_contacto",
      titulo: "Agregá un contacto al CRM",
      descripcion: "Registrá tu primer cliente, comprador o inquilino en el CRM para empezar a gestionar tus relaciones.",
      href: "/crm",
      icon: "👥",
      color: "#22c55e",
      verificar: async () => {
        const { data: uid } = await supabase.auth.getUser();
        if (!uid.user) return false;
        const { count } = await supabase.from("crm_contactos").select("id", { count: "exact", head: true }).eq("perfil_id", uid.user.id);
        return (count ?? 0) > 0;
      },
    },
    {
      id: "primer_mir",
      titulo: "Publicá en el MIR",
      descripcion: "Creá tu primera publicación de ofrecido o búsqueda en el Motor de Intercambio Recíproco.",
      href: "/mir",
      icon: "🔄",
      color: "#a78bfa",
      verificar: async () => {
        const { data: uid } = await supabase.auth.getUser();
        if (!uid.user) return false;
        const [{ count: c1 }, { count: c2 }] = await Promise.all([
          supabase.from("mir_ofrecidos").select("id", { count: "exact", head: true }).eq("perfil_id", uid.user.id),
          supabase.from("mir_busquedas").select("id", { count: "exact", head: true }).eq("perfil_id", uid.user.id),
        ]);
        return (c1 ?? 0) + (c2 ?? 0) > 0;
      },
    },
    {
      id: "primer_foro",
      titulo: "Participá en el Foro",
      descripcion: "Publicá un tema o respondé a una consulta en el Foro GFI®. Tu participación bonifica tu suscripción.",
      href: "/foro",
      icon: "💬",
      color: "#f97316",
      verificar: async () => {
        const { data: uid } = await supabase.auth.getUser();
        if (!uid.user) return false;
        const { count } = await supabase.from("foro_posts").select("id", { count: "exact", head: true }).eq("user_id", uid.user.id);
        return (count ?? 0) > 0;
      },
    },
    {
      id: "comparable",
      titulo: "Cargá un comparable",
      descripcion: "Ingresá datos de una operación de venta real para alimentar el tasador inteligente y la red GFI®.",
      href: "/comparables",
      icon: "📊",
      color: "#eab308",
      verificar: async () => {
        const { data: uid } = await supabase.auth.getUser();
        if (!uid.user) return false;
        const { count } = await supabase.from("comparables").select("id", { count: "exact", head: true }).eq("perfil_id", uid.user.id);
        return (count ?? 0) > 0;
      },
    },
    {
      id: "mi_web",
      titulo: "Activá tu web personal",
      descripcion: "Configurá tu micrositio público de GFI® para recibir leads directos de compradores y locatarios.",
      href: "/mi-web",
      icon: "🌐",
      color: "#06b6d4",
      verificar: async () => {
        const { data: uid } = await supabase.auth.getUser();
        if (!uid.user) return false;
        const { data } = await supabase.from("perfiles").select("web_propia").eq("id", uid.user.id).single();
        return !!(data?.web_propia);
      },
    },
    {
      id: "biblioteca",
      titulo: "Subí un documento a la Biblioteca",
      descripcion: "Compartí un modelo de contrato, formulario o guía con la comunidad. Bonifica tu suscripción.",
      href: "/biblioteca",
      icon: "📚",
      color: "#10b981",
      verificar: async () => {
        const { data: uid } = await supabase.auth.getUser();
        if (!uid.user) return false;
        const { count } = await supabase.from("biblioteca").select("id", { count: "exact", head: true }).eq("perfil_id", uid.user.id);
        return (count ?? 0) > 0;
      },
    },
  ];

  useEffect(() => {
    const init = async () => {
      const { data: ud } = await supabase.auth.getUser();
      if (!ud.user) return;
      const { data: p } = await supabase.from("perfiles").select("nombre,foto_url,bio,zona_trabajo,especialidades,inmobiliaria,matricula").eq("id", ud.user.id).single();
      if (p) setPerfil(p as typeof perfil);
    };
    init();
  }, []);

  useEffect(() => {
    if (perfil === null) return;
    const verificarTodos = async () => {
      setCargando(true);
      const results = await Promise.all(PASOS.map(async p => [p.id, await p.verificar()] as [string, boolean]));
      setCompletados(Object.fromEntries(results));
      setCargando(false);
    };
    verificarTodos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil]);

  const totalCompletados = Object.values(completados).filter(Boolean).length;
  const porcentaje = PASOS.length > 0 ? Math.round((totalCompletados / PASOS.length) * 100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .ob-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 14px; transition: border-color 0.15s; }
        .ob-card:hover { border-color: rgba(255,255,255,0.12); }
        .ob-card.done { border-color: rgba(34,197,94,0.2); background: rgba(34,197,94,0.04); }
        .ob-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; margin-top: 1px; }
        .ob-check.done { border-color: #22c55e; background: rgba(34,197,94,0.15); }
      `}</style>

      <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            Checklist de <span style={{ color: "#cc0000" }}>Onboarding</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>
            {perfil ? `Hola, ${perfil.nombre}. ` : ""}Completá estos pasos para aprovechar al máximo la plataforma GFI®.
          </div>
        </div>

        {/* Progreso */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Tu progreso
            </div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: porcentaje === 100 ? "#22c55e" : "#cc0000" }}>
              {cargando ? "…" : `${porcentaje}%`}
            </div>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: cargando ? "0%" : `${porcentaje}%`, background: porcentaje === 100 ? "#22c55e" : "#cc0000", borderRadius: 4, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
            {cargando ? "Verificando…" : `${totalCompletados} de ${PASOS.length} pasos completados`}
          </div>
        </div>

        {porcentaje === 100 && !cargando && (
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: "#22c55e", marginBottom: 4 }}>¡Onboarding completo!</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif" }}>
              Tenés todo listo para aprovechar al máximo GFI®. Seguí participando para bonificar tu suscripción.
            </div>
          </div>
        )}

        {/* Pasos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PASOS.map(paso => {
            const hecho = completados[paso.id] ?? false;
            return (
              <div key={paso.id} className={`ob-card${hecho ? " done" : ""}`}>
                <div className={`ob-check${hecho ? " done" : ""}`} style={{ borderColor: hecho ? "#22c55e" : `${paso.color}50` }}>
                  {hecho ? <span style={{ color: "#22c55e", fontSize: 13 }}>✓</span> : <span style={{ color: `${paso.color}80`, fontSize: 14 }}>○</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 16 }}>{paso.icon}</span>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: hecho ? "rgba(255,255,255,0.5)" : "#fff", textDecoration: hecho ? "line-through" : "none" }}>
                      {paso.titulo}
                    </div>
                    {hecho && (
                      <span style={{ fontSize: 9, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.1em" }}>LISTO</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", lineHeight: 1.5, marginBottom: hecho ? 0 : 8 }}>
                    {paso.descripcion}
                  </div>
                  {!hecho && (
                    <Link href={paso.href} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: paso.color, background: `${paso.color}12`, border: `1px solid ${paso.color}30`, borderRadius: 5, padding: "4px 10px", textDecoration: "none", letterSpacing: "0.06em" }}>
                      Ir ahora →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", textAlign: "center", paddingTop: 4 }}>
          Los pasos se verifican automáticamente con tus datos reales. Recargá la página para actualizar.
        </div>
      </div>
    </>
  );
}
