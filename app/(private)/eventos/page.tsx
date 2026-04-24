"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  fecha_fin: string | null;
  lugar: string | null;
  lugar_url: string | null;
  link_externo: string | null;
  imagen_url: string | null;
  tipo: string;
  gratuito: boolean;
  precio_entrada: number | null;
  capacidad: number | null;
  plataforma: string | null;
  link_reunion: string | null;
  organizador_id: string | null;
  estado: string;
  destacado: boolean;
  media?: MediaItem[] | null;
  inscripto?: boolean;
  total_inscriptos?: number;
}

const TIPOS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  gfi:      { label: "GFI®",         color: "#cc0000",  bg: "rgba(200,0,0,0.12)",      border: "rgba(200,0,0,0.3)" },
  cocir:    { label: "COCIR",        color: "#f97316",  bg: "rgba(249,115,22,0.1)",    border: "rgba(249,115,22,0.3)" },
  cir:      { label: "CIR",          color: "#818cf8",  bg: "rgba(99,102,241,0.1)",    border: "rgba(99,102,241,0.3)" },
  comercial:{ label: "Comercial",    color: "#eab308",  bg: "rgba(234,179,8,0.1)",     border: "rgba(234,179,8,0.3)" },
  privado:  { label: "Privado",      color: "#94a3b8",  bg: "rgba(148,163,184,0.08)",  border: "rgba(148,163,184,0.2)" },
  externo:  { label: "Externo",      color: "#64748b",  bg: "rgba(100,116,139,0.08)",  border: "rgba(100,116,139,0.2)" },
};

