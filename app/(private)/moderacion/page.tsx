"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

interface Denuncia {
  id: string;
  denunciante_id: string;
  tipo_contenido: string;
  contenido_id: string;
  motivo: string;
  descripcion: string | null;
  estado: string;
  revisado_por: string | null;
  resolucion_notas: string | null;
  accion_tomada: string | null;
  created_at: string;
  updated_at: string;
  perfiles?: { nombre: string; apellido: string } | null;
}

const MOTIVO_LABELS: Record<string, string> = {
  spam: "📢 Spam", ofensivo: "⚠️ Ofensivo", acoso: "🚫 Acoso",
  incorrecto: "❌ Incorrecto", otro: "💬 Otro",
};

const TIPO_LABELS: Record<string, string> = {
  forum_topic: "Tema foro", forum_reply: "Respuesta foro",
  perfil: "Perfil", comentario: "Comentario",
};

const ESTADO_COLORS: Record<string, { color: string; bg: string }> = {
  pendiente: { color: "#eab308", bg: "rgba(234,179,8,0.1)" },
  revisado:  { color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  resuelto:  { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  rechazado: { color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
};

export default function ModeracionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [denunciaActiva, setDenunciaActiva] = useState<Denuncia | null>(null);
  const [resolucionNotas, setResolucionNotas] = useState("");
  const [accionTomada, setAccionTomada] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", session.user.id).single();
      if (p?.tipo !== "admin") { router.push("/dashboard"); return; }
      setToken(session.access_token);
      await cargarDenuncias(session.access_token, "pendiente");
    };
    init();
  }, []);

  const cargarDenuncias = async (tok: string, estado: string) => {
    setLoading(true);
    const res = await fetch(`/api/denuncias?estado=${estado}`, { headers: { Authorization: `Bearer ${tok}` } });
    if (res.ok) {
      const d = await res.json();
      setDenuncias(d.denuncias ?? []);
    }
    setLoading(false);
  };

  const cambiarFiltro = async (estado: string) => {
    setFiltroEstado(estado);
    if (token) await cargarDenuncias(token, estado);
  };

  const resolver = async (estado: string) => {
    if (!denunciaActiva || !token) return;
    setProcesando(true);
    const res = await fetch("/api/denuncias", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: denunciaActiva.id,
        estado,
        resolucion_notas: resolucionNotas || null,
        accion_tomada: accionTomada || null,
      }),
    });
    if (res.ok) {
      setDenuncias(prev => prev.filter(d => d.id !== denunciaActiva.id));
      setDenunciaActiva(null);
      setResolucionNotas(""); setAccionTomada("");
    }
    setProcesando(false);
  };

  const abrirEnForo = (d: Denuncia) => {
    if (d.tipo_contenido === "forum_topic") router.push(`/foro`);
    else if (d.tipo_contenido === "perfil") router.push(`/padron-gfi`);
  };

  const totalPendientes = denuncias.filter(d => d.estado === "pendiente").length;

  return (
    <div style={{ fontFamily: "Inter,sans-serif", color: "#fff", maxWidth: 960, margin: "0 auto" }}>
      <style>{`
        .mod-tab { padding: 8px 18px; border: none; border-bottom: 2px solid transparent; background: transparent; color: rgba(255,255,255,0.4); font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .mod-tab.active { color: #fff; border-bottom-color: #cc0000; }
        .mod-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; font-family: Inter,sans-serif; box-sizing: border-box; }
        .mod-input:focus { outline: none; border-color: rgba(200,0,0,0.5); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 28 }}>🛡️</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>
            Panel de Moderación
            {filtroEstado === "pendiente" && totalPendientes > 0 && (
              <span style={{ marginLeft: 10, fontSize: 13, background: "#cc0000", color: "#fff", borderRadius: 10, padding: "2px 8px", verticalAlign: "middle" }}>{totalPendientes}</span>
            )}
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Gestión de denuncias y moderación de contenidos GFI®</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 24, display: "flex", gap: 0 }}>
        {["pendiente","revisado","resuelto","rechazado","todas"].map(e => (
          <button key={e} className={`mod-tab${filtroEstado === e ? " active" : ""}`} onClick={() => cambiarFiltro(e)}>
            {e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>Cargando denuncias...</div>
      ) : denuncias.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p>No hay denuncias {filtroEstado !== "todas" ? `en estado "${filtroEstado}"` : ""}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {denuncias.map(d => {
            const est = ESTADO_COLORS[d.estado] ?? ESTADO_COLORS.pendiente;
            return (
              <div key={d.id} style={{ padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 10, color: est.color, background: est.bg }}>
                      {d.estado.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 8 }}>
                      {TIPO_LABELS[d.tipo_contenido] ?? d.tipo_contenido}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                      {MOTIVO_LABELS[d.motivo] ?? d.motivo}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
                      {new Date(d.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: d.descripcion ? 4 : 0 }}>
                    Denunciante: <span style={{ color: "rgba(255,255,255,0.65)" }}>{d.perfiles?.nombre} {d.perfiles?.apellido}</span>
                    {" · "}ID: <code style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>{d.contenido_id.slice(0, 8)}…</code>
                  </div>
                  {d.descripcion && (
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, fontStyle: "italic" }}>
                      "{d.descripcion}"
                    </p>
                  )}
                  {d.resolucion_notas && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "rgba(96,165,250,0.8)", background: "rgba(96,165,250,0.06)", padding: "5px 10px", borderRadius: 6 }}>
                      ✏️ Resolución: {d.resolucion_notas}
                      {d.accion_tomada && ` · Acción: ${d.accion_tomada}`}
                    </div>
                  )}
                </div>
                {d.estado === "pendiente" && (
                  <button
                    onClick={() => { setDenunciaActiva(d); setResolucionNotas(""); setAccionTomada(""); }}
                    style={{ padding: "7px 14px", background: "rgba(200,0,0,0.15)", border: "1px solid rgba(200,0,0,0.3)", borderRadius: 6, color: "#cc0000", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Montserrat,sans-serif" }}>
                    Revisar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal revisar denuncia */}
      {denunciaActiva && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setDenunciaActiva(null); }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 26, width: "100%", maxWidth: 500, position: "relative" }}>
            <button style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }} onClick={() => setDenunciaActiva(null)}>&times;</button>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>Revisar denuncia</h3>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px", marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                Tipo: <strong style={{ color: "#fff" }}>{TIPO_LABELS[denunciaActiva.tipo_contenido]}</strong>
                {" · "}Motivo: <strong style={{ color: "#fff" }}>{MOTIVO_LABELS[denunciaActiva.motivo]}</strong>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                Denunciante: {denunciaActiva.perfiles?.nombre} {denunciaActiva.perfiles?.apellido}
              </div>
              {denunciaActiva.descripcion && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>"{denunciaActiva.descripcion}"</p>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                Notas de resolución
              </label>
              <textarea
                className="mod-input"
                rows={3}
                placeholder="Describí cómo se resolvió..."
                value={resolucionNotas}
                onChange={e => setResolucionNotas(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                Acción tomada
              </label>
              <select className="mod-input" value={accionTomada} onChange={e => setAccionTomada(e.target.value)} style={{ cursor: "pointer" }}>
                <option value="">Sin acción específica</option>
                <option value="sin_accion">Sin acción</option>
                <option value="advertencia">Advertencia al usuario</option>
                <option value="suspension">Suspensión temporal</option>
                <option value="eliminacion">Eliminación del contenido</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => resolver("rechazado")} disabled={procesando} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                Rechazar
              </button>
              <button onClick={() => resolver("revisado")} disabled={procesando} style={{ flex: 1, padding: "10px", background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 8, color: "#60a5fa", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                Marcar revisado
              </button>
              <button onClick={() => resolver("resuelto")} disabled={procesando} style={{ flex: 1, padding: "10px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, color: "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                {procesando ? "..." : "Resolver ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
