"use client";

import { useState } from "react";
import { supabase } from "../../../../../lib/supabase";

interface Props {
  propiedadId: string;
  propiaId: string | null;
  propiaSyncAt: string | null;
  titulo: string;
  operacion: string;
  precio: number | null;
  moneda: string;
  descripcion: string | null;
  direccion: string | null;
  ciudad: string | null;
  zona: string | null;
  ambientes: number | null;
  dormitorios: number | null;
  banos: number | null;
  superficieTotal: number | null;
  superficieCubierta: number | null;
  fotos: string[];
}

export function PropiaPublicarButton({
  propiedadId, propiaId, propiaSyncAt,
  titulo, operacion, precio, moneda, descripcion,
  direccion, ciudad, zona, ambientes, dormitorios, banos,
  superficieTotal, superficieCubierta, fotos,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [propiaIdLocal, setPropiaIdLocal] = useState(propiaId);
  const [syncAtLocal, setSyncAtLocal] = useState(propiaSyncAt);

  async function publicar() {
    setPublicando(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMsg({ tipo: "err", texto: "Sesión expirada" }); return; }

      const op = operacion.toLowerCase();
      const forSale = op === "venta" || op === "ambas";
      const forRent = op === "alquiler" || op === "ambas";

      const payload: Record<string, unknown> = {
        accion: "publicar",
        external_identifier: propiedadId,
        title: titulo,
        description: descripcion ?? null,
        for_sale: forSale,
        for_rent: forRent,
        for_sale_price: forSale ? precio : null,
        for_rent_price: forRent ? precio : null,
        currency: (moneda ?? "USD").toLowerCase(),
        address: direccion ?? "",
        city: ciudad ?? "",
        state: zona ?? "",
        country: "Argentina",
        rooms: ambientes ?? null,
        bedrooms: dormitorios ?? null,
        bathrooms: banos ?? null,
        total_meters: superficieTotal ?? null,
        covered_meters: superficieCubierta ?? null,
        images: fotos.map(url => ({ lg: url, md: url, sm: url })),
      };

      if (propiaIdLocal) payload.property_id = propiaIdLocal;

      const res = await fetch("/api/crm/propia", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error al publicar");

      const nuevoId = (data.id ?? data.property_id ?? data.propia_id ?? propiaIdLocal) as string | null;
      if (nuevoId) setPropiaIdLocal(String(nuevoId));
      setSyncAtLocal(new Date().toLocaleString("es-AR"));
      setMsg({ tipo: "ok", texto: propiaIdLocal ? "Propiedad actualizada en Propia MLS ✓" : "Propiedad publicada en Propia MLS ✓" });
    } catch (e: unknown) {
      setMsg({ tipo: "err", texto: e instanceof Error ? e.message : "Error desconocido" });
    }
    setPublicando(false);
  }

  const estaPublicada = !!propiaIdLocal;

  return (
    <>
      <button
        onClick={() => { setAbierto(true); setMsg(null); }}
        style={{
          padding: "8px 16px", borderRadius: 5, cursor: "pointer",
          fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 6,
          background: estaPublicada ? "rgba(153,0,0,0.15)" : "rgba(255,255,255,0.06)",
          border: estaPublicada ? "1px solid rgba(153,0,0,0.45)" : "1px solid rgba(255,255,255,0.15)",
          color: estaPublicada ? "#990000" : "var(--gfi-text-primary)",
        }}
      >
        🏛️ {estaPublicada ? "Propia ✓" : "Publicar en Propia"}
      </button>

      {abierto && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setAbierto(false); setMsg(null); } }}
        >
          <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                🏛️ Propia MLS
              </div>
              <button onClick={() => { setAbierto(false); setMsg(null); }} style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            {estaPublicada && (
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#3abab6", fontFamily: "Inter,sans-serif" }}>
                ✓ Publicada en Propia MLS · ID: <strong>{propiaIdLocal}</strong>
                {syncAtLocal && <span style={{ color: "var(--gfi-text-muted)", marginLeft: 8 }}>· Última sync: {syncAtLocal}</span>}
              </div>
            )}

            <div style={{ marginBottom: 20, background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--gfi-text-muted)", letterSpacing: "0.1em", marginBottom: 8 }}>RESUMEN</div>
              <div style={{ fontSize: 13, color: "#fff", fontFamily: "Inter,sans-serif", marginBottom: 4 }}>{titulo}</div>
              <div style={{ fontSize: 12, color: "var(--gfi-text-secondary)", fontFamily: "Inter,sans-serif" }}>
                {[direccion, zona, ciudad].filter(Boolean).join(", ")}
              </div>
              {precio && (
                <div style={{ fontSize: 14, fontWeight: 700, color: "#990000", fontFamily: "var(--font-display)", marginTop: 6 }}>
                  {moneda === "USD" ? "USD " : "$ "}{precio.toLocaleString("es-AR")}
                </div>
              )}
            </div>

            <button
              onClick={publicar}
              disabled={publicando}
              style={{
                width: "100%", padding: "12px", borderRadius: 6, border: "none",
                background: publicando ? "rgba(153,0,0,0.4)" : "#990000",
                color: "#fff", cursor: publicando ? "not-allowed" : "pointer",
                fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase",
              }}
            >
              {publicando ? "Publicando…" : estaPublicada ? "Actualizar en Propia MLS" : "Publicar en Propia MLS"}
            </button>

            {msg && (
              <div style={{
                marginTop: 14, padding: "10px 14px", borderRadius: 7, fontSize: 12, fontFamily: "Inter,sans-serif",
                background: msg.tipo === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${msg.tipo === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                color: msg.tipo === "ok" ? "#3abab6" : "#b80000",
              }}>
                {msg.tipo === "ok" ? "✓ " : "✕ "}{msg.texto}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
