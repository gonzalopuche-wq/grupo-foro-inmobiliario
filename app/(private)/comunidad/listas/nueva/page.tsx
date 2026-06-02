"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

interface Colega {
  id: string; nombre: string; apellido: string;
  matricula: string | null; foto_url: string | null;
}

export default function NuevaListaPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);
      const { data } = await supabase
        .from("perfiles")
        .select("id, nombre, apellido, matricula, foto_url")
        .neq("id", auth.user.id)
        .in("tipo", ["corredor", "admin", "master"])
        .order("apellido");
      setColegas((data ?? []) as Colega[]);
      setLoading(false);
    };
    init();
  }, []);

  const toggleSeleccionado = (id: string) => {
    setSeleccionados(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const guardar = async () => {
    if (!nombre.trim()) { setError("Ingresá un nombre para la lista."); return; }
    if (seleccionados.size === 0) { setError("Seleccioná al menos un destinatario."); return; }
    if (!userId) return;
    setGuardando(true); setError(null);
    const { data: lista, error: errLista } = await supabase
      .from("listas_distribucion")
      .insert({ creador_id: userId, nombre: nombre.trim(), descripcion: descripcion.trim() || null })
      .select("id")
      .single();
    if (errLista || !lista) { setError(errLista?.message ?? "Error al crear la lista."); setGuardando(false); return; }
    const miembros = Array.from(seleccionados).map(perfil_id => ({ lista_id: lista.id, perfil_id }));
    const { error: errMiembros } = await supabase.from("listas_distribucion_miembros").insert(miembros);
    if (errMiembros) { setError(errMiembros.message); setGuardando(false); return; }
    router.push(`/comunidad/listas/${lista.id}`);
  };

  const filtrados = busqueda.trim()
    ? colegas.filter(c => `${c.nombre} ${c.apellido} ${c.matricula ?? ""}`.toLowerCase().includes(busqueda.toLowerCase()))
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
          Nueva lista de distribución
        </h1>
      </div>

      {/* Datos de la lista */}
      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--gfi-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Nombre de la lista *</label>
          <input
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Compradores zona norte"
            style={{ width: "100%", padding: "9px 12px", background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--gfi-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Descripción (opcional)</label>
          <input
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Breve descripción del grupo"
            style={{ width: "100%", padding: "9px 12px", background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif", boxSizing: "border-box" }}
          />
        </div>
      </div>

      {/* Seleccionar destinatarios */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--gfi-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Destinatarios {seleccionados.size > 0 && `(${seleccionados.size})`}
          </span>
          {seleccionados.size > 0 && (
            <button onClick={() => setSeleccionados(new Set())} style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", fontSize: 11, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Limpiar selección</button>
          )}
        </div>
        <input
          placeholder="Buscar por nombre o matrícula..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif", boxSizing: "border-box", marginBottom: 8 }}
        />
      </div>

      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden", marginBottom: 20, maxHeight: 360, overflowY: "auto" }}>
        {filtrados.map(c => {
          const sel = seleccionados.has(c.id);
          return (
            <div
              key={c.id}
              onClick={() => toggleSeleccionado(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", cursor: "pointer", borderBottom: "1px solid var(--gfi-border-subtle)", background: sel ? "rgba(200,0,0,0.06)" : "transparent", transition: "background 0.15s" }}
              onMouseOver={e => { if (!sel) e.currentTarget.style.background = "var(--gfi-bg-card)"; }}
              onMouseOut={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: sel ? "rgba(200,0,0,0.2)" : "rgba(255,255,255,0.06)", border: sel ? "1px solid rgba(200,0,0,0.4)" : "1px solid var(--gfi-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 800, color: sel ? "#990000" : "var(--gfi-text-muted)", flexShrink: 0, overflow: "hidden" }}>
                {c.foto_url ? <img src={c.foto_url} alt={c.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(c)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "Inter,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.apellido}, {c.nombre}
                </div>
                {c.matricula && <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>Mat. {c.matricula}</div>}
              </div>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: sel ? "none" : "2px solid rgba(255,255,255,0.15)", background: sel ? "#990000" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", flexShrink: 0 }}>
                {sel && "✓"}
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--gfi-text-muted)", fontSize: 13, fontFamily: "Inter,sans-serif" }}>Sin resultados</div>
        )}
      </div>

      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(200,0,0,0.08)", border: "1px solid rgba(200,0,0,0.2)", borderRadius: 6, fontSize: 12, color: "#ff8080", fontFamily: "Inter,sans-serif" }}>{error}</div>}

      <button
        onClick={guardar}
        disabled={guardando}
        style={{ width: "100%", padding: "13px", background: "#990000", border: "none", borderRadius: 8, color: "#fff", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: guardando ? 0.6 : 1 }}
      >
        {guardando ? "Creando..." : `Crear lista${seleccionados.size > 0 ? ` (${seleccionados.size} destinatarios)` : ""}`}
      </button>
    </div>
  );
}
