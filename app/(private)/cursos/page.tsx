"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface MiInscripcion { estado: string; progreso: number; }

interface Curso {
  id: string;
  titulo: string;
  descripcion: string | null;
  instructor: string | null;
  categoria: string;
  nivel: string;
  duracion_horas: number | null;
  modalidad: string;
  link_acceso: string | null;
  imagen_url: string | null;
  precio: number;
  moneda: string;
  gratuito: boolean;
  activo: boolean;
  destacado: boolean;
  max_inscriptos: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  mi_inscripcion: MiInscripcion | null;
}

const CATEGORIAS: Record<string, { label: string; color: string; bg: string }> = {
  legal:       { label: "Legal",        color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
  comercial:   { label: "Comercial",    color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  tecnologia:  { label: "Tecnología",   color: "#22d3ee", bg: "rgba(34,211,238,0.1)" },
  marketing:   { label: "Marketing",    color: "#fb923c", bg: "rgba(251,146,60,0.1)" },
  financiero:  { label: "Financiero",   color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  general:     { label: "General",      color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  cocir:       { label: "COCIR",        color: "#cc0000", bg: "rgba(200,0,0,0.1)" },
};

const NIVELES: Record<string, string> = {
  basico: "🟢 Básico", intermedio: "🟡 Intermedio", avanzado: "🔴 Avanzado",
};

const FORM_VACIO = {
  titulo: "", descripcion: "", instructor: "", categoria: "general", nivel: "basico",
  duracion_horas: "", modalidad: "online", link_acceso: "", imagen_url: "",
  precio: "0", moneda: "ARS", gratuito: true, max_inscriptos: "",
  fecha_inicio: "", fecha_fin: "", destacado: false,
};

export default function CursosPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroVista, setFiltroVista] = useState<"todos" | "mis">("todos");
  const [cursoVer, setCursoVer] = useState<Curso | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", session.user.id).single();
      if (p?.tipo === "admin" || p?.tipo === "master") setEsAdmin(true);
      await cargarCursos(session.access_token);
    };
    init();
  }, []);

  const cargarCursos = async (tok: string) => {
    setLoading(true);
    const res = await fetch("/api/cursos", { headers: { Authorization: `Bearer ${tok}` } });
    if (res.ok) {
      const d = await res.json();
      setCursos(d.cursos ?? []);
    }
    setLoading(false);
  };

  const inscribirse = async (cursoId: string, yaInscripto: boolean) => {
    if (!token) return;
    setProcesando(cursoId);
    await fetch("/api/cursos", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: yaInscripto ? "desinscribir" : "inscribir", curso_id: cursoId }),
    });
    await cargarCursos(token);
    setProcesando(null);
    if (cursoVer?.id === cursoId) {
      setCursoVer(prev => prev ? {
        ...prev,
        mi_inscripcion: yaInscripto ? null : { estado: "inscripto", progreso: 0 },
      } : null);
    }
  };

  const crearCurso = async () => {
    if (!form.titulo || !token) return;
    setGuardando(true);
    const res = await fetch("/api/cursos", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form }),
    });
    const d = await res.json();
    if (!d.error) {
      await cargarCursos(token);
      setForm(FORM_VACIO);
      setMostrarForm(false);
    }
    setGuardando(false);
  };

  const cursosFiltrados = cursos.filter(c => {
    if (filtroCategoria !== "todas" && c.categoria !== filtroCategoria) return false;
    if (filtroVista === "mis" && !c.mi_inscripcion) return false;
    return true;
  });

  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ fontFamily: "Inter,sans-serif", color: "#fff", maxWidth: 1000, margin: "0 auto" }}>
      <style>{`
        .curso-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; transition: all 0.2s; cursor: pointer; }
        .curso-card:hover { border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); }
        .cur-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; font-family: Inter,sans-serif; box-sizing: border-box; }
        .cur-input:focus { outline: none; border-color: rgba(200,0,0,0.5); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🎓</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>Cursos y Capacitación</h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Formación continua para corredores GFI®</p>
          </div>
        </div>
        {esAdmin && (
          <button onClick={() => setMostrarForm(true)} style={{
            padding: "9px 18px", background: "#cc0000", border: "none", borderRadius: 8,
            color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Montserrat,sans-serif", cursor: "pointer",
          }}>+ Nuevo curso</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFiltroVista("todos")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid", borderColor: filtroVista === "todos" ? "#cc0000" : "rgba(255,255,255,0.1)", background: filtroVista === "todos" ? "rgba(200,0,0,0.15)" : "transparent", color: filtroVista === "todos" ? "#fff" : "rgba(255,255,255,0.45)", cursor: "pointer" }}>Todos</button>
        <button onClick={() => setFiltroVista("mis")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid", borderColor: filtroVista === "mis" ? "#cc0000" : "rgba(255,255,255,0.1)", background: filtroVista === "mis" ? "rgba(200,0,0,0.15)" : "transparent", color: filtroVista === "mis" ? "#fff" : "rgba(255,255,255,0.45)", cursor: "pointer" }}>Mis cursos</button>
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
        {["todas", ...Object.keys(CATEGORIAS)].map(cat => (
          <button key={cat} onClick={() => setFiltroCategoria(cat)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid",
            borderColor: filtroCategoria === cat ? (CATEGORIAS[cat]?.color ?? "#cc0000") : "rgba(255,255,255,0.1)",
            background: filtroCategoria === cat ? (CATEGORIAS[cat]?.bg ?? "rgba(200,0,0,0.15)") : "transparent",
            color: filtroCategoria === cat ? (CATEGORIAS[cat]?.color ?? "#fff") : "rgba(255,255,255,0.45)",
            cursor: "pointer",
          }}>
            {cat === "todas" ? "Todas las categorías" : CATEGORIAS[cat]?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>Cargando cursos...</div>
      ) : cursosFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
          <p>{filtroVista === "mis" ? "Aún no estás inscripto en ningún curso" : "No hay cursos disponibles"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {cursosFiltrados.map(c => {
            const cat = CATEGORIAS[c.categoria] ?? CATEGORIAS.general;
            const inscripto = !!c.mi_inscripcion;
            const completado = c.mi_inscripcion?.estado === "completado";
            return (
              <div key={c.id} className="curso-card" onClick={() => setCursoVer(c)}>
                {c.imagen_url && (
                  <div style={{ height: 140, overflow: "hidden" }}>
                    <img src={c.imagen_url} alt={c.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                {!c.imagen_url && (
                  <div style={{ height: 80, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
                    🎓
                  </div>
                )}
                <div style={{ padding: "14px 16px" }}>
                  {c.destacado && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginBottom: 4 }}>⭐ DESTACADO</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: cat.color, background: cat.bg, border: `1px solid ${cat.color}30` }}>
                      {cat.label}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{NIVELES[c.nivel] ?? c.nivel}</span>
                  </div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", lineHeight: 1.3 }}>{c.titulo}</h3>
                  {c.instructor && <p style={{ margin: "0 0 8px", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>👤 {c.instructor}</p>}
                  {c.descripcion && <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.descripcion}</p>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      {c.duracion_horas && `⏱ ${c.duracion_horas}hs`}
                      {c.modalidad !== "online" && ` · ${c.modalidad}`}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.gratuito ? "#22c55e" : "#eab308" }}>
                      {c.gratuito ? "Gratuito" : `${c.precio.toLocaleString("es-AR")} ${c.moneda}`}
                    </div>
                  </div>
                  {inscripto && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>
                        <span>{completado ? "✓ Completado" : `Progreso: ${c.mi_inscripcion!.progreso}%`}</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${c.mi_inscripcion!.progreso}%`, background: completado ? "#22c55e" : "#cc0000", transition: "width 0.4s" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalle curso */}
      {cursoVer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setCursoVer(null); }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", position: "relative" }}>
            {cursoVer.imagen_url && <img src={cursoVer.imagen_url} alt={cursoVer.titulo} style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: "18px 18px 0 0" }} />}
            <div style={{ padding: 24 }}>
              <button style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 32, height: 32, color: "rgba(255,255,255,0.7)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setCursoVer(null)}>&times;</button>

              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {(() => {
                  const cat = CATEGORIAS[cursoVer.categoria] ?? CATEGORIAS.general;
                  return (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, color: cat.color, background: cat.bg }}>
                      {cat.label}
                    </span>
                  );
                })()}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{NIVELES[cursoVer.nivel]}</span>
                {cursoVer.duracion_horas && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>⏱ {cursoVer.duracion_horas}hs</span>}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "capitalize" }}>{cursoVer.modalidad}</span>
              </div>

              <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>{cursoVer.titulo}</h2>
              {cursoVer.instructor && <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>👤 {cursoVer.instructor}</p>}
              {cursoVer.descripcion && <p style={{ margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{cursoVer.descripcion}</p>}

              {(cursoVer.fecha_inicio || cursoVer.fecha_fin) && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
                  📅 {cursoVer.fecha_inicio ? new Date(cursoVer.fecha_inicio).toLocaleDateString("es-AR") : "—"}
                  {cursoVer.fecha_fin ? ` al ${new Date(cursoVer.fecha_fin).toLocaleDateString("es-AR")}` : ""}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: cursoVer.gratuito ? "#22c55e" : "#eab308", fontFamily: "Montserrat,sans-serif" }}>
                  {cursoVer.gratuito ? "Gratuito" : `${cursoVer.precio.toLocaleString("es-AR")} ${cursoVer.moneda}`}
                </div>
                {cursoVer.max_inscriptos && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Cupos: {cursoVer.max_inscriptos}</div>}
              </div>

              {cursoVer.mi_inscripcion && (
                <div style={{ marginBottom: 16, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#22c55e", marginBottom: 4 }}>
                    <span>✓ Inscripto — {cursoVer.mi_inscripcion.estado === "completado" ? "Completado" : `Progreso: ${cursoVer.mi_inscripcion.progreso}%`}</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3 }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${cursoVer.mi_inscripcion.progreso}%`, background: "#22c55e" }} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                {cursoVer.link_acceso && (cursoVer.mi_inscripcion || cursoVer.gratuito) && (
                  <a href={cursoVer.link_acceso} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "11px", background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center", fontFamily: "Montserrat,sans-serif" }}>
                    Acceder al curso →
                  </a>
                )}
                <button
                  onClick={() => { const inscripto = !!cursoVer.mi_inscripcion; inscribirse(cursoVer.id, inscripto); }}
                  disabled={procesando === cursoVer.id}
                  style={{
                    flex: 1, padding: "11px", border: cursoVer.mi_inscripcion ? "1px solid rgba(239,68,68,0.3)" : "none",
                    borderRadius: 8, cursor: procesando === cursoVer.id ? "not-allowed" : "pointer",
                    background: cursoVer.mi_inscripcion ? "transparent" : "rgba(255,255,255,0.1)",
                    color: cursoVer.mi_inscripcion ? "rgba(239,68,68,0.7)" : "#fff",
                    fontSize: 13, fontWeight: 600,
                  }}>
                  {procesando === cursoVer.id ? "..." : cursoVer.mi_inscripcion ? "Cancelar inscripción" : "Inscribirse"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear curso (admin) */}
      {mostrarForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
          onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, position: "relative" }}>
            <button style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }} onClick={() => setMostrarForm(false)}>&times;</button>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>Nuevo curso</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <input className="cur-input" placeholder="Título *" value={form.titulo} onChange={e => setF("titulo", e.target.value)} />
              <textarea className="cur-input" placeholder="Descripción" rows={3} value={form.descripcion} onChange={e => setF("descripcion", e.target.value)} style={{ resize: "vertical" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input className="cur-input" placeholder="Instructor" value={form.instructor} onChange={e => setF("instructor", e.target.value)} />
                <select className="cur-input" value={form.categoria} onChange={e => setF("categoria", e.target.value)} style={{ cursor: "pointer" }}>
                  {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <select className="cur-input" value={form.nivel} onChange={e => setF("nivel", e.target.value)} style={{ cursor: "pointer" }}>
                  <option value="basico">Básico</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="avanzado">Avanzado</option>
                </select>
                <select className="cur-input" value={form.modalidad} onChange={e => setF("modalidad", e.target.value)} style={{ cursor: "pointer" }}>
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Híbrido</option>
                </select>
                <input className="cur-input" type="number" placeholder="Duración (hs)" value={form.duracion_horas} onChange={e => setF("duracion_horas", e.target.value)} />
              </div>
              <input className="cur-input" placeholder="Link de acceso (URL)" value={form.link_acceso} onChange={e => setF("link_acceso", e.target.value)} />
              <input className="cur-input" placeholder="Imagen URL (opcional)" value={form.imagen_url} onChange={e => setF("imagen_url", e.target.value)} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.gratuito} onChange={e => setF("gratuito", e.target.checked)} />
                  Gratuito
                </label>
                {!form.gratuito && (
                  <>
                    <input className="cur-input" type="number" placeholder="Precio" value={form.precio} onChange={e => setF("precio", e.target.value)} style={{ maxWidth: 120 }} />
                    <select className="cur-input" value={form.moneda} onChange={e => setF("moneda", e.target.value)} style={{ maxWidth: 80, cursor: "pointer" }}>
                      <option>ARS</option><option>USD</option>
                    </select>
                  </>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.destacado as boolean} onChange={e => setF("destacado", e.target.checked)} />
                  Destacado
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Fecha inicio</label>
                  <input className="cur-input" type="date" value={form.fecha_inicio} onChange={e => setF("fecha_inicio", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Fecha fin</label>
                  <input className="cur-input" type="date" value={form.fecha_fin} onChange={e => setF("fecha_fin", e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setMostrarForm(false)} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button onClick={crearCurso} disabled={guardando || !form.titulo} style={{ flex: 2, padding: "10px", background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer", opacity: guardando ? 0.6 : 1 }}>
                {guardando ? "Guardando..." : "Crear curso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
