"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

interface Propiedad {
  id: string;
  titulo: string;
  tipo: string;
  operacion: string;
  precio: number | null;
  moneda: string;
  latitud: number | null;
  longitud: number | null;
  estado: string;
  zona: string | null;
  ciudad: string | null;
  direccion: string | null;
  dormitorios: number | null;
  superficie_cubierta: number | null;
  fotos: string[] | null;
  publicada_web: boolean;
}

const ESTADO_COLOR: Record<string, string> = {
  activa: "#3abab6",
  reservada: "#d4960c",
  vendida: "#6b7280",
  pausada: "#b80000",
};

const OP_COLOR: Record<string, string> = {
  Venta: "#990000",
  Alquiler: "#3b82f6",
  "Alquiler temporal": "#a78bfa",
};

function fmtPrecio(p: Propiedad): string {
  if (!p.precio) return "A consultar";
  const sym = p.moneda === "USD" ? "USD " : "$ ";
  return sym + p.precio.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export default function MapaCarteraPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [selected, setSelected] = useState<Propiedad | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [filtroOp, setFiltroOp] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [sinCoordenadas, setSinCoordenadas] = useState(0);

  // Cargar propiedades
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      let uid = user.id;
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", uid).single();
      if (perfil?.tipo === "colaborador") {
        const { data: colab } = await supabase.from("colaboradores").select("corredor_id").eq("user_id", uid).single();
        if (colab?.corredor_id) uid = colab.corredor_id;
      }

      const { data } = await supabase
        .from("cartera_propiedades")
        .select("id,titulo,tipo,operacion,precio,moneda,latitud,longitud,estado,zona,ciudad,direccion,dormitorios,superficie_cubierta,fotos,publicada_web")
        .eq("perfil_id", uid)
        .not("estado", "in", '("vendida")')
        .order("updated_at", { ascending: false });

      const props = (data ?? []) as Propiedad[];
      setPropiedades(props);
      setSinCoordenadas(props.filter(p => !p.latitud || !p.longitud).length);
      setLoading(false);
    };
    init();
  }, []);

  // Cargar Leaflet desde CDN
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).L) { setMapsLoaded(true); return; }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);

    return () => {
      // cleanup markers if map is destroyed
    };
  }, []);

  // Inicializar mapa cuando Leaflet y datos estén listos
  useEffect(() => {
    if (!mapsLoaded || loading || !mapRef.current) return;
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const L = (window as any).L;

    // Centro default: Rosario, Argentina
    const conCoords = propiedades.filter(p =>
      p.latitud && p.longitud &&
      (!filtroOp || p.operacion === filtroOp) &&
      (!filtroEstado || p.estado === filtroEstado)
    );

    let centerLat = -32.9468;
    let centerLng = -60.6393;
    let zoom = 12;

    if (conCoords.length > 0) {
      centerLat = conCoords.reduce((s, p) => s + (p.latitud ?? 0), 0) / conCoords.length;
      centerLng = conCoords.reduce((s, p) => s + (p.longitud ?? 0), 0) / conCoords.length;
    }

    const map = L.map(mapRef.current, { zoomControl: true }).setView([centerLat, centerLng], zoom);
    mapInstance.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    // Custom icon factory
    const makeIcon = (color: string) => L.divIcon({
      className: "",
      html: `<div style="width:28px;height:28px;background:${color};border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });

    for (const p of conCoords) {
      if (!p.latitud || !p.longitud) continue;
      const color = OP_COLOR[p.operacion] ?? "#990000";
      const marker = L.marker([p.latitud, p.longitud], { icon: makeIcon(color) })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:200px;padding:4px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:#111">${p.titulo}</div>
            <div style="font-size:11px;color:#666;margin-bottom:2px">${p.tipo} · ${p.operacion}</div>
            <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:4px">${fmtPrecio(p)}</div>
            ${p.direccion ? `<div style="font-size:10px;color:#888">${p.direccion}</div>` : ""}
            <a href="/crm/cartera/ficha/${p.id}" style="display:inline-block;margin-top:8px;padding:4px 10px;background:${color};color:#fff;border-radius:4px;font-size:10px;font-weight:700;text-decoration:none">Ver ficha →</a>
          </div>
        `);
      marker.on("click", () => setSelected(p));
    }

    // Fit bounds if we have markers
    if (conCoords.length > 1) {
      const bounds = L.latLngBounds(conCoords.map(p => [p.latitud, p.longitud]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [mapsLoaded, loading, propiedades, filtroOp, filtroEstado]);

  const filtradas = propiedades.filter(p =>
    (!filtroOp || p.operacion === filtroOp) &&
    (!filtroEstado || p.estado === filtroEstado)
  );
  const conCoords = filtradas.filter(p => p.latitud && p.longitud);

  return (
    <div style={{ fontFamily: "Inter,sans-serif", color: "#fff", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      <style>{`
        
        .mc-filtro-btn { background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); color: var(--gfi-text-secondary); padding: 5px 12px; border-radius: 6px; font-size: 11px; font-family: Montserrat,sans-serif; font-weight: 700; cursor: pointer; transition: all 0.15s; letter-spacing: 0.04em; }
        .mc-filtro-btn:hover { border-color: var(--gfi-text-dim); color: rgba(255,255,255,0.8); }
        .mc-filtro-btn.active { background: rgba(153,0,0,0.12); border-color: rgba(153,0,0,0.3); color: #990000; }
        .mc-prop-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: all 0.15s; }
        .mc-prop-card:hover { border-color: rgba(255,255,255,0.14); background: var(--gfi-border-subtle); }
        .mc-prop-card.selected { border-color: rgba(153,0,0,0.4); background: rgba(153,0,0,0.06); }
        .leaflet-popup-content-wrapper { border-radius: 8px !important; }
        .leaflet-popup-tip { display: none !important; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "12px 20px 10px", borderBottom: "1px solid var(--gfi-border-subtle)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
        <Link href="/crm/cartera" style={{ color: "var(--gfi-text-muted)", textDecoration: "none", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em" }}>
          ← CARTERA
        </Link>
        <div style={{ width: 1, height: 16, background: "var(--gfi-border)" }} />
        <div style={{ fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff" }}>Mapa de propiedades</div>
        <div style={{ flex: 1 }} />

        {/* Filtros */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["", "Venta", "Alquiler", "Alquiler temporal"].map(op => (
            <button key={op} className={`mc-filtro-btn${filtroOp === op ? " active" : ""}`} onClick={() => setFiltroOp(op)}>
              {op || "Todas"}
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: "var(--gfi-border)", margin: "0 2px" }} />
          {["", "activa", "reservada", "pausada"].map(est => (
            <button key={est} className={`mc-filtro-btn${filtroEstado === est ? " active" : ""}`} onClick={() => setFiltroEstado(est)}>
              {est ? est.charAt(0).toUpperCase() + est.slice(1) : "Todos estados"}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontFamily: "var(--font-display)", fontWeight: 800, color: "#990000", lineHeight: 1 }}>{conCoords.length}</div>
            <div style={{ fontSize: 8, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em" }}>EN MAPA</div>
          </div>
          {sinCoordenadas > 0 && (
            <div style={{ fontSize: 10, color: "rgba(255,165,0,0.7)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              {sinCoordenadas} sin coordenadas
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr", overflow: "hidden" }}>

        {/* Sidebar: list */}
        <div style={{ overflow: "hidden auto", borderRight: "1px solid var(--gfi-border-subtle)", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ color: "var(--gfi-text-dim)", fontSize: 12, padding: "24px 0", textAlign: "center" }}>Cargando propiedades...</div>
          ) : filtradas.length === 0 ? (
            <div style={{ color: "var(--gfi-text-dim)", fontSize: 12, padding: "24px 0", textAlign: "center" }}>Sin propiedades</div>
          ) : (
            filtradas.map(p => {
              const color = OP_COLOR[p.operacion] ?? "#990000";
              const estColor = ESTADO_COLOR[p.estado] ?? "#6b7280";
              const hasCoordenadas = !!(p.latitud && p.longitud);
              return (
                <div
                  key={p.id}
                  className={`mc-prop-card${selected?.id === p.id ? " selected" : ""}`}
                  onClick={() => { setSelected(p); if (hasCoordenadas && mapInstance.current) { const L = (window as any).L; mapInstance.current.setView([p.latitud, p.longitud], 15); } }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    {p.fotos?.[0] ? (
                      <img src={p.fotos[0]} alt="" style={{ width: 48, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div style={{ width: 48, height: 40, background: "var(--gfi-border-subtle)", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏠</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: hasCoordenadas ? "#fff" : "var(--gfi-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.titulo}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 8, fontFamily: "var(--font-display)", fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 3, padding: "1px 5px" }}>{p.operacion}</span>
                        <span style={{ fontSize: 8, fontFamily: "var(--font-display)", fontWeight: 700, color: estColor, background: `${estColor}18`, borderRadius: 3, padding: "1px 5px" }}>{p.estado}</span>
                        {!hasCoordenadas && <span style={{ fontSize: 8, color: "rgba(255,165,0,0.6)", fontFamily: "var(--font-display)", fontWeight: 700 }}>Sin coord.</span>}
                      </div>
                      <div style={{ fontSize: 10, color, fontFamily: "var(--font-display)", fontWeight: 700, marginTop: 3 }}>{fmtPrecio(p)}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Map */}
        <div style={{ position: "relative" }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

          {/* Selected property card overlay */}
          {selected && (
            <div style={{ position: "absolute", bottom: 20, right: 20, width: 260, background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)", borderRadius: 10, padding: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", zIndex: 1000 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "var(--font-display)", flex: 1, paddingRight: 8 }}>{selected.titulo}</div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>
              {selected.fotos?.[0] && (
                <img src={selected.fotos[0]} alt="" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6, marginBottom: 8 }} referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              )}
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, color: OP_COLOR[selected.operacion] ?? "#990000", background: `${(OP_COLOR[selected.operacion] ?? "#990000")}18`, border: `1px solid ${(OP_COLOR[selected.operacion] ?? "#990000")}30`, borderRadius: 4, padding: "2px 7px" }}>{selected.operacion}</span>
                <span style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, color: ESTADO_COLOR[selected.estado] ?? "#6b7280", background: `${(ESTADO_COLOR[selected.estado] ?? "#6b7280")}18`, borderRadius: 4, padding: "2px 7px" }}>{selected.estado}</span>
              </div>
              <div style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 900, color: OP_COLOR[selected.operacion] ?? "#990000", marginBottom: 6 }}>{fmtPrecio(selected)}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--gfi-text-muted)", marginBottom: 10 }}>
                {selected.tipo && <span>{selected.tipo}</span>}
                {selected.dormitorios && <span>{selected.dormitorios} dorm.</span>}
                {selected.superficie_cubierta && <span>{selected.superficie_cubierta} m²</span>}
              </div>
              {selected.direccion && <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", marginBottom: 10 }}>📍 {selected.direccion}</div>}
              <Link href={`/crm/cartera/ficha/${selected.id}`} style={{ display: "block", textAlign: "center", padding: "7px 0", background: "#990000", color: "#fff", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, textDecoration: "none", letterSpacing: "0.06em" }}>
                VER FICHA COMPLETA →
              </Link>
            </div>
          )}

          {/* Loading overlay */}
          {(!mapsLoaded || loading) && (
            <div style={{ position: "absolute", inset: 0, background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🗺️</div>
                <div style={{ fontSize: 13, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)" }}>Cargando mapa...</div>
              </div>
            </div>
          )}

          {/* Legend */}
          {mapsLoaded && !loading && (
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(17,17,17,0.92)", border: "1px solid var(--gfi-border)", borderRadius: 8, padding: "10px 14px", zIndex: 1000 }}>
              <div style={{ fontSize: 8, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.14em", color: "var(--gfi-text-muted)", marginBottom: 8 }}>REFERENCIAS</div>
              {[
                { label: "Venta", color: "#990000" },
                { label: "Alquiler", color: "#3b82f6" },
                { label: "Alq. temporal", color: "#a78bfa" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.color, border: "1.5px solid var(--gfi-text-muted)" }} />
                  <span style={{ fontSize: 10, color: "var(--gfi-text-secondary)", fontFamily: "var(--font-display)" }}>{r.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
