"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

interface Perfil { id: string; nombre: string; apellido: string; matricula: string | null; foto_url: string | null; }
interface Lista { id: string; nombre: string; descripcion: string | null; activa: boolean; creador_id: string; created_at: string; color?: string | null; }
interface Colega { id: string; nombre: string; apellido: string; matricula: string | null; foto_url: string | null; }

const COLORES_LISTA = [
  "#a0846b", "#8b5cf6", "#c084fc", "#a3e635", "#f97316",
  "#d946ef", "#c0b94d", "#3b82f6", "#14b8a6", "#ef4444",
];

export default function ListaPage() {
  const { listaId } = useParams() as { listaId: string };
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [lista, setLista] = useState<Lista | null>(null);
  const [miembros, setMiembros] = useState<Perfil[]>([]);
  const [todosLosColegas, setTodosLosColegas] = useState<Colega[]>([]);
  const [mensajeTexto, setMensajeTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [busquedaAgregar, setBusquedaAgregar] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);

      const [{ data: l }, { data: mems }] = await Promise.all([
        supabase.from("listas_distribucion").select("*").eq("id", listaId).single(),
        supabase.from("listas_distribucion_miembros")
          .select("perfil_id, perfiles:perfil_id(id,nombre,apellido,matricula,foto_url)")
          .eq("lista_id", listaId),
      ]);

      if (!l) { router.push("/comunidad"); return; }
      if (l.creador_id !== auth.user.id) { router.push("/comunidad"); return; }

      setLista(l as Lista);
      const memsList: Perfil[] = (mems ?? []).map((m: any) => Array.isArray(m.perfiles) ? m.perfiles[0] : m.perfiles).filter(Boolean);
      setMiembros(memsList);

      const memIds = new Set(memsList.map(m => m.id));
      const { data: colegas } = await supabase
        .from("perfiles")
        .select("id, nombre, apellido, matricula, foto_url")
        .neq("id", auth.user.id)
        .in("tipo", ["corredor", "admin", "master"])
        .order("apellido");
      setTodosLosColegas(((colegas ?? []) as Colega[]).filter(c => !memIds.has(c.id)));
      setLoading(false);
    };
    init();
  }, [listaId]);

  const agregarMiembro = async (c: Colega) => {
    if (!lista) return;
    const { error } = await supabase.from("listas_distribucion_miembros").insert({ lista_id: lista.id, perfil_id: c.id });
    if (error) { showToast("Error al agregar"); return; }
    setMiembros(prev => [...prev, c as Perfil]);
    setTodosLosColegas(prev => prev.filter(x => x.id !== c.id));
    showToast(`${c.nombre} ${c.apellido} agregado/a`);
  };

  const quitarMiembro = async (id: string) => {
    if (!lista) return;
    await supabase.from("listas_distribucion_miembros").delete().eq("lista_id", lista.id).eq("perfil_id", id);
    const removido = miembros.find(m => m.id === id);
    setMiembros(prev => prev.filter(m => m.id !== id));
    if (removido) setTodosLosColegas(prev => [...prev, removido as Colega].sort((a, b) => a.apellido.localeCompare(b.apellido)));
    showToast("Miembro eliminado");
  };

  const enviarMensaje = async () => {
    if (!mensajeTexto.trim() || !userId || !lista) return;
    if (miembros.length === 0) { showToast("La lista no tiene destinatarios."); return; }
    setEnviando(true);
    const txt = mensajeTexto.trim();

    // Para cada miembro, crear o buscar el dm_chat y enviar un mensaje
    let exitosos = 0;
    let fallidos = 0;
    for (const m of miembros) {
      const userA = userId < m.id ? userId : m.id;
      const userB = userId < m.id ? m.id : userId;
      let { data: chat } = await supabase.from("dm_chats").select("id").eq("user_a", userA).eq("user_b", userB).single();
      if (!chat) {
        const { data: nc } = await supabase.from("dm_chats").insert({ user_a: userA, user_b: userB }).select("id").single();
        chat = nc;
      }
      if (!chat) { fallidos++; continue; }
      const { error: errMsg } = await supabase.from("dm_mensajes").insert({ chat_id: chat.id, autor_id: userId, texto: txt });
      if (errMsg) { fallidos++; continue; }
      // Incrementar no leído
      const esA = userA === userId;
      const { data: chatData } = await supabase.from("dm_chats").select("no_leido_a,no_leido_b").eq("id", chat.id).single();
      if (chatData) {
        await supabase.from("dm_chats").update({
          ultimo_mensaje_at: new Date().toISOString(),
          ...(esA ? { no_leido_b: (chatData.no_leido_b ?? 0) + 1 } : { no_leido_a: (chatData.no_leido_a ?? 0) + 1 }),
        }).eq("id", chat.id);
      }
      exitosos++;
    }
    setMensajeTexto("");
    setEnviando(false);
    showToast(fallidos > 0 ? `Enviado a ${exitosos} de ${miembros.length} destinatarios` : `✓ Mensaje enviado a ${exitosos} destinatarios`);
  };

  const eliminarLista = async () => {
    if (!lista) return;
    await supabase.from("listas_distribucion").delete().eq("id", lista.id);
    router.push("/comunidad");
  };

  const toggleActiva = async () => {
    if (!lista) return;
    const nuevoEstado = !lista.activa;
    await supabase.from("listas_distribucion").update({ activa: nuevoEstado }).eq("id", lista.id);
    setLista({ ...lista, activa: nuevoEstado });
    showToast(nuevoEstado ? "Lista activada" : "Lista pausada");
  };

  const cambiarColor = async (color: string) => {
    if (!lista) return;
    const colorAnterior = lista.color;
    setLista({ ...lista, color });
    const { error } = await supabase.from("listas_distribucion").update({ color }).eq("id", lista.id);
    if (error) {
      setLista(prev => prev ? { ...prev, color: colorAnterior } : null);
      showToast("No se pudo cambiar el color");
    }
  };

  const colegasNoAgregados = busquedaAgregar.trim()
    ? todosLosColegas.filter(c => `${c.nombre} ${c.apellido} ${c.matricula ?? ""}`.toLowerCase().includes(busquedaAgregar.toLowerCase()))
    : todosLosColegas;

  const initials = (p: { nombre: string; apellido: string }) => `${p.nombre?.charAt(0) ?? ""}${p.apellido?.charAt(0) ?? ""}`.toUpperCase();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(153,0,0,0.3)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", fontSize: 18, cursor: "pointer", padding: "4px 8px", marginTop: 2 }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 2 }}>
            📢 {lista?.nombre}
          </h1>
          <p style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>
            {miembros.length} {miembros.length === 1 ? "destinatario" : "destinatarios"}
            {lista?.descripcion ? ` · ${lista.descripcion}` : ""}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "var(--gfi-text-dim)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 2 }}>Color</span>
            {COLORES_LISTA.map(c => (
              <button key={c} type="button" onClick={() => cambiarColor(c)} aria-label={`Color ${c}`}
                style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: "none", cursor: "pointer", outline: (lista?.color ?? "#3b82f6") === c ? "2px solid #fff" : "none", outlineOffset: 1 }} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={toggleActiva}
            style={{ padding: "6px 12px", background: lista?.activa ? "var(--gfi-border-subtle)" : "rgba(34,197,94,0.1)", border: `1px solid ${lista?.activa ? "var(--gfi-border)" : "rgba(34,197,94,0.3)"}`, borderRadius: 6, color: lista?.activa ? "var(--gfi-text-muted)" : "#4ade80", fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            {lista?.activa ? "Pausar" : "Activar"}
          </button>
          <button
            onClick={() => setConfirmEliminar(true)}
            style={{ padding: "6px 12px", background: "rgba(153,0,0,0.08)", border: "1px solid rgba(153,0,0,0.2)", borderRadius: 6, color: "#990000", fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Eliminar
          </button>
        </div>
      </div>

      {/* Enviar mensaje */}
      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--gfi-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          Enviar mensaje a todos
        </div>
        <textarea
          placeholder={lista?.activa ? "Escribí el mensaje que recibirán todos los destinatarios..." : "Esta lista está pausada"}
          value={mensajeTexto}
          onChange={e => setMensajeTexto(e.target.value)}
          disabled={!lista?.activa}
          rows={3}
          style={{ width: "100%", padding: "10px 12px", background: "var(--gfi-border-subtle)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif", resize: "vertical", boxSizing: "border-box", opacity: lista?.activa ? 1 : 0.5 }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button
            onClick={enviarMensaje}
            disabled={enviando || !mensajeTexto.trim() || !lista?.activa || miembros.length === 0}
            style={{ padding: "9px 20px", background: "#990000", border: "none", borderRadius: 6, color: "#fff", fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: (enviando || !mensajeTexto.trim() || !lista?.activa || miembros.length === 0) ? 0.5 : 1 }}
          >
            {enviando ? "Enviando..." : `➤ Enviar a ${miembros.length} destinatarios`}
          </button>
        </div>
      </div>

      {/* Miembros */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--gfi-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Destinatarios</span>
        <button
          onClick={() => setMostrarAgregar(v => !v)}
          style={{ padding: "5px 12px", background: mostrarAgregar ? "rgba(153,0,0,0.1)" : "var(--gfi-border-subtle)", border: `1px solid ${mostrarAgregar ? "rgba(153,0,0,0.3)" : "var(--gfi-border)"}`, borderRadius: 6, color: mostrarAgregar ? "#990000" : "var(--gfi-text-secondary)", fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          {mostrarAgregar ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {mostrarAgregar && (
        <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <input
              autoFocus
              placeholder="Buscar colega..."
              value={busquedaAgregar}
              onChange={e => setBusquedaAgregar(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", background: "var(--gfi-border-subtle)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, color: "#fff", fontSize: 12, outline: "none", fontFamily: "Inter,sans-serif", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {colegasNoAgregados.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--gfi-text-muted)", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
                {busquedaAgregar ? "Sin resultados" : "Todos los colegas ya están en la lista"}
              </div>
            ) : colegasNoAgregados.map(c => (
              <div
                key={c.id}
                onClick={() => agregarMiembro(c)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--gfi-border-subtle)", transition: "background 0.15s" }}
                onMouseOver={e => (e.currentTarget.style.background = "var(--gfi-bg-card)")}
                onMouseOut={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--gfi-text-muted)", flexShrink: 0 }}>
                  {initials(c)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#fff", fontFamily: "Inter,sans-serif", fontWeight: 600 }}>{c.apellido}, {c.nombre}</div>
                  {c.matricula && <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>Mat. {c.matricula}</div>}
                </div>
                <span style={{ fontSize: 18, color: "rgba(34,197,94,0.7)" }}>+</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden" }}>
        {miembros.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--gfi-text-muted)", fontSize: 13, fontFamily: "Inter,sans-serif" }}>
            Sin destinatarios. Agregá colegas con el botón de arriba.
          </div>
        ) : miembros.map(m => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: "1px solid var(--gfi-border-subtle)" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(153,0,0,0.1)", border: "1px solid rgba(153,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 800, color: "#990000", flexShrink: 0, overflow: "hidden" }}>
              {m.foto_url ? <img src={m.foto_url} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(m)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "Inter,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.apellido}, {m.nombre}
              </div>
              {m.matricula && <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>Mat. {m.matricula}</div>}
            </div>
            <button
              onClick={() => quitarMiembro(m.id)}
              style={{ background: "none", border: "none", color: "rgba(255,0,0,0.4)", fontSize: 18, cursor: "pointer", padding: "4px 8px", flexShrink: 0 }}
              title="Quitar de la lista"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid var(--gfi-border)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}

      {confirmEliminar && (
        <div onClick={() => setConfirmEliminar(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: 12, padding: "24px 20px", width: "100%", maxWidth: 360, border: "1px solid var(--gfi-border)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Eliminar lista</div>
            <p style={{ fontSize: 13, color: "var(--gfi-text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>¿Eliminás permanentemente la lista "{lista?.nombre}"? Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminar(false)} style={{ flex: 1, padding: 11, background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 8, color: "#fff", fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={eliminarLista} style={{ flex: 1, padding: 11, background: "#990000", border: "none", borderRadius: 8, color: "#fff", fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
