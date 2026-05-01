"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

const TIPOS = ["Departamento", "Casa", "PH", "Local", "Oficina", "Cochera", "Terreno"];
const OPERACIONES = ["Venta", "Alquiler", "Alquiler Temporario"];
const ESTADOS = ["Excelente", "Muy bueno", "Bueno", "Regular", "A refaccionar"];
const AMBIENTES = ["1", "2", "3", "4", "5+"];
const DORMITORIOS = ["Monoambiente", "1", "2", "3", "4+"];
const BANOS = ["1", "2", "3+"];

export default function TasadorIAPage() {
  const [form, setForm] = useState({
    tipo: "Departamento",
    operacion: "Venta",
    direccion: "",
    barrio: "",
    sup_cubierta: "",
    sup_total: "",
    ambientes: "2",
    dormitorios: "1",
    banos: "1",
    antiguedad: "10",
    estado: "Bueno",
    piso: "",
    cochera: false,
    amenities: "",
    observaciones: "",
  });
  const [resultado, setResultado] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const tasar = async () => {
    if (!form.direccion || !form.barrio || !form.sup_cubierta) {
      setError("Completá dirección, barrio y superficie cubierta.");
      return;
    }
    setLoading(true);
    setError("");
    setResultado(null);
    try {
      const resp = await fetch("/api/tasador-ia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (data.error) { setError(data.error); } else { setResultado(data); }
    } catch { setError("Error de conexión."); }
    setLoading(false);
  };

  const cargarHistorial = async () => {
    if (historialLoading) return;
    setHistorialLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setHistorialLoading(false); return; }
    const { data } = await supabase
      .from("tasaciones_historial")
      .select("id, datos_propiedad, resultado, created_at")
      .eq("perfil_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistorial(data ?? []);
    setHistorialLoading(false);
  };

  const toggleHistorial = () => {
    const nuevo = !mostrarHistorial;
    setMostrarHistorial(nuevo);
    if (nuevo && historial.length === 0) cargarHistorial();
  };

  const guardarHistorial = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      await supabase.from("tasaciones_historial").insert({
        perfil_id: userId,
        datos_propiedad: form,
        resultado,
        created_at: new Date().toISOString(),
      });
      mostrarToast("Guardado ✓");
    } catch {
      // silently ignore errors
    }
  };

  const formatUSD = (n: number) =>
    `USD ${n.toLocaleString("es-AR")}`;

  const formatARS = (n: number) =>
    `ARS ${n.toLocaleString("es-AR")}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');

        .tasador-wrap { display: flex; gap: 28px; align-items: flex-start; }
        .tasador-form { flex: 0 0 440px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 24px; }
        .tasador-resultado { flex: 1; min-width: 0; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-field { display: flex; flex-direction: column; gap: 4px; }
        .form-field.full-width { grid-column: 1 / -1; }
        .form-label { font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .form-input, .form-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 5px; padding: 8px 10px; color: #fff; font-family: Inter,sans-serif; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; }
        .form-input:focus, .form-select:focus { border-color: rgba(204,0,0,0.4); }
        .form-input::placeholder { color: rgba(255,255,255,0.2); }
        .form-select { background: rgba(20,20,20,0.95); cursor: pointer; }
        .form-textarea { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 5px; padding: 8px 10px; color: #fff; font-family: Inter,sans-serif; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; resize: vertical; min-height: 72px; }
        .form-textarea:focus { border-color: rgba(204,0,0,0.4); }
        .form-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .btn-tasar { width: 100%; padding: 14px; background: #cc0000; border: none; border-radius: 6px; color: #fff; font-family: Montserrat,sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; margin-top: 16px; }
        .btn-tasar:hover:not(:disabled) { background: #e60000; }
        .btn-tasar:disabled { opacity: 0.6; cursor: not-allowed; }
        .resultado-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 24px; margin-bottom: 16px; }
        .section-header { font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .cochera-btn { padding: 8px 14px; border-radius: 5px; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; cursor: pointer; transition: all 0.2s; border: 1px solid; }
        .spin-icon { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .factores-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .factor-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .factor-list li { font-size: 12px; font-family: Inter,sans-serif; line-height: 1.4; }
        .comparables-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .comparables-table th { text-align: left; font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .comparables-table td { padding: 8px 8px; color: rgba(255,255,255,0.65); border-bottom: 1px solid rgba(255,255,255,0.04); font-family: Inter,sans-serif; }
        .comparables-table tr:last-child td { border-bottom: none; }
        .recomendacion-box { border-left: 3px solid #cc0000; padding: 12px 16px; background: rgba(204,0,0,0.05); border-radius: 0 6px 6px 0; }
        .actions-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn-secondary { padding: 10px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 5px; color: rgba(255,255,255,0.55); font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .btn-secondary:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .btn-save-hist { padding: 10px 18px; background: rgba(204,0,0,0.12); border: 1px solid rgba(204,0,0,0.3); border-radius: 5px; color: #cc0000; font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .btn-save-hist:hover { background: rgba(204,0,0,0.2); }
        .toast-fixed { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: 5px; font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 700; z-index: 999; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; animation: toastIn 0.3s ease; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 900px) {
          .tasador-wrap { flex-direction: column; }
          .tasador-form { flex: none; width: 100%; box-sizing: border-box; }
          .factores-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>
            Tasador IA
          </h1>
          <span style={{ background: "#cc0000", color: "#fff", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", padding: "3px 8px", borderRadius: 3, textTransform: "uppercase" }}>
            Mod. 7
          </span>
        </div>
        <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>
          Tasación inteligente basada en datos de mercado
        </p>
      </div>

      <div className="tasador-wrap">
        {/* LEFT COLUMN — Form */}
        <div className="tasador-form">
          <div className="section-header">✦ Datos de la Propiedad</div>

          <div className="form-grid">
            {/* Tipo */}
            <div className="form-field">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Operación */}
            <div className="form-field">
              <label className="form-label">Operación</label>
              <select className="form-select" value={form.operacion} onChange={e => setForm(f => ({ ...f, operacion: e.target.value }))}>
                {OPERACIONES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Dirección */}
            <div className="form-field full-width">
              <label className="form-label">Dirección / Calle *</label>
              <input className="form-input" placeholder="Ej: Av. Corrientes 1500" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>

            {/* Barrio */}
            <div className="form-field">
              <label className="form-label">Barrio *</label>
              <input className="form-input" placeholder="Ej: Palermo" value={form.barrio} onChange={e => setForm(f => ({ ...f, barrio: e.target.value }))} />
            </div>

            {/* Antigüedad */}
            <div className="form-field">
              <label className="form-label">Antigüedad (años)</label>
              <input className="form-input" type="number" min="0" value={form.antiguedad} onChange={e => setForm(f => ({ ...f, antiguedad: e.target.value }))} />
            </div>

            {/* Sup cubierta */}
            <div className="form-field">
              <label className="form-label">Sup. cubierta m² *</label>
              <input className="form-input" type="number" min="0" placeholder="Ej: 65" value={form.sup_cubierta} onChange={e => setForm(f => ({ ...f, sup_cubierta: e.target.value }))} />
            </div>

            {/* Sup total */}
            <div className="form-field">
              <label className="form-label">Sup. total m² (opcional)</label>
              <input className="form-input" type="number" min="0" placeholder="Ej: 80" value={form.sup_total} onChange={e => setForm(f => ({ ...f, sup_total: e.target.value }))} />
            </div>

            {/* Ambientes */}
            <div className="form-field">
              <label className="form-label">Ambientes</label>
              <select className="form-select" value={form.ambientes} onChange={e => setForm(f => ({ ...f, ambientes: e.target.value }))}>
                {AMBIENTES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Dormitorios */}
            <div className="form-field">
              <label className="form-label">Dormitorios</label>
              <select className="form-select" value={form.dormitorios} onChange={e => setForm(f => ({ ...f, dormitorios: e.target.value }))}>
                {DORMITORIOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Baños */}
            <div className="form-field">
              <label className="form-label">Baños</label>
              <select className="form-select" value={form.banos} onChange={e => setForm(f => ({ ...f, banos: e.target.value }))}>
                {BANOS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Estado */}
            <div className="form-field">
              <label className="form-label">Estado</label>
              <select className="form-select" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* Piso */}
            <div className="form-field full-width">
              <label className="form-label">Piso (opcional)</label>
              <input className="form-input" placeholder="Ej: 3° A" value={form.piso} onChange={e => setForm(f => ({ ...f, piso: e.target.value }))} />
            </div>

            {/* Cochera */}
            <div className="form-field full-width">
              <label className="form-label">Cochera</label>
              <div>
                <button
                  className="cochera-btn"
                  style={{
                    background: form.cochera ? "rgba(204,0,0,0.12)" : "transparent",
                    borderColor: form.cochera ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.14)",
                    color: form.cochera ? "#cc0000" : "rgba(255,255,255,0.4)",
                  }}
                  onClick={() => setForm(f => ({ ...f, cochera: !f.cochera }))}
                  type="button"
                >
                  {form.cochera ? "✓ Con cochera" : "Sin cochera"}
                </button>
              </div>
            </div>

            {/* Amenities */}
            <div className="form-field full-width">
              <label className="form-label">Amenities (opcional)</label>
              <input className="form-input" placeholder="SUM, pileta, gimnasio..." value={form.amenities} onChange={e => setForm(f => ({ ...f, amenities: e.target.value }))} />
            </div>

            {/* Observaciones */}
            <div className="form-field full-width">
              <label className="form-label">Observaciones (opcional)</label>
              <textarea className="form-textarea" rows={3} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.25)", borderRadius: 5, color: "#ff6666", fontFamily: "Inter,sans-serif", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button className="btn-tasar" onClick={tasar} disabled={loading}>
            {loading ? (
              <><span className="spin-icon" />Analizando...</>
            ) : (
              "Tasar con IA"
            )}
          </button>
        </div>

        {/* RIGHT COLUMN — Results */}
        <div className="tasador-resultado">
          {!resultado && !loading && (
            <div style={{ padding: "64px 32px", textAlign: "center", color: "rgba(255,255,255,0.15)", fontFamily: "Inter,sans-serif", fontSize: 13, fontStyle: "italic", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
              Completá el formulario y presioná "Tasar con IA" para obtener una tasación profesional.
            </div>
          )}

          {resultado && (
            <>
              {/* Price Header */}
              <div className="resultado-card" style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                  Valor sugerido: {formatUSD(resultado.valor_sugerido)}
                </div>
                <div style={{ fontFamily: "Inter,sans-serif", fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                  Rango: {formatUSD(resultado.valor_min)} — {formatUSD(resultado.valor_max)}
                </div>
                <div style={{ display: "inline-block", background: "rgba(204,0,0,0.1)", border: "1px solid rgba(204,0,0,0.25)", borderRadius: 20, padding: "4px 14px", fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "#cc0000", marginBottom: resultado.alquiler_estimado ? 10 : 0 }}>
                  USD {resultado.precio_m2?.toLocaleString("es-AR")} / m²
                </div>
                {resultado.alquiler_estimado && (
                  <div style={{ marginTop: 10, fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                    Alquiler estimado: {formatARS(resultado.alquiler_estimado)}/mes
                  </div>
                )}
              </div>

              {/* Análisis */}
              <div className="resultado-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
                  Análisis de mercado
                </div>
                <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {resultado.analisis}
                </div>
              </div>

              {/* Factores */}
              <div className="resultado-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
                  Factores de valuación
                </div>
                <div className="factores-grid">
                  <div>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>✅ Factores positivos</div>
                    <ul className="factor-list">
                      {(resultado.factores_positivos ?? []).map((f: string, i: number) => (
                        <li key={i} style={{ color: "rgba(255,255,255,0.6)" }}>
                          <span style={{ color: "#22c55e", marginRight: 6 }}>•</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, color: "#f59e0b", marginBottom: 8 }}>⚠️ Factores a considerar</div>
                    <ul className="factor-list">
                      {(resultado.factores_negativos ?? []).map((f: string, i: number) => (
                        <li key={i} style={{ color: "rgba(255,255,255,0.6)" }}>
                          <span style={{ color: "#f59e0b", marginRight: 6 }}>•</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Comparables */}
              {resultado.comparables && resultado.comparables.length > 0 && (
                <div className="resultado-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
                    Comparables de mercado
                  </div>
                  <table className="comparables-table">
                    <thead>
                      <tr>
                        <th>Descripción</th>
                        <th>USD</th>
                        <th>USD/m²</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.comparables.slice(0, 3).map((c: any, i: number) => (
                        <tr key={i}>
                          <td>{c.descripcion}</td>
                          <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#22c55e", whiteSpace: "nowrap" }}>
                            {c.precio?.toLocaleString("es-AR")}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {c.m2?.toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recomendación */}
              {resultado.recomendacion && (
                <div className="resultado-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
                    Recomendación para el corredor
                  </div>
                  <div className="recomendacion-box">
                    <p style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, fontStyle: "italic", lineHeight: 1.6 }}>
                      {resultado.recomendacion}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="actions-row">
                <button className="btn-secondary" onClick={() => setResultado(null)}>
                  Nueva tasación
                </button>
                <button className="btn-save-hist" onClick={guardarHistorial}>
                  Guardar en historial
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className="toast-fixed">{toast}</div>}

      {/* Historial de tasaciones */}
      <div style={{ maxWidth: 900, margin: "28px 0 0" }}>
        <button
          onClick={toggleHistorial}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", padding: "0 0 14px" }}
        >
          <span>{mostrarHistorial ? "▲" : "▼"}</span>
          Historial de tasaciones
          {historial.length > 0 && <span style={{ color: "rgba(255,255,255,0.25)" }}>({historial.length})</span>}
        </button>

        {mostrarHistorial && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "16px 20px" }}>
            {historialLoading ? (
              <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Cargando historial…</div>
            ) : historial.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                Todavía no guardaste ninguna tasación.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {historial.map(h => {
                  const dp = h.datos_propiedad ?? {};
                  const res = h.resultado ?? {};
                  const fecha = new Date(h.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
                  return (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "Montserrat,sans-serif", marginBottom: 3 }}>
                          {dp.tipo ?? "Propiedad"} {dp.operacion ? `· ${dp.operacion}` : ""}
                          {dp.barrio ? ` · ${dp.barrio}` : ""}
                          {dp.ciudad ? `, ${dp.ciudad}` : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                          {[dp.superficie_cubierta && `${dp.superficie_cubierta}m²`, dp.dormitorios && `${dp.dormitorios} dorm.`, dp.estado].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {res.valor_sugerido ? (
                          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: "#22c55e" }}>
                            USD {Number(res.valor_sugerido).toLocaleString("es-AR")}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Sin valor</div>
                        )}
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{fecha}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
