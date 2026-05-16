"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Lead {
  id: string;
  tipo: "contacto" | "tasacion";
  nombre: string;
  email: string | null;
  telefono: string | null;
  mensaje: string | null;
  direccion_propiedad: string | null;
  propiedad_id: string | null;
  leido: boolean;
  created_at: string;
  cartera_propiedades?: { titulo: string } | null;
}

const TIPO_COLOR = { contacto: "#3b82f6", tasacion: "#f59e0b" };
const TIPO_LABEL = { contacto: "Contacto", tasacion: "Tasación" };

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "contacto" | "tasacion" | "no_leidos">("todos");
  const [convirtiendo, setConvirtiendo] = useState<string | null>(null);
  const [convertidos, setConvertidos] = useState<Set<string>>(new Set());
  const [creandoNegocio, setCreandoNegocio] = useState<string | null>(null);
  const [negociosCreados, setNegociosCreados] = useState<Set<string>>(new Set());

  const exportarCSV = () => {
    const filas = [
      ["Fecha", "Tipo", "Nombre", "Teléfono", "Email", "Mensaje", "Propiedad", "Leído"],
      ...leads.map(l => [
        new Date(l.created_at).toLocaleDateString("es-AR"),
        TIPO_LABEL[l.tipo],
        l.nombre,
        l.telefono ?? "",
        l.email ?? "",
        (l.mensaje ?? "").replace(/"/g, '""'),
        l.cartera_propiedades?.titulo ?? l.direccion_propiedad ?? "",
        l.leido ? "Sí" : "No",
      ]),
    ];
    const csv = filas.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-web-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const [tablaNoExiste, setTablaNoExiste] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = "/login"; return; }
      await cargar(auth.user.id);
    };
    init();
  }, []);

  const cargar = async (uid: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("web_leads")
        .select("*, cartera_propiedades(titulo)")
        .eq("perfil_id", uid)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01") { setTablaNoExiste(true); }
        setLeads([]);
      } else {
        setLeads((data as Lead[]) ?? []);
      }
    } catch { setTablaNoExiste(true); }
    setLoading(false);
  };

  const marcarLeido = async (id: string) => {
    await supabase.from("web_leads").update({ leido: true }).eq("id", id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, leido: true } : l));
  };

  const marcarTodosLeidos = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("web_leads").update({ leido: true }).eq("perfil_id", auth.user.id).eq("leido", false);
    setLeads(prev => prev.map(l => ({ ...l, leido: true })));
  };

  const convertirCRM = async (lead: Lead) => {
    setConvirtiendo(lead.id);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setConvirtiendo(null); return; }

    const { error } = await supabase.from("crm_contactos").insert({
      perfil_id: auth.user.id,
      nombre: lead.nombre.split(" ")[0] ?? lead.nombre,
      apellido: lead.nombre.split(" ").slice(1).join(" ") || null,
      email: lead.email || null,
      telefono: lead.telefono || null,
      tipo: "cliente",
      origen: "web",
      interes: lead.tipo === "tasacion"
        ? `Tasación: ${lead.direccion_propiedad ?? "sin dirección"}`
        : lead.cartera_propiedades?.titulo ? `Consulta por: ${lead.cartera_propiedades.titulo}` : null,
      notas: lead.mensaje ? `Lead web: "${lead.mensaje}"` : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      setConvertidos(prev => new Set([...prev, lead.id]));
      await marcarLeido(lead.id);
    }
    setConvirtiendo(null);
  };

  const crearNegocio = async (lead: Lead) => {
    setCreandoNegocio(lead.id);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setCreandoNegocio(null); return; }

    // Create contact first
    const { data: contacto } = await supabase.from("crm_contactos").insert({
      perfil_id: auth.user.id,
      nombre: lead.nombre.split(" ")[0] ?? lead.nombre,
      apellido: lead.nombre.split(" ").slice(1).join(" ") || null,
      email: lead.email || null,
      telefono: lead.telefono || null,
      tipo: "cliente",
      estado: "lead:nuevo",
      origen: "web",
      interes: lead.cartera_propiedades?.titulo ? `Consulta por: ${lead.cartera_propiedades.titulo}` : null,
      notas: lead.mensaje ? `Lead web: "${lead.mensaje}"` : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select("id").single();

    // Then create negocio linked to contact
    const titulo = lead.cartera_propiedades?.titulo
      ? `${lead.nombre.split(" ")[0]} — ${lead.cartera_propiedades.titulo}`
      : `Lead web: ${lead.nombre}`;
    await supabase.from("crm_negocios").insert({
      perfil_id: auth.user.id,
      contacto_id: contacto?.id ?? null,
      titulo,
      tipo_operacion: "venta",
      etapa: "prospecto",
      notas: lead.mensaje ? `Mensaje del lead: "${lead.mensaje}"` : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setNegociosCreados(prev => new Set([...prev, lead.id]));
    await marcarLeido(lead.id);
    setCreandoNegocio(null);
  };

  const filtrados = leads.filter(l => {
    if (filtro === "no_leidos") return !l.leido;
    if (filtro === "contacto") return l.tipo === "contacto";
    if (filtro === "tasacion") return l.tipo === "tasacion";
    return true;
  });

  const noLeidos = leads.filter(l => !l.leido).length;

  const formatFecha = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "ahora";
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>Cargando leads…</div>;

  if (tablaNoExiste) return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Tabla de leads no creada</div>
      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Ejecutá la migración <code>001_web_leads.sql</code> en Supabase para activar esta función.</p>
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 780, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>📬</span>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: 0 }}>Leads de mi web</h1>
            {noLeidos > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                {noLeidos} nuevo{noLeidos > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Consultas recibidas desde tu web pública</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["todos","no_leidos","contacto","tasacion"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${filtro === f ? "#2563eb" : "#e5e7eb"}`, background: filtro === f ? "#eff6ff" : "#fff", color: filtro === f ? "#2563eb" : "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {f === "todos" ? "Todos" : f === "no_leidos" ? `Sin leer (${noLeidos})` : f === "contacto" ? "Contacto" : "Tasación"}
            </button>
          ))}
          {noLeidos > 0 && (
            <button
              onClick={marcarTodosLeidos}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              ✓ Marcar todos
            </button>
          )}
          {leads.length > 0 && (
            <button
              onClick={exportarCSV}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              ⬇ CSV
            </button>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, color: "#374151" }}>
            {filtro === "no_leidos" ? "No hay leads sin leer" : "Aún no hay leads"}
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
            Cuando alguien complete un formulario en tu web, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map(lead => (
            <div
              key={lead.id}
              style={{ background: "#fff", border: `1px solid ${lead.leido ? "#e5e7eb" : "#bfdbfe"}`, borderRadius: 10, padding: "16px 20px", position: "relative", cursor: !lead.leido ? "pointer" : "default" }}
              onClick={() => !lead.leido && marcarLeido(lead.id)}
            >
              {!lead.leido && (
                <div style={{ position: "absolute", top: 16, right: 16, width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
              )}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{lead.nombre}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: TIPO_COLOR[lead.tipo] + "20", color: TIPO_COLOR[lead.tipo], border: `1px solid ${TIPO_COLOR[lead.tipo]}40` }}>
                      {TIPO_LABEL[lead.tipo]}
                    </span>
                    {lead.cartera_propiedades?.titulo && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#f3e8ff", color: "#7c3aed", border: "1px solid #e9d5ff", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        🏠 {lead.cartera_propiedades.titulo}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatFecha(lead.created_at)}</span>
                  </div>

                  {/* Datos de contacto */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: lead.mensaje || lead.direccion_propiedad ? 10 : 0 }}>
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}>✉️ {lead.email}</a>
                    )}
                    {lead.telefono && (
                      <a href={`https://wa.me/${lead.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#16a34a", textDecoration: "none" }}>💬 {lead.telefono}</a>
                    )}
                  </div>

                  {/* Dirección (tasación) */}
                  {lead.direccion_propiedad && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                      📍 <strong>Propiedad:</strong> {lead.direccion_propiedad}
                    </div>
                  )}

                  {/* Mensaje */}
                  {lead.mensaje && (
                    <div style={{ fontSize: 12, color: "#374151", background: "#f9fafb", borderRadius: 6, padding: "8px 12px", borderLeft: "3px solid #e5e7eb", lineHeight: 1.5 }}>
                      {lead.mensaje}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  {lead.propiedad_id && (
                    <a
                      href={`/crm/cartera/ficha/${lead.propiedad_id}`}
                      style={{ fontSize: 11, padding: "6px 12px", background: "#f3e8ff", color: "#7c3aed", border: "1px solid #e9d5ff", borderRadius: 6, fontWeight: 700, textDecoration: "none", textAlign: "center" }}
                    >
                      🏠 Ver prop.
                    </a>
                  )}
                  {lead.telefono && (
                    <a
                      href={`https://wa.me/${lead.telefono.replace(/\D/g,"")}?text=${encodeURIComponent(`Hola ${lead.nombre.split(" ")[0]}, te contacto por${lead.cartera_propiedades?.titulo ? ` la propiedad "${lead.cartera_propiedades.titulo}"` : " tu consulta"} en mi web inmobiliaria.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, padding: "6px 12px", background: "#25D366", color: "#fff", borderRadius: 6, fontWeight: 700, textDecoration: "none", textAlign: "center" }}
                    >
                      WhatsApp
                    </a>
                  )}
                  {convertidos.has(lead.id) ? (
                    <div style={{ fontSize: 11, padding: "6px 12px", background: "#dcfce7", color: "#16a34a", borderRadius: 6, fontWeight: 700, textAlign: "center" }}>
                      ✓ En CRM
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); convertirCRM(lead); }}
                      disabled={convirtiendo === lead.id}
                      style={{ fontSize: 11, padding: "6px 12px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {convirtiendo === lead.id ? "…" : "+ CRM"}
                    </button>
                  )}
                  {negociosCreados.has(lead.id) ? (
                    <div style={{ fontSize: 11, padding: "6px 12px", background: "#f0fdf4", color: "#15803d", borderRadius: 6, fontWeight: 700, textAlign: "center" }}>
                      ✓ Negocio
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); crearNegocio(lead); }}
                      disabled={creandoNegocio === lead.id}
                      style={{ fontSize: 11, padding: "6px 12px", background: "#fefce8", color: "#a16207", border: "1px solid #fde68a", borderRadius: 6, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {creandoNegocio === lead.id ? "…" : "+ Negocio"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
