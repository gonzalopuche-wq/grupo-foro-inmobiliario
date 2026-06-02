"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "../../../../lib/supabase";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PreviewRow {
  idx: number;
  titulo: string;
  tipo: string;
  operacion: string;
  precio: number | null;
  moneda: string;
  ciudad: string;
  zona: string | null;
  dormitorios: number | null;
  superficie_cubierta: number | null;
}

type Paso = 1 | 2 | 3 | 4;

// ── Componente ────────────────────────────────────────────────────────────────

export default function ImportarPropiedadesPage() {
  const [paso, setPaso] = useState<Paso>(1);
  const [csvText, setCsvText] = useState<string>("");
  const [csvNombre, setCsvNombre] = useState<string>("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>("");
  const [resultado, setResultado] = useState<{ importadas: number; errores: string[] } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const leerArchivo = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setError("Solo se aceptan archivos .csv o .txt");
      return;
    }
    setCsvNombre(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setCsvText(text);
      setPaso(2);
      setError("");
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) leerArchivo(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) leerArchivo(file);
  };

  const generarPreview = async () => {
    if (!csvText) return;
    setCargando(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { setError("Sesión expirada. Recargá la página."); return; }
      const res = await fetch("/api/cartera/import-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          csv: csvText,
          perfil_id: session.user.id,
          preview: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Error al parsear el CSV"); return; }
      const rows: PreviewRow[] = (data.preview ?? []).filter(Boolean);
      if (rows.length === 0) { setError("El archivo no contiene filas reconocibles. Revisá que tenga encabezados válidos."); return; }
      setPreview(rows);
      setSeleccionados(new Set(rows.map(r => r.idx)));
      setPaso(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setCargando(false);
    }
  };

  const toggleSeleccion = (idx: number) => {
    setSeleccionados(prev => {
      const s = new Set(prev);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      return s;
    });
  };

  const toggleTodos = () => {
    if (seleccionados.size === preview.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(preview.map(r => r.idx)));
  };

  const importar = async () => {
    if (seleccionados.size === 0) { setError("Seleccioná al menos una propiedad para importar."); return; }
    setCargando(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { setError("Sesión expirada."); return; }
      const res = await fetch("/api/cartera/import-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          csv: csvText,
          perfil_id: session.user.id,
          preview: false,
          selectedRows: [...seleccionados],
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Error al importar"); return; }
      setResultado({ importadas: data.importadas ?? 0, errores: data.errores ?? [] });
      setPaso(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setCargando(false);
    }
  };

  const descargarPlantilla = () => {
    window.open("/api/cartera/import-csv", "_blank");
  };

  const fmtPrecio = (precio: number | null, moneda: string) => {
    if (precio === null) return "—";
    return `${moneda} ${precio.toLocaleString("es-AR")}`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .imp-wrap { max-width: 900px; display: flex; flex-direction: column; gap: 20px; font-family: 'Inter',sans-serif; }
        .imp-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .imp-titulo span { color: #990000; }
        .imp-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 3px; }
        /* Stepper */
        .imp-steps { display: flex; gap: 0; align-items: center; }
        .imp-step { display: flex; align-items: center; gap: 8px; }
        .imp-step-num { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 800; flex-shrink: 0; transition: all 0.2s; }
        .imp-step-label { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .imp-step-sep { flex: 1; height: 1px; background: rgba(255,255,255,0.08); margin: 0 10px; min-width: 20px; }
        /* Drop zone */
        .imp-drop { border: 2px dashed rgba(255,255,255,0.15); border-radius: 10px; padding: 50px 30px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .imp-drop:hover, .imp-drop.over { border-color: #990000; background: rgba(153,0,0,0.05); }
        .imp-drop-icon { font-size: 36px; margin-bottom: 12px; }
        .imp-drop-txt { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
        .imp-drop-sub { font-size: 12px; color: rgba(255,255,255,0.3); }
        /* Buttons */
        .imp-btn { padding: 11px 22px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; cursor: pointer; border: none; transition: all 0.15s; }
        .imp-btn-primary { background: #990000; color: #fff; }
        .imp-btn-primary:hover { background: #e00; }
        .imp-btn-primary:disabled { background: rgba(153,0,0,0.3); cursor: not-allowed; }
        .imp-btn-secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
        .imp-btn-secondary:hover { background: rgba(255,255,255,0.08); }
        .imp-btn-ghost { background: none; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.4); padding: 8px 14px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        /* Card */
        .imp-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 20px 22px; }
        /* Error */
        .imp-error { padding: 10px 14px; background: rgba(153,0,0,0.08); border: 1px solid rgba(153,0,0,0.25); border-radius: 6px; font-size: 12px; color: rgba(255,100,100,0.9); font-family: 'Inter',sans-serif; }
        /* Tabla preview */
        .imp-tabla { width: 100%; border-collapse: collapse; font-size: 12px; }
        .imp-tabla th { padding: 8px 10px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .imp-tabla td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .imp-tabla tr:hover td { background: rgba(255,255,255,0.02); }
        .imp-tabla tr.excluida td { opacity: 0.35; }
        /* Badge */
        .imp-badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; }
        /* Checkbox */
        .imp-cb { width: 15px; height: 15px; cursor: pointer; accent-color: #990000; }
        /* Spinner */
        .imp-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #990000; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 6px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Resultado */
        .imp-success { text-align: center; padding: 40px 20px; }
        .imp-success-icon { font-size: 48px; margin-bottom: 14px; }
        .imp-success-num { font-family: 'Montserrat',sans-serif; font-size: 52px; font-weight: 800; color: #3abab6; line-height: 1; }
        .imp-success-label { font-size: 14px; color: rgba(255,255,255,0.5); margin-top: 6px; }
        @media (max-width: 700px) {
          .imp-step-label { display: none; }
          .imp-tabla th:nth-child(n+5) { display: none; }
          .imp-tabla td:nth-child(n+5) { display: none; }
        }
      `}</style>

      <div className="imp-wrap">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="imp-titulo">Importar <span>propiedades</span></div>
            <div className="imp-sub">Cargá tu cartera desde CSV — compatible con ZonaProp, KiteProp, Argenprop y formato propio GFI.</div>
          </div>
          <Link href="/crm/cartera" style={{ padding: "7px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}>
            ← Volver a cartera
          </Link>
        </div>

        {/* Stepper */}
        <div className="imp-steps">
          {([
            { n: 1, label: "Archivo" },
            { n: 2, label: "Detectar" },
            { n: 3, label: "Revisar" },
            { n: 4, label: "Listo" },
          ] as { n: Paso; label: string }[]).map(({ n, label }, i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : undefined }}>
              <div className="imp-step">
                <div className="imp-step-num" style={{
                  background: paso === n ? "#990000" : paso > n ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                  color: paso === n ? "#fff" : paso > n ? "#3abab6" : "rgba(255,255,255,0.3)",
                  border: paso > n ? "1px solid rgba(34,197,94,0.3)" : "none",
                }}>
                  {paso > n ? "✓" : n}
                </div>
                <div className="imp-step-label" style={{ color: paso >= n ? "#fff" : "rgba(255,255,255,0.3)" }}>{label}</div>
              </div>
              {i < 3 && <div className="imp-step-sep" />}
            </div>
          ))}
        </div>

        {error && <div className="imp-error">⚠ {error}</div>}

        {/* ═══ PASO 1: Subir archivo ═══ */}
        {paso === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              className={`imp-drop${arrastrando ? " over" : ""}`}
              onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="imp-drop-icon">📂</div>
              <div className="imp-drop-txt">Arrastrá tu CSV aquí o hacé clic para buscar</div>
              <div className="imp-drop-sub">Formatos: .csv · Portales soportados: ZonaProp, Argenprop, KiteProp, GFI</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={onFileChange} />
            </div>

            {/* Info de columnas soportadas */}
            <div className="imp-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Columnas reconocidas automáticamente</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["titulo", "tipo", "operacion", "precio", "moneda", "ciudad", "zona", "direccion", "dormitorios", "baños", "ambientes", "sup. cubierta", "sup. total", "descripcion", "código", "expensas", "video", "fotos"].map(col => (
                  <span key={col} className="imp-badge" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>{col}</span>
                ))}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>¿No tenés el formato? Descargá la plantilla:</span>
                <button className="imp-btn-ghost" onClick={e => { e.stopPropagation(); descargarPlantilla(); }}>
                  ⬇ Plantilla CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASO 2: Detectar columnas ═══ */}
        {paso === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="imp-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>📄 {csvNombre}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                    {csvText.split("\n").filter(Boolean).length - 1} filas detectadas
                  </div>
                </div>
                <button className="imp-btn-ghost" onClick={() => { setPaso(1); setCsvText(""); setCsvNombre(""); setError(""); }}>
                  Cambiar archivo
                </button>
              </div>

              <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.4)", maxHeight: 80, overflow: "hidden" }}>
                {csvText.split("\n").slice(0, 3).join("\n")}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="imp-btn imp-btn-primary" onClick={generarPreview} disabled={cargando}>
                {cargando ? <><span className="imp-spinner" />Analizando columnas...</> : "→ Analizar y previsualizar"}
              </button>
            </div>
          </div>
        )}

        {/* ═══ PASO 3: Revisar y seleccionar ═══ */}
        {paso === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>
                <strong style={{ color: "#fff" }}>{preview.length}</strong> propiedades detectadas ·{" "}
                <strong style={{ color: "#3abab6" }}>{seleccionados.size}</strong> seleccionadas para importar
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="imp-btn-ghost" onClick={toggleTodos}>
                  {seleccionados.size === preview.length ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>
                <button className="imp-btn imp-btn-primary" onClick={importar} disabled={cargando || seleccionados.size === 0}>
                  {cargando ? <><span className="imp-spinner" />Importando...</> : `⬆ Importar ${seleccionados.size} propiedades`}
                </button>
              </div>
            </div>

            <div className="imp-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="imp-tabla">
                  <thead>
                    <tr>
                      <th><input type="checkbox" className="imp-cb" checked={seleccionados.size === preview.length} onChange={toggleTodos} /></th>
                      <th>#</th>
                      <th>Título</th>
                      <th>Tipo</th>
                      <th>Operación</th>
                      <th>Precio</th>
                      <th>Ciudad</th>
                      <th>Dorm.</th>
                      <th>m²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const sel = seleccionados.has(row.idx);
                      return (
                        <tr key={row.idx} className={sel ? "" : "excluida"} onClick={() => toggleSeleccion(row.idx)} style={{ cursor: "pointer" }}>
                          <td onClick={e => e.stopPropagation()}>
                            <input type="checkbox" className="imp-cb" checked={sel} onChange={() => toggleSeleccion(row.idx)} />
                          </td>
                          <td style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{i + 1}</td>
                          <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: "#fff", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.titulo}
                          </td>
                          <td>
                            <span className="imp-badge" style={{ background: "rgba(59,130,246,0.15)", color: "#4ab8d8", border: "1px solid rgba(59,130,246,0.2)" }}>
                              {row.tipo}
                            </span>
                          </td>
                          <td>
                            <span className="imp-badge" style={{
                              background: row.operacion === "Venta" ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
                              color: row.operacion === "Venta" ? "#3abab6" : "#d4960c",
                              border: `1px solid ${row.operacion === "Venta" ? "rgba(34,197,94,0.2)" : "rgba(234,179,8,0.2)"}`,
                            }}>
                              {row.operacion}
                            </span>
                          </td>
                          <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: "#fff" }}>
                            {fmtPrecio(row.precio, row.moneda)}
                          </td>
                          <td style={{ color: "rgba(255,255,255,0.5)" }}>{row.ciudad || "—"}</td>
                          <td style={{ color: "rgba(255,255,255,0.5)" }}>{row.dormitorios ?? "—"}</td>
                          <td style={{ color: "rgba(255,255,255,0.5)" }}>{row.superficie_cubierta ? `${row.superficie_cubierta}m²` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASO 4: Resultado ═══ */}
        {paso === 4 && resultado && (
          <div className="imp-card">
            <div className="imp-success">
              <div className="imp-success-icon">🎉</div>
              <div className="imp-success-num">{resultado.importadas}</div>
              <div className="imp-success-label">propiedades importadas a tu cartera</div>

              {resultado.errores.length > 0 && (
                <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 6, fontSize: 11, color: "#d4960c", textAlign: "left" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, marginBottom: 6 }}>
                    {resultado.errores.length} fila{resultado.errores.length > 1 ? "s" : ""} con error:
                  </div>
                  {resultado.errores.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ fontFamily: "Inter,sans-serif" }}>· {e}</div>
                  ))}
                  {resultado.errores.length > 5 && <div>y {resultado.errores.length - 5} más...</div>}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
                <Link href="/crm/cartera" style={{ padding: "11px 22px", background: "#990000", borderRadius: 5, color: "#fff", fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, textDecoration: "none", letterSpacing: "0.1em" }}>
                  Ver cartera →
                </Link>
                <button
                  className="imp-btn imp-btn-secondary"
                  onClick={() => { setPaso(1); setCsvText(""); setCsvNombre(""); setPreview([]); setSeleccionados(new Set()); setResultado(null); setError(""); }}
                >
                  Importar otro archivo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
