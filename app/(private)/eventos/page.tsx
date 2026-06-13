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
  moneda: string | null;
  capacidad: number | null;
  plataforma: string | null;
  link_reunion: string | null;
  organizador_id: string | null;
  estado: string;
  destacado: boolean;
  gasto?: number | null;
  finanzas_pasadas?: boolean;
  media?: MediaItem[] | null;
  inscripto?: boolean;
  total_inscriptos?: number;
  es_recurrente?: boolean;
  fechas_recurrentes?: string[] | null;
  recurrencia_desc?: string | null;
}

const TIPOS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  gfi:      { label: "GFI®",         color: "#990000",  bg: "rgba(200,0,0,0.12)",      border: "rgba(200,0,0,0.3)" },
  cocir:    { label: "COCIR",        color: "#d4960c",  bg: "rgba(249,115,22,0.1)",    border: "rgba(249,115,22,0.3)" },
  cir:      { label: "CIR",          color: "#818cf8",  bg: "rgba(99,102,241,0.1)",    border: "rgba(99,102,241,0.3)" },
  comercial:{ label: "Comercial",    color: "#d4960c",  bg: "rgba(234,179,8,0.1)",     border: "rgba(234,179,8,0.3)" },
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
  titulo: "", descripcion: "", fecha: "", hora: "09:00", fecha_fin: "", hora_fin: "23:59",
  lugar: "", lugar_url: "", link_externo: "", imagen_url: "",
  tipo: "gfi", gratuito: true, precio_entrada: "",
  capacidad: "", plataforma: "presencial", link_reunion: "", destacado: false,
  recurrencia_desc: "",
};

