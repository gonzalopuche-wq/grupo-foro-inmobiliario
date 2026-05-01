"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Propiedad {
  id: string;
  perfil_id: string;
  codigo: string | null;
  titulo: string;
  descripcion: string | null;
  descripcion_privada: string | null;
  comentarios_colegas: string | null;
  aviso_legal: string | null;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string;
  expensas: number | null;
  moneda_expensas: string | null;
  ciudad: string | null;
  zona: string | null;
  direccion: string | null;
  direccion_orientativa: string | null;
  codigo_postal: string | null;
  sector: string | null;
  manzana: string | null;
  ocultar_ubicacion: boolean;
  latitud: number | null;
  longitud: number | null;
  dormitorios: number | null;
  banos: number | null;
  banos_servicio: number | null;
  ambientes: number | null;
  estacionamientos: number | null;
  anio_construccion: number | null;
  piso: string | null;
  numero_unidad: string | null;
  numero_torre: string | null;
  pisos_edificio: number | null;
  departamentos_por_piso: number | null;
  bauleras: number | null;
  disposicion: string | null;
  orientacion: string | null;
  tipo_departamento: string | null;
  luminosidad: string | null;
  condicion: string | null;
  antiguedad: string | null;
  superficie_cubierta: number | null;
  superficie_total: number | null;
  sup_semicubierta: number | null;
  sup_descubierta: number | null;
  sup_exclusiva: number | null;
  sup_espacios_comunes: number | null;
  sup_patio_terraza: number | null;
  sup_balcon: number | null;
  metros_frente: number | null;
  metros_fondo: number | null;
  apto_credito: boolean;
  con_cochera: boolean;
  amoblado: boolean;
  habitada: boolean;
  acepta_permuta: boolean;
  acepta_mascotas: boolean;
  barrio_cerrado: boolean;
  uso_comercial: boolean;
  energia_solar: boolean;
  ocultar_precio: boolean;
  ocultar_de_redes: boolean;
  ocultar_web: boolean;
  honorario_compartir: string | null;
  honorario_propietario: number | null;
  honorario_comprador: number | null;
  video_url: string | null;
  fotos: string[] | null;
  amenities: string[] | null;
  estado: string;
  destacada_web: boolean;
  publicada_web: boolean;
  // Ambientes
  amb_balcon: boolean; amb_terraza: boolean; amb_patio: boolean;
  amb_jardin: boolean; amb_parrilla: boolean; amb_living: boolean;
  amb_comedor: boolean; amb_comedor_diario: boolean; amb_cocina: boolean;
  amb_estudio: boolean; amb_vestidor: boolean; amb_lavadero: boolean;
  amb_sotano: boolean; amb_roof_garden: boolean; amb_playroom: boolean;
  amb_dep_servicio: boolean; amb_dorm_suite: boolean;
  // Comodidades
  com_pileta: boolean; com_gimnasio: boolean; com_sum: boolean;
  com_sala_juegos: boolean; com_solarium: boolean; com_hidromasaje: boolean;
  com_ascensor: boolean; com_seguridad: boolean; com_internet: boolean;
  com_aire_acondicionado: boolean; com_calefaccion: boolean; com_cowork: boolean;
  com_cancha_tenis: boolean; com_jacuzzi: boolean; com_lavanderia: boolean;
  com_salon_fiestas: boolean; com_juegos_infantiles: boolean;
  com_estac_visitantes: boolean; com_cancha_paddle: boolean;
  com_cancha_futbol: boolean; com_quincho: boolean; com_grupo_electrogeno: boolean;
  created_at: string;
  updated_at: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────
const OPERACIONES = ["Venta", "Alquiler", "Alquiler temporal"];
const TIPOS = ["Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Cochera", "Galpon", "Otro"];
const ESTADOS = [
  { value: "activa", label: "ACTIVA", color: "#22c55e" },
  { value: "reservada", label: "RESERVADA", color: "#f59e0b" },
  { value: "vendida", label: "VENDIDA", color: "#6b7280" },
  { value: "pausada", label: "PAUSADA", color: "#ef4444" },
];
const CONDICIONES = ["A estrenar", "Muy bueno", "Bueno", "Regular", "A reciclar"];
const ORIENTACIONES = ["Norte", "Sur", "Este", "Oeste", "Noreste", "Noroeste", "Sureste", "Suroeste"];
const DISPOSICIONES = ["Frente", "Contrafrente", "Lateral", "Interno"];
const TIPOS_DEPTO = ["Monoambiente", "1 ambiente", "2 ambientes", "3 ambientes", "4 ambientes", "5+ ambientes", "Duplex", "Triplex"];
const HONORARIOS_COMPARTIR = ["No comparte", "50%", "40%", "30%"];
const MAX_FOTOS = 20;

const AMBIENTES_LIST = [
  { key: "amb_balcon", label: "Balcón" }, { key: "amb_terraza", label: "Terraza" },
  { key: "amb_patio", label: "Patio" }, { key: "amb_jardin", label: "Jardín" },
  { key: "amb_parrilla", label: "Parrilla" }, { key: "amb_living", label: "Living" },
  { key: "amb_comedor", label: "Comedor" }, { key: "amb_comedor_diario", label: "Comedor diario" },
  { key: "amb_cocina", label: "Cocina" }, { key: "amb_estudio", label: "Estudio" },
  { key: "amb_vestidor", label: "Vestidor" }, { key: "amb_lavadero", label: "Lavadero" },
  { key: "amb_sotano", label: "Sótano" }, { key: "amb_roof_garden", label: "Roof garden" },
  { key: "amb_playroom", label: "Playroom" }, { key: "amb_dep_servicio", label: "Dep. de servicio" },
  { key: "amb_dorm_suite", label: "Dormitorio en suite" },
];

const COMODIDADES_LIST = [
  { key: "com_pileta", label: "Pileta" }, { key: "com_gimnasio", label: "Gimnasio" },
  { key: "com_sum", label: "SUM" }, { key: "com_salon_fiestas", label: "Salón de fiestas" },
  { key: "com_sala_juegos", label: "Sala de juegos" }, { key: "com_solarium", label: "Solarium" },
  { key: "com_hidromasaje", label: "Hidromasaje" }, { key: "com_jacuzzi", label: "Jacuzzi" },
  { key: "com_ascensor", label: "Ascensor" }, { key: "com_seguridad", label: "Seguridad/Vigilancia" },
  { key: "com_internet", label: "Internet/WiFi" }, { key: "com_aire_acondicionado", label: "Aire acondicionado" },
  { key: "com_calefaccion", label: "Calefacción" }, { key: "com_cowork", label: "Cowork" },
  { key: "com_cancha_tenis", label: "Cancha de tenis" }, { key: "com_cancha_paddle", label: "Cancha de paddle" },
  { key: "com_cancha_futbol", label: "Cancha de fútbol" }, { key: "com_lavanderia", label: "Lavandería" },
  { key: "com_juegos_infantiles", label: "Juegos infantiles" }, { key: "com_estac_visitantes", label: "Estac. visitantes" },
  { key: "com_quincho", label: "Quincho" }, { key: "com_grupo_electrogeno", label: "Grupo electrógeno" },
];

const FORM_VACIO: any = {
  // Paso 1
  titulo: "", tipo: "Departamento", estado: "activa", codigo: "",
  // Paso 7 — documentación
  contacto_propietario_id: "", ci_url: "", ci_fecha_obtencion: "", ci_fecha_vencimiento: "",
  ci_numero: "", ci_observaciones: "", escritura_url: "", plano_url: "", reglamento_url: "",
  api_ninios: false, api_ninios_numero: "", url_portal_origen: "",
  // Paso 2
  operacion: "Venta", precio: "", moneda: "USD",
  expensas: "", moneda_expensas: "ARS",
  ocultar_precio: false, ocultar_de_redes: false, ocultar_web: false,
  honorario_compartir: "No comparte", honorario_propietario: "", honorario_comprador: "",
  // Paso 3
  ciudad: "Rosario", zona: "", direccion: "", direccion_orientativa: "",
  codigo_postal: "", sector: "", manzana: "", ocultar_ubicacion: false,
  latitud: "", longitud: "",
  // Paso 4
  dormitorios: "", banos: "", banos_servicio: "", ambientes: "",
  estacionamientos: "", anio_construccion: "", piso: "", numero_unidad: "",
  numero_torre: "", pisos_edificio: "", departamentos_por_piso: "", bauleras: "",
  disposicion: "", orientacion: "", tipo_departamento: "", luminosidad: "",
  condicion: "", antiguedad: "",
  superficie_cubierta: "", superficie_total: "", sup_semicubierta: "",
  sup_descubierta: "", sup_exclusiva: "", sup_espacios_comunes: "",
  sup_patio_terraza: "", sup_balcon: "", metros_frente: "", metros_fondo: "",
  apto_credito: false, con_cochera: false, amoblado: false, habitada: false,
  acepta_permuta: false, acepta_mascotas: false, barrio_cerrado: false,
  uso_comercial: false, energia_solar: false,
  // Paso 5
  descripcion: "", descripcion_privada: "", comentarios_colegas: "", aviso_legal: "",
  video_url: "",
  // Paso 6 — ambientes
  amb_balcon: false, amb_terraza: false, amb_patio: false, amb_jardin: false,
  amb_parrilla: false, amb_living: false, amb_comedor: false, amb_comedor_diario: false,
  amb_cocina: false, amb_estudio: false, amb_vestidor: false, amb_lavadero: false,
  amb_sotano: false, amb_roof_garden: false, amb_playroom: false,
  amb_dep_servicio: false, amb_dorm_suite: false,
  // Paso 6 — comodidades
  com_pileta: false, com_gimnasio: false, com_sum: false, com_sala_juegos: false,
  com_solarium: false, com_hidromasaje: false, com_ascensor: false, com_seguridad: false,
  com_internet: false, com_aire_acondicionado: false, com_calefaccion: false,
  com_cowork: false, com_cancha_tenis: false, com_jacuzzi: false, com_lavanderia: false,
  com_salon_fiestas: false, com_juegos_infantiles: false, com_estac_visitantes: false,
  com_cancha_paddle: false, com_cancha_futbol: false, com_quincho: false,
  com_grupo_electrogeno: false,
};

