"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

interface Ofrecido {
  id: string;
  operacion: string;
  tipo_propiedad: string;
  zona: string | null;
  ciudad: string;
  precio: number | null;
  moneda: string;
  dormitorios: number | null;
  banos: number | null;
  superficie_cubierta: number | null;
  superficie_total: number | null;
  antiguedad: string | null;
  apto_credito: boolean;
  uso_comercial: boolean;
  barrio_cerrado: boolean;
  con_cochera: boolean;
  acepta_mascotas: boolean;
  acepta_bitcoin: boolean;
  descripcion: string | null;
  honorario_compartir: string | null;
  fotos: string[] | null;
  created_at: string;
}

const OP_LABEL: Record<string, string> = {
  venta: "Venta", alquiler: "Alquiler", temporario: "Alquiler temporal",
  permuta: "Permuta", comercial: "Comercial", fondo_comercio: "Fondo de Comercio", campo: "Campo",
};
const OP_COLOR: Record<string, string> = {
  venta: "#22c55e", alquiler: "#60a5fa", temporario: "#eab308",
  permuta: "#c084fc", comercial: "#f97316", fondo_comercio: "#fb7185", campo: "#84cc16",
};
const fmt = (n: number | null) => n ? n.toLocaleString("es-AR") : "—";

export default function FichaPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Ofrecido | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [fotoIdx, setFotoIdx] = useState(0);

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from("mir_ofrecidos")
        .select("id,operacion,tipo_propiedad,zona,ciudad,precio,moneda,dormitorios,banos,superficie_cubierta,superficie_total,antiguedad,apto_credito,uso_comercial,barrio_cerrado,con_cochera,acepta_mascotas,acepta_bitcoin,descripcion,honorario_compartir,fotos,created_at")
        .eq("id", id)
        .eq("activo", true)
        .single();
      setItem(data as Ofrecido);
      setLoading(false);
    };
    cargar();
  }, [id]);

  const copiarLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const fotos = item?.fotos ?? [];
  const opColor = item ? (OP_COLOR[item.operacion] ?? "#6b7280") : "#6b7280";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .ficha-page { max-width: 860px; margin: 0 auto; padding: 24px 16px 60px; }
        .ficha-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 10px; }
        .ficha-logo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; color: #fff; letter-spacing: 0.04em; }
        .ficha-logo span { color: #cc0000; }
        .ficha-badge-red { font-size: 9px; font-family: 'Montserrat', sans-serif; font-weight: 700; background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.25); color: rgba(255,100,100,0.8); padding: 3px 8px; border-radius: 4px; letter-spacing: 0.08em; }
        .ficha-actions { display: flex; gap: 8px; }
        .ficha-btn { padding: 8px 16px; border-radius: 6px; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; cursor: pointer; border: none; transition: opacity 0.15s; }
        .ficha-btn:hover { opacity: 0.85; }
        .ficha-btn-share { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12) !important; color: rgba(255,255,255,0.7); }
        .ficha-btn-pdf { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3) !important; color: #ef4444; }

        /* Foto carousel */
        .ficha-gallery { border-radius: 12px; overflow: hidden; margin-bottom: 24px; position: relative; }
        .ficha-gallery-main { width: 100%; height: 380px; object-fit: cover; display: block; background: rgba(255,255,255,0.04); }
        .ficha-gallery-empty { height: 220px; display: flex; align-items: center; justify-content: center; font-size: 64px; background: rgba(255,255,255,0.03); border-radius: 12px; margin-bottom: 24px; }
        .ficha-gallery-thumbs { display: flex; gap: 6px; margin-top: 6px; overflow-x: auto; padding-bottom: 4px; }
        .ficha-gallery-thumb { width: 72px; height: 52px; object-fit: cover; border-radius: 6px; cursor: pointer; opacity: 0.5; transition: opacity 0.15s; flex-shrink: 0; }
        .ficha-gallery-thumb.active { opacity: 1; outline: 2px solid #cc0000; }
        .ficha-gallery-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); border: none; color: #fff; font-size: 18px; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ficha-gallery-nav.prev { left: 10px; }
        .ficha-gallery-nav.next { right: 10px; }

        /* Header */
        .ficha-header { margin-bottom: 20px; }
        .ficha-op-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; margin-bottom: 8px; }
        .ficha-title { font-family: 'Montserrat', sans-serif; font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 4px; }
        .ficha-loc { font-size: 14px; color: rgba(255,255,255,0.45); margin-bottom: 4px; }
        .ficha-precio { font-family: 'Montserrat', sans-serif; font-size: 32px; font-weight: 800; color: #fff; margin: 12px 0; }

        /* Info grid */
        .ficha-section { margin-bottom: 24px; }
        .ficha-section-title { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.25); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .ficha-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
        .ficha-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; }
        .ficha-item-label { font-size: 9px; color: rgba(255,255,255,0.25); font-family: 'Montserrat', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 3px; }
        .ficha-item-value { font-size: 15px; color: #fff; font-weight: 600; }
        .ficha-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .ficha-chip { font-size: 10px; padding: 4px 10px; border-radius: 4px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.04em; }
        .ficha-chip-honor { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.2); color: rgba(234,179,8,0.8); }
        .ficha-desc { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.7; white-space: pre-wrap; }
        .ficha-anonimo { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
        .ficha-anonimo-ico { font-size: 24px; }
        .ficha-anonimo-txt { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.5; }
        .ficha-anonimo-txt strong { color: rgba(255,255,255,0.6); display: block; font-size: 13px; margin-bottom: 2px; }
        .ficha-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; }
        .ficha-footer-logo { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.3); }
        .ficha-footer-logo span { color: rgba(200,0,0,0.6); }
        .ficha-footer-date { font-size: 11px; color: rgba(255,255,255,0.2); }

        @media (max-width: 600px) {
          .ficha-title { font-size: 20px; }
          .ficha-precio { font-size: 24px; }
          .ficha-gallery-main { height: 240px; }
          .ficha-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media print {
          body { background: #fff !important; color: #000 !important; }
          .ficha-page { padding: 0; max-width: 100%; }
          .ficha-topbar .ficha-actions { display: none !important; }
          .ficha-btn { display: none !important; }
          .ficha-gallery-nav { display: none !important; }
          .ficha-gallery-thumbs { display: none !important; }
          .ficha-gallery-main { height: 280px !important; }
          .ficha-logo, .ficha-title, .ficha-precio { color: #000 !important; }
          .ficha-loc, .ficha-desc { color: #444 !important; }
          .ficha-section-title { color: #888 !important; border-bottom-color: #ddd !important; }
          .ficha-item { background: #f5f5f5 !important; border-color: #e0e0e0 !important; }
          .ficha-item-label { color: #888 !important; }
          .ficha-item-value { color: #000 !important; }
          .ficha-chip { background: #eee !important; color: #555 !important; }
          .ficha-anonimo { background: #f9f9f9 !important; border-color: #e0e0e0 !important; }
          .ficha-anonimo-txt { color: #666 !important; }
          .ficha-anonimo-txt strong { color: #333 !important; }
          .ficha-footer { border-top-color: #ddd !important; }
          .ficha-footer-logo { color: #999 !important; }
          .ficha-footer-logo span { color: #cc0000 !important; }
          .ficha-footer-date { color: #bbb !important; }
          .ficha-badge-red { display: none !important; }
        }
      `}</style>

      <div className="ficha-page">
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.2)" }}>
            <div style={{ width: 32, height: 32, border: "2px solid rgba(200,0,0,0.2)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Cargando ficha...
          </div>
        ) : !item ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Propiedad no encontrada</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>La ficha puede haber sido desactivada</div>
          </div>
        ) : (
          <>
            <div className="ficha-topbar">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="ficha-logo">Red <span>GFI</span></div>
                <div className="ficha-badge-red">FICHA COMPARTIDA</div>
              </div>
              <div className="ficha-actions">
                <button className="ficha-btn ficha-btn-share" onClick={copiarLink} style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                  {copiado ? "✓ Enlace copiado" : "🔗 Copiar enlace"}
                </button>
                <button className="ficha-btn ficha-btn-pdf" onClick={() => window.print()} style={{ border: "1px solid rgba(200,0,0,0.3)" }}>
                  ↓ Descargar PDF
                </button>
              </div>
            </div>

            {/* Gallery */}
            {fotos.length > 0 ? (
              <div className="ficha-gallery">
                <img
                  className="ficha-gallery-main"
                  src={fotos[fotoIdx]}
                  alt={`Foto ${fotoIdx + 1}`}
                />
                {fotos.length > 1 && (
                  <>
                    <button
                      className="ficha-gallery-nav prev"
                      onClick={() => setFotoIdx(i => (i - 1 + fotos.length) % fotos.length)}
                    >‹</button>
                    <button
                      className="ficha-gallery-nav next"
                      onClick={() => setFotoIdx(i => (i + 1) % fotos.length)}
                    >›</button>
                  </>
                )}
                {fotos.length > 1 && (
                  <div className="ficha-gallery-thumbs">
                    {fotos.map((f, i) => (
                      <img
                        key={i}
                        className={`ficha-gallery-thumb${fotoIdx === i ? " active" : ""}`}
                        src={f}
                        alt={`Miniatura ${i + 1}`}
                        onClick={() => setFotoIdx(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="ficha-gallery-empty">🏠</div>
            )}

            {/* Header info */}
            <div className="ficha-header">
              <div
                className="ficha-op-badge"
                style={{ background: opColor + "22", color: opColor, border: `1px solid ${opColor}44` }}
              >
                {OP_LABEL[item.operacion] ?? item.operacion}
              </div>
              <div className="ficha-title">{item.tipo_propiedad}</div>
              <div className="ficha-loc">📍 {item.ciudad}{item.zona ? ` · ${item.zona}` : ""}</div>
              <div className="ficha-precio">
                {item.precio ? `${item.moneda} ${fmt(item.precio)}` : "Precio a consultar"}
              </div>
              {item.honorario_compartir && item.honorario_compartir !== "No comparte" && (
                <div style={{ marginTop: 8 }}>
                  <span className="ficha-chip ficha-chip-honor">🤝 Comparte honorario: {item.honorario_compartir}</span>
                </div>
              )}
            </div>

            {/* Características */}
            {(item.dormitorios != null || item.banos != null || item.superficie_cubierta != null || item.superficie_total != null || item.antiguedad) && (
              <div className="ficha-section">
                <div className="ficha-section-title">Características</div>
                <div className="ficha-grid">
                  {item.dormitorios != null && (
                    <div className="ficha-item">
                      <div className="ficha-item-label">Dormitorios</div>
                      <div className="ficha-item-value">{item.dormitorios}</div>
                    </div>
                  )}
                  {item.banos != null && (
                    <div className="ficha-item">
                      <div className="ficha-item-label">Baños</div>
                      <div className="ficha-item-value">{item.banos}</div>
                    </div>
                  )}
                  {item.superficie_cubierta != null && (
                    <div className="ficha-item">
                      <div className="ficha-item-label">Sup. cubierta</div>
                      <div className="ficha-item-value">{item.superficie_cubierta} m²</div>
                    </div>
                  )}
                  {item.superficie_total != null && (
                    <div className="ficha-item">
                      <div className="ficha-item-label">Sup. total</div>
                      <div className="ficha-item-value">{item.superficie_total} m²</div>
                    </div>
                  )}
                  {item.antiguedad && (
                    <div className="ficha-item">
                      <div className="ficha-item-label">Antigüedad</div>
                      <div className="ficha-item-value">{item.antiguedad}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Atributos */}
            {(item.apto_credito || item.con_cochera || item.barrio_cerrado || item.acepta_mascotas || item.acepta_bitcoin || item.uso_comercial) && (
              <div className="ficha-section">
                <div className="ficha-section-title">Atributos</div>
                <div className="ficha-chips">
                  {item.apto_credito && <span className="ficha-chip">✓ Apto crédito</span>}
                  {item.con_cochera && <span className="ficha-chip">✓ Cochera</span>}
                  {item.barrio_cerrado && <span className="ficha-chip">✓ Barrio cerrado</span>}
                  {item.acepta_mascotas && <span className="ficha-chip">✓ Acepta mascotas</span>}
                  {item.acepta_bitcoin && <span className="ficha-chip">₿ Acepta Bitcoin</span>}
                  {item.uso_comercial && <span className="ficha-chip">✓ Uso comercial</span>}
                </div>
              </div>
            )}

            {/* Descripción */}
            {item.descripcion && (
              <div className="ficha-section">
                <div className="ficha-section-title">Descripción</div>
                <div className="ficha-desc">{item.descripcion}</div>
              </div>
            )}

            {/* Aviso anonimato */}
            <div className="ficha-anonimo">
              <div className="ficha-anonimo-ico">🔒</div>
              <div className="ficha-anonimo-txt">
                <strong>Ficha anónima — Red GFI</strong>
                Los datos de la inmobiliaria que gestiona esta propiedad no se muestran en esta ficha.
                Para consultar, contactá al corredor a través de la plataforma Red GFI.
              </div>
            </div>

            <div className="ficha-footer">
              <div className="ficha-footer-logo">Grupo Foro <span>Inmobiliario</span> · Red GFI</div>
              <div className="ficha-footer-date">
                {new Date(item.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
