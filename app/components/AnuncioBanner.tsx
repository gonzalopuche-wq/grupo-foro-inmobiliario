"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AnuncioBanner() {
  const [texto, setTexto] = useState<string | null>(null);
  const [color, setColor] = useState("#cc0000");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("configuracion_sitio")
          .select("clave, valor")
          .in("clave", ["anuncio_banner", "anuncio_color"]);
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach(r => { map[r.clave] = r.valor ?? ""; });
        const msg = map.anuncio_banner?.trim();
        if (!msg) return;
        const key = `banner:${btoa(encodeURIComponent(msg)).slice(0, 20)}`;
        if (localStorage.getItem(key)) return;
        setTexto(msg);
        if (map.anuncio_color) setColor(map.anuncio_color);
      } catch { /* tabla aún no existe */ }
    })();
  }, []);

  const cerrar = () => {
    if (!texto) return;
    const key = `banner:${btoa(encodeURIComponent(texto)).slice(0, 20)}`;
    localStorage.setItem(key, "1");
    setTexto(null);
  };

  if (!texto) return null;

  return (
    <div style={{
      background: color,
      color: "#fff",
      padding: "10px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      lineHeight: 1.5,
      flexShrink: 0,
    }}>
      <span style={{ flex: 1 }}>{texto}</span>
      <button
        onClick={cerrar}
        style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 20, padding: "0 4px", lineHeight: 1, flexShrink: 0 }}
        aria-label="Cerrar banner"
      >
        ×
      </button>
    </div>
  );
}
