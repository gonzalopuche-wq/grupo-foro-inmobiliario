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

const TIPO_CONFIG: Record<Resultado["tipo"], { label: string; color: string; icon: string }> = {
  propiedad: { label: "Propiedad", color: "#3b82f6", icon: "🏠" },
  contacto:  { label: "Contacto",  color: "#22c55e", icon: "👤" },
  foro:      { label: "Foro",      color: "#a78bfa", icon: "💬" },
  negocio:   { label: "Negocio",   color: "#f97316", icon: "🤝" },
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
        supabase.from("foro_topics").select("id,titulo,slug").ilike("titulo", `%${term}%`).limit(4),
        supabase.from("crm_negocios").select("id,titulo,etapa").ilike("titulo", `%${term}%`).eq("user_id", uid).limit(4),
      ]);
      const res: Resultado[] = [];
      for (const p of props.data ?? []) res.push({ tipo: "propiedad", id: p.id, titulo: p.titulo ?? "Sin título", subtitulo: `${p.tipo ?? ""}${p.direccion ? " — " + p.direccion : ""}`, href: `/crm/cartera/ficha/${p.id}` });
      for (const c of contactos.data ?? []) res.push({ tipo: "contacto", id: c.id, titulo: `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim() || "Sin nombre", subtitulo: c.email ?? "", href: `/crm` });
      for (const f of foro.data ?? []) res.push({ tipo: "foro", id: f.id, titulo: f.titulo ?? "", subtitulo: "Tema del Foro GFI®", href: `/foro/${f.slug ?? f.id}` });
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
      <style>{`@keyframes gspin{to{transform:rotate(360deg)}}`}</style>
      {/* Botón de búsqueda */}
      <button
        onClick={() => setAbierto(true)}
        title="Búsqueda global (Ctrl+K)"
        style={{ display: "flex", alignItems: "center", gap: 8, width: "calc(100% - 32px)", margin: "8px 16px", padding: "7px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, cursor: "pointer", color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif", fontSize: 12, textAlign: "left", transition: "border-color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
      >
        <span style={{ fontSize: 13 }}>🔍</span>
        <span style={{ flex: 1 }}>Buscar…</span>
        <kbd style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, padding: "1px 5px" }}>⌘K</kbd>
      </button>

      {/* Modal overlay */}
      {abierto && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80, paddingLeft: 16, paddingRight: 16 }}
          onClick={() => setAbierto(false)}
        >
          <div
            style={{ width: "100%", maxWidth: 620, background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.9)", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Input */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize: 18, opacity: 0.5 }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar propiedades, contactos, foro, negocios…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 15 }}
              />
              {cargando && (
                <div style={{ width: 16, height: 16, border: "2px solid rgba(204,0,0,0.3)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "gspin 0.7s linear infinite", flexShrink: 0 }} />
              )}
              <kbd style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>ESC</kbd>
            </div>

            {/* Resultados */}
            {resultados.length > 0 ? (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {resultados.map((r, i) => {
                  const cfg = TIPO_CONFIG[r.tipo];
                  return (
                    <div
                      key={r.id}
                      onClick={() => navegar(r.href)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)", background: i === selIdx ? "rgba(255,255,255,0.05)" : "transparent", transition: "background 0.1s" }}
                      onMouseEnter={() => setSelIdx(i)}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#fff", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.titulo}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subtitulo}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : query.trim().length >= 2 && !cargando ? (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>
                Sin resultados para <strong style={{ color: "rgba(255,255,255,0.5)" }}>{query}</strong>
              </div>
            ) : (
              <div style={{ padding: "18px 18px" }}>
                <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.2)", marginBottom: 10 }}>BUSCA EN</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(TIPO_CONFIG).map(([, cfg]) => (
                    <div key={cfg.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", background: "rgba(255,255,255,0.04)", padding: "4px 10px", borderRadius: 6 }}>
                      <span>{cfg.icon}</span> {cfg.label}s
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif" }}>
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
