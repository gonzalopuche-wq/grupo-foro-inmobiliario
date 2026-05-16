"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Perfil { id: string; nombre: string; apellido: string; matricula: string | null; inmobiliaria: string | null; foto_url: string | null; telefono: string | null; }
interface Negocio { id: string; titulo: string; }
interface Alianza {
  id: string;
  proponente_id: string;
  receptor_id: string;
  negocio_id: string | null;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  split_pct: number | null;
  estado: string;
  mensaje_respuesta: string | null;
  created_at: string;
  proponente?: Perfil | null;
  receptor?: Perfil | null;
  negocio?: { titulo: string } | null;
}

const TIPOS = [
  { value: "operacion_compartida", label: "Operación compartida", icon: "🤝" },
  { value: "captacion",            label: "Captación conjunta",    icon: "🎯" },
  { value: "referido",             label: "Referido de cliente",   icon: "👥" },
];

const ESTADOS: Record<string, { label: string; color: string }> = {
  pendiente:  { label: "Pendiente",  color: "#f59e0b" },
  aceptada:   { label: "Aceptada",   color: "#22c55e" },
  rechazada:  { label: "Rechazada",  color: "#ef4444" },
  cancelada:  { label: "Cancelada",  color: "#64748b" },
  completada: { label: "Completada", color: "#6366f1" },
};

