"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string | null;
}

type DocEstado = "pendiente" | "recibido" | "no_aplica";

interface Documento {
  id: string;
  grupo: string;
  nombre: string;
  descripcion: string;
  obligatorio: boolean;
}

// ── Plantillas de documentos por tipo de operación ──────────────────────────

const DOCS_BASE: Documento[] = [
  // Parte vendedora / propietaria
  { id: "dni_vendedor",         grupo: "Vendedor",    nombre: "DNI del vendedor",                descripcion: "Frente y dorso vigente",                          obligatorio: true },
  { id: "titulo_prop",          grupo: "Vendedor",    nombre: "Título de propiedad",              descripcion: "Escritura traslativa de dominio",                  obligatorio: true },
  { id: "informe_dominio",      grupo: "Vendedor",    nombre: "Informe de dominio",               descripcion: "Registro de la Propiedad (30 días de validez)",    obligatorio: true },
  { id: "informe_inhibicion",   grupo: "Vendedor",    nombre: "Informe de inhibición",            descripcion: "Estado de deudas y embargos del titular",          obligatorio: true },
  { id: "libre_deuda_expensas", grupo: "Vendedor",    nombre: "Libre deuda de expensas",          descripcion: "Administración del consorcio",                     obligatorio: false },
  { id: "libre_deuda_abl",      grupo: "Vendedor",    nombre: "Libre deuda TGI / rentas municipales", descripcion: "Municipalidad de Santa Fe o municipio correspondiente", obligatorio: true },
  { id: "libre_deuda_abl_2",    grupo: "Vendedor",    nombre: "Certificado de valuación fiscal",  descripcion: "API Santa Fe para cálculo de sellos",              obligatorio: true },
  { id: "planos",               grupo: "Vendedor",    nombre: "Planos municipales aprobados",     descripcion: "Visados por DGRoc/municipio",                      obligatorio: false },
  { id: "reglamento",           grupo: "Vendedor",    nombre: "Reglamento de copropiedad",        descripcion: "PH o consorcio — art. 2038 CCC",                   obligatorio: false },
  { id: "coti",                 grupo: "Vendedor",    nombre: "COTI (AFIP)",                      descripcion: "Si precio supera límite AFIP",                     obligatorio: false },
  // Parte compradora
  { id: "dni_comprador",        grupo: "Comprador",   nombre: "DNI del comprador",               descripcion: "Frente y dorso vigente",                           obligatorio: true },
  { id: "cuil_comprador",       grupo: "Comprador",   nombre: "CUIL/CUIT del comprador",         descripcion: "Constancia AFIP",                                  obligatorio: true },
  { id: "origen_fondos",        grupo: "Comprador",   nombre: "Declaración origen de fondos",    descripcion: "UIF — prevención lavado art. 21 Ley 25.246",       obligatorio: true },
  { id: "sueldo_comp",          grupo: "Comprador",   nombre: "Recibo de sueldo / ingresos",     descripcion: "Últimos 3 meses o certificación contable",         obligatorio: false },
  // Jurídicos y escribanía
  { id: "boleto",               grupo: "Jurídicos",   nombre: "Boleto de compraventa",           descripcion: "Con seña / reserva firmada",                       obligatorio: true },
  { id: "poder_notarial",       grupo: "Jurídicos",   nombre: "Poder notarial",                  descripcion: "Si el vendedor/comprador actúa por apoderado",      obligatorio: false },
  { id: "acta_matrimonio",      grupo: "Jurídicos",   nombre: "Acta de matrimonio",              descripcion: "Si el titular es casado",                           obligatorio: false },
  { id: "divorcio",             grupo: "Jurídicos",   nombre: "Sentencia de divorcio",           descripcion: "Si aplica",                                        obligatorio: false },
  { id: "sucesion",             grupo: "Jurídicos",   nombre: "Declaratoria de herederos",       descripcion: "Si el bien proviene de sucesión",                  obligatorio: false },
  { id: "escritura_borrador",   grupo: "Jurídicos",   nombre: "Minuta / Borrador de escritura",  descripcion: "Preparado por escribano",                          obligatorio: true },
  // Financiero / hipoteca
  { id: "tasacion_banco",       grupo: "Financiero",  nombre: "Tasación del banco",              descripcion: "Informe tasación para crédito hipotecario",         obligatorio: false },
  { id: "aprobacion_credito",   grupo: "Financiero",  nombre: "Aprobación del crédito",          descripcion: "Carta de aprobación del banco",                    obligatorio: false },
  { id: "cancelacion_hipoteca", grupo: "Financiero",  nombre: "Cancelación de hipoteca anterior", descripcion: "Si la propiedad tiene gravamen",                  obligatorio: false },
  // Inmobiliaria
  { id: "autorizacion_venta",   grupo: "Inmobiliaria",nombre: "Autorización de venta",           descripcion: "Mandato exclusivo o no exclusivo firmado",          obligatorio: true },
  { id: "ficha_reserva",        grupo: "Inmobiliaria",nombre: "Ficha de reserva",                descripcion: "Formulario de reserva con oferta",                 obligatorio: true },
  { id: "registro_cci",         grupo: "Inmobiliaria",nombre: "Registro CCI / matrícula",        descripcion: "Número de matrícula del corredor interviniente",    obligatorio: true },
];


