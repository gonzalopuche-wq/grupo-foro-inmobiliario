"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { enviarEmail } from "../../../lib/email";

function DifusionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const propId = params.get("prop");
  const propTitulo = params.get("titulo");

  const [contactos, setContactos] = useState<any[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [reporte, setReporte] = useState<null | { total: number; nombres: string[] }>(null);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);
      const { data } = await supabase
        .from("crm_contactos")
        .select("id, nombre, apellido, tipo, email, telefono")
        .eq("perfil_id", auth.user.id)
        .neq("estado", "archivado")
        .order("nombre");
      setContactos(data ?? []);

      if (propTitulo) {
        setMensaje(`Hola {nombre}, te comparto una propiedad que puede interesarte: ${propTitulo}.\n\nComunicate conmigo para más información.`);
      }

      setLoading(false);
    };
    init();
  }, [propTitulo]);

  const contactosFiltrados = contactos.filter(c => {
    const q = filtroBusqueda.toLowerCase();
    return (
      !q ||
      (c.nombre ?? "").toLowerCase().includes(q) ||
      (c.apellido ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const toggleContacto = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (seleccionados.size === contactosFiltrados.length && contactosFiltrados.length > 0) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(contactosFiltrados.map(c => c.id)));
    }
  };

  const enviarDifusion = async () => {
    if (!mensaje.trim() || seleccionados.size === 0) return;
    setEnviando(true);
    const contactosSelec = contactos.filter(c => seleccionados.has(c.id));

    const conEmail = contactosSelec.filter(c => c.email);
    await Promise.allSettled(
      conEmail.map(c => {
        const cuerpo = mensaje.replace("{nombre}", c.nombre ?? "").replace("{apellido}", c.apellido ?? "");
        return enviarEmail(c.email, propTitulo ? `Propiedad de tu interés: ${propTitulo}` : "Mensaje de Grupo Foro Inmobiliario", `<p style="font-family:Arial,sans-serif;font-size:15px;color:#222;white-space:pre-wrap">${cuerpo.replace(/\n/g, "<br>")}</p>`);
      })
    );

    const inserts = contactosSelec.map(c => ({
      perfil_id: userId,
      contacto_id: c.id,
      tipo: "email",
      descripcion: [
        mensaje.replace("{nombre}", c.nombre ?? "").replace("{apellido}", c.apellido ?? ""),
        propId ? `[Propiedad: ${propTitulo ?? propId}]` : null,
      ].filter(Boolean).join(" — "),
    }));
    await supabase.from("crm_interacciones").insert(inserts);

    setReporte({ total: contactosSelec.length, nombres: contactosSelec.map(c => `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim()) });
    setSeleccionados(new Set());
    setMensaje("");
    setEnviando(false);
  };

  const TIPO_COLORES: Record<string, string> = {
    comprador: "#3b82f6",
    vendedor: "#d4960c",
    inquilino: "#8b5cf6",
    propietario: "#3abab6",
    inversor: "#ec4899",
  };

  const todosSeleccionados = contactosFiltrados.length > 0 && contactosFiltrados.every(c => seleccionados.has(c.id));

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>
        Cargando contactos...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .dif-wrap { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
        .dif-header { margin-bottom: 28px; }
        .dif-tag { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #990000; font-family: var(--font-display); margin-bottom: 6px; }
        .dif-titulo { font-family: var(--font-display); font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .dif-desc { font-size: 13px; color: var(--gfi-text-muted); font-family: var(--font-body); }
        .dif-cols { display: grid; grid-template-columns: 2fr 3fr; gap: 20px; }
        .dif-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; overflow: hidden; }
        .dif-card-header { padding: 16px 18px; border-bottom: 1px solid var(--gfi-border-subtle); display: flex; align-items: center; justify-content: space-between; }
        .dif-card-titulo { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: #fff; }
        .dif-search { width: 100%; padding: 9px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: var(--font-body); box-sizing: border-box; }
        .dif-search:focus { border-color: rgba(200,0,0,0.4); }
        .dif-search::placeholder { color: var(--gfi-text-dim); }
        .dif-list { overflow-y: auto; max-height: 420px; }
        .dif-contacto { display: flex; align-items: center; gap: 10px; padding: 10px 18px; cursor: pointer; border-bottom: 1px solid var(--gfi-border-subtle); transition: background 0.15s; }
        .dif-contacto:hover { background: var(--gfi-bg-card); }
        .dif-contacto.sel { background: rgba(200,0,0,0.06); }
        .dif-checkbox { width: 16px; height: 16px; border-radius: 3px; border: 1.5px solid var(--gfi-text-dim); background: transparent; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
        .dif-checkbox.checked { background: #990000; border-color: #990000; }
        .dif-nombre { font-size: 13px; color: #fff; font-family: var(--font-body); flex: 1; }
        .dif-badge { padding: 2px 7px; border-radius: 99px; font-size: 10px; font-weight: 600; font-family: var(--font-display); text-transform: capitalize; }
        .dif-footer-list { padding: 12px 18px; border-top: 1px solid var(--gfi-border-subtle); display: flex; align-items: center; justify-content: space-between; }
        .dif-count { font-size: 11px; color: var(--gfi-text-muted); font-family: var(--font-body); }
        .dif-btn-toggle { padding: 5px 10px; background: transparent; border: 1px solid var(--gfi-border); border-radius: 4px; color: var(--gfi-text-secondary); font-size: 10px; font-family: var(--font-display); font-weight: 700; cursor: pointer; letter-spacing: 0.08em; transition: all 0.15s; }
        .dif-btn-toggle:hover { border-color: var(--gfi-text-dim); color: rgba(255,255,255,0.8); }
        .dif-textarea { width: 100%; padding: 12px 14px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: var(--font-body); box-sizing: border-box; resize: vertical; line-height: 1.6; }
        .dif-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .dif-textarea::placeholder { color: var(--gfi-text-dim); }
        .dif-vars { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .dif-var-chip { padding: 4px 10px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); border-radius: 4px; font-size: 11px; color: #990000; font-family: var(--font-display); font-weight: 700; cursor: pointer; transition: background 0.15s; }
        .dif-var-chip:hover { background: rgba(200,0,0,0.18); }
        .dif-btn-enviar { width: 100%; padding: 13px; background: #990000; border: none; border-radius: 4px; color: #fff; font-family: var(--font-display); font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; margin-top: 16px; }
        .dif-btn-enviar:hover:not(:disabled) { background: #e60000; }
        .dif-btn-enviar:disabled { opacity: 0.5; cursor: not-allowed; }
        .dif-reporte { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); border-radius: 8px; padding: 20px; margin-top: 16px; }
        .dif-reporte-titulo { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: #3abab6; margin-bottom: 6px; }
        .dif-reporte-stat { font-size: 28px; font-weight: 800; color: #fff; font-family: var(--font-display); margin-bottom: 12px; }
        .dif-reporte-stat span { color: #3abab6; }
        .dif-reporte-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .dif-reporte-nombre { padding: 4px 10px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 4px; font-size: 11px; color: var(--gfi-text-primary); font-family: var(--font-body); }
        .dif-right-body { padding: 20px; }
        .dif-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 8px; display: block; font-family: var(--font-display); }
        .dif-vars-hint { font-size: 11px; color: var(--gfi-text-muted); font-family: var(--font-body); margin-bottom: 6px; }
        .dif-prop-banner { display: flex; align-items: center; gap: 12px; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; }
        .dif-prop-banner-text { font-size: 12px; color: var(--gfi-text-secondary); font-family: var(--font-body); }
        .dif-prop-banner-titulo { font-size: 13px; font-weight: 600; color: #fff; font-family: var(--font-display); }
        .dif-prop-back { font-size: 11px; color: rgba(59,130,246,0.8); text-decoration: none; font-family: var(--font-display); font-weight: 700; }
        .dif-prop-back:hover { color: #3b82f6; }
        @media (max-width: 768px) { .dif-cols { grid-template-columns: 1fr; } }
      `}</style>

      <div className="dif-wrap">
        <div className="dif-header">
          <div className="dif-tag">CRM · Comunicaciones</div>
          <div className="dif-titulo">Difusión con Reporte</div>
          <div className="dif-desc">Enviá un mensaje personalizado a múltiples contactos y registrá la interacción automáticamente.</div>
        </div>

        {propId && propTitulo && (
          <div className="dif-prop-banner">
            <span style={{ fontSize: 20 }}>📢</span>
            <div style={{ flex: 1 }}>
              <div className="dif-prop-banner-text">Difundiendo propiedad</div>
              <div className="dif-prop-banner-titulo">{propTitulo}</div>
            </div>
            <a href={`/crm/cartera`} className="dif-prop-back">← Volver a cartera</a>
          </div>
        )}

        <div className="dif-cols">

          {/* ── Columna izquierda: lista de contactos ── */}
          <div className="dif-card">
            <div className="dif-card-header">
              <div className="dif-card-titulo">Contactos</div>
              <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>
                {contactos.length} total
              </div>
            </div>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--gfi-border-subtle)" }}>
              <input
                className="dif-search"
                placeholder="Buscar por nombre o email..."
                value={filtroBusqueda}
                onChange={e => setFiltroBusqueda(e.target.value)}
              />
            </div>
            <div className="dif-list">
              {contactosFiltrados.length === 0 && (
                <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--gfi-text-dim)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>
                  {filtroBusqueda ? "Sin resultados para esa búsqueda" : "No hay contactos en tu CRM"}
                </div>
              )}
              {contactosFiltrados.map(c => {
                const sel = seleccionados.has(c.id);
                const color = TIPO_COLORES[c.tipo?.toLowerCase()] ?? "var(--gfi-text-muted)";
                return (
                  <div
                    key={c.id}
                    className={`dif-contacto${sel ? " sel" : ""}`}
                    onClick={() => toggleContacto(c.id)}
                  >
                    <div className={`dif-checkbox${sel ? " checked" : ""}`}>
                      {sel && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                    </div>
                    <div className="dif-nombre">
                      {c.nombre ?? ""} {c.apellido ?? ""}
                    </div>
                    {c.tipo && (
                      <div
                        className="dif-badge"
                        style={{ background: `${color}18`, color: color, border: `1px solid ${color}40` }}
                      >
                        {c.tipo}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="dif-footer-list">
              <div className="dif-count">
                {seleccionados.size > 0
                  ? `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? "s" : ""}`
                  : "Ninguno seleccionado"}
              </div>
              <button className="dif-btn-toggle" onClick={toggleTodos}>
                {todosSeleccionados ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            </div>
          </div>

          {/* ── Columna derecha: mensaje y envío ── */}
          <div className="dif-card">
            <div className="dif-card-header">
              <div className="dif-card-titulo">Mensaje</div>
            </div>
            <div className="dif-right-body">
              <label className="dif-label">Redactá tu mensaje</label>
              <textarea
                className="dif-textarea"
                rows={8}
                placeholder={"Escribí tu mensaje. Usá {nombre} y {apellido} para personalizar."}
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
              />

              <div style={{ marginTop: 12 }}>
                <div className="dif-vars-hint">Variables disponibles — hacé clic para insertar:</div>
                <div className="dif-vars">
                  {["{nombre}", "{apellido}"].map(v => (
                    <div
                      key={v}
                      className="dif-var-chip"
                      onClick={() => setMensaje(prev => prev + v)}
                    >
                      {v}
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="dif-btn-enviar"
                onClick={enviarDifusion}
                disabled={enviando || !mensaje.trim() || seleccionados.size === 0}
              >
                {enviando
                  ? "Enviando..."
                  : seleccionados.size === 0
                  ? "Seleccioná al menos un contacto"
                  : `Enviar a ${seleccionados.size} contacto${seleccionados.size !== 1 ? "s" : ""}`}
              </button>

              {reporte && (
                <div className="dif-reporte">
                  <div className="dif-reporte-titulo">✅ Difusión enviada correctamente</div>
                  <div className="dif-reporte-stat">
                    <span>{reporte.total}</span> contacto{reporte.total !== 1 ? "s" : ""} alcanzado{reporte.total !== 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                    Contactados:
                  </div>
                  <div className="dif-reporte-list">
                    {reporte.nombres.map((n, i) => (
                      <div key={i} className="dif-reporte-nombre">{n}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default function DifusionPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>Cargando...</div>}>
      <DifusionInner />
    </Suspense>
  );
}
