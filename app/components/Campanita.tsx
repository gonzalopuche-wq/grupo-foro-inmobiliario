"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  url?: string;
  created_at: string;
}

const ICONOS: Record<string, string> = {
  match_mir: "◈",
  suscripcion: "💰",
  biblioteca: "📚",
  evento: "📅",
  cocir: "🏛️",
  sistema: "⚙",
  general: "🔔",
};

export default function Campanita({ userId }: { userId: string }) {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const cargar = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      setNotificaciones(data);
      setNoLeidas(data.filter((n: Notificacion) => !n.leida).length);
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [userId]);

  // Badge en el ícono de la app
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    if (noLeidas > 0) {
      (navigator as any).setAppBadge(noLeidas).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, [noLeidas]);

  // Tiempo real
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notificaciones_${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notificaciones",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const nueva = payload.new as Notificacion;
        setNotificaciones(prev => [nueva, ...prev]);
        setNoLeidas(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Cerrar al clickear afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const marcarLeida = async (id: string) => {
    await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    setNoLeidas(prev => Math.max(0, prev - 1));
  };

  const marcarTodasLeidas = async () => {
    await supabase.rpc("marcar_todas_leidas", { p_user_id: userId });
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    setNoLeidas(0);
  };

  const handleClick = async (n: Notificacion) => {
    if (!n.leida) await marcarLeida(n.id);
    if (n.url) router.push(n.url);
    setAbierto(false);
  };

  const tiempoRelativo = (fecha: string) => {
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    const hs = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);
    if (min < 1) return "ahora";
    if (min < 60) return `${min}m`;
    if (hs < 24) return `${hs}h`;
    return `${dias}d`;
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setAbierto(o => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          position: "relative", padding: "6px", borderRadius: "6px",
          color: "rgba(255,255,255,0.5)", fontSize: "18px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        title="Notificaciones"
      >
        🔔
        {noLeidas > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            background: "#cc0000", color: "#fff",
            fontSize: "9px", fontWeight: 800,
            fontFamily: "Montserrat, sans-serif",
            borderRadius: "10px", minWidth: "16px", height: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1,
          }}>
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 340, background: "#141414",
          border: "1px solid rgba(200,0,0,0.2)", borderRadius: "8px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)", zIndex: 500, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{
              fontFamily: "Montserrat, sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)",
            }}>
              Notificaciones
              {noLeidas > 0 && (
                <span style={{
                  marginLeft: 8, background: "rgba(200,0,0,0.15)", color: "#cc0000",
                  fontSize: 9, padding: "2px 6px", borderRadius: 3,
                }}>
                  {noLeidas} nuevas
                </span>
              )}
            </span>
            {noLeidas > 0 && (
              <button onClick={marcarTodasLeidas} style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.3)",
                fontSize: 10, cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}>
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                Cargando...
              </div>
            ) : notificaciones.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                Sin notificaciones
              </div>
            ) : (
              notificaciones.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: "flex", gap: 10, padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: n.url ? "pointer" : "default",
                    background: n.leida ? "transparent" : "rgba(200,0,0,0.05)",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, background: "rgba(255,255,255,0.05)",
                    borderRadius: 6, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 14, flexShrink: 0,
                  }}>
                    {ICONOS[n.tipo] ?? "🔔"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: n.leida ? 500 : 700,
                        color: n.leida ? "rgba(255,255,255,0.6)" : "#fff",
                        fontFamily: "Inter, sans-serif", lineHeight: 1.4,
                      }}>
                        {n.titulo}
                      </span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
                        {tiempoRelativo(n.created_at)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 10, color: "rgba(255,255,255,0.4)",
                      fontFamily: "Inter, sans-serif", lineHeight: 1.5, marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {n.mensaje}
                    </p>
                  </div>
                  {!n.leida && (
                    <div style={{ width: 6, height: 6, background: "#cc0000", borderRadius: "50%", flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notificaciones.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <button
                onClick={() => { router.push("/notificaciones"); setAbierto(false); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 10, cursor: "pointer" }}
              >
                Ver todas →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
