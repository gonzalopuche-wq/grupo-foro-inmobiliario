"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

interface Grupo {
  id: string; nombre: string; icono: string; tipo: string;
  va_al_mir: boolean; solo_matriculado: boolean; orden: number;
  ultimo_mensaje?: string; ultimo_autor?: string; ultimo_at?: string;
}

interface DMChat {
  id: string; user_a: string; user_b: string;
  no_leido_a: number; no_leido_b: number;
  ultimo_mensaje_at: string | null;
  otro: { id: string; nombre: string; apellido: string; foto_url: string | null; matricula: string | null };
  ultimo_texto?: string | null;
  no_leido: number;
}

interface Lista {
  id: string; nombre: string; descripcion: string | null;
  activa: boolean; created_at: string;
  _miembros?: number;
}

type Tab = "grupos" | "mensajes" | "listas";

// Grupos de operaciones inmobiliarias que colaboradores pueden ver
const NOMBRES_GRUPOS_COLABORADOR = [
  "alquiler", "venta", "ventas", "alquileres",
  "búsqueda", "busqueda", "ofrecido", "ofrecidos",
  "comercial", "comerciales",
  "permuta", "permutas",
  "depósito", "deposito", "galpón", "galpon", "depósitos", "depositos", "galpones",
  "terreno", "terrenos", "lote", "lotes",
];

function grupoPermitidoColaborador(g: Grupo): boolean {
  if (g.tipo === "operaciones") return true;
  const nombre = g.nombre.toLowerCase();
  return NOMBRES_GRUPOS_COLABORADOR.some(k => nombre.includes(k));
}