const chip = (estado: string) => {
  const e = ESTADOS[estado] ?? ESTADOS.pendiente;
  return <span style={{ background: e.color + "22", color: e.color, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{e.label}</span>;
};

const EMPTY_FORM = { receptor_id: "", tipo: "operacion_compartida", titulo: "", descripcion: "", split_pct: "", negocio_id: "" };

export default function AlianzasPage() {
  const [alianzas, setAlianzas] = useState<Alianza[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [colegas, setColegas] = useState<Perfil[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"recibidas" | "enviadas" | "activas">("recibidas");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [guardando, setGuardando] = useState(false);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const cargar = async (uid: string) => {
    const { data } = await supabase
      .from("crm_alianzas")
      .select("*, proponente:perfiles!crm_alianzas_proponente_id_fkey(id,nombre,apellido,matricula,inmobiliaria,foto_url,telefono), receptor:perfiles!crm_alianzas_receptor_id_fkey(id,nombre,apellido,matricula,inmobiliaria,foto_url,telefono), negocio:crm_negocios(titulo)")
      .or(`proponente_id.eq.${uid},receptor_id.eq.${uid}`)
      .order("created_at", { ascending: false });
    setAlianzas((data ?? []) as Alianza[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      const { data: col } = await supabase.from("perfiles").select("id,nombre,apellido,matricula,inmobiliaria,foto_url,telefono").eq("estado", "activo").neq("id", data.user.id).order("apellido").limit(200);
      setColegas((col ?? []) as Perfil[]);
      const { data: neg } = await supabase.from("crm_negocios").select("id,titulo").eq("perfil_id", data.user.id).eq("archivado", false).order("updated_at", { ascending: false });
      setNegocios((neg ?? []) as Negocio[]);
      setLoading(false);
    })();
  }, []);

  const proponer = async () => {
    if (!userId || !form.receptor_id || !form.titulo) return;
    setGuardando(true);
    await supabase.from("crm_alianzas").insert({
      proponente_id: userId,
      receptor_id: form.receptor_id,
      negocio_id: form.negocio_id || null,
      tipo: form.tipo,
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      split_pct: form.split_pct ? parseFloat(form.split_pct) : null,
      estado: "pendiente",
    });
    await cargar(userId);
    setModal(false);
    setGuardando(false);
    setForm({ ...EMPTY_FORM });
    showToast("Propuesta enviada");
  };

  const responder = async (id: string, estado: "aceptada" | "rechazada", mensaje?: string) => {
    if (!userId) return;
    setRespondiendo(id);
    await supabase.from("crm_alianzas").update({ estado, mensaje_respuesta: mensaje ?? null, updated_at: new Date().toISOString() }).eq("id", id);
    await cargar(userId);
    setRespondiendo(null);
    showToast(estado === "aceptada" ? "Alianza aceptada ✓" : "Propuesta rechazada");
  };

  const cambiarEstado = async (id: string, estado: string) => {
    if (!userId) return;
    await supabase.from("crm_alianzas").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
    await cargar(userId);
  };

  const recibidas = alianzas.filter(a => a.receptor_id === userId && a.estado === "pendiente");
  const enviadas  = alianzas.filter(a => a.proponente_id === userId);
  const activas   = alianzas.filter(a => a.estado === "aceptada");

  const lista = tab === "recibidas" ? recibidas : tab === "enviadas" ? enviadas : activas;

  const otro = (a: Alianza) => a.proponente_id === userId ? a.receptor : a.proponente;

  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>{toast}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>🤝 Alianzas entre Corredores</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Proponé operaciones compartidas, captaciones y referidos con colegas GFI®</p>
        </div>
        <button onClick={() => setModal(true)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          + Proponer alianza
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#0f172a", borderRadius: 10, padding: 4 }}>
        {([
          { key: "recibidas", label: `📥 Recibidas${recibidas.length > 0 ? ` (${recibidas.length})` : ""}` },
          { key: "enviadas",  label: `📤 Enviadas` },
          { key: "activas",   label: `✅ Activas${activas.length > 0 ? ` (${activas.length})` : ""}` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: tab === t.key ? 700 : 400, fontSize: 14, background: tab === t.key ? "#1e293b" : "transparent", color: tab === t.key ? "#f8fafc" : "#64748b" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤝</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {tab === "recibidas" ? "Sin propuestas recibidas" : tab === "enviadas" ? "Sin propuestas enviadas" : "Sin alianzas activas"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.map(a => {
            const contraparte = otro(a) as Perfil | null | undefined;
            const tipoInfo = TIPOS.find(t => t.value === a.tipo);
            const esReceptor = a.receptor_id === userId;
            return (
              <div key={a.id} style={{ background: "#1e293b", borderRadius: 14, padding: "18px 22px", border: "1px solid #334155" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{tipoInfo?.icon}</span>
                      <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 16 }}>{a.titulo}</span>
                      {chip(a.estado)}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      {tipoInfo?.label} · {esReceptor ? "De" : "Para"}: <strong style={{ color: "#94a3b8" }}>{contraparte?.nombre} {contraparte?.apellido}</strong>
                      {contraparte?.matricula && ` · Mat. ${contraparte.matricula}`}
                      {a.split_pct && ` · Split: ${a.split_pct}% para vos`}
                      {a.negocio && ` · Negocio: ${a.negocio.titulo}`}
                    </div>
                    {a.descripcion && <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>{a.descripcion}</div>}
                    {a.mensaje_respuesta && <div style={{ color: "#64748b", fontSize: 12, marginTop: 6, fontStyle: "italic" }}>"{a.mensaje_respuesta}"</div>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {/* Receptor: aceptar/rechazar cuando está pendiente */}
                  {esReceptor && a.estado === "pendiente" && (
                    <>
                      <button onClick={() => responder(a.id, "aceptada")} disabled={respondiendo === a.id}
                        style={{ background: "#052e16", color: "#22c55e", border: "1px solid #166534", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        ✓ Aceptar
                      </button>
                      <button onClick={() => {
                        const msg = prompt("Mensaje (opcional):");
                        responder(a.id, "rechazada", msg ?? undefined);
                      }} disabled={respondiendo === a.id}
                        style={{ background: "#2d1b1b", color: "#ef4444", border: "1px solid #7f1d1d", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>
                        ✗ Rechazar
                      </button>
                    </>
                  )}
                  {/* Proponente: cancelar si pendiente */}
                  {!esReceptor && a.estado === "pendiente" && (
                    <button onClick={() => cambiarEstado(a.id, "cancelada")}
                      style={{ background: "transparent", color: "#64748b", border: "1px solid #334155", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>
                      Cancelar propuesta
                    </button>
                  )}
                  {/* Marcar completada si activa */}
                  {a.estado === "aceptada" && (
                    <button onClick={() => cambiarEstado(a.id, "completada")}
                      style={{ background: "#0f172a", color: "#6366f1", border: "1px solid #6366f1", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>
                      ✓ Marcar completada
                    </button>
                  )}
                  {/* WhatsApp al colega */}
                  {contraparte && (
                    <a href={`https://wa.me/${(contraparte.telefono ?? "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      style={{ background: "#052e16", color: "#22c55e", border: "1px solid #166534", borderRadius: 8, padding: "7px 14px", fontSize: 13, textDecoration: "none" }}>
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal proponer */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", border: "1px solid #1e293b" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>Proponer alianza</h2>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Corredor colega *</label>
            <select value={form.receptor_id} onChange={e => setForm(f => ({ ...f, receptor_id: e.target.value }))}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14 }}>
              <option value="">— Seleccioná un colega —</option>
              {colegas.map(c => <option key={c.id} value={c.id}>{c.apellido}, {c.nombre}{c.matricula ? ` · Mat. ${c.matricula}` : ""}{c.inmobiliaria ? ` (${c.inmobiliaria})` : ""}</option>)}
            </select>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Tipo de alianza</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14 }}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Título *</label>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Venta depto Pichincha en conjunto"
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Negocio vinculado</label>
                <select value={form.negocio_id} onChange={e => setForm(f => ({ ...f, negocio_id: e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}>
                  <option value="">— Sin negocio —</option>
                  {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>% Split para colega</label>
                <input type="number" step="0.5" min="0" max="100" value={form.split_pct} onChange={e => setForm(f => ({ ...f, split_pct: e.target.value }))} placeholder="50"
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} placeholder="Detallá la propuesta de alianza..."
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 20, resize: "vertical", boxSizing: "border-box" }} />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 20px", cursor: "pointer" }}>Cancelar</button>
              <button onClick={proponer} disabled={guardando || !form.receptor_id || !form.titulo}
                style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, cursor: "pointer", opacity: guardando ? 0.7 : 1 }}>
                {guardando ? "Enviando..." : "Enviar propuesta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
