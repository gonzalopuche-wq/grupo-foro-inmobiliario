"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

interface Resultado {
  tipo: "propiedad" | "contacto" | "foro" | "negocio";
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
}

// GFI design-system palette per category
const TIPO_CONFIG: Record<Resultado["tipo"], { label: string; color: string; bg: string; border: string; icon: string }> = {
  propiedad: { label: "Propiedad", color: "#1e4a7a", bg: "rgba(10,37,64,0.35)", border: "rgba(30,74,122,0.4)",  icon: "🏠" },
  contacto:  { label: "Contacto",  color: "#3abab6", bg: "rgba(10,61,46,0.35)", border: "rgba(58,186,182,0.3)", icon: "👤" },
  foro:      { label: "Foro",      color: "#990000", bg: "rgba(153,0,0,0.12)",  border: "rgba(153,0,0,0.3)",    icon: "💬" },
  negocio:   { label: "Negocio",   color: "#d4960c", bg: "rgba(196,74,0,0.18)", border: "rgba(249,115,22,0.35)", icon: "🤝" },
};

export default function BusquedaGlobal() {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setAbierto(v => !v); }
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (abierto) { setTimeout(() => inputRef.current?.focus(), 80); setSelIdx(0); }
    else { setQuery(""); setResultados([]); }
  }, [abierto]);

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResultados([]); return; }
    setCargando(true);
    try {
      const term = q.trim();
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id;
      if (!uid) return;
      const [props, contactos, foro, negocios] = await Promise.all([
        supabase.from("cartera_propiedades").select("id,titulo,direccion,tipo").or(`titulo.ilike.%${term}%,direccion.ilike.%${term}%`).eq("perfil_id", uid).limit(4),
        supabase.from("crm_contactos").select("id,nombre,apellido,email").or(`nombre.ilike.%${term}%,apellido.ilike.%${term}%,email.ilike.%${term}%`).eq("perfil_id", uid).limit(4),
        supabase.from("forum_topics").select("id,title").ilike("title", `%${term}%`).limit(4),
        supabase.from("crm_negocios").select("id,titulo,etapa").ilike("titulo", `%${term}%`).eq("perfil_id", uid).limit(4),
      ]);
      const res: Resultado[] = [];
      for (const p of props.data ?? []) res.push({ tipo: "propiedad", id: p.id, titulo: p.titulo ?? "Sin título", subtitulo: `${p.tipo ?? ""}${p.direccion ? " — " + p.direccion : ""}`, href: `/crm/cartera/ficha/${p.id}` });
      for (const c of contactos.data ?? []) res.push({ tipo: "contacto", id: c.id, titulo: `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim() || "Sin nombre", subtitulo: c.email ?? "", href: `/crm` });
      for (const f of foro.data ?? []) res.push({ tipo: "foro", id: f.id, titulo: f.title ?? "", subtitulo: "Tema del Foro GFI®", href: `/foro/${f.id}` });
      for (const n of negocios.data ?? []) res.push({ tipo: "negocio", id: n.id, titulo: n.titulo ?? "", subtitulo: `Etapa: ${n.etapa ?? "—"}`, href: `/crm/negocios` });
      setResultados(res);
      setSelIdx(0);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscar(query), 280);
    return () => clearTimeout(t);
  }, [query, buscar]);

  const navegar = (href: string) => { router.push(href); setAbierto(false); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i + 1, resultados.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && resultados[selIdx]) navegar(resultados[selIdx].href);
  };

  return (
    <>
      {/* Botón de búsqueda en sidebar */}
      <button
        onClick={() => setAbierto(true)}
        title="Búsqueda global (Ctrl+K)"
        style={{ display: "flex", alignItems: "center", gap: 8, width: "calc(100% - 32px)", margin: "8px 16px", padding: "7px 12px", background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border)", borderRadius: "var(--gfi-radius-sm)", cursor: "pointer", color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)", fontSize: 12, textAlign: "left", transition: "var(--gfi-transition)" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--gfi-border)")}
      >
        <span style={{ fontSize: 13, opacity: 0.6 }}>🔍</span>
        <span style={{ flex: 1 }}>Buscar…</span>
        <kbd style={{ fontSize: 9, color: "var(--gfi-text-muted)", background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)", borderRadius: 3, padding: "1px 5px", fontFamily: "var(--font-mono)" }}>⌘K</kbd>
      </button>

      {/* Modal overlay — glassmorphism */}
      {abierto && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(4,6,8,0.82)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80, paddingLeft: 16, paddingRight: 16 }}
          onClick={() => setAbierto(false)}
        >
          <div
            style={{ width: "100%", maxWidth: 620, background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border)", borderRadius: "var(--gfi-radius-lg)", boxShadow: "var(--gfi-shadow-lg)", overflow: "hidden", position: "relative" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--gfi-red-gradient)", borderRadius: "var(--gfi-radius-lg) var(--gfi-radius-lg) 0 0" }} />

            {/* Input row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 14px", borderBottom: "1px solid var(--gfi-border)" }}>
              <span style={{ fontSize: 16, opacity: 0.45, flexShrink: 0 }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar propiedades, contactos, foro, negocios…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--gfi-text-primary)", fontFamily: "var(--font-body)", fontSize: 15 }}
              />
              {cargando && (
                <div style={{ width: 16, height: 16, border: "2px solid var(--gfi-red-soft)", borderTopColor: "var(--gfi-red)", borderRadius: "50%", animation: "gfi-spin 0.7s linear infinite", flexShrink: 0 }} />
              )}
              <kbd style={{ fontSize: 10, color: "var(--gfi-text-muted)", background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)", borderRadius: "var(--gfi-radius-sm)", padding: "2px 7px", flexShrink: 0, fontFamily: "var(--font-mono)" }}>ESC</kbd>
            </div>

            {/* Resultados */}
            {resultados.length > 0 ? (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {resultados.map((r, i) => {
                  const cfg = TIPO_CONFIG[r.tipo];
                  const isSelected = i === selIdx;
                  return (
                    <div
                      key={r.id}
                      onClick={() => navegar(r.href)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)", background: isSelected ? "var(--gfi-bg-elevated)" : "transparent", transition: "background var(--gfi-transition)" }}
                      onMouseEnter={() => setSelIdx(i)}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--gfi-text-primary)", fontFamily: "var(--font-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.titulo}</div>
                        <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{r.subtitulo}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase", color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: "var(--gfi-radius-sm)", padding: "2px 7px", flexShrink: 0 }}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : query.trim().length >= 2 && !cargando ? (
              <div style={{ padding: "36px 18px", textAlign: "center", color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)", fontSize: 13 }}>
                Sin resultados para <strong style={{ color: "var(--gfi-text-secondary)" }}>{query}</strong>
              </div>
            ) : (
              <div style={{ padding: "18px 18px" }}>
                <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 12 }}>BUSCA EN</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(TIPO_CONFIG).map(([, cfg]) => (
                    <div key={cfg.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: cfg.color, fontFamily: "var(--font-body)", background: cfg.bg, border: `1px solid ${cfg.border}`, padding: "4px 10px", borderRadius: "var(--gfi-radius-sm)" }}>
                      <span>{cfg.icon}</span> {cfg.label}s
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)", opacity: 0.7 }}>
                  Navegá entre resultados con ↑↓ · Enter para abrir · Esc para cerrar
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
