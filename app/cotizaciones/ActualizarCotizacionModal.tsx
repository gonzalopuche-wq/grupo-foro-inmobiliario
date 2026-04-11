"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

interface Props {
  proveedor: { id: string; nombre: string; compra_usd: number | null; venta_usd: number | null; };
  userId: string;
  onClose: () => void;
  onGuardado: () => void;
}

export default function ActualizarCotizacionModal({ proveedor, userId, onClose, onGuardado }: Props) {
  const [modo, setModo] = useState<"imagen"|"manual">("imagen");
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [compra, setCompra] = useState(proveedor.compra_usd?.toString() ?? "");
  const [venta, setVenta] = useState(proveedor.venta_usd?.toString() ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [extraido, setExtraido] = useState(false);

  const handleImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagen(file);
    setExtraido(false);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const analizarImagen = async () => {
    if (!imagen || !preview) return;
    setAnalizando(true);
    setError("");
    try {
      const base64 = preview.split(",")[1];
      const mediaType = imagen.type as "image/jpeg" | "image/png" | "image/webp";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: `Analizá esta imagen de cotización de divisas. Extraé los valores de compra y venta del dólar estadounidense (USD) en pesos argentinos (ARS). Respondé SOLO con un JSON con este formato exacto, sin texto adicional: {"compra": 1380, "venta": 1420}. Si no podés determinar algún valor con certeza, ponelo como null. Si hay múltiples cotizaciones, tomá la del dólar blue o informal. Los valores deben ser números sin puntos ni comas.` }
            ]
          }]
        })
      });
      const data = await response.json();
      const texto = data.content?.[0]?.text ?? "";
      try {
        const parsed = JSON.parse(texto.replace(/```json|```/g, "").trim());
        if (parsed.compra) setCompra(parsed.compra.toString());
        if (parsed.venta) setVenta(parsed.venta.toString());
        setExtraido(true);
      } catch {
        setError("No se pudieron extraer los valores. Cargalos manualmente.");
        setModo("manual");
      }
    } catch {
      setError("Error al analizar la imagen. Intentá de nuevo o cargá manualmente.");
    }
    setAnalizando(false);
  };

  const guardar = async () => {
    if (!compra && !venta) { setError("Ingresá al menos un valor."); return; }
    setGuardando(true);
    const c = compra ? parseFloat(compra.replace(",", ".")) : null;
    const v = venta ? parseFloat(venta.replace(",", ".")) : null;
    await supabase.from("divisas_proveedores").update({
      compra_usd: c, venta_usd: v,
      actualizado_cot: new Date().toISOString(),
      actualizado_por: userId,
    }).eq("id", proveedor.id);
    setGuardando(false);
    onGuardado();
    onClose();
  };

  const formatARS = (n: number | null) => n ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n) : "—";

  return (
    <>
      <style>{`
        .act-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 24px; }
        .act-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 32px; width: 100%; max-width: 480px; position: relative; }
        .act-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .act-titulo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; margin-bottom: 4px; }
        .act-titulo span { color: #cc0000; }
        .act-subtitulo { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 20px; }
        .act-modos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .act-modo-btn { padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; text-align: center; transition: all 0.2s; }
        .act-modo-btn:hover { border-color: rgba(200,0,0,0.3); }
        .act-modo-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.08); }
        .act-modo-icon { font-size: 22px; margin-bottom: 6px; }
        .act-modo-label { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
        .act-modo-btn.activo .act-modo-label { color: #fff; }
        .act-upload-area { border: 2px dashed rgba(255,255,255,0.12); border-radius: 6px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 14px; position: relative; overflow: hidden; }
        .act-upload-area:hover { border-color: rgba(200,0,0,0.4); }
        .act-upload-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
        .act-upload-icon { font-size: 28px; margin-bottom: 8px; }
        .act-upload-text { font-size: 12px; color: rgba(255,255,255,0.4); }
        .act-preview { width: 100%; max-height: 200px; object-fit: contain; border-radius: 4px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.07); }
        .act-btn-analizar { width: 100%; padding: 11px; background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.35); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; margin-bottom: 14px; }
        .act-btn-analizar:hover:not(:disabled) { background: rgba(200,0,0,0.2); color: #fff; }
        .act-btn-analizar:disabled { opacity: 0.6; cursor: not-allowed; }
        .act-extraido { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); border-radius: 4px; padding: 10px 14px; font-size: 12px; color: #22c55e; margin-bottom: 14px; }
        .act-field { margin-bottom: 14px; }
        .act-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-family: 'Montserrat', sans-serif; }
        .act-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .act-input:focus { border-color: rgba(200,0,0,0.5); }
        .act-input::placeholder { color: rgba(255,255,255,0.2); }
        .act-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .act-actual { font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 16px; }
        .act-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 10px 14px; margin-bottom: 14px; }
        .act-actions { display: flex; gap: 12px; justify-content: flex-end; }
        .act-btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .act-btn-save { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .act-btn-save:hover:not(:disabled) { background: #e60000; }
        .act-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .act-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin2 0.7s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin2 { to { transform: rotate(360deg); } }
      `}</style>

      <div className="act-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="act-modal">
          <div className="act-titulo">Actualizar cotización — <span>{proveedor.nombre}</span></div>
          <div className="act-subtitulo">Subí una foto o cargá los valores manualmente</div>

          {(proveedor.compra_usd || proveedor.venta_usd) && (
            <div className="act-actual">Valores actuales: Compra {formatARS(proveedor.compra_usd)} · Venta {formatARS(proveedor.venta_usd)}</div>
          )}

          <div className="act-modos">
            <button className={`act-modo-btn${modo === "imagen" ? " activo" : ""}`} onClick={() => setModo("imagen")}>
              <div className="act-modo-icon">📷</div>
              <div className="act-modo-label">Subir foto</div>
            </button>
            <button className={`act-modo-btn${modo === "manual" ? " activo" : ""}`} onClick={() => setModo("manual")}>
              <div className="act-modo-icon">✏️</div>
              <div className="act-modo-label">Manual</div>
            </button>
          </div>

          {modo === "imagen" && (
            <>
              {!preview ? (
                <div className="act-upload-area">
                  <input className="act-upload-input" type="file" accept="image/*" onChange={handleImagen} />
                  <div className="act-upload-icon">🖼️</div>
                  <div className="act-upload-text">Tocá para subir una foto de la cotización</div>
                </div>
              ) : (
                <>
                  <img className="act-preview" src={preview} alt="Cotización" />
                  <button className="act-btn-analizar" onClick={analizarImagen} disabled={analizando}>
                    {analizando ? <><span className="act-spinner" />Analizando con IA...</> : "🤖 Extraer valores con IA"}
                  </button>
                </>
              )}
              {extraido && <div className="act-extraido">✅ Valores extraídos. Revisá y confirmá antes de guardar.</div>}
            </>
          )}

          {error && <div className="act-error">{error}</div>}

          <div className="act-row">
            <div className="act-field">
              <label className="act-label">Compra (ARS)</label>
              <input className="act-input" type="text" placeholder="Ej: 1380" value={compra} onChange={e => setCompra(e.target.value)} />
            </div>
            <div className="act-field">
              <label className="act-label">Venta (ARS)</label>
              <input className="act-input" type="text" placeholder="Ej: 1420" value={venta} onChange={e => setVenta(e.target.value)} />
            </div>
          </div>

          <div className="act-actions">
            <button className="act-btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="act-btn-save" onClick={guardar} disabled={guardando || (!compra && !venta)}>
              {guardando ? <><span className="act-spinner" />Guardando...</> : "Guardar cotización"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
