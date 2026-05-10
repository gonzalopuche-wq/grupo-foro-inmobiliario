"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Opcion { id: string; texto: string; }
interface Encuesta {
  id: string;
  creador_id: string;
  titulo: string;
  descripcion: string | null;
  opciones: Opcion[];
  activa: boolean;
  fecha_cierre: string | null;
  created_at: string;
  creador?: { nombre: string; apellido: string } | null;
}
interface Voto { encuesta_id: string; opcion_id: string; }
interface Conteo { [opcionId: string]: number }

const MOTIVOS_MERCADO = [
  "¿Cuál es el barrio con mayor demanda de alquileres hoy?",
  "¿Qué tipo de propiedad es más fácil de vender actualmente?",
  "¿Cómo impactó la actualización del dólar en los precios de venta?",
  "¿Usás alguna app de IA para redactar descripciones?",
  "¿Cuál es tu % de honorarios habitual en ventas?",
];

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function EncuestasPage() {
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [votos, setVotos] = useState<Voto[]>([]);
  const [conteos, setConteos] = useState<Record<string, Conteo>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ titulo: "", descripcion: "", opciones: ["", ""], fecha_cierre: "" });
  const [guardando, setGuardando] = useState(false);
  const [votando, setVotando] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const cargar = async (uid: string) => {
    const { data: enc } = await supabase
      .from("encuestas")
      .select("*, creador:perfiles(nombre,apellido)")
      .eq("activa", true)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: misVotos } = await supabase
      .from("encuesta_votos")
      .select("encuesta_id,opcion_id")
      .eq("perfil_id", uid);

    const ids = (enc ?? []).map((e: Encuesta) => e.id);
    const conteosParciales: Record<string, Conteo> = {};
    if (ids.length > 0) {
      const { data: todosVotos } = await supabase
        .from("encuesta_votos")
        .select("encuesta_id,opcion_id")
        .in("encuesta_id", ids);

      for (const v of (todosVotos ?? [])) {
        if (!conteosParciales[v.encuesta_id]) conteosParciales[v.encuesta_id] = {};
        conteosParciales[v.encuesta_id][v.opcion_id] = (conteosParciales[v.encuesta_id][v.opcion_id] ?? 0) + 1;
      }
    }

    setEncuestas((enc ?? []) as Encuesta[]);
    setVotos((misVotos ?? []) as Voto[]);
    setConteos(conteosParciales);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      setLoading(false);
    })();
  }, []);

  const miVoto = (encId: string) => votos.find(v => v.encuesta_id === encId)?.opcion_id;

  const votar = async (encuesta: Encuesta, opcionId: string) => {
    if (!userId || votando) return;
    if (miVoto(encuesta.id)) return;
    setVotando(encuesta.id);
    await supabase.from("encuesta_votos").insert({ encuesta_id: encuesta.id, perfil_id: userId, opcion_id: opcionId });
    await cargar(userId);
    setVotando(null);
    showToast("¡Voto registrado!");
  };

  const agregarOpcion = () => setForm(f => ({ ...f, opciones: [...f.opciones, ""] }));
  const quitarOpcion = (i: number) => setForm(f => ({ ...f, opciones: f.opciones.filter((_, idx) => idx !== i) }));
  const setOpcion = (i: number, v: string) => setForm(f => ({ ...f, opciones: f.opciones.map((o, idx) => idx === i ? v : o) }));

  const guardar = async () => {
    if (!userId || !form.titulo || form.opciones.filter(o => o.trim()).length < 2) return;
    setGuardando(true);
    const opciones: Opcion[] = form.opciones.filter(o => o.trim()).map(texto => ({ id: uid(), texto }));
    await supabase.from("encuestas").insert({
      creador_id: userId,
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      opciones,
      activa: true,
      fecha_cierre: form.fecha_cierre || null,
    });
    await cargar(userId);
    setModal(false);
    setGuardando(false);
    setForm({ titulo: "", descripcion: "", opciones: ["", ""], fecha_cierre: "" });
    showToast("Encuesta creada");
  };

  const cerrar = async (id: string) => {
    if (!confirm("¿Cerrar esta encuesta?")) return;
    await supabase.from("encuestas").update({ activa: false }).eq("id", id);
    setEncuestas(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 800, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>{toast}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>📊 Encuestas de Mercado</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Opiniones colectivas de los corredores GFI®</p>
        </div>
        <button onClick={() => setModal(true)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          + Nueva encuesta
        </button>
      </div>

      {/* Ideas rápidas */}
      <div style={{ background: "#1e293b", borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>IDEAS PARA ENCUESTAR:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MOTIVOS_MERCADO.map((m, i) => (
            <button key={i} onClick={() => { setForm(f => ({ ...f, titulo: m })); setModal(true); }}
              style={{ background: "#0f172a", color: "#94a3b8", border: "1px solid #334155", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de encuestas */}
      {encuestas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Sin encuestas activas</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Creá la primera encuesta para conocer la opinión del mercado</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {encuestas.map(enc => {
            const votoMio = miVoto(enc.id);
            const totalVotos = Object.values(conteos[enc.id] ?? {}).reduce((a, b) => a + b, 0);
            const yaVote = !!votoMio;
            const creador = enc.creador as any;
            return (
              <div key={enc.id} style={{ background: "#1e293b", borderRadius: 14, padding: "20px 22px", border: "1px solid #334155" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: 16, marginBottom: 4 }}>{enc.titulo}</div>
                    {enc.descripcion && <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>{enc.descripcion}</div>}
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      Por {creador?.nombre} {creador?.apellido} · {totalVotos} voto{totalVotos !== 1 ? "s" : ""}
                      {enc.fecha_cierre && ` · Cierra: ${enc.fecha_cierre}`}
                    </div>
                  </div>
                  {enc.creador_id === userId && (
                    <button onClick={() => cerrar(enc.id)} style={{ background: "#2d1b1b", color: "#ef4444", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>Cerrar</button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {enc.opciones.map(op => {
                    const count = conteos[enc.id]?.[op.id] ?? 0;
                    const pct = totalVotos > 0 ? Math.round((count / totalVotos) * 100) : 0;
                    const esElMio = votoMio === op.id;
                    return (
                      <div key={op.id}>
                        <button
                          onClick={() => !yaVote && votar(enc, op.id)}
                          disabled={yaVote || votando === enc.id}
                          style={{
                            width: "100%", textAlign: "left", background: esElMio ? "#6366f133" : yaVote ? "#0f172a" : "#0f172a",
                            border: `1px solid ${esElMio ? "#6366f1" : "#334155"}`, borderRadius: 8, padding: "10px 14px",
                            cursor: yaVote ? "default" : "pointer", position: "relative", overflow: "hidden",
                          }}>
                          {yaVote && (
                            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: esElMio ? "#6366f122" : "#ffffff08", transition: "width 0.4s" }} />
                          )}
                          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: esElMio ? "#818cf8" : "#f8fafc", fontWeight: esElMio ? 600 : 400, fontSize: 14 }}>
                              {esElMio ? "✓ " : ""}{op.texto}
                            </span>
                            {yaVote && <span style={{ color: "#64748b", fontSize: 13 }}>{count} ({pct}%)</span>}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear encuesta */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", border: "1px solid #1e293b" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>Nueva encuesta</h2>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Pregunta *</label>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="¿Cuál es tu opinión sobre...?"
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Descripción (opcional)</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14, resize: "vertical", boxSizing: "border-box" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>OPCIONES (mínimo 2)</label>
              <button onClick={agregarOpcion} style={{ background: "#1e293b", color: "#6366f1", border: "1px solid #6366f1", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>+ Opción</button>
            </div>
            {form.opciones.map((op, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={op} onChange={e => setOpcion(i, e.target.value)} placeholder={`Opción ${i + 1}`}
                  style={{ flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
                {form.opciones.length > 2 && (
                  <button onClick={() => quitarOpcion(i)} style={{ background: "#2d1b1b", color: "#ef4444", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>✕</button>
                )}
              </div>
            ))}

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4, marginTop: 14 }}>Fecha de cierre (opcional)</label>
            <input type="date" value={form.fecha_cierre} onChange={e => setForm(f => ({ ...f, fecha_cierre: e.target.value }))}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 20, boxSizing: "border-box" }} />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 20px", cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.titulo || form.opciones.filter(o => o.trim()).length < 2}
                style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, cursor: "pointer", opacity: guardando ? 0.7 : 1 }}>
                {guardando ? "Creando..." : "Crear encuesta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
