"use client";

import { useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";

interface Props {
  proveedor: { id: string; nombre: string; compra_usd: number | null; venta_usd: number | null; };
  userId: string;
  onClose: () => void;
  onGuardado: () => void;
}

export default function ActualizarCotizacionModal({ proveedor, userId, onClose, onGuardado }: Props) {
  const [modo, setModo] = useState<"imagen"|"manual">("imagen");
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/png");
  const [analizando, setAnalizando] = useState(false);
  const [compra, setCompra] = useState(proveedor.compra_usd?.toString() ?? "");
  const [venta, setVenta] = useState(proveedor.venta_usd?.toString() ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [extraido, setExtraido] = useState(false);
  const [pegando, setPegando] = useState(false);

  const procesarArchivo = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("El archivo no es una imagen válida.");
      return;
    }
    setMimeType(file.type);
    setExtraido(false);
    setError("");
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
  };

  const handlePegar = useCallback(async () => {
    setPegando(true);
    setError("");
    try {
      const items = await navigator.clipboard.read();
      let encontrado = false;
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "cotizacion.png", { type: imageType });
          procesarArchivo(file);
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        setError("No hay una imagen en el portapapeles. Copiá una imagen primero (screenshot de la cotización).");
      }
    } catch {
      setError("No se pudo acceder al portapapeles. Usá el botón de subir archivo o presioná Ctrl+V en el área de imagen.");
    }
    setPegando(false);
  }, []);

  const handlePasteEvent = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) { procesarArchivo(file); return; }
      }
    }
    setError("No hay imagen en el portapapeles.");
  }, []);

  const analizarImagen = async () => {
    if (!preview) return;
    setAnalizando(true);
    setError("");
    try {
      const base64 = preview.split(",")[1];
      const response = await fetch("/api/extraer-cotizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: mimeType,
        }),
      });
      const data = await response.json();
      const texto = data.content?.[0]?.text ?? "";
      try {
        const parsed = JSON.parse(texto.replace(/```json|```/g, "").trim());
        if (parsed.compra) setCompra(parsed.compra.toString());
        if (parsed.venta) setVenta(parsed.venta.toString());
        setExtraido(true);
      } catch {
        setError("No se pudieron extraer los valores. Revisalos y cargalos manualmente.");
      }
    } catch {
      setError("Error al analizar la imagen. Intentá de nuevo.");
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
        .act-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 32px; width: 100%; max-width: 480px; position: relative; max-height: 90vh; overflow-y: auto; }
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
        .act-upload-zone { border: 2px dashed rgba(255,255,255,0.12); border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 12px; transition: border-color 0.2s; }
        .act-upload-zone:hover { border-color: rgba(200,0,0,0.3); }
        .act-upload-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
        .act-btn-file { position: relative; overflow: hidden; padding: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.6); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; text-align: center; }
        .act-btn-file:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .act-btn-file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
        .act-btn-paste { padding: 10px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .act-btn-paste:hover:not(:disabled) { background: rgba(200,0,0,0.16); color: #fff; }
        .act-btn-paste:disabled { opacity: 0.5; cursor: not-allowed; }
        .act-paste-hint { font-size: 10px; color: rgba(255,255,255,0.2); text-align: center; margin-top: 4px; }
        .act-preview-wrap { position: relative; margin-bottom: 12px; }
        .act-preview { width: 100%; max-height: 180px; object-fit: contain; border-radius: 4px; border: 1px solid rgba(255,255,255,0.07); display: block; }
        .act-preview-clear { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: rgba(255,255,255,0.6); font-size: 11px; padding: 3px 8px; cursor: pointer; }
        .act-preview-clear:hover { color: #fff; }
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
        .act-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 4px; }
        .act-btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .act-btn-save { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .act-btn-save:hover:not(:disabled) { background: #e60000; }
        .act-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .act-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin2 0.7s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin2 { to { transform: rotate(360deg); } }
      `}</style>

      <div className="act-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="act-modal" onPaste={handlePasteEvent}>
          <div className="act-titulo">Actualizar cotización — <span>{proveedor.nombre}</span></div>
          <div className="act-subtitulo">Subí una foto, pegá del portapapeles o cargá manualmente</div>

          {(proveedor.compra_usd || proveedor.venta_usd) && (
            <div className="act-actual">Valores actuales: Compra {formatARS(proveedor.compra_usd)} · Venta {formatARS(proveedor.venta_usd)}</div>
          )}

          <div className="act-modos">
            <button className={`act-modo-btn${modo === "imagen" ? " activo" : ""}`} onClick={() => setModo("imagen")}>
              <div className="act-modo-icon">📷</div>
              <div className="act-modo-label">Imagen</div>
            </button>
            <button className={`act-modo-btn${modo === "manual" ? " activo" : ""}`} onClick={() => setModo("manual")}>
              <div className="act-modo-icon">✏️</div>
              <div className="act-modo-label">Manual</div>
            </button>
          </div>

          {modo === "imagen" && (
            <>
              {!preview ? (
                <div className="act-upload-zone">
                  <div className="act-upload-btns">
                    <div className="act-btn-file">
                      📁 Subir archivo
                      <input type="file" accept="image/*" onChange={handleArchivo} />
                    </div>
                    <button className="act-btn-paste" onClick={handlePegar} disabled={pegando}>
                      {pegando ? <><span className="act-spinner" />...</> : "📋 Pegar imagen"}
                    </button>
                  </div>
                  <div className="act-paste-hint">También podés presionar Ctrl+V con el modal abierto</div>
                </div>
              ) : (
                <>
                  <div className="act-preview-wrap">
                    <img className="act-preview" src={preview} alt="Cotización" />
                    <button className="act-preview-clear" onClick={() => { setPreview(null); setExtraido(false); setError(""); }}>✕ Cambiar</button>
                  </div>
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
