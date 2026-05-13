"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminBeneficios from "../../components/AdminBeneficios";

interface Perfil { id: string; tipo: string; estado: string; nombre: string; apellido: string; matricula: string | null; dni: string | null; telefono: string | null; email: string | null; inmobiliaria: string | null; especialidades: string[] | null; created_at: string; insignia_mentor?: boolean; insignia_tasador?: boolean; categoria?: string; bonificacion_pct?: number; }
interface Indicador { clave: string; valor: number | string; label: string; tipo: "number" | "text"; actualizado_at?: string | null; }
interface Pago { id: string; perfil_id: string; tipo: string; monto_usd: number; monto_ars: number | null; monto_declarado_ars: number | null; dolar_ref: number | null; estado: string; fecha_pago_declarado: string | null; fecha_confirmacion: string | null; fecha_vencimiento: string | null; periodo: string | null; comprobante: string | null; cbu_origen: string | null; nota_admin: string | null; creado_at: string; perfiles?: { nombre: string; apellido: string; matricula: string | null; email: string | null; }; }
interface Proveedor { id: string; nombre: string; contacto_whatsapp: string | null; contacto_email: string | null; monedas: string[] | null; servicios: string[] | null; activo: boolean; orden: number; compra_usd: number | null; venta_usd: number | null; actualizado_cot: string | null; }
interface Documento { id: string; nombre: string; descripcion: string; nivel: string; categoria: string; archivo_url: string; estado: string; created_at: string; user_id: string; perfiles: { nombre: string; apellido: string; matricula: string; }; }
interface Noticia { id: string; titulo: string; cuerpo: string; link: string | null; imagen_url: string | null; fuente: string | null; destacado: boolean; estado: string; created_at: string; autor_id: string; perfiles?: { nombre: string; apellido: string; matricula: string | null; }; }
interface EventoPropuesto {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  lugar: string | null;
  tipo: string;
  gratuito: boolean;
  precio_entrada: number | null;
  capacidad: number | null;
  plataforma: string | null;
  estado: string;
  organizador_id: string;
  created_at: string;
  organizador?: { nombre: string; apellido: string; matricula: string | null; };
}

interface Colaborador { id: string; corredor_id: string; user_id: string | null; nombre: string; apellido: string; email: string; telefono: string | null; dni: string | null; rol: string; estado: string; notas: string | null; created_at: string; corredor?: { nombre: string; apellido: string; matricula: string | null; email: string | null; }; }

const INDICADORES_CONFIG = [
  { clave: "valor_jus", label: "Valor JUS", tipo: "number" as const },
  { clave: "precio_corredor_usd", label: "Precio Corredor (USD)", tipo: "number" as const },
  { clave: "precio_colaborador_usd", label: "Precio Colaborador (USD)", tipo: "number" as const },
  { clave: "costo_match_divisas", label: "Costo Match Divisas (ARS)", tipo: "number" as const },
  { clave: "costo_match_mir", label: "Costo Match MIR (ARS)", tipo: "number" as const },
];

const CONFIGURACION_SITIO_DEF = [
  { clave: "anuncio_banner",                  label: "Texto del banner global",          categoria: "anuncios",   tipo: "textarea", descripcion: "Visible para todos al entrar. Vacío = sin banner.", placeholder: "Ej: Reunión GFI el viernes 14/06 a las 10hs en sede COCIR" },
  { clave: "anuncio_color",                   label: "Color del banner",                  categoria: "anuncios",   tipo: "color",    descripcion: "Color de fondo del banner.", placeholder: "#cc0000" },
  { clave: "jus_url_cocir",                   label: "URL del JUS en COCIR",              categoria: "jus",        tipo: "url",      descripcion: "Dirección de la página de COCIR con el valor del JUS. Requerida para sincronización automática.", placeholder: "https://..." },
  { clave: "honorarios_venta_propietario_pct",label: "Honorarios venta — propietario (%)",categoria: "honorarios", tipo: "number",   descripcion: "Porcentaje sugerido al propietario.", placeholder: "3" },
  { clave: "honorarios_venta_comprador_pct",  label: "Honorarios venta — comprador (%)",  categoria: "honorarios", tipo: "number",   descripcion: "Porcentaje sugerido al comprador.", placeholder: "3" },
  { clave: "honorarios_alquiler_meses",       label: "Honorarios alquiler (meses)",       categoria: "honorarios", tipo: "number",   descripcion: "Meses sugeridos de honorario.", placeholder: "1" },
  { clave: "soporte_whatsapp",                label: "WhatsApp de soporte",               categoria: "contacto",   tipo: "text",     descripcion: "Sin + (ej: 5493413001234).", placeholder: "5493413001234" },
  { clave: "soporte_email",                   label: "Email de soporte",                  categoria: "contacto",   tipo: "email",    descripcion: "Email de contacto para soporte.", placeholder: "soporte@grupoforo..." },
];

const CATEGORIAS_CONF = [
  { key: "anuncios",   label: "Anuncios globales" },
  { key: "jus",        label: "Valor JUS" },
  { key: "honorarios", label: "Honorarios sugeridos" },
  { key: "contacto",   label: "Contacto y soporte" },
];

const CBU_CONFIG = [
  { clave: "cbu_titular", label: "Titular CBU/CVU", placeholder: "Nombre completo" },
  { clave: "cbu_cvu", label: "CVU/CBU", placeholder: "0000003100..." },
  { clave: "cbu_alias", label: "Alias", placeholder: "foroinmobiliario.gp" },
  { clave: "cbu_cuit", label: "CUIT/CUIL", placeholder: "20-12345678-9" },
  { clave: "cbu_banco", label: "Banco", placeholder: "Mercado Pago" },
];

const ESTADO_BADGE: Record<string, string> = { pendiente: "badge-pendiente", aprobado: "badge-aprobado", rechazado: "badge-rechazado" };
const CATEGORIAS = [
  { value: "standard", label: "Standard", color: "rgba(148,163,184,0.8)" },
  { value: "vip", label: "VIP", color: "#eab308" },
  { value: "ci_cocir", label: "CI COCIR", color: "#3b82f6" },
  { value: "colaborador_ci", label: "Colaborador CI", color: "#06b6d4" },
  { value: "admin_ayudante", label: "Admin Ayudante", color: "#f97316" },
  { value: "master", label: "Máster", color: "#cc0000" },
];
const ESTADO_LABEL: Record<string, string> = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
const MONEDAS_OPCIONES = ["USD", "EUR", "GBP", "BRL", "USDT", "USDC"];
const FORM_PROV_VACIO = { nombre: "", contacto_whatsapp: "", contacto_email: "", monedas: [] as string[], servicios: "", compra_usd: "", venta_usd: "" };
const ROL_LABELS: Record<string, string> = { colaborador: "Colaborador", asistente: "Asistente", socio: "Socio" };

