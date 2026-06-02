"use client";
import { useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface MatchPreview {
  id: string;
  codigo: string | null;
  piso: string | null;
  numero_unidad: string | null;
  numero_torre: string | null;
  titulo: string | null;
  precio_actual: number | null;
  moneda_actual: string | null;
  precio_nuevo: number;
  moneda_nueva: string | null;
}

interface SinMatch {
  codigo: string | null;
  piso: string | null;
  numero_unidad: string | null;
  numero_torre: string | null;
  precio: number | null;
  moneda: string | null;
}

interface PreviewResult {
  ok: boolean;
  total_archivo: number;
  matches: number;
  sin_match: number;
  preview: MatchPreview[];
  sin_match_detalle: SinMatch[];
}

function fmtPrecio(precio: number | null, moneda: string | null) {
  if (precio === null) return "—";
  return `${moneda ?? "USD"} ${precio.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
}

function fmtUnidad(m: { codigo?: string | null; piso?: string | null; numero_unidad?: string | null; numero_torre?: string | null }) {
  const partes: string[] = [];
  if (m.numero_torre) partes.push(`Torre ${m.numero_torre}`);
  if (m.piso) partes.push(`Piso ${m.piso}`);
  if (m.numero_unidad) partes.push(`Dto ${m.numero_unidad}`);
  if (m.codigo) partes.push(`(${m.codigo})`);
  return partes.join(" · ") || "—";
}

export default function ImportarPreciosPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [constructoraId, setConstructoraId] = useState("");
  const [estado, setEstado] = useState<"idle" | "analizando" | "preview" | "aplicando" | "listo" | "error">("idle");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [resultado, setResultado] = useState<{ actualizados: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [archivoNombre, setArchivoNombre] = useState("");

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const analizarArchivo = useCallback(async (archivo: File) => {
    setEstado("analizando");
    setErrorMsg("");
    setPreview(null);
    setArchivoNombre(archivo.name);

    const token = await getToken();
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("modo", "preview");
    if (constructoraId.trim()) fd.append("constructora_id", constructoraId.trim());

    const res = await fetch("/api/admin/importar-precios", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json();

    if (!res.ok || !json.ok) {
      setErrorMsg(json.error ?? "Error desconocido");
      setEstado("error");
      return;
    }
    setPreview(json as PreviewResult);
    setEstado("preview");
  }, [getToken, constructoraId]);

  const aplicarCambios = useCallback(async () => {
    const archivo = fileRef.current?.files?.[0];
    if (!archivo || !preview) return;

    setEstado("aplicando");
    setErrorMsg("");

    const token = await getToken();
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("modo", "aplicar");
    if (constructoraId.trim()) fd.append("constructora_id", constructoraId.trim());

    const res = await fetch("/api/admin/importar-precios", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json();

    if (!res.ok || !json.ok) {
      setErrorMsg(json.error ?? "Error desconocido");
      setEstado("error");
      return;
    }
    setResultado({ actualizados: json.actualizados });
    setEstado("listo");
  }, [getToken, constructoraId, preview]);

  const reiniciar = () => {
    setEstado("idle");
    setPreview(null);
    setResultado(null);
    setErrorMsg("");
    setArchivoNombre("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const aceptaArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (archivo) analizarArchivo(archivo);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "40px 24px", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .ip-btn { padding: 10px 22px; background: #990000; border: none; border-radius: 3px; color: #fff; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: background 0.15s; }
        .ip-btn:hover { background: #e60000; }
        .ip-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ip-btn-sec { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.5); }
        .ip-btn-sec:hover { border-color: rgba(255,255,255,0.35); color: #fff; background: transparent; }
        .ip-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .ip-table th { text-align: left; padding: 8px 12px; font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .ip-table td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.75); vertical-align: top; }
        .ip-table tr:last-child td { border-bottom: none; }
        .ip-table .precio-nuevo { color: #3abab6; font-weight: 600; }
        .ip-table .precio-baja { color: #d4960c; }
        .spin { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <header style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            Importar <span style={{ color: "#990000" }}>precios</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            Actualizá los precios de las unidades desde un archivo Excel enviado por la constructora.
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <a
            href="/admin"
            style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none" }}
          >
            ← Admin
          </a>
        </div>
      </header>

      {/* Filtro opcional por constructora */}
      {estado === "idle" && (
        <div style={{ marginBottom: 28, maxWidth: 480 }}>
          <label style={{ display: "block", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
            ID de constructora (opcional)
          </label>
          <input
            value={constructoraId}
            onChange={(e) => setConstructoraId(e.target.value)}
            placeholder="UUID del perfil — si se deja vacío busca en todas las carteras"
            style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, color: "#fff", fontSize: 13, fontFamily: "Inter,sans-serif", outline: "none", boxSizing: "border-box" }}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
            Dejalo vacío para buscar coincidencias en toda la base de propiedades.
          </div>
        </div>
      )}

      {/* Upload area */}
      {estado === "idle" && (
        <div>
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 12, padding: "48px 32px", border: "2px dashed rgba(200,0,0,0.3)", borderRadius: 6,
            cursor: "pointer", transition: "border-color 0.2s", maxWidth: 480,
          }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(200,0,0,0.7)"; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = "rgba(200,0,0,0.3)"; }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "rgba(200,0,0,0.3)";
              const archivo = e.dataTransfer.files?.[0];
              if (archivo) {
                const dt = new DataTransfer();
                dt.items.add(archivo);
                if (fileRef.current) fileRef.current.files = dt.files;
                analizarArchivo(archivo);
              }
            }}
          >
            <div style={{ fontSize: 32 }}>📊</div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
              Arrastrá o hacé clic para subir el archivo
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              Formatos: .xlsx · .xls · .csv
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={aceptaArchivo} style={{ display: "none" }} />
          </label>

          <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, maxWidth: 480 }}>
            <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>
              Formato del archivo
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
              El archivo debe tener al menos una columna de <strong style={{ color: "rgba(255,255,255,0.6)" }}>unidad o código</strong> y una de <strong style={{ color: "rgba(255,255,255,0.6)" }}>precio</strong>.<br />
              Columnas reconocidas automáticamente: <code style={{ fontSize: 11, color: "rgba(200,0,0,0.9)" }}>Código</code>, <code style={{ fontSize: 11, color: "rgba(200,0,0,0.9)" }}>Piso</code>, <code style={{ fontSize: 11, color: "rgba(200,0,0,0.9)" }}>Unidad / Depto</code>, <code style={{ fontSize: 11, color: "rgba(200,0,0,0.9)" }}>Torre</code>, <code style={{ fontSize: 11, color: "rgba(200,0,0,0.9)" }}>Precio / Valor</code>, <code style={{ fontSize: 11, color: "rgba(200,0,0,0.9)" }}>Moneda</code>.
            </div>
          </div>
        </div>
      )}

      {/* Analizando */}
      {estado === "analizando" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
          <span className="spin" />
          Analizando {archivoNombre}...
        </div>
      )}

      {/* Error */}
      {estado === "error" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ padding: "16px 20px", background: "rgba(200,0,0,0.08)", border: "1px solid rgba(200,0,0,0.2)", borderRadius: 4, fontSize: 13, color: "#ff6666", marginBottom: 16 }}>
            ✗ {errorMsg}
          </div>
          <button className="ip-btn ip-btn-sec" onClick={reiniciar}>← Volver</button>
        </div>
      )}

      {/* Preview */}
      {estado === "preview" && preview && (
        <div>
          {/* Stats */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Filas en archivo", valor: preview.total_archivo },
              { label: "Con coincidencia", valor: preview.matches, ok: true },
              { label: "Sin coincidencia", valor: preview.sin_match, warn: preview.sin_match > 0 },
            ].map((s) => (
              <div key={s.label} style={{ padding: "14px 20px", background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, minWidth: 140 }}>
                <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: s.ok ? "#3abab6" : s.warn ? "#d4960c" : "#fff" }}>{s.valor}</div>
              </div>
            ))}
          </div>

          {/* Preview table */}
          {preview.preview.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                Cambios a aplicar
              </div>
              <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4 }}>
                <table className="ip-table">
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Título</th>
                      <th>Precio actual</th>
                      <th>Precio nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.slice(0, 200).map((m) => {
                      const baja = m.precio_actual !== null && m.precio_nuevo < m.precio_actual;
                      return (
                        <tr key={m.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{fmtUnidad(m)}</td>
                          <td style={{ color: "rgba(255,255,255,0.4)", maxWidth: 260 }}>{m.titulo ?? "—"}</td>
                          <td style={{ color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                            {fmtPrecio(m.precio_actual, m.moneda_actual)}
                          </td>
                          <td className={baja ? "precio-baja" : "precio-nuevo"} style={{ whiteSpace: "nowrap" }}>
                            {fmtPrecio(m.precio_nuevo, m.moneda_nueva)}
                            {baja && <span style={{ fontSize: 10, marginLeft: 6 }}>▼</span>}
                            {!baja && m.precio_actual !== null && <span style={{ fontSize: 10, marginLeft: 6 }}>▲</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {preview.preview.length > 200 && (
                  <div style={{ padding: "10px 14px", fontSize: 11, color: "rgba(255,255,255,0.3)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    Mostrando 200 de {preview.preview.length} registros.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sin match */}
          {preview.sin_match_detalle.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,165,0,0.5)", marginBottom: 12 }}>
                Sin coincidencia en la base ({preview.sin_match} filas)
              </div>
              <div style={{ overflowX: "auto", border: "1px solid rgba(255,165,0,0.1)", borderRadius: 4 }}>
                <table className="ip-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Piso</th>
                      <th>Unidad</th>
                      <th>Torre</th>
                      <th>Precio en archivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sin_match_detalle.map((s, i) => (
                      <tr key={i}>
                        <td>{s.codigo ?? "—"}</td>
                        <td>{s.piso ?? "—"}</td>
                        <td>{s.numero_unidad ?? "—"}</td>
                        <td>{s.numero_torre ?? "—"}</td>
                        <td>{fmtPrecio(s.precio, s.moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                Estas filas no se actualizarán. Verificá que las propiedades existan en la cartera y que los campos piso/unidad/código coincidan exactamente.
              </div>
            </div>
          )}

          {/* Acciones */}
          {preview.matches > 0 ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button className="ip-btn" onClick={aplicarCambios}>
                Actualizar {preview.matches} unidades
              </button>
              <button className="ip-btn ip-btn-sec" onClick={reiniciar}>Cancelar</button>
            </div>
          ) : (
            <div>
              <div style={{ padding: "14px 18px", background: "rgba(200,0,0,0.07)", border: "1px solid rgba(200,0,0,0.15)", borderRadius: 4, fontSize: 13, color: "#ff6666", marginBottom: 14 }}>
                No se encontraron coincidencias. Las propiedades deben estar cargadas en la cartera con los mismos códigos o piso/unidad.
              </div>
              <button className="ip-btn ip-btn-sec" onClick={reiniciar}>← Volver</button>
            </div>
          )}
        </div>
      )}

      {/* Aplicando */}
      {estado === "aplicando" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
          <span className="spin" />
          Actualizando precios...
        </div>
      )}

      {/* Listo */}
      {estado === "listo" && resultado && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ padding: "20px 24px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, marginBottom: 20 }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#3abab6", marginBottom: 6 }}>
              ✓ {resultado.actualizados} unidades actualizadas
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
              Los precios anteriores quedaron guardados en el historial de cada propiedad.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="ip-btn ip-btn-sec" onClick={reiniciar}>Subir otro archivo</button>
            <a href="/admin" style={{ padding: "10px 22px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              ← Admin
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
