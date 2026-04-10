"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Proveedor {
  id: string;
  nombre: string;
  contacto_whatsapp: string | null;
  contacto_email: string | null;
  monedas: string[] | null;
  servicios: string[] | null;
  activo: boolean;
  orden: number;
  cotizacion_raw: string | null;
  cotizacion_datos: Record<string, unknown> | null;
  cotizacion_actualizada_at: string | null;
}

const MONEDAS_OPCIONES = ["USD", "EUR", "GBP", "BRL", "USDT", "USDC"];
const SERVICIOS_OPCIONES = [
  "Transferencias nacionales",
  "Transferencias internacionales",
  "Cripto",
  "Cara chica a cara grande",
  "Pesificación de cheques",
  "Sociedades en EE.UU.",
  "Payoneer",
  "Wise",
  "PayPal",
  "TED/PIX",
];

const MONEDA_FLAG: Record<string, string> = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", BRL: "🇧🇷", USDT: "🔷", USDC: "🔷" };

const FORM_VACIO = {
  nombre: "",
  contacto_whatsapp: "",
  contacto_email: "",
  monedas: [] as string[],
  servicios: [] as string[],
  orden: 0,
};

// Parser de texto de WhatsApp
function parsearMensaje(texto: string): Record<string, unknown> {
  const datos: Record<string, unknown> = {};
  const lineas = texto.split("\n").map(l => l.trim()).filter(Boolean);

  for (const linea of lineas) {
    // USD/ARS - 1375 / 1425 o similar
    const matchUSD = linea.match(/USD\s*[\/\-]?\s*ARS\s*[:\-]?\s*([\d.,]+)\s*[\/\-]\s*([\d.,]+)/i);
    if (matchUSD) { datos.usd_compra = parseFloat(matchUSD[1].replace(",", ".")); datos.usd_venta = parseFloat(matchUSD[2].replace(",", ".")); }

    // EUR/ARS
    const matchEUR = linea.match(/EUR\s*[\/\-]?\s*ARS\s*[:\-]?\s*([\d.,]+)\s*[\/\-]\s*([\d.,]+)/i);
    if (matchEUR) { datos.eur_compra = parseFloat(matchEUR[1].replace(",", ".")); datos.eur_venta = parseFloat(matchEUR[2].replace(",", ".")); }

    // EUR/USD
    const matchEURUSD = linea.match(/EUR\s*[\/\-]?\s*USD\s*[:\-]?\s*([\d.,]+)\s*[\/\-]\s*([\d.,]+)/i);
    if (matchEURUSD) { datos.eurusd_compra = parseFloat(matchEURUSD[1].replace(",", ".")); datos.eurusd_venta = parseFloat(matchEURUSD[2].replace(",", ".")); }

    // GBP/ARS
    const matchGBP = linea.match(/GBP\s*[\/\-]?\s*ARS\s*[:\-]?\s*([\d.,]+)\s*[\/\-]\s*([\d.,]+)/i);
    if (matchGBP) { datos.gbp_compra = parseFloat(matchGBP[1].replace(",", ".")); datos.gbp_venta = parseFloat(matchGBP[2].replace(",", ".")); }

    // BRL/ARS
    const matchBRL = linea.match(/BRL\s*[\/\-]?\s*ARS\s*[:\-]?\s*([\d.,]+)\s*[\/\-]\s*([\d.,]+)/i);
    if (matchBRL) { datos.brl_compra = parseFloat(matchBRL[1].replace(",", ".")); datos.brl_venta = parseFloat(matchBRL[2].replace(",", ".")); }

    // USDT/ARS
    const matchUSDT = linea.match(/USDT\s*[\/\-]?\s*ARS\s*[:\-]?\s*([\d.,]+)\s*[\/\-]\s*([\d.,]+)/i);
    if (matchUSDT) { datos.usdt_compra = parseFloat(matchUSDT[1].replace(",", ".")); datos.usdt_venta = parseFloat(matchUSDT[2].replace(",", ".")); }

    // Cara chica
    const matchCaraChica = linea.match(/cara\s*chica\s*[:\-]?\s*([\d.,]+)/i);
    if (matchCaraChica) { datos.cara_chica = parseFloat(matchCaraChica[1].replace(",", ".")); }

    // Transferencias
    if (/transferencia/i.test(linea)) datos.transferencias = true;
    if (/payoneer/i.test(linea)) datos.payoneer = true;
    if (/wise/i.test(linea)) datos.wise = true;
    if (/paypal/i.test(linea)) datos.paypal = true;
    if (/ted|pix/i.test(linea)) datos.ted_pix = true;
    if (/cripto|usdt|usdc/i.test(linea)) datos.cripto = true;
  }

  return datos;
}