export default function EventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroVista, setFiltroVista] = useState<"proximos"|"mis"|"todos">("proximos");
  const [publicandoEvento, setPublicandoEvento] = useState<string | null>(null);
  const [eventoRedesResult, setEventoRedesResult] = useState<Record<string, { red: string; ok: boolean; error?: string }[]>>({});

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
  const [eventoVer, setEventoVer] = useState<Evento | null>(null);
  const [modalInscriptos, setModalInscriptos] = useState<Evento | null>(null);
  const [inscriptos, setInscriptos] = useState<any[]>([]);
  const [cargandoIns, setCargandoIns] = useState(false);
  const [buscarPerfil, setBuscarPerfil] = useState("");
  const [resultadosPerfil, setResultadosPerfil] = useState<any[]>([]);
  const [miPerfil, setMiPerfil] = useState<any>(null);
  const [modalInscribir, setModalInscribir] = useState<Evento | null>(null);
  const [formInscribir, setFormInscribir] = useState({ nombre: "", apellido: "", matricula: "", email: "", telefono: "", inmobiliaria: "" });
  const [inscribiendo, setInscribiendo] = useState(false);
  const [gastoEvento, setGastoEvento] = useState("");
  const [pasandoFin, setPasandoFin] = useState(false);
  // Multi-day / recurring
  const [modoFecha, setModoFecha] = useState<"unico"|"multidia"|"recurrente">("unico");
  const [fechasRec, setFechasRec] = useState<string[]>([]);
  const [nuevaFechaRec, setNuevaFechaRec] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      setUserId(data.user.id);
      const { data: p } = await supabase.from("perfiles")
        .select("id, tipo, nombre, apellido, matricula, telefono, email, inmobiliaria")
        .eq("id", data.user.id).single();
      if (p?.tipo === "admin" || p?.tipo === "master") setEsAdmin(true);
      if (p) setMiPerfil(p);
      await cargarEventos(data.user.id);
    };
    init();
  }, []);

  // Búsqueda de perfiles para agregar inscriptos (con debounce).
  useEffect(() => {
    if (buscarPerfil.trim().length < 2) { setResultadosPerfil([]); return; }
    let activo = true;
    const t = setTimeout(async () => {
      const q = buscarPerfil.trim();
      const { data } = await supabase.from("perfiles")
        .select("id, nombre, apellido, matricula, telefono")
        .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`).limit(8);
      if (!activo) return;
      const yaIds = new Set(inscriptos.map(i => i.perfil_id));
      setResultadosPerfil((data ?? []).filter((p: any) => !yaIds.has(p.id)));
    }, 300);
    return () => { activo = false; clearTimeout(t); };
  }, [buscarPerfil, inscriptos]);

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

  const publicarEventoEnRedes = async (evento: Evento) => {
    if (publicandoEvento === evento.id) return;
    setPublicandoEvento(evento.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/social/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          tipo: "evento",
          id: evento.id,
          titulo: evento.titulo,
          descripcion: evento.descripcion ?? null,
          imagen_url: (evento.media && Array.isArray(evento.media) && evento.media.length > 0)
            ? (evento.media as { tipo: string; url: string }[]).find(m => m.tipo === "foto")?.url ?? null
            : null,
          link: window.location.origin + "/eventos",
        }),
      });
      const data = await res.json();
      setEventoRedesResult(prev => ({ ...prev, [evento.id]: data.results ?? [] }));
      const exitosos = (data.results ?? []).filter((r: { ok: boolean }) => r.ok).map((r: { red: string }) => r.red);
      if (exitosos.length > 0) mostrarToast(`Publicado en: ${exitosos.join(", ")}`);
      else mostrarToast("No se pudo publicar en ninguna red", "err");
    } catch {
      setEventoRedesResult(prev => ({ ...prev, [evento.id]: [{ red: "error", ok: false, error: "Error de conexión" }] }));
      mostrarToast("Error al publicar en redes", "err");
    }
    setPublicandoEvento(null);
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

  // ── Inscripción con formulario (completa/actualiza el perfil del Foro) ─────
  const setFI = (k: string, v: string) => setFormInscribir(prev => ({ ...prev, [k]: v }));
  const abrirInscribir = (ev: Evento) => {
    const p = miPerfil ?? {};
    setFormInscribir({
      nombre: p.nombre ?? "", apellido: p.apellido ?? "", matricula: p.matricula ?? "",
      email: p.email ?? "", telefono: p.telefono ?? "", inmobiliaria: p.inmobiliaria ?? "",
    });
    setModalInscribir(ev);
  };
  const confirmarInscripcion = async (ev: Evento) => {
    if (!userId) return;
    if (!formInscribir.nombre.trim() || !formInscribir.apellido.trim()) { mostrarToast("Completá nombre y apellido", "err"); return; }
    setInscribiendo(true);
    const updates: any = {
      nombre: formInscribir.nombre.trim(),
      apellido: formInscribir.apellido.trim(),
      matricula: formInscribir.matricula.trim() || null,
      email: formInscribir.email.trim() || null,
      telefono: formInscribir.telefono.trim() || null,
      inmobiliaria: formInscribir.inmobiliaria.trim() || null,
    };
    await supabase.from("perfiles").update(updates).eq("id", userId); // mantiene la base del Foro al día
    setMiPerfil((prev: any) => ({ ...(prev ?? {}), ...updates }));
    const { error } = await supabase.from("inscripciones_eventos").insert({ evento_id: ev.id, perfil_id: userId });
    setInscribiendo(false);
    if (error) { mostrarToast("No se pudo inscribir", "err"); return; }
    setModalInscribir(null);
    await cargarEventos(userId);
    mostrarToast("¡Inscripto! Tus datos quedaron actualizados.");
  };

  // ── Gestión de inscriptos (organizador / admin) ───────────────────────────
  const abrirInscriptos = async (ev: Evento) => {
    setModalInscriptos(ev); setInscriptos([]); setBuscarPerfil(""); setResultadosPerfil([]);
    setGastoEvento(ev.gasto != null ? String(ev.gasto) : "");
    await cargarInscriptos(ev.id);
  };
  const cargarInscriptos = async (eventoId: string) => {
    setCargandoIns(true);
    const { data } = await supabase.from("inscripciones_eventos")
      .select("id, perfil_id, asistio, pago, monto_pagado, created_at, agregado_por, perfiles(nombre, apellido, telefono, matricula)")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: true });
    setInscriptos(data ?? []);
    setCargandoIns(false);
  };
  const toggleAsistio = async (insId: string, valor: boolean) => {
    setInscriptos(prev => prev.map(i => i.id === insId ? { ...i, asistio: valor } : i));
    const { error } = await supabase.from("inscripciones_eventos")
      .update({ asistio: valor, asistio_at: valor ? new Date().toISOString() : null }).eq("id", insId);
    if (error) {
      setInscriptos(prev => prev.map(i => i.id === insId ? { ...i, asistio: !valor } : i));
      mostrarToast("No se pudo actualizar la asistencia", "err");
    }
  };
  const togglePago = async (insId: string, valor: boolean) => {
    setInscriptos(prev => prev.map(i => i.id === insId ? { ...i, pago: valor } : i));
    const { error } = await supabase.from("inscripciones_eventos").update({ pago: valor }).eq("id", insId);
    if (error) {
      setInscriptos(prev => prev.map(i => i.id === insId ? { ...i, pago: !valor } : i));
      mostrarToast("No se pudo actualizar el pago", "err");
    }
  };
  const guardarMontoPagado = async (insId: string, valor: string) => {
    const monto = valor.trim() === "" ? null : parseFloat(valor.replace(/[^\d.]/g, ""));
    setInscriptos(prev => prev.map(i => i.id === insId ? { ...i, monto_pagado: monto } : i));
    await supabase.from("inscripciones_eventos").update({ monto_pagado: monto }).eq("id", insId);
  };
  const quitarInscripto = async (insId: string, eventoId: string) => {
    if (!confirm("¿Quitar a esta persona de la lista de inscriptos?")) return;
    const { error } = await supabase.from("inscripciones_eventos").delete().eq("id", insId);
    if (error) { mostrarToast("No se pudo quitar al inscripto", "err"); return; }
    await cargarInscriptos(eventoId);
    if (userId) cargarEventos(userId);
  };
  const agregarInscripto = async (ev: Evento, perfilId: string) => {
    const { error } = await supabase.from("inscripciones_eventos")
      .insert({ evento_id: ev.id, perfil_id: perfilId, agregado_por: userId });
    if (error) { mostrarToast("No se pudo agregar (¿ya está inscripto?)", "err"); return; }
    setBuscarPerfil(""); setResultadosPerfil([]);
    await cargarInscriptos(ev.id);
    if (userId) cargarEventos(userId);
    mostrarToast("Inscripto agregado");
  };
  const guardarGasto = async (ev: Evento, valor: string) => {
    const gasto = valor.trim() === "" ? null : parseFloat(valor.replace(/[^\d.]/g, ""));
    await supabase.from("eventos").update({ gasto }).eq("id", ev.id);
    setModalInscriptos(prev => prev ? { ...prev, gasto } : prev);
  };
  const pasarAFinanzas = async (ev: Evento, recaudado: number, gasto: number) => {
    if (ev.finanzas_pasadas) { mostrarToast("Este evento ya se pasó a finanzas", "err"); return; }
    if (recaudado <= 0 && gasto <= 0) { mostrarToast("No hay montos para registrar", "err"); return; }
    setPasandoFin(true);
    const filas: any[] = [];
    if (recaudado > 0) filas.push({ tipo: "ingreso", categoria: "Eventos", concepto: `Recaudado: ${ev.titulo}`, monto: recaudado, moneda: ev.moneda ?? "ARS", referencia: `evento:${ev.id}` });
    if (gasto > 0) filas.push({ tipo: "gasto", categoria: "Eventos", concepto: `Gasto: ${ev.titulo}`, monto: gasto, moneda: ev.moneda ?? "ARS", referencia: `evento:${ev.id}` });
    const { error } = await supabase.from("admin_finanzas").insert(filas);
    if (error) { setPasandoFin(false); mostrarToast("No se pudo pasar a finanzas (solo admin)", "err"); return; }
    await supabase.from("eventos").update({ finanzas_pasadas: true }).eq("id", ev.id);
    setPasandoFin(false);
    setModalInscriptos(prev => prev ? { ...prev, finanzas_pasadas: true } : prev);
    mostrarToast("Saldo registrado en finanzas generales");
  };


  const handlePasteImagen = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !userId) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;

      // Mostrar preview inmediato mientras sube
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setImagenParser(base64); // preview inmediato

        // Subir al storage en background
        try {
          const ext = file.type.includes("png") ? "png" : file.type.includes("gif") ? "gif" : "jpg";
          const path = `${userId}/paste_${Date.now()}.${ext}`;
          const { data, error } = await supabase.storage.from("eventos").upload(path, file, {
            upsert: true,
            contentType: file.type || "image/jpeg",
          });
          if (!error && data) {
            const { data: urlData } = supabase.storage.from("eventos").getPublicUrl(data.path);
            setImagenParser(urlData.publicUrl); // reemplazar base64 con URL pública
          }
          // Si falla el storage, queda el base64 como fallback
        } catch {
          // base64 ya está seteado como fallback
        }
      };
      reader.readAsDataURL(file);
      break;
    }
  };

  const subirFotos = async (files: FileList) => {
    if (!userId) return;
    setSubiendoFoto(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      // Sanitizar nombre: sin espacios, paréntesis ni caracteres especiales
      const path = `${userId}/${Date.now()}_${i}.${ext}`;
      const { data, error } = await supabase.storage.from("eventos").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("eventos").getPublicUrl(data.path);
        // Forzar recarga con timestamp para evitar cache
        const url = urlData.publicUrl;
        setMedia(prev => [...prev, { tipo: "foto", url, nombre: file.name }]);
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
      const { data: { session: parsSession } } = await supabase.auth.getSession();
      const res = await fetch("/api/eventos/parsear", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${parsSession?.access_token}` },
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
      // Si habia imagen pegada, agregarla a la galeria
      if (imagenParser) {
        let urlFinal = imagenParser;
        // Si es base64 (storage falló), intentar subir ahora
        if (imagenParser.startsWith("data:") && userId) {
          try {
            const res = await fetch(imagenParser);
            const blob = await res.blob();
            const ext = blob.type.includes("png") ? "png" : "jpg";
            const path = `${userId}/flyer_${Date.now()}.${ext}`;
            const { data } = await supabase.storage.from("eventos").upload(path, blob, {
              upsert: true, contentType: blob.type,
            });
            if (data) {
              const { data: urlData } = supabase.storage.from("eventos").getPublicUrl(data.path);
              urlFinal = urlData.publicUrl;
            }
          } catch { /* queda base64 */ }
        }
        setMedia(prev => [{ tipo: "foto", url: urlFinal, nombre: "flyer" }, ...prev]);
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
    if (modoFecha === "recurrente" && fechasRec.length === 0) { mostrarToast("Agregá al menos una fecha de sesión", "err"); return; }
    setGuardando(true);
    const fechaISO = new Date(`${form.fecha}T${form.hora}:00`).toISOString();
    const fechaFinISO = modoFecha === "multidia" && form.fecha_fin
      ? new Date(`${form.fecha_fin}T${form.hora_fin || "23:59"}:00`).toISOString()
      : null;
    const { data: eventoCreado, error } = await supabase.from("eventos").insert({
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
      es_recurrente: modoFecha === "recurrente",
      fechas_recurrentes: modoFecha === "recurrente" && fechasRec.length > 0 ? fechasRec : null,
      recurrencia_desc: modoFecha !== "unico" && form.recurrencia_desc ? form.recurrencia_desc : null,
    }).select("*").single();
    setGuardando(false);
    if (error) { mostrarToast("Error al guardar", "err"); return; }
    mostrarToast(esAdmin ? "Evento publicado" : "Propuesta enviada — el admin la revisará");

    if (esAdmin && eventoCreado) {
      mostrarToast("Publicando en redes sociales...");
      try {
        const { data: { session: evSession } } = await supabase.auth.getSession();
        const resp = await fetch("/api/social/publicar", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${evSession?.access_token}` },
          body: JSON.stringify({
            tipo: "evento",
            id: eventoCreado.id,
            titulo: eventoCreado.titulo,
            descripcion: eventoCreado.descripcion ?? null,
            imagen_url: (eventoCreado.media && Array.isArray(eventoCreado.media) && eventoCreado.media.length > 0)
              ? (eventoCreado.media as { tipo: string; url: string }[]).find((m: { tipo: string; url: string }) => m.tipo === "foto")?.url ?? null
              : null,
            link: window.location.origin + "/eventos",
          }),
        });
        const data = await resp.json();
        const exitosos = (data.results ?? []).filter((r: { ok: boolean }) => r.ok).map((r: { red: string }) => r.red);
        const fallidos = (data.results ?? []).filter((r: { ok: boolean }) => !r.ok).map((r: { red: string }) => r.red);
        if (exitosos.length > 0) mostrarToast(`Publicado en: ${exitosos.join(", ")}`);
        if (fallidos.length > 0) mostrarToast(`No se pudo publicar en: ${fallidos.join(", ")}`, "err");
      } catch {
        mostrarToast("Evento guardado (redes no disponibles)", "err");
      }
    }

    setMostrarForm(false);
    setForm(FORM_VACIO);
    setMedia([]);
    setLinkVideo("");
    setModoFecha("unico");
    setFechasRec([]);
    setNuevaFechaRec("");
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
        
        .ev-layout { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: flex-start; }
        .ev-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 20px; }
        .ev-cal { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; padding: 16px; }
        .ev-cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .ev-cal-titulo { font-family: var(--font-display); font-size: 13px; font-weight: 800; color: #fff; }
        .ev-cal-nav { width: 28px; height: 28px; background: transparent; border: 1px solid var(--gfi-border); border-radius: 4px; color: var(--gfi-text-secondary); cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .ev-cal-nav:hover { border-color: rgba(200,0,0,0.4); color: #fff; }
        .ev-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }
        .ev-cal-dow { font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gfi-text-dim); text-align: center; padding: 4px 0; }
        .ev-cal-dia { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 11px; font-family: var(--font-display); font-weight: 600; cursor: pointer; transition: all 0.15s; color: var(--gfi-text-muted); position: relative; border: 1px solid transparent; }
        .ev-cal-dia:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .ev-cal-dia.hoy { color: #990000; font-weight: 800; border-color: rgba(200,0,0,0.3); }
        .ev-cal-dia.con-eventos::after { content: ''; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; border-radius: 50%; background: #990000; }
        .ev-cal-dia.seleccionado { background: rgba(200,0,0,0.15); border-color: #990000; color: #fff; }
        .ev-cal-dia.vacio { cursor: default; }
        .ev-cal-dia.vacio:hover { background: transparent; }
        .ev-cal-limpiar { width: 100%; margin-top: 8px; padding: 6px; background: transparent; border: 1px solid var(--gfi-border); border-radius: 4px; color: var(--gfi-text-muted); font-size: 10px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .ev-cal-limpiar:hover { border-color: rgba(200,0,0,0.3); color: var(--gfi-text-secondary); }
        .ev-leyenda { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; padding: 14px 16px; }
        .ev-leyenda-titulo { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-dim); margin-bottom: 10px; }
        .ev-leyenda-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; transition: opacity 0.15s; }
        .ev-leyenda-item:hover { opacity: 0.8; }
        .ev-leyenda-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .ev-leyenda-label { font-size: 11px; color: var(--gfi-text-secondary); font-family: var(--font-body); }
        .ev-leyenda-item.activo .ev-leyenda-label { color: #fff; }
        .ev-main { display: flex; flex-direction: column; gap: 16px; }
        .ev-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .ev-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
        .ev-filtro { padding: 7px 14px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: 3px; cursor: pointer; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-text-muted); transition: all 0.2s; }
        .ev-filtro:hover { border-color: rgba(200,0,0,0.3); color: var(--gfi-text-primary); }
        .ev-filtro.activo { border-color: #990000; color: #fff; background: rgba(200,0,0,0.08); }
        .ev-btn-nuevo { padding: 9px 20px; background: #990000; border: none; border-radius: 3px; color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .ev-btn-nuevo:hover { background: #e60000; }
        .ev-lista { display: flex; flex-direction: column; gap: 12px; }
        .ev-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; overflow: hidden; display: flex; transition: border-color 0.2s; }
        .ev-card:hover { border-color: rgba(200,0,0,0.2); }
        .ev-card.pasado { opacity: 0.5; }
        .ev-card.destacado { border-color: rgba(200,0,0,0.3); }
        .ev-fecha-col { width: 72px; flex-shrink: 0; background: rgba(200,0,0,0.08); border-right: 1px solid rgba(200,0,0,0.12); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 12px 8px; }
        .ev-fecha-num { font-family: var(--font-display); font-size: 26px; font-weight: 800; color: #990000; line-height: 1; }
        .ev-fecha-mes { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: var(--gfi-text-muted); }
        .ev-fecha-anio { font-size: 9px; color: var(--gfi-text-dim); }
        .ev-body { flex: 1; padding: 14px 18px; min-width: 0; }
        .ev-body-top { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .ev-titulo { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: #fff; line-height: 1.3; }
        .ev-badge { font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; border: 1px solid; white-space: nowrap; }
        .ev-meta { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
        .ev-meta-item { font-size: 11px; color: var(--gfi-text-muted); display: flex; align-items: center; gap: 4px; }
        .ev-desc { font-size: 12px; color: rgba(255,255,255,0.45); line-height: 1.5; }
        .ev-cap { margin-top: 8px; }
        .ev-cap-bar-wrap { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; margin-top: 4px; }
        .ev-cap-bar { height: 3px; border-radius: 2px; transition: width 0.4s; }
        .ev-cap-texto { font-size: 10px; color: var(--gfi-text-muted); margin-top: 3px; }
        .ev-acciones { padding: 14px 16px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 8px; min-width: 130px; flex-shrink: 0; border-left: 1px solid var(--gfi-border-subtle); }
        .ev-btn-ins { padding: 8px 14px; border: none; border-radius: 3px; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .ev-btn-ins.libre { background: #990000; color: #fff; }
        .ev-btn-ins.libre:hover { background: #e60000; }
        .ev-btn-ins.inscripto { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #3abab6; }
        .ev-btn-ins.inscripto:hover { background: rgba(34,197,94,0.2); }
        .ev-btn-ins.lleno { background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); color: var(--gfi-text-dim); cursor: not-allowed; }
        .ev-btn-ins:disabled { opacity: 0.5; cursor: not-allowed; }
        .ev-btn-cancelar-ev { padding: 5px 10px; background: transparent; border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; color: rgba(200,0,0,0.6); font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .ev-btn-cancelar-ev:hover { border-color: #990000; color: #990000; }
        .ev-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.15); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ev-empty { padding: 48px; text-align: center; color: var(--gfi-text-dim); font-size: 13px; font-style: italic; background: var(--gfi-bg-card); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
        .ev-loading { padding: 48px; text-align: center; color: var(--gfi-text-dim); font-size: 13px; }
        /* Modal */
        .ev-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; }
        .ev-modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.2); border-radius: 8px; padding: 28px 32px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; position: relative; }
        .ev-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #990000, transparent); border-radius: 8px 8px 0 0; }
        .ev-modal-titulo { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .ev-modal-titulo span { color: #990000; }
        .ev-field { margin-bottom: 14px; }
        .ev-label { display: block; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 6px; }
        .ev-input { width: 100%; padding: 9px 13px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: var(--font-body); transition: border-color 0.2s; }
        .ev-input:focus { border-color: rgba(200,0,0,0.4); }
        .ev-input::placeholder { color: var(--gfi-text-dim); }
        .ev-select { width: 100%; padding: 9px 13px; background: #0f0f0f; border: 1px solid var(--gfi-border); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: var(--font-body); }
        .ev-textarea { width: 100%; padding: 9px 13px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: var(--font-body); resize: vertical; min-height: 80px; transition: border-color 0.2s; }
        .ev-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .ev-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ev-tipos-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .ev-tipo-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-muted); font-size: 11px; font-weight: 700; font-family: var(--font-display); cursor: pointer; transition: all 0.15s; }
        .ev-gratuito-toggle { display: flex; gap: 10px; }
        .ev-gt-btn { flex: 1; padding: 8px; border-radius: 4px; border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-muted); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .ev-gt-btn.activo.grat { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.08); color: #3abab6; }
        .ev-gt-btn.activo.pago { border-color: rgba(234,179,8,0.4); background: rgba(234,179,8,0.08); color: #d4960c; }
        .ev-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; border-top: 1px solid var(--gfi-border-subtle); padding-top: 16px; }
        .ev-btn-cancel { padding: 9px 20px; background: transparent; border: 1px solid var(--gfi-border); border-radius: 3px; color: var(--gfi-text-muted); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .ev-btn-guardar { padding: 9px 24px; background: #990000; border: none; border-radius: 3px; color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .ev-btn-guardar:hover { background: #e60000; }
        .ev-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
        .ev-seccion-titulo { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gfi-text-dim); margin: 16px 0 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 5px; font-family: var(--font-display); font-size: 12px; font-weight: 700; z-index: 999; animation: toastIn 0.3s ease; }
        .toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #3abab6; }
        .toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 860px) { .ev-layout { grid-template-columns: 1fr; } .ev-sidebar { position: static; } }
        @media (max-width: 600px) { .ev-card { flex-direction: column; } .ev-acciones { flex-direction: row; border-left: none; border-top: 1px solid var(--gfi-border-subtle); } .ev-row2 { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "#fff" }}>
              Próximos <span style={{ color: "#990000" }}>eventos</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--gfi-text-muted)", marginTop: 4 }}>
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
              <div className="ev-leyenda-item" style={{ paddingBottom: 6, borderBottom: "1px solid var(--gfi-border-subtle)", marginBottom: 4 }}
                onClick={() => setFiltroTipo("todos")}>
                <div className="ev-leyenda-dot" style={{ background: "var(--gfi-text-muted)" }} />
                <span className="ev-leyenda-label" style={{ color: filtroTipo === "todos" ? "#fff" : undefined }}>Todos</span>
              </div>
              {Object.entries(TIPOS).map(([k, t]) => (
                <div key={k} className={`ev-leyenda-item${filtroTipo === k ? " activo" : ""}`} onClick={() => setFiltroTipo(filtroTipo === k ? "todos" : k)}>
                  <div className="ev-leyenda-dot" style={{ background: t.color }} />
                  <span className="ev-leyenda-label">{t.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gfi-text-dim)", fontFamily: "var(--font-display)" }}>
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
                <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
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
                    <div key={ev.id} className={`ev-card${pasado ? " pasado" : ""}${ev.destacado ? " destacado" : ""}`} style={{flexDirection:"row",alignItems:"stretch",minHeight:160}}>

                      {/* FOTO IZQUIERDA — estilo carrusel */}
                      {(() => {
                        const fotos = ev.media && Array.isArray(ev.media) ? (ev.media as MediaItem[]).filter((m:MediaItem) => m.tipo==="foto") : [];
                        const videos = ev.media && Array.isArray(ev.media) ? (ev.media as MediaItem[]).filter((m:MediaItem) => m.tipo==="video") : [];
                        if (fotos.length === 0 && videos.length === 0) return null;
                        const portada = fotos[0] ?? null;
                        return (
                          <div style={{width:190,minWidth:190,flexShrink:0,position:"relative",background:"#000",borderRadius:"8px 0 0 8px",overflow:"hidden",cursor:"zoom-in",display:"flex",alignItems:"center",justifyContent:"center"}}
                            onClick={() => portada ? setLightbox(portada.url) : videos[0] && setLightbox(videos[0].url)}>
                            {portada ? (
                              <img src={portada.url} alt={ev.titulo}
                                style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"center",display:"block"}}
                                onError={e=>{(e.target as HTMLImageElement).style.display="none";}} />
                            ) : (
                              <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%",position:"relative"}}>
                                {videos[0].thumb && <img src={videos[0].thumb} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.4}} alt="" />}
                                <span style={{fontSize:36,position:"relative",zIndex:1}}>▶️</span>
                              </div>
                            )}
                            {/* Miniaturas extras abajo */}
                            {(fotos.length + videos.length) > 1 && (
                              <div style={{position:"absolute",bottom:5,right:5,display:"flex",gap:3}}>
                                {[...fotos.slice(1,3),...videos.slice(0,1)].map((m:MediaItem,i:number) => (
                                  <div key={i} style={{width:30,height:30,borderRadius:3,overflow:"hidden",border:"1.5px solid var(--gfi-text-secondary)",flexShrink:0,position:"relative",background:"#000",cursor:"zoom-in"}}
                                    onClick={e=>{e.stopPropagation();setLightbox(m.url);}}>
                                    {m.tipo==="foto"
                                      ? <img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />
                                      : <div style={{width:"100%",height:"100%",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          {m.thumb&&<img src={m.thumb} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.5}} alt="" />}
                                          <span style={{position:"relative",zIndex:1,fontSize:11}}>▶️</span>
                                        </div>}
                                  </div>
                                ))}
                                {(fotos.length+videos.length) > 4 && (
                                  <div style={{width:30,height:30,borderRadius:3,background:"rgba(0,0,0,0.85)",border:"1.5px solid var(--gfi-text-muted)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:800,fontFamily:"var(--font-display)"}}>
                                    +{(fotos.length+videos.length)-4}
                                  </div>
                                )}
                              </div>
                            )}
                            {ev.destacado && (
                              <div style={{position:"absolute",top:7,left:7,background:"rgba(200,0,0,0.9)",padding:"2px 7px",borderRadius:20,fontSize:9,fontFamily:"var(--font-display)",fontWeight:700,color:"#fff"}}>⭐</div>
                            )}
                          </div>
                        );
                      })()}

                      {/* FECHA */}
                      <div className="ev-fecha-col">
                        {ev.es_recurrente && ev.fechas_recurrentes && ev.fechas_recurrentes.length > 0 ? (
                          <>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#990000", lineHeight: 1, fontFamily: "var(--font-display)" }}>{ev.fechas_recurrentes.length}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", textAlign: "center" }}>SESIONES</div>
                            <div style={{ fontSize: 9, color: "var(--gfi-text-dim)" }}>{new Date(ev.fecha + "T12:00:00").toLocaleDateString("es-AR", { month: "short", year: "2-digit" }).toUpperCase()}</div>
                          </>
                        ) : ev.fecha_fin ? (
                          <>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "#990000", lineHeight: 1, fontFamily: "var(--font-display)" }}>{f.num}→{new Date(ev.fecha_fin).getDate()}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", textAlign: "center" }}>{f.mes}</div>
                            <div style={{ fontSize: 9, color: "var(--gfi-text-dim)" }}>{anio}</div>
                          </>
                        ) : (
                          <>
                            <div className="ev-fecha-num">{f.num}</div>
                            <div className="ev-fecha-mes">{f.mes}</div>
                            <div className="ev-fecha-anio">{anio}</div>
                          </>
                        )}
                      </div>

                      {/* INFO */}
                      <div className="ev-body" style={{flex:1}}>
                        <div className="ev-body-top">
                          {ev.destacado && !(ev.media&&Array.isArray(ev.media)&&(ev.media as MediaItem[]).some((m:MediaItem)=>m.tipo==="foto")) && <span style={{fontSize:12}}>⭐</span>}
                          <span className="ev-titulo">{ev.titulo}</span>
                          <span className="ev-badge" style={{color:tipo.color,background:tipo.bg,borderColor:tipo.border}}>{tipo.label}</span>
                          <span className="ev-badge" style={{color:ev.gratuito?"#3abab6":"#d4960c",background:ev.gratuito?"rgba(34,197,94,0.08)":"rgba(234,179,8,0.08)",borderColor:ev.gratuito?"rgba(34,197,94,0.2)":"rgba(234,179,8,0.2)"}}>
                            {ev.gratuito?"Gratuito":ev.precio_entrada?`$${ev.precio_entrada.toLocaleString("es-AR")}`:"Con costo"}
                          </span>
                          {ev.plataforma&&ev.plataforma!=="presencial"&&(
                            <span className="ev-badge" style={{color:"#4ab8d8",background:"rgba(74,184,216,0.08)",borderColor:"rgba(74,184,216,0.2)"}}>
                              {PLATAFORMAS[ev.plataforma]??"🎥"} Online
                            </span>
                          )}
                        </div>
                        <div className="ev-meta">
                          {ev.es_recurrente && ev.fechas_recurrentes && ev.fechas_recurrentes.length > 0 ? (
                            <span className="ev-meta-item">
                              📅 {ev.fechas_recurrentes.map(d => new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })).join(" · ")}
                            </span>
                          ) : ev.fecha_fin ? (
                            <span className="ev-meta-item">📅 {f.dia} al {new Date(ev.fecha_fin).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} · {f.hora}hs</span>
                          ) : (
                            <span className="ev-meta-item">🕐 {f.dia} · {f.hora}hs</span>
                          )}
                          {ev.recurrencia_desc && <span className="ev-meta-item" style={{ color: "rgba(200,0,0,0.7)" }}>↻ {ev.recurrencia_desc}</span>}
                          {ev.lugar&&<span className="ev-meta-item">📍 {ev.lugar}</span>}
                        </div>
                        {ev.descripcion&&<div className="ev-desc">{ev.descripcion}</div>}
                        {ev.capacidad!==null&&(
                          <div className="ev-cap">
                            <div className="ev-cap-bar-wrap"><div className="ev-cap-bar" style={{width:`${pct}%`,background:pct>=90?"#f87171":pct>=70?"#d4960c":"#3abab6"}} /></div>
                            <div className="ev-cap-texto">{ev.total_inscriptos} / {ev.capacidad} inscriptos {lleno&&"· COMPLETO"}</div>
                          </div>
                        )}
                        {ev.capacidad===null&&ev.total_inscriptos!==undefined&&ev.total_inscriptos>0&&(
                          <div style={{fontSize:10,color:"var(--gfi-text-dim)",marginTop:6}}>{ev.total_inscriptos} inscriptos</div>
                        )}
                      </div>

                      {/* ACCIONES */}
                      <div className="ev-acciones">
                        {procesando===ev.id?<span className="ev-spinner" />
                        :pasado?<span style={{fontSize:10,color:"var(--gfi-text-dim)",fontFamily:"var(--font-display)",fontWeight:700}}>FINALIZADO</span>
                        :!ev.gratuito&&!ev.inscripto?(
                          ev.link_externo
                            ?<button className="ev-btn-ins libre" onClick={()=>window.open(ev.link_externo!,"_blank","noopener,noreferrer")}>Pago externo</button>
                            :<span style={{fontSize:10,color:"var(--gfi-text-muted)",fontFamily:"var(--font-display)",fontWeight:700}}>💰 {ev.precio_entrada?.toLocaleString("es-AR")} {ev.moneda??""}</span>
                        ):(
                          <button className={`ev-btn-ins ${ev.inscripto?"inscripto":lleno?"lleno":"libre"}`}
                            onClick={()=>{
                              if (lleno && !ev.inscripto) return;
                              if (ev.inscripto) { toggleInscripcion(ev.id,true,ev.capacidad,ev.total_inscriptos??0); return; }
                              if (ev.link_externo) window.open(ev.link_externo,"_blank","noopener,noreferrer");
                              abrirInscribir(ev);
                            }}
                            disabled={lleno&&!ev.inscripto}>
                            {ev.inscripto?"✓ Inscripto":lleno?"Completo":"Inscribirse"}
                          </button>
                        )}
                        {ev.inscripto&&ev.link_externo&&!pasado&&(
                          <a href={ev.link_externo} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"rgba(200,0,0,0.7)",textDecoration:"none",fontFamily:"var(--font-display)",fontWeight:700}}>🔗 Link inscripción</a>
                        )}
                        <button style={{padding:"5px 10px",background:"transparent",border:"1px solid var(--gfi-border)",borderRadius:3,color:"var(--gfi-text-muted)",fontFamily:"var(--font-display)",fontSize:8,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s"}}
                          onClick={()=>setEventoVer(ev)}
                          onMouseEnter={e=>(e.currentTarget.style.color="#fff")}
                          onMouseLeave={e=>(e.currentTarget.style.color="var(--gfi-text-muted)")}>
                          Ver evento
                        </button>
                        {(esAdmin || ev.organizador_id === userId) && (
                          <button style={{padding:"5px 10px",background:"rgba(58,186,182,0.1)",border:"1px solid rgba(58,186,182,0.3)",borderRadius:3,color:"var(--gfi-teal-text)",fontFamily:"var(--font-display)",fontSize:8,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer"}}
                            onClick={()=>abrirInscriptos(ev)}>
                            👥 Inscriptos{ev.total_inscriptos?` (${ev.total_inscriptos})`:""}
                          </button>
                        )}
                        {ev.link_reunion&&!pasado&&<a href={ev.link_reunion} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"#4ab8d8",textDecoration:"none",fontFamily:"var(--font-display)",fontWeight:700}}>Unirse</a>}
                        {esAdmin&&ev.estado==="publicado"&&(
                          <button
                            onClick={() => publicarEventoEnRedes(ev)}
                            disabled={publicandoEvento === ev.id}
                            style={{padding:"5px 10px",background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:3,color:"#3b82f6",fontFamily:"var(--font-display)",fontSize:8,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap"}}>
                            {publicandoEvento === ev.id ? "..." : "📤 Redes"}
                          </button>
                        )}
                        {esAdmin&&ev.estado==="publicado"&&eventoRedesResult[ev.id]&&(
                          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                            {eventoRedesResult[ev.id].map(r => (
                              <span key={r.red} style={{fontSize:8,fontFamily:"var(--font-display)",fontWeight:700,padding:"2px 5px",borderRadius:3,letterSpacing:"0.06em",textTransform:"uppercase",background:r.ok?"rgba(34,197,94,0.12)":"rgba(200,0,0,0.12)",border:`1px solid ${r.ok?"rgba(34,197,94,0.3)":"rgba(200,0,0,0.3)"}`,color:r.ok?"#3abab6":"#f87171"}}>
                                {r.red} {r.ok ? "✓" : "✗"}
                              </span>
                            ))}
                          </div>
                        )}
                        {esAdmin&&!pasado&&<button className="ev-btn-cancelar-ev" onClick={()=>cancelarEvento(ev.id)}>Cancelar</button>}
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
              <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 4, padding: "10px 14px", marginBottom: 16 }}>
                💡 Tu propuesta será revisada por el admin antes de publicarse.
              </div>
            )}

            {!mostrarParser ? (
              <button type="button"
                style={{width:"100%",padding:"10px 14px",background:"rgba(200,0,0,0.06)",border:"1px dashed rgba(200,0,0,0.3)",borderRadius:6,color:"rgba(200,0,0,0.8)",fontFamily:"var(--font-display)",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",marginBottom:16}}
                onClick={() => setMostrarParser(true)}>
                Pegar texto de WhatsApp / mail — autocompletar con IA
              </button>
            ) : (
              <div style={{background:"rgba(200,0,0,0.04)",border:"1px solid rgba(200,0,0,0.15)",borderRadius:6,padding:16,marginBottom:16}}>
                <div style={{fontFamily:"var(--font-display)",fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(200,0,0,0.7)",marginBottom:8}}>
                  Parser IA — Pega el texto del evento
                </div>
                <textarea
                  style={{width:"100%",minHeight:120,padding:"10px 12px",background:"var(--gfi-border-subtle)",border:"1px solid var(--gfi-border)",borderRadius:4,color:"#fff",fontSize:12,fontFamily:"var(--font-body)",outline:"none",resize:"vertical"}}
                  placeholder={"Pega aca el texto del evento (Ctrl+V)...\n\nTambien podes pegar una imagen del portapapeles."}
                  value={textoParser}
                  onChange={e => setTextoParser(e.target.value)}
                  onPaste={handlePasteImagen}
                  autoFocus
                />
                {imagenParser && (
                  <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                    <img src={imagenParser} alt="preview" style={{width:60,height:60,objectFit:"cover",borderRadius:4,border:"1px solid var(--gfi-border)"}} />
                    <span style={{fontSize:11,color:"var(--gfi-text-muted)"}}>Imagen detectada — se usara como imagen del evento</span>
                    <button type="button" onClick={() => setImagenParser(null)} style={{background:"transparent",border:"none",color:"var(--gfi-text-muted)",cursor:"pointer",fontSize:14}}>x</button>
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
                <div style={{fontSize:10,color:"var(--gfi-text-dim)",marginTop:8,fontStyle:"italic"}}>
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
            {/* ── DURACIÓN ── */}
            <div className="ev-field">
              <label className="ev-label">Duración del evento</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "unico",      label: "Un día" },
                  { key: "multidia",   label: "Varios días" },
                  { key: "recurrente", label: "Sesiones / clases" },
                ].map(op => (
                  <button key={op.key} type="button"
                    style={{ flex: 1, padding: "8px 6px", background: modoFecha === op.key ? "rgba(200,0,0,0.12)" : "var(--gfi-bg-card)", border: `1px solid ${modoFecha === op.key ? "rgba(200,0,0,0.5)" : "var(--gfi-border)"}`, borderRadius: 4, color: modoFecha === op.key ? "#fff" : "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}
                    onClick={() => setModoFecha(op.key as "unico"|"multidia"|"recurrente")}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {modoFecha === "multidia" && (
              <>
                <div className="ev-field">
                  <label className="ev-label">Descripción del período <small style={{ opacity: 0.5, fontWeight: 400, textTransform: "none" }}>opcional — ej: "3 jornadas intensivas"</small></label>
                  <input className="ev-input" value={form.recurrencia_desc} onChange={e => setF("recurrencia_desc", e.target.value)} placeholder="3 jornadas, Congreso de 2 días, etc." />
                </div>
                <div className="ev-row2">
                  <div className="ev-field">
                    <label className="ev-label">Fecha de fin *</label>
                    <input className="ev-input" type="date" value={form.fecha_fin} onChange={e => setF("fecha_fin", e.target.value)} min={form.fecha} />
                  </div>
                  <div className="ev-field">
                    <label className="ev-label">Hora de cierre</label>
                    <input className="ev-input" type="time" value={form.hora_fin} onChange={e => setF("hora_fin", e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {modoFecha === "recurrente" && (
              <>
                <div className="ev-field">
                  <label className="ev-label">Descripción del ciclo <small style={{ opacity: 0.5, fontWeight: 400, textTransform: "none" }}>ej: "últimos 4 miércoles del mes"</small></label>
                  <input className="ev-input" value={form.recurrencia_desc} onChange={e => setF("recurrencia_desc", e.target.value)} placeholder="Ej: 4 miércoles, ciclo de 3 encuentros mensuales..." />
                </div>
                <div className="ev-field">
                  <label className="ev-label">Fechas de cada sesión</label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input className="ev-input" type="date" value={nuevaFechaRec} onChange={e => setNuevaFechaRec(e.target.value)} style={{ flex: 1 }} />
                    <button type="button" onClick={() => { if (nuevaFechaRec && !fechasRec.includes(nuevaFechaRec)) { setFechasRec(p => [...p, nuevaFechaRec].sort()); setNuevaFechaRec(""); } }}
                      style={{ padding: "8px 14px", background: "#990000", border: "none", borderRadius: 4, color: "#fff", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                      + Agregar
                    </button>
                  </div>
                  {fechasRec.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {fechasRec.map(f => (
                        <div key={f} style={{ background: "rgba(200,0,0,0.08)", border: "1px solid rgba(200,0,0,0.25)", borderRadius: 4, padding: "4px 10px", fontSize: 12, color: "var(--gfi-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                          {new Date(f + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}
                          <button type="button" onClick={() => setFechasRec(p => p.filter(x => x !== f))} style={{ background: "transparent", border: "none", color: "var(--gfi-text-muted)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {fechasRec.length === 0 && <div style={{ fontSize: 11, color: "var(--gfi-text-dim)", fontStyle: "italic" }}>Agregá al menos una fecha de sesión</div>}
                </div>
              </>
            )}

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
                  <input type="checkbox" checked={form.destacado} onChange={e => setF("destacado", e.target.checked)} style={{ accentColor: "#990000" }} />
                  <span style={{ fontSize: 12, color: "var(--gfi-text-secondary)" }}>⭐ Marcar como destacado</span>
                </label>
              </div>
            )}

            {/* ── FOTOS Y VIDEOS ── */}
            <div className="ev-seccion-titulo">Fotos y videos</div>

            {/* Drop zone fotos */}
            <div className="ev-field">
              <label className="ev-label">Fotos (flyer, lugar, etc.) — varias a la vez</label>
              <label
                style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"var(--gfi-bg-card)",border:"2px dashed var(--gfi-border)",borderRadius:6,cursor:"pointer",transition:"all 0.2s"}}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(200,0,0,0.5)"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = "var(--gfi-border)"; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gfi-border)"; if (e.dataTransfer.files) subirFotos(e.dataTransfer.files); }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(200,0,0,0.3)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--gfi-border)"}
              >
                <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={e => e.target.files && subirFotos(e.target.files)} />
                <span style={{fontSize:28}}>📷</span>
                <div>
                  <div style={{fontSize:13,color:"var(--gfi-text-primary)",fontWeight:500}}>
                    {subiendoFoto ? "⏳ Subiendo fotos..." : "Seleccionar o arrastrar fotos"}
                  </div>
                  <div style={{fontSize:11,color:"var(--gfi-text-muted)",marginTop:2}}>JPG, PNG, WEBP · Podés seleccionar varias a la vez</div>
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
              <div style={{fontSize:10,color:"var(--gfi-text-dim)",marginTop:4}}>
                Pegá el link y presioná Enter o el botón. Repetí para cada video.
              </div>
            </div>

            {/* Galería preview */}
            {media.length > 0 && (
              <div style={{marginTop:4}}>
                <div style={{fontSize:10,fontFamily:"var(--font-display)",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--gfi-text-dim)",marginBottom:8}}>
                  {media.filter(m => m.tipo === "foto").length} foto{media.filter(m => m.tipo === "foto").length !== 1 ? "s" : ""} · {media.filter(m => m.tipo === "video").length} video{media.filter(m => m.tipo === "video").length !== 1 ? "s" : ""}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(88px,1fr))",gap:8}}>
                  {media.map((m, i) => (
                    <div key={i} style={{position:"relative",borderRadius:6,overflow:"hidden",border:"1px solid var(--gfi-border)",aspectRatio:"1",background:"rgba(0,0,0,0.4)",minHeight:88}}>
                      {m.tipo === "foto" ? (
                        <img
                          src={m.url}
                          crossOrigin="anonymous"
                          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",display:"block"}}
                          alt=""
                          onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                        />
                      ) : (
                        <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:3,padding:4}}>
                          {m.thumb
                            ? <img src={m.thumb} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.5}} alt="" />
                            : null}
                          <span style={{fontSize:22,position:"relative",zIndex:1}}>▶️</span>
                          <span style={{fontSize:8,color:"var(--gfi-text-secondary)",textAlign:"center",position:"relative",zIndex:1,lineHeight:1.2,wordBreak:"break-all"}}>
                            {m.url.includes("youtube") ? "YouTube" : m.url.includes("instagram") ? "Instagram" : m.url.includes("tiktok") ? "TikTok" : "Video"}
                          </span>
                        </div>
                      )}
                      {/* Badge tipo */}
                      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.65)",padding:"2px 4px",fontSize:9,color:"var(--gfi-text-primary)",textAlign:"center",fontFamily:"var(--font-display)",fontWeight:700}}>
                        {m.tipo === "foto" ? "📷 Foto" : "🎬 Video"}
                      </div>
                      {/* Botón quitar */}
                      <button type="button"
                        style={{position:"absolute",top:4,right:4,background:"rgba(200,0,0,0.85)",border:"none",borderRadius:"50%",width:22,height:22,color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,fontWeight:700}}
                        onClick={() => quitarMedia(i)}>&times;</button>
                      {/* Primera foto = portada */}
                      {i === 0 && m.tipo === "foto" && (
                        <div style={{position:"absolute",top:4,left:4,background:"rgba(200,0,0,0.85)",padding:"2px 6px",borderRadius:3,fontSize:8,color:"#fff",fontFamily:"var(--font-display)",fontWeight:700}}>
                          PORTADA
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:"var(--gfi-text-dim)",marginTop:6,fontStyle:"italic"}}>
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
                <div style={{fontSize:14,color:"var(--gfi-text-primary)",textAlign:"center",maxWidth:320}}>
                  Instagram no permite reproducción embebida.<br/>
                  <a href={lightbox} target="_blank" rel="noopener noreferrer"
                    style={{color:"#990000",fontWeight:700,fontFamily:"var(--font-display)",textDecoration:"none",marginTop:12,display:"inline-block"}}>
                    Abrir en Instagram →
                  </a>
                </div>
              </div>
            ) : lightbox.includes("tiktok.com") ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{fontSize:48}}>🎵</div>
                <div style={{fontSize:14,color:"var(--gfi-text-primary)",textAlign:"center",maxWidth:320}}>
                  TikTok no permite reproducción embebida.<br/>
                  <a href={lightbox} target="_blank" rel="noopener noreferrer"
                    style={{color:"#990000",fontWeight:700,fontFamily:"var(--font-display)",textDecoration:"none",marginTop:12,display:"inline-block"}}>
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
                  style={{color:"#990000",fontWeight:700,fontFamily:"var(--font-display)",textDecoration:"none",fontSize:14}}>
                  Abrir video →
                </a>
              </div>
            )}

            <button
              style={{position:"fixed",top:16,right:16,width:36,height:36,borderRadius:"50%",background:"rgba(200,0,0,0.9)",border:"none",color:"#fff",fontSize:18,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}
              onClick={() => setLightbox(null)}>&times;</button>
          </div>
        </div>
      )}

      {/* MODAL VER EVENTO */}
      {modalInscriptos && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalInscriptos(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--gfi-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "var(--gfi-text-primary)" }}>Inscriptos</div>
                  <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 2 }}>{modalInscriptos.titulo}</div>
                </div>
                <button onClick={() => setModalInscriptos(null)} style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>
              <div style={{ fontSize: 12, color: "var(--gfi-text-secondary)", marginTop: 8 }}>
                {inscriptos.length} inscripto{inscriptos.length === 1 ? "" : "s"} · {inscriptos.filter(i => i.asistio).length} asistieron
              </div>
            </div>

            {/* Agregar persona (último momento) */}
            <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--gfi-border-subtle)", position: "relative" }}>
              <input value={buscarPerfil} onChange={e => setBuscarPerfil(e.target.value)} placeholder="Agregar inscripto: buscá por nombre o apellido…"
                style={{ width: "100%", background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border)", borderRadius: 6, color: "var(--gfi-text-primary)", padding: "8px 12px", fontSize: 13 }} />
              {resultadosPerfil.length > 0 && (
                <div style={{ position: "absolute", left: 22, right: 22, background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border)", borderRadius: 6, marginTop: 4, zIndex: 10, maxHeight: 220, overflowY: "auto" }}>
                  {resultadosPerfil.map(p => (
                    <div key={p.id} onClick={() => agregarInscripto(modalInscriptos, p.id)}
                      style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, color: "var(--gfi-text-primary)", borderBottom: "1px solid var(--gfi-border-subtle)" }}>
                      {p.apellido}, {p.nombre} {p.matricula ? <span style={{ color: "var(--gfi-text-muted)", fontSize: 11 }}>· Mat. {p.matricula}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 22px 18px" }}>
              {cargandoIns ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--gfi-text-muted)", fontSize: 13 }}>Cargando…</div>
              ) : inscriptos.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--gfi-text-muted)", fontSize: 13 }}>Todavía no hay inscriptos.</div>
              ) : inscriptos.map(i => {
                const p = Array.isArray(i.perfiles) ? i.perfiles[0] : i.perfiles;
                const tel = (p?.telefono ?? "").replace(/\D/g, "");
                return (
                  <div key={i.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--gfi-border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="checkbox" checked={!!i.asistio} onChange={e => toggleAsistio(i.id, e.target.checked)} title="Marcar asistencia" style={{ width: 18, height: 18, cursor: "pointer", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gfi-text-primary)" }}>
                          {p ? `${p.apellido ?? ""}, ${p.nombre ?? ""}`.replace(/^, |, $/g, "") : "—"}
                          {i.agregado_por ? <span style={{ fontSize: 10, color: "var(--gfi-gold-text)", marginLeft: 6 }}>agregado</span> : null}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>
                          {[p?.telefono, p?.matricula ? `Mat. ${p.matricula}` : null].filter(Boolean).join(" · ") || "sin contacto"}
                        </div>
                      </div>
                      {tel && <a href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" style={{ fontSize: 16, textDecoration: "none", flexShrink: 0 }}>💬</a>}
                      <button onClick={() => quitarInscripto(i.id, modalInscriptos.id)} title="Quitar" style={{ background: "none", border: "none", color: "var(--gfi-red)", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>
                    </div>
                    {/* Pago: casilla de verificación (acreditado) + monto transferido */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, paddingLeft: 30 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: i.pago ? "var(--gfi-teal-text)" : "var(--gfi-text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="checkbox" checked={!!i.pago} onChange={e => togglePago(i.id, e.target.checked)} style={{ width: 14, height: 14, cursor: "pointer" }} />
                        {i.pago ? "✓ Acreditado" : "Pago acreditado"}
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--gfi-text-dim)" }}>$</span>
                        <input type="text" inputMode="decimal" defaultValue={i.monto_pagado != null ? String(i.monto_pagado) : ""}
                          onBlur={e => { if ((e.target.value.trim() || "0") !== String(i.monto_pagado ?? "")) guardarMontoPagado(i.id, e.target.value); }}
                          placeholder="monto transferido"
                          style={{ width: 130, background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border)", borderRadius: 5, color: "var(--gfi-text-primary)", padding: "5px 8px", fontSize: 12 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Finanzas del evento: recaudado + gasto → saldo general */}
            {(() => {
              const recaudado = inscriptos.reduce((s, i) => s + (i.pago ? Number(i.monto_pagado ?? 0) : 0), 0);
              const gasto = gastoEvento.trim() === "" ? 0 : parseFloat(gastoEvento.replace(/[^\d.]/g, "")) || 0;
              const saldo = recaudado - gasto;
              const mon = modalInscriptos.moneda ?? "ARS";
              const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
              return (
                <div style={{ borderTop: "1px solid var(--gfi-border)", padding: "14px 22px", background: "var(--gfi-bg-card)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Gasto del evento</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--gfi-text-dim)" }}>$</span>
                      <input type="text" inputMode="decimal" value={gastoEvento}
                        onChange={e => setGastoEvento(e.target.value)}
                        onBlur={e => guardarGasto(modalInscriptos, e.target.value)}
                        placeholder="0" disabled={!!modalInscriptos.finanzas_pasadas}
                        style={{ width: 150, background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border)", borderRadius: 5, color: "var(--gfi-text-primary)", padding: "6px 9px", fontSize: 13 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12, fontSize: 13 }}>
                    <div><span style={{ color: "var(--gfi-text-muted)" }}>Recaudado</span><div style={{ color: "var(--gfi-teal-text)", fontWeight: 700, fontSize: 15 }}>$ {fmt(recaudado)}</div></div>
                    <div><span style={{ color: "var(--gfi-text-muted)" }}>Gasto</span><div style={{ color: "#f87171", fontWeight: 700, fontSize: 15 }}>$ {fmt(gasto)}</div></div>
                    <div style={{ textAlign: "right" }}><span style={{ color: "var(--gfi-text-muted)" }}>Saldo</span><div style={{ color: saldo >= 0 ? "var(--gfi-teal-text)" : "#f87171", fontWeight: 800, fontSize: 15 }}>$ {fmt(saldo)} {mon}</div></div>
                  </div>
                  {esAdmin && (
                    modalInscriptos.finanzas_pasadas ? (
                      <div style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "var(--gfi-teal-text)", fontWeight: 700 }}>✓ Ya registrado en finanzas generales</div>
                    ) : (
                      <button onClick={() => pasarAFinanzas(modalInscriptos, recaudado, gasto)} disabled={pasandoFin}
                        style={{ width: "100%", marginTop: 12, padding: "9px", background: "#990000", border: "none", borderRadius: 5, color: "#fff", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: pasandoFin ? "not-allowed" : "pointer", opacity: pasandoFin ? 0.6 : 1 }}>
                        {pasandoFin ? "Registrando…" : "💰 Pasar saldo a finanzas generales"}
                      </button>
                    )
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL INSCRIBIRSE — formulario que actualiza la base del Foro */}
      {modalInscribir && (
        <div onClick={e => { if (e.target === e.currentTarget && !inscribiendo) setModalInscribir(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 3100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="ev-modal" style={{ maxWidth: 480 }}>
            <div className="ev-modal-titulo">Inscribirme a <span>{modalInscribir.titulo}</span></div>
            <p style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: -10, marginBottom: 16 }}>
              Confirmá tus datos. Si algo cambió, se actualiza también en tu perfil del Foro.
            </p>
            <div className="ev-row2">
              <div className="ev-field">
                <label className="ev-label">Nombre *</label>
                <input className="ev-input" value={formInscribir.nombre} onChange={e => setFI("nombre", e.target.value)} />
              </div>
              <div className="ev-field">
                <label className="ev-label">Apellido *</label>
                <input className="ev-input" value={formInscribir.apellido} onChange={e => setFI("apellido", e.target.value)} />
              </div>
            </div>
            <div className="ev-row2">
              <div className="ev-field">
                <label className="ev-label">Matrícula</label>
                <input className="ev-input" value={formInscribir.matricula} onChange={e => setFI("matricula", e.target.value)} />
              </div>
              <div className="ev-field">
                <label className="ev-label">Celular</label>
                <input className="ev-input" value={formInscribir.telefono} onChange={e => setFI("telefono", e.target.value)} placeholder="Ej: 341..." />
              </div>
            </div>
            <div className="ev-field">
              <label className="ev-label">Email</label>
              <input className="ev-input" type="email" value={formInscribir.email} onChange={e => setFI("email", e.target.value)} />
            </div>
            <div className="ev-field">
              <label className="ev-label">Inmobiliaria</label>
              <input className="ev-input" value={formInscribir.inmobiliaria} onChange={e => setFI("inmobiliaria", e.target.value)} />
            </div>
            <div className="ev-modal-actions">
              <button className="ev-btn-cancel" onClick={() => setModalInscribir(null)} disabled={inscribiendo}>Cancelar</button>
              <button className="ev-btn-guardar" onClick={() => confirmarInscripcion(modalInscribir)} disabled={inscribiendo}>
                {inscribiendo ? "Inscribiendo…" : "Confirmar inscripción"}
              </button>
            </div>
          </div>
        </div>
      )}

      {eventoVer && (() => {
        const ev = eventoVer;
        const f = formatFecha(ev.fecha);
        const pasado = !esProximo(ev.fecha);
        const lleno = ev.capacidad !== null && (ev.total_inscriptos ?? 0) >= ev.capacidad;
        const pct = capacidadPct(ev.total_inscriptos ?? 0, ev.capacidad);
        const tipo = TIPOS[ev.tipo] ?? TIPOS.externo;
        const fotos = ev.media && Array.isArray(ev.media) ? (ev.media as MediaItem[]).filter((m:MediaItem) => m.tipo==="foto") : [];
        const videos = ev.media && Array.isArray(ev.media) ? (ev.media as MediaItem[]).filter((m:MediaItem) => m.tipo==="video") : [];
        const portada = fotos[0] ?? null;
        return (
          <div className="ev-modal-bg" onClick={e=>{ if (e.target===e.currentTarget) setEventoVer(null); }}>
            <div className="ev-modal" style={{maxWidth:680,padding:0,overflow:"hidden"}}>
              {/* Imagen portada */}
              {portada ? (
                <div style={{position:"relative",width:"100%",maxHeight:340,background:"#000",overflow:"hidden",cursor:"zoom-in"}}
                  onClick={()=>setLightbox(portada.url)}>
                  <img src={portada.url} alt={ev.titulo}
                    style={{width:"100%",maxHeight:340,objectFit:"contain",objectPosition:"center",display:"block"}}
                    onError={e=>{(e.target as HTMLImageElement).style.display="none";}} />
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 60%,rgba(0,0,0,0.7))"}} />
                  {fotos.length > 1 && (
                    <div style={{position:"absolute",bottom:10,right:12,display:"flex",gap:4}}>
                      {fotos.slice(1,4).map((m:MediaItem,i:number)=>(
                        <div key={i} style={{width:44,height:44,borderRadius:4,overflow:"hidden",border:"1.5px solid var(--gfi-text-muted)",cursor:"zoom-in",flexShrink:0}}
                          onClick={e=>{e.stopPropagation();setLightbox(m.url);}}>
                          <img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />
                        </div>
                      ))}
                      {fotos.length > 4 && (
                        <div style={{width:44,height:44,borderRadius:4,background:"rgba(0,0,0,0.7)",border:"1.5px solid var(--gfi-text-muted)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:800,fontFamily:"var(--font-display)"}}>
                          +{fotos.length-4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : videos.length > 0 ? (
                <div style={{position:"relative",width:"100%",height:220,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}
                  onClick={()=>setLightbox(videos[0].url)}>
                  {videos[0].thumb && <img src={videos[0].thumb} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.4}} alt="" />}
                  <span style={{fontSize:48,position:"relative",zIndex:1}}>▶️</span>
                </div>
              ) : null}

              <div style={{padding:"24px 28px 28px"}}>
                {/* Badges */}
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                  <span className="ev-badge" style={{color:tipo.color,background:tipo.bg,borderColor:tipo.border}}>{tipo.label}</span>
                  <span className="ev-badge" style={{color:ev.gratuito?"#3abab6":"#d4960c",background:ev.gratuito?"rgba(34,197,94,0.08)":"rgba(234,179,8,0.08)",borderColor:ev.gratuito?"rgba(34,197,94,0.2)":"rgba(234,179,8,0.2)"}}>
                    {ev.gratuito?"Gratuito":ev.precio_entrada?`$${ev.precio_entrada.toLocaleString("es-AR")}`:"Con costo"}
                  </span>
                  {ev.plataforma&&ev.plataforma!=="presencial"&&(
                    <span className="ev-badge" style={{color:"#4ab8d8",background:"rgba(74,184,216,0.08)",borderColor:"rgba(74,184,216,0.2)"}}>
                      {PLATAFORMAS[ev.plataforma]??"🎥"} Online
                    </span>
                  )}
                  {ev.destacado&&<span className="ev-badge" style={{color:"#d4960c",background:"rgba(245,158,11,0.08)",borderColor:"rgba(245,158,11,0.2)"}}>⭐ Destacado</span>}
                </div>

                {/* Título */}
                <div style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:800,color:"#fff",lineHeight:1.3,marginBottom:14}}>{ev.titulo}</div>

                {/* Meta */}
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--gfi-text-secondary)"}}>
                    <span>🗓️</span><span>{f.dia} a las {f.hora}hs</span>
                  </div>
                  {ev.lugar&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--gfi-text-secondary)"}}>
                      <span>📍</span><span>{ev.lugar}</span>
                      {ev.lugar_url&&<a href={ev.lugar_url} target="_blank" rel="noopener noreferrer" style={{color:"#990000",fontSize:11,fontWeight:700,fontFamily:"var(--font-display)",textDecoration:"none"}}>Ver mapa →</a>}
                    </div>
                  )}
                  {ev.link_reunion&&!pasado&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--gfi-text-secondary)"}}>
                      <span>🔗</span>
                      <a href={ev.link_reunion} target="_blank" rel="noopener noreferrer" style={{color:"#4ab8d8",fontWeight:700,fontFamily:"var(--font-display)",textDecoration:"none",fontSize:13}}>Unirse online →</a>
                    </div>
                  )}
                </div>

                {/* Descripción */}
                {ev.descripcion && (
                  <div style={{fontSize:14,color:"var(--gfi-text-primary)",lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:18,padding:"14px 16px",background:"var(--gfi-bg-card)",border:"1px solid var(--gfi-border-subtle)",borderRadius:6}}>
                    {ev.descripcion}
                  </div>
                )}

                {/* Videos */}
                {videos.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:10,fontFamily:"var(--font-display)",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--gfi-text-dim)",marginBottom:8}}>Videos</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {videos.map((v:MediaItem,i:number)=>(
                        <button key={i} type="button"
                          style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:"rgba(74,184,216,0.08)",border:"1px solid rgba(74,184,216,0.2)",borderRadius:4,color:"#4ab8d8",fontFamily:"var(--font-display)",fontSize:10,fontWeight:700,cursor:"pointer"}}
                          onClick={()=>setLightbox(v.url)}>
                          ▶️ Ver video {videos.length>1?i+1:""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Capacidad */}
                {ev.capacidad!==null&&(
                  <div style={{marginBottom:16}}>
                    <div className="ev-cap-bar-wrap"><div className="ev-cap-bar" style={{width:`${pct}%`,background:pct>=90?"#f87171":pct>=70?"#d4960c":"#3abab6"}} /></div>
                    <div className="ev-cap-texto">{ev.total_inscriptos} / {ev.capacidad} inscriptos{lleno?" · COMPLETO":""}</div>
                  </div>
                )}

                {/* Acciones */}
                <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",borderTop:"1px solid var(--gfi-border-subtle)",paddingTop:18}}>
                  {!pasado&&(
                    procesando===ev.id ? <span className="ev-spinner" /> :
                    !ev.gratuito&&!ev.inscripto ? (
                      ev.link_externo
                        ?<button className="ev-btn-ins libre" style={{fontSize:11,padding:"10px 20px"}} onClick={()=>window.open(ev.link_externo!,"_blank","noopener,noreferrer")}>Pago externo</button>
                        :<span style={{fontSize:12,color:"var(--gfi-text-muted)",fontWeight:700}}>💰 {ev.precio_entrada?.toLocaleString("es-AR")} {ev.moneda??""}</span>
                    ) : (
                      <button className={`ev-btn-ins ${ev.inscripto?"inscripto":lleno?"lleno":"libre"}`}
                        style={{fontSize:11,padding:"10px 20px"}}
                        disabled={lleno&&!ev.inscripto}
                        onClick={()=>{
                          if (lleno && !ev.inscripto) return;
                          if (ev.inscripto) { toggleInscripcion(ev.id,true,ev.capacidad,ev.total_inscriptos??0); return; }
                          if (ev.link_externo) window.open(ev.link_externo,"_blank","noopener,noreferrer");
                          setEventoVer(null);
                          abrirInscribir(ev);
                        }}>
                        {ev.inscripto?"✓ Inscripto":lleno?"Completo":"Inscribirse"}
                      </button>
                    )
                  )}
                  {ev.link_externo&&(
                    <a href={ev.link_externo} target="_blank" rel="noopener noreferrer"
                      style={{padding:"9px 16px",border:"1px solid rgba(200,0,0,0.3)",borderRadius:3,color:"#990000",fontFamily:"var(--font-display)",fontSize:10,fontWeight:700,textDecoration:"none",letterSpacing:"0.1em",textTransform:"uppercase"}}>
                      🔗 Link inscripción
                    </a>
                  )}
                  <button className="ev-btn-cancel" style={{marginLeft:"auto"}} onClick={()=>setEventoVer(null)}>Cerrar</button>
                </div>
              </div>

              {/* Botón cerrar X */}
              <button style={{position:"absolute",top:12,right:12,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.7)",border:"1px solid var(--gfi-border)",color:"var(--gfi-text-primary)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}
                onClick={()=>setEventoVer(null)}>&times;</button>
            </div>
          </div>
        );
      })()}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