const PLATAFORMAS: Record<string, string> = {
  presencial: "📍", zoom: "🎥", meet: "🎥", youtube: "▶️", teams: "🎥",
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA = ["Lu","Ma","Mi","Ju","Vi","Sa","Do"];

interface MediaItem {
  tipo: "foto" | "video";
  url: string;
  thumb?: string; // para videos: thumbnail
  nombre?: string;
}

const FORM_VACIO = {
  titulo: "", descripcion: "", fecha: "", hora: "09:00", fecha_fin: "", hora_fin: "",
  lugar: "", lugar_url: "", link_externo: "", imagen_url: "",
  tipo: "gfi", gratuito: true, precio_entrada: "",
  capacidad: "", plataforma: "presencial", link_reunion: "", destacado: false,
};

export default function EventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroVista, setFiltroVista] = useState<"proximos"|"mis"|"todos">("proximos");

  // Calendario
  const hoy = new Date();
  const [calMes, setCalMes] = useState(hoy.getMonth());
  const [calAnio, setCalAnio] = useState(hoy.getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);

  // Modal crear/proponer
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [textoParser, setTextoParser] = useState("");
  const [imagenParser, setImagenParser] = useState<string | null>(null);
  const [parseando, setParseando] = useState(false);
  const [mostrarParser, setMostrarParser] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [linkVideo, setLinkVideo] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string; tipo: "ok"|"err"} | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      setUserId(data.user.id);
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (p?.tipo === "admin") setEsAdmin(true);
      await cargarEventos(data.user.id);
    };
    init();
  }, []);

  const cargarEventos = async (uid: string) => {
    setLoading(true);
    const { data: evs } = await supabase
      .from("eventos").select("*")
      .in("estado", ["publicado", "finalizado"])
      .order("fecha", { ascending: true });
    if (!evs) { setLoading(false); return; }
    const { data: ins } = await supabase.from("inscripciones_eventos").select("evento_id").eq("perfil_id", uid);
    const insSet = new Set(ins?.map(i => i.evento_id) ?? []);
    const { data: counts } = await supabase.from("inscripciones_eventos").select("evento_id");
    const conteo: Record<string, number> = {};
    counts?.forEach(c => { conteo[c.evento_id] = (conteo[c.evento_id] ?? 0) + 1; });
    setEventos(evs.map(ev => ({ ...ev, inscripto: insSet.has(ev.id), total_inscriptos: conteo[ev.id] ?? 0 })));
    setLoading(false);
  };

  const mostrarToast = (msg: string, tipo: "ok"|"err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleInscripcion = async (eventoId: string, yaInscripto: boolean, capacidad: number | null, total: number) => {
    if (!userId) return;
    if (!yaInscripto && capacidad !== null && total >= capacidad) {
      mostrarToast("El evento ya está completo", "err"); return;
    }
    setProcesando(eventoId);
    if (yaInscripto) {
      await supabase.from("inscripciones_eventos").delete().eq("evento_id", eventoId).eq("perfil_id", userId);
    } else {
      await supabase.from("inscripciones_eventos").insert({ evento_id: eventoId, perfil_id: userId });
    }
    await cargarEventos(userId);
    setProcesando(null);
  };

  const handlePasteImagen = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !userId) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (!file) continue;
        // Subir al storage en vez de guardar base64
        const ext = file.type.split("/")[1] ?? "jpg";
        const path = `${userId}/paste_${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage.from("eventos").upload(path, file, { upsert: true });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from("eventos").getPublicUrl(data.path);
          setImagenParser(urlData.publicUrl);
        } else {
          // Fallback: base64 para preview local
          const reader = new FileReader();
          reader.onload = (ev) => setImagenParser(ev.target?.result as string);
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const subirFotos = async (files: FileList) => {
    if (!userId) return;
    setSubiendoFoto(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}_${i}.${ext}`;
      const { data, error } = await supabase.storage.from("eventos").upload(path, file, { upsert: true });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("eventos").getPublicUrl(data.path);
        setMedia(prev => [...prev, { tipo: "foto", url: urlData.publicUrl, nombre: file.name }]);
      }
    }
    setSubiendoFoto(false);
  };

  const agregarVideo = () => {
    if (!linkVideo.trim()) return;
    const url = linkVideo.trim();
    // Extraer thumbnail de YouTube
    let thumb: string | undefined;
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) thumb = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
    setMedia(prev => [...prev, { tipo: "video", url, thumb }]);
    setLinkVideo("");
  };

  const quitarMedia = (idx: number) => {
    setMedia(prev => prev.filter((_, i) => i !== idx));
  };

  const parsearEvento = async () => {
    if (!textoParser.trim()) { mostrarToast("Pega el texto del evento", "err"); return; }
    setParseando(true);
    try {
      const res = await fetch("/api/eventos/parsear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoParser }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "error");
      const parsed = json.data;
      setForm(p => ({
        ...p,
        titulo: parsed.titulo ?? p.titulo,
        descripcion: parsed.descripcion ?? p.descripcion,
        fecha: parsed.fecha ?? p.fecha,
        hora: parsed.hora ?? p.hora,
        tipo: parsed.tipo ?? p.tipo,
        plataforma: parsed.plataforma ?? p.plataforma,
        lugar: parsed.lugar ?? p.lugar,
        link_reunion: parsed.link_reunion ?? p.link_reunion,
        link_externo: parsed.link_externo ?? p.link_externo,
        gratuito: typeof parsed.gratuito === "boolean" ? parsed.gratuito : p.gratuito,
        precio_entrada: parsed.precio_entrada?.toString() ?? p.precio_entrada,
        capacidad: parsed.capacidad?.toString() ?? p.capacidad,
      }));
      // Si habia imagen pegada (ya subida al storage), agregarla a la galeria
      if (imagenParser) {
        setMedia(prev => [{ tipo: "foto", url: imagenParser!, nombre: "flyer" }, ...prev]);
        setImagenParser(null);
      }
      setMostrarParser(false);
      setTextoParser("");
      mostrarToast("Datos extraidos — revisa y ajusta antes de guardar");
    } catch {
      mostrarToast("No se pudo parsear — completa los datos manualmente", "err");
    }
    setParseando(false);
  };

  const guardarEvento = async () => {
    if (!userId || !form.titulo || !form.fecha) { mostrarToast("Título y fecha son obligatorios", "err"); return; }
    setGuardando(true);
    const fechaISO = new Date(`${form.fecha}T${form.hora}:00`).toISOString();
    const fechaFinISO = form.fecha_fin ? new Date(`${form.fecha_fin}T${form.hora_fin || "23:59"}:00`).toISOString() : null;
    const { error } = await supabase.from("eventos").insert({
      titulo: form.titulo, descripcion: form.descripcion || null,
      fecha: fechaISO, fecha_fin: fechaFinISO,
      lugar: form.lugar || null, lugar_url: form.lugar_url || null,
      link_externo: form.link_externo || null, imagen_url: form.imagen_url || null,
      tipo: form.tipo, gratuito: form.gratuito,
      precio_entrada: form.gratuito ? null : (parseFloat(form.precio_entrada) || null),
      capacidad: form.capacidad ? parseInt(form.capacidad) : null,
      plataforma: form.plataforma || null, link_reunion: form.link_reunion || null,
      organizador_id: userId,
      estado: esAdmin ? "publicado" : "pendiente",
      destacado: esAdmin ? form.destacado : false,
      media: media.length > 0 ? media : null,
    });
    setGuardando(false);
    if (error) { mostrarToast("Error al guardar", "err"); return; }
    mostrarToast(esAdmin ? "Evento publicado" : "Propuesta enviada — el admin la revisará");
    setMostrarForm(false);
    setForm(FORM_VACIO);
    setMedia([]);
    setLinkVideo("");
    await cargarEventos(userId);
  };

  const cancelarEvento = async (id: string) => {
    if (!confirm("¿Cancelar este evento?")) return;
    await supabase.from("eventos").update({ estado: "cancelado" }).eq("id", id);
    await cargarEventos(userId!);
    mostrarToast("Evento cancelado");
  };

  // Calendario
  const diasEnMes = new Date(calAnio, calMes + 1, 0).getDate();
  const primerDia = new Date(calAnio, calMes, 1).getDay();
  const offsetLunes = primerDia === 0 ? 6 : primerDia - 1;

  const eventosDelMes = eventos.filter(ev => {
    const d = new Date(ev.fecha);
    return d.getMonth() === calMes && d.getFullYear() === calAnio;
  });

  const diasConEventos = new Set(eventosDelMes.map(ev => new Date(ev.fecha).getDate()));

  const eventosFiltrados = eventos.filter(ev => {
    const d = new Date(ev.fecha);
    const esProximo = d >= hoy;
    if (filtroVista === "proximos" && !esProximo) return false;
    if (filtroVista === "mis" && !ev.inscripto) return false;
    if (diaSeleccionado !== null) {
      if (d.getDate() !== diaSeleccionado || d.getMonth() !== calMes || d.getFullYear() !== calAnio) return false;
    }
    if (filtroTipo !== "todos" && ev.tipo !== filtroTipo) return false;
    return true;
  });

  const formatFecha = (iso: string) => {
    const d = new Date(iso);
    return {
      dia: d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }),
      hora: d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      mes: d.toLocaleDateString("es-AR", { month: "short" }).toUpperCase().replace(".", ""),
      num: d.getDate(),
    };
  };

  const esProximo = (iso: string) => new Date(iso) >= hoy;
  const capacidadPct = (total: number, cap: number | null) => cap ? Math.min(100, Math.round((total / cap) * 100)) : 0;
  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .ev-layout { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: flex-start; }
        .ev-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 20px; }
        .ev-cal { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 16px; }
        .ev-cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .ev-cal-titulo { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 800; color: #fff; }
        .ev-cal-nav { width: 28px; height: 28px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .ev-cal-nav:hover { border-color: rgba(200,0,0,0.4); color: #fff; }
        .ev-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }
        .ev-cal-dow { font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.25); text-align: center; padding: 4px 0; }
        .ev-cal-dia { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 11px; font-family: 'Montserrat',sans-serif; font-weight: 600; cursor: pointer; transition: all 0.15s; color: rgba(255,255,255,0.4); position: relative; border: 1px solid transparent; }
        .ev-cal-dia:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .ev-cal-dia.hoy { color: #cc0000; font-weight: 800; border-color: rgba(200,0,0,0.3); }
        .ev-cal-dia.con-eventos::after { content: ''; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; border-radius: 50%; background: #cc0000; }
        .ev-cal-dia.seleccionado { background: rgba(200,0,0,0.15); border-color: #cc0000; color: #fff; }
        .ev-cal-dia.vacio { cursor: default; }
        .ev-cal-dia.vacio:hover { background: transparent; }
        .ev-cal-limpiar { width: 100%; margin-top: 8px; padding: 6px; background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; color: rgba(255,255,255,0.3); font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .ev-cal-limpiar:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.6); }
        .ev-leyenda { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 14px 16px; }
        .ev-leyenda-titulo { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 10px; }
        .ev-leyenda-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; transition: opacity 0.15s; }
        .ev-leyenda-item:hover { opacity: 0.8; }
        .ev-leyenda-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .ev-leyenda-label { font-size: 11px; color: rgba(255,255,255,0.5); font-family: 'Inter',sans-serif; }
        .ev-leyenda-item.activo .ev-leyenda-label { color: #fff; }
        .ev-main { display: flex; flex-direction: column; gap: 16px; }
        .ev-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .ev-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
        .ev-filtro { padding: 7px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); transition: all 0.2s; }
        .ev-filtro:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .ev-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .ev-btn-nuevo { padding: 9px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .ev-btn-nuevo:hover { background: #e60000; }
        .ev-lista { display: flex; flex-direction: column; gap: 12px; }
        .ev-card { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden; display: flex; transition: border-color 0.2s; }
        .ev-card:hover { border-color: rgba(200,0,0,0.2); }
        .ev-card.pasado { opacity: 0.5; }
        .ev-card.destacado { border-color: rgba(200,0,0,0.3); }
        .ev-fecha-col { width: 72px; flex-shrink: 0; background: rgba(200,0,0,0.08); border-right: 1px solid rgba(200,0,0,0.12); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 12px 8px; }
        .ev-fecha-num { font-family: 'Montserrat',sans-serif; font-size: 26px; font-weight: 800; color: #cc0000; line-height: 1; }
        .ev-fecha-mes { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.4); }
        .ev-fecha-anio { font-size: 9px; color: rgba(255,255,255,0.25); }
        .ev-body { flex: 1; padding: 14px 18px; min-width: 0; }
        .ev-body-top { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .ev-titulo { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; line-height: 1.3; }
        .ev-badge { font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; border: 1px solid; white-space: nowrap; }
        .ev-meta { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
        .ev-meta-item { font-size: 11px; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 4px; }
        .ev-desc { font-size: 12px; color: rgba(255,255,255,0.45); line-height: 1.5; }
        .ev-cap { margin-top: 8px; }
        .ev-cap-bar-wrap { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; margin-top: 4px; }
        .ev-cap-bar { height: 3px; border-radius: 2px; transition: width 0.4s; }
        .ev-cap-texto { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 3px; }
        .ev-acciones { padding: 14px 16px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 8px; min-width: 130px; flex-shrink: 0; border-left: 1px solid rgba(255,255,255,0.05); }
        .ev-btn-ins { padding: 8px 14px; border: none; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .ev-btn-ins.libre { background: #cc0000; color: #fff; }
        .ev-btn-ins.libre:hover { background: #e60000; }
        .ev-btn-ins.inscripto { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
        .ev-btn-ins.inscripto:hover { background: rgba(34,197,94,0.2); }
        .ev-btn-ins.lleno { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; }
        .ev-btn-ins:disabled { opacity: 0.5; cursor: not-allowed; }
        .ev-btn-cancelar-ev { padding: 5px 10px; background: transparent; border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; color: rgba(200,0,0,0.6); font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .ev-btn-cancelar-ev:hover { border-color: #cc0000; color: #cc0000; }
        .ev-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.15); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ev-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
        .ev-loading { padding: 48px; text-align: center; color: rgba(255,255,255,0.25); font-size: 13px; }
        /* Modal */
        .ev-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; }
        .ev-modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.2); border-radius: 8px; padding: 28px 32px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; position: relative; }
        .ev-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .ev-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .ev-modal-titulo span { color: #cc0000; }
        .ev-field { margin-bottom: 14px; }
        .ev-label { display: block; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
        .ev-input { width: 100%; padding: 9px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; transition: border-color 0.2s; }
        .ev-input:focus { border-color: rgba(200,0,0,0.4); }
        .ev-input::placeholder { color: rgba(255,255,255,0.2); }
        .ev-select { width: 100%; padding: 9px 13px; background: #0f0f0f; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .ev-textarea { width: 100%; padding: 9px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; resize: vertical; min-height: 80px; transition: border-color 0.2s; }
        .ev-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .ev-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ev-tipos-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .ev-tipo-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 700; font-family: 'Montserrat',sans-serif; cursor: pointer; transition: all 0.15s; }
        .ev-gratuito-toggle { display: flex; gap: 10px; }
        .ev-gt-btn { flex: 1; padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .ev-gt-btn.activo.grat { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.08); color: #22c55e; }
        .ev-gt-btn.activo.pago { border-color: rgba(234,179,8,0.4); background: rgba(234,179,8,0.08); color: #eab308; }
        .ev-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 16px; }
        .ev-btn-cancel { padding: 9px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .ev-btn-guardar { padding: 9px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .ev-btn-guardar:hover { background: #e60000; }
        .ev-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
        .ev-seccion-titulo { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.2); margin: 16px 0 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; z-index: 999; animation: toastIn 0.3s ease; }
        .toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; }
        .toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 860px) { .ev-layout { grid-template-columns: 1fr; } .ev-sidebar { position: static; } }
        @media (max-width: 600px) { .ev-card { flex-direction: column; } .ev-acciones { flex-direction: row; border-left: none; border-top: 1px solid rgba(255,255,255,0.05); } .ev-row2 { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>
              Próximos <span style={{ color: "#cc0000" }}>eventos</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
              GFI®, COCIR, CIR y la comunidad
            </div>
          </div>
          <button className="ev-btn-nuevo" onClick={() => setMostrarForm(true)}>
            {esAdmin ? "+ Crear evento" : "+ Proponer evento"}
          </button>
        </div>

        <div className="ev-layout">

          {/* Sidebar calendario */}
          <div className="ev-sidebar">

            {/* Calendario */}
            <div className="ev-cal">
              <div className="ev-cal-header">
                <button className="ev-cal-nav" onClick={() => { if (calMes === 0) { setCalMes(11); setCalAnio(a => a-1); } else setCalMes(m => m-1); }}>‹</button>
                <div className="ev-cal-titulo">{MESES[calMes]} {calAnio}</div>
                <button className="ev-cal-nav" onClick={() => { if (calMes === 11) { setCalMes(0); setCalAnio(a => a+1); } else setCalMes(m => m+1); }}>›</button>
              </div>
              <div className="ev-cal-grid">
                {DIAS_SEMANA.map(d => <div key={d} className="ev-cal-dow">{d}</div>)}
                {Array.from({ length: offsetLunes }).map((_, i) => <div key={`v${i}`} className="ev-cal-dia vacio" />)}
                {Array.from({ length: diasEnMes }).map((_, i) => {
                  const dia = i + 1;
                  const esHoy = dia === hoy.getDate() && calMes === hoy.getMonth() && calAnio === hoy.getFullYear();
                  const tieneEv = diasConEventos.has(dia);
                  const selec = diaSeleccionado === dia;
                  return (
                    <div key={dia} className={`ev-cal-dia${esHoy ? " hoy" : ""}${tieneEv ? " con-eventos" : ""}${selec ? " seleccionado" : ""}`}
                      onClick={() => setDiaSeleccionado(selec ? null : dia)}>
                      {dia}
                    </div>
                  );
                })}
              </div>
              {diaSeleccionado !== null && (
                <button className="ev-cal-limpiar" onClick={() => setDiaSeleccionado(null)}>✕ Ver todos</button>
              )}
            </div>

            {/* Leyenda tipos */}
            <div className="ev-leyenda">
              <div className="ev-leyenda-titulo">Tipo de evento</div>
              <div className="ev-leyenda-item" style={{ paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}
                onClick={() => setFiltroTipo("todos")}>
                <div className="ev-leyenda-dot" style={{ background: "rgba(255,255,255,0.3)" }} />
                <span className="ev-leyenda-label" style={{ color: filtroTipo === "todos" ? "#fff" : undefined }}>Todos</span>
              </div>
              {Object.entries(TIPOS).map(([k, t]) => (
                <div key={k} className={`ev-leyenda-item${filtroTipo === k ? " activo" : ""}`} onClick={() => setFiltroTipo(filtroTipo === k ? "todos" : k)}>
                  <div className="ev-leyenda-dot" style={{ background: t.color }} />
                  <span className="ev-leyenda-label">{t.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat',sans-serif" }}>
                    {eventos.filter(ev => ev.tipo === k).length}
                  </span>
                </div>
              ))}
            </div>

          </div>

          {/* Main */}
          <div className="ev-main">

            {/* Filtros vista */}
            <div className="ev-toolbar">
              <div className="ev-filtros">
                {([["proximos","Próximos"],["mis","Mis inscripciones"],["todos","Todos"]] as const).map(([f,l]) => (
                  <button key={f} className={`ev-filtro${filtroVista === f ? " activo" : ""}`} onClick={() => setFiltroVista(f)}>{l}</button>
                ))}
              </div>
              {diaSeleccionado !== null && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
                  📅 {diaSeleccionado} de {MESES[calMes]}
                </div>
              )}
            </div>

            {loading ? (
              <div className="ev-loading">Cargando eventos...</div>
            ) : eventosFiltrados.length === 0 ? (
              <div className="ev-empty">
                {diaSeleccionado ? `No hay eventos el ${diaSeleccionado} de ${MESES[calMes]}` : "No hay eventos en esta categoría."}
              </div>
            ) : (
              <div className="ev-lista">
                {eventosFiltrados.map(ev => {
                  const f = formatFecha(ev.fecha);
                  const pasado = !esProximo(ev.fecha);
                  const lleno = ev.capacidad !== null && (ev.total_inscriptos ?? 0) >= ev.capacidad;
                  const pct = capacidadPct(ev.total_inscriptos ?? 0, ev.capacidad);
                  const tipo = TIPOS[ev.tipo] ?? TIPOS.externo;
                  const anio = new Date(ev.fecha).getFullYear();
                  return (
                    <div key={ev.id} className={`ev-card${pasado ? " pasado" : ""}${ev.destacado ? " destacado" : ""}`} style={{flexDirection:"column"}}>

                      {/* FOTO FLYER — protagonista arriba */}
                      {ev.media && Array.isArray(ev.media) && (ev.media as MediaItem[]).some((m: MediaItem) => m.tipo === "foto") && (() => {
                        const fotos = (ev.media as MediaItem[]).filter((m: MediaItem) => m.tipo === "foto");
                        const videos = (ev.media as MediaItem[]).filter((m: MediaItem) => m.tipo === "video");
                        return (
                          <div style={{position:"relative",width:"100%"}}>
                            <img
                              src={fotos[0].url}
                              alt={ev.titulo}
                              style={{width:"100%",height:200,objectFit:"cover",objectPosition:"center",display:"block",borderRadius:"8px 8px 0 0",cursor:"zoom-in"}}
                              onClick={() => setLightbox(fotos[0].url)}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <div style={{position:"absolute",bottom:0,left:0,right:0,height:50,background:"linear-gradient(transparent, rgba(10,10,10,0.9))"}} />
                            <div style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.6)",borderRadius:4,padding:"3px 8px",fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:"'Montserrat',sans-serif",fontWeight:700,cursor:"pointer"}}
                              onClick={() => setLightbox(fotos[0].url)}>
                              🔍 Ver completa
                            </div>
                            {/* Miniaturas adicionales */}
                            {(fotos.length > 1 || videos.length > 0) && (
                              <div style={{position:"absolute",bottom:8,right:8,display:"flex",gap:6}}>
                                {fotos.slice(1,4).map((m: MediaItem, i: number) => (
                                  <div key={i}
                                    style={{width:48,height:48,borderRadius:4,overflow:"hidden",border:"2px solid rgba(0,0,0,0.5)",display:"block",flexShrink:0,cursor:"zoom-in"}}
                                    onClick={() => setLightbox(m.url)}>
                                    <img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />
                                  </div>
                                ))}
                                {videos.map((m: MediaItem, i: number) => (
                                  <a key={"v"+i} href={m.url} target="_blank" rel="noopener noreferrer"
                                    style={{width:48,height:48,borderRadius:4,overflow:"hidden",border:"2px solid rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",flexShrink:0,position:"relative"}}>
                                    {m.thumb && <img src={m.thumb} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.5}} alt="" />}
                                    <span style={{fontSize:18,position:"relative",zIndex:1}}>▶️</span>
                                  </a>
                                ))}
                                {fotos.length > 4 && (
                                  <div style={{width:48,height:48,borderRadius:4,background:"rgba(0,0,0,0.7)",border:"2px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:800,fontFamily:"'Montserrat',sans-serif"}}>
                                    +{fotos.length - 4}
                                  </div>
                                )}
                              </div>
                            )}
                            {ev.destacado && (
                              <div style={{position:"absolute",top:10,left:10,background:"rgba(200,0,0,0.85)",padding:"3px 10px",borderRadius:20,fontSize:10,fontFamily:"'Montserrat',sans-serif",fontWeight:700,color:"#fff",letterSpacing:"0.1em"}}>
                                ⭐ DESTACADO
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* CUERPO: fecha + info + acciones */}
                      <div style={{display:"flex",flex:1}}>
                        <div className="ev-fecha-col">
                          <div className="ev-fecha-num">{f.num}</div>
                          <div className="ev-fecha-mes">{f.mes}</div>
                          <div className="ev-fecha-anio">{anio}</div>
                        </div>
                        <div className="ev-body" style={{flex:1}}>
                          <div className="ev-body-top">
                            {ev.destacado && !(ev.media && Array.isArray(ev.media) && (ev.media as MediaItem[]).some((m: MediaItem) => m.tipo === "foto")) && <span style={{fontSize:12}}>⭐</span>}
                            <span className="ev-titulo">{ev.titulo}</span>
                            <span className="ev-badge" style={{color:tipo.color,background:tipo.bg,borderColor:tipo.border}}>{tipo.label}</span>
                            <span className="ev-badge" style={{color:ev.gratuito?"#22c55e":"#eab308",background:ev.gratuito?"rgba(34,197,94,0.08)":"rgba(234,179,8,0.08)",borderColor:ev.gratuito?"rgba(34,197,94,0.2)":"rgba(234,179,8,0.2)"}}>
                              {ev.gratuito ? "Gratuito" : ev.precio_entrada ? `$${ev.precio_entrada.toLocaleString("es-AR")}` : "Con costo"}
                            </span>
                            {ev.plataforma && ev.plataforma !== "presencial" && (
                              <span className="ev-badge" style={{color:"#60a5fa",background:"rgba(96,165,250,0.08)",borderColor:"rgba(96,165,250,0.2)"}}>
                                {PLATAFORMAS[ev.plataforma] ?? "🎥"} Online
                              </span>
                            )}
                          </div>
                          <div className="ev-meta">
                            <span className="ev-meta-item">🕐 {f.dia} · {f.hora}hs</span>
                            {ev.lugar && <span className="ev-meta-item">📍 {ev.lugar}</span>}
                          </div>
                          {ev.descripcion && <div className="ev-desc">{ev.descripcion}</div>}
                          {/* Videos sin foto de portada */}
                          {ev.media && Array.isArray(ev.media) && !(ev.media as MediaItem[]).some((m: MediaItem) => m.tipo === "foto") && (ev.media as MediaItem[]).filter((m: MediaItem) => m.tipo === "video").length > 0 && (
                            <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                              {(ev.media as MediaItem[]).filter((m: MediaItem) => m.tipo === "video").map((m: MediaItem, i: number) => (
                                <div key={i}
                                  style={{width:80,height:52,borderRadius:4,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative",background:"rgba(0,0,0,0.4)",cursor:"pointer"}}
                                  onClick={() => setLightbox(m.url)}>
                                  {m.thumb && <img src={m.thumb} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.5}} alt="" />}
                                  <span style={{position:"relative",zIndex:1,fontSize:20}}>▶️</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {ev.capacidad !== null && (
                            <div className="ev-cap">
                              <div className="ev-cap-bar-wrap">
                                <div className="ev-cap-bar" style={{width:`${pct}%`,background:pct>=90?"#f87171":pct>=70?"#eab308":"#22c55e"}} />
                              </div>
                              <div className="ev-cap-texto">{ev.total_inscriptos} / {ev.capacidad} inscriptos {lleno && "· COMPLETO"}</div>
                            </div>
                          )}
                          {ev.capacidad === null && ev.total_inscriptos !== undefined && ev.total_inscriptos > 0 && (
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:6}}>{ev.total_inscriptos} inscriptos</div>
                          )}
                        </div>
                        <div className="ev-acciones">
                          {procesando === ev.id ? (
                            <span className="ev-spinner" />
                          ) : pasado ? (
                            <span style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>FINALIZADO</span>
                          ) : (
                            <button
                              className={`ev-btn-ins ${ev.inscripto ? "inscripto" : lleno ? "lleno" : "libre"}`}
                              onClick={() => !lleno || ev.inscripto ? toggleInscripcion(ev.id, !!ev.inscripto, ev.capacidad, ev.total_inscriptos ?? 0) : undefined}
                              disabled={lleno && !ev.inscripto}
                            >
                              {ev.inscripto ? "✓ Inscripto" : lleno ? "Completo" : "Inscribirse"}
                            </button>
                          )}
                          {ev.link_externo && (
                            <a href={ev.link_externo} target="_blank" rel="noopener noreferrer"
                              style={{fontSize:10,color:"rgba(200,0,0,0.7)",textDecoration:"none",fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>
                              Ver más →
                            </a>
                          )}
                          {ev.link_reunion && !pasado && (
                            <a href={ev.link_reunion} target="_blank" rel="noopener noreferrer"
                              style={{fontSize:10,color:"#60a5fa",textDecoration:"none",fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>
                              🔗 Unirse
                            </a>
                          )}
                          {esAdmin && !pasado && (
                            <button className="ev-btn-cancelar-ev" onClick={() => cancelarEvento(ev.id)}>✕ Cancelar</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL CREAR / PROPONER */}
      {mostrarForm && (
        <div className="ev-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="ev-modal">
            <div className="ev-modal-titulo">
              {esAdmin ? "Crear" : "Proponer"} <span>evento</span>
            </div>
            {!esAdmin && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "10px 14px", marginBottom: 16 }}>
                💡 Tu propuesta será revisada por el admin antes de publicarse.
              </div>
            )}

            {!mostrarParser ? (
              <button type="button"
                style={{width:"100%",padding:"10px 14px",background:"rgba(200,0,0,0.06)",border:"1px dashed rgba(200,0,0,0.3)",borderRadius:6,color:"rgba(200,0,0,0.8)",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",marginBottom:16}}
                onClick={() => setMostrarParser(true)}>
                Pegar texto de WhatsApp / mail — autocompletar con IA
              </button>
            ) : (
              <div style={{background:"rgba(200,0,0,0.04)",border:"1px solid rgba(200,0,0,0.15)",borderRadius:6,padding:16,marginBottom:16}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(200,0,0,0.7)",marginBottom:8}}>
                  Parser IA — Pega el texto del evento
                </div>
                <textarea
                  style={{width:"100%",minHeight:120,padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,color:"#fff",fontSize:12,fontFamily:"'Inter',sans-serif",outline:"none",resize:"vertical"}}
                  placeholder={"Pega aca el texto del evento (Ctrl+V)...\n\nTambien podes pegar una imagen del portapapeles."}
                  value={textoParser}
                  onChange={e => setTextoParser(e.target.value)}
                  onPaste={handlePasteImagen}
                  autoFocus
                />
                {imagenParser && (
                  <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                    <img src={imagenParser} alt="preview" style={{width:60,height:60,objectFit:"cover",borderRadius:4,border:"1px solid rgba(255,255,255,0.1)"}} />
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Imagen detectada — se usara como imagen del evento</span>
                    <button type="button" onClick={() => setImagenParser(null)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:14}}>x</button>
                  </div>
                )}
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button type="button" className="ev-btn-guardar" onClick={parsearEvento} disabled={parseando || !textoParser.trim()}>
                    {parseando ? "Procesando..." : "Autocompletar con IA"}
                  </button>
                  <button type="button" className="ev-btn-cancel" onClick={() => { setMostrarParser(false); setTextoParser(""); setImagenParser(null); }}>
                    Cancelar
                  </button>
                </div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:8,fontStyle:"italic"}}>
                  La IA extrae titulo, fecha, hora, lugar, disertantes y mas. Revisa los datos antes de guardar.
                </div>
              </div>
            )}

            <div className="ev-seccion-titulo">Informacion principal</div>
            <div className="ev-field">
              <label className="ev-label">Título *</label>
              <input className="ev-input" value={form.titulo} onChange={e => setF("titulo", e.target.value)} placeholder="Ej: Desayuno de trabajo GFI® — Junio" />
            </div>
            <div className="ev-field">
              <label className="ev-label">Tipo de evento</label>
              <div className="ev-tipos-grid">
                {Object.entries(TIPOS).map(([k, t]) => (
                  <button key={k} type="button" className="ev-tipo-btn"
                    style={form.tipo === k ? { borderColor: t.border, background: t.bg, color: t.color } : {}}
                    onClick={() => setF("tipo", k)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ev-field">
              <label className="ev-label">Descripción</label>
              <textarea className="ev-textarea" value={form.descripcion} onChange={e => setF("descripcion", e.target.value)} placeholder="Detallá el evento, qué se va a tratar, a quién está dirigido..." />
            </div>

            <div className="ev-seccion-titulo">Fecha y lugar</div>
            <div className="ev-row2">
              <div className="ev-field">
                <label className="ev-label">Fecha *</label>
                <input className="ev-input" type="date" value={form.fecha} onChange={e => setF("fecha", e.target.value)} />
              </div>
              <div className="ev-field">
                <label className="ev-label">Hora</label>
                <input className="ev-input" type="time" value={form.hora} onChange={e => setF("hora", e.target.value)} />
              </div>
            </div>
            <div className="ev-field">
              <label className="ev-label">Plataforma</label>
              <select className="ev-select" value={form.plataforma} onChange={e => setF("plataforma", e.target.value)}>
                <option value="presencial">📍 Presencial</option>
                <option value="zoom">🎥 Zoom</option>
                <option value="meet">🎥 Google Meet</option>
                <option value="youtube">▶️ YouTube Live</option>
                <option value="teams">🎥 Teams</option>
              </select>
            </div>
            {form.plataforma === "presencial" ? (
              <div className="ev-field">
                <label className="ev-label">Lugar</label>
                <input className="ev-input" value={form.lugar} onChange={e => setF("lugar", e.target.value)} placeholder="Ej: Sede COCIR, San Martín 1234" />
              </div>
            ) : (
              <div className="ev-field">
                <label className="ev-label">Link de reunión</label>
                <input className="ev-input" value={form.link_reunion} onChange={e => setF("link_reunion", e.target.value)} placeholder="https://zoom.us/j/..." />
              </div>
            )}

            <div className="ev-seccion-titulo">Inscripción</div>
            <div className="ev-field">
              <label className="ev-label">¿Es gratuito?</label>
              <div className="ev-gratuito-toggle">
                <button type="button" className={`ev-gt-btn${form.gratuito ? " activo grat" : ""}`} onClick={() => setF("gratuito", true)}>✓ Gratuito</button>
                <button type="button" className={`ev-gt-btn${!form.gratuito ? " activo pago" : ""}`} onClick={() => setF("gratuito", false)}>💰 Con costo</button>
              </div>
            </div>
            {!form.gratuito && (
              <div className="ev-field">
                <label className="ev-label">Precio (ARS)</label>
                <input className="ev-input" type="number" value={form.precio_entrada} onChange={e => setF("precio_entrada", e.target.value)} placeholder="5000" />
              </div>
            )}
            <div className="ev-field">
              <label className="ev-label">Capacidad máxima (opcional)</label>
              <input className="ev-input" type="number" value={form.capacidad} onChange={e => setF("capacidad", e.target.value)} placeholder="40 (dejá vacío para sin límite)" />
            </div>
            <div className="ev-field">
              <label className="ev-label">Link externo (opcional)</label>
              <input className="ev-input" value={form.link_externo} onChange={e => setF("link_externo", e.target.value)} placeholder="https://..." />
            </div>
            {esAdmin && (
              <div className="ev-field" style={{ marginTop: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.destacado} onChange={e => setF("destacado", e.target.checked)} style={{ accentColor: "#cc0000" }} />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>⭐ Marcar como destacado</span>
                </label>
              </div>
            )}

            {/* ── FOTOS Y VIDEOS ── */}
            <div className="ev-seccion-titulo">Fotos y videos</div>

            {/* Drop zone fotos */}
            <div className="ev-field">
              <label className="ev-label">Fotos (flyer, lugar, etc.) — varias a la vez</label>
              <label
                style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"rgba(255,255,255,0.03)",border:"2px dashed rgba(255,255,255,0.1)",borderRadius:6,cursor:"pointer",transition:"all 0.2s"}}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(200,0,0,0.5)"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; if (e.dataTransfer.files) subirFotos(e.dataTransfer.files); }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(200,0,0,0.3)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
              >
                <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={e => e.target.files && subirFotos(e.target.files)} />
                <span style={{fontSize:28}}>📷</span>
                <div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",fontWeight:500}}>
                    {subiendoFoto ? "⏳ Subiendo fotos..." : "Seleccionar o arrastrar fotos"}
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>JPG, PNG, WEBP · Podés seleccionar varias a la vez</div>
                </div>
              </label>
            </div>

            {/* Links de video */}
            <div className="ev-field">
              <label className="ev-label">Videos (YouTube, Instagram, TikTok, WhatsApp) — uno por vez</label>
              <div style={{display:"flex",gap:8}}>
                <input
                  className="ev-input"
                  style={{flex:1}}
                  value={linkVideo}
                  onChange={e => setLinkVideo(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregarVideo(); }}}
                  placeholder="https://youtube.com/watch?v=... · Pegá el link y Enter"
                />
                <button type="button" className="ev-btn-guardar" style={{whiteSpace:"nowrap",padding:"9px 16px",flexShrink:0}}
                  onClick={agregarVideo} disabled={!linkVideo.trim()}>
                  + Agregar
                </button>
              </div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:4}}>
                Pegá el link y presioná Enter o el botón. Repetí para cada video.
              </div>
            </div>

            {/* Galería preview */}
            {media.length > 0 && (
              <div style={{marginTop:4}}>
                <div style={{fontSize:10,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)",marginBottom:8}}>
                  {media.filter(m => m.tipo === "foto").length} foto{media.filter(m => m.tipo === "foto").length !== 1 ? "s" : ""} · {media.filter(m => m.tipo === "video").length} video{media.filter(m => m.tipo === "video").length !== 1 ? "s" : ""}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(88px,1fr))",gap:8}}>
                  {media.map((m, i) => (
                    <div key={i} style={{position:"relative",borderRadius:6,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",aspectRatio:"1",background:"rgba(0,0,0,0.4)",minHeight:88}}>
                      {m.tipo === "foto" ? (
                        <img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",position:"absolute",inset:0}} alt={m.nombre} />
                      ) : (
                        <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:3,padding:4}}>
                          {m.thumb
                            ? <img src={m.thumb} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.5}} alt="" />
                            : null}
                          <span style={{fontSize:22,position:"relative",zIndex:1}}>▶️</span>
                          <span style={{fontSize:8,color:"rgba(255,255,255,0.5)",textAlign:"center",position:"relative",zIndex:1,lineHeight:1.2,wordBreak:"break-all"}}>
                            {m.url.includes("youtube") ? "YouTube" : m.url.includes("instagram") ? "Instagram" : m.url.includes("tiktok") ? "TikTok" : "Video"}
                          </span>
                        </div>
                      )}
                      {/* Badge tipo */}
                      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.65)",padding:"2px 4px",fontSize:9,color:"rgba(255,255,255,0.7)",textAlign:"center",fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>
                        {m.tipo === "foto" ? "📷 Foto" : "🎬 Video"}
                      </div>
                      {/* Botón quitar */}
                      <button type="button"
                        style={{position:"absolute",top:4,right:4,background:"rgba(200,0,0,0.85)",border:"none",borderRadius:"50%",width:22,height:22,color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,fontWeight:700}}
                        onClick={() => quitarMedia(i)}>✕</button>
                      {/* Primera foto = portada */}
                      {i === 0 && m.tipo === "foto" && (
                        <div style={{position:"absolute",top:4,left:4,background:"rgba(200,0,0,0.85)",padding:"2px 6px",borderRadius:3,fontSize:8,color:"#fff",fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>
                          PORTADA
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:6,fontStyle:"italic"}}>
                  La primera foto se muestra como portada del evento. Podés reordenarlas quitando y volviendo a subir.
                </div>
              </div>
            )}

            <div className="ev-modal-actions">
              <button className="ev-btn-cancel" onClick={() => { setMostrarForm(false); setForm(FORM_VACIO); }}>Cancelar</button>
              <button className="ev-btn-guardar" onClick={guardarEvento} disabled={guardando || !form.titulo || !form.fecha}>
                {guardando ? "Guardando..." : esAdmin ? "Publicar evento" : "Enviar propuesta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX — fotos y videos */}
      {lightbox && (
        <div
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.96)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,cursor:"zoom-out"}}
          onClick={() => setLightbox(null)}>
          <div style={{position:"relative",maxWidth:"95vw",maxHeight:"94vh",display:"flex",alignItems:"center",justifyContent:"center"}}
            onClick={e => e.stopPropagation()}>

            {/* VIDEO */}
            {(lightbox.includes("youtube.com") || lightbox.includes("youtu.be")) ? (
              <iframe
                src={`https://www.youtube.com/embed/${lightbox.match(/(?:watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]}?autoplay=1`}
                style={{width:"min(860px,90vw)",height:"min(484px,50vw)",borderRadius:8,border:"none"}}
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : lightbox.includes("instagram.com") ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{fontSize:48}}>📷</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",textAlign:"center",maxWidth:320}}>
                  Instagram no permite reproducción embebida.<br/>
                  <a href={lightbox} target="_blank" rel="noopener noreferrer"
                    style={{color:"#cc0000",fontWeight:700,fontFamily:"'Montserrat',sans-serif",textDecoration:"none",marginTop:12,display:"inline-block"}}>
                    Abrir en Instagram →
                  </a>
                </div>
              </div>
            ) : lightbox.includes("tiktok.com") ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{fontSize:48}}>🎵</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",textAlign:"center",maxWidth:320}}>
                  TikTok no permite reproducción embebida.<br/>
                  <a href={lightbox} target="_blank" rel="noopener noreferrer"
                    style={{color:"#cc0000",fontWeight:700,fontFamily:"'Montserrat',sans-serif",textDecoration:"none",marginTop:12,display:"inline-block"}}>
                    Abrir en TikTok →
                  </a>
                </div>
              </div>
            ) : lightbox.startsWith("data:") || lightbox.includes("/storage/") || lightbox.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
              /* FOTO */
              <img
                src={lightbox}
                alt="Foto evento"
                style={{maxWidth:"92vw",maxHeight:"88vh",objectFit:"contain",borderRadius:8,display:"block",boxShadow:"0 0 80px rgba(0,0,0,0.9)"}}
              />
            ) : (
              /* Link genérico — abrir en nueva tab */
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{fontSize:48}}>🎬</div>
                <a href={lightbox} target="_blank" rel="noopener noreferrer"
                  style={{color:"#cc0000",fontWeight:700,fontFamily:"'Montserrat',sans-serif",textDecoration:"none",fontSize:14}}>
                  Abrir video →
                </a>
              </div>
            )}

            <button
              style={{position:"fixed",top:16,right:16,width:36,height:36,borderRadius:"50%",background:"rgba(200,0,0,0.9)",border:"none",color:"#fff",fontSize:18,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}
              onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
