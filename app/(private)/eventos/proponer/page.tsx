"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const FORM_VACIO = {
  titulo: "",
  descripcion: "",
  fecha: "",
  lugar: "",
  link_externo: "",
  tipo: "externo",
  gratuito: true,
  precio_entrada: "",
};

export default function ProponerEventoPage() {
  const [form, setForm] = useState(FORM_VACIO);
  const [userId, setUserId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const handleForm = (k: string, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleEnviar = async () => {
    if (!form.titulo.trim()) { setError("El título es obligatorio."); return; }
    if (!form.fecha) { setError("La fecha es obligatoria."); return; }
    if (!userId) { setError("Debés estar logueado para proponer un evento."); return; }
    setEnviando(true);
    setError("");

    const { error: err } = await supabase.from("eventos").insert({
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha: new Date(form.fecha).toISOString(),
      lugar: form.lugar.trim() || null,
      link_externo: form.link_externo.trim() || null,
      tipo: form.tipo,
      gratuito: form.gratuito,
      precio_entrada: !form.gratuito && form.precio_entrada ? parseFloat(form.precio_entrada) : null,
      estado: "solicitado",
      organizador_id: userId,
    });

    setEnviando(false);
    if (err) {
      setError("Error al enviar la propuesta. Intentá de nuevo.");
      return;
    }
    setEnviado(true);
  };

  return (
    <>
      <style>{`
        .prop-wrap { max-width: 580px; }
        .prop-back { display: inline-flex; align-items: center; gap: 6px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); text-decoration: none; margin-bottom: 20px; transition: color 0.2s; }
        .prop-back:hover { color: #fff; }
        .prop-titulo { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; margin-bottom: 6px; }
        .prop-titulo span { color: #cc0000; }
        .prop-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 28px; line-height: 1.5; }
        .prop-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 28px; }
        .prop-field { margin-bottom: 16px; }
        .prop-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; font-family: 'Montserrat', sans-serif; }
        .prop-label span { color: #cc0000; margin-left: 2px; }
        .prop-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .prop-input:focus { border-color: rgba(200,0,0,0.4); }
        .prop-input::placeholder { color: rgba(255,255,255,0.2); }
        .prop-textarea { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 90px; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .prop-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .prop-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .prop-select { width: 100%; padding: 10px 14px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .prop-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .prop-toggle { display: flex; gap: 8px; margin-top: 4px; }
        .prop-toggle-btn { padding: 7px 16px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'Montserrat', sans-serif; }
        .prop-toggle-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .prop-aviso { background: rgba(234,179,8,0.07); border: 1px solid rgba(234,179,8,0.2); border-radius: 4px; padding: 12px 16px; font-size: 12px; color: rgba(234,179,8,0.75); line-height: 1.5; margin-bottom: 20px; }
        .prop-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 10px 14px; margin-bottom: 16px; }
        .prop-btn { width: 100%; padding: 13px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
        .prop-btn:hover:not(:disabled) { background: #e60000; }
        .prop-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .prop-ok { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.2); border-radius: 6px; padding: 28px; text-align: center; }
        .prop-ok-icon { font-size: 40px; margin-bottom: 12px; }
        .prop-ok-titulo { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; color: #22c55e; margin-bottom: 8px; }
        .prop-ok-sub { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5; margin-bottom: 20px; }
        .prop-ok-link { display: inline-block; padding: 10px 22px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; text-decoration: none; transition: all 0.2s; }
        .prop-ok-link:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .prop-spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 7px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) { .prop-row { grid-template-columns: 1fr; } }
      `}</style>

      <div className="prop-wrap">
        <a className="prop-back" href="/eventos">← Volver a eventos</a>

        <div className="prop-titulo">Proponer un <span>evento</span></div>
        <div className="prop-sub">
          Sugerí un evento para la comunidad. El administrador lo revisará y te contactará
          para coordinar los detalles antes de publicarlo.
        </div>

        {enviado ? (
          <div className="prop-ok">
            <div className="prop-ok-icon">✅</div>
            <div className="prop-ok-titulo">¡Propuesta enviada!</div>
            <div className="prop-ok-sub">
              Tu propuesta fue recibida. El equipo de GFI® la revisará y te contactará en breve.
            </div>
            <a className="prop-ok-link" href="/eventos">Ver eventos</a>
          </div>
        ) : (
          <>
            <div className="prop-aviso">
              ⚠️ Los eventos externos (COCIR, CIR, otros colegios) pueden tener un costo de publicación.
              Te lo informaremos antes de confirmar.
            </div>

            <div className="prop-card">
              <div className="prop-field">
                <label className="prop-label">Título del evento <span>*</span></label>
                <input
                  className="prop-input"
                  placeholder="Ej: Charla sobre Ley de Alquileres 2024"
                  value={form.titulo}
                  onChange={e => handleForm("titulo", e.target.value)}
                />
              </div>

              <div className="prop-field">
                <label className="prop-label">Descripción</label>
                <textarea
                  className="prop-textarea"
                  placeholder="Contá brevemente de qué se trata el evento, quiénes lo organizan, etc."
                  value={form.descripcion}
                  onChange={e => handleForm("descripcion", e.target.value)}
                />
              </div>

              <div className="prop-row">
                <div className="prop-field">
                  <label className="prop-label">Fecha y hora <span>*</span></label>
                  <input
                    className="prop-input"
                    type="datetime-local"
                    value={form.fecha}
                    onChange={e => handleForm("fecha", e.target.value)}
                  />
                </div>
                <div className="prop-field">
                  <label className="prop-label">Tipo de evento</label>
                  <select
                    className="prop-select"
                    value={form.tipo}
                    onChange={e => handleForm("tipo", e.target.value)}
                  >
                    <option value="gfi">GFI® Oficial</option>
                    <option value="ci">Corredor (CI)</option>
                    <option value="externo">Externo (COCIR / CIR)</option>
                  </select>
                </div>
              </div>

              <div className="prop-row">
                <div className="prop-field">
                  <label className="prop-label">Lugar / Dirección</label>
                  <input
                    className="prop-input"
                    placeholder="Ej: COCIR, Mitre 432, Rosario"
                    value={form.lugar}
                    onChange={e => handleForm("lugar", e.target.value)}
                  />
                </div>
                <div className="prop-field">
                  <label className="prop-label">Link externo / Inscripción</label>
                  <input
                    className="prop-input"
                    placeholder="https://..."
                    value={form.link_externo}
                    onChange={e => handleForm("link_externo", e.target.value)}
                  />
                </div>
              </div>

              <div className="prop-field">
                <label className="prop-label">Entrada</label>
                <div className="prop-toggle">
                  <button
                    type="button"
                    className={`prop-toggle-btn${form.gratuito ? " activo" : ""}`}
                    onClick={() => handleForm("gratuito", true)}
                  >
                    Gratuita
                  </button>
                  <button
                    type="button"
                    className={`prop-toggle-btn${!form.gratuito ? " activo" : ""}`}
                    onClick={() => handleForm("gratuito", false)}
                  >
                    De pago
                  </button>
                  {!form.gratuito && (
                    <input
                      className="prop-input"
                      type="number"
                      placeholder="Precio $"
                      style={{ maxWidth: 130, marginLeft: 4 }}
                      value={form.precio_entrada}
                      onChange={e => handleForm("precio_entrada", e.target.value)}
                    />
                  )}
                </div>
              </div>

              {error && <div className="prop-error">{error}</div>}

              <button
                className="prop-btn"
                onClick={handleEnviar}
                disabled={enviando}
              >
                {enviando && <span className="prop-spinner" />}
                {enviando ? "Enviando..." : "Enviar propuesta"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
