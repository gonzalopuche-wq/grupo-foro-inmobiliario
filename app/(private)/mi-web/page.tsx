"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// ── Plantillas ──────────────────────────────────────────────────────────────

const PLANTILLAS = [
  { id: "rosario-classic", nombre: "Rosario Classic", estilo: "Oscuro · Rojo · Elegante", 
    preview: { bg: "#0a0a0a", accent: "#cc0000", text: "#fff" } },
  { id: "blanco-moderno", nombre: "Blanco Moderno", estilo: "Minimalista · Limpio",
    preview: { bg: "#fff", accent: "#111", text: "#111" } },
  { id: "grand-estate", nombre: "Grand Estate", estilo: "Lujo · Negro · Dorado",
    preview: { bg: "#0d0d0d", accent: "#c9a84c", text: "#fff" } },
  { id: "ciudad-viva", nombre: "Ciudad Viva", estilo: "Urbano · Azul · Moderno",
    preview: { bg: "#1a2332", accent: "#3b82f6", text: "#fff" } },
  { id: "campo-verde", nombre: "Campo Verde", estilo: "Natural · Verde · Fresco",
    preview: { bg: "#f0f7f0", accent: "#22863a", text: "#1a1a1a" } },
  { id: "coral", nombre: "Coral", estilo: "Cálido · Coral · Vibrante",
    preview: { bg: "#fff8f5", accent: "#e05c3a", text: "#1a1a1a" } },
  { id: "noche-portena", nombre: "Noche Porteña", estilo: "Dark · Azul Marino · Sofisticado",
    preview: { bg: "#0f1923", accent: "#60a5fa", text: "#fff" } },
  { id: "sol-norte", nombre: "Sol Norte", estilo: "Cálido · Naranja · Enérgico",
    preview: { bg: "#fffbf0", accent: "#f97316", text: "#1a1a1a" } },
  { id: "plata", nombre: "Plata", estilo: "Premium · Plateado · Elegante",
    preview: { bg: "#f8f9fa", accent: "#6b7280", text: "#111" } },
  { id: "brick", nombre: "Brick", estilo: "Industrial · Ladrillo · Urbano",
    preview: { bg: "#1c1410", accent: "#b45309", text: "#fff" } },
  { id: "zen", nombre: "Zen", estilo: "Minimalista · Beige · Calma",
    preview: { bg: "#faf8f5", accent: "#92775a", text: "#2d2d2d" } },
  { id: "digital-pro", nombre: "Digital Pro", estilo: "Tech · Degradado · Moderno",
    preview: { bg: "#0f0f23", accent: "#8b5cf6", text: "#fff" } },
];

const PASOS = [
  { n: 1, label: "General", sub: "Dominio, plantilla y logo" },
  { n: 2, label: "Personalización", sub: "Colores e imágenes" },
  { n: 3, label: "Módulos", sub: "Funcionalidades activas" },
  { n: 4, label: "Contenido", sub: "Textos y descripción" },
  { n: 5, label: "SEO & Redes", sub: "Optimización y social" },
  { n: 6, label: "Avanzado", sub: "Destacadas y scripts" },
];

interface Config {
  slug: string;
  dominio_propio: string;
  plantilla: string;
  activa: boolean;
  logo_url: string;
  cover_url: string;
  foto_sobre_mi_url: string;
  color_primario: string;
  color_secundario: string;
  color_texto: string;
  color_fondo: string;
  titulo_sitio: string;
  subtitulo: string;
  descripcion_profesional: string;
  anos_experiencia: string;
  mostrar_formulario_contacto: boolean;
  mostrar_formulario_tasacion: boolean;
  mostrar_propiedades_destacadas: boolean;
  mostrar_sobre_mi: boolean;
  mostrar_testimonios: boolean;
  mostrar_blog: boolean;
  seo_titulo: string;
  seo_descripcion: string;
  seo_keywords: string;
  instagram: string;
  facebook: string;
  twitter: string;
  linkedin: string;
  tiktok: string;
  whatsapp: string;
  limite_propiedades_home: string;
  google_analytics: string;
  script_header: string;
  script_footer: string;
}

const CONFIG_VACIA: Config = {
  slug: "", dominio_propio: "", plantilla: "rosario-classic", activa: false,
  logo_url: "", cover_url: "", foto_sobre_mi_url: "",
  color_primario: "#cc0000", color_secundario: "#111111",
  color_texto: "#222222", color_fondo: "#ffffff",
  titulo_sitio: "", subtitulo: "", descripcion_profesional: "", anos_experiencia: "",
  mostrar_formulario_contacto: true, mostrar_formulario_tasacion: true,
  mostrar_propiedades_destacadas: true, mostrar_sobre_mi: true,
  mostrar_testimonios: false, mostrar_blog: false,
  seo_titulo: "", seo_descripcion: "", seo_keywords: "",
  instagram: "", facebook: "", twitter: "", linkedin: "", tiktok: "", whatsapp: "",
  limite_propiedades_home: "6",
  google_analytics: "", script_header: "", script_footer: "",
};