// ── Componente ───────────────────────────────────────────────────────────────

export default function GestionDocumentos() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [negocioSeleccionado, setNegocioSeleccionado] = useState<string | null>(null);
  const [estados, setEstados] = useState<Record<string, Record<string, DocEstado>>>({});
  const [busqueda, setBusqueda] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: cfgRow } = await supabase
          .from("crm_documentos_estado")
          .select("estado")
          .eq("perfil_id", user.id)
          .maybeSingle();
        if (cfgRow?.estado) {
          setEstados(cfgRow.estado as Record<string, Record<string, DocEstado>>);
        }
      }
      const { data } = await supabase
        .from("crm_negocios")
        .select("id,titulo,etapa,tipo_operacion")
        .not("etapa", "in", "(perdido)")
        .order("created_at", { ascending: false });
      setNegocios((data ?? []) as Negocio[]);
      setLoading(false);
    })();
  }, []);

  async function setEstadoDoc(negocioId: string, docId: string, estado: DocEstado) {
    const next = { ...estados, [negocioId]: { ...(estados[negocioId] ?? {}), [docId]: estado } };
    setEstados(next);
    if (userId) {
      await supabase.from("crm_documentos_estado").upsert({
        perfil_id: userId,
        estado: next,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const negocioActual = negocios.find(n => n.id === negocioSeleccionado);
  const estadosNegocio = negocioSeleccionado ? (estados[negocioSeleccionado] ?? {}) : {};

  const progreso = useMemo(() => {
    if (!negocioSeleccionado) return null;
    const obligatorios = DOCS_BASE.filter(d => d.obligatorio);
    const recibidos = obligatorios.filter(d => estadosNegocio[d.id] === "recibido");
    const pendientes = obligatorios.filter(d => !estadosNegocio[d.id] || estadosNegocio[d.id] === "pendiente");
    const total = DOCS_BASE.filter(d => estadosNegocio[d.id] === "recibido").length;
    return { obligatorios: obligatorios.length, recibidos: recibidos.length, pendientes: pendientes.length, total };
  }, [negocioSeleccionado, estadosNegocio]);

  const grupos = useMemo(() => {
    const g: Record<string, Documento[]> = {};
    DOCS_BASE.forEach(d => {
      if (!g[d.grupo]) g[d.grupo] = [];
      g[d.grupo].push(d);
    });
    return g;
  }, []);

  const negociosFiltrados = useMemo(() =>
    negocios.filter(n =>
      busqueda === "" ||
      n.titulo.toLowerCase().includes(busqueda.toLowerCase())
    ), [negocios, busqueda]);

  const ESTADO_COLORS: Record<DocEstado, string> = {
    pendiente: "#d4960c",
    recibido: "#3abab6",
    no_aplica: "#6b7280",
  };
  const ESTADO_LABELS: Record<DocEstado, string> = {
    pendiente: "Pendiente",
    recibido: "Recibido ✓",
    no_aplica: "No aplica",
  };

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Inter, sans-serif",
  };

  function exportPDF() {
    if (!negocioActual || !progreso) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Documentación — ${negocioActual.titulo}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;max-width:700px;margin:40px auto}h1{color:#990000}h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}th{background:#f5f5f5}.recibido{color:#22807c}.pendiente{color:#d97706}.no_aplica{color:#6b7280}.obligatorio{color:#dc2626}</style>
      </head><body>
      <h1>📋 Checklist de Documentación</h1>
      <p><b>Negocio:</b> ${negocioActual.titulo} | <b>Etapa:</b> ${negocioActual.etapa} | <b>Tipo:</b> ${negocioActual.tipo_operacion ?? "—"}</p>
      <p><b>Obligatorios recibidos:</b> ${progreso.recibidos}/${progreso.obligatorios} | <b>Pendientes:</b> ${progreso.pendientes}</p>
      ${Object.entries(grupos).map(([grupo, docs]) => `
        <h2>${grupo}</h2>
        <table>
          <tr><th>Documento</th><th>Descripción</th><th>Estado</th></tr>
          ${docs.map(d => {
            const est = estadosNegocio[d.id] ?? "pendiente";
            return `<tr><td>${d.nombre}${d.obligatorio ? ' <span class="obligatorio">*</span>' : ''}</td><td>${d.descripcion}</td><td class="${est}">${ESTADO_LABELS[est]}</td></tr>`;
          }).join("")}
        </table>
      `).join("")}
      <p style="color:#888;font-size:10px">* Obligatorio | Generado: ${new Date().toLocaleDateString("es-AR")}</p>
      </body></html>
    `);
    setTimeout(() => win.print(), 400);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>📋 Gestión de Documentos</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Checklist de documentación por negocio — guardado localmente</p>
        </div>
        {negocioActual && (
          <button onClick={exportPDF} style={{
            background: "#990000", color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Montserrat, sans-serif",
          }}>📄 PDF</button>
        )}
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>
        {/* Sidebar — lista negocios */}
        <div style={{ width: 280, borderRight: "1px solid #222", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a" }}>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar negocio..."
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, color: "#666", textAlign: "center" }}>Cargando...</div>
            ) : negociosFiltrados.map(n => {
              const est = estados[n.id] ?? {};
              const recibidos = DOCS_BASE.filter(d => est[d.id] === "recibido").length;
              const total = DOCS_BASE.length;
              const sel = negocioSeleccionado === n.id;
              return (
                <div
                  key={n.id}
                  onClick={() => setNegocioSeleccionado(n.id)}
                  style={{
                    padding: "12px 16px", borderBottom: "1px solid #1a1a1a", cursor: "pointer",
                    background: sel ? "#99000015" : "transparent",
                    borderLeft: sel ? "3px solid #990000" : "3px solid transparent",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: sel ? "#fff" : "#ccc" }}>{n.titulo}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{n.etapa} · {n.tipo_operacion ?? "—"}</div>
                  <div style={{ marginTop: 4, height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(recibidos / total) * 100}%`, background: recibidos === total ? "#3abab6" : "#990000", borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{recibidos}/{total} docs</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel principal */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!negocioActual ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "#666" }}>
              <span style={{ fontSize: 48 }}>📋</span>
              <p style={{ margin: 0 }}>Seleccioná un negocio del panel izquierdo</p>
            </div>
          ) : (
            <div style={{ padding: "24px", maxWidth: 800 }}>
              {/* Header negocio */}
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>{negocioActual.titulo}</h2>
                <div style={{ fontSize: 12, color: "#666" }}>{negocioActual.etapa} · {negocioActual.tipo_operacion ?? "—"}</div>
              </div>

              {/* Progreso */}
              {progreso && (
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>Obligatorios</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#3abab6" }}>{progreso.recibidos}/{progreso.obligatorios}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>Pendientes *</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: progreso.pendientes > 0 ? "#d4960c" : "#3abab6" }}>{progreso.pendientes}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>Total recibidos</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{progreso.total}/{DOCS_BASE.length}</div>
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                    <div style={{ width: "100%", height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${(progreso.recibidos / progreso.obligatorios) * 100}%`,
                        background: progreso.pendientes === 0 ? "#3abab6" : "#990000",
                        borderRadius: 4, transition: "width 0.3s",
                      }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Grupos de documentos */}
              {Object.entries(grupos).map(([grupo, docs]) => (
                <div key={grupo} style={{ marginBottom: 20 }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#990000", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {grupo}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {docs.map(doc => {
                      const estado = (estadosNegocio[doc.id] ?? "pendiente") as DocEstado;
                      return (
                        <div key={doc.id} style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                          background: "#111", border: `1px solid ${estado === "recibido" ? "#3abab620" : estado === "no_aplica" ? "#6b728020" : "#1a1a1a"}`,
                          borderRadius: 8,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: estado === "no_aplica" ? "#555" : "#ccc", display: "flex", alignItems: "center", gap: 6 }}>
                              {doc.nombre}
                              {doc.obligatorio && <span style={{ fontSize: 10, color: "#990000", fontWeight: 700 }}>OBLIGATORIO</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>{doc.descripcion}</div>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            {(["pendiente", "recibido", "no_aplica"] as DocEstado[]).map(est => (
                              <button
                                key={est}
                                onClick={() => setEstadoDoc(negocioActual.id, doc.id, est)}
                                style={{
                                  padding: "4px 10px", fontSize: 11, borderRadius: 4, cursor: "pointer",
                                  border: `1px solid ${estado === est ? ESTADO_COLORS[est] : "#333"}`,
                                  background: estado === est ? ESTADO_COLORS[est] + "20" : "transparent",
                                  color: estado === est ? ESTADO_COLORS[est] : "#555",
                                  fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                                  transition: "all 0.15s",
                                }}
                              >
                                {ESTADO_LABELS[est]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
