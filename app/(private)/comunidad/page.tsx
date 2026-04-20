"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

interface Grupo {
  id: string;
  nombre: string;
  icono: string;
  tipo: string;
  va_al_mir: boolean;
  solo_matriculado: boolean;
  orden: number;
  ultimo_mensaje?: string;
  ultimo_autor?: string;
  ultimo_at?: string;
}

export default function ComunidadPage() {
  const router = useRouter();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoUsuario, setTipoUsuario] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("tipo")
        .eq("id", session.user.id)
        .single();

      const tipo = perfil?.tipo ?? "corredor";
      setTipoUsuario(tipo);

      let query = supabase
        .from("grupos_chat")
        .select("*")
        .eq("activo", true)
        .order("orden");

      if (tipo === "colaborador") {
        query = query.eq("solo_matriculado", false);
      }

      const { data: gruposData } = await query;

      if (gruposData) {
        const gruposConMensajes = await Promise.all(
          gruposData.map(async (g) => {
            const { data: msgs } = await supabase
              .from("mensajes_chat")
              .select("texto, created_at, perfiles(nombre, apellido)")
              .eq("grupo_id", g.id)
              .order("created_at", { ascending: false })
              .limit(1);
            const ultimo = msgs?.[0];
            return {
              ...g,
              ultimo_mensaje: ultimo?.texto ?? null,
              ultimo_autor: ultimo?.perfiles
                ? `${(ultimo.perfiles as any).nombre} ${(ultimo.perfiles as any).apellido}`
                : null,
              ultimo_at: ultimo?.created_at ?? null,
            };
          })
        );
        setGrupos(gruposConMensajes);
      }
      setLoading(false);
    };
    init();
  }, []);

  const tiempoRelativo = (fecha: string) => {
    if (!fecha) return "";
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    const hs = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);
    if (min < 1) return "ahora";
    if (min < 60) return `${min}m`;
    if (hs < 24) return `${hs}h`;
    if (dias === 1) return "ayer";
    return `${dias}d`;
  };

  const gruposOperaciones = grupos.filter(g => g.tipo === "operaciones");
  const gruposComunidad = grupos.filter(g => g.tipo === "comunidad");

  const GrupoItem = ({ g }: { g: Grupo }) => (
    <div
      onClick={() => router.push(`/comunidad/${g.id}`)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", cursor: "pointer",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        transition: "background 0.15s",
      }}
      onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseOut={e => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: g.va_al_mir ? "rgba(200,0,0,0.12)" : "rgba(255,255,255,0.06)",
        border: g.va_al_mir ? "1px solid rgba(200,0,0,0.25)" : "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>
        {g.icono}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
            color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {g.nombre}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {g.va_al_mir && (
              <span style={{
                fontSize: 8, fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "#cc0000", background: "rgba(200,0,0,0.1)",
                border: "1px solid rgba(200,0,0,0.2)", padding: "2px 5px", borderRadius: 3,
              }}>MIR</span>
            )}
            {g.ultimo_at && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Inter, sans-serif" }}>
                {tiempoRelativo(g.ultimo_at)}
              </span>
            )}
          </div>
        </div>
        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter, sans-serif",
          marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {g.ultimo_autor && g.ultimo_mensaje
            ? `${g.ultimo_autor}: ${g.ultimo_mensaje}`
            : "Sin mensajes aún"}
        </p>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
          Comunidad GFI®
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}>
          {grupos.length} grupos · Los grupos con badge MIR cargan automáticamente al Motor de Match
        </p>
      </div>

      {/* Operaciones */}
      <div style={{
        background: "#111", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10, overflow: "hidden", marginBottom: 20,
      }}>
        <div style={{
          padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 10, fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
            Operaciones
          </span>
          <span style={{ fontSize: 9, color: "#cc0000", background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.2)", padding: "1px 6px", borderRadius: 3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em" }}>
            → MIR automático
          </span>
        </div>
        {gruposOperaciones.map(g => <GrupoItem key={g.id} g={g} />)}
      </div>

      {/* Comunidad */}
      <div style={{
        background: "#111", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10, overflow: "hidden",
      }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 10, fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
            Comunidad
          </span>
        </div>
        {gruposComunidad.map(g => <GrupoItem key={g.id} g={g} />)}
      </div>
    </div>
  );
}
