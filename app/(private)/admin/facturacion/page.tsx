"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

interface Emisor {
  id: string; razon_social: string; cuit: string; condicion_iva: string;
  punto_venta: number; porcentaje_facturacion: number; es_principal: boolean;
  activo: boolean; cert_env: string | null;
}
interface Suscripcion {
  id: string; periodo: string | null; monto_usd: number | null; estado: string;
  perfiles?: { nombre: string; apellido: string } | null;
}
interface FacturaAfip {
  id: string; periodo: string; ambiente: string; tipo_cbte: number; punto_venta: number;
  cbte_nro: number | null; cae: string | null; cae_vto: string | null; estado: string;
  importe_total: number; emisor_razon_social: string | null; receptor_nombre: string | null;
  error_msg: string | null; created_at: string;
}

const COND_IVA = [
  { code: "RI", label: "Responsable Inscripto" },
  { code: "MT", label: "Monotributo" },
  { code: "CF", label: "Consumidor Final" },
  { code: "EX", label: "Exento" },
];
const TIPO_CBTE: Record<number, string> = { 1: "Factura A", 6: "Factura B", 11: "Factura C", 13: "Factura C" };

const EMISOR_VACIO = { razon_social: "", cuit: "", condicion_iva: "RI", punto_venta: "1", porcentaje_facturacion: "100", cert_env: "", es_principal: true };