// Parser de imagen con Claude API
async function parsearImagen(base64: string, mediaType: string): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 }
          },
          {
            type: "text",
            text: `Sos un parser de cotizaciones de casas de cambio argentinas. Analizá esta imagen y extraé SOLO los datos de cotización en formato JSON. Devolvé ÚNICAMENTE el JSON, sin explicaciones ni markdown.

El JSON debe tener estos campos si están presentes (todos numéricos):
{
  "usd_compra": number,
  "usd_venta": number,
  "eur_compra": number,
  "eur_venta": number,
  "eurusd_compra": number,
  "eurusd_venta": number,
  "gbp_compra": number,
  "gbp_venta": number,
  "gbpusd_compra": number,
  "gbpusd_venta": number,
  "brl_compra": number,
  "brl_venta": number,
  "brlusd_compra": number,
  "brlusd_venta": number,
  "usdt_compra": number,
  "usdt_venta": number,
  "usdc_swap": number,
  "cara_chica": number,
  "transferencias": boolean,
  "payoneer": boolean,
  "wise": boolean,
  "paypal": boolean,
  "ted_pix": boolean
}

Solo incluí los campos que encontrés en la imagen. Si no hay datos, devolvé {}.`
          }
        ]
      }]
    })
  });
  const data = await response.json();
  const texto = data.content?.[0]?.text ?? "{}";
  try { return JSON.parse(texto.replace(/```json|```/g, "").trim()); } catch { return {}; }
}

