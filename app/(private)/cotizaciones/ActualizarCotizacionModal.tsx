"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Props {
  proveedor: { id: string; nombre: string; compra_usd: number | null; venta_usd: number | null; };
  userId: string;
  esAdmin: boolean;
  onClose: () => void;
  onGuardado: () => void;
}

interface Sugerencia {
  id: string;
  proveedor_id: string;
  perfil_id: string;
  compra: number | null;
  venta: number | null;
  notas: string | null;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
}

export default function ActualizarCotizacionModal({ proveedor, userId, esAdmin, onClose, onGuardado }: Props) {
  const [modo, setModo] = useState<"imagen" | "texto" | "manual">("imagen");
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/png");
  const [textoLibre, setTextoLibre] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [compra, setCompra] = useState(proveedor.compra_usd?.toString() ?? "");
  const [venta, setVenta] = useState(proveedor.venta_usd?.toString() ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [extraido, setExtraido] = useState(false);
  const [pegando, setPegando] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [enviandoSug, setEnviandoSug] = useState(false);
  const [sugEnviada, setSugEnviada] = useState(false);
  const [tabAdmin, setTabAdmin] = useState<"actualizar" | "sugerencias">("actualizar");

  useEffect(() => {
    if (esAdmin) cargarSugerencias();
  }, [esAdmin]);

  const cargarSugerencias = async () => {
    setLoadingSug(true);
    const { data } = await supabase
      .from("cotizacion_sugerencias")
      .select("*, perfiles(nombre, apellido, matricula)")
      .eq("proveedor_id", proveedor.id)
      .order("created_at", { ascending: false });
    setSugerencias((data as Sugerencia[]) ?? []);
    setLoadingSug(false);
  };

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
        // Si hay texto en el portapapeles, cambiar a modo texto automáticamente
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const texto = await blob.text();
          if (texto.trim()) {
            setModo("texto");
            setTextoLibre(texto.trim());
            encontrado = true;
            break;
          }
        }
      }
      if (!encontrado) {
        setError("No hay contenido útil en el portapapeles.");
      }
    } catch {
      setError("No se pudo acceder al portapapeles. Pegá manualmente con Ctrl+V.");
    }
    setPegando(false);
  }, []);

  const handlePasteEvent = useCallback((e: React.ClipboardEvent) => {
    // Imagen
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      if (e.clipboardData.items[i].type.startsWith("image/")) {
        const file = e.clipboardData.items[i].getAsFile();
        if (file) { setModo("imagen"); procesarArchivo(file); return; }
      }
    }
    // Texto
    const texto = e.clipboardData.getData("text/plain");
    if (texto.trim()) {
      setModo("texto");
      setTextoLibre(prev => prev + texto.trim());
    }
  }, []);

  const analizarConIA = async () => {
    setAnalizando(true);
    setError("");
    try {
      const body = modo === "imagen" && preview
        ? { imageBase64: preview.split(",")[1], mediaType: mimeType }
        : { texto: textoLibre };

      const { data: { session: cotSession } } = await supabase.auth.getSession();
      const response = await fetch("/api/extraer-cotizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cotSession?.access_token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.compra != null || data.venta != null) {
        if (data.compra != null) setCompra(data.compra.toString());
        if (data.venta != null) setVenta(data.venta.toString());
        setExtraido(true);
      } else {
        setError("No se pudieron extraer los valores. Revisalos y cargalos manualmente.");
      }
    } catch {
      setError("Error al analizar. Intentá de nuevo.");
    }
    setAnalizando(false);
  };

  const guardar = async () => {
    if (!compra && !venta) { setError("Ingresá al menos un valor."); return; }
    setGuardando(true);
    const c = compra ? parseFloat(compra.replace(",", ".")) : null;
    const v = venta ? parseFloat(venta.replace(",", ".")) : null;
    await supabase.from("divisas_proveedores").update({
      compra_usd: c,
      venta_usd: v,
      actualizado_cot: new Date().toISOString(),
      actualizado_por: userId,
    }).eq("id", proveedor.id);
    setGuardando(false);
    onGuardado();
    onClose();
  };

  // Corredor sugiere una cotización (no admin)
  const enviarSugerencia = async () => {
    if (!compra && !venta) { setError("Ingresá al menos un valor."); return; }
    setEnviandoSug(true);
    const c = compra ? parseFloat(compra.replace(",", ".")) : null;
    const v = venta ? parseFloat(venta.replace(",", ".")) : null;
    await supabase.from("cotizacion_sugerencias").insert({
      proveedor_id: proveedor.id,
      perfil_id: userId,
      compra: c,
      venta: v,
      notas: textoLibre || null,
    });
    setEnviandoSug(false);
    setSugEnviada(true);
    setTimeout(() => { setSugEnviada(false); onClose(); }, 2000);
  };

  // Admin aprueba una sugerencia
  const aprobarSugerencia = async (sug: Sugerencia) => {
    await supabase.from("divisas_proveedores").update({
      compra_usd: sug.compra,
      venta_usd: sug.venta,
      actualizado_cot: new Date().toISOString(),
      actualizado_por: userId,
    }).eq("id", proveedor.id);
    await supabase.from("cotizacion_sugerencias").delete().eq("id", sug.id);
    onGuardado();
    cargarSugerencias();
  };

  const rechazarSugerencia = async (id: string) => {
    await supabase.from("cotizacion_sugerencias").delete().eq("id", id);
    cargarSugerencias();
  };

  const formatARS = (n: number | null) =>
    n ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n) : "—";

  const puedeAnalizar = (modo === "imagen" && !!preview) || (modo === "texto" && textoLibre.trim().length > 3);

  return (
    <>
      <style>{`
        .act-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 24px; }
        .act-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 28px 30px; width: 100%; max-width: 500px; position: relative; max-height: 92vh; overflow-y: auto; }
        .act-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .act-titulo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; margin-bottom: 3px; }
        .act-titulo span { color: #cc0000; }
        .act-subtitulo { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 18px; }
        .act-actual { font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 14px; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 4px; border: 1px solid rgba(255,255,255,0.07); }

        /* Admin tabs */
        .act-admin-tabs { display: flex; gap: 0; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; margin-bottom: 18px; }
        .act-admin-tab { flex: 1; padding: 8px; background: transparent; border: none; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; border-right: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; gap: 6px; }
        .act-admin-tab:last-child { border-right: none; }
        .act-admin-tab.active { background: rgba(200,0,0,0.12); color: #cc0000; }
        .act-admin-tab-badge { background: #cc0000; color: #fff; font-size: 9px; padding: 1px 5px; border-radius: 8px; }

        /* Modos */
        .act-modos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 18px; }
        .act-modo-btn { padding: 10px 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; text-align: center; transition: all 0.2s; }
        .act-modo-btn:hover { border-color: rgba(200,0,0,0.3); }
        .act-modo-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.08); }
        .act-modo-icon { font-size: 18px; margin-bottom: 5px; }
        .act-modo-label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
        .act-modo-btn.activo .act-modo-label { color: #fff; }

        /* Upload zona */
        .act-upload-zone { border: 2px dashed rgba(255,255,255,0.1); border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 12px; }
        .act-upload-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
        .act-btn-file { position: relative; overflow: hidden; padding: 9px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.6); font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; text-align: center; }
        .act-btn-file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
        .act-btn-paste { padding: 9px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .act-btn-paste:disabled { opacity: 0.5; cursor: not-allowed; }
        .act-paste-hint { font-size: 10px; color: rgba(255,255,255,0.18); }

        /* Preview imagen */
        .act-preview-wrap { position: relative; margin-bottom: 12px; }
        .act-preview { width: 100%; max-height: 160px; object-fit: contain; border-radius: 4px; border: 1px solid rgba(255,255,255,0.07); display: block; }
        .act-preview-clear { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: rgba(255,255,255,0.6); font-size: 10px; padding: 3px 8px; cursor: pointer; }

        /* Texto libre */
        .act-textarea { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; resize: vertical; min-height: 90px; transition: border-color 0.2s; margin-bottom: 10px; }
        .act-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .act-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .act-texto-hint { font-size: 10px; color: rgba(255,255,255,0.2); margin-bottom: 10px; }

        /* Botón analizar */
        .act-btn-analizar { width: 100%; padding: 10px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.3); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; margin-bottom: 14px; }
        .act-btn-analizar:hover:not(:disabled) { background: rgba(200,0,0,0.2); color: #fff; }
        .act-btn-analizar:disabled { opacity: 0.5; cursor: not-allowed; }
        .act-extraido { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); border-radius: 4px; padding: 9px 12px; font-size: 12px; color: #22c55e; margin-bottom: 14px; }

        /* Inputs */
        .act-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 4px; }
        .act-field label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 5px; font-family: 'Montserrat', sans-serif; }
        .act-input { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .act-input:focus { border-color: rgba(200,0,0,0.5); }
        .act-input::placeholder { color: rgba(255,255,255,0.2); }

        /* Error */
        .act-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.07); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 9px 12px; margin-bottom: 12px; }

        /* Acciones */
        .act-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); }
        .act-btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 3px; color: rgba(255,255,255,0.45); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .act-btn-save { padding: 9px 22px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .act-btn-save:hover:not(:disabled) { background: #e60000; }
        .act-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .act-btn-sugerir { padding: 9px 22px; background: transparent; border: 1px solid rgba(200,0,0,0.35); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .act-btn-sugerir:hover:not(:disabled) { background: rgba(200,0,0,0.1); }
        .act-btn-sugerir:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Sugerencias */
        .sug-list { display: flex; flex-direction: column; gap: 10px; }
        .sug-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; padding: 14px 16px; }
        .sug-vals { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
        .sug-val { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; }
        .sug-val.c { color: #60a5fa; }
        .sug-val.v { color: #f87171; }
        .sug-val-label { font-size: 9px; color: rgba(255,255,255,0.3); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; font-family: 'Montserrat', sans-serif; margin-right: 4px; }
        .sug-meta { font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 10px; }
        .sug-notas { font-size: 11px; color: rgba(255,255,255,0.4); font-style: italic; margin-bottom: 8px; }
        .sug-acciones { display: flex; gap: 8px; }
        .sug-btn-ap { padding: 6px 14px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 3px; color: #22c55e; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .sug-btn-ap:hover { background: rgba(34,197,94,0.2); }
        .sug-btn-re { padding: 6px 14px; background: transparent; border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .sug-btn-re:hover { background: rgba(200,0,0,0.1); }
        .sug-empty { text-align: center; padding: 32px; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }

        /* Enviado */
        .act-enviado { text-align: center; padding: 28px; color: #22c55e; font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 700; }

        /* Spinner */
        .act-spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin3 0.7s linear infinite; margin-right: 7px; vertical-align: middle; }
        @keyframes spin3 { to { transform: rotate(360deg); } }
      `}</style>

      <div className="act-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="act-modal" onPaste={handlePasteEvent}>
          <div className="act-titulo">
            {esAdmin ? "Actualizar cotización — " : "Sugerir cotización — "}
            <span>{proveedor.nombre}</span>
          </div>
          <div className="act-subtitulo">
            {esAdmin
              ? "Imagen, texto libre o carga manual. La IA extrae los valores automáticamente."
              : "Sugerí valores para que el admin los revise y apruebe."}
          </div>

          {(proveedor.compra_usd || proveedor.venta_usd) && (
            <div className="act-actual">
              Valores actuales: Compra <strong>{formatARS(proveedor.compra_usd)}</strong> · Venta <strong>{formatARS(proveedor.venta_usd)}</strong>
            </div>
          )}

          {/* Tabs admin */}
          {esAdmin && (
            <div className="act-admin-tabs">
              <button
                className={`act-admin-tab${tabAdmin === "actualizar" ? " active" : ""}`}
                onClick={() => setTabAdmin("actualizar")}
              >
                ✏️ Actualizar
              </button>
              <button
                className={`act-admin-tab${tabAdmin === "sugerencias" ? " active" : ""}`}
                onClick={() => setTabAdmin("sugerencias")}
              >
                💡 Sugerencias
                {sugerencias.length > 0 && (
                  <span className="act-admin-tab-badge">{sugerencias.length}</span>
                )}
              </button>
            </div>
          )}

          {sugEnviada ? (
            <div className="act-enviado">✅ Sugerencia enviada al admin. ¡Gracias!</div>
          ) : esAdmin && tabAdmin === "sugerencias" ? (
            /* ── PANEL SUGERENCIAS ADMIN ── */
            <div className="sug-list">
              {loadingSug ? (
                <div className="sug-empty">Cargando...</div>
              ) : sugerencias.length === 0 ? (
                <div className="sug-empty">No hay sugerencias pendientes para este proveedor.</div>
              ) : (
                sugerencias.map(s => (
                  <div key={s.id} className="sug-item">
                    <div className="sug-vals">
                      {s.compra !== null && (
                        <div>
                          <span className="sug-val-label">Compra</span>
                          <span className="sug-val c">{formatARS(s.compra)}</span>
                        </div>
                      )}
                      {s.venta !== null && (
                        <div>
                          <span className="sug-val-label">Venta</span>
                          <span className="sug-val v">{formatARS(s.venta)}</span>
                        </div>
                      )}
                    </div>
                    {s.notas && <div className="sug-notas">💬 {s.notas}</div>}
                    <div className="sug-meta">
                      👤 {s.perfiles?.nombre} {s.perfiles?.apellido}
                      {s.perfiles?.matricula ? ` · Mat. ${s.perfiles.matricula}` : ""}
                      {" · "}
                      {new Date(s.created_at).toLocaleString("es-AR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                      })}
                    </div>
                    <div className="sug-acciones">
                      <button className="sug-btn-ap" onClick={() => aprobarSugerencia(s)}>
                        ✓ Aprobar y aplicar
                      </button>
                      <button className="sug-btn-re" onClick={() => rechazarSugerencia(s.id)}>
                        ✕ Rechazar
                      </button>
                    </div>
                  </div>
                ))
              )}
              <div className="act-actions">
                <button className="act-btn-cancel" onClick={onClose}>Cerrar</button>
              </div>
            </div>
          ) : (
            /* ── FORMULARIO ACTUALIZAR / SUGERIR ── */
            <>
              {/* Selector de modo */}
              <div className="act-modos">
                <button className={`act-modo-btn${modo === "imagen" ? " activo" : ""}`} onClick={() => setModo("imagen")}>
                  <div className="act-modo-icon">📷</div>
                  <div className="act-modo-label">Imagen</div>
                </button>
                <button className={`act-modo-btn${modo === "texto" ? " activo" : ""}`} onClick={() => setModo("texto")}>
                  <div className="act-modo-icon">📝</div>
                  <div className="act-modo-label">Texto</div>
                </button>
                <button className={`act-modo-btn${modo === "manual" ? " activo" : ""}`} onClick={() => setModo("manual")}>
                  <div className="act-modo-icon">✏️</div>
                  <div className="act-modo-label">Manual</div>
                </button>
              </div>

              {/* MODO IMAGEN */}
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
                          {pegando ? <><span className="act-spinner" />...</> : "📋 Pegar"}
                        </button>
                      </div>
                      <div className="act-paste-hint">También podés presionar Ctrl+V con el modal abierto</div>
                    </div>
                  ) : (
                    <>
                      <div className="act-preview-wrap">
                        <img className="act-preview" src={preview} alt="Cotización" />
                        <button className="act-preview-clear" onClick={() => { setPreview(null); setExtraido(false); setError(""); }}>
                          ✕ Cambiar
                        </button>
                      </div>
                      <button className="act-btn-analizar" onClick={analizarConIA} disabled={analizando}>
                        {analizando ? <><span className="act-spinner" />Analizando con IA...</> : "🤖 Extraer valores con IA"}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* MODO TEXTO LIBRE */}
              {modo === "texto" && (
                <>
                  <textarea
                    className="act-textarea"
                    placeholder={`Pegá o escribí el texto con la cotización.\n\nEjemplos:\n• "compra 1380 venta 1420"\n• "USD Blue: C $1.380 / V $1.420"\n• "hoy blue 1390/1430"`}
                    value={textoLibre}
                    onChange={e => { setTextoLibre(e.target.value); setExtraido(false); }}
                  />
                  <div className="act-texto-hint">
                    La IA interpreta cualquier formato. También podés presionar Ctrl+V para pegar texto.
                  </div>
                  <button
                    className="act-btn-analizar"
                    onClick={analizarConIA}
                    disabled={analizando || textoLibre.trim().length < 3}
                  >
                    {analizando ? <><span className="act-spinner" />Analizando...</> : "🤖 Extraer valores con IA"}
                  </button>
                </>
              )}

              {extraido && (
                <div className="act-extraido">✅ Valores extraídos. Revisá y confirmá antes de guardar.</div>
              )}

              {error && <div className="act-error">{error}</div>}

              {/* Inputs compra/venta — siempre visibles */}
              <div className="act-row">
                <div className="act-field">
                  <label>Compra (ARS)</label>
                  <input className="act-input" type="text" placeholder="Ej: 1380" value={compra} onChange={e => setCompra(e.target.value)} />
                </div>
                <div className="act-field">
                  <label>Venta (ARS)</label>
                  <input className="act-input" type="text" placeholder="Ej: 1420" value={venta} onChange={e => setVenta(e.target.value)} />
                </div>
              </div>

              <div className="act-actions">
                <button className="act-btn-cancel" onClick={onClose}>Cancelar</button>
                {!esAdmin ? (
                  <button
                    className="act-btn-sugerir"
                    onClick={enviarSugerencia}
                    disabled={enviandoSug || (!compra && !venta)}
                  >
                    {enviandoSug ? <><span className="act-spinner" />Enviando...</> : "💡 Sugerir al admin"}
                  </button>
                ) : (
                  <button
                    className="act-btn-save"
                    onClick={guardar}
                    disabled={guardando || (!compra && !venta)}
                  >
                    {guardando ? <><span className="act-spinner" />Guardando...</> : "Guardar cotización"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
