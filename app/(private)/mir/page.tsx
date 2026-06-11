"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { etiquetaTipoPropiedad } from "../../lib/tipoPropiedad";

const OPS_OFRECIDO = [
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "temporario", label: "Temporario" },
  { value: "permuta", label: "Permuta" },
  { value: "comercial", label: "Inmueble Comercial" },
  { value: "fondo_comercio", label: "Fondo de Comercio" },
  { value: "campo", label: "Campo / Chacra" },
];

const OPS_BUSQUEDA = [
  { value: "compra", label: "Comprar" },
  { value: "alquiler", label: "Alquilar" },
  { value: "temporario", label: "Temporario" },
  { value: "permuta", label: "Permuta" },
  { value: "comercial", label: "Inmueble Comercial" },
  { value: "fondo_comercio", label: "Fondo de Comercio" },
  { value: "campo", label: "Campo / Chacra" },
];

const MATCH_OP: Record<string, string> = {
  venta: "compra", alquiler: "alquiler", temporario: "temporario",
  permuta: "permuta", comercial: "comercial", fondo_comercio: "fondo_comercio", campo: "campo",
};

const OP_TO_CARTERA: Record<string, string> = {
  venta: "Venta", alquiler: "Alquiler", temporario: "Alquiler temporal",
  permuta: "Venta", comercial: "Venta", fondo_comercio: "Venta", campo: "Venta",
};

const TIPOS_PROPIEDAD = [
  "Departamento", "Casa", "Terreno o Lote", "Departamento de Pasillo",
  "Cochera", "Oficina", "Local Comercial", "Galpón", "Campo",
  "Negocio o Fondo de Comercio", "Consultorio", "Baulera", "Hotel", "Habitación",
  "Chacra", "Establecimiento Rural", "Inmueble Comercial",
];

const LOCALIDADES = [
  "Rosario", "Roldán", "Funes", "San Lorenzo", "Capitán Bermúdez",
  "Granadero Baigorria", "Pérez", "Soldini", "Ricardone", "Alvear",
  "Villa Gobernador Gálvez", "Pueblo Esther", "General Lagos", "Arroyo Seco",
  "Casilda", "Carcarañá", "Cañada de Gómez", "Villa Constitución",
  "San Jerónimo Norte", "Acebal", "Totoras", "Rufino", "Venado Tuerto",
];

const ANTIGUEDADES = [
  { value: "", label: "Cualquier antigüedad" },
  { value: "a_estrenar", label: "A estrenar" },
  { value: "menos_5", label: "Menos de 5 años" },
  { value: "5_10", label: "5 a 10 años" },
  { value: "10_20", label: "10 a 20 años" },
  { value: "mas_20", label: "Más de 20 años" },
];

const OP_COLOR: Record<string, string> = {
  venta: "#3abab6", compra: "#3abab6", alquiler: "#4ab8d8",
  temporario: "#d4960c", permuta: "#c084fc", comercial: "#d4960c",
  fondo_comercio: "#fb7185", campo: "#84cc16",
};

const OP_LABEL: Record<string, string> = {
  venta: "Venta", compra: "Comprar", alquiler: "Alquiler",
  temporario: "Temporario", permuta: "Permuta",
  comercial: "Inmueble Comercial", fondo_comercio: "Fondo de Comercio", campo: "Campo / Chacra",
};

interface Ofrecido {
  id: string; perfil_id: string; operacion: string; tipo_propiedad: string;
  zona: string | null; ciudad: string; precio: number | null; moneda: string;
  dormitorios: number | null; banos: number | null;
  superficie_cubierta: number | null; superficie_total: number | null;
  antiguedad: string | null;
  apto_credito: boolean; uso_comercial: boolean; barrio_cerrado: boolean;
  con_cochera: boolean; acepta_mascotas: boolean; acepta_bitcoin: boolean;
  urgente: boolean; urgente_expires_at?: string | null;
  descripcion: string | null; activo: boolean; created_at: string;
  nombre_publicante?: string | null;
  ci_responsable_id?: string | null;
  ci_responsable?: { nombre: string; apellido: string; matricula: string | null; } | null;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; telefono: string | null; email: string | null; };
  cartera_id?: string | null;
}

interface Busqueda {
  id: string; perfil_id: string; operacion: string; tipo_propiedad: string;
  zona: string | null; ciudad: string;
  presupuesto_min: number | null; presupuesto_max: number | null; moneda: string;
  dormitorios_min: number | null; dormitorios_max: number | null;
  banos_min: number | null; banos_max: number | null;
  superficie_min: number | null; superficie_max: number | null;
  tipo_superficie: string; antiguedad: string | null;
  apto_credito: boolean; uso_comercial: boolean; con_cochera: boolean;
  barrio_cerrado: boolean; acepta_mascotas: boolean; acepta_bitcoin: boolean;
  urgente: boolean; urgente_expires_at?: string | null;
  descripcion: string | null; activo: boolean; created_at: string;
  nombre_publicante?: string | null;
  ci_responsable_id?: string | null;
  ci_responsable?: { nombre: string; apellido: string; matricula: string | null; } | null;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; telefono: string | null; email: string | null; };
}

interface Match {
  id: string; ofrecido_id: string; busqueda_id: string;
  costo_desbloqueo: number; desbloqueado_ofrecido: boolean; desbloqueado_busqueda: boolean;
  created_at: string;
}

interface Interes {
  id: string; tipo: string; publicacion_id: string; publicacion_tipo: string;
  remitente_id: string; destinatario_id: string; mensaje: string | null; leido: boolean;
  created_at: string;
  remitente?: { nombre: string; apellido: string; matricula: string | null; };
}

interface MirChat {
  id: string; publicacion_id: string; publicacion_tipo: string;
  corredor_a: string; corredor_b: string; ultimo_mensaje_at: string;
  perfil_otro?: { nombre: string; apellido: string; matricula: string | null; foto_url: string | null; };
  publicacion_titulo?: string;
  no_leidos?: number;
}

interface MirMensaje {
  id: string; chat_id: string; autor_id: string; texto: string; leido: boolean; created_at: string;
  autor?: { nombre: string; apellido: string; foto_url: string | null; };
}

interface FiltroLista {
  operaciones: string[]; localidades: string[]; tipos: string[];
  sup_min: string; sup_max: string;
  apto_credito: boolean; con_cochera: boolean; uso_comercial: boolean;
  barrio_cerrado: boolean; acepta_mascotas: boolean; acepta_bitcoin: boolean;
}

const FILTRO_VACIO: FiltroLista = {
  operaciones: [], localidades: [], tipos: [],
  sup_min: "", sup_max: "",
  apto_credito: false, con_cochera: false, uso_comercial: false,
  barrio_cerrado: false, acepta_mascotas: false, acepta_bitcoin: false,
};

const FORM_O = {
  operacion: "venta", tipo_propiedad: "Departamento",
  nombre_publicante: "", ci_responsable_id: "",
  zona: "", ciudad: "Rosario", precio: "", moneda: "USD",
  dormitorios: "", banos: "", superficie_cubierta: "", superficie_total: "",
  antiguedad: "",
  apto_credito: false, uso_comercial: false, barrio_cerrado: false,
  con_cochera: false, acepta_mascotas: false, acepta_bitcoin: false,
  urgente: false,
  descripcion: "",
};

const FORM_B = {
  operacion: "compra", tipo_propiedad: "Departamento",
  nombre_publicante: "", ci_responsable_id: "",
  zona: "", ciudad: "Rosario",
  presupuesto_min: "", presupuesto_max: "", moneda: "USD",
  dormitorios_min: "", dormitorios_max: "", banos_min: "", banos_max: "",
  superficie_min: "", superficie_max: "", tipo_superficie: "total",
  antiguedad: "",
  apto_credito: false, uso_comercial: false, con_cochera: false,
  barrio_cerrado: false, acepta_mascotas: false, acepta_bitcoin: false,
  urgente: false,
  descripcion: "",
};