export default function ProveedoresAdminPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  // Parser
  const [mostrarParser, setMostrarParser] = useState(false);
  const [proveedorParser, setProveedorParser] = useState<Proveedor | null>(null);
  const [modoParser, setModoParser] = useState<"texto" | "imagen">("texto");
  const [textoParser, setTextoParser] = useState("");
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [parsando, setParsando] = useState(false);
  const [datosParseados, setDatosParseados] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const verificar = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      cargarProveedores();
    };
    verificar();
  }, []);

  const cargarProveedores = async () => {
    setLoading(true);
    const { data } = await supabase.from("divisas_proveedores").select("*").order("orden").order("created_at");
    setProveedores(data ?? []);
    setLoading(false);
  };

  const toggleMoneda = (m: string) => setForm(p => ({ ...p, monedas: p.monedas.includes(m) ? p.monedas.filter(x => x !== m) : [...p.monedas, m] }));
  const toggleServicio = (s: string) => setForm(p => ({ ...p, servicios: p.servicios.includes(s) ? p.servicios.filter(x => x !== s) : [...p.servicios, s] }));

  const guardar = async () => {
    if (!form.nombre) return;
    setGuardando(true);
    const payload = {
      nombre: form.nombre,
      contacto_whatsapp: form.contacto_whatsapp || null,
      contacto_email: form.contacto_email || null,
      monedas: form.monedas.length > 0 ? form.monedas : null,
      servicios: form.servicios.length > 0 ? form.servicios : null,
      orden: form.orden,
    };
    if (editandoId) {
      await supabase.from("divisas_proveedores").update(payload).eq("id", editandoId);
    } else {
      await supabase.from("divisas_proveedores").insert({ ...payload, activo: true });
    }
    setGuardando(false);
    setMostrarForm(false);
    setForm(FORM_VACIO);
    setEditandoId(null);
    cargarProveedores();
  };

  const editar = (p: Proveedor) => {
    setForm({ nombre: p.nombre, contacto_whatsapp: p.contacto_whatsapp ?? "", contacto_email: p.contacto_email ?? "", monedas: p.monedas ?? [], servicios: p.servicios ?? [], orden: p.orden });
    setEditandoId(p.id);
    setMostrarForm(true);
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    await supabase.from("divisas_proveedores").update({ activo: !activo }).eq("id", id);
    cargarProveedores();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este proveedor?")) return;
    await supabase.from("divisas_proveedores").delete().eq("id", id);
    cargarProveedores();
  };

  const abrirParser = (p: Proveedor) => {
    setProveedorParser(p);
    setTextoParser(p.cotizacion_raw ?? "");
    setDatosParseados(p.cotizacion_datos ?? null);
    setImagenFile(null);
    setMostrarParser(true);
  };

  const parsear = async () => {
    setParsando(true);
    setDatosParseados(null);
    try {
      if (modoParser === "texto") {
        const datos = parsearMensaje(textoParser);
        setDatosParseados(datos);
      } else if (modoParser === "imagen" && imagenFile) {
        const base64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.onerror = () => rej(new Error("Error al leer imagen"));
          r.readAsDataURL(imagenFile);
        });
        const datos = await parsearImagen(base64, imagenFile.type as "image/jpeg" | "image/png");
        setDatosParseados(datos);
      }
    } catch (e) {
      console.error(e);
    }
    setParsando(false);
  };

  const guardarCotizacion = async () => {
    if (!proveedorParser || !datosParseados) return;
    setParsando(true);
    await supabase.from("divisas_proveedores").update({
      cotizacion_raw: modoParser === "texto" ? textoParser : `[imagen: ${imagenFile?.name}]`,
      cotizacion_datos: datosParseados,
      cotizacion_actualizada_at: new Date().toISOString(),
    }).eq("id", proveedorParser.id);
    setParsando(false);
    setMostrarParser(false);
    cargarProveedores();
  };

  const renderDatos = (datos: Record<string, unknown>) => {
    const campos: { key: string; label: string }[] = [
      { key: "usd_compra", label: "🇺🇸 USD Compra" }, { key: "usd_venta", label: "🇺🇸 USD Venta" },
      { key: "eur_compra", label: "🇪🇺 EUR Compra" }, { key: "eur_venta", label: "🇪🇺 EUR Venta" },
      { key: "eurusd_compra", label: "EUR/USD Compra" }, { key: "eurusd_venta", label: "EUR/USD Venta" },
      { key: "gbp_compra", label: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 GBP Compra" }, { key: "gbp_venta", label: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 GBP Venta" },
      { key: "brl_compra", label: "🇧🇷 BRL Compra" }, { key: "brl_venta", label: "🇧🇷 BRL Venta" },
      { key: "usdt_compra", label: "🔷 USDT Compra" }, { key: "usdt_venta", label: "🔷 USDT Venta" },
      { key: "cara_chica", label: "💵 Cara chica" },
    ];
    const servicios = ["transferencias", "payoneer", "wise", "paypal", "ted_pix", "cripto"];
    return (
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        {campos.filter(c => datos[c.key] !== undefined).map(c => (
          <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>{c.label}</span>
            <span style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#22c55e" }}>
              ${Number(datos[c.key]).toLocaleString("es-AR")}
            </span>
          </div>
        ))}
        {servicios.some(s => datos[s]) && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
            ✓ {servicios.filter(s => datos[s]).map(s => s.replace("_", " ").toUpperCase()).join(" · ")}
          </div>
        )}
      </div>
    );
  };

  const formatFecha = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .pv-root { min-height: 100vh; display: flex; flex-direction: column; }
        .pv-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .pv-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .pv-topbar-logo span { color: #cc0000; }
        .pv-topbar-right { display: flex; gap: 12px; align-items: center; }
        .pv-btn-back { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .pv-btn-back:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .pv-btn-nuevo { padding: 8px 18px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .pv-btn-nuevo:hover { background: #e60000; }
        .pv-content { flex: 1; padding: 32px; max-width: 900px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
        .pv-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .pv-header h1 span { color: #cc0000; }
        .pv-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .pv-lista { display: flex; flex-direction: column; gap: 12px; }
        .pv-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 24px; }
        .pv-card.inactivo { opacity: 0.5; }
        .pv-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .pv-card-info { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .pv-card-nombre { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pv-contacto { font-size: 12px; color: rgba(255,255,255,0.45); display: flex; gap: 16px; flex-wrap: wrap; }
        .pv-monedas { display: flex; gap: 6px; flex-wrap: wrap; }
        .pv-moneda-tag { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; padding: 3px 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; color: rgba(255,255,255,0.6); }
        .pv-acciones { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .pv-btn { padding: 6px 14px; border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .pv-btn-edit { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); }
        .pv-btn-edit:hover { border-color: rgba(255,255,255,0.4); color: #fff; }
        .pv-btn-cot { background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.3); color: #cc0000; }
        .pv-btn-cot:hover { background: rgba(200,0,0,0.2); color: #fff; }
        .pv-btn-toggle { background: transparent; border: 1px solid rgba(234,179,8,0.3); color: #eab308; }
        .pv-btn-toggle:hover { background: rgba(234,179,8,0.1); }
        .pv-btn-del { background: transparent; border: 1px solid rgba(200,0,0,0.3); color: rgba(200,0,0,0.6); }
        .pv-btn-del:hover { background: rgba(200,0,0,0.1); color: #ff4444; }
        .pv-cotizacion-preview { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
        .pv-cotizacion-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .pv-cotizacion-titulo { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .pv-cotizacion-fecha { font-size: 10px; color: rgba(255,255,255,0.25); }
        .pv-empty { padding: 64px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .badge-activo { font-size: 9px; padding: 2px 8px; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); border-radius: 20px; color: #22c55e; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .badge-inactivo { font-size: 9px; padding: 2px 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; color: rgba(255,255,255,0.3); font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .fn-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; }
        .fn-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 36px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; position: relative; }
        .fn-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .fn-modal h2 { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 20px; }
        .fn-modal h2 span { color: #cc0000; }
        .fn-field { margin-bottom: 16px; }
        .fn-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; font-family: 'Montserrat', sans-serif; }
        .fn-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter', sans-serif; }
        .fn-input:focus { border-color: rgba(200,0,0,0.5); }
        .fn-input::placeholder { color: rgba(255,255,255,0.2); }
        .fn-select { width: 100%; padding: 10px 14px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .fn-textarea { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 12px; outline: none; resize: vertical; min-height: 140px; font-family: 'Inter', sans-serif; line-height: 1.6; }
        .fn-textarea:focus { border-color: rgba(200,0,0,0.5); }
        .fn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fn-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .fn-chip { padding: 6px 14px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; cursor: pointer; transition: all 0.2s; }
        .fn-chip:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .fn-chip.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .fn-modal-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
        .fn-btn-cancelar { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-guardar { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-guardar:hover { background: #e60000; }
        .fn-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
        .parser-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .parser-tab { padding: 8px 18px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .parser-tab.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .parser-result { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 14px; margin-top: 12px; }
        .parser-result-titulo { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 10px; }
        .file-input-wrap { position: relative; }
        .file-input-btn { padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px dashed rgba(255,255,255,0.2); border-radius: 3px; color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer; text-align: center; transition: all 0.2s; width: 100%; }
        .file-input-btn:hover { border-color: rgba(200,0,0,0.4); color: rgba(255,255,255,0.7); }
        .file-input-btn.tiene-archivo { border-color: rgba(34,197,94,0.4); color: #22c55e; }
      `}</style>

      <div className="pv-root">
        <header className="pv-topbar">
          <div className="pv-topbar-logo"><span>GFI</span>® · Proveedores</div>
          <div className="pv-topbar-right">
            <a className="pv-btn-back" href="/admin">← Panel Admin</a>
            <button className="pv-btn-nuevo" onClick={() => { setForm(FORM_VACIO); setEditandoId(null); setMostrarForm(true); }}>+ Nuevo proveedor</button>
          </div>
        </header>

        <main className="pv-content">
          <div className="pv-header">
            <h1>Proveedores de <span>divisas</span></h1>
            <p>Agregá proveedores y actualizá sus cotizaciones pegando el mensaje de WhatsApp o una foto.</p>
          </div>

          <div className="pv-lista">
            {loading ? (
              <div className="pv-empty">Cargando...</div>
            ) : proveedores.length === 0 ? (
              <div className="pv-empty">No hay proveedores cargados todavía.</div>
            ) : proveedores.map(p => (
              <div key={p.id} className={`pv-card${!p.activo ? " inactivo" : ""}`}>
                <div className="pv-card-top">
                  <div className="pv-card-info">
                    <div className="pv-card-nombre">
                      {p.nombre}
                      <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.06)",padding:"2px 8px",borderRadius:10,fontFamily:"'Montserrat',sans-serif"}}>#{p.orden}</span>
                      <span className={p.activo ? "badge-activo" : "badge-inactivo"}>{p.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                    <div className="pv-contacto">
                      {p.contacto_whatsapp && <span>📱 {p.contacto_whatsapp}</span>}
                      {p.contacto_email && <span>✉️ {p.contacto_email}</span>}
                    </div>
                    {p.monedas && p.monedas.length > 0 && (
                      <div className="pv-monedas">{p.monedas.map((m, i) => <span key={i} className="pv-moneda-tag">{MONEDA_FLAG[m] ?? ""} {m}</span>)}</div>
                    )}
                  </div>
                  <div className="pv-acciones">
                    <button className="pv-btn pv-btn-cot" onClick={() => abrirParser(p)}>📋 Actualizar cotización</button>
                    <button className="pv-btn pv-btn-edit" onClick={() => editar(p)}>Editar</button>
                    <button className="pv-btn pv-btn-toggle" onClick={() => toggleActivo(p.id, p.activo)}>{p.activo ? "Desactivar" : "Activar"}</button>
                    <button className="pv-btn pv-btn-del" onClick={() => eliminar(p.id)}>Eliminar</button>
                  </div>
                </div>

                {p.cotizacion_datos && Object.keys(p.cotizacion_datos).length > 0 && (
                  <div className="pv-cotizacion-preview">
                    <div className="pv-cotizacion-header">
                      <span className="pv-cotizacion-titulo">Última cotización cargada</span>
                      {p.cotizacion_actualizada_at && <span className="pv-cotizacion-fecha">📅 {formatFecha(p.cotizacion_actualizada_at)}</span>}
                    </div>
                    {renderDatos(p.cotizacion_datos as Record<string, unknown>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* MODAL PROVEEDOR */}
      {mostrarForm && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="fn-modal">
            <h2>{editandoId ? "Editar" : "Nuevo"} <span>proveedor</span></h2>
            <div className="fn-field">
              <label className="fn-label">Nombre *</label>
              <input className="fn-input" placeholder="Ej: SAS Inversiones" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">WhatsApp</label>
                <input className="fn-input" placeholder="5493412345678" value={form.contacto_whatsapp} onChange={e => setForm(p => ({ ...p, contacto_whatsapp: e.target.value }))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Orden</label>
                <input className="fn-input" type="number" placeholder="0" value={form.orden} onChange={e => setForm(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Monedas que opera</label>
              <div className="fn-chips">
                {MONEDAS_OPCIONES.map(m => (
                  <button key={m} type="button" className={`fn-chip${form.monedas.includes(m) ? " activo" : ""}`} onClick={() => toggleMoneda(m)}>{MONEDA_FLAG[m]} {m}</button>
                ))}
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Servicios</label>
              <div className="fn-chips">
                {SERVICIOS_OPCIONES.map(s => (
                  <button key={s} type="button" className={`fn-chip${form.servicios.includes(s) ? " activo" : ""}`} onClick={() => toggleServicio(s)}>{s}</button>
                ))}
              </div>
            </div>
            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={guardar} disabled={guardando || !form.nombre}>{guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARSER */}
      {mostrarParser && proveedorParser && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarParser(false); }}>
          <div className="fn-modal">
            <h2>Cotización de <span>{proveedorParser.nombre}</span></h2>

            <div className="parser-tabs">
              <button className={`parser-tab${modoParser === "texto" ? " activo" : ""}`} onClick={() => setModoParser("texto")}>📝 Pegar texto</button>
              <button className={`parser-tab${modoParser === "imagen" ? " activo" : ""}`} onClick={() => setModoParser("imagen")}>📷 Subir imagen</button>
            </div>

            {modoParser === "texto" ? (
              <div className="fn-field">
                <label className="fn-label">Pegá el mensaje de WhatsApp</label>
                <textarea
                  className="fn-textarea"
                  placeholder={"Ej:\nUSD/ARS - 1375 / 1425\nEUR/ARS - 1622 / 1753\nUSDT/ARS - 1375 / 1468\nTransferencias nacionales e internacionales"}
                  value={textoParser}
                  onChange={e => setTextoParser(e.target.value)}
                />
              </div>
            ) : (
              <div className="fn-field">
                <label className="fn-label">Foto de la cotización</label>
                <div className="file-input-wrap">
                  <label className={`file-input-btn${imagenFile ? " tiene-archivo" : ""}`}>
                    {imagenFile ? `✓ ${imagenFile.name}` : "📷 Tocá para seleccionar la imagen..."}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setImagenFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                  La IA de GFI® leerá la imagen y extraerá los valores automáticamente.
                </div>
              </div>
            )}

            <button
              className="fn-btn-guardar"
              style={{ width: "100%", marginBottom: 0 }}
              onClick={parsear}
              disabled={parsando || (modoParser === "texto" ? !textoParser.trim() : !imagenFile)}
            >
              {parsando ? "Analizando..." : "🔍 Extraer datos"}
            </button>

            {datosParseados && (
              <div className="parser-result">
                <div className="parser-result-titulo">
                  {Object.keys(datosParseados).length > 0 ? "✅ Datos extraídos" : "⚠️ No se encontraron datos"}
                </div>
                {Object.keys(datosParseados).length > 0 ? renderDatos(datosParseados) : (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    Revisá el formato del mensaje o intentá con la imagen.
                  </div>
                )}
              </div>
            )}

            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => setMostrarParser(false)}>Cancelar</button>
              {datosParseados && Object.keys(datosParseados).length > 0 && (
                <button className="fn-btn-guardar" onClick={guardarCotizacion} disabled={parsando}>
                  {parsando ? "Guardando..." : "Guardar cotización"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
