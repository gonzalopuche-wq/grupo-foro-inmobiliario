"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Perfil { id: string; tipo: string; estado: string; nombre: string; apellido: string; matricula: string | null; dni: string | null; telefono: string | null; email: string | null; inmobiliaria: string | null; especialidades: string[] | null; created_at: string; }
interface Indicador { clave: string; valor: number | string; label: string; tipo: "number" | "text"; }
interface Pago { id: string; perfil_id: string; tipo: string; monto_usd: number; monto_ars: number | null; monto_declarado_ars: number | null; dolar_ref: number | null; estado: string; fecha_pago_declarado: string | null; fecha_confirmacion: string | null; fecha_vencimiento: string | null; periodo: string | null; comprobante: string | null; cbu_origen: string | null; nota_admin: string | null; creado_at: string; perfiles?: { nombre: string; apellido: string; matricula: string | null; email: string | null; }; }
interface Proveedor { id: string; nombre: string; contacto_whatsapp: string | null; contacto_email: string | null; monedas: string[] | null; servicios: string[] | null; activo: boolean; orden: number; compra_usd: number | null; venta_usd: number | null; actualizado_cot: string | null; }
interface Documento { id: string; nombre: string; descripcion: string; nivel: string; categoria: string; archivo_url: string; estado: string; created_at: string; user_id: string; perfiles: { nombre: string; apellido: string; matricula: string; }; }

const INDICADORES_CONFIG = [
  { clave: "valor_jus", label: "Valor JUS", tipo: "number" as const },
  { clave: "precio_corredor_usd", label: "Precio Corredor (USD)", tipo: "number" as const },
  { clave: "precio_colaborador_usd", label: "Precio Colaborador (USD)", tipo: "number" as const },
  { clave: "costo_match_divisas", label: "Costo Match Divisas (ARS)", tipo: "number" as const },
];

const CBU_CONFIG = [
  { clave: "cbu_titular", label: "Titular CBU/CVU", placeholder: "Nombre completo" },
  { clave: "cbu_cvu", label: "CVU/CBU", placeholder: "0000003100..." },
  { clave: "cbu_alias", label: "Alias", placeholder: "foroinmobiliario.gp" },
  { clave: "cbu_cuit", label: "CUIT/CUIL", placeholder: "20-12345678-9" },
  { clave: "cbu_banco", label: "Banco", placeholder: "Mercado Pago" },
];

const ESTADO_BADGE: Record<string, string> = { pendiente: "badge-pendiente", aprobado: "badge-aprobado", rechazado: "badge-rechazado" };
const ESTADO_LABEL: Record<string, string> = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
const MONEDAS_OPCIONES = ["USD", "EUR", "GBP", "BRL", "USDT", "USDC"];
const FORM_PROV_VACIO = { nombre: "", contacto_whatsapp: "", contacto_email: "", monedas: [] as string[], servicios: "", compra_usd: "", venta_usd: "" };