const n = (v: string) => v ? parseFloat(v) : null;
const ni = (v: string) => v ? parseInt(v) : null;
const formatPeso = (v: number, m = "ARS") =>
  m === "USD" ? `USD ${v.toLocaleString("es-AR")}` :
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v);
const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
const formatHora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange(!value)}>
    <div style={{ width: 38, height: 22, borderRadius: 11, background: value ? "#990000" : "var(--gfi-border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: value ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{label}</span>
  </div>
);

export default function MirPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [vista, setVista] = useState<"ofrecidos" | "busquedas" | "matches" | "chats">("ofrecidos");
  const [ofrecidos, setOfrecidos] = useState<Ofrecido[]>([]);
  const [busquedas, setBusquedas] = useState<Busqueda[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [intereses, setIntereses] = useState<Interes[]>([]);
  const [chats, setChats] = useState<MirChat[]>([]);
  const [chatActivo, setChatActivo] = useState<MirChat | null>(null);
  const [mensajes, setMensajes] = useState<MirMensaje[]>([]);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mostrarFormO, setMostrarFormO] = useState(false);
  const [mostrarFormB, setMostrarFormB] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [formO, setFormO] = useState(FORM_O);
  const [formB, setFormB] = useState(FORM_B);
  const [filtro, setFiltro] = useState<FiltroLista>(FILTRO_VACIO);
  const [filtroTemp, setFiltroTemp] = useState<FiltroLista>(FILTRO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [esColaborador, setEsColaborador] = useState(false);
  const [corredoresColegas, setCorredoresColegas] = useState<{id:string;nombre:string;apellido:string;matricula:string|null}[]>([]);
  const [editandoOfrecido, setEditandoOfrecido] = useState<Ofrecido | null>(null);
  const [interesando, setInteresando] = useState<string | null>(null);
  const [modalInteres, setModalInteres] = useState<{ pub: Ofrecido | Busqueda; tipo: "me_interesa" | "tengo"; pubTipo: "ofrecido" | "busqueda" } | null>(null);
  const [msgInteres, setMsgInteres] = useState("");
  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const chatActivoIdRef = useRef<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);

      // Detectar si es colaborador y cargar CI colegas
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).maybeSingle();
      if (perfil?.tipo === "colaborador") {
        setEsColaborador(true);
        // Cargar el CI titular y sus colegas matriculados
        const { data: colegas } = await supabase
          .from("perfiles")
          .select("id,nombre,apellido,matricula")
          .eq("tipo", "corredor")
          .not("matricula", "is", null)
          .order("apellido");
        setCorredoresColegas(colegas ?? []);
      }

      const params = new URLSearchParams(window.location.search);
      const nuevo = params.get("nuevo");
      const vistaParam = params.get("vista");
      if (nuevo === "ofrecido") setMostrarFormO(true);
      else if (nuevo === "busqueda") { setVista("busquedas"); setMostrarFormB(true); }
      else if (vistaParam === "matches") setVista("matches");
    };
    init();
    cargarDatos();

    // ── Realtime: refrescar cuando el parser inserta desde el chat ───────────
    const channelMir = supabase.channel(`mir_realtime_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mir_ofrecidos" },
        () => { cargarDatos(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mir_busquedas" },
        () => { cargarDatos(); })
      .subscribe();

    return () => { supabase.removeChannel(channelMir); };
  }, []);

  useEffect(() => {
    if (vista === "chats" && userId) cargarChats(userId);
  }, [vista, userId]);

  useEffect(() => {
    if (chatActivo) {
      chatActivoIdRef.current = chatActivo.id;
      cargarMensajes(chatActivo.id);

      const chatId = chatActivo.id;
      const channelName = `mir-chat-${chatId}-${Date.now()}`;
      const sub = supabase.channel(channelName)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "mir_mensajes",
          filter: `chat_id=eq.${chatId}`
        }, (payload) => {
          const msg = payload.new as MirMensaje;
          setMensajes(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        })
        .subscribe();

      return () => {
        chatActivoIdRef.current = null;
        supabase.removeChannel(sub);
      };
    }
  }, [chatActivo?.id]);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: of }, { data: bu }, { data: ma }] = await Promise.all([
      supabase.from("mir_ofrecidos").select("*").eq("activo", true).order("created_at", { ascending: false }),
      supabase.from("mir_busquedas").select("*").eq("activo", true).order("created_at", { ascending: false }),
      supabase.from("mir_matches").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    // Fetch profile details for all unique perfil_ids (no FK join needed)
    const ids = [...new Set([...(of ?? []).map((r: any) => r.perfil_id), ...(bu ?? []).map((r: any) => r.perfil_id)])].filter(Boolean);
    const perfilesMap: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("perfiles").select("id,nombre,apellido,matricula,telefono,email").in("id", ids);
      (profs ?? []).forEach((p: any) => { perfilesMap[p.id] = p; });
    }
    const stitchPerfiles = (rows: any[]) => rows.map(r => ({ ...r, perfiles: perfilesMap[r.perfil_id] ?? null }));
    setOfrecidos(stitchPerfiles(of ?? []) as unknown as Ofrecido[]);
    setBusquedas(stitchPerfiles(bu ?? []) as unknown as Busqueda[]);
    setMatches((ma as unknown as Match[]) ?? []);
    setLoading(false);
  };

  const cargarIntereses = async (uid: string) => {
    const { data } = await supabase.from("mir_intereses")
      .select("*, remitente:perfiles!remitente_id(nombre,apellido,matricula)")
      .or(`remitente_id.eq.${uid},destinatario_id.eq.${uid}`)
      .order("created_at", { ascending: false });
    setIntereses((data as unknown as Interes[]) ?? []);
  };

  const cargarChats = async (uid: string) => {
    const { data } = await supabase.from("mir_chats")
      .select("*, perfil_a:perfiles!corredor_a(nombre,apellido,matricula,foto_url), perfil_b:perfiles!corredor_b(nombre,apellido,matricula,foto_url)")
      .or(`corredor_a.eq.${uid},corredor_b.eq.${uid}`)
      .order("ultimo_mensaje_at", { ascending: false });

    if (!data) return;
    const chatsConInfo = await Promise.all((data as any[]).map(async (c) => {
      const esA = c.corredor_a === uid;
      const perfilOtro = esA ? c.perfil_b : c.perfil_a;
      let titulo = "";
      if (c.publicacion_tipo === "ofrecido") {
        const of = ofrecidos.find(o => o.id === c.publicacion_id);
        titulo = of ? `${etiquetaTipoPropiedad(of.tipo_propiedad)} · ${of.ciudad}` : "Ofrecido";
      } else {
        const bu = busquedas.find(b => b.id === c.publicacion_id);
        titulo = bu ? `${etiquetaTipoPropiedad(bu.tipo_propiedad)} · ${bu.ciudad}` : "Búsqueda";
      }
      const { count } = await supabase.from("mir_mensajes")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", c.id).eq("leido", false).neq("autor_id", uid);
      return { ...c, perfil_otro: perfilOtro, publicacion_titulo: titulo, no_leidos: count ?? 0 };
    }));
    setChats(chatsConInfo);
  };

  const cargarMensajes = async (chatId: string) => {
    const { data } = await supabase.from("mir_mensajes")
      .select("*, autor:perfiles!autor_id(nombre,apellido,foto_url)")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    // Guard against stale fetch: only overwrite state if still on the same chat
    if (chatActivoIdRef.current === chatId) {
      setMensajes((data as unknown as MirMensaje[]) ?? []);
    }
    if (userId) {
      await supabase.from("mir_mensajes").update({ leido: true })
        .eq("chat_id", chatId).eq("leido", false).neq("autor_id", userId);
    }
  };

  const abrirChat = async (pubId: string, pubTipo: "ofrecido" | "busqueda", destinatarioId: string) => {
    if (!userId) return;
    const { data: existente } = await supabase.from("mir_chats")
      .select("*")
      .eq("publicacion_id", pubId)
      .or(`and(corredor_a.eq.${userId},corredor_b.eq.${destinatarioId}),and(corredor_a.eq.${destinatarioId},corredor_b.eq.${userId})`)
      .maybeSingle();

    if (existente) {
      setChatActivo(existente as MirChat);
    } else {
      const { data: nuevo } = await supabase.from("mir_chats").insert({
        publicacion_id: pubId, publicacion_tipo: pubTipo,
        corredor_a: userId, corredor_b: destinatarioId,
      }).select().single();
      if (nuevo) setChatActivo(nuevo as MirChat);
    }
    setVista("chats");
  };

  const enviarMensaje = async () => {
    if (!userId || !chatActivo || !textoMensaje.trim() || enviandoMsg) return;
    setEnviandoMsg(true);
    const texto = textoMensaje.trim();
    setTextoMensaje("");

    const msgTemp: MirMensaje = {
      id: `temp-${Date.now()}`,
      chat_id: chatActivo.id,
      autor_id: userId,
      texto,
      leido: false,
      created_at: new Date().toISOString(),
    };
    setMensajes(prev => [...prev, msgTemp]);

    const { data: inserted } = await supabase.from("mir_mensajes").insert({
      chat_id: chatActivo.id, autor_id: userId, texto,
    }).select().single();

    if (inserted) {
      setMensajes(prev => prev.map(m => m.id === msgTemp.id ? (inserted as MirMensaje) : m));
    }

    await supabase.from("mir_chats").update({ ultimo_mensaje_at: new Date().toISOString() }).eq("id", chatActivo.id);
    setEnviandoMsg(false);
  };

  const enviarInteres = async () => {
    if (!userId || !modalInteres || interesando) return;
    const { pub, tipo, pubTipo } = modalInteres;
    setInteresando(pub.id);
    const destinatarioId = pub.perfil_id;
    await supabase.from("mir_intereses").upsert({
      tipo, publicacion_id: pub.id, publicacion_tipo: pubTipo,
      remitente_id: userId, destinatario_id: destinatarioId,
      mensaje: msgInteres || null, leido: false,
    }, { onConflict: "publicacion_id,remitente_id,tipo" });
    await supabase.from("notificaciones").insert({
      user_id: destinatarioId,
      tipo: "mir_interes",
      titulo: tipo === "me_interesa" ? "Te consultaron por tu ofrecido" : "Alguien tiene algo para tu búsqueda",
      mensaje: msgInteres || (tipo === "me_interesa" ? "Un colega está interesado en tu ofrecido." : "Un colega tiene algo que coincide con tu búsqueda."),
      leida: false,
    });
    setModalInteres(null);
    setMsgInteres("");
    await abrirChat(pub.id, pubTipo, destinatarioId);
    setInteresando(null);
  };

  const yaMostreInteres = (pubId: string, tipo: string) =>
    intereses.some(i => i.publicacion_id === pubId && i.remitente_id === userId && i.tipo === tipo);

  const cantIntereses = (pubId: string) =>
    intereses.filter(i => i.publicacion_id === pubId && i.destinatario_id === userId && !i.leido).length;

  const aplicarFiltros = <T extends Ofrecido | Busqueda>(items: T[]): T[] => {
    return items.filter(item => {
      if (filtro.operaciones.length > 0 && !filtro.operaciones.includes(item.operacion)) return false;
      if (filtro.localidades.length > 0 && !filtro.localidades.some(l => item.ciudad.toLowerCase().includes(l.toLowerCase()))) return false;
      if (filtro.tipos.length > 0 && !filtro.tipos.includes(item.tipo_propiedad)) return false;
      if (filtro.apto_credito && !item.apto_credito) return false;
      if (filtro.uso_comercial && !item.uso_comercial) return false;
      if (filtro.barrio_cerrado && !item.barrio_cerrado) return false;
      if (filtro.acepta_mascotas && !item.acepta_mascotas) return false;
      if (filtro.acepta_bitcoin && !item.acepta_bitcoin) return false;
      if (filtro.con_cochera && !("con_cochera" in item && item.con_cochera)) return false;
      return true;
    });
  };

  const matchearOfrecido = async (of: Ofrecido) => {
    const opBusqueda = MATCH_OP[of.operacion];
    if (!opBusqueda) return;
    const { data: busqs } = await supabase.from("mir_busquedas").select("*")
      .eq("activo", true).eq("operacion", opBusqueda).eq("tipo_propiedad", of.tipo_propiedad).neq("perfil_id", of.perfil_id);
    for (const b of (busqs as Busqueda[]) ?? []) {
      if (cumpleMatch(of, b)) {
        await supabase.from("mir_matches").upsert(
          { ofrecido_id: of.id, busqueda_id: b.id },
          { onConflict: "ofrecido_id,busqueda_id" }
        );
      }
    }
  };

  const matchearBusqueda = async (bu: Busqueda) => {
    const opOfrecido = Object.entries(MATCH_OP).find(([, v]) => v === bu.operacion)?.[0];
    if (!opOfrecido) return;
    const { data: ofrs } = await supabase.from("mir_ofrecidos").select("*")
      .eq("activo", true).eq("operacion", opOfrecido).eq("tipo_propiedad", bu.tipo_propiedad).neq("perfil_id", bu.perfil_id);
    for (const o of (ofrs as Ofrecido[]) ?? []) {
      if (cumpleMatch(o, bu)) {
        await supabase.from("mir_matches").upsert(
          { ofrecido_id: o.id, busqueda_id: bu.id },
          { onConflict: "ofrecido_id,busqueda_id" }
        );
      }
    }
  };

  const cumpleMatch = (of: Ofrecido, bu: Busqueda): boolean => {
    const ciudadOk = (bu.ciudad ?? "").toLowerCase() === (of.ciudad ?? "").toLowerCase();
    const zonaOk = !bu.zona || !of.zona || of.zona.toLowerCase().includes(bu.zona.toLowerCase());
    const precioOk = !bu.presupuesto_max || !of.precio || of.precio <= bu.presupuesto_max;
    const precioMinOk = !bu.presupuesto_min || !of.precio || of.precio >= bu.presupuesto_min;
    const dormOk = !bu.dormitorios_min || !of.dormitorios || of.dormitorios >= bu.dormitorios_min;
    const dormMaxOk = !bu.dormitorios_max || !of.dormitorios || of.dormitorios <= bu.dormitorios_max;
    const banosOk = !bu.banos_min || !of.banos || of.banos >= bu.banos_min;
    const supOk = !bu.superficie_min || !of.superficie_total || of.superficie_total >= bu.superficie_min;
    const supMaxOk = !bu.superficie_max || !of.superficie_total || of.superficie_total <= bu.superficie_max;
    const creditoOk = !bu.apto_credito || of.apto_credito;
    const mascotasOk = !bu.acepta_mascotas || of.acepta_mascotas;
    const cocheraOk = !bu.con_cochera || of.con_cochera;
    return ciudadOk && zonaOk && precioOk && precioMinOk && dormOk && dormMaxOk && banosOk && supOk && supMaxOk && creditoOk && mascotasOk && cocheraOk;
  };

  const guardarOfrecido = async () => {
    if (!userId || !formO.ciudad) return;
    setGuardando(true);

    const mirPayload = {
      operacion: formO.operacion, tipo_propiedad: formO.tipo_propiedad,
      nombre_publicante: formO.nombre_publicante || null,
      ci_responsable_id: formO.ci_responsable_id || null,
      zona: formO.zona || null, ciudad: formO.ciudad,
      precio: n(formO.precio), moneda: formO.moneda,
      dormitorios: ni(formO.dormitorios), banos: ni(formO.banos),
      superficie_cubierta: n(formO.superficie_cubierta), superficie_total: n(formO.superficie_total),
      antiguedad: formO.antiguedad || null,
      apto_credito: formO.apto_credito, uso_comercial: formO.uso_comercial,
      barrio_cerrado: formO.barrio_cerrado, con_cochera: formO.con_cochera,
      acepta_mascotas: formO.acepta_mascotas, acepta_bitcoin: formO.acepta_bitcoin,
      urgente: formO.urgente,
      urgente_expires_at: formO.urgente
        ? (editandoOfrecido?.urgente ? (editandoOfrecido.urgente_expires_at ?? null) : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())
        : null,
      descripcion: formO.descripcion || null,
    };

    const carteraDatos = {
      titulo: `${etiquetaTipoPropiedad(formO.tipo_propiedad)} en ${formO.ciudad}`,
      operacion: OP_TO_CARTERA[formO.operacion] ?? "Venta",
      tipo: formO.tipo_propiedad,
      zona: formO.zona || null, ciudad: formO.ciudad,
      precio: n(formO.precio), moneda: formO.moneda,
      dormitorios: ni(formO.dormitorios), banos: ni(formO.banos),
      superficie_cubierta: n(formO.superficie_cubierta), superficie_total: n(formO.superficie_total),
      antiguedad: formO.antiguedad || null,
      apto_credito: formO.apto_credito, uso_comercial: formO.uso_comercial,
      barrio_cerrado: formO.barrio_cerrado, con_cochera: formO.con_cochera,
      acepta_mascotas: formO.acepta_mascotas,
      descripcion: formO.descripcion || null,
      compartir_en_red: true,
    };

    const { data: { session } } = await supabase.auth.getSession();

    if (editandoOfrecido) {
      const { error: mirError } = await supabase.from("mir_ofrecidos").update(mirPayload).eq("id", editandoOfrecido.id);
      if (mirError) { setGuardando(false); return; }
      if (editandoOfrecido.cartera_id && session) {
        await fetch("/api/cartera/guardar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ editandoId: editandoOfrecido.cartera_id, datos: carteraDatos }),
        });
      }
    } else {
      const { data: nuevo, error } = await supabase.from("mir_ofrecidos")
        .insert({ perfil_id: userId, ...mirPayload }).select().single();
      if (!error && nuevo) {
        await matchearOfrecido(nuevo as Ofrecido);
        if (session) {
          const res = await fetch("/api/cartera/guardar", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ datos: { ...carteraDatos, mir_ofrecido_id: nuevo.id } }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.propId) {
              await supabase.from("mir_ofrecidos").update({ cartera_id: result.propId }).eq("id", nuevo.id);
            }
          }
        }
      }
    }

    setGuardando(false); setMostrarFormO(false); setFormO(FORM_O); setEditandoOfrecido(null); cargarDatos();
  };

  const guardarBusqueda = async () => {
    if (!userId || !formB.ciudad) return;
    setGuardando(true);
    const { data: nueva, error } = await supabase.from("mir_busquedas").insert({
      perfil_id: userId, operacion: formB.operacion, tipo_propiedad: formB.tipo_propiedad,
      nombre_publicante: formB.nombre_publicante || null,
      ci_responsable_id: formB.ci_responsable_id || null,
      zona: formB.zona || null, ciudad: formB.ciudad,
      presupuesto_min: n(formB.presupuesto_min), presupuesto_max: n(formB.presupuesto_max), moneda: formB.moneda,
      dormitorios_min: ni(formB.dormitorios_min), dormitorios_max: ni(formB.dormitorios_max),
      banos_min: ni(formB.banos_min), banos_max: ni(formB.banos_max),
      superficie_min: n(formB.superficie_min), superficie_max: n(formB.superficie_max),
      tipo_superficie: formB.tipo_superficie, antiguedad: formB.antiguedad || null,
      apto_credito: formB.apto_credito, uso_comercial: formB.uso_comercial,
      con_cochera: formB.con_cochera, barrio_cerrado: formB.barrio_cerrado,
      acepta_mascotas: formB.acepta_mascotas, acepta_bitcoin: formB.acepta_bitcoin,
      urgente: formB.urgente,
      urgente_expires_at: formB.urgente ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null,
      descripcion: formB.descripcion || null,
    }).select().single();
    if (!error && nueva) await matchearBusqueda(nueva as Busqueda);
    setGuardando(false); setMostrarFormB(false); setFormB(FORM_B); cargarDatos();
  };

  const editarOfrecido = (o: Ofrecido) => {
    setFormO({
      operacion: o.operacion, tipo_propiedad: o.tipo_propiedad,
      nombre_publicante: o.nombre_publicante ?? "",
      ci_responsable_id: o.ci_responsable_id ?? "",
      zona: o.zona ?? "", ciudad: o.ciudad,
      precio: o.precio !== null ? String(o.precio) : "",
      moneda: o.moneda,
      dormitorios: o.dormitorios !== null ? String(o.dormitorios) : "",
      banos: o.banos !== null ? String(o.banos) : "",
      superficie_cubierta: o.superficie_cubierta !== null ? String(o.superficie_cubierta) : "",
      superficie_total: o.superficie_total !== null ? String(o.superficie_total) : "",
      antiguedad: o.antiguedad ?? "",
      apto_credito: o.apto_credito, uso_comercial: o.uso_comercial,
      barrio_cerrado: o.barrio_cerrado, con_cochera: o.con_cochera,
      acepta_mascotas: o.acepta_mascotas, acepta_bitcoin: o.acepta_bitcoin,
      urgente: o.urgente, descripcion: o.descripcion ?? "",
    });
    setEditandoOfrecido(o);
    setMostrarFormO(true);
  };

  const desactivar = async (tabla: string, id: string) => {
    if (tabla === "mir_ofrecidos") {
      const of = ofrecidos.find(o => o.id === id);
      if (of?.cartera_id) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch("/api/cartera/guardar", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ editandoId: of.cartera_id, datos: { compartir_en_red: false } }),
            });
          }
        } catch {}
      }
    }
    await supabase.from(tabla).update({ activo: false }).eq("id", id);
    cargarDatos();
  };

  const ofsFilt = aplicarFiltros(ofrecidos);
  const busFilt = aplicarFiltros(busquedas);
  const matchesPropios = matches.filter(m =>
    ofrecidos.find(o => o.id === m.ofrecido_id)?.perfil_id === userId ||
    busquedas.find(b => b.id === m.busqueda_id)?.perfil_id === userId
  );
  const cantFiltrosActivos = filtro.operaciones.length + filtro.localidades.length + filtro.tipos.length +
    [filtro.apto_credito, filtro.con_cochera, filtro.uso_comercial, filtro.barrio_cerrado, filtro.acepta_mascotas, filtro.acepta_bitcoin].filter(Boolean).length;
  const totalNoLeidos = chats.reduce((acc, c) => acc + (c.no_leidos ?? 0), 0);

  const toggleFiltroItem = (key: "operaciones" | "localidades" | "tipos", val: string) => {
    setFiltroTemp(f => ({
      ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val]
    }));
  };

  const BotonesInteres = ({ pub, pubTipo }: { pub: Ofrecido | Busqueda; pubTipo: "ofrecido" | "busqueda" }) => {
    if (pub.perfil_id === userId) return null;
    const yaInteresa = yaMostreInteres(pub.id, "me_interesa");
    const yaTengo = yaMostreInteres(pub.id, "tengo");
    return (
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        <button
          style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${yaInteresa ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.15)"}`, background: yaInteresa ? "rgba(34,197,94,0.1)" : "transparent", color: yaInteresa ? "#3abab6" : "var(--gfi-text-secondary)", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, cursor: yaInteresa ? "default" : "pointer", transition: "all 0.15s" }}
          onClick={() => !yaInteresa && setModalInteres({ pub, tipo: "me_interesa", pubTipo })}
          disabled={interesando === pub.id}
        >
          {yaInteresa ? "✓ Interesado" : "Me interesa"}
        </button>
        <button
          style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${yaTengo ? "rgba(74,184,216,0.5)" : "rgba(255,255,255,0.15)"}`, background: yaTengo ? "rgba(74,184,216,0.1)" : "transparent", color: yaTengo ? "#4ab8d8" : "var(--gfi-text-secondary)", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, cursor: yaTengo ? "default" : "pointer", transition: "all 0.15s" }}
          onClick={() => !yaTengo && setModalInteres({ pub, tipo: "tengo", pubTipo })}
          disabled={interesando === pub.id}
        >
          {yaTengo ? "✓ Enviado" : "Tengo"}
        </button>
        {cantIntereses(pub.id) > 0 && (
          <span style={{ padding: "5px 10px", borderRadius: 20, background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.25)", color: "#990000", fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {cantIntereses(pub.id)} nuevo{cantIntereses(pub.id) !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .mir-tabs { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
        .mir-tab { padding: 9px 22px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gfi-text-muted); cursor: pointer; transition: var(--gfi-transition); position: relative; }
        .mir-tab.activo { border-color: var(--gfi-red); color: var(--gfi-text-primary); background: var(--gfi-red-soft); }
        .mir-tab:hover:not(.activo) { border-color: var(--gfi-border-bright); color: var(--gfi-text-secondary); }
        .mir-tab-badge { position: absolute; top: -6px; right: -6px; background: var(--gfi-red); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 10px; min-width: 16px; text-align: center; }
        .mir-tab-badge.verde { background: var(--gfi-green-text); }
        .mir-barra { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .mir-barra-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .mir-btn-pub { padding: 9px 20px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-sm); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; box-shadow: var(--gfi-shadow-red); transition: var(--gfi-transition); }
        .mir-btn-pub:hover { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }
        .mir-btn-filtrar { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .mir-btn-filtrar:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .mir-btn-filtrar.activo { border-color: var(--gfi-red-border); background: var(--gfi-red-soft); color: var(--gfi-text-primary); }
        .mir-filtro-badge { background: var(--gfi-red); color: #fff; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 10px; }
        .mir-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .mir-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; transition: var(--gfi-transition); position: relative; overflow: hidden; }
        .mir-card::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,0.012) 0%, transparent 60%); pointer-events: none; }
        .mir-card:hover { border-color: var(--gfi-border-bright); box-shadow: var(--gfi-shadow-md); }
        .mir-card.propia { border-color: var(--gfi-red-border); background: var(--gfi-bg-elevated); }
        .mir-card.urgente-card { border-color: rgba(196,74,0,0.4); box-shadow: 0 0 12px rgba(196,74,0,0.1); }
        .mir-urgente-badge { display: inline-flex; align-items: center; gap: 4px; background: var(--gfi-orange-soft); border: 1px solid var(--gfi-orange-border); color: #d4960c; font-family: var(--font-display); font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: 10px; }
        .mir-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .mir-card-titulo { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--gfi-text-primary); }
        .mir-op-badge { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; flex-shrink: 0; }
        .mir-precio { font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: var(--gfi-green-text); font-variant-numeric: tabular-nums; }
        .mir-zona { font-size: 12px; color: var(--gfi-text-secondary); }
        .mir-detalles { display: flex; gap: 8px; flex-wrap: wrap; }
        .mir-det { font-size: 11px; color: var(--gfi-text-muted); background: var(--gfi-border-subtle); padding: 3px 8px; border-radius: var(--gfi-radius-sm); border: 1px solid var(--gfi-border-subtle); }
        .mir-extras { display: flex; gap: 6px; flex-wrap: wrap; }
        .mir-extra { font-size: 9px; color: var(--gfi-text-secondary); background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); padding: 2px 7px; border-radius: 10px; }
        .mir-desc { font-size: 12px; color: var(--gfi-text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .mir-card-footer { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 2px; }
        .mir-corredor { font-size: 11px; color: var(--gfi-text-muted); }
        .mir-corredor b { color: var(--gfi-text-secondary); }
        .mir-fecha { font-family: var(--font-mono); font-size: 10px; color: var(--gfi-text-dim); margin-top: 2px; }
        .mir-btn-baja { padding: 4px 10px; background: transparent; border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-sm); color: rgba(153,0,0,0.7); font-size: 9px; cursor: pointer; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; transition: var(--gfi-transition); }
        .mir-btn-baja:hover { background: var(--gfi-red-soft); color: var(--gfi-red); }
        .mir-btn-editar { padding: 4px 10px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-muted); font-size: 9px; cursor: pointer; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; transition: var(--gfi-transition); }
        .mir-btn-editar:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .mir-empty { padding: 64px 32px; text-align: center; color: var(--gfi-text-dim); font-size: 14px; font-style: italic; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); }
        .mir-match-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-md); padding: 16px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .mir-match-lados { display: flex; gap: 16px; flex: 1; flex-wrap: wrap; }
        .mir-match-lado { flex: 1; min-width: 160px; }
        .mir-match-lado-titulo { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-dim); margin-bottom: 5px; }
        .mir-match-info { font-size: 13px; color: var(--gfi-text-primary); font-weight: 600; }
        .mir-match-sub { font-size: 11px; color: var(--gfi-text-secondary); margin-top: 3px; }
        .mir-match-sep { width: 1px; background: var(--gfi-border-subtle); align-self: stretch; }
        .mir-chats-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; height: calc(100vh - 200px); min-height: 400px; }
        .mir-chats-lista { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); overflow-y: auto; }
        .mir-chat-item { padding: 14px 16px; border-bottom: 1px solid var(--gfi-border-subtle); cursor: pointer; transition: background var(--gfi-transition-fast); display: flex; align-items: center; gap: 10px; }
        .mir-chat-item:hover { background: var(--gfi-bg-hover); }
        .mir-chat-item.activo { background: var(--gfi-red-soft); border-left: 2px solid var(--gfi-red); }
        .mir-chat-avatar { width: 36px; height: 36px; border-radius: var(--gfi-radius-md); background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 12px; font-weight: 800; color: var(--gfi-red); flex-shrink: 0; overflow: hidden; }
        .mir-chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .mir-chat-info { flex: 1; min-width: 0; }
        .mir-chat-nombre { font-size: 12px; font-weight: 600; color: var(--gfi-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mir-chat-pub { font-size: 10px; color: var(--gfi-text-dim); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mir-chat-badge { background: var(--gfi-red); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 10px; flex-shrink: 0; }
        .mir-chat-ventana { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); display: flex; flex-direction: column; overflow: hidden; }
        .mir-chat-header { padding: 14px 18px; border-bottom: 1px solid var(--gfi-border-subtle); display: flex; align-items: center; gap: 10px; }
        .mir-chat-mensajes { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .mir-chat-mensajes::-webkit-scrollbar { width: 4px; }
        .mir-chat-mensajes::-webkit-scrollbar-thumb { background: var(--gfi-border); }
        .mir-msg { max-width: 75%; }
        .mir-msg.mio { align-self: flex-end; }
        .mir-msg.otro { align-self: flex-start; }
        .mir-msg-burbuja { padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
        .mir-msg.mio .mir-msg-burbuja { background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); color: var(--gfi-text-primary); border-radius: 12px 12px 2px 12px; }
        .mir-msg.otro .mir-msg-burbuja { background: var(--gfi-bg-elevated); border: 1px solid var(--gfi-border); color: var(--gfi-text-secondary); border-radius: 12px 12px 12px 2px; }
        .mir-msg-meta { font-family: var(--font-mono); font-size: 10px; color: var(--gfi-text-dim); margin-top: 3px; }
        .mir-msg.mio .mir-msg-meta { text-align: right; }
        .mir-chat-input { padding: 12px 16px; border-top: 1px solid var(--gfi-border-subtle); display: flex; gap: 10px; align-items: flex-end; }
        .mir-chat-textarea { flex: 1; padding: 10px 14px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); resize: none; min-height: 40px; max-height: 120px; line-height: 1.4; transition: var(--gfi-transition); }
        .mir-chat-textarea:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-glow); }
        .mir-chat-textarea::placeholder { color: var(--gfi-text-muted); }
        .mir-chat-send { padding: 10px 16px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-md); color: #fff; font-size: 16px; cursor: pointer; transition: var(--gfi-transition); flex-shrink: 0; box-shadow: var(--gfi-shadow-red); }
        .mir-chat-send:hover { box-shadow: var(--gfi-shadow-red-lg); }
        .mir-chat-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
        .mir-chat-vacio { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: var(--gfi-text-dim); }
        .mir-interes-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; }
        .mir-interes-modal { background: var(--gfi-bg-card); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-lg); padding: 28px 32px; width: 100%; max-width: 420px; position: relative; box-shadow: var(--gfi-shadow-red-lg); }
        .mir-interes-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--gfi-red), transparent); border-radius: var(--gfi-radius-lg) var(--gfi-radius-lg) 0 0; }
        .filtro-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 300; display: flex; justify-content: flex-end; }
        .filtro-panel { width: 420px; max-width: 100vw; background: var(--gfi-bg-card); border-left: 1px solid var(--gfi-border); height: 100vh; overflow-y: auto; display: flex; flex-direction: column; animation: slideIn 0.25s ease; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .filtro-panel::-webkit-scrollbar { width: 4px; }
        .filtro-panel::-webkit-scrollbar-thumb { background: var(--gfi-border); }
        .filtro-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--gfi-border-subtle); position: sticky; top: 0; background: var(--gfi-bg-card); z-index: 10; }
        .filtro-title { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--gfi-text-primary); }
        .filtro-close { background: none; border: none; color: var(--gfi-text-muted); font-size: 20px; cursor: pointer; padding: 4px; line-height: 1; transition: color var(--gfi-transition-fast); }
        .filtro-close:hover { color: var(--gfi-text-primary); }
        .filtro-body { flex: 1; padding: 20px 22px; display: flex; flex-direction: column; gap: 22px; }
        .filtro-section-title { font-family: var(--font-display); font-size: 9px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 12px; }
        .filtro-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .filtro-chip { padding: 7px 14px; border-radius: var(--gfi-radius-sm); border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-secondary); font-size: 11px; cursor: pointer; transition: var(--gfi-transition); font-family: var(--font-body); }
        .filtro-chip:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .filtro-chip.activo { border-color: var(--gfi-red-border); background: var(--gfi-red-soft); color: var(--gfi-text-primary); }
        .filtro-localidades { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-height: 220px; overflow-y: auto; }
        .filtro-localidades::-webkit-scrollbar { width: 3px; }
        .filtro-localidades::-webkit-scrollbar-thumb { background: var(--gfi-border); }
        .filtro-check { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 0; }
        .filtro-check input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--gfi-red); cursor: pointer; }
        .filtro-check-label { font-size: 12px; color: var(--gfi-text-secondary); cursor: pointer; transition: color var(--gfi-transition-fast); }
        .filtro-check:hover .filtro-check-label { color: var(--gfi-text-primary); }
        .filtro-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .filtro-input { width: 100%; padding: 9px 12px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); }
        .filtro-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-glow); }
        .filtro-input::placeholder { color: var(--gfi-text-muted); }
        .filtro-toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .filtro-footer { padding: 16px 22px; border-top: 1px solid var(--gfi-border-subtle); display: flex; gap: 10px; position: sticky; bottom: 0; background: var(--gfi-bg-card); }
        .filtro-btn-limpiar { flex: 1; padding: 11px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .filtro-btn-limpiar:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .filtro-btn-aplicar { flex: 2; padding: 11px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-sm); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: var(--gfi-shadow-red); transition: var(--gfi-transition); }
        .filtro-btn-aplicar:hover { box-shadow: var(--gfi-shadow-red-lg); }
        .fn-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: flex-start; justify-content: center; z-index: 200; padding: 24px; overflow-y: auto; }
        .fn-modal { background: var(--gfi-bg-card); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-lg); padding: 28px 32px; width: 100%; max-width: 580px; position: relative; margin: auto; box-shadow: var(--gfi-shadow-red-lg); }
        .fn-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--gfi-red), transparent); border-radius: var(--gfi-radius-lg) var(--gfi-radius-lg) 0 0; }
        .fn-modal h2 { font-family: var(--font-display); font-size: 16px; font-weight: 800; margin-bottom: 20px; color: var(--gfi-text-primary); }
        .fn-modal h2 span { color: var(--gfi-red); }
        .fn-field { margin-bottom: 12px; }
        .fn-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 5px; font-family: var(--font-display); }
        .fn-input { width: 100%; padding: 9px 12px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-primary); font-size: 13px; outline: none; transition: var(--gfi-transition); font-family: var(--font-body); }
        .fn-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-glow); }
        .fn-input::placeholder { color: var(--gfi-text-muted); }
        .fn-select { width: 100%; padding: 9px 12px; background: var(--gfi-bg-secondary); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); }
        .fn-select:focus { border-color: var(--gfi-red); }
        .fn-textarea { width: 100%; padding: 9px 12px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-primary); font-size: 13px; outline: none; resize: vertical; min-height: 70px; font-family: var(--font-body); transition: var(--gfi-transition); }
        .fn-textarea:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-glow); }
        .fn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .fn-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .fn-chips { display: flex; gap: 7px; flex-wrap: wrap; }
        .fn-chip { padding: 6px 13px; border-radius: var(--gfi-radius-sm); border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-muted); font-family: var(--font-display); font-size: 10px; font-weight: 700; cursor: pointer; transition: var(--gfi-transition); white-space: nowrap; }
        .fn-chip.activo { border-color: var(--gfi-red-border); background: var(--gfi-red-soft); color: var(--gfi-text-primary); }
        .fn-chip:hover:not(.activo) { border-color: var(--gfi-border-bright); color: var(--gfi-text-secondary); }
        .fn-divider { height: 1px; background: var(--gfi-border-subtle); margin: 14px 0; }
        .fn-toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fn-modal-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
        .fn-btn-cancelar { padding: 10px 20px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .fn-btn-cancelar:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .fn-btn-guardar { padding: 10px 24px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-sm); color: #fff; font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: var(--gfi-shadow-red); transition: var(--gfi-transition); }
        .fn-btn-guardar:hover { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }
        .fn-btn-guardar:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
        .fn-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--gfi-text-muted); border-top-color: #fff; border-radius: 50%; animation: gfi-spin 0.7s linear infinite; margin-right: 6px; vertical-align: middle; }
        .fn-sup-tipos { display: flex; gap: 6px; margin-top: 6px; }
        .fn-sup-tipo { padding: 4px 10px; border-radius: 20px; border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-muted); font-size: 10px; cursor: pointer; transition: var(--gfi-transition); font-family: var(--font-body); }
        .fn-sup-tipo.activo { border-color: var(--gfi-red-border); background: var(--gfi-red-soft); color: var(--gfi-text-primary); }
        @media (max-width: 700px) {
          .mir-grid { grid-template-columns: 1fr; }
          .fn-row3 { grid-template-columns: 1fr 1fr; }
          .filtro-panel { width: 100vw; }
          .mir-chats-layout { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* TABS */}
      <div className="mir-tabs">
        <button className={`mir-tab${vista === "ofrecidos" ? " activo" : ""}`} onClick={() => setVista("ofrecidos")}>
          Ofrecidos {ofrecidos.length > 0 && <span className="mir-tab-badge">{ofrecidos.length}</span>}
        </button>
        <button className={`mir-tab${vista === "busquedas" ? " activo" : ""}`} onClick={() => setVista("busquedas")}>
          Busquedas {busquedas.length > 0 && <span className="mir-tab-badge">{busquedas.length}</span>}
        </button>
        <button className={`mir-tab${vista === "matches" ? " activo" : ""}`} onClick={() => setVista("matches")}>
          Matches {matchesPropios.length > 0 && <span className="mir-tab-badge verde">{matchesPropios.length}</span>}
        </button>
        <button className={`mir-tab${vista === "chats" ? " activo" : ""}`} onClick={() => { setVista("chats"); if (userId) cargarChats(userId); }}>
          Chats {totalNoLeidos > 0 && <span className="mir-tab-badge">{totalNoLeidos}</span>}
        </button>
      </div>

      {/* BARRA */}
      {vista !== "matches" && vista !== "chats" && (
        <div className="mir-barra">
          <div className="mir-barra-left">
            <button className={`mir-btn-filtrar${cantFiltrosActivos > 0 ? " activo" : ""}`} onClick={() => { setFiltroTemp({...filtro}); setMostrarFiltros(true); }}>
              Filtrar {cantFiltrosActivos > 0 && <span className="mir-filtro-badge">{cantFiltrosActivos}</span>}
            </button>
            {cantFiltrosActivos > 0 && (
              <button style={{background:"none",border:"none",color:"rgba(200,0,0,0.7)",fontSize:11,cursor:"pointer",fontFamily:"var(--font-display)",fontWeight:700}} onClick={() => setFiltro(FILTRO_VACIO)}>
                Limpiar filtros
              </button>
            )}
          </div>
          <button className="mir-btn-pub" onClick={() => vista === "ofrecidos" ? setMostrarFormO(true) : setMostrarFormB(true)}>
            {vista === "ofrecidos" ? "+ Publicar ofrecido" : "+ Publicar busqueda"}
          </button>
        </div>
      )}

      {/* OFRECIDOS */}
      {vista === "ofrecidos" && (
        loading ? <div className="mir-empty">Cargando...</div> :
        ofsFilt.length === 0 ? <div className="mir-empty">No hay ofrecidos{cantFiltrosActivos > 0 ? " con esos filtros" : " publicados todavia"}.</div> :
        <div className="mir-grid">
          {ofsFilt.map(o => {
            const color = OP_COLOR[o.operacion] ?? "#fff";
            const extras = [o.apto_credito && "Apto credito", o.uso_comercial && "Uso comercial", o.barrio_cerrado && "B. cerrado", o.con_cochera && "Cochera", o.acepta_mascotas && "Mascotas", o.acepta_bitcoin && "Bitcoin"].filter(Boolean) as string[];
            const esPropia = o.perfil_id === userId;
            const esUrgente = o.urgente && (!o.urgente_expires_at || new Date(o.urgente_expires_at) > new Date());
            return (
              <div key={o.id} className={`mir-card${esPropia ? " propia" : ""}${esUrgente ? " urgente-card" : ""}`}>
                {esUrgente && <div className="mir-urgente-badge">⚡ URGENTE</div>}
                <div className="mir-card-top">
                  <div className="mir-card-titulo">{etiquetaTipoPropiedad(o.tipo_propiedad)}</div>
                  <span className="mir-op-badge" style={{background:`${color}20`,border:`1px solid ${color}50`,color}}>{OP_LABEL[o.operacion]}</span>
                </div>
                {o.precio && <div className="mir-precio">{formatPeso(o.precio, o.moneda)}</div>}
                <div className="mir-zona">📍 {[o.zona, o.ciudad].filter(Boolean).join(" · ")}</div>
                <div className="mir-detalles">
                  {o.dormitorios ? <span className="mir-det">🛏 {o.dormitorios} dorm.</span> : null}
                  {o.banos ? <span className="mir-det">🚿 {o.banos} baños</span> : null}
                  {o.superficie_cubierta ? <span className="mir-det">📐 {o.superficie_cubierta}m² cub.</span> : null}
                  {o.superficie_total ? <span className="mir-det">📏 {o.superficie_total}m² tot.</span> : null}
                  {o.antiguedad && <span className="mir-det">🏗 {o.antiguedad.replace(/_/g," ")}</span>}
                </div>
                {extras.length > 0 && <div className="mir-extras">{extras.map((e,i) => <span key={i} className="mir-extra">{e}</span>)}</div>}
                {o.descripcion && <div className="mir-desc">{o.descripcion}</div>}
                {!esPropia && <BotonesInteres pub={o} pubTipo="ofrecido" />}
                <div className="mir-card-footer">
                  <div>
                    {esPropia ? (
                      <span className="mir-corredor">📌 Tu publicacion</span>
                    ) : o.nombre_publicante ? (
                      <span className="mir-corredor">
                        👤 <b>{o.nombre_publicante}</b>
                        {o.ci_responsable ? (
                          <> · C.I. responsable: <b>{o.ci_responsable.apellido}, {o.ci_responsable.nombre}</b> · Mat. {o.ci_responsable.matricula ?? "—"}</>
                        ) : null}
                      </span>
                    ) : (
                      <span className="mir-corredor">C.I. <b>{o.perfiles?.apellido}, {o.perfiles?.nombre}</b> · Mat. {o.perfiles?.matricula ?? "—"}</span>
                    )}
                    <div className="mir-fecha">{formatFecha(o.created_at)}</div>
                  </div>
                  {esPropia && (
                    <div style={{display:"flex",gap:6}}>
                      <button className="mir-btn-editar" onClick={() => editarOfrecido(o)}>Editar</button>
                      <button className="mir-btn-baja" onClick={() => desactivar("mir_ofrecidos", o.id)}>Dar de baja</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BUSQUEDAS */}
      {vista === "busquedas" && (
        loading ? <div className="mir-empty">Cargando...</div> :
        busFilt.length === 0 ? <div className="mir-empty">No hay busquedas{cantFiltrosActivos > 0 ? " con esos filtros" : " publicadas todavia"}.</div> :
        <div className="mir-grid">
          {busFilt.map(b => {
            const color = OP_COLOR[b.operacion] ?? "#fff";
            const extras = [b.apto_credito && "Apto credito", b.uso_comercial && "Uso comercial", b.con_cochera && "Con cochera", b.barrio_cerrado && "B. cerrado", b.acepta_mascotas && "Mascotas", b.acepta_bitcoin && "Bitcoin"].filter(Boolean) as string[];
            const esPropia = b.perfil_id === userId;
            const esUrgente = b.urgente && (!b.urgente_expires_at || new Date(b.urgente_expires_at) > new Date());
            return (
              <div key={b.id} className={`mir-card${esPropia ? " propia" : ""}${esUrgente ? " urgente-card" : ""}`}>
                {esUrgente && <div className="mir-urgente-badge">⚡ URGENTE</div>}
                <div className="mir-card-top">
                  <div className="mir-card-titulo">{etiquetaTipoPropiedad(b.tipo_propiedad)}</div>
                  <span className="mir-op-badge" style={{background:`${color}20`,border:`1px solid ${color}50`,color}}>{OP_LABEL[b.operacion]}</span>
                </div>
                {(b.presupuesto_min || b.presupuesto_max) && (
                  <div className="mir-precio">
                    {b.presupuesto_min && b.presupuesto_max ? `${formatPeso(b.presupuesto_min, b.moneda)} - ${formatPeso(b.presupuesto_max, b.moneda)}` :
                     b.presupuesto_max ? `Hasta ${formatPeso(b.presupuesto_max, b.moneda)}` :
                     `Desde ${formatPeso(b.presupuesto_min!, b.moneda)}`}
                  </div>
                )}
                <div className="mir-zona">📍 {[b.zona, b.ciudad].filter(Boolean).join(" · ")}</div>
                <div className="mir-detalles">
                  {b.dormitorios_min ? <span className="mir-det">🛏 {b.dormitorios_min}{b.dormitorios_max ? `-${b.dormitorios_max}` : "+"} dorm.</span> : null}
                  {b.banos_min ? <span className="mir-det">🚿 {b.banos_min}+ baños</span> : null}
                  {b.superficie_min ? <span className="mir-det">📐 {b.superficie_min}{b.superficie_max ? `-${b.superficie_max}` : "+"}m²</span> : null}
                  {b.antiguedad && <span className="mir-det">🏗 {b.antiguedad.replace(/_/g," ")}</span>}
                </div>
                {extras.length > 0 && <div className="mir-extras">{extras.map((e,i) => <span key={i} className="mir-extra">{e}</span>)}</div>}
                {b.descripcion && <div className="mir-desc">{b.descripcion}</div>}
                {!esPropia && <BotonesInteres pub={b} pubTipo="busqueda" />}
                <div className="mir-card-footer">
                  <div>
                    {esPropia ? (
                      <span className="mir-corredor">📌 Tu publicacion</span>
                    ) : b.nombre_publicante ? (
                      <span className="mir-corredor">
                        👤 <b>{b.nombre_publicante}</b>
                        {b.ci_responsable ? (
                          <> · C.I. responsable: <b>{b.ci_responsable.apellido}, {b.ci_responsable.nombre}</b> · Mat. {b.ci_responsable.matricula ?? "—"}</>
                        ) : null}
                      </span>
                    ) : (
                      <span className="mir-corredor">C.I. <b>{b.perfiles?.apellido}, {b.perfiles?.nombre}</b> · Mat. {b.perfiles?.matricula ?? "—"}</span>
                    )}
                    <div className="mir-fecha">{formatFecha(b.created_at)}</div>
                  </div>
                  {esPropia && <button className="mir-btn-baja" onClick={() => desactivar("mir_busquedas", b.id)}>Dar de baja</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MATCHES */}
      {vista === "matches" && (
        <>
          {loading ? <div className="mir-empty">Cargando...</div> :
           matchesPropios.length === 0 ? <div className="mir-empty">No tenes matches todavia.</div> :
           <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {matchesPropios.map(m => {
              const of = ofrecidos.find(o => o.id === m.ofrecido_id);
              const bu = busquedas.find(b => b.id === m.busqueda_id);
              const esDuenioOf = of?.perfil_id === userId;
              const otroId = esDuenioOf ? bu?.perfil_id : of?.perfil_id;
              return (
                <div key={m.id} className="mir-match-card">
                  <div className="mir-match-lados">
                    <div className="mir-match-lado">
                      <div className="mir-match-lado-titulo">Ofrecido</div>
                      <div className="mir-match-info">{etiquetaTipoPropiedad(of?.tipo_propiedad)} · {of?.ciudad}</div>
                      <div className="mir-match-sub">{OP_LABEL[of?.operacion ?? ""]}{of?.precio ? ` · ${formatPeso(of.precio, of.moneda)}` : ""}</div>
                      {esDuenioOf && <div className="mir-match-sub" style={{color:"#990000",marginTop:4}}>Es tuyo</div>}
                    </div>
                    <div className="mir-match-sep"/>
                    <div className="mir-match-lado">
                      <div className="mir-match-lado-titulo">Busqueda</div>
                      <div className="mir-match-info">{etiquetaTipoPropiedad(bu?.tipo_propiedad)} · {bu?.ciudad}</div>
                      <div className="mir-match-sub">{OP_LABEL[bu?.operacion ?? ""]}{bu?.presupuesto_max ? ` · hasta ${formatPeso(bu.presupuesto_max, bu.moneda)}` : ""}</div>
                      {!esDuenioOf && <div className="mir-match-sub" style={{color:"#990000",marginTop:4}}>Es tuya</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                    <div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:6,padding:"10px 14px",minWidth:160}}>
                      <div style={{fontSize:9,fontFamily:"var(--font-display)",fontWeight:700,letterSpacing:"0.1em",color:"#3abab6",marginBottom:6}}>CONTACTO</div>
                      <div style={{fontSize:12,color:"#fff",fontWeight:600}}>{esDuenioOf ? bu?.perfiles?.nombre : of?.perfiles?.nombre} {esDuenioOf ? bu?.perfiles?.apellido : of?.perfiles?.apellido}</div>
                      {(esDuenioOf ? bu?.perfiles?.telefono : of?.perfiles?.telefono) && <div style={{fontSize:11,color:"var(--gfi-text-secondary)",marginTop:3}}>📱 {esDuenioOf ? bu?.perfiles?.telefono : of?.perfiles?.telefono}</div>}
                      {(esDuenioOf ? bu?.perfiles?.email : of?.perfiles?.email) && <div style={{fontSize:11,color:"var(--gfi-text-secondary)"}}>✉️ {esDuenioOf ? bu?.perfiles?.email : of?.perfiles?.email}</div>}
                      {otroId && (
                        <button onClick={() => abrirChat(m.ofrecido_id, "ofrecido", otroId)}
                          style={{marginTop:8,padding:"5px 12px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:4,color:"#3abab6",fontSize:10,fontFamily:"var(--font-display)",fontWeight:700,cursor:"pointer",width:"100%"}}>
                          Abrir chat
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>}
        </>
      )}

      {/* CHATS */}
      {vista === "chats" && (
        <div className="mir-chats-layout">
          <div className="mir-chats-lista">
            {chats.length === 0 ? (
              <div style={{padding:32,textAlign:"center",color:"var(--gfi-text-dim)",fontSize:13,fontStyle:"italic"}}>
                No tenes chats todavia.<br/>
                <span style={{fontSize:11}}>Toca "Me interesa" o "Tengo" en una publicacion para iniciar.</span>
              </div>
            ) : chats.map(c => {
              const ini = `${c.perfil_otro?.nombre?.charAt(0) ?? ""}${c.perfil_otro?.apellido?.charAt(0) ?? ""}`.toUpperCase();
              return (
                <div key={c.id} className={`mir-chat-item${chatActivo?.id === c.id ? " activo" : ""}`} onClick={() => setChatActivo(c)}>
                  <div className="mir-chat-avatar">
                    {c.perfil_otro?.foto_url ? <img src={c.perfil_otro.foto_url} alt="" /> : ini}
                  </div>
                  <div className="mir-chat-info">
                    <div className="mir-chat-nombre">{c.perfil_otro?.apellido}, {c.perfil_otro?.nombre}</div>
                    <div className="mir-chat-pub">{c.publicacion_titulo}</div>
                  </div>
                  {(c.no_leidos ?? 0) > 0 && <span className="mir-chat-badge">{c.no_leidos}</span>}
                </div>
              );
            })}
          </div>

          <div className="mir-chat-ventana">
            {!chatActivo ? (
              <div className="mir-chat-vacio">
                <span style={{fontSize:40}}>💬</span>
                <span style={{fontSize:13}}>Selecciona un chat para ver los mensajes</span>
              </div>
            ) : (
              <>
                <div className="mir-chat-header">
                  <div className="mir-chat-avatar" style={{width:36,height:36}}>
                    {(chatActivo as any).perfil_otro?.foto_url
                      ? <img src={(chatActivo as any).perfil_otro.foto_url} alt="" />
                      : `${(chatActivo as any).perfil_otro?.nombre?.charAt(0) ?? ""}${(chatActivo as any).perfil_otro?.apellido?.charAt(0) ?? ""}`.toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>
                      {(chatActivo as any).perfil_otro?.apellido}, {(chatActivo as any).perfil_otro?.nombre}
                    </div>
                    <div style={{fontSize:10,color:"var(--gfi-text-muted)"}}>
                      {(chatActivo as any).publicacion_titulo}
                    </div>
                  </div>
                </div>
                <div className="mir-chat-mensajes">
                  {mensajes.length === 0 && (
                    <div style={{textAlign:"center",color:"var(--gfi-text-dim)",fontSize:12,fontStyle:"italic",padding:"20px 0"}}>
                      Empeza la conversacion
                    </div>
                  )}
                  {mensajes.map(msg => {
                    const esMio = msg.autor_id === userId;
                    return (
                      <div key={msg.id} className={`mir-msg ${esMio ? "mio" : "otro"}`}>
                        <div className="mir-msg-burbuja">{msg.texto}</div>
                        <div className="mir-msg-meta">
                          {!esMio && `${msg.autor?.nombre ?? ""} · `}{formatHora(msg.created_at)}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={mensajesEndRef} />
                </div>
                <div className="mir-chat-input">
                  <textarea
                    className="mir-chat-textarea"
                    placeholder="Escribi un mensaje..."
                    value={textoMensaje}
                    onChange={e => setTextoMensaje(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }}}
                    rows={1}
                  />
                  <button className="mir-chat-send" onClick={enviarMensaje} disabled={!textoMensaje.trim() || enviandoMsg}>
                    ➤
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PANEL FILTROS */}
      {mostrarFiltros && (
        <div className="filtro-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFiltros(false); }}>
          <div className="filtro-panel">
            <div className="filtro-header">
              <span className="filtro-title">Filtrar {vista}</span>
              <button className="filtro-close" onClick={() => setMostrarFiltros(false)}>x</button>
            </div>
            <div className="filtro-body">
              <div>
                <div className="filtro-section-title">Operacion</div>
                <div className="filtro-chips">
                  {(vista === "ofrecidos" ? OPS_OFRECIDO : OPS_BUSQUEDA).map(op => (
                    <button key={op.value} className={`filtro-chip${filtroTemp.operaciones.includes(op.value) ? " activo" : ""}`} onClick={() => toggleFiltroItem("operaciones", op.value)}>{op.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="filtro-section-title">Ubicacion</div>
                <div className="filtro-localidades">
                  {LOCALIDADES.map(loc => (
                    <label key={loc} className="filtro-check">
                      <input type="checkbox" checked={filtroTemp.localidades.includes(loc)} onChange={() => toggleFiltroItem("localidades", loc)} />
                      <span className="filtro-check-label">{loc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="filtro-section-title">Tipo de propiedad</div>
                <div className="filtro-localidades">
                  {TIPOS_PROPIEDAD.map(t => (
                    <label key={t} className="filtro-check">
                      <input type="checkbox" checked={filtroTemp.tipos.includes(t)} onChange={() => toggleFiltroItem("tipos", t)} />
                      <span className="filtro-check-label">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="filtro-section-title">Superficie (m2)</div>
                <div className="filtro-row">
                  <input className="filtro-input" type="number" placeholder="Minimo" value={filtroTemp.sup_min} onChange={e => setFiltroTemp(f => ({...f, sup_min: e.target.value}))} />
                  <input className="filtro-input" type="number" placeholder="Maximo" value={filtroTemp.sup_max} onChange={e => setFiltroTemp(f => ({...f, sup_max: e.target.value}))} />
                </div>
              </div>
              <div>
                <div className="filtro-section-title">Filtros adicionales</div>
                <div className="filtro-toggles">
                  <Toggle label="Apto credito" value={filtroTemp.apto_credito} onChange={v => setFiltroTemp(f => ({...f, apto_credito: v}))} />
                  <Toggle label="Con cochera" value={filtroTemp.con_cochera} onChange={v => setFiltroTemp(f => ({...f, con_cochera: v}))} />
                  <Toggle label="Uso comercial" value={filtroTemp.uso_comercial} onChange={v => setFiltroTemp(f => ({...f, uso_comercial: v}))} />
                  <Toggle label="Barrio cerrado" value={filtroTemp.barrio_cerrado} onChange={v => setFiltroTemp(f => ({...f, barrio_cerrado: v}))} />
                  <Toggle label="Acepta mascotas" value={filtroTemp.acepta_mascotas} onChange={v => setFiltroTemp(f => ({...f, acepta_mascotas: v}))} />
                  <Toggle label="Acepta Bitcoin" value={filtroTemp.acepta_bitcoin} onChange={v => setFiltroTemp(f => ({...f, acepta_bitcoin: v}))} />
                </div>
              </div>
            </div>
            <div className="filtro-footer">
              <button className="filtro-btn-limpiar" onClick={() => setFiltroTemp(FILTRO_VACIO)}>Limpiar todo</button>
              <button className="filtro-btn-aplicar" onClick={() => { setFiltro(filtroTemp); setMostrarFiltros(false); }}>Ver resultados</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ME INTERESA / TENGO */}
      {modalInteres && (
        <div className="mir-interes-bg" onClick={e => { if (e.target === e.currentTarget) setModalInteres(null); }}>
          <div className="mir-interes-modal">
            <div style={{fontFamily:"var(--font-display)",fontSize:15,fontWeight:800,color:"#fff",marginBottom:6}}>
              {modalInteres.tipo === "me_interesa" ? "Me interesa" : "Tengo"} <span style={{color:"#990000"}}>esta publicacion</span>
            </div>
            <div style={{fontSize:12,color:"var(--gfi-text-muted)",marginBottom:16}}>
              {etiquetaTipoPropiedad(modalInteres.pub.tipo_propiedad)} · {modalInteres.pub.ciudad}
              {(modalInteres.pub as Ofrecido).precio ? ` · ${formatPeso((modalInteres.pub as Ofrecido).precio!, modalInteres.pub.moneda)}` : ""}
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:10,fontFamily:"var(--font-display)",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--gfi-text-muted)",marginBottom:6}}>
                Mensaje inicial (opcional)
              </label>
              <textarea
                style={{width:"100%",padding:"10px 13px",background:"var(--gfi-border-subtle)",border:"1px solid var(--gfi-border)",borderRadius:4,color:"#fff",fontSize:13,outline:"none",fontFamily:"var(--font-body)",resize:"vertical",minHeight:80}}
                placeholder={modalInteres.tipo === "me_interesa" ? "Hola, me interesa tu ofrecido. Puedo agendar visita..." : "Hola, tengo una propiedad que puede coincidir con tu busqueda..."}
                value={msgInteres}
                onChange={e => setMsgInteres(e.target.value)}
              />
            </div>
            <div style={{fontSize:11,color:"var(--gfi-text-dim)",marginBottom:16,background:"rgba(200,0,0,0.04)",border:"1px solid rgba(200,0,0,0.1)",borderRadius:4,padding:"8px 12px"}}>
              Se abrira un chat directo con el corredor titular de la publicacion.
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="fn-btn-cancelar" onClick={() => { setModalInteres(null); setMsgInteres(""); }}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={enviarInteres} disabled={!!interesando}>
                {interesando ? "Enviando..." : modalInteres.tipo === "me_interesa" ? "Me interesa — Abrir chat" : "Tengo — Abrir chat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OFRECIDO */}
      {mostrarFormO && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) { setMostrarFormO(false); setFormO(FORM_O); setEditandoOfrecido(null); } }}>
          <div className="fn-modal">
            <h2>{editandoOfrecido ? "Editar" : "Publicar"} <span>ofrecido</span></h2>
            <div className="fn-field">
              <label className="fn-label">Operacion *</label>
              {esColaborador && (
                <div style={{background:"rgba(200,0,0,0.05)",border:"1px solid rgba(200,0,0,0.15)",borderRadius:6,padding:"12px 14px",marginBottom:12}}>
                  <div style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(200,0,0,0.7)",marginBottom:10}}>⚠️ Publicación como colaborador — datos obligatorios</div>
                  <div style={{marginBottom:10}}>
                    <label style={{display:"block",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--gfi-text-muted)",marginBottom:5}}>Tu nombre completo *</label>
                    <input
                      style={{width:"100%",padding:"8px 11px",background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:3,color:"#fff",fontSize:13,outline:"none",fontFamily:"Inter,sans-serif",boxSizing:"border-box"}}
                      placeholder="Ej: María García"
                      value={formO.nombre_publicante}
                      onChange={e => setFormO(p => ({...p, nombre_publicante: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--gfi-text-muted)",marginBottom:5}}>C.I. responsable (matriculado) *</label>
                    <select
                      style={{width:"100%",padding:"8px 11px",background:"rgba(12,12,12,0.95)",border:`1px solid ${!formO.ci_responsable_id?"rgba(200,0,0,0.3)":"rgba(255,255,255,0.09)"}`,borderRadius:3,color:"#fff",fontSize:13,outline:"none",fontFamily:"Inter,sans-serif"}}
                      value={formO.ci_responsable_id}
                      onChange={e => setFormO(p => ({...p, ci_responsable_id: e.target.value}))}
                    >
                      <option value="">Seleccioná el C.I. responsable...</option>
                      {corredoresColegas.map(c => (
                        <option key={c.id} value={c.id}>{c.apellido}, {c.nombre} — Mat. {c.matricula}</option>
                      ))}
                    </select>
                    <div style={{fontSize:10,color:"var(--gfi-text-dim)",marginTop:4,fontFamily:"Inter,sans-serif"}}>El corredor inmobiliario matriculado que avala esta publicación. Obligatorio por normativa COCIR.</div>
                  </div>
                </div>
              )}
              <div className="fn-chips">{OPS_OFRECIDO.map(op => <button key={op.value} type="button" className={`fn-chip${formO.operacion === op.value ? " activo" : ""}`} onClick={() => setFormO(p => ({...p, operacion: op.value}))}>{op.label}</button>)}</div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Tipo de propiedad *</label>
              <select className="fn-select" value={formO.tipo_propiedad} onChange={e => setFormO(p => ({...p, tipo_propiedad: e.target.value}))}>
                {TIPOS_PROPIEDAD.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Localidad *</label>
                <select className="fn-select" value={formO.ciudad} onChange={e => setFormO(p => ({...p, ciudad: e.target.value}))}>{LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}</select>
              </div>
              <div className="fn-field">
                <label className="fn-label">Zona / Barrio</label>
                <input className="fn-input" placeholder="Ej: Fisherton" value={formO.zona} onChange={e => setFormO(p => ({...p, zona: e.target.value}))} />
              </div>
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Precio</label>
                <input className="fn-input" type="number" placeholder="150000" value={formO.precio} onChange={e => setFormO(p => ({...p, precio: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Moneda</label>
                <div className="fn-chips">
                  <button type="button" className={`fn-chip${formO.moneda === "USD" ? " activo" : ""}`} onClick={() => setFormO(p => ({...p, moneda: "USD"}))}>USD</button>
                  <button type="button" className={`fn-chip${formO.moneda === "ARS" ? " activo" : ""}`} onClick={() => setFormO(p => ({...p, moneda: "ARS"}))}>ARS</button>
                </div>
              </div>
            </div>
            <div className="fn-row3">
              <div className="fn-field"><label className="fn-label">Dormitorios</label><input className="fn-input" type="number" placeholder="2" value={formO.dormitorios} onChange={e => setFormO(p => ({...p, dormitorios: e.target.value}))} /></div>
              <div className="fn-field"><label className="fn-label">Baños</label><input className="fn-input" type="number" placeholder="1" value={formO.banos} onChange={e => setFormO(p => ({...p, banos: e.target.value}))} /></div>
              <div className="fn-field"><label className="fn-label">Antiguedad</label><select className="fn-select" value={formO.antiguedad} onChange={e => setFormO(p => ({...p, antiguedad: e.target.value}))}>{ANTIGUEDADES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
            </div>
            <div className="fn-row">
              <div className="fn-field"><label className="fn-label">Sup. total m2</label><input className="fn-input" type="number" placeholder="80" value={formO.superficie_total} onChange={e => setFormO(p => ({...p, superficie_total: e.target.value}))} /></div>
              <div className="fn-field"><label className="fn-label">Sup. cubierta m2</label><input className="fn-input" type="number" placeholder="60" value={formO.superficie_cubierta} onChange={e => setFormO(p => ({...p, superficie_cubierta: e.target.value}))} /></div>
            </div>
            <div className="fn-divider"/>
            <div className="fn-field">
              <label className="fn-label">Caracteristicas</label>
              <div className="fn-toggles">
                <Toggle label="Apto credito" value={formO.apto_credito} onChange={v => setFormO(p => ({...p, apto_credito: v}))} />
                <Toggle label="Con cochera" value={formO.con_cochera} onChange={v => setFormO(p => ({...p, con_cochera: v}))} />
                <Toggle label="Uso comercial" value={formO.uso_comercial} onChange={v => setFormO(p => ({...p, uso_comercial: v}))} />
                <Toggle label="Barrio cerrado" value={formO.barrio_cerrado} onChange={v => setFormO(p => ({...p, barrio_cerrado: v}))} />
                <Toggle label="Acepta mascotas" value={formO.acepta_mascotas} onChange={v => setFormO(p => ({...p, acepta_mascotas: v}))} />
                <Toggle label="Acepta Bitcoin" value={formO.acepta_bitcoin} onChange={v => setFormO(p => ({...p, acepta_bitcoin: v}))} />
              </div>
            </div>
            <div className="fn-field"><label className="fn-label">Descripcion</label><textarea className="fn-textarea" placeholder="Detalles adicionales..." value={formO.descripcion} onChange={e => setFormO(p => ({...p, descripcion: e.target.value}))} /></div>
            <div className="fn-divider"/>
            <div style={{background:"rgba(234,179,8,0.06)",border:"1px solid rgba(234,179,8,0.2)",borderRadius:6,padding:"14px 16px"}}>
              <Toggle label="⚡ PEDIDO URGENTE — aparece destacado 48hs (función premium)" value={formO.urgente} onChange={v => setFormO(p => ({...p, urgente: v}))} />
              {formO.urgente && <div style={{fontSize:10,color:"rgba(234,179,8,0.7)",marginTop:8,fontFamily:"Inter,sans-serif"}}>Tu publicación se destacará con badge dorado y aparecerá primero en la lista durante 48 horas.</div>}
            </div>
            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => { setMostrarFormO(false); setFormO(FORM_O); setEditandoOfrecido(null); }}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={guardarOfrecido} disabled={guardando || !formO.ciudad}>
                {guardando && <span className="fn-spinner"/>}
                {guardando ? (editandoOfrecido ? "Guardando..." : "Publicando...") : (editandoOfrecido ? "Guardar cambios" : "Publicar ofrecido")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUSQUEDA */}
      {mostrarFormB && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormB(false); }}>
          <div className="fn-modal">
            <h2>Publicar <span>busqueda</span></h2>
            <div className="fn-field">
              <label className="fn-label">Operacion *</label>
              {esColaborador && (
                <div style={{background:"rgba(200,0,0,0.05)",border:"1px solid rgba(200,0,0,0.15)",borderRadius:6,padding:"12px 14px",marginBottom:12}}>
                  <div style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(200,0,0,0.7)",marginBottom:10}}>⚠️ Publicación como colaborador — datos obligatorios</div>
                  <div style={{marginBottom:10}}>
                    <label style={{display:"block",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--gfi-text-muted)",marginBottom:5}}>Tu nombre completo *</label>
                    <input
                      style={{width:"100%",padding:"8px 11px",background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:3,color:"#fff",fontSize:13,outline:"none",fontFamily:"Inter,sans-serif",boxSizing:"border-box"}}
                      placeholder="Ej: María García"
                      value={formB.nombre_publicante}
                      onChange={e => setFormB(p => ({...p, nombre_publicante: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--gfi-text-muted)",marginBottom:5}}>C.I. responsable (matriculado) *</label>
                    <select
                      style={{width:"100%",padding:"8px 11px",background:"rgba(12,12,12,0.95)",border:`1px solid ${!formB.ci_responsable_id?"rgba(200,0,0,0.3)":"rgba(255,255,255,0.09)"}`,borderRadius:3,color:"#fff",fontSize:13,outline:"none",fontFamily:"Inter,sans-serif"}}
                      value={formB.ci_responsable_id}
                      onChange={e => setFormB(p => ({...p, ci_responsable_id: e.target.value}))}
                    >
                      <option value="">Seleccioná el C.I. responsable...</option>
                      {corredoresColegas.map(c => (
                        <option key={c.id} value={c.id}>{c.apellido}, {c.nombre} — Mat. {c.matricula}</option>
                      ))}
                    </select>
                    <div style={{fontSize:10,color:"var(--gfi-text-dim)",marginTop:4,fontFamily:"Inter,sans-serif"}}>El corredor inmobiliario matriculado que avala esta publicación. Obligatorio por normativa COCIR.</div>
                  </div>
                </div>
              )}
              <div className="fn-chips">{OPS_BUSQUEDA.map(op => <button key={op.value} type="button" className={`fn-chip${formB.operacion === op.value ? " activo" : ""}`} onClick={() => setFormB(p => ({...p, operacion: op.value}))}>{op.label}</button>)}</div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Tipo de propiedad *</label>
              <select className="fn-select" value={formB.tipo_propiedad} onChange={e => setFormB(p => ({...p, tipo_propiedad: e.target.value}))}>{TIPOS_PROPIEDAD.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div className="fn-row">
              <div className="fn-field"><label className="fn-label">Localidad *</label><select className="fn-select" value={formB.ciudad} onChange={e => setFormB(p => ({...p, ciudad: e.target.value}))}>{LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
              <div className="fn-field"><label className="fn-label">Zona / Barrio</label><input className="fn-input" placeholder="Ej: Norte, Fisherton..." value={formB.zona} onChange={e => setFormB(p => ({...p, zona: e.target.value}))} /></div>
            </div>
            <div className="fn-row">
              <div className="fn-field"><label className="fn-label">Presupuesto min.</label><input className="fn-input" type="number" placeholder="50000" value={formB.presupuesto_min} onChange={e => setFormB(p => ({...p, presupuesto_min: e.target.value}))} /></div>
              <div className="fn-field"><label className="fn-label">Presupuesto max.</label><input className="fn-input" type="number" placeholder="200000" value={formB.presupuesto_max} onChange={e => setFormB(p => ({...p, presupuesto_max: e.target.value}))} /></div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Moneda</label>
              <div className="fn-chips">
                <button type="button" className={`fn-chip${formB.moneda === "USD" ? " activo" : ""}`} onClick={() => setFormB(p => ({...p, moneda: "USD"}))}>USD</button>
                <button type="button" className={`fn-chip${formB.moneda === "ARS" ? " activo" : ""}`} onClick={() => setFormB(p => ({...p, moneda: "ARS"}))}>ARS</button>
              </div>
            </div>
            <div className="fn-row3">
              <div className="fn-field"><label className="fn-label">Dorm. min.</label><input className="fn-input" type="number" placeholder="2" value={formB.dormitorios_min} onChange={e => setFormB(p => ({...p, dormitorios_min: e.target.value}))} /></div>
              <div className="fn-field"><label className="fn-label">Dorm. max.</label><input className="fn-input" type="number" placeholder="4" value={formB.dormitorios_max} onChange={e => setFormB(p => ({...p, dormitorios_max: e.target.value}))} /></div>
              <div className="fn-field"><label className="fn-label">Baños min.</label><input className="fn-input" type="number" placeholder="1" value={formB.banos_min} onChange={e => setFormB(p => ({...p, banos_min: e.target.value}))} /></div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Superficie m2</label>
              <div className="fn-row">
                <input className="fn-input" type="number" placeholder="Minimo" value={formB.superficie_min} onChange={e => setFormB(p => ({...p, superficie_min: e.target.value}))} />
                <input className="fn-input" type="number" placeholder="Maximo" value={formB.superficie_max} onChange={e => setFormB(p => ({...p, superficie_max: e.target.value}))} />
              </div>
              <div className="fn-sup-tipos">
                {[["total","Total"],["cubierta","Cubierta"],["terreno","Del terreno"]].map(([v,l]) => (
                  <button key={v} type="button" className={`fn-sup-tipo${formB.tipo_superficie === v ? " activo" : ""}`} onClick={() => setFormB(p => ({...p, tipo_superficie: v}))}>{l}</button>
                ))}
              </div>
            </div>
            <div className="fn-field"><label className="fn-label">Antiguedad</label><select className="fn-select" value={formB.antiguedad} onChange={e => setFormB(p => ({...p, antiguedad: e.target.value}))}>{ANTIGUEDADES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
            <div className="fn-divider"/>
            <div className="fn-field">
              <label className="fn-label">Filtros adicionales</label>
              <div className="fn-toggles">
                <Toggle label="Apto credito" value={formB.apto_credito} onChange={v => setFormB(p => ({...p, apto_credito: v}))} />
                <Toggle label="Con cochera" value={formB.con_cochera} onChange={v => setFormB(p => ({...p, con_cochera: v}))} />
                <Toggle label="Uso comercial" value={formB.uso_comercial} onChange={v => setFormB(p => ({...p, uso_comercial: v}))} />
                <Toggle label="Barrio cerrado" value={formB.barrio_cerrado} onChange={v => setFormB(p => ({...p, barrio_cerrado: v}))} />
                <Toggle label="Acepta mascotas" value={formB.acepta_mascotas} onChange={v => setFormB(p => ({...p, acepta_mascotas: v}))} />
                <Toggle label="Acepta Bitcoin" value={formB.acepta_bitcoin} onChange={v => setFormB(p => ({...p, acepta_bitcoin: v}))} />
              </div>
            </div>
            <div className="fn-field"><label className="fn-label">Descripcion</label><textarea className="fn-textarea" placeholder="Requisitos especificos del cliente..." value={formB.descripcion} onChange={e => setFormB(p => ({...p, descripcion: e.target.value}))} /></div>
            <div className="fn-divider"/>
            <div style={{background:"rgba(234,179,8,0.06)",border:"1px solid rgba(234,179,8,0.2)",borderRadius:6,padding:"14px 16px"}}>
              <Toggle label="⚡ PEDIDO URGENTE — aparece destacado 48hs (función premium)" value={formB.urgente} onChange={v => setFormB(p => ({...p, urgente: v}))} />
              {formB.urgente && <div style={{fontSize:10,color:"rgba(234,179,8,0.7)",marginTop:8,fontFamily:"Inter,sans-serif"}}>Tu búsqueda se destacará con badge dorado y aparecerá primero en la lista durante 48 horas.</div>}
            </div>
            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => setMostrarFormB(false)}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={guardarBusqueda} disabled={guardando || !formB.ciudad}>
                {guardando && <span className="fn-spinner"/>}{guardando ? "Publicando..." : "Publicar busqueda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