function CobrosMatchesAdmin() {
  const [mirItems, setMirItems] = useState<any[]>([]);
  const [divisasItems, setDivisasItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const [{ data: mir }, { data: div }] = await Promise.all([
        supabase.from("mir_desbloqueos").select("*, perfiles:user_id(nombre, apellido, matricula, email)").order("created_at", { ascending: false }).limit(50),
        supabase.from("divisas_accesos").select("*, accedido:accedido_por(nombre, apellido, matricula, email)").order("created_at", { ascending: false }).limit(50),
      ]);
      setMirItems(mir ?? []);
      setDivisasItems(div ?? []);
      setLoading(false);
    };
    cargar();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
  const fmtDate = (s: string) => new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  const total = [...mirItems, ...divisasItems].reduce((acc, x) => acc + (x.monto ?? 0), 0);

  return (
    <div style={{ marginBottom: 32 }}>
      <div className="adm-ind-titulo">Cobros <span>por matches</span></div>
      <div className="adm-ind-subtitulo">Registros de accesos a contactos (MIR + Divisas). Todos pagan por transferencia.</div>
      {loading ? <div style={{ color: "rgba(255,255,255,0.3)", padding: 16 }}>Cargando...</div> : (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "12px 20px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Total acumulado</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>{fmt(total)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px 20px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>MIR</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{mirItems.length} accesos</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px 20px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Divisas</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{divisasItems.length} accesos</div>
            </div>
          </div>
          {mirItems.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8, fontFamily: "Montserrat,sans-serif" }}>MIR — desbloqueos</div>
              <div className="adm-tabla-wrap"><table className="adm-tabla"><thead><tr><th>Corredor</th><th>Mat.</th><th>Tipo</th><th>Monto</th><th>Fecha</th></tr></thead>
                <tbody>{mirItems.map(x => (<tr key={x.id}><td>{x.perfiles?.apellido}, {x.perfiles?.nombre}</td><td>{x.perfiles?.matricula ?? "—"}</td><td style={{ textTransform: "capitalize" }}>{x.tipo}</td><td style={{ color: "#22c55e", fontWeight: 700 }}>{fmt(x.monto)}</td><td style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{fmtDate(x.created_at)}</td></tr>))}</tbody>
              </table></div>
            </div>
          )}
          {divisasItems.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8, fontFamily: "Montserrat,sans-serif" }}>Divisas — accesos a contacto</div>
              <div className="adm-tabla-wrap"><table className="adm-tabla"><thead><tr><th>Corredor</th><th>Mat.</th><th>Monto</th><th>Fecha</th></tr></thead>
                <tbody>{divisasItems.map(x => (<tr key={x.id}><td>{x.accedido?.apellido}, {x.accedido?.nombre}</td><td>{x.accedido?.matricula ?? "—"}</td><td style={{ color: "#22c55e", fontWeight: 700 }}>{fmt(x.monto)}</td><td style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{fmtDate(x.created_at)}</td></tr>))}</tbody>
              </table></div>
            </div>
          )}
          {mirItems.length === 0 && divisasItems.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", padding: 16 }}>Sin cobros registrados todavía.</div>}
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos"|"pendiente"|"aprobado"|"rechazado">("pendiente");
  const [procesando, setProcesando] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState<string | null>(null);
  const [cbuValues, setCbuValues] = useState<Record<string, string>>({});
  const [guardandoCbu, setGuardandoCbu] = useState(false);
  const [cbuOk, setCbuOk] = useState(false);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loadingPagos, setLoadingPagos] = useState(true);
  const [filtroPagos, setFiltroPagos] = useState<"pendiente"|"activa"|"todos">("pendiente");
  const [procesandoPago, setProcesandoPago] = useState<string | null>(null);
  const [notaAdmin, setNotaAdmin] = useState<Record<string, string>>({});
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProv, setLoadingProv] = useState(true);
  const [mostrarFormProv, setMostrarFormProv] = useState(false);
  const [formProv, setFormProv] = useState(FORM_PROV_VACIO);
  const [guardandoProv, setGuardandoProv] = useState(false);
  const [editandoProv, setEditandoProv] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [filtroDocs, setFiltroDocs] = useState<"pendiente"|"aprobado"|"rechazado">("pendiente");
  const [procesandoDoc, setProcesandoDoc] = useState<string | null>(null);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loadingNot, setLoadingNot] = useState(true);
  const [filtroNot, setFiltroNot] = useState<"pendiente"|"aprobado"|"rechazado">("pendiente");
  const [procesandoNot, setProcesandoNot] = useState<string | null>(null);
  // Eventos propuestos
  const [eventosPropuestos, setEventosPropuestos] = useState<EventoPropuesto[]>([]);
  const [loadingEvProp, setLoadingEvProp] = useState(true);
  const [procesandoEvProp, setProcesandoEvProp] = useState<string | null>(null);
  // Colaboradores
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loadingColab, setLoadingColab] = useState(true);
  const [filtroColab, setFiltroColab] = useState<"pendiente"|"activo"|"suspendido"|"todos">("pendiente");
  const [procesandoColab, setProcesandoColab] = useState<string | null>(null);
  // Stats colaboradores
  const [statsColab, setStatsColab] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  // Redes sociales
  const [redesConfig, setRedesConfig] = useState<Record<string,string>>({});
  const [guardandoRedes, setGuardandoRedes] = useState(false);
  const [toast, setToast] = useState<{msg: string; tipo: "ok"|"err"} | null>(null);
  // Sync / Import COCIR
  const [syncingCocir, setSyncingCocir] = useState(false);
  const [syncCocirRes, setSyncCocirRes] = useState<{ ok: boolean; total?: number; error?: string } | null>(null);
  const [importandoPadron, setImportandoPadron] = useState(false);
  const [importPadronRes, setImportPadronRes] = useState<{ ok: boolean; total?: number; error?: string; columnas_detectadas?: any } | null>(null);
  // MI ABONO INTELIGENTE config
  const [bonifConfig, setBonifConfig] = useState<{id:string;accion:string;descuento_usd:number;descripcion:string|null}[]>([]);
  const [editandoBonif, setEditandoBonif] = useState<Record<string,string>>({});
  const [guardandoBonif, setGuardandoBonif] = useState<string|null>(null);
  const [denuncias, setDenuncias] = useState<{id:string;tipo_contenido:string;contenido_id:string;motivo:string;descripcion:string|null;estado:string;created_at:string}[]>([]);
  // Push broadcast
  const [pushForm, setPushForm] = useState({ titulo: "", cuerpo: "", url: "", filtro: "todos" });
  const [enviandoPush, setEnviandoPush] = useState(false);
  const [pushRes, setPushRes] = useState<{ ok: boolean; enviados?: number; error?: string } | null>(null);
  const [broadcasts, setBroadcasts] = useState<{id:string;titulo:string;cuerpo:string;url:string|null;filtro:string;enviados:number;created_at:string}[]>([]);
  // Free period
  const [freeUntil, setFreeUntil] = useState("");
  const [guardandoFree, setGuardandoFree] = useState(false);
  const [freeOk, setFreeOk] = useState(false);
  const [notificandoPromo, setNotificandoPromo] = useState(false);
  const [mirGratuito, setMirGratuito] = useState(false);
  const [guardandoMirGratuito, setGuardandoMirGratuito] = useState(false);
  // Configuración del sitio
  const [configuracion, setConfiguracion] = useState<Record<string, string>>({});
  const [editandoConf, setEditandoConf] = useState<Record<string, string>>({});
  const [guardandoConf, setGuardandoConf] = useState<string | null>(null);
  const [sincronizandoJus, setSincronizandoJus] = useState(false);
  const [jusActualizadoAt, setJusActualizadoAt] = useState<string | null>(null);

  useEffect(() => {
    const verificar = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", userData.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      setEsAdmin(true);
      setAdminId(userData.user.id);
      cargarPerfiles(); cargarIndicadores(); cargarPagos(); cargarProveedores(); cargarCbu();
      cargarDocumentos("pendiente"); cargarNoticias("pendiente"); cargarColaboradores("pendiente"); cargarEventosPropuestos(); cargarStatsColab(); cargarBonifConfig();
      cargarBroadcasts(); cargarFreeUntil(); cargarMirGratuito(); cargarConfiguracion();
      const { data: den } = await supabase.from("denuncias").select("id,tipo_contenido,contenido_id,motivo,descripcion,estado,created_at").eq("estado","pendiente").order("created_at", { ascending: false }).limit(20);
      setDenuncias((den ?? []) as typeof denuncias);
      const { data: adminSocial } = await supabase.from("perfiles").select("configuracion").eq("tipo", "admin").limit(1).single();
      setRedesConfig(adminSocial?.configuracion?.redes_sociales ?? {});
    };
    verificar();
  }, []);

  const cargarEventosPropuestos = async () => {
    setLoadingEvProp(true);
    const { data } = await supabase
      .from("eventos")
      .select("*, organizador:perfiles!organizador_id(nombre, apellido, matricula)")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false });
    setEventosPropuestos((data as unknown as EventoPropuesto[]) ?? []);
    setLoadingEvProp(false);
  };

  const aprobarEventoPropuesto = async (ev: EventoPropuesto) => {
    setProcesandoEvProp(ev.id);
    await supabase.from("eventos").update({ estado: "publicado" }).eq("id", ev.id);
    await supabase.from("notificaciones").insert({
      user_id: ev.organizador_id,
      tipo: "evento_aprobado",
      titulo: "Evento aprobado ✓",
      mensaje: `Tu evento "${ev.titulo}" fue aprobado y publicado.`,
      leida: false,
    });
    setProcesandoEvProp(null);
    cargarEventosPropuestos();
  };

  const rechazarEventoPropuesto = async (ev: EventoPropuesto) => {
    if (!confirm(`¿Rechazar "${ev.titulo}"?`)) return;
    setProcesandoEvProp(ev.id);
    await supabase.from("eventos").update({ estado: "cancelado" }).eq("id", ev.id);
    await supabase.from("notificaciones").insert({
      user_id: ev.organizador_id,
      tipo: "evento_rechazado",
      titulo: "Propuesta no aprobada",
      mensaje: `Tu propuesta de evento "${ev.titulo}" no fue aprobada. Podés contactar al admin.`,
      leida: false,
    });
    setProcesandoEvProp(null);
    cargarEventosPropuestos();
  };

  const TIPOS_EV: Record<string, string> = { gfi: "GFI®", cocir: "COCIR", cir: "CIR", comercial: "Comercial", privado: "Privado", externo: "Externo" };

  const cargarStatsColab = async () => {
    setLoadingStats(true);
    const { data: colabs } = await supabase.from("perfiles").select("id, nombre, apellido, matricula, tipo").in("tipo", ["colaborador", "corredor"]).order("nombre");
    if (!colabs) { setLoadingStats(false); return; }
    const stats = await Promise.all(colabs.map(async (c: any) => {
      const [{ count: nContacts }, { count: nInts }, { count: nNegocios }] = await Promise.all([
        supabase.from("crm_contactos").select("id", { count: "exact", head: true }).eq("perfil_id", c.id),
        supabase.from("crm_interacciones").select("id", { count: "exact", head: true }).eq("perfil_id", c.id),
        supabase.from("crm_negocios").select("id", { count: "exact", head: true }).eq("perfil_id", c.id),
      ]);
      return { ...c, nContacts: nContacts ?? 0, nInts: nInts ?? 0, nNegocios: nNegocios ?? 0 };
    }));
    setStatsColab(stats);
    setLoadingStats(false);
  };

  const cargarColaboradores = async (estado: string) => {
    setLoadingColab(true);
    const query = estado === "todos"
      ? supabase.from("colaboradores").select("*, corredor:perfiles!corredor_id(nombre, apellido, matricula, email)").order("created_at", { ascending: false })
      : supabase.from("colaboradores").select("*, corredor:perfiles!corredor_id(nombre, apellido, matricula, email)").eq("estado", estado).order("created_at", { ascending: false });
    const { data } = await query;
    setColaboradores((data as unknown as Colaborador[]) ?? []);
    setLoadingColab(false);
  };

  useEffect(() => { if (esAdmin) cargarColaboradores(filtroColab); }, [filtroColab, esAdmin]);

  const aprobarColaborador = async (c: Colaborador) => {
    setProcesandoColab(c.id);
    await supabase.from("colaboradores").update({ estado: "activo", activado_at: new Date().toISOString() }).eq("id", c.id);
    // Activar perfil del colaborador si tiene user_id
    if (c.user_id) {
      await supabase.from("perfiles").update({ estado: "aprobado" }).eq("id", c.user_id);
    }
    // Notificar al corredor titular
    await supabase.from("notificaciones").insert({
      user_id: c.corredor_id,
      tipo: "colaborador_aprobado",
      titulo: "Colaborador aprobado ✓",
      mensaje: `${c.apellido}, ${c.nombre} fue aprobado como colaborador de tu cuenta.`,
      leida: false,
    });
    // Enviar email al colaborador
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: c.email,
          subject: "✅ Tu acceso a GFI® fue aprobado",
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f0f0f;color:#fff;padding:32px;border-radius:8px;border:1px solid rgba(34,197,94,0.2);"><h2 style="color:#22c55e;margin-bottom:16px;">✅ Acceso aprobado</h2><p style="font-size:15px;color:rgba(255,255,255,0.8);margin-bottom:16px;">Hola <strong>${c.nombre}</strong>, tu acceso a GFI® como colaborador de <strong>${c.corredor?.nombre} ${c.corredor?.apellido}</strong> fue aprobado.</p><p style="font-size:13px;color:rgba(255,255,255,0.5);">Rol: ${ROL_LABELS[c.rol] ?? c.rol}</p><a href="https://www.foroinmobiliario.com.ar/login" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:700;margin-top:20px;">Ingresar a GFI®</a></div>`,
        }),
      });
    } catch {}
    setProcesandoColab(null);
    cargarColaboradores(filtroColab);
  };

  const rechazarColaborador = async (c: Colaborador) => {
    if (!confirm(`¿Rechazar a ${c.nombre} ${c.apellido}?`)) return;
    setProcesandoColab(c.id);
    await supabase.from("colaboradores").update({ estado: "suspendido" }).eq("id", c.id);
    await supabase.from("notificaciones").insert({
      user_id: c.corredor_id,
      tipo: "colaborador_rechazado",
      titulo: "Colaborador no aprobado",
      mensaje: `${c.apellido}, ${c.nombre} no fue aprobado como colaborador. Contactá al admin.`,
      leida: false,
    });
    setProcesandoColab(null);
    cargarColaboradores(filtroColab);
  };

  const setCategoriaUser = async (id: string, categoria: string) => {
    await supabase.from("perfiles").update({ categoria }).eq("id", id);
    setPerfiles(prev => prev.map(p => p.id === id ? { ...p, categoria } : p));
  };

  const setBonificacionUser = async (id: string, bonificacion_pct: number) => {
    if (bonificacion_pct < 0 || bonificacion_pct > 100) return;
    await supabase.from("perfiles").update({ bonificacion_pct }).eq("id", id);
    setPerfiles(prev => prev.map(p => p.id === id ? { ...p, bonificacion_pct } : p));
    if (bonificacion_pct === 100) mostrarToast(`100% bonificado — suscripción siempre activa`);
  };

  const cargarPerfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from("perfiles").select("*").order("created_at", { ascending: false });
    setPerfiles(data ?? []);
    setLoading(false);
  };

  const cargarIndicadores = async () => {
    const claves = INDICADORES_CONFIG.map(i => i.clave);
    const { data } = await supabase.from("indicadores").select("clave, valor, actualizado_at").in("clave", claves);
    if (!data) return;
    const result: Indicador[] = INDICADORES_CONFIG.map(cfg => {
      const row = data.find(r => r.clave === cfg.clave);
      return { clave: cfg.clave, label: cfg.label, valor: row?.valor ?? 0, tipo: cfg.tipo, actualizado_at: row?.actualizado_at ?? null };
    });
    setIndicadores(result);
    const editInit: Record<string, string> = {};
    result.forEach(i => { editInit[i.clave] = i.clave.includes("_usd") ? i.valor.toString() : Number(i.valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); });
    setEditando(editInit);
    const jus = data.find(r => r.clave === "valor_jus");
    if (jus?.actualizado_at) setJusActualizadoAt(jus.actualizado_at);
  };

  const cargarConfiguracion = async () => {
    const { data } = await supabase.from("configuracion_sitio").select("clave, valor");
    if (!data) return;
    const map: Record<string, string> = {};
    data.forEach(r => { map[r.clave] = r.valor ?? ""; });
    setConfiguracion(map);
    setEditandoConf({ ...map });
  };

  const guardarConfiguracion = async (clave: string) => {
    setGuardandoConf(clave);
    await supabase.from("configuracion_sitio").upsert(
      { clave, valor: editandoConf[clave] ?? "", actualizado_at: new Date().toISOString() },
      { onConflict: "clave" }
    );
    setConfiguracion(prev => ({ ...prev, [clave]: editandoConf[clave] ?? "" }));
    setGuardandoConf(null);
    mostrarToast("Guardado", "ok");
  };

  const sincronizarJus = async () => {
    setSincronizandoJus(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/admin/sync-jus", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.ok) {
        mostrarToast(`JUS sincronizado: $ ${Number(json.valor).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`, "ok");
        cargarIndicadores();
      } else {
        mostrarToast(json.error ?? "Error al sincronizar JUS", "err");
      }
    } catch {
      mostrarToast("Error de conexión al sincronizar JUS", "err");
    }
    setSincronizandoJus(false);
  };

  const cargarCbu = async () => {
    const claves = CBU_CONFIG.map(c => c.clave);
    const { data } = await supabase.from("indicadores").select("clave, valor_texto").in("clave", claves);
    if (!data) return;
    const vals: Record<string, string> = {};
    CBU_CONFIG.forEach(c => { vals[c.clave] = (data as any[]).find(r => r.clave === c.clave)?.valor_texto ?? ""; });
    setCbuValues(vals);
  };

  const guardarCbu = async () => {
    setGuardandoCbu(true);
    for (const c of CBU_CONFIG) {
      await supabase.from("indicadores").upsert({ clave: c.clave, valor_texto: cbuValues[c.clave] ?? "", valor: 0 }, { onConflict: "clave" });
    }
    setGuardandoCbu(false); setCbuOk(true); setTimeout(() => setCbuOk(false), 2000);
  };

  const guardarRedes = async () => {
    setGuardandoRedes(true);
    const { data: adminProf } = await supabase.from("perfiles").select("configuracion, id").eq("tipo", "admin").limit(1).single();
    if (adminProf) await supabase.from("perfiles").update({ configuracion: { ...(adminProf.configuracion ?? {}), redes_sociales: redesConfig } }).eq("id", adminProf.id);
    setGuardandoRedes(false);
    mostrarToast("Configuración guardada");
  };

  const mostrarToast = (msg: string, tipo: "ok"|"err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const cargarBroadcasts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/push-broadcast", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const json = await res.json();
    if (json.ok) setBroadcasts(json.broadcasts ?? []);
  };

  const enviarPushBroadcast = async () => {
    if (!pushForm.titulo || !pushForm.cuerpo) return mostrarToast("Completá título y mensaje", "err");
    setEnviandoPush(true); setPushRes(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setEnviandoPush(false); return; }
    try {
      const res = await fetch("/api/admin/push-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(pushForm),
      });
      const json = await res.json();
      setPushRes(json);
      if (json.ok) {
        mostrarToast(`✓ Push enviado a ${json.enviados} dispositivos`);
        setPushForm(p => ({ ...p, titulo: "", cuerpo: "", url: "" }));
        cargarBroadcasts();
      } else mostrarToast(json.error ?? "Error al enviar", "err");
    } catch {
      mostrarToast("Error de conexión", "err");
    }
    setEnviandoPush(false);
  };

  const cargarFreeUntil = async () => {
    const { data } = await supabase.from("indicadores").select("valor_texto").eq("clave", "free_until").maybeSingle();
    setFreeUntil(data?.valor_texto ?? "");
  };

  const cargarMirGratuito = async () => {
    const { data } = await supabase.from("indicadores").select("valor_texto").eq("clave", "mir_gratuito").maybeSingle();
    setMirGratuito(data?.valor_texto === "true");
  };

  const toggleMirGratuito = async () => {
    setGuardandoMirGratuito(true);
    const nuevo = !mirGratuito;
    await supabase.from("indicadores").upsert({ clave: "mir_gratuito", valor_texto: nuevo ? "true" : "false", valor: 0 }, { onConflict: "clave" });
    setMirGratuito(nuevo);
    setGuardandoMirGratuito(false);
    mostrarToast(nuevo ? "Matches MIR gratuitos activados" : "Matches MIR con costo normal");
  };

  const guardarFreeUntil = async () => {
    setGuardandoFree(true);
    await supabase.from("indicadores").upsert({ clave: "free_until", valor_texto: freeUntil || "", valor: 0 }, { onConflict: "clave" });
    setGuardandoFree(false); setFreeOk(true); setTimeout(() => setFreeOk(false), 2000);
    mostrarToast(freeUntil ? `Período gratis hasta ${freeUntil}` : "Período gratuito desactivado");
  };

  const notificarPromo = async () => {
    if (!freeUntil) return;
    setNotificandoPromo(true);
    const fechaFmt = new Date(freeUntil).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    await fetch("/api/admin/push-broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "🎉 Período gratuito activado",
        cuerpo: `Tu acceso a GFI® es gratuito hasta el ${fechaFmt}. ¡Aprovechá todas las funciones sin costo!`,
        url: "/dashboard",
        filtro: "todos",
      }),
    });
    setNotificandoPromo(false);
    mostrarToast("Push enviado a todos los suscriptores");
  };

  const sincronizarCocir = async () => {
    setSyncingCocir(true);
    setSyncCocirRes(null);
    try {
      const res = await fetch("/api/admin/sync-cocir");
      const json = await res.json();
      setSyncCocirRes(json);
      if (json.ok) mostrarToast(`Padrón sincronizado: ${json.total} registros`);
      else mostrarToast(json.error ?? "Error al sincronizar", "err");
    } catch {
      setSyncCocirRes({ ok: false, error: "Error de conexión" });
      mostrarToast("Error de conexión", "err");
    }
    setSyncingCocir(false);
  };

  const importarPadronArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setImportandoPadron(true);
    setImportPadronRes(null);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const res = await fetch("/api/admin/importar-padron", { method: "POST", body: fd });
      const json = await res.json();
      setImportPadronRes(json);
      if (json.ok) mostrarToast(`✓ ${json.insertados ?? 0} nuevos · ${json.actualizados ?? 0} actualizados`);
      else mostrarToast(json.error ?? "Error al importar", "err");
    } catch {
      setImportPadronRes({ ok: false, error: "Error de conexión" });
      mostrarToast("Error de conexión", "err");
    }
    setImportandoPadron(false);
    e.target.value = "";
  };


  const cargarPagos = async () => {
    setLoadingPagos(true);
    const { data } = await supabase.from("suscripciones").select("*, perfiles(nombre, apellido, matricula, email)").order("creado_at", { ascending: false });
    setPagos((data as unknown as Pago[]) ?? []);
    setLoadingPagos(false);
  };

  const cargarProveedores = async () => {
    setLoadingProv(true);
    const { data } = await supabase.from("divisas_proveedores").select("*").order("orden");
    setProveedores(data ?? []);
    setLoadingProv(false);
  };

  const cargarDocumentos = async (estado: string) => {
    setLoadingDocs(true);
    const { data } = await supabase.from("biblioteca").select("*, perfiles(nombre, apellido, matricula)").eq("estado", estado).order("created_at", { ascending: false });
    setDocumentos((data as any) ?? []);
    setLoadingDocs(false);
  };

  const cargarNoticias = async (estado: string) => {
    setLoadingNot(true);
    const { data } = await supabase.from("noticias").select("*, perfiles(nombre, apellido, matricula)").eq("estado", estado).order("created_at", { ascending: false });
    setNoticias((data as any) ?? []);
    setLoadingNot(false);
  };

  useEffect(() => { if (esAdmin) cargarDocumentos(filtroDocs); }, [filtroDocs, esAdmin]);
  useEffect(() => { if (esAdmin) cargarNoticias(filtroNot); }, [filtroNot, esAdmin]);

  const aprobarDoc = async (doc: Documento) => {
    setProcesandoDoc(doc.id);
    await supabase.from("biblioteca").update({ estado: "aprobado" }).eq("id", doc.id);
    await supabase.from("notificaciones").insert({ user_id: doc.user_id, titulo: "Documento aprobado ✓", mensaje: `Tu documento "${doc.nombre}" fue aprobado y ya está disponible en la Biblioteca.`, tipo: "biblioteca", url: "/biblioteca" });
    await cargarDocumentos(filtroDocs); setProcesandoDoc(null);
  };

  const rechazarDoc = async (doc: Documento) => {
    setProcesandoDoc(doc.id);
    await supabase.from("biblioteca").update({ estado: "rechazado" }).eq("id", doc.id);
    await supabase.from("notificaciones").insert({ user_id: doc.user_id, titulo: "Documento no aprobado", mensaje: `Tu documento "${doc.nombre}" no fue aprobado.`, tipo: "biblioteca", url: "/biblioteca" });
    await cargarDocumentos(filtroDocs); setProcesandoDoc(null);
  };

  const aprobarNoticia = async (n: Noticia) => {
    setProcesandoNot(n.id);
    await supabase.from("noticias").update({ estado: "aprobado", aprobado_at: new Date().toISOString(), aprobado_por: adminId }).eq("id", n.id);
    const { data: destinatarios } = await supabase.from("perfiles").select("id").eq("notif_foro", true).neq("id", n.autor_id);
    if (destinatarios && destinatarios.length > 0) {
      await supabase.from("notificaciones").insert(destinatarios.map((p: any) => ({ user_id: p.id, titulo: "📰 Nueva noticia publicada", mensaje: n.titulo, tipo: "noticias", url: "/dashboard" })));
    }
    await cargarNoticias(filtroNot); setProcesandoNot(null);
  };

  const rechazarNoticia = async (id: string) => {
    setProcesandoNot(id);
    await supabase.from("noticias").update({ estado: "rechazado" }).eq("id", id);
    await cargarNoticias(filtroNot); setProcesandoNot(null);
  };

  const toggleDestacado = async (n: Noticia) => {
    await supabase.from("noticias").update({ destacado: !n.destacado }).eq("id", n.id);
    await cargarNoticias(filtroNot);
  };

  const eliminarNoticia = async (id: string) => {
    if (!confirm("¿Eliminar esta noticia?")) return;
    await supabase.from("noticias").delete().eq("id", id);
    await cargarNoticias(filtroNot);
  };

  const confirmarPago = async (pago: Pago) => {
    setProcesandoPago(pago.id);
    const vencimiento = new Date(); vencimiento.setMonth(vencimiento.getMonth() + 1); vencimiento.setDate(vencimiento.getDate() + 3);
    await supabase.from("suscripciones").update({ estado: "activa", fecha_confirmacion: new Date().toISOString().slice(0, 10), fecha_vencimiento: vencimiento.toISOString().slice(0, 10), nota_admin: notaAdmin[pago.id] || null }).eq("id", pago.id);
    await supabase.from("perfiles").update({ estado: "aprobado" }).eq("id", pago.perfil_id);
    if (pago.perfiles?.email) {
      try {
        await fetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: pago.perfiles.email, subject: "✅ Pago confirmado — GFI® Grupo Foro Inmobiliario", html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f0f0f;color:#fff;padding:32px;border-radius:8px;border:1px solid rgba(34,197,94,0.2);"><h2 style="color:#22c55e;margin-bottom:16px;">✅ Pago confirmado</h2><p>Hola <strong>${pago.perfiles.nombre}</strong>, tu pago fue confirmado. Vence el ${vencimiento.toLocaleDateString("es-AR")}.</p></div>` }) });
      } catch {}
    }
    setProcesandoPago(null); cargarPagos();
  };

  const rechazarPago = async (pago: Pago) => {
    if (!confirm("¿Rechazar este pago?")) return;
    setProcesandoPago(pago.id);
    await supabase.from("suscripciones").update({ estado: "rechazado", nota_admin: notaAdmin[pago.id] || null }).eq("id", pago.id);
    setProcesandoPago(null); cargarPagos();
  };

  const guardarIndicador = async (clave: string) => {
    const raw = editando[clave]?.replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(raw);
    if (isNaN(valor)) return;
    setGuardando(clave);
    await supabase.from("indicadores").update({ valor }).eq("clave", clave);
    setGuardando(null); setGuardadoOk(clave); setTimeout(() => setGuardadoOk(null), 2000); cargarIndicadores();
  };

  const cambiarEstado = async (id: string, nuevoEstado: "aprobado" | "rechazado") => {
    setProcesando(id);
    await supabase.from("perfiles").update({ estado: nuevoEstado }).eq("id", id);
    if (nuevoEstado === "aprobado") {
      // Primer mes siempre gratis para nuevos ingresos
      const treintaDias = new Date();
      treintaDias.setDate(treintaDias.getDate() + 30);
      const { data: freeConf } = await supabase.from("indicadores").select("valor_texto").eq("clave", "free_until").maybeSingle();
      const fechaVenc = freeConf?.valor_texto && new Date(freeConf.valor_texto) > treintaDias
        ? freeConf.valor_texto
        : treintaDias.toISOString().slice(0, 10);
      const { data: subExistente } = await supabase.from("suscripciones").select("id").eq("perfil_id", id).maybeSingle();
      if (subExistente) {
        await supabase.from("suscripciones").update({ estado: "activa", fecha_vencimiento: fechaVenc, nota_admin: "Primer mes gratis" }).eq("id", subExistente.id);
      } else {
        await supabase.from("suscripciones").insert({ perfil_id: id, plan: "matriculado", estado: "activa", monto_usd: 0, fecha_vencimiento: fechaVenc, nota_admin: "Primer mes gratis" });
      }
      // Notificación de bienvenida con fecha de inicio de cobro
      const fechaStr = new Date(fechaVenc).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
      await supabase.from("notificaciones").insert({
        user_id: id,
        titulo: "¡Bienvenido a GFI®! 🎉",
        mensaje: `Tu primer mes es gratuito hasta el ${fechaStr}. A partir de esa fecha el costo mensual será de USD 15.`,
        tipo: "suscripcion",
        url: "/suscripcion",
      });
    }
    await cargarPerfiles(); setProcesando(null);
  };

  const toggleInsignia = async (id: string, campo: "insignia_mentor" | "insignia_tasador", valorActual: boolean) => {
    await supabase.from("perfiles").update({ [campo]: !valorActual }).eq("id", id);
    await cargarPerfiles();
  };

  const cargarBonifConfig = async () => {
    const { data } = await supabase.from("bonificaciones_config").select("id,accion,descuento_usd,descripcion").order("accion");
    if (data) setBonifConfig(data as any[]);
  };

  const guardarBonif = async (id: string, accion: string) => {
    const val = editandoBonif[accion];
    if (!val) return;
    setGuardandoBonif(accion);
    await supabase.from("bonificaciones_config").update({ descuento_usd: parseFloat(val.replace(",", ".")) }).eq("id", id);
    await cargarBonifConfig();
    setGuardandoBonif(null);
    mostrarToast("Bonificación actualizada", "ok");
  };

  const guardarProveedor = async () => {
    if (!formProv.nombre) return;
    setGuardandoProv(true);
    const serviciosArr = formProv.servicios.split(",").map(s => s.trim()).filter(Boolean);
    const compra = formProv.compra_usd ? parseFloat(formProv.compra_usd.replace(",", ".")) : null;
    const venta = formProv.venta_usd ? parseFloat(formProv.venta_usd.replace(",", ".")) : null;
    const datos = { nombre: formProv.nombre, contacto_whatsapp: formProv.contacto_whatsapp || null, contacto_email: formProv.contacto_email || null, monedas: formProv.monedas, servicios: serviciosArr, activo: true, compra_usd: compra, venta_usd: venta, actualizado_cot: (compra || venta) ? new Date().toISOString() : null };
    if (editandoProv) { await supabase.from("divisas_proveedores").update(datos).eq("id", editandoProv); }
    else { const maxOrden = proveedores.length > 0 ? Math.max(...proveedores.map(p => p.orden)) + 1 : 0; await supabase.from("divisas_proveedores").insert({ ...datos, orden: maxOrden }); }
    setGuardandoProv(false); setMostrarFormProv(false); setFormProv(FORM_PROV_VACIO); setEditandoProv(null); cargarProveedores();
  };

  const editarProveedor = (p: Proveedor) => { setFormProv({ nombre: p.nombre, contacto_whatsapp: p.contacto_whatsapp ?? "", contacto_email: p.contacto_email ?? "", monedas: p.monedas ?? [], servicios: (p.servicios ?? []).join(", "), compra_usd: p.compra_usd?.toString() ?? "", venta_usd: p.venta_usd?.toString() ?? "" }); setEditandoProv(p.id); setMostrarFormProv(true); };
  const toggleActivoProv = async (p: Proveedor) => { await supabase.from("divisas_proveedores").update({ activo: !p.activo }).eq("id", p.id); cargarProveedores(); };
  const eliminarProveedor = async (id: string) => { if (!confirm("¿Eliminar este proveedor?")) return; await supabase.from("divisas_proveedores").delete().eq("id", id); cargarProveedores(); };
  const toggleMoneda = (m: string) => { setFormProv(prev => ({ ...prev, monedas: prev.monedas.includes(m) ? prev.monedas.filter(x => x !== m) : [...prev.monedas, m] })); };

  const formatARS = (n: number | null) => n !== null ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n) : "—";
  const formatHora = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " · " + new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : null;
  const pagosFiltrados = filtroPagos === "todos" ? pagos : pagos.filter(p => p.estado === filtroPagos);
  const contadoresPagos = { pendiente: pagos.filter(p => p.estado === "pendiente").length, activa: pagos.filter(p => p.estado === "activa").length, todos: pagos.length };
  const perfilesFiltrados = filtro === "todos" ? perfiles : perfiles.filter(p => p.estado === filtro);
  const contadores = { todos: perfiles.length, pendiente: perfiles.filter(p => p.estado === "pendiente").length, aprobado: perfiles.filter(p => p.estado === "aprobado").length, rechazado: perfiles.filter(p => p.estado === "rechazado").length };
  const contadoresColab = { pendiente: colaboradores.filter(c => c.estado === "pendiente").length, activo: colaboradores.filter(c => c.estado === "activo").length, suspendido: colaboradores.filter(c => c.estado === "suspendido").length, todos: colaboradores.length };
  const colaboradoresFiltrados = filtroColab === "todos" ? colaboradores : colaboradores.filter(c => c.estado === filtroColab);
  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const estadoPagoColor = (estado: string) => { if (estado === "activa") return "#22c55e"; if (estado === "pendiente") return "#eab308"; return "#ff4444"; };

  if (!esAdmin) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .adm-root { min-height: 100vh; display: flex; flex-direction: column; background: #0a0a0a; }
        .adm-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .adm-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .adm-topbar-logo span { color: #cc0000; }
        .adm-topbar-right { display: flex; align-items: center; gap: 16px; }
        .adm-topbar-tag { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3); color: #cc0000; }
        .adm-btn-volver { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; text-decoration: none; }
        .adm-btn-volver:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .adm-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 40px; }
        .adm-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .adm-header h1 span { color: #cc0000; }
        .adm-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 6px; }
        .adm-filtros { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
        .adm-filtro-btn { padding: 8px 18px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
        .adm-filtro-btn:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .adm-filtro-btn.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .adm-filtro-count { font-size: 10px; font-weight: 800; background: rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 10px; }
        .adm-filtro-btn.activo .adm-filtro-count { background: rgba(200,0,0,0.3); }
        .adm-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .adm-tabla { width: 100%; border-collapse: collapse; }
        .adm-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .adm-tabla th { padding: 12px 16px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .adm-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .adm-tabla tbody tr:last-child { border-bottom: none; }
        .adm-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .adm-tabla td { padding: 14px 16px; font-size: 13px; color: rgba(255,255,255,0.8); vertical-align: middle; }
        .adm-nombre { font-weight: 500; color: #fff; }
        .adm-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 9px; border-radius: 20px; }
        .badge-pendiente { background: rgba(234,179,8,0.15); border: 1px solid rgba(234,179,8,0.3); color: #eab308; }
        .badge-aprobado { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
        .badge-rechazado { background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.3); color: #ff4444; }
        .badge-activo { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
        .badge-suspendido { background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.3); color: #ff4444; }
        .badge-corredor { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; }
        .badge-colaborador { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.5); }
        .adm-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
        .adm-btn-aprobar { padding: 6px 14px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 3px; color: #22c55e; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .adm-btn-aprobar:hover { background: rgba(34,197,94,0.2); }
        .adm-btn-rechazar { padding: 6px 14px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: #ff4444; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .adm-btn-rechazar:hover { background: rgba(200,0,0,0.18); }
        .adm-btn-destacar { padding: 6px 14px; background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.25); border-radius: 3px; color: #eab308; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .adm-btn-destacar.on { background: rgba(234,179,8,0.2); border-color: #eab308; }
        .adm-btn-eliminar { padding: 6px 14px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.35); font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .adm-btn-eliminar:hover { border-color: rgba(200,0,0,0.3); color: #ff4444; }
        .adm-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .adm-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.25); font-size: 13px; font-style: italic; }
        .adm-loading { padding: 48px; text-align: center; color: rgba(255,255,255,0.25); font-size: 13px; }
        .adm-esp { font-size: 10px; color: rgba(255,255,255,0.35); }
        .adm-nota-input { width: 100%; padding: 6px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; color: rgba(255,255,255,0.6); font-size: 11px; font-family: 'Inter', sans-serif; outline: none; margin-bottom: 6px; }
        .adm-comprobante { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5); }
        .adm-ind-titulo { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 6px; }
        .adm-ind-titulo span { color: #cc0000; }
        .adm-ind-subtitulo { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 24px; }
        .adm-ind-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
        .adm-ind-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 24px; }
        .adm-ind-label { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 12px; }
        .adm-ind-actual { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 14px; }
        .adm-ind-form { display: flex; gap: 8px; align-items: center; }
        .adm-ind-input { flex: 1; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: #fff; font-size: 14px; font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.2s; }
        .adm-ind-input:focus { border-color: rgba(200,0,0,0.5); }
        .adm-ind-btn { padding: 9px 16px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .adm-ind-btn:hover { background: #e60000; }
        .adm-ind-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .adm-ind-ok { font-size: 11px; color: #22c55e; margin-top: 8px; font-family: 'Montserrat', sans-serif; font-weight: 700; }
        .adm-btn-nuevo { padding: 9px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
        .adm-btn-nuevo:hover { background: #e60000; }
        .prov-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .prov-lista { display: flex; flex-direction: column; gap: 10px; }
        .prov-row { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .prov-row.inactivo { opacity: 0.45; }
        .prov-nombre { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 700; color: #fff; }
        .prov-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
        .prov-tag { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; }
        .prov-cot { display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap; }
        .prov-cot-item { font-size: 11px; color: rgba(255,255,255,0.4); }
        .prov-cot-item strong { font-family: 'Montserrat', sans-serif; font-weight: 700; }
        .prov-cot-item.compra strong { color: #60a5fa; }
        .prov-cot-item.venta strong { color: #f87171; }
        .prov-hora { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 4px; }
        .prov-wa { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 4px; }
        .prov-acciones { display: flex; gap: 8px; }
        .prov-btn { padding: 6px 12px; border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .prov-btn-editar { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.5); }
        .prov-btn-editar:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .prov-btn-toggle { background: transparent; border: 1px solid rgba(234,179,8,0.3); color: #eab308; }
        .prov-btn-toggle:hover { background: rgba(234,179,8,0.1); }
        .prov-btn-del { background: transparent; border: 1px solid rgba(200,0,0,0.25); color: #ff4444; }
        .prov-btn-del:hover { background: rgba(200,0,0,0.1); }
        .cbu-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 22px 24px; }
        .cbu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .cbu-field { display: flex; flex-direction: column; gap: 5px; }
        .cbu-label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .cbu-input { padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .cbu-input:focus { border-color: rgba(200,0,0,0.4); }
        .cbu-input::placeholder { color: rgba(255,255,255,0.2); }
        .doc-row { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; display: flex; align-items: flex-start; gap: 14px; margin-bottom: 8px; }
        .doc-icono { width: 40px; height: 40px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .doc-info { flex: 1; min-width: 0; }
        .doc-nombre { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 4px; }
        .doc-meta { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Inter', sans-serif; }
        .doc-desc { font-size: 11px; color: rgba(255,255,255,0.4); font-family: 'Inter', sans-serif; margin-top: 3px; line-height: 1.4; }
        .doc-acciones { display: flex; gap: 8px; flex-shrink: 0; align-items: flex-start; }
        .not-row { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; display: flex; align-items: flex-start; gap: 14px; margin-bottom: 8px; }
        .not-row.dest { border-color: rgba(234,179,8,0.2); }
        .not-img-thumb { width: 72px; height: 54px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
        .not-img-ph { width: 72px; height: 54px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; }
        .modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 32px; width: 100%; max-width: 500px; position: relative; max-height: 90vh; overflow-y: auto; }
        .modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .modal h2 { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 20px; }
        .modal h2 span { color: #cc0000; }
        .modal-field { margin-bottom: 14px; }
        .modal-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-family: 'Montserrat', sans-serif; }
        .modal-label small { font-size: 9px; color: rgba(255,255,255,0.25); letter-spacing: 0; text-transform: none; font-weight: 400; margin-left: 6px; }
        .modal-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .modal-input:focus { border-color: rgba(200,0,0,0.5); }
        .modal-input::placeholder { color: rgba(255,255,255,0.2); }
        .modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-monedas { display: flex; gap: 8px; flex-wrap: wrap; }
        .modal-moneda-btn { padding: 6px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .modal-moneda-btn.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.1); }
        .modal-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 16px 0; }
        .modal-seccion { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 12px; }
        .modal-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
        .modal-btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .modal-btn-save { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .modal-btn-save:hover { background: #e60000; }
        .modal-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .adm-redes-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 22px 24px; }
        .adm-redes-desc { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 20px; line-height: 1.6; }
        .adm-redes-seccion { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin: 18px 0 12px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .adm-redes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .adm-redes-btn { padding: 10px 22px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; margin-top: 8px; }
        .adm-redes-btn:hover { background: #e60000; }
        .adm-redes-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .adm-section-title { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 6px; }
        .adm-section-title span { color: #cc0000; }
        .adm-section-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 20px; }
        .adm-toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; z-index: 999; animation: toastIn 0.3s ease; }
        .adm-toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; }
        .adm-toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 768px) {
          .adm-ind-grid { grid-template-columns: 1fr; }
          .cbu-grid { grid-template-columns: 1fr; }
          .modal-row { grid-template-columns: 1fr; }
          .adm-tabla-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .adm-tabla th, .adm-tabla td { white-space: nowrap; }
          .modal-inner { width: 95vw; max-height: 90vh; }
          .adm-redes-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="adm-root">
        <header className="adm-topbar">
          <div className="adm-topbar-logo"><span>GFI</span>® Admin</div>
          <div className="adm-topbar-right">
            <span className="adm-topbar-tag">Admin Master</span>
            <a className="adm-btn-volver" href="/admin/enlaces" style={{marginRight:6}}>🔗 Gestionar enlaces</a>
            <a className="adm-btn-volver" href="/dashboard">← Dashboard</a>
          </div>
        </header>

        <main className="adm-content">

          {/* ── EVENTOS PROPUESTOS ── */}
          <div>
            <div className="adm-header">
              <h1>Eventos <span>propuestos</span></h1>
              <p>Propuestas de eventos enviadas por corredores. Aprobá para publicar o rechazá.</p>
            </div>
            {loadingEvProp ? <div className="adm-loading">Cargando...</div>
             : eventosPropuestos.length === 0 ? (
              <div className="adm-empty">No hay propuestas de eventos pendientes ✓</div>
             ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {eventosPropuestos.map(ev => (
                  <div key={ev.id} style={{background:"rgba(14,14,14,0.9)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,padding:"16px 20px",display:"flex",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                        <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:800,color:"#fff"}}>{ev.titulo}</span>
                        <span className="badge badge-pendiente">{TIPOS_EV[ev.tipo] ?? ev.tipo}</span>
                        <span className="badge" style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",color:"#22c55e"}}>{ev.gratuito ? "Gratuito" : `$${ev.precio_entrada?.toLocaleString("es-AR")}`}</span>
                      </div>
                      {ev.descripcion && <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:6,lineHeight:1.5}}>{ev.descripcion.substring(0,200)}{ev.descripcion.length > 200 ? "..." : ""}</div>}
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",display:"flex",gap:16,flexWrap:"wrap"}}>
                        <span>📅 {new Date(ev.fecha).toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span>
                        {ev.lugar && <span>📍 {ev.lugar}</span>}
                        {ev.capacidad && <span>👥 Cap. {ev.capacidad}</span>}
                      </div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:6}}>
                        Propuesto por: <strong style={{color:"rgba(255,255,255,0.5)"}}>{ev.organizador?.apellido}, {ev.organizador?.nombre}</strong>
                        {ev.organizador?.matricula && ` · Mat. ${ev.organizador.matricula}`}
                        {" · "}{formatFecha(ev.created_at)}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
                      {procesandoEvProp === ev.id ? <span className="adm-spinner" /> : (<>
                        <button className="adm-btn-aprobar" onClick={() => aprobarEventoPropuesto(ev)}>✓ Publicar</button>
                        <button className="adm-btn-rechazar" onClick={() => rechazarEventoPropuesto(ev)}>✗ Rechazar</button>
                      </>)}
                    </div>
                  </div>
                ))}
              </div>
             )}
          </div>

          {/* ── COLABORADORES PENDIENTES ── */}
          <div>
            <div className="adm-header">
              <h1>Colaboradores <span>pendientes</span></h1>
              <p>Corredores que agregaron colaboradores a sus cuentas. Aprobá para activar el acceso y enviar email de bienvenida.</p>
            </div>
            <div className="adm-filtros">
              {(["pendiente","activo","suspendido","todos"] as const).map(f => (
                <button key={f} className={`adm-filtro-btn${filtroColab === f ? " activo" : ""}`} onClick={() => setFiltroColab(f)}>
                  {f === "pendiente" ? "⏳ Pendientes" : f === "activo" ? "✓ Activos" : f === "suspendido" ? "✗ Suspendidos" : "Todos"}
                  <span className="adm-filtro-count">{contadoresColab[f]}</span>
                </button>
              ))}
            </div>
            <div className="adm-tabla-wrap">
              {loadingColab ? <div className="adm-loading">Cargando...</div>
               : colaboradoresFiltrados.length === 0 ? (
                <div className="adm-empty">
                  {filtroColab === "pendiente" ? "No hay colaboradores pendientes ✓" : "No hay colaboradores en esta categoría."}
                </div>
               ) : (
                <table className="adm-tabla">
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Rol</th>
                      <th>Corredor titular</th>
                      <th>Contacto</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colaboradoresFiltrados.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div className="adm-nombre">{c.apellido}, {c.nombre}</div>
                          {c.notas && <div className="adm-sub">📝 {c.notas}</div>}
                        </td>
                        <td><span className="badge badge-colaborador">{ROL_LABELS[c.rol] ?? c.rol}</span></td>
                        <td>
                          <div className="adm-nombre" style={{fontSize:12}}>{c.corredor?.apellido}, {c.corredor?.nombre}</div>
                          {c.corredor?.matricula && <div className="adm-sub">Mat. {c.corredor.matricula}</div>}
                          {c.corredor?.email && <div className="adm-sub">✉️ {c.corredor.email}</div>}
                        </td>
                        <td>
                          {c.email && <div style={{fontSize:12}}>{c.email}</div>}
                          {c.telefono && <div className="adm-sub">{c.telefono}</div>}
                          {c.dni && <div className="adm-sub">DNI {c.dni}</div>}
                        </td>
                        <td style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{formatFecha(c.created_at)}</td>
                        <td>
                          <span className={`badge badge-${c.estado}`}>
                            {c.estado === "pendiente" ? "⏳ Pendiente" : c.estado === "activo" ? "✓ Activo" : "✗ Suspendido"}
                          </span>
                        </td>
                        <td>
                          {procesandoColab === c.id ? <span className="adm-spinner" /> : (
                            <div className="adm-acciones">
                              {c.estado === "pendiente" && (
                                <button className="adm-btn-aprobar" onClick={() => aprobarColaborador(c)}>✓ Aprobar</button>
                              )}
                              {c.estado === "pendiente" && (
                                <button className="adm-btn-rechazar" onClick={() => rechazarColaborador(c)}>✗ Rechazar</button>
                              )}
                              {c.estado === "activo" && (
                                <button className="adm-btn-rechazar" onClick={() => rechazarColaborador(c)}>Suspender</button>
                              )}
                              {c.estado === "suspendido" && (
                                <button className="adm-btn-aprobar" onClick={() => aprobarColaborador(c)}>Reactivar</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               )}
            </div>
          </div>

          {/* ── MODERACIÓN NOTICIAS ── */}
          <div>
            <div className="adm-header">
              <h1>Moderación <span>Noticias</span></h1>
              <p>Noticias publicadas por los corredores. Al aprobar se envía notificación a todos los que tienen alertas de foro activas.</p>
            </div>
            <div className="adm-filtros">
              {(["pendiente","aprobado","rechazado"] as const).map(f => (
                <button key={f} className={`adm-filtro-btn${filtroNot === f ? " activo" : ""}`} onClick={() => setFiltroNot(f)}>
                  {f === "pendiente" ? "⏳ Pendientes" : f === "aprobado" ? "✓ Aprobadas" : "✗ Rechazadas"}
                </button>
              ))}
            </div>
            {loadingNot ? <div className="adm-loading">Cargando...</div>
             : noticias.length === 0 ? <div className="adm-empty">{filtroNot === "pendiente" ? "No hay noticias pendientes ✓" : filtroNot === "aprobado" ? "No hay noticias aprobadas" : "No hay noticias rechazadas"}</div>
             : noticias.map(n => (
              <div key={n.id} className={`not-row${n.destacado ? " dest" : ""}`}>
                {n.imagen_url ? <img className="not-img-thumb" src={n.imagen_url} alt={n.titulo} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <div className="not-img-ph">📰</div>}
                <div className="doc-info">
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <span className="doc-nombre">{n.titulo}</span>
                    {n.destacado && <span style={{fontSize:9,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:"0.1em",color:"#eab308",background:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.2)",padding:"2px 6px",borderRadius:10}}>⭐ DESTACADA</span>}
                    {n.fuente && <span style={{fontSize:9,color:"rgba(200,0,0,0.6)",fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{n.fuente}</span>}
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.5,marginBottom:6}}>{n.cuerpo?.substring(0,200)}{n.cuerpo?.length > 200 ? "..." : ""}</div>
                  <div className="doc-meta">Por: {n.perfiles?.nombre} {n.perfiles?.apellido}{n.perfiles?.matricula ? ` · Mat. ${n.perfiles.matricula}` : ""} · {formatFecha(n.created_at)}{n.link && <a href={n.link} target="_blank" rel="noopener noreferrer" style={{marginLeft:10,color:"#cc0000",textDecoration:"none",fontSize:10}}>Ver link →</a>}</div>
                </div>
                <div className="doc-acciones" style={{flexDirection:"column",gap:6}}>
                  {procesandoNot === n.id ? <span className="adm-spinner" /> : (<>
                    {n.estado === "pendiente" && <button className="adm-btn-aprobar" onClick={() => aprobarNoticia(n)}>✓ Aprobar</button>}
                    {n.estado === "pendiente" && <button className="adm-btn-rechazar" onClick={() => rechazarNoticia(n.id)}>✗ Rechazar</button>}
                    {n.estado === "aprobado" && <button className={`adm-btn-destacar${n.destacado ? " on" : ""}`} onClick={() => toggleDestacado(n)}>{n.destacado ? "⭐ Quitar" : "☆ Destacar"}</button>}
                    {n.estado === "aprobado" && <button className="adm-btn-rechazar" onClick={() => rechazarNoticia(n.id)}>Bajar</button>}
                    {n.estado === "rechazado" && <button className="adm-btn-aprobar" onClick={() => aprobarNoticia(n)}>↑ Publicar</button>}
                    <button className="adm-btn-eliminar" onClick={() => eliminarNoticia(n.id)}>Eliminar</button>
                  </>)}
                </div>
              </div>
            ))}
          </div>

          {/* ── PAGOS ── */}
          <div>
            <div className="adm-header">
              <h1>Gestión de <span>pagos</span></h1>
              <p>Confirmá o rechazá los pagos declarados. Se envía email automático al corredor.</p>
            </div>
            <div className="adm-filtros">
              {(["pendiente","activa","todos"] as const).map(f => (
                <button key={f} className={`adm-filtro-btn${filtroPagos === f ? " activo" : ""}`} onClick={() => setFiltroPagos(f)}>
                  {f === "pendiente" ? "Pendientes" : f === "activa" ? "Confirmados" : "Todos"}
                  <span className="adm-filtro-count">{contadoresPagos[f]}</span>
                </button>
              ))}
            </div>
            <div className="adm-tabla-wrap">
              {loadingPagos ? <div className="adm-loading">Cargando...</div>
               : pagosFiltrados.length === 0 ? <div className="adm-empty">No hay pagos en esta categoría.</div>
               : <table className="adm-tabla">
                <thead><tr><th>Corredor</th><th>Período</th><th>Monto declarado</th><th>Comprobante</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {pagosFiltrados.map(p => {
                    const color = estadoPagoColor(p.estado);
                    return <tr key={p.id}>
                      <td><div className="adm-nombre">{p.perfiles ? `${p.perfiles.apellido}, ${p.perfiles.nombre}` : "—"}</div><div className="adm-sub">Mat. {p.perfiles?.matricula ?? "—"} · {p.tipo}</div>{p.perfiles?.email && <div className="adm-sub">✉️ {p.perfiles.email}</div>}</td>
                      <td style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:12}}>{p.periodo ?? "—"}</td>
                      <td>{p.monto_declarado_ars ? <div>${p.monto_declarado_ars.toLocaleString("es-AR")}</div> : <div style={{color:"rgba(255,255,255,0.3)"}}>—</div>}<div className="adm-sub">USD {p.monto_usd}</div></td>
                      <td><div className="adm-comprobante">{p.comprobante ?? "—"}</div>{p.cbu_origen && <div className="adm-sub">{p.cbu_origen}</div>}</td>
                      <td style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{p.fecha_pago_declarado ? formatFecha(p.fecha_pago_declarado) : "—"}{p.fecha_confirmacion && <div className="adm-sub">Conf: {formatFecha(p.fecha_confirmacion)}</div>}{p.fecha_vencimiento && <div className="adm-sub">Vence: {formatFecha(p.fecha_vencimiento)}</div>}</td>
                      <td><span className="badge" style={{background:`${color}20`,border:`1px solid ${color}50`,color}}>{p.estado.toUpperCase()}</span></td>
                      <td>{procesandoPago === p.id ? <span className="adm-spinner" /> : p.estado === "pendiente" ? (<div><input className="adm-nota-input" placeholder="Nota interna (opcional)" value={notaAdmin[p.id] ?? ""} onChange={e => setNotaAdmin(prev => ({...prev,[p.id]:e.target.value}))} /><div className="adm-acciones"><button className="adm-btn-aprobar" onClick={() => confirmarPago(p)}>✓ Confirmar</button><button className="adm-btn-rechazar" onClick={() => rechazarPago(p)}>✗ Rechazar</button></div></div>) : <span style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>{p.nota_admin ?? "—"}</span>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>}
            </div>
          </div>

          {/* ── CBU ── */}
          <div>
            <div className="adm-header"><h1>Datos de <span>transferencia</span></h1><p>Los datos que ven los corredores en la página de suscripción.</p></div>
            <div className="cbu-card">
              <div className="cbu-grid">
                {CBU_CONFIG.map(c => (
                  <div key={c.clave} className="cbu-field">
                    <label className="cbu-label">{c.label}</label>
                    <input className="cbu-input" placeholder={c.placeholder} value={cbuValues[c.clave] ?? ""} onChange={e => setCbuValues(prev => ({...prev,[c.clave]:e.target.value}))} />
                  </div>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button className="adm-ind-btn" onClick={guardarCbu} disabled={guardandoCbu}>{guardandoCbu ? "Guardando..." : "Guardar datos de transferencia"}</button>
                {cbuOk && <span className="adm-ind-ok">✓ Guardado</span>}
              </div>
            </div>
          </div>

          {/* ── PROVEEDORES DIVISAS ── */}
          <div>
            <div className="prov-header">
              <div><div className="adm-ind-titulo">Proveedores <span>de divisas</span></div><div className="adm-ind-subtitulo">Cargá los proveedores verificados con sus cotizaciones del día.</div></div>
              <button className="adm-btn-nuevo" onClick={() => { setFormProv(FORM_PROV_VACIO); setEditandoProv(null); setMostrarFormProv(true); }}>+ Nuevo proveedor</button>
            </div>
            {loadingProv ? <div className="adm-loading">Cargando...</div>
             : proveedores.length === 0 ? <div className="adm-empty">No hay proveedores cargados.</div>
             : <div className="prov-lista">
              {proveedores.map(p => (
                <div key={p.id} className={`prov-row${p.activo ? "" : " inactivo"}`}>
                  <div style={{flex:1}}>
                    <div className="prov-nombre">{p.nombre} {!p.activo && <span style={{fontSize:9,color:"#eab308",fontFamily:"Montserrat",fontWeight:700,letterSpacing:"0.1em",marginLeft:8}}>INACTIVO</span>}</div>
                    {p.monedas && p.monedas.length > 0 && <div className="prov-tags">{p.monedas.map((m,i) => <span key={i} className="prov-tag">{m}</span>)}</div>}
                    {(p.compra_usd || p.venta_usd) && <div className="prov-cot">{p.compra_usd && <div className="prov-cot-item compra">Compra: <strong>{formatARS(p.compra_usd)}</strong></div>}{p.venta_usd && <div className="prov-cot-item venta">Venta: <strong>{formatARS(p.venta_usd)}</strong></div>}{p.compra_usd && p.venta_usd && <div className="prov-cot-item">Promedio: <strong style={{color:"#22c55e"}}>{formatARS((p.compra_usd + p.venta_usd) / 2)}</strong></div>}</div>}
                    {p.actualizado_cot && <div className="prov-hora">Act: {formatHora(p.actualizado_cot)}</div>}
                    {p.servicios && p.servicios.length > 0 && <div className="prov-wa">{p.servicios.join(" · ")}</div>}
                    {p.contacto_whatsapp && <div className="prov-wa">📱 {p.contacto_whatsapp}</div>}
                  </div>
                  <div className="prov-acciones">
                    <button className="prov-btn prov-btn-editar" onClick={() => editarProveedor(p)}>Editar</button>
                    <button className="prov-btn prov-btn-toggle" onClick={() => toggleActivoProv(p)}>{p.activo ? "Desactivar" : "Activar"}</button>
                    <button className="prov-btn prov-btn-del" onClick={() => eliminarProveedor(p.id)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>}
          </div>

          {/* ── BIBLIOTECA ── */}
          <div>
            <div className="adm-header"><h1>Moderación <span>Biblioteca</span></h1><p>Documentos subidos por corredores. Al aprobar, el corredor recibe notificación.</p></div>
            <div className="adm-filtros">
              {(["pendiente","aprobado","rechazado"] as const).map(f => (
                <button key={f} className={`adm-filtro-btn${filtroDocs === f ? " activo" : ""}`} onClick={() => setFiltroDocs(f)}>
                  {f === "pendiente" ? "⏳ Pendientes" : f === "aprobado" ? "✓ Aprobados" : "✗ Rechazados"}
                </button>
              ))}
            </div>
            {loadingDocs ? <div className="adm-loading">Cargando...</div>
             : documentos.length === 0 ? <div className="adm-empty">{filtroDocs === "pendiente" ? "No hay documentos pendientes ✓" : "No hay documentos en esta categoría."}</div>
             : documentos.map(doc => (
              <div key={doc.id} className="doc-row">
                <div className="doc-icono">{doc.archivo_url?.includes(".pdf") ? "📄" : doc.archivo_url?.includes(".doc") ? "📝" : "📊"}</div>
                <div className="doc-info">
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}><span className="doc-nombre">{doc.nombre}</span>{doc.nivel && <span style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",padding:"2px 6px",borderRadius:3}}>{doc.nivel}</span>}</div>
                  {doc.descripcion && <div className="doc-desc">{doc.descripcion}</div>}
                  <div className="doc-meta" style={{marginTop:6}}>Por: {doc.perfiles?.nombre} {doc.perfiles?.apellido}{doc.perfiles?.matricula && ` · Mat. ${doc.perfiles.matricula}`} · {new Date(doc.created_at).toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric"})}{doc.archivo_url && <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer" style={{marginLeft:10,color:"#cc0000",textDecoration:"none",fontSize:10}}>Ver archivo →</a>}</div>
                </div>
                {doc.estado === "pendiente" && <div className="doc-acciones">{procesandoDoc === doc.id ? <span className="adm-spinner" /> : (<><button className="adm-btn-aprobar" onClick={() => aprobarDoc(doc)}>✓ Aprobar</button><button className="adm-btn-rechazar" onClick={() => rechazarDoc(doc)}>✗ Rechazar</button></>)}</div>}
              </div>
            ))}
          </div>

          {/* ── SOLICITUDES REGISTRO ── */}
          <div>
            <div className="adm-header"><h1>Solicitudes de <span>registro</span></h1><p>Revisá y aprobá o rechazá cada solicitud manualmente.</p></div>
            <div className="adm-filtros">
              {(["pendiente","aprobado","rechazado","todos"] as const).map(f => (
                <button key={f} className={`adm-filtro-btn${filtro === f ? " activo" : ""}`} onClick={() => setFiltro(f)}>
                  {f === "todos" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="adm-filtro-count">{contadores[f]}</span>
                </button>
              ))}
            </div>
            <div className="adm-tabla-wrap">
              {loading ? <div className="adm-loading">Cargando...</div>
               : perfilesFiltrados.length === 0 ? <div className="adm-empty">No hay solicitudes en esta categoría.</div>
               : <table className="adm-tabla">
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Categoría / Bonif.</th><th>Matrícula / DNI</th><th>Contacto</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {perfilesFiltrados.map(p => {
                    const cat = CATEGORIAS.find(c => c.value === (p.categoria ?? "standard")) ?? CATEGORIAS[0];
                    const bonif = p.bonificacion_pct ?? 0;
                    return (
                    <tr key={p.id}>
                      <td><div className="adm-nombre">{p.apellido}, {p.nombre}</div>{p.inmobiliaria && <div className="adm-sub">{p.inmobiliaria}</div>}{p.especialidades && p.especialidades.length > 0 && <div className="adm-esp">📌 {p.especialidades.join(", ")}</div>}</td>
                      <td><span className={`badge badge-${p.tipo}`}>{p.tipo === "corredor" ? "Corredor" : p.tipo === "colaborador" ? "Colaborador" : "Admin"}</span></td>
                      <td>
                        <select
                          value={p.categoria ?? "standard"}
                          onChange={e => setCategoriaUser(p.id, e.target.value)}
                          style={{ background: "#0f172a", color: cat.color, border: `1px solid ${cat.color}44`, borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer", marginBottom: 4, width: "100%" }}
                        >
                          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number" min={0} max={100}
                            defaultValue={bonif}
                            onBlur={e => setBonificacionUser(p.id, Number(e.target.value))}
                            style={{ width: 50, background: "#0f172a", color: bonif === 100 ? "#22c55e" : "rgba(255,255,255,0.6)", border: `1px solid ${bonif === 100 ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)"}`, borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: "Montserrat,sans-serif", textAlign: "center" }}
                          />
                          <span style={{ fontSize: 10, color: bonif === 100 ? "#22c55e" : "rgba(255,255,255,0.3)" }}>% bonif{bonif === 100 ? " ✓ gratis" : ""}</span>
                        </div>
                      </td>
                      <td>{p.matricula && <div>Mat. {p.matricula}</div>}{p.dni && <div>DNI {p.dni}</div>}</td>
                      <td>{p.telefono && <div>{p.telefono}</div>}{p.email && <div className="adm-sub">{p.email}</div>}</td>
                      <td style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{formatFecha(p.created_at)}</td>
                      <td><span className={`badge ${ESTADO_BADGE[p.estado] ?? "badge-pendiente"}`}>{ESTADO_LABEL[p.estado] ?? p.estado}</span></td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {procesando === p.id ? <span className="adm-spinner" /> : p.estado === "pendiente" ? (<div className="adm-acciones"><button className="adm-btn-aprobar" onClick={() => cambiarEstado(p.id, "aprobado")}>✓ Aprobar</button><button className="adm-btn-rechazar" onClick={() => cambiarEstado(p.id, "rechazado")}>✗ Rechazar</button></div>) : p.estado === "aprobado" ? (<button className="adm-btn-rechazar" onClick={() => cambiarEstado(p.id, "rechazado")}>Revocar</button>) : (<button className="adm-btn-aprobar" onClick={() => cambiarEstado(p.id, "aprobado")}>Reactivar</button>)}
                          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                            <button onClick={() => toggleInsignia(p.id, "insignia_mentor", !!p.insignia_mentor)}
                              style={{ padding: "3px 8px", fontSize: 10, border: `1px solid ${p.insignia_mentor ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.12)"}`, background: p.insignia_mentor ? "rgba(168,85,247,0.12)" : "transparent", borderRadius: 3, color: p.insignia_mentor ? "#a855f7" : "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                              🎓 {p.insignia_mentor ? "Mentor ✓" : "Mentor"}
                            </button>
                            <button onClick={() => toggleInsignia(p.id, "insignia_tasador", !!p.insignia_tasador)}
                              style={{ padding: "3px 8px", fontSize: 10, border: `1px solid ${p.insignia_tasador ? "rgba(234,179,8,0.5)" : "rgba(255,255,255,0.12)"}`, background: p.insignia_tasador ? "rgba(234,179,8,0.1)" : "transparent", borderRadius: 3, color: p.insignia_tasador ? "#eab308" : "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                              ⚖️ {p.insignia_tasador ? "Tasador ✓" : "Tasador"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>}
            </div>
          </div>

          {/* ── COBROS MATCHES ── */}
          <CobrosMatchesAdmin />

          {/* ── INDICADORES ── */}
          <div>
            <div className="adm-ind-titulo">Indicadores <span>y precios</span></div>
            <div className="adm-ind-subtitulo">Actualizá los valores del dashboard y los precios de suscripción.</div>
            <div className="adm-ind-grid">
              {indicadores.map(ind => (
                <div key={ind.clave} className="adm-ind-card">
                  <div className="adm-ind-label">{ind.label}</div>
                  <div className="adm-ind-actual">
                    {ind.clave.includes("_usd") ? `USD ${ind.valor}` : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(Number(ind.valor))}
                  </div>
                  {ind.clave === "valor_jus" && jusActualizadoAt && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>
                      Actualizado: {new Date(jusActualizadoAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  <div className="adm-ind-form">
                    <input className="adm-ind-input" value={editando[ind.clave] ?? ""} onChange={e => setEditando(prev => ({...prev,[ind.clave]:e.target.value}))} onKeyDown={e => { if (e.key === "Enter") guardarIndicador(ind.clave); }} placeholder={ind.clave.includes("_usd") ? "Ej: 15" : "Ej: 5000"} />
                    <button className="adm-ind-btn" onClick={() => guardarIndicador(ind.clave)} disabled={guardando === ind.clave}>{guardando === ind.clave ? "..." : "Guardar"}</button>
                  </div>
                  {ind.clave === "valor_jus" && (
                    <button
                      onClick={sincronizarJus}
                      disabled={sincronizandoJus}
                      style={{ marginTop: 6, padding: "5px 10px", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, color: sincronizandoJus ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)", cursor: sincronizandoJus ? "not-allowed" : "pointer", width: "100%" }}
                    >
                      {sincronizandoJus ? "Sincronizando..." : "↻ Sincronizar desde COCIR"}
                    </button>
                  )}
                  {guardadoOk === ind.clave && <div className="adm-ind-ok">✓ Guardado</div>}
                </div>
              ))}
            </div>
          </div>

          {/* ── PRIMER MES GRATIS / INICIO DE COBRO ── */}
          <div>
            <div className="adm-ind-titulo">Nuevos <span>Ingresos</span></div>
            <div className="adm-ind-subtitulo">
              El primer mes es siempre gratuito para todo nuevo corredor aprobado. Al aprobar, reciben suscripción activa por 30 días y una notificación con la fecha en que empieza el cobro. Podés extender este período indicando una fecha más lejana.
            </div>
            <div className="adm-ind-grid" style={{ maxWidth: 600 }}>
              <div className="adm-ind-card">
                <div className="adm-ind-label">Extender período gratuito hasta</div>
                <div className="adm-ind-actual" style={{ fontSize: 13, marginBottom: 10 }}>
                  {freeUntil && new Date() < new Date(freeUntil)
                    ? <span style={{ color: "#22c55e" }}>🟢 Extendido hasta {new Date(freeUntil).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</span>
                    : <span style={{ color: "rgba(255,255,255,0.3)" }}>Sin extensión — nuevos ingresos tienen 30 días gratis por defecto</span>}
                </div>
                <div className="adm-ind-form">
                  <input type="date" className="adm-ind-input" value={freeUntil} onChange={e => setFreeUntil(e.target.value)} style={{ colorScheme: "dark" }} />
                  <button className="adm-ind-btn" onClick={guardarFreeUntil} disabled={guardandoFree}>{guardandoFree ? "..." : "Guardar"}</button>
                </div>
                {freeOk && <div className="adm-ind-ok">✓ Guardado</div>}
                {freeUntil && new Date() < new Date(freeUntil) && (
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={notificarPromo} disabled={notificandoPromo}
                      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc", fontSize: 11, cursor: "pointer", padding: "6px 14px", borderRadius: 4, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {notificandoPromo ? "Enviando..." : "🔔 Notificar suscriptores"}
                    </button>
                    <button onClick={async () => { setFreeUntil(""); await supabase.from("indicadores").upsert({ clave: "free_until", valor_texto: "", valor: 0 }, { onConflict: "clave" }); mostrarToast("Extensión eliminada"); }}
                      style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                      Quitar extensión
                    </button>
                  </div>
                )}
              </div>
              <div className="adm-ind-card">
                <div className="adm-ind-label">Matches MIR</div>
                <div className="adm-ind-actual" style={{ fontSize: 13, marginBottom: 12 }}>
                  {mirGratuito
                    ? <span style={{ color: "#22c55e" }}>🟢 Gratuitos por el momento</span>
                    : <span style={{ color: "rgba(255,255,255,0.3)" }}>Con costo según tarifa</span>}
                </div>
                <button onClick={toggleMirGratuito} disabled={guardandoMirGratuito}
                  style={{ background: mirGratuito ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${mirGratuito ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`, color: mirGratuito ? "#fca5a5" : "#86efac", fontSize: 11, cursor: "pointer", padding: "6px 14px", borderRadius: 4, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {guardandoMirGratuito ? "..." : mirGratuito ? "Activar cobro" : "Activar gratuito"}
                </button>
              </div>
            </div>
          </div>

          {/* ── MI ABONO INTELIGENTE CONFIG ── */}
          {bonifConfig.length > 0 && (
            <div>
              <div className="adm-ind-titulo">Mi Abono <span>Inteligente</span></div>
              <div className="adm-ind-subtitulo">Configurá los descuentos (en USD) por cada acción bonificable. Se descuentan de la cuota mensual del corredor.</div>
              <div className="adm-ind-grid">
                {bonifConfig.map(b => (
                  <div key={b.id} className="adm-ind-card">
                    <div className="adm-ind-label" style={{ textTransform: "capitalize" }}>{b.accion}</div>
                    {b.descripcion && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, lineHeight: 1.4 }}>{b.descripcion}</div>}
                    <div className="adm-ind-actual">USD {b.descuento_usd}/acción</div>
                    <div className="adm-ind-form">
                      <input className="adm-ind-input" value={editandoBonif[b.accion] ?? ""} onChange={e => setEditandoBonif(prev => ({ ...prev, [b.accion]: e.target.value }))} placeholder="Ej: 1.50" />
                      <button className="adm-ind-btn" onClick={() => guardarBonif(b.id, b.accion)} disabled={guardandoBonif === b.accion}>{guardandoBonif === b.accion ? "..." : "Guardar"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DENUNCIAS ── */}
          {denuncias.length > 0 && (
            <div>
              <div className="adm-ind-titulo">Denuncias <span>Pendientes</span></div>
              <div className="adm-ind-subtitulo">Revisá y moderá el contenido denunciado por los corredores.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {denuncias.map(d => (
                  <div key={d.id} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: 13 }}>⚑ {d.tipo_contenido} · Motivo: {d.motivo}</div>
                      {d.descripcion && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{d.descripcion}</div>}
                      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 4 }}>ID: {d.contenido_id.slice(0, 12)}... · {new Date(d.created_at).toLocaleDateString("es-AR")}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={async () => { await supabase.from("denuncias").update({ estado: "resuelto" }).eq("id", d.id); setDenuncias(prev => prev.filter(x => x.id !== d.id)); }}
                        style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        Resuelto
                      </button>
                      <button onClick={async () => { await supabase.from("denuncias").update({ estado: "rechazado" }).eq("id", d.id); setDenuncias(prev => prev.filter(x => x.id !== d.id)); }}
                        style={{ background: "transparent", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PADRÓN COCIR ── */}
          <div>
            <div className="adm-ind-titulo">Padrón <span>COCIR</span></div>
            <div className="adm-ind-subtitulo" style={{ marginBottom: 16 }}>
              Importá el Excel/CSV del padrón COCIR para tenerlo disponible en el sistema. Cuando ingresen nuevos matriculados, importá el archivo actualizado y el sistema lo reemplaza automáticamente.
            </div>

            {/* Import desde archivo */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer",
                padding: "10px 20px", borderRadius: 4, fontFamily: "Montserrat,sans-serif",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                background: importandoPadron ? "rgba(255,255,255,0.04)" : "rgba(200,0,0,0.12)",
                border: "1px solid rgba(200,0,0,0.4)", color: importandoPadron ? "rgba(255,255,255,0.4)" : "#fff",
                pointerEvents: importandoPadron ? "none" : "auto",
              }}>
                {importandoPadron
                  ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Importando...</>
                  : "📂 Importar Excel / CSV del padrón"}
                <input type="file" accept=".xlsx,.xls,.csv,.ods" onChange={importarPadronArchivo} style={{ display: "none" }} />
              </label>
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>
                Formatos soportados: .xlsx · .xls · .csv — Columnas detectadas automáticamente por nombre (matrícula, apellido, nombre, estado, inmobiliaria, etc.)
              </div>
            </div>

            {/* Resultado import */}
            {importPadronRes && (
              <div style={{
                padding: "12px 16px", borderRadius: 4, marginBottom: 12,
                background: importPadronRes.ok ? "rgba(34,197,94,0.06)" : "rgba(200,0,0,0.06)",
                border: `1px solid ${importPadronRes.ok ? "rgba(34,197,94,0.2)" : "rgba(200,0,0,0.2)"}`,
                fontSize: 12, fontFamily: "Inter,sans-serif",
                color: importPadronRes.ok ? "#22c55e" : "#ff6666",
              }}>
                {importPadronRes.ok ? (
                  <>
                    ✓ <strong>{(importPadronRes as any).insertados ?? 0} nuevos</strong> agregados · <strong>{(importPadronRes as any).actualizados ?? 0} actualizados</strong> ({importPadronRes.total} total).
                    {importPadronRes.columnas_detectadas && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                        Columnas detectadas: matrícula={importPadronRes.columnas_detectadas.matricula} · apellido={importPadronRes.columnas_detectadas.apellido} · nombre={importPadronRes.columnas_detectadas.nombre}
                        {importPadronRes.columnas_detectadas.estado && ` · estado=${importPadronRes.columnas_detectadas.estado}`}
                      </div>
                    )}
                  </>
                ) : `✗ ${importPadronRes.error}`}
              </div>
            )}

            {/* Sync automático desde web (secundario) */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>Sync web (experimental):</span>
              <button
                className="adm-ind-btn"
                onClick={sincronizarCocir}
                disabled={syncingCocir}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, padding: "6px 14px" }}
              >
                {syncingCocir
                  ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Sincronizando...</>
                  : "↺ Sincronizar desde cocir.org.ar"}
              </button>
              {syncCocirRes && (
                <span style={{
                  fontSize: 11, fontFamily: "Inter,sans-serif",
                  color: syncCocirRes.ok ? "#22c55e" : "#ff6666",
                }}>
                  {syncCocirRes.ok ? `✓ ${syncCocirRes.total} registros` : `✗ ${syncCocirRes.error}`}
                </span>
              )}
            </div>
          </div>

          {/* ── BENEFICIOS & DESCUENTOS ── */}
          {adminId && (
            <div style={{marginTop:32}}>
              <AdminBeneficios adminId={adminId} />
            </div>
          )}

          {/* ── Estadísticas por usuario ── */}
          <div style={{marginTop:32}}>
            <div style={{fontFamily:"Montserrat,sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.35)",marginBottom:14}}>Actividad CRM por usuario</div>
            {loadingStats ? <div style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>Cargando...</div> : statsColab.length === 0 ? <div style={{color:"rgba(255,255,255,0.2)",fontSize:12}}>No hay datos.</div> : (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"Inter,sans-serif",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                      {["Nombre","Tipo","Contactos","Interacciones","Negocios","Actividad"].map(h => (
                        <th key={h} style={{padding:"8px 12px",textAlign:"left",color:"rgba(255,255,255,0.3)",fontFamily:"Montserrat,sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {statsColab.map((s: any) => {
                      const actColor = s.nInts > 5 ? "#22c55e" : s.nInts > 0 ? "#eab308" : "#ef4444";
                      return (
                        <tr key={s.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                          <td style={{padding:"10px 12px",color:"#fff"}}>{s.nombre} {s.apellido}</td>
                          <td style={{padding:"10px 12px"}}><span style={{padding:"2px 8px",borderRadius:8,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.08em"}}>{s.tipo}</span></td>
                          <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.6)"}}>{s.nContacts}</td>
                          <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.6)"}}>{s.nInts}</td>
                          <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.6)"}}>{s.nNegocios}</td>
                          <td style={{padding:"10px 12px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:48,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
                                <div style={{width:`${Math.min(100,(s.nInts/10)*100)}%`,height:"100%",background:actColor,borderRadius:2,transition:"width 0.3s"}} />
                              </div>
                              <span style={{fontSize:10,color:actColor,fontFamily:"Montserrat,sans-serif",fontWeight:700}}>{s.nInts > 5 ? "Alta" : s.nInts > 0 ? "Media" : "Sin act."}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── NOTIFICACIONES PUSH ── */}
          <div>
            <div className="adm-header">
              <h1>🔔 Notificaciones <span>Push</span></h1>
              <p>Enviá notificaciones a todos los corredores que activaron push en su navegador o celular. Útil para anuncios importantes, mantenimiento, eventos, etc.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              {/* Formulario */}
              <div style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "20px 24px" }}>
                <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
                  Nueva notificación
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Título *</div>
                    <input
                      className="adm-ind-input"
                      style={{ width: "100%" }}
                      placeholder="Ej: Actualización de la plataforma"
                      value={pushForm.titulo}
                      onChange={e => setPushForm(p => ({ ...p, titulo: e.target.value }))}
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Mensaje *</div>
                    <textarea
                      className="adm-ind-input"
                      style={{ width: "100%", minHeight: 72, resize: "vertical", fontFamily: "Inter,sans-serif", fontSize: 13 }}
                      placeholder="Ej: Ya está disponible la nueva función de firma digital."
                      value={pushForm.cuerpo}
                      onChange={e => setPushForm(p => ({ ...p, cuerpo: e.target.value }))}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>URL de destino (opcional)</div>
                    <input
                      className="adm-ind-input"
                      style={{ width: "100%" }}
                      placeholder="/dashboard"
                      value={pushForm.url}
                      onChange={e => setPushForm(p => ({ ...p, url: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Destinatarios</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        { k: "todos", label: "Todos" },
                        { k: "30d", label: "Activos 30 días" },
                        { k: "7d", label: "Activos 7 días" },
                      ].map(f => (
                        <button
                          key={f.k}
                          onClick={() => setPushForm(p => ({ ...p, filtro: f.k }))}
                          style={{
                            padding: "5px 14px",
                            background: pushForm.filtro === f.k ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${pushForm.filtro === f.k ? "rgba(200,0,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                            borderRadius: 4, color: pushForm.filtro === f.k ? "#fff" : "rgba(255,255,255,0.4)",
                            fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, cursor: "pointer",
                            letterSpacing: "0.1em", textTransform: "uppercase",
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="adm-ind-btn"
                    style={{ alignSelf: "flex-start", padding: "10px 24px", fontSize: 12 }}
                    onClick={enviarPushBroadcast}
                    disabled={enviandoPush || !pushForm.titulo || !pushForm.cuerpo}
                  >
                    {enviandoPush
                      ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", marginRight: 8 }} />Enviando...</>
                      : "📣 Enviar notificación"}
                  </button>
                  {pushRes && (
                    <div style={{ fontSize: 12, color: pushRes.ok ? "#22c55e" : "#ff6666", fontFamily: "Inter,sans-serif" }}>
                      {pushRes.ok ? `✓ Enviado a ${pushRes.enviados} dispositivo${pushRes.enviados !== 1 ? "s" : ""}` : `✗ ${pushRes.error}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Historial */}
              <div>
                <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                  Últimos envíos
                </div>
                {broadcasts.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, fontStyle: "italic" }}>Sin envíos aún.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {broadcasts.slice(0, 8).map(b => (
                      <div key={b.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "10px 14px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", marginBottom: 2 }}>{b.titulo}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{b.cuerpo}</div>
                        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "rgba(255,255,255,0.25)", flexWrap: "wrap" }}>
                          <span>✉ {b.enviados} dispositivos</span>
                          <span style={{ textTransform: "capitalize" }}>{b.filtro}</span>
                          <span>{new Date(b.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── REDES SOCIALES ── */}
          <div>
            <div className="adm-header">
              <h1>📱 Redes <span>Sociales</span></h1>
              <p>Configurá los tokens para que los eventos publicados aparezcan automáticamente en las redes sociales de GFI.</p>
            </div>
            <div className="adm-redes-card">
              <div className="adm-redes-desc">
                Cuando un admin publica un evento, se intentará publicar automáticamente en las redes configuradas. Si alguna red no tiene token, se omite sin error.
              </div>

              <div className="adm-redes-seccion">Facebook</div>
              <div className="adm-redes-grid">
                <div className="modal-field">
                  <label className="modal-label">Facebook Page ID</label>
                  <input
                    className="modal-input"
                    type="text"
                    value={redesConfig.facebook_page_id ?? ""}
                    onChange={e => setRedesConfig(prev => ({ ...prev, facebook_page_id: e.target.value }))}
                    placeholder="123456789"
                    autoComplete="off"
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Facebook / Instagram Page Token</label>
                  <input
                    className="modal-input"
                    type="password"
                    value={redesConfig.facebook_page_token ?? ""}
                    onChange={e => setRedesConfig(prev => ({ ...prev, facebook_page_token: e.target.value }))}
                    placeholder="Token de página de Meta"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="adm-redes-seccion">Instagram</div>
              <div className="modal-field">
                <label className="modal-label">Instagram User ID</label>
                <input
                  className="modal-input"
                  type="text"
                  value={redesConfig.instagram_user_id ?? ""}
                  onChange={e => setRedesConfig(prev => ({ ...prev, instagram_user_id: e.target.value }))}
                  placeholder="ID de cuenta business de Instagram"
                  autoComplete="off"
                />
              </div>

              <div className="adm-redes-seccion">Twitter / X</div>
              <div className="adm-redes-grid">
                <div className="modal-field">
                  <label className="modal-label">Twitter/X API Key</label>
                  <input
                    className="modal-input"
                    type="text"
                    value={redesConfig.twitter_api_key ?? ""}
                    onChange={e => setRedesConfig(prev => ({ ...prev, twitter_api_key: e.target.value }))}
                    placeholder="API Key"
                    autoComplete="off"
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Twitter/X API Secret</label>
                  <input
                    className="modal-input"
                    type="password"
                    value={redesConfig.twitter_api_secret ?? ""}
                    onChange={e => setRedesConfig(prev => ({ ...prev, twitter_api_secret: e.target.value }))}
                    placeholder="API Secret"
                    autoComplete="off"
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Twitter/X Access Token</label>
                  <input
                    className="modal-input"
                    type="text"
                    value={redesConfig.twitter_access_token ?? ""}
                    onChange={e => setRedesConfig(prev => ({ ...prev, twitter_access_token: e.target.value }))}
                    placeholder="Access Token"
                    autoComplete="off"
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Twitter/X Access Secret</label>
                  <input
                    className="modal-input"
                    type="password"
                    value={redesConfig.twitter_access_secret ?? ""}
                    onChange={e => setRedesConfig(prev => ({ ...prev, twitter_access_secret: e.target.value }))}
                    placeholder="Access Secret"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="adm-redes-seccion">TikTok</div>
              <div className="modal-field">
                <label className="modal-label">TikTok Access Token</label>
                <input
                  className="modal-input"
                  type="password"
                  value={redesConfig.tiktok_access_token ?? ""}
                  onChange={e => setRedesConfig(prev => ({ ...prev, tiktok_access_token: e.target.value }))}
                  placeholder="TikTok Access Token"
                  autoComplete="off"
                />
              </div>

              <button className="adm-redes-btn" onClick={guardarRedes} disabled={guardandoRedes}>
                {guardandoRedes ? "Guardando..." : "Guardar configuración de redes"}
              </button>
            </div>
          </div>

          {/* ── CONFIGURACIÓN DEL SITIO ── */}
          <div>
            <div className="adm-ind-titulo">Configuración <span>del sitio</span></div>
            <div className="adm-ind-subtitulo">Controlá textos, banners, honorarios sugeridos y el sincronizador automático de JUS desde COCIR.</div>
            {CATEGORIAS_CONF.map(cat => {
              const items = CONFIGURACION_SITIO_DEF.filter(c => c.categoria === cat.key);
              return (
                <div key={cat.key} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {cat.label}
                  </div>
                  <div className="adm-ind-grid">
                    {items.map(item => (
                      <div key={item.clave} className="adm-ind-card">
                        <div className="adm-ind-label">{item.label}</div>
                        {item.descripcion && (
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>{item.descripcion}</div>
                        )}
                        {configuracion[item.clave] && item.tipo !== "textarea" && item.tipo !== "color" && (
                          <div className="adm-ind-actual" style={{ fontSize: 12, wordBreak: "break-all" }}>
                            {item.tipo === "color"
                              ? <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 2, background: configuracion[item.clave], border: "1px solid rgba(255,255,255,0.2)", verticalAlign: "middle", marginRight: 6 }} />
                              : null
                            }
                            {configuracion[item.clave]}
                          </div>
                        )}
                        {item.tipo === "color" && configuracion[item.clave] && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 4, background: configuracion[item.clave] || "#cc0000", border: "1px solid rgba(255,255,255,0.15)" }} />
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{configuracion[item.clave]}</span>
                          </div>
                        )}
                        <div className="adm-ind-form" style={{ alignItems: item.tipo === "textarea" ? "flex-start" : "center" }}>
                          {item.tipo === "textarea" ? (
                            <textarea
                              className="adm-ind-input"
                              value={editandoConf[item.clave] ?? ""}
                              onChange={e => setEditandoConf(prev => ({ ...prev, [item.clave]: e.target.value }))}
                              placeholder={item.placeholder}
                              rows={3}
                              style={{ resize: "vertical", fontFamily: "Inter,sans-serif", fontSize: 12, padding: "6px 8px" }}
                            />
                          ) : (
                            <input
                              className="adm-ind-input"
                              type={item.tipo === "color" ? "color" : item.tipo === "number" ? "text" : item.tipo === "url" ? "url" : item.tipo === "email" ? "email" : "text"}
                              value={editandoConf[item.clave] ?? ""}
                              onChange={e => setEditandoConf(prev => ({ ...prev, [item.clave]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter" && item.tipo !== "url") guardarConfiguracion(item.clave); }}
                              placeholder={item.placeholder}
                            />
                          )}
                          <button
                            className="adm-ind-btn"
                            onClick={() => guardarConfiguracion(item.clave)}
                            disabled={guardandoConf === item.clave}
                          >
                            {guardandoConf === item.clave ? "..." : "Guardar"}
                          </button>
                        </div>
                        {item.clave === "jus_url_cocir" && (
                          <button
                            onClick={sincronizarJus}
                            disabled={sincronizandoJus}
                            style={{ marginTop: 8, padding: "7px 12px", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(200,0,0,0.12)", border: "1px solid rgba(200,0,0,0.3)", borderRadius: 3, color: sincronizandoJus ? "rgba(255,255,255,0.3)" : "#cc0000", cursor: sincronizandoJus ? "not-allowed" : "pointer", width: "100%" }}
                          >
                            {sincronizandoJus ? "Sincronizando..." : "↻ Sincronizar JUS ahora"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </main>
      </div>

      {toast && <div className={`adm-toast ${toast.tipo}`}>{toast.msg}</div>}

      {/* MODAL PROVEEDOR */}
      {mostrarFormProv && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormProv(false); }}>
          <div className="modal">
            <h2>{editandoProv ? "Editar" : "Nuevo"} <span>proveedor</span></h2>
            <div className="modal-seccion">Datos del proveedor</div>
            <div className="modal-field"><label className="modal-label">Nombre *</label><input className="modal-input" placeholder="Ej: SAS Cambios" value={formProv.nombre} onChange={e => setFormProv(p => ({...p,nombre:e.target.value}))} /></div>
            <div className="modal-row">
              <div className="modal-field"><label className="modal-label">WhatsApp</label><input className="modal-input" placeholder="5493415551234" value={formProv.contacto_whatsapp} onChange={e => setFormProv(p => ({...p,contacto_whatsapp:e.target.value}))} /></div>
              <div className="modal-field"><label className="modal-label">Email</label><input className="modal-input" placeholder="contacto@..." value={formProv.contacto_email} onChange={e => setFormProv(p => ({...p,contacto_email:e.target.value}))} /></div>
            </div>
            <div className="modal-field"><label className="modal-label">Monedas que opera</label><div className="modal-monedas">{MONEDAS_OPCIONES.map(m => <button key={m} type="button" className={`modal-moneda-btn${formProv.monedas.includes(m) ? " activo" : ""}`} onClick={() => toggleMoneda(m)}>{m}</button>)}</div></div>
            <div className="modal-field"><label className="modal-label">Servicios <small>separados por coma</small></label><input className="modal-input" placeholder="Ej: Transferencias, Cripto" value={formProv.servicios} onChange={e => setFormProv(p => ({...p,servicios:e.target.value}))} /></div>
            <div className="modal-divider" />
            <div className="modal-seccion">Cotización USD/ARS del día</div>
            <div className="modal-row">
              <div className="modal-field"><label className="modal-label">Compra (ARS)</label><input className="modal-input" placeholder="Ej: 1380" value={formProv.compra_usd} onChange={e => setFormProv(p => ({...p,compra_usd:e.target.value}))} /></div>
              <div className="modal-field"><label className="modal-label">Venta (ARS)</label><input className="modal-input" placeholder="Ej: 1420" value={formProv.venta_usd} onChange={e => setFormProv(p => ({...p,venta_usd:e.target.value}))} /></div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => { setMostrarFormProv(false); setEditandoProv(null); }}>Cancelar</button>
              <button className="modal-btn-save" onClick={guardarProveedor} disabled={guardandoProv || !formProv.nombre}>{guardandoProv ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