export default function ComunidadPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("grupos");
  const [userId, setUserId] = useState<string | null>(null);
  const [esColaborador, setEsColaborador] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [dms, setDms] = useState<DMChat[]>([]);
  const [listas, setListas] = useState<Lista[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDms, setLoadingDms] = useState(false);
  const [loadingListas, setLoadingListas] = useState(false);
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);

      const { data: perfil } = await supabase
        .from("perfiles").select("tipo").eq("id", session.user.id).single();
      const tipo = perfil?.tipo ?? "corredor";
      const isColab = tipo === "colaborador";
      setEsColaborador(isColab);

      let query = supabase.from("grupos_chat").select("*").eq("activo", true).order("orden");
      if (isColab) query = query.eq("solo_matriculado", false);
      const { data: gruposRaw } = await query;
      if (!gruposRaw) { setLoading(false); return; }

      // Colaboradores solo ven grupos de operaciones inmobiliarias
      let gruposData = isColab
        ? gruposRaw.filter((g: any) => grupoPermitidoColaborador(g))
        : gruposRaw;

      const grupoIds = gruposData.map((g: any) => g.id);
      const { data: ultimos } = await supabase
        .from("mensajes_chat")
        .select("grupo_id, texto, created_at, perfiles(nombre, apellido)")
        .in("grupo_id", grupoIds)
        .order("created_at", { ascending: false })
        .limit(grupoIds.length * 3);

      const ultimosPorGrupo: Record<string, any> = {};
      (ultimos ?? []).forEach((m: any) => {
        if (!ultimosPorGrupo[m.grupo_id]) ultimosPorGrupo[m.grupo_id] = m;
      });

      setGrupos(gruposData.map((g: any) => {
        const u = ultimosPorGrupo[g.id];
        return {
          ...g,
          ultimo_mensaje: u?.texto ?? null,
          ultimo_autor: u?.perfiles ? `${(u.perfiles as any).nombre} ${(u.perfiles as any).apellido}` : null,
          ultimo_at: u?.created_at ?? null,
        };
      }));
      setLoading(false);

      // Cargar DMs en paralelo
      cargarDMs(session.user.id);
    };
    init();
  }, []);

  const cargarDMs = async (uid: string) => {
    setLoadingDms(true);
    const { data: chats } = await supabase
      .from("dm_chats")
      .select("*, ua:user_a(id,nombre,apellido,foto_url,matricula), ub:user_b(id,nombre,apellido,foto_url,matricula)")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false });

    if (!chats) { setLoadingDms(false); return; }

    // Traer el último mensaje de cada chat
    const chatIds = chats.map((c: any) => c.id);
    let ultimosPorChat: Record<string, string | null> = {};
    if (chatIds.length > 0) {
      const { data: ultMsgs } = await supabase
        .from("dm_mensajes")
        .select("chat_id, texto, created_at")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false })
        .limit(chatIds.length * 2);
      (ultMsgs ?? []).forEach((m: any) => {
        if (!ultimosPorChat[m.chat_id]) ultimosPorChat[m.chat_id] = m.texto;
      });
    }

    let total = 0;
    const dmList: DMChat[] = chats.map((c: any) => {
      const esA = c.user_a === uid;
      const otro = esA ? c.ub : c.ua;
      const noLeido = esA ? c.no_leido_a : c.no_leido_b;
      total += noLeido;
      return {
        id: c.id,
        user_a: c.user_a, user_b: c.user_b,
        no_leido_a: c.no_leido_a, no_leido_b: c.no_leido_b,
        ultimo_mensaje_at: c.ultimo_mensaje_at,
        otro: Array.isArray(otro) ? otro[0] : otro,
        ultimo_texto: ultimosPorChat[c.id] ?? null,
        no_leido: noLeido,
      };
    });
    setDms(dmList);
    setTotalNoLeidos(total);
    setLoadingDms(false);
  };

  const cargarListas = async (uid: string) => {
    setLoadingListas(true);
    const { data } = await supabase
      .from("listas_distribucion")
      .select("*")
      .eq("creador_id", uid)
      .order("created_at", { ascending: false });
    if (!data) { setLoadingListas(false); return; }

    // Contar miembros por lista
    const ids = data.map((l: any) => l.id);
    let cuentas: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: miembros } = await supabase
        .from("listas_distribucion_miembros")
        .select("lista_id")
        .in("lista_id", ids);
      (miembros ?? []).forEach((m: any) => {
        cuentas[m.lista_id] = (cuentas[m.lista_id] ?? 0) + 1;
      });
    }
    setListas(data.map((l: any) => ({ ...l, _miembros: cuentas[l.id] ?? 0 })));
    setLoadingListas(false);
  };

  useEffect(() => {
    if (tab === "listas" && userId && listas.length === 0) {
      cargarListas(userId);
    }
  }, [tab, userId]);

  const tiempoRelativo = (fecha: string) => {
    if (!fecha) return "";
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    const hs = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);
    if (min < 1) return "ahora";
    if (min < 60) return `${min}m`;
    if (hs < 24) return `${hs}h`;
    if (dias === 1) return "ayer";
    return `${dias}d`;
  };

  const initials = (nombre: string, apellido: string) =>
    `${nombre?.charAt(0) ?? ""}${apellido?.charAt(0) ?? ""}`.toUpperCase();

  const gruposOperaciones = grupos.filter(g => g.tipo === "operaciones");
  const gruposComunidad = grupos.filter(g => g.tipo !== "operaciones");

  const GrupoItem = ({ g }: { g: Grupo }) => (
    <div
      onClick={() => router.push(`/comunidad/${g.id}`)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--gfi-border-subtle)", transition: "background 0.15s" }}
      onMouseOver={e => (e.currentTarget.style.background = "var(--gfi-bg-card)")}
      onMouseOut={e => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ width: 44, height: 44, borderRadius: 10, background: g.va_al_mir ? "rgba(200,0,0,0.12)" : "rgba(255,255,255,0.06)", border: g.va_al_mir ? "1px solid rgba(200,0,0,0.25)" : "1px solid var(--gfi-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {g.icono}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "Inter,sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.nombre}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {g.va_al_mir && (
              <span style={{ fontSize: 8, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#990000", background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.2)", padding: "2px 5px", borderRadius: 3 }}>MIR</span>
            )}
            {g.ultimo_at && (
              <span style={{ fontSize: 10, color: "var(--gfi-text-dim)", fontFamily: "Inter,sans-serif" }}>{tiempoRelativo(g.ultimo_at)}</span>
            )}
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {g.ultimo_autor && g.ultimo_mensaje
            ? `${g.ultimo_autor}: ${g.ultimo_mensaje}`
            : "Sin mensajes aún"}
        </p>
      </div>
    </div>
  );

  const DMItem = ({ dm }: { dm: DMChat }) => {
    const otro = dm.otro;
    const nombre = otro ? `${otro.apellido ?? ""}, ${otro.nombre ?? ""}`.replace(/^, /, "") : "—";
    return (
      <div
        onClick={() => router.push(`/comunidad/dm/${otro?.id}`)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--gfi-border-subtle)", transition: "background 0.15s" }}
        onMouseOver={e => (e.currentTarget.style.background = "var(--gfi-bg-card)")}
        onMouseOut={e => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 800, color: "#990000", flexShrink: 0, overflow: "hidden", position: "relative" }}>
          {otro?.foto_url
            ? <img src={otro.foto_url} alt={nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : initials(otro?.nombre ?? "", otro?.apellido ?? "")}
          {dm.no_leido > 0 && (
            <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, borderRadius: "50%", background: "#990000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", border: "2px solid #0a0a0a" }}>
              {dm.no_leido > 9 ? "9+" : dm.no_leido}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontFamily: "Inter,sans-serif", fontSize: 13, fontWeight: dm.no_leido > 0 ? 700 : 600, color: dm.no_leido > 0 ? "#fff" : "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nombre}
            </span>
            {dm.ultimo_mensaje_at && (
              <span style={{ fontSize: 10, color: "var(--gfi-text-dim)", fontFamily: "Inter,sans-serif", flexShrink: 0 }}>{tiempoRelativo(dm.ultimo_mensaje_at)}</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: dm.no_leido > 0 ? "rgba(255,255,255,0.55)" : "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: dm.no_leido > 0 ? 600 : 400 }}>
            {dm.ultimo_texto ?? "Iniciar conversación"}
          </p>
        </div>
      </div>
    );
  };

  const ListaItem = ({ l }: { l: Lista }) => (
    <div
      onClick={() => router.push(`/comunidad/listas/${l.id}`)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--gfi-border-subtle)", transition: "background 0.15s" }}
      onMouseOver={e => (e.currentTarget.style.background = "var(--gfi-bg-card)")}
      onMouseOut={e => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--gfi-border-subtle)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        📢
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "Inter,sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.nombre}
          </span>
          {!l.activa && (
            <span style={{ fontSize: 9, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", padding: "1px 6px", borderRadius: 3, flexShrink: 0 }}>Pausada</span>
          )}
        </div>
        <p style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>
          {l._miembros ?? 0} {l._miembros === 1 ? "destinatario" : "destinatarios"}
          {l.descripcion ? ` · ${l.descripcion}` : ""}
        </p>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
          Comunidad GFI®
        </h1>
      </div>

      {/* Aviso para colaboradores */}
      {esColaborador && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 12, color: "rgba(245,158,11,0.8)", fontFamily: "Inter,sans-serif" }}>
          Acceso limitado · Solo grupos de operaciones inmobiliarias. Los grupos de la comunidad profesional son exclusivos para Corredores Inmobiliarios matriculados.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden" }}>
        {([
          { key: "grupos", label: "Grupos", badge: 0 },
          { key: "mensajes", label: "Mensajes", badge: totalNoLeidos },
          ...(!esColaborador ? [{ key: "listas" as Tab, label: "Listas", badge: 0 }] : []),
        ] as { key: Tab; label: string; badge: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "12px 8px", background: tab === t.key ? "rgba(200,0,0,0.1)" : "transparent",
              border: "none", borderBottom: tab === t.key ? "2px solid #990000" : "2px solid transparent",
              color: tab === t.key ? "#fff" : "var(--gfi-text-muted)",
              fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {t.label}
            {t.badge > 0 && (
              <span style={{ background: "#990000", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {t.badge > 9 ? "9+" : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Grupos */}
      {tab === "grupos" && (
        <>
          <p style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginBottom: 14 }}>
            {grupos.length} grupos · Los grupos MIR cargan al Motor de Match automáticamente
          </p>
          {gruposOperaciones.length > 0 && (
            <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gfi-text-muted)" }}>Operaciones</span>
                <span style={{ fontSize: 9, color: "#990000", background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.2)", padding: "1px 6px", borderRadius: 3, fontFamily: "var(--font-display)", fontWeight: 700 }}>→ MIR automático</span>
              </div>
              {gruposOperaciones.map(g => <GrupoItem key={g.id} g={g} />)}
            </div>
          )}
          {gruposComunidad.length > 0 && (
            <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gfi-text-muted)" }}>Comunidad</span>
              </div>
              {gruposComunidad.map(g => <GrupoItem key={g.id} g={g} />)}
            </div>
          )}
        </>
      )}

      {/* Tab: Mensajes (DMs) */}
      {tab === "mensajes" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>
              Chat privado con colegas
            </p>
            <button
              onClick={() => router.push("/comunidad/dm/nuevo")}
              style={{ padding: "7px 14px", background: "#990000", border: "none", borderRadius: 6, color: "#fff", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
            >
              + Nuevo mensaje
            </button>
          </div>
          {loadingDms ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <div style={{ width: 24, height: 24, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : dms.length === 0 ? (
            <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, padding: "40px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--gfi-text-secondary)", marginBottom: 6 }}>Sin conversaciones</div>
              <div style={{ fontSize: 12, color: "var(--gfi-text-dim)", fontFamily: "Inter,sans-serif", marginBottom: 20 }}>Iniciá un chat privado con algún colega</div>
              <button
                onClick={() => router.push("/comunidad/dm/nuevo")}
                style={{ padding: "9px 20px", background: "#990000", border: "none", borderRadius: 6, color: "#fff", fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                Nuevo mensaje
              </button>
            </div>
          ) : (
            <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden" }}>
              {dms.map(dm => <DMItem key={dm.id} dm={dm} />)}
            </div>
          )}
        </>
      )}

      {/* Tab: Listas de distribución */}
      {tab === "listas" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>
              Enviá un mensaje a varios colegas a la vez
            </p>
            <button
              onClick={() => router.push("/comunidad/listas/nueva")}
              style={{ padding: "7px 14px", background: "#990000", border: "none", borderRadius: 6, color: "#fff", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
            >
              + Nueva lista
            </button>
          </div>
          {loadingListas ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <div style={{ width: 24, height: 24, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : listas.length === 0 ? (
            <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, padding: "40px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📢</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--gfi-text-secondary)", marginBottom: 6 }}>Sin listas de distribución</div>
              <div style={{ fontSize: 12, color: "var(--gfi-text-dim)", fontFamily: "Inter,sans-serif", marginBottom: 20 }}>Creá una lista para enviar mensajes masivos a colegas</div>
              <button
                onClick={() => router.push("/comunidad/listas/nueva")}
                style={{ padding: "9px 20px", background: "#990000", border: "none", borderRadius: 6, color: "#fff", fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                Crear lista
              </button>
            </div>
          ) : (
            <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, overflow: "hidden" }}>
              {listas.map(l => <ListaItem key={l.id} l={l} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
