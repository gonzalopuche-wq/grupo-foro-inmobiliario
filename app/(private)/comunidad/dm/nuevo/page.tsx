"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

interface Colega {
  id: string; nombre: string; apellido: string;
  matricula: string | null; foto_url: string | null;
  inmobiliaria: string | null;
}

export default function NuevoDMPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);
      const { data } = await supabase
        .from("perfiles")
        .select("id, nombre, apellido, matricula, foto_url, inmobiliaria")
        .neq("id", auth.user.id)
        .in("tipo", ["corredor", "admin", "master"])
        .order("apellido");
      setColegas((data ?? []) as Colega[]);
      setLoading(false);
    };
    init();
  }, []);

  const filtrados = busqueda.trim()
    ? colegas.filter(c =>
        `${c.nombre} ${c.apellido} ${c.matricula ?? ""} ${c.inmobiliaria ?? ""}`.toLowerCase().includes(busqueda.toLowerCase())
      )
    : colegas;

  const initials = (c: Colega) => `${c.nombre?.charAt(0) ?? ""}${c.apellido?.charAt(0) ?? ""}`.toUpperCase();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", fontSize: 18, cursor: "pointer", padding: "4px 8px" }}>←</button>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "#fff" }}>
          Nuevo mensaje
        </h1>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          autoFocus
          placeholder="Buscar colega por nombre, matrícula o inmobiliaria..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ width: "100%", padding: "10px 14px", background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden" }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--gfi-text-muted)", fontSize: 13, fontFamily: "Inter,sans-serif" }}>
            {busqueda ? `Sin resultados para "${busqueda}"` : "Sin colegas disponibles"}
          </div>
        ) : filtrados.map(c => (
          <div
            key={c.id}
            onClick={() => router.push(`/comunidad/dm/${c.id}`)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--gfi-border-subtle)", transition: "background 0.15s" }}
            onMouseOver={e => (e.currentTarget.style.background = "var(--gfi-bg-card)")}
            onMouseOut={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 800, color: "#990000", flexShrink: 0, overflow: "hidden" }}>
              {c.foto_url ? <img src={c.foto_url} alt={c.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(c)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.apellido}, {c.nombre}
              </div>
              <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginTop: 1 }}>
                {c.matricula ? `Mat. ${c.matricula}` : "Sin matrícula"}
                {c.inmobiliaria ? ` · ${c.inmobiliaria}` : ""}
              </div>
            </div>
            <span style={{ fontSize: 16, color: "var(--gfi-text-dim)" }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