export default function AdminPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos"|"pendiente"|"aprobado"|"rechazado">("pendiente");
  const [procesando, setProcesando] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
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
  // Biblioteca
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [filtroDocs, setFiltroDocs] = useState<"pendiente"|"aprobado"|"rechazado">("pendiente");
  const [procesandoDoc, setProcesandoDoc] = useState<string | null>(null);

  useEffect(() => {
    const verificar = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", userData.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      setEsAdmin(true);
      cargarPerfiles(); cargarIndicadores(); cargarPagos(); cargarProveedores(); cargarCbu(); cargarDocumentos("pendiente");
    };
    verificar();
  }, []);

  const cargarPerfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from("perfiles").select("*").order("created_at", { ascending: false });
    setPerfiles(data ?? []);
    setLoading(false);
  };

  const cargarIndicadores = async () => {
    const claves = INDICADORES_CONFIG.map(i => i.clave);
    const { data } = await supabase.from("indicadores").select("clave, valor").in("clave", claves);
    if (!data) return;
    const result: Indicador[] = INDICADORES_CONFIG.map(cfg => {
      const row = data.find(r => r.clave === cfg.clave);
      return { clave: cfg.clave, label: cfg.label, valor: row?.valor ?? 0, tipo: cfg.tipo };
    });
    setIndicadores(result);
    const editInit: Record<string, string> = {};
    result.forEach(i => { editInit[i.clave] = i.clave.includes("_usd") ? i.valor.toString() : Number(i.valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); });
    setEditando(editInit);
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
      await supabase.from("indicadores").upsert(
        { clave: c.clave, valor_texto: cbuValues[c.clave] ?? "", valor: 0 },
        { onConflict: "clave" }
      );
    }
    setGuardandoCbu(false);
    setCbuOk(true);
    setTimeout(() => setCbuOk(false), 2000);
  };

  const cargarPagos = async () => {
    setLoadingPagos(true);
    const { data } = await supabase.from("suscripciones")
      .select("*, perfiles(nombre, apellido, matricula, email)")
      .order("creado_at", { ascending: false });
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
    const { data } = await supabase
      .from("biblioteca")
      .select("*, perfiles(nombre, apellido, matricula)")
      .eq("estado", estado)
      .order("created_at", { ascending: false });
    setDocumentos((data as any) ?? []);
    setLoadingDocs(false);
  };

  useEffect(() => { if (esAdmin) cargarDocumentos(filtroDocs); }, [filtroDocs, esAdmin]);

  const aprobarDoc = async (doc: Documento) => {
    setProcesandoDoc(doc.id);
    await supabase.from("biblioteca").update({ estado: "aprobado" }).eq("id", doc.id);
    await supabase.from("notificaciones").insert({
      user_id: doc.user_id,
      titulo: "Documento aprobado ✓",
      mensaje: `Tu documento "${doc.nombre}" fue aprobado y ya está disponible en la Biblioteca.`,
      tipo: "biblioteca",
      url: "/biblioteca",
    });
    await cargarDocumentos(filtroDocs);
    setProcesandoDoc(null);
  };

  const rechazarDoc = async (doc: Documento) => {
    setProcesandoDoc(doc.id);
    await supabase.from("biblioteca").update({ estado: "rechazado" }).eq("id", doc.id);
    await supabase.from("notificaciones").insert({
      user_id: doc.user_id,
      titulo: "Documento no aprobado",
      mensaje: `Tu documento "${doc.nombre}" no fue aprobado. Podés contactar al admin para más información.`,
      tipo: "biblioteca",
      url: "/biblioteca",
    });
    await cargarDocumentos(filtroDocs);
    setProcesandoDoc(null);
  };

  const confirmarPago = async (pago: Pago) => {
    setProcesandoPago(pago.id);
    const vencimiento = new Date();
    vencimiento.setMonth(vencimiento.getMonth() + 1);
    vencimiento.setDate(vencimiento.getDate() + 3);
    await supabase.from("suscripciones").update({
      estado: "activa",
      fecha_confirmacion: new Date().toISOString().slice(0, 10),
      fecha_vencimiento: vencimiento.toISOString().slice(0, 10),
      nota_admin: notaAdmin[pago.id] || null,
    }).eq("id", pago.id);
    await supabase.from("perfiles").update({ estado: "aprobado" }).eq("id", pago.perfil_id);
    if (pago.perfiles?.email) {
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: pago.perfiles.email,
            subject: "✅ Pago confirmado — GFI® Grupo Foro Inmobiliario",
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f0f0f;color:#fff;padding:32px;border-radius:8px;border:1px solid rgba(34,197,94,0.2);"><h2 style="color:#22c55e;margin-bottom:16px;">✅ Pago confirmado</h2><p style="font-size:15px;color:rgba(255,255,255,0.8);margin-bottom:16px;">Hola <strong>${pago.perfiles.nombre}</strong>, tu pago fue confirmado exitosamente.</p><table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;"><tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);width:140px;">Período</td><td style="color:#fff;font-weight:600;">${pago.periodo ?? "—"}</td></tr><tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Monto</td><td style="color:#fff;">USD ${pago.monto_usd}</td></tr><tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Vencimiento</td><td style="color:#22c55e;font-weight:700;">${vencimiento.toLocaleDateString("es-AR")}</td></tr>${notaAdmin[pago.id] ? `<tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);">Nota</td><td style="color:#fff;">${notaAdmin[pago.id]}</td></tr>` : ""}</table><a href="https://www.foroinmobiliario.com.ar/suscripcion" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:700;">Ver mi suscripción</a></div>`,
          }),
        });
      } catch {}
    }
    setProcesandoPago(null);
    cargarPagos();
  };

  const rechazarPago = async (pago: Pago) => {
    if (!confirm("¿Rechazar este pago?")) return;
    setProcesandoPago(pago.id);
    await supabase.from("suscripciones").update({ estado: "rechazado", nota_admin: notaAdmin[pago.id] || null }).eq("id", pago.id);
    if (pago.perfiles?.email) {
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: pago.perfiles.email,
            subject: "⚠️ Pago no confirmado — GFI® Grupo Foro Inmobiliario",
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f0f0f;color:#fff;padding:32px;border-radius:8px;border:1px solid rgba(200,0,0,0.2);"><h2 style="color:#cc0000;margin-bottom:16px;">⚠️ Pago no confirmado</h2><p style="font-size:15px;color:rgba(255,255,255,0.8);margin-bottom:16px;">Hola <strong>${pago.perfiles.nombre}</strong>, no pudimos confirmar tu pago del período <strong>${pago.periodo ?? "—"}</strong>.</p>${notaAdmin[pago.id] ? `<p style="font-size:13px;color:#eab308;background:rgba(234,179,8,0.08);padding:12px;border-radius:4px;margin-bottom:20px;">📋 ${notaAdmin[pago.id]}</p>` : ""}<a href="https://www.foroinmobiliario.com.ar/suscripcion" style="display:inline-block;background:#cc0000;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:700;">Ir a mi suscripción</a></div>`,
          }),
        });
      } catch {}
    }
    setProcesandoPago(null);
    cargarPagos();
  };

  const guardarIndicador = async (clave: string) => {
    const raw = editando[clave]?.replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(raw);
    if (isNaN(valor)) return;
    setGuardando(clave);
    await supabase.from("indicadores").update({ valor }).eq("clave", clave);
    setGuardando(null);
    setGuardadoOk(clave);
    setTimeout(() => setGuardadoOk(null), 2000);
    cargarIndicadores();
  };

  const cambiarEstado = async (id: string, nuevoEstado: "aprobado" | "rechazado") => {
    setProcesando(id);
    await supabase.from("perfiles").update({ estado: nuevoEstado }).eq("id", id);
    await cargarPerfiles();
    setProcesando(null);
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
  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const estadoPagoColor = (estado: string) => { if (estado === "activa") return "#22c55e"; if (estado === "pendiente") return "#eab308"; return "#ff4444"; };

  if (!esAdmin) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
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
        .badge-corredor { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; }
        .badge-colaborador { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.5); }
        .adm-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
        .adm-btn-aprobar { padding: 6px 14px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 3px; color: #22c55e; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .adm-btn-aprobar:hover { background: rgba(34,197,94,0.2); }
        .adm-btn-rechazar { padding: 6px 14px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: #ff4444; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .adm-btn-rechazar:hover { background: rgba(200,0,0,0.18); }
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
      `}</style>

      <div className="adm-root">
        <header className="adm-topbar">
          <div className="adm-topbar-logo"><span>GFI</span>® Admin</div>
          <div className="adm-topbar-right">
            <span className="adm-topbar-tag">Admin Master</span>
            <a className="adm-btn-volver" href="/dashboard">← Dashboard</a>
          </div>
        </header>

        <main className="adm-content">

          {/* PAGOS */}
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
                      <td>
                        <div className="adm-nombre">{p.perfiles ? `${p.perfiles.apellido}, ${p.perfiles.nombre}` : "—"}</div>
                        <div className="adm-sub">Mat. {p.perfiles?.matricula ?? "—"} · {p.tipo}</div>
                        {p.perfiles?.email && <div className="adm-sub">✉️ {p.perfiles.email}</div>}
                      </td>
                      <td style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:12}}>{p.periodo ?? "—"}</td>
                      <td>
                        {p.monto_declarado_ars ? <div>${p.monto_declarado_ars.toLocaleString("es-AR")}</div> : <div style={{color:"rgba(255,255,255,0.3)"}}>—</div>}
                        <div className="adm-sub">USD {p.monto_usd}</div>
                      </td>
                      <td>
                        <div className="adm-comprobante">{p.comprobante ?? "—"}</div>
                        {p.cbu_origen && <div className="adm-sub">{p.cbu_origen}</div>}
                      </td>
                      <td style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>
                        {p.fecha_pago_declarado ? formatFecha(p.fecha_pago_declarado) : "—"}
                        {p.fecha_confirmacion && <div className="adm-sub">Conf: {formatFecha(p.fecha_confirmacion)}</div>}
                        {p.fecha_vencimiento && <div className="adm-sub">Vence: {formatFecha(p.fecha_vencimiento)}</div>}
                      </td>
                      <td><span className="badge" style={{background:`${color}20`,border:`1px solid ${color}50`,color}}>{p.estado.toUpperCase()}</span></td>
                      <td>
                        {procesandoPago === p.id ? <span className="adm-spinner" />
                         : p.estado === "pendiente" ? (
                          <div>
                            <input className="adm-nota-input" placeholder="Nota interna (opcional)" value={notaAdmin[p.id] ?? ""} onChange={e => setNotaAdmin(prev => ({...prev,[p.id]:e.target.value}))} />
                            <div className="adm-acciones">
                              <button className="adm-btn-aprobar" onClick={() => confirmarPago(p)}>✓ Confirmar</button>
                              <button className="adm-btn-rechazar" onClick={() => rechazarPago(p)}>✗ Rechazar</button>
                            </div>
                          </div>
                        ) : <span style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>{p.nota_admin ?? "—"}</span>}
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>}
            </div>
          </div>

          {/* CBU CONFIGURABLE */}
          <div>
            <div className="adm-header">
              <h1>Datos de <span>transferencia</span></h1>
              <p>Los datos que ven los corredores en la página de suscripción.</p>
            </div>
            <div className="cbu-card">
              <div className="cbu-grid">
                {CBU_CONFIG.map(c => (
                  <div key={c.clave} className="cbu-field">
                    <label className="cbu-label">{c.label}</label>
                    <input className="cbu-input" placeholder={c.placeholder} value={cbuValues[c.clave] ?? ""} onChange={e => setCbuValues(prev => ({...prev, [c.clave]: e.target.value}))} />
                  </div>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button className="adm-ind-btn" onClick={guardarCbu} disabled={guardandoCbu}>
                  {guardandoCbu ? "Guardando..." : "Guardar datos de transferencia"}
                </button>
                {cbuOk && <span className="adm-ind-ok">✓ Guardado</span>}
              </div>
            </div>
          </div>

          {/* PROVEEDORES DIVISAS */}
          <div>
            <div className="prov-header">
              <div>
                <div className="adm-ind-titulo">Proveedores <span>de divisas</span></div>
                <div className="adm-ind-subtitulo">Cargá los proveedores verificados con sus cotizaciones del día.</div>
              </div>
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
                    {(p.compra_usd || p.venta_usd) && (
                      <div className="prov-cot">
                        {p.compra_usd && <div className="prov-cot-item compra">Compra: <strong>{formatARS(p.compra_usd)}</strong></div>}
                        {p.venta_usd && <div className="prov-cot-item venta">Venta: <strong>{formatARS(p.venta_usd)}</strong></div>}
                        {p.compra_usd && p.venta_usd && <div className="prov-cot-item">Promedio: <strong style={{color:"#22c55e"}}>{formatARS((p.compra_usd + p.venta_usd) / 2)}</strong></div>}
                      </div>
                    )}
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

          {/* BIBLIOTECA — MODERACIÓN */}
          <div>
            <div className="adm-header">
              <h1>Moderación <span>Biblioteca</span></h1>
              <p>Documentos subidos por corredores. Al aprobar, el corredor recibe notificación y descuento en suscripción.</p>
            </div>
            <div className="adm-filtros">
              {(["pendiente","aprobado","rechazado"] as const).map(f => (
                <button key={f} className={`adm-filtro-btn${filtroDocs === f ? " activo" : ""}`} onClick={() => setFiltroDocs(f)}>
                  {f === "pendiente" ? "⏳ Pendientes" : f === "aprobado" ? "✓ Aprobados" : "✗ Rechazados"}
                </button>
              ))}
            </div>
            {loadingDocs ? (
              <div className="adm-loading">Cargando...</div>
            ) : documentos.length === 0 ? (
              <div className="adm-empty">
                {filtroDocs === "pendiente" ? "No hay documentos pendientes de moderación ✓" :
                 filtroDocs === "aprobado" ? "No hay documentos aprobados aún" :
                 "No hay documentos rechazados"}
              </div>
            ) : (
              documentos.map(doc => (
                <div key={doc.id} className="doc-row">
                  <div className="doc-icono">
                    {doc.archivo_url?.includes(".pdf") ? "📄" : doc.archivo_url?.includes(".doc") ? "📝" : "📊"}
                  </div>
                  <div className="doc-info">
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span className="doc-nombre">{doc.nombre}</span>
                      {doc.nivel && (
                        <span style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",padding:"2px 6px",borderRadius:3}}>
                          {doc.nivel}
                        </span>
                      )}
                    </div>
                    {doc.descripcion && <div className="doc-desc">{doc.descripcion}</div>}
                    <div className="doc-meta" style={{marginTop:6}}>
                      Por: {doc.perfiles?.nombre} {doc.perfiles?.apellido}
                      {doc.perfiles?.matricula && ` · Mat. ${doc.perfiles.matricula}`}
                      {" · "}
                      {new Date(doc.created_at).toLocaleDateString("es-AR", {day:"numeric",month:"short",year:"numeric"})}
                      {doc.archivo_url && (
                        <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                          style={{marginLeft:10,color:"#cc0000",textDecoration:"none",fontSize:10}}>
                          Ver archivo →
                        </a>
                      )}
                    </div>
                  </div>
                  {doc.estado === "pendiente" && (
                    <div className="doc-acciones">
                      {procesandoDoc === doc.id ? (
                        <span className="adm-spinner" />
                      ) : (
                        <>
                          <button className="adm-btn-aprobar" onClick={() => aprobarDoc(doc)}>✓ Aprobar</button>
                          <button className="adm-btn-rechazar" onClick={() => rechazarDoc(doc)}>✗ Rechazar</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* SOLICITUDES REGISTRO */}
          <div>
            <div className="adm-header">
              <h1>Solicitudes de <span>registro</span></h1>
              <p>Revisá y aprobá o rechazá cada solicitud manualmente.</p>
            </div>
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
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Matrícula / DNI</th><th>Contacto</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {perfilesFiltrados.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="adm-nombre">{p.apellido}, {p.nombre}</div>
                        {p.inmobiliaria && <div className="adm-sub">{p.inmobiliaria}</div>}
                        {p.especialidades && p.especialidades.length > 0 && <div className="adm-esp">📌 {p.especialidades.join(", ")}</div>}
                      </td>
                      <td><span className={`badge badge-${p.tipo}`}>{p.tipo === "corredor" ? "Corredor" : p.tipo === "colaborador" ? "Colaborador" : "Admin"}</span></td>
                      <td>{p.matricula && <div>Mat. {p.matricula}</div>}{p.dni && <div>DNI {p.dni}</div>}</td>
                      <td>{p.telefono && <div>{p.telefono}</div>}{p.email && <div className="adm-sub">{p.email}</div>}</td>
                      <td style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{formatFecha(p.created_at)}</td>
                      <td><span className={`badge ${ESTADO_BADGE[p.estado] ?? "badge-pendiente"}`}>{ESTADO_LABEL[p.estado] ?? p.estado}</span></td>
                      <td>
                        {procesando === p.id ? <span className="adm-spinner" />
                         : p.estado === "pendiente" ? (
                          <div className="adm-acciones">
                            <button className="adm-btn-aprobar" onClick={() => cambiarEstado(p.id, "aprobado")}>✓ Aprobar</button>
                            <button className="adm-btn-rechazar" onClick={() => cambiarEstado(p.id, "rechazado")}>✗ Rechazar</button>
                          </div>
                        ) : p.estado === "aprobado" ? (
                          <button className="adm-btn-rechazar" onClick={() => cambiarEstado(p.id, "rechazado")}>Revocar</button>
                        ) : (
                          <button className="adm-btn-aprobar" onClick={() => cambiarEstado(p.id, "aprobado")}>Reactivar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
            </div>
          </div>

          {/* INDICADORES */}
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
                  <div className="adm-ind-form">
                    <input className="adm-ind-input" value={editando[ind.clave] ?? ""} onChange={e => setEditando(prev => ({...prev,[ind.clave]:e.target.value}))} onKeyDown={e => { if (e.key === "Enter") guardarIndicador(ind.clave); }} placeholder={ind.clave.includes("_usd") ? "Ej: 15" : "Ej: 5000"} />
                    <button className="adm-ind-btn" onClick={() => guardarIndicador(ind.clave)} disabled={guardando === ind.clave}>{guardando === ind.clave ? "..." : "Guardar"}</button>
                  </div>
                  {guardadoOk === ind.clave && <div className="adm-ind-ok">✓ Guardado</div>}
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>

      {/* MODAL PROVEEDOR */}
      {mostrarFormProv && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormProv(false); }}>
          <div className="modal">
            <h2>{editandoProv ? "Editar" : "Nuevo"} <span>proveedor</span></h2>
            <div className="modal-seccion">Datos del proveedor</div>
            <div className="modal-field">
              <label className="modal-label">Nombre *</label>
              <input className="modal-input" placeholder="Ej: SAS Cambios" value={formProv.nombre} onChange={e => setFormProv(p => ({...p, nombre: e.target.value}))} />
            </div>
            <div className="modal-row">
              <div className="modal-field">
                <label className="modal-label">WhatsApp</label>
                <input className="modal-input" placeholder="5493415551234" value={formProv.contacto_whatsapp} onChange={e => setFormProv(p => ({...p, contacto_whatsapp: e.target.value}))} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Email</label>
                <input className="modal-input" placeholder="contacto@..." value={formProv.contacto_email} onChange={e => setFormProv(p => ({...p, contacto_email: e.target.value}))} />
              </div>
            </div>
            <div className="modal-field">
              <label className="modal-label">Monedas que opera</label>
              <div className="modal-monedas">
                {MONEDAS_OPCIONES.map(m => (
                  <button key={m} type="button" className={`modal-moneda-btn${formProv.monedas.includes(m) ? " activo" : ""}`} onClick={() => toggleMoneda(m)}>{m}</button>
                ))}
              </div>
            </div>
            <div className="modal-field">
              <label className="modal-label">Servicios <small>separados por coma</small></label>
              <input className="modal-input" placeholder="Ej: Transferencias, Cripto, Payoneer" value={formProv.servicios} onChange={e => setFormProv(p => ({...p, servicios: e.target.value}))} />
            </div>
            <div className="modal-divider" />
            <div className="modal-seccion">Cotización USD/ARS del día</div>
            <div className="modal-row">
              <div className="modal-field">
                <label className="modal-label">Compra (ARS)</label>
                <input className="modal-input" placeholder="Ej: 1380" value={formProv.compra_usd} onChange={e => setFormProv(p => ({...p, compra_usd: e.target.value}))} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Venta (ARS)</label>
                <input className="modal-input" placeholder="Ej: 1420" value={formProv.venta_usd} onChange={e => setFormProv(p => ({...p, venta_usd: e.target.value}))} />
              </div>
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