const PASOS = [
  { n: 1, label: "Información básica", sub: "Título, tipo y estado" },
  { n: 2, label: "Operación y precios", sub: "Valores y visibilidad" },
  { n: 3, label: "Ubicación", sub: "Dirección y mapa" },
  { n: 4, label: "Características", sub: "Detalles y superficies" },
  { n: 5, label: "Descripción", sub: "Textos de la propiedad" },
  { n: 6, label: "Amenities", sub: "Características adicionales" },
  { n: 7, label: "Documentación / CI", sub: "Certificado de Inhibición y dueño" },
];

const fmt = (n: number | null) => n ? n.toLocaleString("es-AR") : "-";
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

function numOrNull(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function intOrNull(v: string): number | null {
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

// ── Componente principal ───────────────────────────────────────────────────
export default function CarteraPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroOp, setFiltroOp] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Modal wizard
  const [mostrarWizard, setMostrarWizard] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState<any>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  // Importar desde URL de portal
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [urlImport, setUrlImport] = useState("");
  const [importando, setImportando] = useState(false);
  const [importError, setImportError] = useState("");

  // Contactos CRM (para vincular propietario)
  const [contactosCRM, setContactosCRM] = useState<{id:string;nombre:string|null;apellido:string|null}[]>([]);

  // Fotos
  const [fotosNuevas, setFotosNuevas] = useState<File[]>([]);
  const [fotosExistentes, setFotosExistentes] = useState<string[]>([]);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const [progresoFotos, setProgresoFotos] = useState(0);

  // Sync
  const [syncData, setSyncData] = useState<Record<string, any>>({});
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  const [generandoDesc, setGenerandoDesc] = useState(false);
  const [tonoDesc, setTonoDesc] = useState<'profesional' | 'premium' | 'amigable' | 'vendedor'>('profesional');

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      // Cargar contactos CRM para vincular propietario
      const { data: ctcs } = await supabase
        .from("crm_contactos")
        .select("id,nombre,apellido")
        .eq("perfil_id", data.user.id)
        .order("nombre", { ascending: true });
      setContactosCRM(ctcs ?? []);
    };
    init();
  }, []);

  const cargar = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase.from("cartera_propiedades").select("*").eq("perfil_id", uid).order("updated_at", { ascending: false });
    const props = (data as Propiedad[]) ?? [];
    setPropiedades(props);
    if (props.length > 0) {
      const { data: syncs } = await supabase.from("cartera_sync_portales").select("*").in("propiedad_id", props.map(p => p.id));
      const m: Record<string, any> = {};
      (syncs ?? []).forEach((s: any) => { m[s.propiedad_id] = s; });
      setSyncData(m);
    }
    setLoading(false);
  };

  // ── Fotos ─────────────────────────────────────────────────────────────────
  const handleFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const total = fotosExistentes.length + fotosNuevas.length + files.length;
    if (total > MAX_FOTOS) { alert(`Máximo ${MAX_FOTOS} fotos.`); return; }
    setFotosNuevas(prev => [...prev, ...files.filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024)]);
  };

  const subirFotos = async (propId: string): Promise<string[]> => {
    if (fotosNuevas.length === 0) return fotosExistentes;
    setSubiendoFotos(true);
    const urls = [...fotosExistentes];
    for (let i = 0; i < fotosNuevas.length; i++) {
      const file = fotosNuevas[i];
      const ext = file.name.split(".").pop();
      const path = `${userId}/${propId}/${Date.now()}_${i}.${ext}`;
      const { data, error } = await supabase.storage.from("fotos_cartera").upload(path, file, { cacheControl: "3600", upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("fotos_cartera").getPublicUrl(data.path);
        urls.push(urlData.publicUrl);
      }
      setProgresoFotos(Math.round(((i + 1) / fotosNuevas.length) * 100));
    }
    setSubiendoFotos(false);
    setProgresoFotos(0);
    return urls;
  };

  // ── Importar desde URL de portal ─────────────────────────────────────────
  const importarDesdeUrl = async () => {
    if (!urlImport.trim()) return;
    setImportando(true);
    setImportError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/cartera/importar-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ url: urlImport.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Error al importar");

      const d = json.data;
      setForm({
        ...FORM_VACIO,
        titulo: d.titulo || "",
        tipo: d.tipo || "Departamento",
        operacion: d.operacion || "Venta",
        precio: d.precio ? String(d.precio) : "",
        moneda: d.moneda || "USD",
        expensas: d.expensas ? String(d.expensas) : "",
        ciudad: d.ciudad || "Rosario",
        zona: d.zona || "",
        direccion: d.direccion || "",
        dormitorios: d.dormitorios ? String(d.dormitorios) : "",
        banos: d.banos ? String(d.banos) : "",
        ambientes: d.ambientes ? String(d.ambientes) : "",
        superficie_cubierta: d.superficie_cubierta ? String(d.superficie_cubierta) : "",
        superficie_total: d.superficie_total ? String(d.superficie_total) : "",
        descripcion: d.descripcion || "",
        url_portal_origen: urlImport.trim(),
      });
      if (d.fotos && d.fotos.length > 0) {
        // Fotos externas: guardar URLs directamente (no subimos, el corredor puede reemplazarlas)
        setFotosExistentes(d.fotos);
      }
      setMostrarImportar(false);
      setUrlImport("");
      setEditandoId(null);
      setPaso(1);
      setMostrarWizard(true);
    } catch (e: any) {
      setImportError(e.message || "Error desconocido");
    }
    setImportando(false);
  };

  // ── Abrir wizard ──────────────────────────────────────────────────────────
  const abrirNueva = async () => {
    setEditandoId(null);
    setFotosNuevas([]); setFotosExistentes([]);

    // Cargar parámetros del corredor para pre-llenar defaults
    let base = { ...FORM_VACIO };
    if (userId) {
      const { data: params } = await supabase
        .from("cartera_parametros")
        .select("*")
        .eq("perfil_id", userId)
        .single();
      if (params) {
        base = {
          ...base,
          operacion: params.operacion_default ?? "Venta",
          tipo: params.tipo_default ?? "Departamento",
          moneda: params.moneda_default ?? "USD",
          ciudad: params.ciudad_default ?? "Rosario",
          zona: params.zona_default ?? "",
          honorario_propietario: params.honorario_propietario_default ? String(params.honorario_propietario_default) : "",
          honorario_comprador: params.honorario_comprador_default ? String(params.honorario_comprador_default) : "",
          honorario_compartir: params.honorario_compartir_default ?? "No comparte",
          descripcion_privada: params.nota_interna_default ?? "",
          // Código automático
          codigo: params.codigo_prefijo
            ? `${params.codigo_prefijo}-${String(params.codigo_contador).padStart(3, "0")}`
            : "",
        };
        // Incrementar contador si hay prefijo
        if (params.codigo_prefijo) {
          await supabase
            .from("cartera_parametros")
            .update({ codigo_contador: (params.codigo_contador ?? 0) + 1 })
            .eq("perfil_id", userId);
        }
      }
    }

    setForm(base);
    setPaso(1); setMostrarWizard(true);
  };

  const abrirEditar = (p: Propiedad) => {
    setEditandoId(p.id);
    const f: any = {};
    Object.keys(FORM_VACIO).forEach(k => {
      const v = (p as any)[k];
      f[k] = v === null || v === undefined ? (typeof FORM_VACIO[k] === "boolean" ? false : "") : (typeof FORM_VACIO[k] === "boolean" ? !!v : String(v));
    });
    f.descripcion = p.descripcion ?? "";
    setForm(f);
    setFotosNuevas([]); setFotosExistentes(p.fotos ?? []);
    setPaso(1); setMostrarWizard(true);
  };

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!userId || !form.titulo) return;
    setGuardando(true);

    const datos: any = {
      perfil_id: userId,
      titulo: form.titulo, tipo: form.tipo, estado: form.estado,
      codigo: form.codigo || null,
      operacion: form.operacion,
      precio: numOrNull(form.precio), moneda: form.moneda,
      expensas: numOrNull(form.expensas), moneda_expensas: form.moneda_expensas || "ARS",
      ocultar_precio: form.ocultar_precio, ocultar_de_redes: form.ocultar_de_redes, ocultar_web: form.ocultar_web,
      honorario_compartir: form.honorario_compartir || null,
      honorario_propietario: numOrNull(form.honorario_propietario),
      honorario_comprador: numOrNull(form.honorario_comprador),
      ciudad: form.ciudad || null, zona: form.zona || null,
      direccion: form.direccion || null, direccion_orientativa: form.direccion_orientativa || null,
      codigo_postal: form.codigo_postal || null, sector: form.sector || null, manzana: form.manzana || null,
      ocultar_ubicacion: form.ocultar_ubicacion,
      latitud: numOrNull(form.latitud), longitud: numOrNull(form.longitud),
      dormitorios: intOrNull(form.dormitorios), banos: intOrNull(form.banos),
      banos_servicio: intOrNull(form.banos_servicio), ambientes: intOrNull(form.ambientes),
      estacionamientos: intOrNull(form.estacionamientos),
      anio_construccion: intOrNull(form.anio_construccion),
      piso: form.piso || null, numero_unidad: form.numero_unidad || null,
      numero_torre: form.numero_torre || null,
      pisos_edificio: intOrNull(form.pisos_edificio),
      departamentos_por_piso: intOrNull(form.departamentos_por_piso),
      bauleras: intOrNull(form.bauleras),
      disposicion: form.disposicion || null, orientacion: form.orientacion || null,
      tipo_departamento: form.tipo_departamento || null, luminosidad: form.luminosidad || null,
      condicion: form.condicion || null, antiguedad: form.antiguedad || null,
      superficie_cubierta: numOrNull(form.superficie_cubierta),
      superficie_total: numOrNull(form.superficie_total),
      sup_semicubierta: numOrNull(form.sup_semicubierta),
      sup_descubierta: numOrNull(form.sup_descubierta),
      sup_exclusiva: numOrNull(form.sup_exclusiva),
      sup_espacios_comunes: numOrNull(form.sup_espacios_comunes),
      sup_patio_terraza: numOrNull(form.sup_patio_terraza),
      sup_balcon: numOrNull(form.sup_balcon),
      metros_frente: numOrNull(form.metros_frente),
      metros_fondo: numOrNull(form.metros_fondo),
      apto_credito: form.apto_credito, con_cochera: form.con_cochera,
      amoblado: form.amoblado, habitada: form.habitada,
      acepta_permuta: form.acepta_permuta, acepta_mascotas: form.acepta_mascotas,
      barrio_cerrado: form.barrio_cerrado, uso_comercial: form.uso_comercial,
      energia_solar: form.energia_solar,
      descripcion: form.descripcion || null,
      descripcion_privada: form.descripcion_privada || null,
      comentarios_colegas: form.comentarios_colegas || null,
      aviso_legal: form.aviso_legal || null,
      video_url: form.video_url || null,
      // Documentación / CI
      contacto_propietario_id: form.contacto_propietario_id || null,
      ci_url: form.ci_url || null,
      ci_fecha_obtencion: form.ci_fecha_obtencion || null,
      ci_fecha_vencimiento: form.ci_fecha_vencimiento || null,
      ci_numero: form.ci_numero || null,
      ci_observaciones: form.ci_observaciones || null,
      escritura_url: form.escritura_url || null,
      plano_url: form.plano_url || null,
      reglamento_url: form.reglamento_url || null,
      api_ninios: form.api_ninios || false,
      api_ninios_numero: form.api_ninios_numero || null,
      url_portal_origen: form.url_portal_origen || null,
      updated_at: new Date().toISOString(),
    };

    // Ambientes y comodidades
    [...AMBIENTES_LIST, ...COMODIDADES_LIST].forEach(({ key }) => { datos[key] = !!form[key]; });

    let propId = editandoId;
    if (editandoId) {
      await supabase.from("cartera_propiedades").update(datos).eq("id", editandoId);
    } else {
      const { data: nueva } = await supabase.from("cartera_propiedades").insert(datos).select("id").single();
      propId = nueva?.id ?? null;
    }

    if (propId) {
      const todasFotos = await subirFotos(propId);
      if (todasFotos.length > 0) {
        await supabase.from("cartera_propiedades").update({ fotos: todasFotos }).eq("id", propId);
      }
    }

    setGuardando(false); setMostrarWizard(false); setFotosNuevas([]);
    if (userId) cargar(userId);
  };

  const cambiarEstado = async (id: string, estado: string) => {
    await supabase.from("cartera_propiedades").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
    if (userId) cargar(userId);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta propiedad? También se eliminará del MIR.")) return;
    await supabase.from("cartera_propiedades").delete().eq("id", id);
    if (userId) cargar(userId);
  };

  const sincronizarPortal = async (propiedadId: string, portales: string[]) => {
    setSincronizando(propiedadId);
    try {
      const res = await fetch("/api/cartera/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propiedad_id: propiedadId, portales }) });
      const data = await res.json();
      if (data.ok) {
        if (userId) await cargar(userId);
        const msgs = portales.map(p => { const r = data.resultados[p]; return `${p}: ${r.ok ? "✅ OK" : r.pendiente ? "⏳ Pendiente (sin API key)" : "❌ " + r.error}`; }).join("\n");
        alert(msgs);
      } else { alert("Error: " + data.error); }
    } catch (e: any) { alert("Error: " + e.message); }
    setSincronizando(null);
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => propiedades.filter(p => {
    if (filtroOp && p.operacion !== filtroOp) return false;
    if (filtroTipo && p.tipo !== filtroTipo) return false;
    if (filtroEstado && p.estado !== filtroEstado) return false;
    if (busqueda.trim()) { const q = busqueda.toLowerCase(); return p.titulo?.toLowerCase().includes(q) || p.direccion?.toLowerCase().includes(q) || p.zona?.toLowerCase().includes(q); }
    return true;
  }), [propiedades, filtroOp, filtroTipo, filtroEstado, busqueda]);

  const estadoInfo = (e: string) => ESTADOS.find(x => x.value === e) ?? { value: e, label: e.toUpperCase(), color: "#6b7280" };
  const pct = Math.round((paso / 7) * 100);
  const setF = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const toggleF = (k: string) => setForm((p: any) => ({ ...p, [k]: !p[k] }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');

        /* ── Base ── */
        .cart-root { display: flex; flex-direction: column; background: #080808; min-height: calc(100vh - 70px); }
        .cart-header { padding: 18px 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .cart-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .cart-titulo span { color: #cc0000; }
        .cart-stats { display: flex; gap: 16px; }
        .cart-stat { display: flex; flex-direction: column; align-items: center; }
        .cart-stat-val { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .cart-stat-label { font-size: 9px; color: rgba(255,255,255,0.25); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .cart-btn-nueva { padding: 9px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .cart-btn-nueva:hover { background: #e60000; }

        /* ── Toolbar ── */
        .cart-toolbar { padding: 12px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .cart-search-wrap { position: relative; }
        .cart-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: rgba(255,255,255,0.2); pointer-events: none; }
        .cart-search { padding: 8px 10px 8px 28px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter',sans-serif; width: 220px; }
        .cart-search:focus { border-color: rgba(200,0,0,0.35); }
        .cart-search::placeholder { color: rgba(255,255,255,0.2); }
        .cart-select { padding: 7px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; font-family: 'Inter',sans-serif; outline: none; cursor: pointer; }
        .cart-count { font-size: 11px; color: rgba(255,255,255,0.25); font-family: 'Inter',sans-serif; margin-left: auto; }

        /* ── Cards ── */
        .cart-lista { display: flex; flex-direction: column; gap: 6px; padding: 14px 0; }
        .cart-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px; display: flex; overflow: hidden; transition: border-color 0.12s; }
        .cart-card:hover { border-color: rgba(255,255,255,0.13); }
        .cart-card-foto { width: 140px; flex-shrink: 0; position: relative; background: rgba(255,255,255,0.03); overflow: hidden; }
        .cart-card-foto img { width: 100%; height: 100%; object-fit: cover; min-height: 110px; }
        .cart-card-foto-empty { width: 100%; min-height: 110px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: rgba(255,255,255,0.08); }
        .cart-estado-badge { position: absolute; top: 8px; left: 8px; padding: 3px 7px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 800; letter-spacing: 0.1em; color: #000; }
        .cart-foto-count { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); color: #fff; font-size: 9px; padding: 2px 5px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .cart-card-info { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .cart-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .cart-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
        .cart-card-titulo:hover { color: #cc0000; }
        .cart-card-tipo { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .cart-card-precio { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; white-space: nowrap; }
        .cart-card-precio-op { font-size: 9px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; font-weight: 700; text-transform: uppercase; }
        .cart-card-meta { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .cart-meta-item { font-size: 11px; color: rgba(255,255,255,0.4); font-family: 'Inter',sans-serif; }
        .cart-card-dir { font-size: 11px; color: rgba(255,255,255,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cart-card-chips { display: flex; gap: 5px; flex-wrap: wrap; }
        .cart-chip { font-size: 9px; padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .cart-chip-v { border-color: rgba(34,197,94,0.3); color: rgba(34,197,94,0.7); }
        .cart-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
        .cart-card-fecha { font-size: 9px; color: rgba(255,255,255,0.18); }
        .cart-mir-badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); color: rgba(200,0,0,0.7); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .sync-badge { font-size: 8px; padding: 2px 6px; border-radius: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .sync-badge-tokko { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.25); color: rgba(220,38,38,0.7); }
        .sync-badge-kite { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); color: rgba(59,130,246,0.7); }
        .cart-card-acciones { width: 120px; flex-shrink: 0; padding: 12px 10px; display: flex; flex-direction: column; gap: 5px; border-left: 1px solid rgba(255,255,255,0.05); }
        .cart-acc-btn { padding: 5px 8px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; text-align: center; width: 100%; }
        .cart-acc-editar { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.45); }
        .cart-acc-tokko { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.2); color: rgba(220,38,38,0.65); }
        .cart-acc-kite { background: rgba(59,130,246,0.07); border: 1px solid rgba(59,130,246,0.2); color: rgba(59,130,246,0.65); }
        .cart-acc-ambos { background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.2); color: rgba(16,185,129,0.65); }
        .cart-acc-eliminar { background: transparent; border: 1px solid rgba(200,0,0,0.15); color: rgba(200,0,0,0.4); }
        .cart-estado-select { width: 100%; padding: 4px 6px; background: rgba(12,12,12,0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; color: rgba(255,255,255,0.5); font-size: 9px; font-family: 'Montserrat',sans-serif; outline: none; cursor: pointer; }
        .cart-empty { padding: 60px 20px; text-align: center; color: rgba(255,255,255,0.18); font-family: 'Inter',sans-serif; font-size: 13px; line-height: 1.8; }
        .cart-empty-ico { font-size: 36px; margin-bottom: 12px; }
        .cart-sync-spinner { display: inline-block; width: 8px; height: 8px; border: 1.5px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 3px; vertical-align: middle; }

        /* ── Wizard overlay ── */
        .wiz-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: flex; z-index: 300; overflow: hidden; }
        .wiz-sidebar { width: 260px; flex-shrink: 0; background: rgba(8,8,8,0.98); border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; padding: 24px 0; }
        .wiz-sidebar-title { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 800; color: #fff; padding: 0 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 8px; }
        .wiz-sidebar-title span { color: #cc0000; }
        .wiz-progress-wrap { padding: 0 20px 16px; }
        .wiz-progress-bar-bg { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
        .wiz-progress-bar { height: 100%; background: #cc0000; transition: width 0.3s; }
        .wiz-progress-pct { font-size: 9px; color: rgba(255,255,255,0.25); font-family: 'Montserrat',sans-serif; font-weight: 700; margin-top: 4px; }
        .wiz-step { display: flex; align-items: center; gap: 12px; padding: 10px 20px; cursor: pointer; transition: background 0.12s; }
        .wiz-step:hover { background: rgba(255,255,255,0.02); }
        .wiz-step-n { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 800; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.3); transition: all 0.15s; }
        .wiz-step-n.activo { background: #cc0000; border-color: #cc0000; color: #fff; }
        .wiz-step-n.hecho { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.4); color: #22c55e; }
        .wiz-step-info { flex: 1; min-width: 0; }
        .wiz-step-label { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5); transition: color 0.12s; }
        .wiz-step-label.activo { color: #fff; }
        .wiz-step-sub { font-size: 9px; color: rgba(255,255,255,0.22); margin-top: 1px; }

        /* ── Wizard contenido ── */
        .wiz-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .wiz-main-header { padding: 20px 28px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
        .wiz-paso-label { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #cc0000; margin-bottom: 4px; }
        .wiz-paso-titulo { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; color: #fff; }
        .wiz-paso-sub { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 3px; font-family: 'Inter',sans-serif; }
        .wiz-body { flex: 1; overflow-y: auto; padding: 20px 28px; }
        .wiz-body::-webkit-scrollbar { width: 3px; }
        .wiz-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .wiz-footer { padding: 14px 28px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }

        /* ── Form elements ── */
        .wiz-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 7px; padding: 18px 20px; margin-bottom: 14px; }
        .wiz-section-title { display: flex; align-items: center; gap: 8px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 800; color: #fff; margin-bottom: 14px; }
        .wiz-section-ico { font-size: 16px; }
        .wiz-field { margin-bottom: 11px; }
        .wiz-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .wiz-input { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; transition: border-color 0.18s; }
        .wiz-input:focus { border-color: rgba(200,0,0,0.45); }
        .wiz-input::placeholder { color: rgba(255,255,255,0.18); }
        .wiz-select { width: 100%; padding: 8px 11px; background: rgba(12,12,12,0.95); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .wiz-textarea { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; resize: none; box-sizing: border-box; }
        .wiz-textarea:focus { border-color: rgba(200,0,0,0.45); }
        .wiz-textarea::placeholder { color: rgba(255,255,255,0.18); }
        .wiz-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .wiz-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .wiz-row-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }
        .wiz-check-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
        .wiz-check-item { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 7px 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 5px; transition: all 0.12s; }
        .wiz-check-item:hover { background: rgba(255,255,255,0.04); }
        .wiz-check-item.on { background: rgba(200,0,0,0.07); border-color: rgba(200,0,0,0.2); }
        .wiz-check-box { width: 15px; height: 15px; border-radius: 3px; border: 2px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.12s; }
        .wiz-check-box.on { background: #cc0000; border-color: #cc0000; }
        .wiz-check-label { font-size: 11px; color: rgba(255,255,255,0.55); font-family: 'Inter',sans-serif; }
        .wiz-check-item.on .wiz-check-label { color: #fff; }

        /* ── Fotos ── */
        .foto-upload-area { border: 2px dashed rgba(255,255,255,0.1); border-radius: 6px; padding: 16px; text-align: center; cursor: pointer; transition: border-color 0.15s; position: relative; margin-bottom: 10px; }
        .foto-upload-area:hover { border-color: rgba(200,0,0,0.3); }
        .foto-upload-area input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .foto-upload-txt { font-size: 12px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        .foto-upload-sub { font-size: 10px; color: rgba(255,255,255,0.18); margin-top: 3px; }
        .fotos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; margin-bottom: 10px; }
        .foto-thumb { position: relative; aspect-ratio: 1; border-radius: 5px; overflow: hidden; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
        .foto-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .foto-thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0); transition: background 0.12s; display: flex; align-items: center; justify-content: center; }
        .foto-thumb:hover .foto-thumb-overlay { background: rgba(0,0,0,0.5); }
        .foto-del-btn { opacity: 0; background: #cc0000; border: none; border-radius: 50%; width: 22px; height: 22px; color: #fff; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.12s; }
        .foto-thumb:hover .foto-del-btn { opacity: 1; }
        .foto-orden { position: absolute; bottom: 3px; left: 3px; background: rgba(0,0,0,0.7); color: #fff; font-size: 8px; padding: 1px 4px; border-radius: 2px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .foto-nueva-badge { position: absolute; top: 3px; right: 3px; background: #22c55e; color: #fff; font-size: 7px; padding: 1px 4px; border-radius: 2px; }
        .foto-progress { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
        .foto-progress-bar { height: 100%; background: #cc0000; transition: width 0.3s; }

        /* ── Video ── */
        .video-preview { margin-top: 8px; border-radius: 6px; overflow: hidden; aspect-ratio: 16/9; background: rgba(0,0,0,0.5); }
        .video-preview iframe { width: 100%; height: 100%; border: none; }

        /* ── Nav wizard ── */
        .wiz-btn-prev { padding: 8px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.13); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .wiz-btn-next { padding: 8px 24px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .wiz-btn-next:disabled { opacity: 0.45; cursor: not-allowed; }
        .wiz-btn-cerrar { position: absolute; top: 16px; right: 16px; background: none; border: none; color: rgba(255,255,255,0.3); font-size: 20px; cursor: pointer; z-index: 10; padding: 4px 8px; }
        .wiz-btn-cerrar:hover { color: #fff; }
        .wiz-mir-info { background: rgba(200,0,0,0.05); border: 1px solid rgba(200,0,0,0.15); border-radius: 5px; padding: 10px 12px; font-size: 11px; color: rgba(255,255,255,0.45); font-family: 'Inter',sans-serif; line-height: 1.5; margin-bottom: 14px; }
        .wiz-mir-info strong { color: rgba(200,0,0,0.8); }
        .cart-spinner { display: inline-block; width: 9px; height: 9px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="cart-root">

        {/* Header */}
        <div className="cart-header">
          <div className="cart-titulo">Cartera <span>de Propiedades</span></div>
          <div className="cart-stats">
            <div className="cart-stat"><span className="cart-stat-val">{propiedades.length}</span><span className="cart-stat-label">Total</span></div>
            <div className="cart-stat"><span className="cart-stat-val" style={{color:"#22c55e"}}>{propiedades.filter(p=>p.estado==="activa").length}</span><span className="cart-stat-label">Activas</span></div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/cartera/parametros" style={{ padding: "7px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "rgba(255,255,255,0.45)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>⚙ Parámetros</Link>
            <button style={{ padding: "7px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "rgba(255,255,255,0.45)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }} onClick={() => { setMostrarImportar(true); setImportError(""); setUrlImport(""); }}>↓ Importar</button>
            <button className="cart-btn-nueva" onClick={abrirNueva}>+ Nueva propiedad</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="cart-toolbar">
          <div className="cart-search-wrap">
            <span className="cart-search-ico">🔍</span>
            <input className="cart-search" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select className="cart-select" value={filtroOp} onChange={e => setFiltroOp(e.target.value)}>
            <option value="">Operación</option>
            {OPERACIONES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className="cart-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Tipo</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="cart-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Estado</option>
            {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(filtroOp || filtroTipo || filtroEstado || busqueda) && (
            <button style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:11}} onClick={() => { setBusqueda(""); setFiltroOp(""); setFiltroTipo(""); setFiltroEstado(""); }}>✕ Limpiar</button>
          )}
          <span className="cart-count">{filtradas.length} propiedades</span>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="cart-empty"><div className="cart-empty-ico">⏳</div>Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-ico">🏠</div>
            {propiedades.length === 0 ? "No tenés propiedades en tu cartera.\nHacé clic en + Nueva propiedad." : "Sin resultados."}
          </div>
        ) : (
          <div className="cart-lista">
            {filtradas.map(p => {
              const est = estadoInfo(p.estado);
              const foto = (p.fotos ?? [])[0];
              const sync = syncData[p.id];
              const enSync = sincronizando === p.id;
              return (
                <div key={p.id} className="cart-card">
                  <div className="cart-card-foto">
                    {foto ? <img src={foto} alt={p.titulo} /> : <div className="cart-card-foto-empty">🏠</div>}
                    <div className="cart-estado-badge" style={{background:est.color}}>{est.label}</div>
                    {(p.fotos ?? []).length > 1 && <div className="cart-foto-count">📷 {p.fotos!.length}</div>}
                  </div>
                  <div className="cart-card-info">
                    <div className="cart-card-top">
                      <div style={{flex:1,minWidth:0}}>
                        <div className="cart-card-titulo" onClick={() => abrirEditar(p)}>{p.titulo}</div>
                        <div className="cart-card-tipo">{p.tipo}{p.zona ? ` · ${p.zona}` : ""}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div className="cart-card-precio-op">{p.operacion}</div>
                        <div className="cart-card-precio">{p.moneda} {fmt(p.precio)}</div>
                        {p.expensas && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Expensas {p.moneda_expensas ?? "ARS"} {fmt(p.expensas)}</div>}
                      </div>
                    </div>
                    {p.direccion && <div className="cart-card-dir">📍 {p.direccion}</div>}
                    <div className="cart-card-meta">
                      {p.ambientes != null && <span className="cart-meta-item">🏠 {p.ambientes} amb.</span>}
                      {p.dormitorios != null && <span className="cart-meta-item">🛏 {p.dormitorios} dorm.</span>}
                      {p.banos != null && <span className="cart-meta-item">🚿 {p.banos} baños</span>}
                      {p.superficie_cubierta != null && <span className="cart-meta-item">📐 {p.superficie_cubierta} m²</span>}
                      {p.piso && <span className="cart-meta-item">Piso {p.piso}</span>}
                    </div>
                    <div className="cart-card-chips">
                      {p.apto_credito && <span className="cart-chip cart-chip-v">Apto crédito</span>}
                      {p.con_cochera && <span className="cart-chip cart-chip-v">Cochera</span>}
                      {p.amoblado && <span className="cart-chip cart-chip-v">Amoblado</span>}
                      {p.acepta_mascotas && <span className="cart-chip">Mascotas</span>}
                      {p.barrio_cerrado && <span className="cart-chip">B. Cerrado</span>}
                    </div>
                    <div className="cart-card-footer">
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {p.codigo && <span style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>{p.codigo}</span>}
                        <span className="cart-card-fecha">{formatFecha(p.updated_at)}</span>
                        {p.estado === "activa" && <span className="cart-mir-badge">🔄 En MIR</span>}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        {sync?.tokko_id && <span className="sync-badge sync-badge-tokko">Tokko ✓</span>}
                        {sync?.kiteprop_id && <span className="sync-badge sync-badge-kite">KiteProp ✓</span>}
                      </div>
                    </div>
                  </div>
                  <div className="cart-card-acciones">
                    <button className="cart-acc-btn cart-acc-editar" onClick={() => abrirEditar(p)}>Editar</button>
                    <a href={`/cartera/ficha/${p.id}`} target="_blank" rel="noopener noreferrer" className="cart-acc-btn" style={{textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:4,padding:"5px 0",display:"block",textDecoration:"none",fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.06em",cursor:"pointer"}}>📄 Ficha</a>
                    <select className="cart-estado-select" value={p.estado} onChange={e => cambiarEstado(p.id, e.target.value)}>
                      {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button className="cart-acc-btn cart-acc-tokko" onClick={() => sincronizarPortal(p.id, ["tokko"])} disabled={enSync}>
                      {enSync ? <><span className="cart-sync-spinner"/>...</> : sync?.tokko_id ? "↑ Tokko" : "+ Tokko"}
                    </button>
                    <button className="cart-acc-btn cart-acc-kite" onClick={() => sincronizarPortal(p.id, ["kiteprop"])} disabled={enSync}>
                      {enSync ? "..." : sync?.kiteprop_id ? "↑ KiteProp" : "+ KiteProp"}
                    </button>
                    <button className="cart-acc-btn cart-acc-ambos" onClick={() => sincronizarPortal(p.id, ["tokko","kiteprop"])} disabled={enSync}>
                      {enSync ? "..." : "↑ Ambos"}
                    </button>
                    <button className="cart-acc-btn cart-acc-eliminar" onClick={() => eliminar(p.id)}>Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          WIZARD — 6 PASOS
      ══════════════════════════════════════════════════ */}
      {mostrarWizard && (
        <div className="wiz-bg">
          <button className="wiz-btn-cerrar" onClick={() => setMostrarWizard(false)}>×</button>

          {/* Sidebar */}
          <div className="wiz-sidebar">
            <div className="wiz-sidebar-title">{editandoId ? "Editar" : "Nueva"} <span>propiedad</span></div>
            <div className="wiz-progress-wrap">
              <div className="wiz-progress-bar-bg"><div className="wiz-progress-bar" style={{width:`${pct}%`}} /></div>
              <div className="wiz-progress-pct">{pct}% completado</div>
            </div>
            {PASOS.map(s => (
              <div key={s.n} className="wiz-step" onClick={() => setPaso(s.n)}>
                <div className={`wiz-step-n${paso === s.n ? " activo" : paso > s.n ? " hecho" : ""}`}>
                  {paso > s.n ? "✓" : s.n}
                </div>
                <div className="wiz-step-info">
                  <div className={`wiz-step-label${paso === s.n ? " activo" : ""}`}>{s.label}</div>
                  <div className="wiz-step-sub">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Contenido */}
          <div className="wiz-main">
            <div className="wiz-main-header">
              <div className="wiz-paso-label">Paso {paso} de 7</div>
              <div className="wiz-paso-titulo">{PASOS[paso-1].label}</div>
              <div className="wiz-paso-sub">{PASOS[paso-1].sub}</div>
            </div>

            <div className="wiz-body">

              {/* ── PASO 1: Información básica ── */}
              {paso === 1 && (
                <>
                  {!editandoId && (
                    <div className="wiz-mir-info">
                      <strong>🔄 Se publicará automáticamente en el MIR</strong> como ofrecido tuyo en la red. Podés pausarla después si querés.
                    </div>
                  )}
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">🏠</span>Información básica</div>
                    <div className="wiz-row">
                      <div className="wiz-field" style={{gridColumn:"1/-1"}}>
                        <label className="wiz-label">Título *</label>
                        <input className="wiz-input" value={form.titulo} onChange={e => setF("titulo", e.target.value)} placeholder="Ej: Departamento 3 amb. con balcón - Fisherton" />
                      </div>
                    </div>
                    <div className="wiz-row">
                      <div className="wiz-field">
                        <label className="wiz-label">Tipo</label>
                        <select className="wiz-select" value={form.tipo} onChange={e => setF("tipo", e.target.value)}>
                          {TIPOS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">ID Interno / Código</label>
                        <input className="wiz-input" value={form.codigo} onChange={e => setF("codigo", e.target.value)} placeholder="Ej: MI-001" />
                      </div>
                    </div>
                    <div className="wiz-field">
                      <label className="wiz-label">Estado</label>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {ESTADOS.map(s => (
                          <button key={s.value} type="button"
                            style={{padding:"6px 14px",borderRadius:4,border:`2px solid ${form.estado===s.value?s.color:"rgba(255,255,255,0.1)"}`,background:form.estado===s.value?`${s.color}20`:"transparent",color:form.estado===s.value?s.color:"rgba(255,255,255,0.4)",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}}
                            onClick={() => setF("estado", s.value)}>{s.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── PASO 2: Operación y precios ── */}
              {paso === 2 && (
                <>
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">💰</span>Operación y precios</div>
                    <div className="wiz-row">
                      <div className="wiz-field">
                        <label className="wiz-label">Moneda</label>
                        <select className="wiz-select" value={form.moneda} onChange={e => setF("moneda", e.target.value)}>
                          <option>USD</option><option>ARS</option><option>EUR</option>
                        </select>
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Tipo de operación</label>
                        <div style={{display:"flex",gap:6}}>
                          {OPERACIONES.map(o => (
                            <button key={o} type="button"
                              style={{padding:"6px 12px",borderRadius:3,border:`1px solid ${form.operacion===o?"#cc0000":"rgba(255,255,255,0.1)"}`,background:form.operacion===o?"rgba(200,0,0,0.1)":"transparent",color:form.operacion===o?"#fff":"rgba(255,255,255,0.4)",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}}
                              onClick={() => setF("operacion", o)}>{o}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="wiz-row">
                      <div className="wiz-field">
                        <label className="wiz-label">Precio</label>
                        <input className="wiz-input" type="number" value={form.precio} onChange={e => setF("precio", e.target.value)} placeholder="180000" />
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Expensas</label>
                        <input className="wiz-input" type="number" value={form.expensas} onChange={e => setF("expensas", e.target.value)} placeholder="40000" />
                      </div>
                    </div>
                    <div className="wiz-field">
                      <label className="wiz-label">Moneda expensas</label>
                      <select className="wiz-select" value={form.moneda_expensas} onChange={e => setF("moneda_expensas", e.target.value)} style={{maxWidth:200}}>
                        <option>ARS</option><option>USD</option>
                      </select>
                    </div>
                  </div>

                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">👁</span>Opciones de visibilidad</div>
                    <div className="wiz-check-grid">
                      {[
                        { k: "ocultar_precio", l: "Ocultar precio" },
                        { k: "ocultar_de_redes", l: "Ocultar de las redes" },
                        { k: "ocultar_web", l: "Ocultar en sitio web" },
                      ].map(({ k, l }) => (
                        <div key={k} className={`wiz-check-item${form[k] ? " on" : ""}`} onClick={() => toggleF(k)}>
                          <div className={`wiz-check-box${form[k] ? " on" : ""}`}>{form[k] && <span style={{fontSize:8,color:"#fff"}}>✓</span>}</div>
                          <span className="wiz-check-label">{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">%</span>Honorarios profesionales</div>
                    <div className="wiz-field">
                      <label className="wiz-label">Honorario para compartir en redes</label>
                      <select className="wiz-select" value={form.honorario_compartir} onChange={e => setF("honorario_compartir", e.target.value)} style={{maxWidth:200}}>
                        {HONORARIOS_COMPARTIR.map(h => <option key={h}>{h}</option>)}
                      </select>
                    </div>
                    <div className="wiz-row">
                      <div className="wiz-field">
                        <label className="wiz-label">Honorarios propietario %</label>
                        <input className="wiz-input" type="number" step="0.5" value={form.honorario_propietario} onChange={e => setF("honorario_propietario", e.target.value)} placeholder="3" />
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Honorarios comprador/inquilino %</label>
                        <input className="wiz-input" type="number" step="0.5" value={form.honorario_comprador} onChange={e => setF("honorario_comprador", e.target.value)} placeholder="3" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── PASO 3: Ubicación ── */}
              {paso === 3 && (
                <>
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">📍</span>Ubicación</div>
                    <div className="wiz-row">
                      <div className="wiz-field">
                        <label className="wiz-label">Ciudad</label>
                        <input className="wiz-input" value={form.ciudad} onChange={e => setF("ciudad", e.target.value)} placeholder="Rosario" />
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Zona / Barrio</label>
                        <input className="wiz-input" value={form.zona} onChange={e => setF("zona", e.target.value)} placeholder="Fisherton, Palermo..." />
                      </div>
                    </div>
                    <div className="wiz-field">
                      <label className="wiz-label">Dirección exacta</label>
                      <input className="wiz-input" value={form.direccion} onChange={e => setF("direccion", e.target.value)} placeholder="Av. Pellegrini 1200" />
                    </div>
                    <div className="wiz-row">
                      <div className="wiz-field">
                        <label className="wiz-label">Dirección orientativa</label>
                        <input className="wiz-input" value={form.direccion_orientativa} onChange={e => setF("direccion_orientativa", e.target.value)} placeholder="Zona Tribunales" />
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Código postal</label>
                        <input className="wiz-input" value={form.codigo_postal} onChange={e => setF("codigo_postal", e.target.value)} placeholder="2000" />
                      </div>
                    </div>
                    <div className="wiz-row">
                      <div className="wiz-field">
                        <label className="wiz-label">Sector</label>
                        <input className="wiz-input" value={form.sector} onChange={e => setF("sector", e.target.value)} />
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Manzana</label>
                        <input className="wiz-input" value={form.manzana} onChange={e => setF("manzana", e.target.value)} />
                      </div>
                    </div>
                    <div className="wiz-row">
                      <div className="wiz-field">
                        <label className="wiz-label">Latitud</label>
                        <input className="wiz-input" type="number" step="0.000001" value={form.latitud} onChange={e => setF("latitud", e.target.value)} placeholder="-32.9442" />
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Longitud</label>
                        <input className="wiz-input" type="number" step="0.000001" value={form.longitud} onChange={e => setF("longitud", e.target.value)} placeholder="-60.6505" />
                      </div>
                    </div>
                    <div className={`wiz-check-item${form.ocultar_ubicacion ? " on" : ""}`} style={{maxWidth:280}} onClick={() => toggleF("ocultar_ubicacion")}>
                      <div className={`wiz-check-box${form.ocultar_ubicacion ? " on" : ""}`}>{form.ocultar_ubicacion && <span style={{fontSize:8,color:"#fff"}}>✓</span>}</div>
                      <span className="wiz-check-label">Ocultar ubicación exacta y mostrar la orientativa</span>
                    </div>
                  </div>
                </>
              )}

              {/* ── PASO 4: Características ── */}
              {paso === 4 && (
                <>
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">📋</span>Detalles</div>
                    <div className="wiz-row-3">
                      <div className="wiz-field"><label className="wiz-label">Ambientes</label><input className="wiz-input" type="number" value={form.ambientes} onChange={e => setF("ambientes", e.target.value)} placeholder="3" /></div>
                      <div className="wiz-field"><label className="wiz-label">Dormitorios</label><input className="wiz-input" type="number" value={form.dormitorios} onChange={e => setF("dormitorios", e.target.value)} placeholder="2" /></div>
                      <div className="wiz-field"><label className="wiz-label">Baños</label><input className="wiz-input" type="number" value={form.banos} onChange={e => setF("banos", e.target.value)} placeholder="1" /></div>
                    </div>
                    <div className="wiz-row-3">
                      <div className="wiz-field"><label className="wiz-label">Baños de servicio</label><input className="wiz-input" type="number" value={form.banos_servicio} onChange={e => setF("banos_servicio", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Estacionamientos</label><input className="wiz-input" type="number" value={form.estacionamientos} onChange={e => setF("estacionamientos", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Año de construcción</label><input className="wiz-input" type="number" value={form.anio_construccion} onChange={e => setF("anio_construccion", e.target.value)} placeholder="1990" /></div>
                    </div>
                    <div className="wiz-row-4">
                      <div className="wiz-field"><label className="wiz-label">Piso</label><input className="wiz-input" value={form.piso} onChange={e => setF("piso", e.target.value)} placeholder="3" /></div>
                      <div className="wiz-field"><label className="wiz-label">N° unidad</label><input className="wiz-input" value={form.numero_unidad} onChange={e => setF("numero_unidad", e.target.value)} placeholder="A" /></div>
                      <div className="wiz-field"><label className="wiz-label">N° torre</label><input className="wiz-input" value={form.numero_torre} onChange={e => setF("numero_torre", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Pisos en edificio</label><input className="wiz-input" type="number" value={form.pisos_edificio} onChange={e => setF("pisos_edificio", e.target.value)} /></div>
                    </div>
                    <div className="wiz-row-3">
                      <div className="wiz-field"><label className="wiz-label">Deptos por piso</label><input className="wiz-input" type="number" value={form.departamentos_por_piso} onChange={e => setF("departamentos_por_piso", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Bauleras</label><input className="wiz-input" type="number" value={form.bauleras} onChange={e => setF("bauleras", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Tipo depto</label><select className="wiz-select" value={form.tipo_departamento} onChange={e => setF("tipo_departamento", e.target.value)}><option value="">Sin especificar</option>{TIPOS_DEPTO.map(t => <option key={t}>{t}</option>)}</select></div>
                    </div>
                    <div className="wiz-row-3">
                      <div className="wiz-field"><label className="wiz-label">Disposición</label><select className="wiz-select" value={form.disposicion} onChange={e => setF("disposicion", e.target.value)}><option value="">Sin especificar</option>{DISPOSICIONES.map(d => <option key={d}>{d}</option>)}</select></div>
                      <div className="wiz-field"><label className="wiz-label">Orientación</label><select className="wiz-select" value={form.orientacion} onChange={e => setF("orientacion", e.target.value)}><option value="">Sin especificar</option>{ORIENTACIONES.map(o => <option key={o}>{o}</option>)}</select></div>
                      <div className="wiz-field"><label className="wiz-label">Luminosidad</label><select className="wiz-select" value={form.luminosidad} onChange={e => setF("luminosidad", e.target.value)}><option value="">Sin especificar</option><option>Muy luminoso</option><option>Luminoso</option><option>Normal</option></select></div>
                    </div>
                    <div className="wiz-row">
                      <div className="wiz-field"><label className="wiz-label">Condición</label><select className="wiz-select" value={form.condicion} onChange={e => setF("condicion", e.target.value)}><option value="">Sin especificar</option>{CONDICIONES.map(c => <option key={c}>{c}</option>)}</select></div>
                      <div className="wiz-field"><label className="wiz-label">Antigüedad</label><select className="wiz-select" value={form.antiguedad} onChange={e => setF("antiguedad", e.target.value)}><option value="">Sin especificar</option><option>A estrenar</option><option>Menos de 5 años</option><option>5-10 años</option><option>10-20 años</option><option>Más de 20 años</option></select></div>
                    </div>
                  </div>

                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">📐</span>Superficies</div>
                    <div className="wiz-row-4">
                      <div className="wiz-field"><label className="wiz-label">Total m²</label><input className="wiz-input" type="number" value={form.superficie_total} onChange={e => setF("superficie_total", e.target.value)} placeholder="85" /></div>
                      <div className="wiz-field"><label className="wiz-label">Cubierta m²</label><input className="wiz-input" type="number" value={form.superficie_cubierta} onChange={e => setF("superficie_cubierta", e.target.value)} placeholder="70" /></div>
                      <div className="wiz-field"><label className="wiz-label">Semicubierta m²</label><input className="wiz-input" type="number" value={form.sup_semicubierta} onChange={e => setF("sup_semicubierta", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Descubierta m²</label><input className="wiz-input" type="number" value={form.sup_descubierta} onChange={e => setF("sup_descubierta", e.target.value)} /></div>
                    </div>
                    <div className="wiz-row-4">
                      <div className="wiz-field"><label className="wiz-label">Exclusiva m²</label><input className="wiz-input" type="number" value={form.sup_exclusiva} onChange={e => setF("sup_exclusiva", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Esp. comunes m²</label><input className="wiz-input" type="number" value={form.sup_espacios_comunes} onChange={e => setF("sup_espacios_comunes", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Patio/terraza m²</label><input className="wiz-input" type="number" value={form.sup_patio_terraza} onChange={e => setF("sup_patio_terraza", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Balcón m²</label><input className="wiz-input" type="number" value={form.sup_balcon} onChange={e => setF("sup_balcon", e.target.value)} /></div>
                    </div>
                    <div className="wiz-row">
                      <div className="wiz-field"><label className="wiz-label">Metros de frente</label><input className="wiz-input" type="number" value={form.metros_frente} onChange={e => setF("metros_frente", e.target.value)} /></div>
                      <div className="wiz-field"><label className="wiz-label">Metros de fondo</label><input className="wiz-input" type="number" value={form.metros_fondo} onChange={e => setF("metros_fondo", e.target.value)} /></div>
                    </div>
                  </div>

                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">ℹ️</span>Información adicional</div>
                    <div className="wiz-check-grid">
                      {[
                        { k: "apto_credito", l: "Apto crédito" }, { k: "con_cochera", l: "Con cochera" },
                        { k: "amoblado", l: "Amoblado" }, { k: "habitada", l: "Habitada" },
                        { k: "acepta_permuta", l: "Acepta permuta" }, { k: "acepta_mascotas", l: "Acepta mascotas" },
                        { k: "barrio_cerrado", l: "Barrio cerrado" }, { k: "uso_comercial", l: "Uso comercial" },
                        { k: "energia_solar", l: "Energía solar" },
                      ].map(({ k, l }) => (
                        <div key={k} className={`wiz-check-item${form[k] ? " on" : ""}`} onClick={() => toggleF(k)}>
                          <div className={`wiz-check-box${form[k] ? " on" : ""}`}>{form[k] && <span style={{fontSize:8,color:"#fff"}}>✓</span>}</div>
                          <span className="wiz-check-label">{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── PASO 5: Descripción y fotos ── */}
              {paso === 5 && (
                <>
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">📝</span>Descripción pública</div>
                    <div className="wiz-field">
                      {/* IA Descripción */}
                      <div style={{marginBottom:10,padding:"10px 12px",background:"rgba(204,0,0,0.06)",border:"1px solid rgba(204,0,0,0.15)",borderRadius:8}}>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:8,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.06em"}}>🤖 GENERAR CON IA</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                          {(["profesional","premium","amigable","vendedor"] as const).map(t => (
                            <button key={t} onClick={() => setTonoDesc(t)} type="button" style={{padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,textTransform:"capitalize",background:tonoDesc===t?"rgba(204,0,0,0.2)":"rgba(255,255,255,0.05)",color:tonoDesc===t?"#ff6666":"rgba(255,255,255,0.4)",outline:tonoDesc===t?"1px solid rgba(204,0,0,0.3)":"none"}}>
                              {t}
                            </button>
                          ))}
                        </div>
                        <button type="button" disabled={generandoDesc} onClick={async () => {
                          setGenerandoDesc(true);
                          try {
                            const res = await fetch("/api/ia-descripcion", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({propiedad:form,tono:tonoDesc})});
                            const {descripcion} = await res.json();
                            if (descripcion) setF("descripcion", descripcion);
                          } catch {}
                          setGenerandoDesc(false);
                        }} style={{padding:"6px 14px",background:"#cc0000",color:"#fff",border:"none",borderRadius:6,fontFamily:"Montserrat,sans-serif",fontSize:11,fontWeight:700,cursor:"pointer",opacity:generandoDesc?0.5:1}}>
                          {generandoDesc ? "Generando..." : "✨ Generar descripción"}
                        </button>
                      </div>
                      <textarea className="wiz-textarea" value={form.descripcion} onChange={e => setF("descripcion", e.target.value)} rows={5} placeholder="Descripción que verán los interesados..." style={{width:"100%",boxSizing:"border-box"}} />
                    </div>
                    <div className="wiz-field">
                      <label className="wiz-label">Descripción privada</label>
                      <textarea className="wiz-textarea" value={form.descripcion_privada} onChange={e => setF("descripcion_privada", e.target.value)} rows={3} placeholder="Solo visible para vos..." style={{width:"100%",boxSizing:"border-box"}} />
                    </div>
                    <div className="wiz-field">
                      <label className="wiz-label">Comentarios para colegas</label>
                      <textarea className="wiz-textarea" value={form.comentarios_colegas} onChange={e => setF("comentarios_colegas", e.target.value)} rows={2} placeholder="Visible solo dentro del sistema, no se publica en portales..." style={{width:"100%",boxSizing:"border-box"}} />
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:4,fontFamily:"Inter,sans-serif",lineHeight:1.5}}>Información útil para colegas interesados en compartir o canjear honorarios. No se publica externamente.</div>
                    </div>
                    <div className="wiz-field">
                      <label className="wiz-label">Aviso legal</label>
                      <textarea className="wiz-textarea" value={form.aviso_legal} onChange={e => setF("aviso_legal", e.target.value)} rows={2} placeholder="Reemplaza el aviso legal por defecto..." style={{width:"100%",boxSizing:"border-box"}} />
                    </div>
                  </div>

                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">📷</span>Fotos ({fotosExistentes.length + fotosNuevas.length}/{MAX_FOTOS})</div>
                    {(fotosExistentes.length > 0 || fotosNuevas.length > 0) && (
                      <div className="fotos-grid">
                        {fotosExistentes.map((url, i) => (
                          <div key={url} className="foto-thumb">
                            <img src={url} alt="" />
                            <div className="foto-thumb-overlay"><button className="foto-del-btn" onClick={() => setFotosExistentes(p => p.filter(u => u !== url))}>×</button></div>
                            <div className="foto-orden">{i+1}</div>
                          </div>
                        ))}
                        {fotosNuevas.map((file, i) => (
                          <div key={i} className="foto-thumb">
                            <img src={URL.createObjectURL(file)} alt="" />
                            <div className="foto-thumb-overlay"><button className="foto-del-btn" onClick={() => setFotosNuevas(p => p.filter((_,j) => j !== i))}>×</button></div>
                            <div className="foto-orden">{fotosExistentes.length + i + 1}</div>
                            <div className="foto-nueva-badge">NUEVA</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(fotosExistentes.length + fotosNuevas.length) < MAX_FOTOS && (
                      <div className="foto-upload-area">
                        <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={handleFotos} />
                        <div className="foto-upload-txt">📷 Arrastrá fotos o hacé clic para seleccionar</div>
                        <div className="foto-upload-sub">JPG, PNG, WebP · Máx 10MB · Hasta {MAX_FOTOS} fotos</div>
                      </div>
                    )}
                    {subiendoFotos && <div className="foto-progress"><div className="foto-progress-bar" style={{width:`${progresoFotos}%`}} /></div>}
                  </div>

                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">▶️</span>Video YouTube</div>
                    <div className="wiz-field">
                      <input className="wiz-input" value={form.video_url} onChange={e => setF("video_url", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                      {form.video_url && getYouTubeId(form.video_url) && (
                        <div className="video-preview" style={{marginTop:8}}>
                          <iframe src={`https://www.youtube.com/embed/${getYouTubeId(form.video_url)}`} allowFullScreen title="Preview" />
                        </div>
                      )}
                      {form.video_url && !getYouTubeId(form.video_url) && (
                        <div style={{marginTop:5,fontSize:10,color:"rgba(200,0,0,0.6)"}}>⚠️ URL de YouTube no reconocida</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── PASO 6: Amenities ── */}
              {paso === 6 && (
                <>
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">🚪</span>Ambientes</div>
                    <div className="wiz-check-grid">
                      {AMBIENTES_LIST.map(({ key, label }) => (
                        <div key={key} className={`wiz-check-item${form[key] ? " on" : ""}`} onClick={() => toggleF(key)}>
                          <div className={`wiz-check-box${form[key] ? " on" : ""}`}>{form[key] && <span style={{fontSize:8,color:"#fff"}}>✓</span>}</div>
                          <span className="wiz-check-label">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">⭐</span>Comodidades y amenities</div>
                    <div className="wiz-check-grid">
                      {COMODIDADES_LIST.map(({ key, label }) => (
                        <div key={key} className={`wiz-check-item${form[key] ? " on" : ""}`} onClick={() => toggleF(key)}>
                          <div className={`wiz-check-box${form[key] ? " on" : ""}`}>{form[key] && <span style={{fontSize:8,color:"#fff"}}>✓</span>}</div>
                          <span className="wiz-check-label">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── PASO 7: Documentación / CI ── */}
              {paso === 7 && (
                <>
                  {/* Dueño / Propietario */}
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">👤</span>Propietario</div>
                    <div className="wiz-field">
                      <label className="wiz-label">Vincular dueño del CRM</label>
                      <select className="wiz-select" value={form.contacto_propietario_id} onChange={e => setF("contacto_propietario_id", e.target.value)}>
                        <option value="">— Sin vincular —</option>
                        {contactosCRM.map(c => (
                          <option key={c.id} value={c.id}>{[c.nombre, c.apellido].filter(Boolean).join(" ")}</option>
                        ))}
                      </select>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:4}}>Vinculá al propietario para acceder a su info de contacto desde esta ficha.</div>
                    </div>
                  </div>

                  {/* Certificado de Inhibición */}
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">📋</span>Certificado de Inhibición (CI)</div>
                    <div className="wiz-grid-3">
                      <div className="wiz-field">
                        <label className="wiz-label">N° de certificado</label>
                        <input className="wiz-input" value={form.ci_numero} onChange={e => setF("ci_numero", e.target.value)} placeholder="Ej: 2024-00001" />
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Fecha de obtención</label>
                        <input className="wiz-input" type="date" value={form.ci_fecha_obtencion} onChange={e => setF("ci_fecha_obtencion", e.target.value)} />
                      </div>
                      <div className="wiz-field">
                        <label className="wiz-label">Vencimiento</label>
                        <input className="wiz-input" type="date" value={form.ci_fecha_vencimiento} onChange={e => setF("ci_fecha_vencimiento", e.target.value)} />
                      </div>
                    </div>
                    <div className="wiz-field" style={{marginTop:8}}>
                      <label className="wiz-label">Link al documento (Drive, Dropbox, etc.)</label>
                      <input className="wiz-input" value={form.ci_url} onChange={e => setF("ci_url", e.target.value)} placeholder="https://drive.google.com/..." />
                    </div>
                    <div className="wiz-field" style={{marginTop:8}}>
                      <label className="wiz-label">Observaciones</label>
                      <textarea className="wiz-textarea" rows={2} value={form.ci_observaciones} onChange={e => setF("ci_observaciones", e.target.value)} placeholder="Estado del CI, pendiente de renovar, etc." />
                    </div>
                  </div>

                  {/* API de niños */}
                  <div className="wiz-section">
                    <div className="wiz-section-title"><span className="wiz-section-ico">📝</span>Otros documentos</div>
                    <div className="wiz-field">
                      <label className="wiz-label">Escritura (link)</label>
                      <input className="wiz-input" value={form.escritura_url} onChange={e => setF("escritura_url", e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="wiz-field" style={{marginTop:8}}>
                      <label className="wiz-label">Plano / Mensura (link)</label>
                      <input className="wiz-input" value={form.plano_url} onChange={e => setF("plano_url", e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="wiz-field" style={{marginTop:8}}>
                      <label className="wiz-label">Reglamento de copropiedad (link)</label>
                      <input className="wiz-input" value={form.reglamento_url} onChange={e => setF("reglamento_url", e.target.value)} placeholder="https://..." />
                    </div>
                    <div style={{marginTop:12}}>
                      <div className={`wiz-check-item${form.api_ninios ? " on" : ""}`} onClick={() => toggleF("api_ninios")} style={{display:"inline-flex",gap:8}}>
                        <div className={`wiz-check-box${form.api_ninios ? " on" : ""}`}>{form.api_ninios && <span style={{fontSize:8,color:"#fff"}}>✓</span>}</div>
                        <span className="wiz-check-label">API de niños / ANSES presentado</span>
                      </div>
                      {form.api_ninios && (
                        <input className="wiz-input" style={{marginTop:8}} value={form.api_ninios_numero} onChange={e => setF("api_ninios_numero", e.target.value)} placeholder="N° de expediente API" />
                      )}
                    </div>
                    {form.url_portal_origen && (
                      <div className="wiz-field" style={{marginTop:12}}>
                        <label className="wiz-label">Origen (portal importado)</label>
                        <a href={form.url_portal_origen} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"rgba(100,160,255,0.7)",wordBreak:"break-all"}}>{form.url_portal_origen}</a>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>{/* fin wiz-body */}

            {/* Footer navegación */}
            <div className="wiz-footer">
              <div style={{display:"flex",gap:8}}>
                {paso > 1 && <button className="wiz-btn-prev" onClick={() => setPaso(p => p - 1)}>← Anterior</button>}
                <button style={{background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:11,fontFamily:"Inter,sans-serif"}} onClick={() => setMostrarWizard(false)}>Cancelar</button>
              </div>
              {paso < 7
                ? <button className="wiz-btn-next" onClick={() => setPaso(p => p + 1)} disabled={paso === 1 && !form.titulo}>Siguiente →</button>
                : <button className="wiz-btn-next" onClick={guardar} disabled={guardando || subiendoFotos}>
                    {guardando || subiendoFotos ? <><span className="cart-spinner"/>{subiendoFotos ? `Subiendo ${progresoFotos}%...` : "Guardando..."}</> : editandoId ? "Guardar cambios" : "Crear propiedad"}
                  </button>
              }
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL IMPORTAR DESDE URL DE PORTAL
      ═══════════════════════════════════════ */}
      {mostrarImportar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 32, width: "100%", maxWidth: 520 }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 6 }}>↓ Importar desde portal</div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20, lineHeight: 1.5 }}>
              Pegá la URL de una propiedad de ZonaProp, Argenprop, MercadoLibre, Red Propia u otros portales. Los datos disponibles se pre-cargarán en el formulario para que los completes o corrijas.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: importError ? 8 : 20 }}>
              <input
                value={urlImport}
                onChange={e => setUrlImport(e.target.value)}
                onKeyDown={e => e.key === "Enter" && importarDesdeUrl()}
                placeholder="https://www.zonaprop.com.ar/..."
                style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, outline: "none" }}
              />
              <button
                onClick={importarDesdeUrl}
                disabled={importando || !urlImport.trim()}
                style={{ padding: "10px 18px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 6, fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {importando ? "Importando…" : "Importar"}
              </button>
            </div>
            {importError && (
              <div style={{ fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "8px 12px", marginBottom: 14 }}>
                ⚠️ {importError}
              </div>
            )}
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 20 }}>
              Portales soportados: ZonaProp · Argenprop · MercadoLibre · Red Propia · Ficha.info · Properati
            </div>
            <button
              onClick={() => { setMostrarImportar(false); setImportError(""); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", fontFamily: "Inter,sans-serif" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