export default function FacturacionAdminPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [habilitado, setHabilitado] = useState(false);
  const [ambiente, setAmbiente] = useState<"homologacion" | "produccion">("homologacion");
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [facturas, setFacturas] = useState<FacturaAfip[]>([]);
  const [form, setForm] = useState(EMISOR_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [emitiendo, setEmitiendo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ txt: string; ok: boolean } | null>(null);

  const toast = (txt: string, ok = true) => { setMsg({ txt, ok }); setTimeout(() => setMsg(null), 5000); };

  const cargar = useCallback(async () => {
    const [{ data: ind }, { data: em }, { data: subs }, { data: fac }] = await Promise.all([
      supabase.from("indicadores").select("clave, valor, valor_texto").in("clave", ["afip_habilitado", "afip_ambiente"]),
      supabase.from("facturacion_emisores").select("*").order("es_principal", { ascending: false }),
      supabase.from("suscripciones").select("id, periodo, monto_usd, estado, perfiles(nombre, apellido)").order("created_at", { ascending: false }).limit(30),
      supabase.from("facturas_afip").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setHabilitado(Number(ind?.find(i => i.clave === "afip_habilitado")?.valor ?? 0) === 1);
    setAmbiente((ind?.find(i => i.clave === "afip_ambiente")?.valor_texto as any) ?? "homologacion");
    setEmisores((em as Emisor[]) ?? []);
    setSuscripciones((subs as unknown as Suscripcion[]) ?? []);
    setFacturas((fac as FacturaAfip[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (!["admin", "master"].includes(p?.tipo ?? "")) { setAutorizado(false); return; }
      setAutorizado(true);
      await cargar();
    })();
  }, [cargar]);

  const guardarConfig = async (cambios: { habilitado?: boolean; ambiente?: string }) => {
    if (cambios.habilitado !== undefined) {
      await supabase.from("indicadores").update({ valor: cambios.habilitado ? 1 : 0 }).eq("clave", "afip_habilitado");
      setHabilitado(cambios.habilitado);
    }
    if (cambios.ambiente !== undefined) {
      await supabase.from("indicadores").update({ valor_texto: cambios.ambiente }).eq("clave", "afip_ambiente");
      setAmbiente(cambios.ambiente as any);
    }
    toast("Configuración guardada");
  };

  const guardarEmisor = async () => {
    if (!form.razon_social.trim() || form.cuit.replace(/\D/g, "").length !== 11) {
      toast("Razón social y CUIT (11 dígitos) son obligatorios", false); return;
    }
    setGuardando(true);
    const { error } = await supabase.from("facturacion_emisores").insert({
      razon_social: form.razon_social.trim(),
      cuit: form.cuit.replace(/\D/g, ""),
      condicion_iva: form.condicion_iva,
      punto_venta: parseInt(form.punto_venta) || 1,
      porcentaje_facturacion: parseFloat(form.porcentaje_facturacion) || 100,
      cert_env: form.cert_env.trim() || null,
      es_principal: form.es_principal,
      activo: true,
    });
    setGuardando(false);
    if (error) { toast("Error: " + error.message, false); return; }
    setForm(EMISOR_VACIO); await cargar(); toast("Emisor agregado");
  };

  const toggleActivo = async (em: Emisor) => {
    await supabase.from("facturacion_emisores").update({ activo: !em.activo }).eq("id", em.id);
    await cargar();
  };
  const eliminarEmisor = async (id: string) => {
    if (!confirm("¿Eliminar este emisor? (no se puede si ya emitió facturas)")) return;
    const { error } = await supabase.from("facturacion_emisores").delete().eq("id", id);
    if (error) { toast("No se puede eliminar: tiene facturas asociadas", false); return; }
    await cargar();
  };

  const emitir = async (suscripcionId: string) => {
    setEmitiendo(suscripcionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/afip/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ suscripcion_id: suscripcionId }),
      });
      const data = await res.json();
      if (res.ok) {
        const detalle = (data.resultados ?? []).map((r: any) => r.ok ? `${r.emisor}: CAE ${r.cae ?? "(ya emitida)"}` : `${r.emisor}: ${r.error}`).join(" · ");
        toast(`Emisión (${data.ambiente}): ${detalle}`, true);
      } else {
        toast(data.error ?? "Error al emitir", false);
      }
      await cargar();
    } catch (e: any) { toast("Error de red: " + e.message, false); }
    setEmitiendo(null);
  };

  const sumaPct = emisores.filter(e => e.activo).reduce((s, e) => s + Number(e.porcentaje_facturacion), 0);

  if (autorizado === null) return <div style={{ padding: 40, color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)" }}>Cargando…</div>;
  if (!autorizado) return <div style={{ padding: 40, color: "var(--gfi-red)", fontFamily: "var(--font-body)" }}>Acceso solo para administradores.</div>;

  const card: React.CSSProperties = { background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border)", borderRadius: "var(--gfi-radius-lg)", padding: 20, marginBottom: 20 };
  const h2: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "var(--gfi-text-primary)", marginBottom: 14, letterSpacing: "0.04em", textTransform: "uppercase" };
  const input: React.CSSProperties = { background: "var(--gfi-bg-input)", border: "1px solid var(--gfi-border)", borderRadius: "var(--gfi-radius-sm)", color: "var(--gfi-text-primary)", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-body)" };
  const btn: React.CSSProperties = { background: "var(--gfi-red)", color: "#fff", border: "none", borderRadius: "var(--gfi-radius-sm)", padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-display)", letterSpacing: "0.06em" };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 60px", fontFamily: "var(--font-body)" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--gfi-text-primary)", marginBottom: 6 }}>Facturación AFIP</h1>
      <p style={{ fontSize: 13, color: "var(--gfi-text-secondary)", marginBottom: 20 }}>
        Emisión de facturas electrónicas (WSFE) del abono mensual, con reparto por emisor.
      </p>

      {msg && (
        <div style={{ ...card, marginBottom: 16, borderColor: msg.ok ? "var(--gfi-teal-border)" : "var(--gfi-red-border)", color: msg.ok ? "var(--gfi-teal-text)" : "var(--gfi-red-bright)", fontSize: 13 }}>
          {msg.txt}
        </div>
      )}

      {/* Config */}
      <div style={card}>
        <div style={h2}>Configuración</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--gfi-text-primary)", cursor: "pointer" }}>
            <input type="checkbox" checked={habilitado} onChange={e => guardarConfig({ habilitado: e.target.checked })} />
            Emisión AFIP habilitada
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--gfi-text-primary)" }}>
            Ambiente:
            <select style={input} value={ambiente} onChange={e => guardarConfig({ ambiente: e.target.value })}>
              <option value="homologacion">Homologación (pruebas)</option>
              <option value="produccion">Producción</option>
            </select>
          </label>
          <span style={{ fontSize: 12, color: ambiente === "produccion" ? "var(--gfi-gold-text)" : "var(--gfi-text-muted)" }}>
            {ambiente === "produccion" ? "⚠ Las facturas serán reales (CAE válido)." : "Modo prueba: CAE de homologación."}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 12 }}>
          El certificado y la clave se cargan como variables de entorno en Vercel: <code>AFIP_CERT</code> / <code>AFIP_KEY</code> (y <code>AFIP_CERT_&lt;sufijo&gt;</code> para socios).
        </div>
      </div>

      {/* Emisores */}
      <div style={card}>
        <div style={h2}>Emisores y reparto de facturación</div>
        {emisores.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {emisores.map(em => (
              <div key={em.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", background: "var(--gfi-bg-secondary)", borderRadius: "var(--gfi-radius-sm)", border: "1px solid var(--gfi-border-subtle)", opacity: em.activo ? 1 : 0.5 }}>
                <span style={{ fontWeight: 700, color: "var(--gfi-text-primary)", fontSize: 13 }}>{em.razon_social}</span>
                <span style={{ fontSize: 12, color: "var(--gfi-text-secondary)", fontFamily: "var(--font-mono)" }}>CUIT {em.cuit}</span>
                <span style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>{em.condicion_iva} · PV {em.punto_venta}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gfi-teal-text)" }}>{em.porcentaje_facturacion}%</span>
                {em.es_principal && <span style={{ fontSize: 10, color: "var(--gfi-gold-text)" }}>★ principal</span>}
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={() => toggleActivo(em)} style={{ ...btn, background: "transparent", border: "1px solid var(--gfi-border)", color: "var(--gfi-text-secondary)" }}>{em.activo ? "Desactivar" : "Activar"}</button>
                  <button onClick={() => eliminarEmisor(em.id)} style={{ ...btn, background: "transparent", border: "1px solid var(--gfi-red-border)", color: "var(--gfi-red-bright)" }}>Eliminar</button>
                </span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: sumaPct === 100 ? "var(--gfi-teal-text)" : "var(--gfi-gold-text)", marginTop: 4 }}>
              Suma de % activos: {sumaPct}% {sumaPct !== 100 && "— debería ser 100%"}
            </div>
          </div>
        )}
        {/* Form nuevo emisor */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, alignItems: "end" }}>
          <label style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>Razón social
            <input style={{ ...input, width: "100%" }} value={form.razon_social} onChange={e => setForm({ ...form, razon_social: e.target.value })} />
          </label>
          <label style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>CUIT
            <input style={{ ...input, width: "100%" }} value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })} placeholder="20257508766" />
          </label>
          <label style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>Condición IVA
            <select style={{ ...input, width: "100%" }} value={form.condicion_iva} onChange={e => setForm({ ...form, condicion_iva: e.target.value })}>
              {COND_IVA.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>Punto de venta
            <input style={{ ...input, width: "100%" }} type="number" value={form.punto_venta} onChange={e => setForm({ ...form, punto_venta: e.target.value })} />
          </label>
          <label style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>% facturación
            <input style={{ ...input, width: "100%" }} type="number" value={form.porcentaje_facturacion} onChange={e => setForm({ ...form, porcentaje_facturacion: e.target.value })} />
          </label>
          <label style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>Cert (sufijo env)
            <input style={{ ...input, width: "100%" }} value={form.cert_env} onChange={e => setForm({ ...form, cert_env: e.target.value })} placeholder="(vacío = base)" />
          </label>
          <button style={btn} onClick={guardarEmisor} disabled={guardando}>{guardando ? "…" : "Agregar emisor"}</button>
        </div>
      </div>

      {/* Emitir */}
      <div style={card}>
        <div style={h2}>Emitir factura por suscripción</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {suscripciones.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderBottom: "1px solid var(--gfi-border-subtle)" }}>
              <span style={{ fontSize: 13, color: "var(--gfi-text-primary)" }}>{s.perfiles?.apellido}, {s.perfiles?.nombre}</span>
              <span style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>{s.periodo ?? "—"}</span>
              <span style={{ fontSize: 12, color: "var(--gfi-text-secondary)" }}>{s.monto_usd ? `USD ${s.monto_usd}` : "—"}</span>
              <span style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>{s.estado}</span>
              <button style={{ ...btn, marginLeft: "auto" }} disabled={emitiendo === s.id || !habilitado} onClick={() => emitir(s.id)}>
                {emitiendo === s.id ? "Emitiendo…" : "Emitir"}
              </button>
            </div>
          ))}
          {suscripciones.length === 0 && <span style={{ fontSize: 13, color: "var(--gfi-text-muted)" }}>No hay suscripciones.</span>}
        </div>
        {!habilitado && <div style={{ fontSize: 12, color: "var(--gfi-gold-text)", marginTop: 10 }}>Activá «Emisión AFIP habilitada» para emitir.</div>}
      </div>

      {/* Facturas emitidas */}
      <div style={card}>
        <div style={h2}>Últimas facturas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {facturas.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 10px", borderBottom: "1px solid var(--gfi-border-subtle)", fontSize: 12 }}>
              <span style={{ color: f.estado === "emitida" ? "var(--gfi-teal-text)" : f.estado === "error" ? "var(--gfi-red-bright)" : "var(--gfi-text-muted)", fontWeight: 700 }}>{f.estado}</span>
              <span style={{ color: "var(--gfi-text-primary)" }}>{TIPO_CBTE[f.tipo_cbte] ?? `Cbte ${f.tipo_cbte}`} {f.punto_venta}-{f.cbte_nro ?? "—"}</span>
              <span style={{ color: "var(--gfi-text-secondary)" }}>{f.receptor_nombre}</span>
              <span style={{ color: "var(--gfi-text-muted)" }}>{f.periodo} · {f.emisor_razon_social}</span>
              <span style={{ color: "var(--gfi-text-secondary)", fontFamily: "var(--font-mono)" }}>$ {Number(f.importe_total).toLocaleString("es-AR")}</span>
              {f.cae && <span style={{ color: "var(--gfi-text-muted)", fontFamily: "var(--font-mono)" }}>CAE {f.cae}</span>}
              {f.error_msg && <span style={{ color: "var(--gfi-red-bright)" }}>{f.error_msg}</span>}
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gfi-bg-elevated)" }}>{f.ambiente}</span>
            </div>
          ))}
          {facturas.length === 0 && <span style={{ fontSize: 13, color: "var(--gfi-text-muted)" }}>Todavía no se emitieron facturas.</span>}
        </div>
      </div>
    </div>
  );
}