const Toggle = ({ label, value, onChange, desc }: { label: string; value: boolean; onChange: (v: boolean) => void; desc?: string }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
    <div>
      <div style={{ fontSize: 13, color: "#fff", fontFamily: "Inter,sans-serif" }}>{label}</div>
      {desc && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{desc}</div>}
    </div>
    <div style={{ width: 44, height: 24, borderRadius: 12, background: value ? "#cc0000" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }} onClick={() => onChange(!value)}>
      <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
  </div>
);

// ── Componente principal ────────────────────────────────────────────────────

export default function MiWebPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [paso, setPaso] = useState(1);
  const [config, setConfig] = useState<Config>(CONFIG_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [tieneConfig, setTieneConfig] = useState(false);
  const [matricula, setMatricula] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = "/login"; return; }
      setUserId(auth.user.id);

      // Cargar perfil para el slug sugerido
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("matricula, nombre, apellido")
        .eq("id", auth.user.id)
        .single();

      if (perfil?.matricula) {
        setMatricula(perfil.matricula);
      }

      // Cargar config existente
      const { data: cfg } = await supabase
        .from("web_corredor_config")
        .select("*")
        .eq("perfil_id", auth.user.id)
        .single();

      if (cfg) {
        setTieneConfig(true);
        setConfig({
          slug: cfg.slug ?? "",
          dominio_propio: cfg.dominio_propio ?? "",
          plantilla: cfg.plantilla ?? "rosario-classic",
          activa: cfg.activa ?? false,
          logo_url: cfg.logo_url ?? "",
          cover_url: cfg.cover_url ?? "",
          foto_sobre_mi_url: cfg.foto_sobre_mi_url ?? "",
          color_primario: cfg.color_primario ?? "#cc0000",
          color_secundario: cfg.color_secundario ?? "#111111",
          color_texto: cfg.color_texto ?? "#222222",
          color_fondo: cfg.color_fondo ?? "#ffffff",
          titulo_sitio: cfg.titulo_sitio ?? "",
          subtitulo: cfg.subtitulo ?? "",
          descripcion_profesional: cfg.descripcion_profesional ?? "",
          anos_experiencia: cfg.anos_experiencia?.toString() ?? "",
          mostrar_formulario_contacto: cfg.mostrar_formulario_contacto ?? true,
          mostrar_formulario_tasacion: cfg.mostrar_formulario_tasacion ?? true,
          mostrar_propiedades_destacadas: cfg.mostrar_propiedades_destacadas ?? true,
          mostrar_sobre_mi: cfg.mostrar_sobre_mi ?? true,
          mostrar_testimonios: cfg.mostrar_testimonios ?? false,
          mostrar_blog: cfg.mostrar_blog ?? false,
          seo_titulo: cfg.seo_titulo ?? "",
          seo_descripcion: cfg.seo_descripcion ?? "",
          seo_keywords: cfg.seo_keywords ?? "",
          instagram: cfg.instagram ?? "",
          facebook: cfg.facebook ?? "",
          twitter: cfg.twitter ?? "",
          linkedin: cfg.linkedin ?? "",
          tiktok: cfg.tiktok ?? "",
          whatsapp: cfg.whatsapp ?? "",
          limite_propiedades_home: cfg.limite_propiedades_home?.toString() ?? "6",
          google_analytics: cfg.google_analytics ?? "",
          script_header: cfg.script_header ?? "",
          script_footer: cfg.script_footer ?? "",
        });
      } else {
        // Sugerir slug basado en matrícula
        if (perfil?.matricula) {
          setConfig(c => ({ ...c, slug: `mat${perfil.matricula}` }));
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const set = (key: keyof Config, value: any) => setConfig(c => ({ ...c, [key]: value }));

  const guardar = async () => {
    if (!userId) return;
    setGuardando(true);
    const datos = {
      perfil_id: userId,
      slug: config.slug || `mat${matricula}`,
      dominio_propio: config.dominio_propio || null,
      plantilla: config.plantilla,
      activa: config.activa,
      logo_url: config.logo_url || null,
      cover_url: config.cover_url || null,
      foto_sobre_mi_url: config.foto_sobre_mi_url || null,
      color_primario: config.color_primario,
      color_secundario: config.color_secundario,
      color_texto: config.color_texto,
      color_fondo: config.color_fondo,
      titulo_sitio: config.titulo_sitio || null,
      subtitulo: config.subtitulo || null,
      descripcion_profesional: config.descripcion_profesional || null,
      anos_experiencia: config.anos_experiencia ? parseInt(config.anos_experiencia) : null,
      mostrar_formulario_contacto: config.mostrar_formulario_contacto,
      mostrar_formulario_tasacion: config.mostrar_formulario_tasacion,
      mostrar_propiedades_destacadas: config.mostrar_propiedades_destacadas,
      mostrar_sobre_mi: config.mostrar_sobre_mi,
      mostrar_testimonios: config.mostrar_testimonios,
      mostrar_blog: config.mostrar_blog,
      seo_titulo: config.seo_titulo || null,
      seo_descripcion: config.seo_descripcion || null,
      seo_keywords: config.seo_keywords || null,
      instagram: config.instagram || null,
      facebook: config.facebook || null,
      twitter: config.twitter || null,
      linkedin: config.linkedin || null,
      tiktok: config.tiktok || null,
      whatsapp: config.whatsapp || null,
      limite_propiedades_home: parseInt(config.limite_propiedades_home) || 6,
      google_analytics: config.google_analytics || null,
      script_header: config.script_header || null,
      script_footer: config.script_footer || null,
      updated_at: new Date().toISOString(),
    };

    if (tieneConfig) {
      await supabase.from("web_corredor_config").update(datos).eq("perfil_id", userId);
    } else {
      await supabase.from("web_corredor_config").insert(datos);
      setTieneConfig(true);
    }

    setGuardando(false);
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 2500);
  };

  const urlWeb = config.dominio_propio || 
    (config.slug ? `https://${config.slug}.foroinmobiliario.com.ar` : null);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
      Cargando configuración...
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .mw-wrap { display: flex; gap: 0; min-height: calc(100vh - 70px); }
        .mw-sidebar { width: 280px; flex-shrink: 0; background: rgba(8,8,8,0.95); border-right: 1px solid rgba(255,255,255,0.07); padding: 24px 0; display: flex; flex-direction: column; }
        .mw-sidebar-titulo { padding: 0 22px 20px; font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 8px; }
        .mw-sidebar-titulo span { color: #cc0000; }
        .mw-sidebar-progress { padding: 12px 22px; margin-bottom: 8px; }
        .mw-progress-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
        .mw-progress-fill { height: 100%; background: #cc0000; border-radius: 2px; transition: width 0.3s; }
        .mw-progress-txt { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; margin-top: 6px; }
        .mw-paso-item { display: flex; align-items: center; gap: 14px; padding: 12px 22px; cursor: pointer; transition: background 0.15s; position: relative; }
        .mw-paso-item:hover { background: rgba(255,255,255,0.03); }
        .mw-paso-item.activo { background: rgba(200,0,0,0.06); border-left: 2px solid #cc0000; }
        .mw-paso-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 800; flex-shrink: 0; transition: all 0.2s; }
        .mw-paso-num.completado { background: #22c55e; color: #fff; }
        .mw-paso-num.activo { background: #cc0000; color: #fff; }
        .mw-paso-num.pendiente { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); }
        .mw-paso-info {}
        .mw-paso-label { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.8); }
        .mw-paso-item.activo .mw-paso-label { color: #fff; }
        .mw-paso-sub { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; }
        .mw-sidebar-conector { width: 1px; height: 12px; background: rgba(255,255,255,0.07); margin: 0 35px; }
        .mw-estado { margin: 16px 22px 0; padding: 10px 14px; border-radius: 6px; display: flex; align-items: center; gap: 10px; }
        .mw-estado.activa { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); }
        .mw-estado.inactiva { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
        .mw-content { flex: 1; padding: 32px 40px; overflow-y: auto; }
        .mw-paso-titulo { font-size: 10px; color: #cc0000; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 6px; }
        .mw-paso-h1 { font-family: 'Montserrat',sans-serif; font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 4px; }
        .mw-paso-desc { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 28px; }
        .mw-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 22px 24px; margin-bottom: 16px; }
        .mw-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .mw-field { margin-bottom: 14px; }
        .mw-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 6px; font-family: 'Montserrat',sans-serif; }
        .mw-label small { font-size: 10px; color: rgba(255,255,255,0.2); font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 6px; }
        .mw-input { width: 100%; padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; transition: border-color 0.2s; }
        .mw-input:focus { border-color: rgba(200,0,0,0.5); }
        .mw-input::placeholder { color: rgba(255,255,255,0.2); }
        .mw-textarea { width: 100%; padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; resize: vertical; min-height: 80px; }
        .mw-textarea:focus { border-color: rgba(200,0,0,0.5); }
        .mw-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .mw-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .mw-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
        .mw-hint { font-size: 11px; color: rgba(255,255,255,0.25); margin-top: 5px; line-height: 1.5; }
        .mw-url-preview { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(200,0,0,0.06); border: 1px solid rgba(200,0,0,0.15); border-radius: 6px; margin-top: 10px; }
        .mw-url-txt { font-size: 12px; color: rgba(255,255,255,0.6); font-family: 'Inter',sans-serif; }
        .mw-url-link { font-size: 12px; color: "#cc0000"; font-family: 'Inter',sans-serif; word-break: break-all; }
        /* Plantillas */
        .mw-plantillas { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
        .mw-plantilla { border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
        .mw-plantilla:hover { transform: translateY(-2px); }
        .mw-plantilla.activa { border-color: #cc0000; }
        .mw-plantilla-preview { height: 100px; display: flex; flex-direction: column; padding: 10px; position: relative; overflow: hidden; }
        .mw-plantilla-nombre { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 800; padding: 8px 10px; letter-spacing: 0.05em; text-transform: uppercase; }
        .mw-plantilla-estilo { font-size: 9px; color: rgba(255,255,255,0.5); padding: 0 10px 8px; font-family: 'Inter',sans-serif; }
        .mw-check-activa { position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; background: #cc0000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; }
        /* Color picker */
        .mw-colores { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .mw-color-item { display: flex; align-items: center; gap: 10px; }
        .mw-color-preview { width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; flex-shrink: 0; }
        .mw-color-label { font-size: 11px; color: rgba(255,255,255,0.5); font-family: 'Inter',sans-serif; }
        .mw-color-input { width: 100%; padding: 6px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; }
        /* Botones nav */
        .mw-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.07); }
        .mw-btn-prev { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .mw-btn-next { padding: 10px 24px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .mw-btn-next:hover { background: #e60000; }
        .mw-btn-guardar { padding: 10px 24px; background: #22c55e; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .mw-spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 6px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .mw-img-upload { display: flex; align-items: center; gap: 12px; }
        .mw-img-preview { width: 80px; height: 60px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
        .mw-img-preview img { width: 100%; height: 100%; object-fit: cover; }
        .mw-img-placeholder { font-size: 10px; color: rgba(255,255,255,0.2); text-align: center; font-family: 'Inter',sans-serif; }
        .mw-btn-upload { padding: 7px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 11px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; }
        .mw-social-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .mw-social-icon { width: 32px; height: 32px; border-radius: 6px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        @media (max-width: 900px) { .mw-sidebar { width: 220px; } .mw-content { padding: 24px 20px; } }
        @media (max-width: 700px) { .mw-wrap { flex-direction: column; } .mw-sidebar { width: 100%; padding: 16px 0; } .mw-row, .mw-row3, .mw-colores { grid-template-columns: 1fr; } }
      `}</style>

      <div className="mw-wrap">

        {/* ── Sidebar ── */}
        <div className="mw-sidebar">
          <div className="mw-sidebar-titulo">Mi <span>Web</span> GFI®</div>

          <div className="mw-sidebar-progress">
            <div className="mw-progress-bar">
              <div className="mw-progress-fill" style={{ width: `${((paso - 1) / 5) * 100}%` }} />
            </div>
            <div className="mw-progress-txt">Paso {paso} de 6</div>
          </div>

          {PASOS.map((p, idx) => (
            <div key={p.n}>
              <div className={`mw-paso-item${paso === p.n ? " activo" : ""}`} onClick={() => setPaso(p.n)}>
                <div className={`mw-paso-num ${paso > p.n ? "completado" : paso === p.n ? "activo" : "pendiente"}`}>
                  {paso > p.n ? "✓" : p.n}
                </div>
                <div className="mw-paso-info">
                  <div className="mw-paso-label">{p.label}</div>
                  <div className="mw-paso-sub">{p.sub}</div>
                </div>
              </div>
              {idx < PASOS.length - 1 && <div className="mw-sidebar-conector" />}
            </div>
          ))}

          {/* Estado web */}
          <div className={`mw-estado ${config.activa ? "activa" : "inactiva"}`}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: config.activa ? "#22c55e" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, color: config.activa ? "#22c55e" : "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {config.activa ? "Web activa" : "Web inactiva"}
              </div>
              {urlWeb && (
                <a href={urlWeb} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", textDecoration: "none", wordBreak: "break-all" }}>
                  {urlWeb.replace("https://", "")}
                </a>
              )}
            </div>
          </div>

          {/* Contenido links */}
          <div style={{ margin: "12px 22px 0", padding: "10px 14px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Contenido</div>
            <Link href="/mi-web/leads" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "6px 0" }}>
              <span style={{ fontSize: 14 }}>📬</span>
              <span style={{ fontSize: 12, color: "#fff", fontFamily: "Inter,sans-serif", fontWeight: 500 }}>Leads</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>→</span>
            </Link>
            <Link href="/mi-web/blog" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 2 }}>
              <span style={{ fontSize: 14 }}>✍️</span>
              <span style={{ fontSize: 12, color: "#fff", fontFamily: "Inter,sans-serif", fontWeight: 500 }}>Ver mi Blog</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>→</span>
            </Link>
            <Link href="/mi-web/instagram" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 2 }}>
              <span style={{ fontSize: 14 }}>📸</span>
              <span style={{ fontSize: 12, color: "#fff", fontFamily: "Inter,sans-serif", fontWeight: 500 }}>Instagram</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>→</span>
            </Link>
          </div>
        </div>

        {/* ── Contenido ── */}
        <div className="mw-content">

          {/* ═══ PASO 1: General ═══ */}
          {paso === 1 && (
            <>
              <div className="mw-paso-titulo">Paso 1 de 6</div>
              <div className="mw-paso-h1">General</div>
              <div className="mw-paso-desc">Configurá el dominio, la plantilla y el logo de tu sitio web.</div>

              {/* Configuración del sitio */}
              <div className="mw-card">
                <div className="mw-card-titulo">🌐 Configuración del sitio</div>

                <div className="mw-row">
                  <div className="mw-field">
                    <label className="mw-label">Subdominio GFI<small>(obligatorio)</small></label>
                    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      <input
                        className="mw-input"
                        style={{ borderRadius: "4px 0 0 4px", borderRight: "none" }}
                        value={config.slug}
                        onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder={matricula ? `mat${matricula}` : "tu-nombre"}
                      />
                      <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 4px 4px 0", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap" }}>
                        .foroinmobiliario.com.ar
                      </div>
                    </div>
                    <div className="mw-hint">Solo letras, números y guiones. Ej: juan-garcia</div>
                  </div>
                  <div className="mw-field">
                    <label className="mw-label">Dominio propio<small>(opcional)</small></label>
                    <input
                      className="mw-input"
                      value={config.dominio_propio}
                      onChange={e => set("dominio_propio", e.target.value)}
                      placeholder="www.juangarcia.com.ar"
                    />
                    <div className="mw-hint">Si tenés dominio propio ingresalo acá</div>
                  </div>
                </div>

                {(config.slug || config.dominio_propio) && (
                  <div className="mw-url-preview">
                    <span style={{ fontSize: 14 }}>🌐</span>
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Tu web quedará en</div>
                      <span style={{ fontSize: 12, color: "#cc0000", fontFamily: "Inter,sans-serif" }}>
                        {config.dominio_propio || `https://${config.slug || `mat${matricula}`}.foroinmobiliario.com.ar`}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <Toggle
                    label="Activar mi web"
                    desc="Cuando está activa, tu web es visible para el público"
                    value={config.activa}
                    onChange={v => set("activa", v)}
                  />
                </div>
              </div>

              {/* Plantillas */}
              <div className="mw-card">
                <div className="mw-card-titulo">🎨 Plantilla del sitio</div>
                <div className="mw-plantillas">
                  {PLANTILLAS.map(p => (
                    <div
                      key={p.id}
                      className={`mw-plantilla${config.plantilla === p.id ? " activa" : ""}`}
                      style={{ border: `2px solid ${config.plantilla === p.id ? "#cc0000" : "rgba(255,255,255,0.08)"}` }}
                      onClick={() => set("plantilla", p.id)}
                    >
                      {/* Preview visual */}
                      <div className="mw-plantilla-preview" style={{ background: p.preview.bg }}>
                        {/* Header simulado */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ width: 30, height: 6, borderRadius: 3, background: p.preview.accent }} />
                          <div style={{ display: "flex", gap: 3 }}>
                            {[0,1,2].map(i => <div key={i} style={{ width: 12, height: 4, borderRadius: 2, background: `${p.preview.text}30` }} />)}
                          </div>
                        </div>
                        {/* Hero simulado */}
                        <div style={{ flex: 1, background: `${p.preview.accent}20`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ width: 40, height: 5, borderRadius: 3, background: p.preview.text, marginBottom: 4, opacity: 0.8 }} />
                            <div style={{ width: 28, height: 3, borderRadius: 2, background: p.preview.text, opacity: 0.4 }} />
                          </div>
                        </div>
                        {/* Cards simuladas */}
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: 18, borderRadius: 3, background: `${p.preview.text}15` }} />)}
                        </div>
                        {config.plantilla === p.id && <div className="mw-check-activa">✓</div>}
                      </div>
                      <div style={{ background: `${p.preview.bg}ee`, padding: "8px 10px" }}>
                        <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 800, color: p.preview.text, letterSpacing: "0.05em" }}>{p.nombre}</div>
                        <div style={{ fontSize: 9, color: `${p.preview.text}60`, fontFamily: "Inter,sans-serif", marginTop: 2 }}>{p.estilo}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logo */}
              <div className="mw-card">
                <div className="mw-card-titulo">🖼 Logo del sitio</div>
                <div className="mw-img-upload">
                  <div className="mw-img-preview">
                    {config.logo_url
                      ? <img src={config.logo_url} alt="Logo" />
                      : <div className="mw-img-placeholder">Sin logo</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="mw-field">
                      <label className="mw-label">URL del logo</label>
                      <input className="mw-input" value={config.logo_url} onChange={e => set("logo_url", e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="mw-hint">Recomendado: PNG transparente · Máx. 300x80px</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══ PASO 2: Personalización ═══ */}
          {paso === 2 && (
            <>
              <div className="mw-paso-titulo">Paso 2 de 6</div>
              <div className="mw-paso-h1">Personalización</div>
              <div className="mw-paso-desc">Colores del tema e imágenes del sitio.</div>

              <div className="mw-card">
                <div className="mw-card-titulo">🎨 Colores del tema</div>
                <div className="mw-colores">
                  {[
                    { key: "color_primario", label: "Color primario", desc: "Botones y destacados" },
                    { key: "color_secundario", label: "Color secundario", desc: "Header y footer" },
                    { key: "color_texto", label: "Color de texto", desc: "Texto principal" },
                    { key: "color_fondo", label: "Color de fondo", desc: "Fondo del sitio" },
                  ].map(c => (
                    <div key={c.key} className="mw-color-item">
                      <input
                        type="color"
                        value={config[c.key as keyof Config] as string}
                        onChange={e => set(c.key as keyof Config, e.target.value)}
                        style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", padding: 2, background: "transparent" }}
                      />
                      <div>
                        <div style={{ fontSize: 12, color: "#fff", fontFamily: "Inter,sans-serif" }}>{c.label}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{c.desc}</div>
                        <input
                          className="mw-color-input"
                          value={config[c.key as keyof Config] as string}
                          onChange={e => set(c.key as keyof Config, e.target.value)}
                          style={{ marginTop: 4, width: 90 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 6, background: `${config.color_primario}15`, border: `1px solid ${config.color_primario}30`, display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: config.color_primario }} />
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: config.color_secundario }} />
                  <div style={{ flex: 1, height: 28, borderRadius: 6, background: config.color_fondo, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", paddingLeft: 10 }}>
                    <span style={{ fontSize: 10, color: config.color_texto, fontFamily: "Inter,sans-serif" }}>Vista previa de colores</span>
                  </div>
                </div>
              </div>

              <div className="mw-card">
                <div className="mw-card-titulo">🖼 Imágenes del sitio</div>
                <div className="mw-row">
                  <div className="mw-field">
                    <label className="mw-label">Imagen de portada (cover)</label>
                    <input className="mw-input" value={config.cover_url} onChange={e => set("cover_url", e.target.value)} placeholder="https://..." />
                    <div className="mw-hint">1920×360px · Imagen principal del hero</div>
                    {config.cover_url && (
                      <div style={{ marginTop: 8, height: 80, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <img src={config.cover_url} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                  </div>
                  <div className="mw-field">
                    <label className="mw-label">Foto "Sobre mí"</label>
                    <input className="mw-input" value={config.foto_sobre_mi_url} onChange={e => set("foto_sobre_mi_url", e.target.value)} placeholder="https://..." />
                    <div className="mw-hint">1024×768px · Foto en sección Sobre mí</div>
                    {config.foto_sobre_mi_url && (
                      <div style={{ marginTop: 8, height: 80, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <img src={config.foto_sobre_mi_url} alt="Sobre mi" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══ PASO 3: Módulos ═══ */}
          {paso === 3 && (
            <>
              <div className="mw-paso-titulo">Paso 3 de 6</div>
              <div className="mw-paso-h1">Módulos</div>
              <div className="mw-paso-desc">Activá o desactivá las secciones y funcionalidades de tu sitio.</div>

              <div className="mw-card">
                <div className="mw-card-titulo">⚙️ Funcionalidades activas</div>
                <Toggle label="Formulario de contacto" desc="Los visitantes pueden enviarte un mensaje desde la web" value={config.mostrar_formulario_contacto} onChange={v => set("mostrar_formulario_contacto", v)} />
                <Toggle label="Formulario de tasación" desc="Los propietarios pueden solicitar una tasación online" value={config.mostrar_formulario_tasacion} onChange={v => set("mostrar_formulario_tasacion", v)} />
                <Toggle label="Propiedades destacadas" desc="Mostrá propiedades seleccionadas en la página de inicio" value={config.mostrar_propiedades_destacadas} onChange={v => set("mostrar_propiedades_destacadas", v)} />
                <Toggle label="Sección Sobre mí" desc="Presentá tu trayectoria y especialidades" value={config.mostrar_sobre_mi} onChange={v => set("mostrar_sobre_mi", v)} />
                <Toggle label="Testimonios de clientes" desc="Mostrá las opiniones de tus clientes" value={config.mostrar_testimonios} onChange={v => set("mostrar_testimonios", v)} />
                <Toggle label="Blog" desc="Publicá artículos sobre el mercado inmobiliario" value={config.mostrar_blog} onChange={v => set("mostrar_blog", v)} />
              </div>
            </>
          )}

          {/* ═══ PASO 4: Contenido ═══ */}
          {paso === 4 && (
            <>
              <div className="mw-paso-titulo">Paso 4 de 6</div>
              <div className="mw-paso-h1">Contenido</div>
              <div className="mw-paso-desc">Los textos que van a aparecer en tu sitio.</div>

              <div className="mw-card">
                <div className="mw-card-titulo">✍️ Textos principales</div>
                <div className="mw-field">
                  <label className="mw-label">Título principal</label>
                  <input className="mw-input" value={config.titulo_sitio} onChange={e => set("titulo_sitio", e.target.value)} placeholder="Tu nombre · Corredor Inmobiliario" />
                </div>
                <div className="mw-field">
                  <label className="mw-label">Subtítulo</label>
                  <input className="mw-input" value={config.subtitulo} onChange={e => set("subtitulo", e.target.value)} placeholder="Especialista en propiedades en Rosario y zona norte" />
                </div>
              </div>

              <div className="mw-card">
                <div className="mw-card-titulo">👤 Sobre mí</div>
                <div className="mw-field">
                  <label className="mw-label">Descripción profesional</label>
                  <textarea className="mw-textarea" value={config.descripcion_profesional} onChange={e => set("descripcion_profesional", e.target.value)} placeholder="Contá quién sos, tu trayectoria y por qué los clientes deberían elegirte..." rows={5} />
                </div>
                <div className="mw-field">
                  <label className="mw-label">Años de experiencia</label>
                  <input className="mw-input" type="number" value={config.anos_experiencia} onChange={e => set("anos_experiencia", e.target.value)} placeholder="10" style={{ maxWidth: 100 }} />
                </div>
              </div>
            </>
          )}

          {/* ═══ PASO 5: SEO & Redes ═══ */}
          {paso === 5 && (
            <>
              <div className="mw-paso-titulo">Paso 5 de 6</div>
              <div className="mw-paso-h1">SEO & Redes Sociales</div>
              <div className="mw-paso-desc">Optimizá tu sitio para los buscadores y conectá tus redes.</div>

              <div className="mw-card">
                <div className="mw-card-titulo">🔍 SEO · Optimización para buscadores</div>
                <div className="mw-field">
                  <label className="mw-label">Título del sitio (title tag)</label>
                  <input className="mw-input" value={config.seo_titulo} onChange={e => set("seo_titulo", e.target.value)} placeholder="Juan García · Corredor Inmobiliario Rosario" />
                </div>
                <div className="mw-row">
                  <div className="mw-field">
                    <label className="mw-label">Meta description</label>
                    <textarea className="mw-textarea" value={config.seo_descripcion} onChange={e => set("seo_descripcion", e.target.value)} placeholder="Corredor inmobiliario matriculado en Rosario. Compra, venta y alquiler de propiedades..." rows={3} style={{ minHeight: 70 }} />
                    <div className="mw-hint">{config.seo_descripcion.length}/160 caracteres recomendados</div>
                  </div>
                  <div className="mw-field">
                    <label className="mw-label">Meta keywords</label>
                    <textarea className="mw-textarea" value={config.seo_keywords} onChange={e => set("seo_keywords", e.target.value)} placeholder="corredor inmobiliario rosario, propiedades rosario, venta departamentos..." rows={3} style={{ minHeight: 70 }} />
                    <div className="mw-hint">Separadas por coma</div>
                  </div>
                </div>
              </div>

              <div className="mw-card">
                <div className="mw-card-titulo">📱 Redes sociales</div>
                {[
                  { key: "instagram", icon: "📸", label: "Instagram", placeholder: "https://instagram.com/tucuenta" },
                  { key: "facebook", icon: "👤", label: "Facebook", placeholder: "https://facebook.com/tupage" },
                  { key: "twitter", icon: "🐦", label: "Twitter / X", placeholder: "https://twitter.com/tucuenta" },
                  { key: "linkedin", icon: "💼", label: "LinkedIn", placeholder: "https://linkedin.com/in/tuperfil" },
                  { key: "tiktok", icon: "🎵", label: "TikTok", placeholder: "https://tiktok.com/@tucuenta" },
                  { key: "whatsapp", icon: "💬", label: "WhatsApp", placeholder: "5493415001234" },
                ].map(s => (
                  <div key={s.key} className="mw-social-item">
                    <div className="mw-social-icon">{s.icon}</div>
                    <div style={{ flex: 1 }}>
                      <label className="mw-label" style={{ marginBottom: 4 }}>{s.label}</label>
                      <input className="mw-input" value={config[s.key as keyof Config] as string} onChange={e => set(s.key as keyof Config, e.target.value)} placeholder={s.placeholder} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ PASO 6: Avanzado ═══ */}
          {paso === 6 && (
            <>
              <div className="mw-paso-titulo">Paso 6 de 6</div>
              <div className="mw-paso-h1">Avanzado</div>
              <div className="mw-paso-desc">Propiedades destacadas, analítica y scripts personalizados.</div>

              <div className="mw-card">
                <div className="mw-card-titulo">⭐ Propiedades destacadas</div>
                <div className="mw-field">
                  <label className="mw-label">Cantidad de propiedades en el inicio</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[3, 4, 6, 8, 9, 12].map(n => (
                      <button key={n} type="button"
                        style={{ padding: "7px 14px", borderRadius: 4, border: `1px solid ${parseInt(config.limite_propiedades_home) === n ? "#cc0000" : "rgba(255,255,255,0.1)"}`, background: parseInt(config.limite_propiedades_home) === n ? "rgba(200,0,0,0.1)" : "transparent", color: parseInt(config.limite_propiedades_home) === n ? "#fff" : "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        onClick={() => set("limite_propiedades_home", n.toString())}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mw-hint">Las propiedades marcadas como "Destacada web" en tu cartera aparecerán primero</div>
                </div>
              </div>

              <div className="mw-card">
                <div className="mw-card-titulo">📊 Google Analytics</div>
                <div className="mw-field">
                  <label className="mw-label">ID de seguimiento</label>
                  <input className="mw-input" value={config.google_analytics} onChange={e => set("google_analytics", e.target.value)} placeholder="G-XXXXXXXXXX o UA-XXXXXXXXX-X" />
                  <div className="mw-hint">Medí las visitas a tu web desde Google Analytics</div>
                </div>
              </div>

              <div className="mw-card">
                <div className="mw-card-titulo">💻 Scripts personalizados</div>
                <div className="mw-field">
                  <label className="mw-label">Script en &lt;head&gt;</label>
                  <textarea className="mw-textarea" value={config.script_header} onChange={e => set("script_header", e.target.value)} placeholder="<!-- Pegá tu script acá -->" rows={4} style={{ fontFamily: "monospace", fontSize: 12 }} />
                </div>
                <div className="mw-field">
                  <label className="mw-label">Script antes del &lt;/body&gt;</label>
                  <textarea className="mw-textarea" value={config.script_footer} onChange={e => set("script_footer", e.target.value)} placeholder="<!-- Pegá tu script acá -->" rows={4} style={{ fontFamily: "monospace", fontSize: 12 }} />
                </div>
              </div>
            </>
          )}

          {/* ── Nav botones ── */}
          <div className="mw-nav">
            <button className="mw-btn-prev" onClick={() => setPaso(p => Math.max(1, p - 1))} style={{ visibility: paso === 1 ? "hidden" : "visible" }}>
              ← Anterior
            </button>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {guardadoOk && <span style={{ fontSize: 12, color: "#22c55e", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>✓ Guardado</span>}
              <button className="mw-btn-guardar" onClick={guardar} disabled={guardando}>
                {guardando ? <><span className="mw-spinner" />Guardando...</> : "💾 Guardar cambios"}
              </button>
              {paso < 6 && (
                <button className="mw-btn-next" onClick={() => { guardar(); setPaso(p => Math.min(6, p + 1)); }}>
                  Siguiente →
                </button>
              )}
              {paso === 6 && urlWeb && (
                <a href={urlWeb} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  🌐 Ver mi web →
                </a>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
