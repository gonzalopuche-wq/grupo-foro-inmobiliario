"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string;
  fecha_reserva: string | null;
  fecha_escritura: string | null;
  fecha_cierre: string | null;
  contacto_id: string | null;
  updated_at: string;
  contacto?: { nombre: string; apellido: string; telefono: string | null } | null;
}

interface Hito {
  id: string;
  negocio_id: string;
  tipo: string;
  fecha: string;
  completado: boolean;
  notas: string | null;
}

const TIPOS_HITO = [
  { value: "reserva",      label: "Reserva",          icon: "📝", color: "#f59e0b" },
  { value: "boleto",       label: "Boleto de compra",  icon: "📋", color: "#06b6d4" },
  { value: "escritura",    label: "Escritura",         icon: "⚖️", color: "#6366f1" },
  { value: "posesion",     label: "Posesión",          icon: "🔑", color: "#10b981" },
  { value: "liquidacion",  label: "Liquidación hon.",  icon: "💰", color: "#22c55e" },
  { value: "otro",         label: "Otro",              icon: "📌", color: "#94a3b8" },
];

const diasRestantes = (fecha: string) => {
  const diff = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
  return diff;
};

const fmtFecha = (f: string) => new Date(f + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

const fmtMonto = (v: number | null, m: string) => !v ? "" : m === "USD" ? `USD ${v.toLocaleString("es-AR")}` : `$ ${v.toLocaleString("es-AR")}`;

export default function EscriturasPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalHito, setModalHito] = useState<{ negocioId: string; tipo: string; fecha: string; notas: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const cargar = async (uid: string) => {
    const { data: neg } = await supabase
      .from("crm_negocios")
      .select("id,titulo,etapa,tipo_operacion,valor_operacion,moneda,fecha_reserva,fecha_escritura,fecha_cierre,contacto_id,updated_at, contacto:crm_contactos(nombre,apellido,telefono)")
      .eq("perfil_id", uid)
      .in("etapa", ["reserva", "escritura", "cerrado"])
      .eq("archivado", false)
      .order("updated_at", { ascending: false });

    const negList = (neg ?? []) as unknown as Negocio[];
    const ids = negList.map((n: Negocio) => n.id);
    let hitosData: Hito[] = [];
    if (ids.length > 0) {
      const { data: h } = await supabase.from("crm_escritura_hitos").select("*").in("negocio_id", ids).order("fecha");
      hitosData = (h ?? []) as Hito[];
    }

    setNegocios(negList);
    setHitos(hitosData);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      setLoading(false);
    })();
  }, []);

  const hitosDeNegocio = (negId: string) => hitos.filter(h => h.negocio_id === negId).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const toggleHito = async (hito: Hito) => {
    if (!userId) return;
    await supabase.from("crm_escritura_hitos").update({ completado: !hito.completado }).eq("id", hito.id);
    setHitos(prev => prev.map(h => h.id === hito.id ? { ...h, completado: !h.completado } : h));
  };

  const guardarHito = async () => {
    if (!userId || !modalHito) return;
    setGuardando(true);
    const existing = hitos.find(h => h.negocio_id === modalHito.negocioId && h.tipo === modalHito.tipo);
    if (existing) {
      await supabase.from("crm_escritura_hitos").update({ fecha: modalHito.fecha, notas: modalHito.notas || null }).eq("id", existing.id);
    } else {
      await supabase.from("crm_escritura_hitos").insert({ perfil_id: userId, negocio_id: modalHito.negocioId, tipo: modalHito.tipo, fecha: modalHito.fecha, notas: modalHito.notas || null });
    }
    await cargar(userId);
    setModalHito(null);
    setGuardando(false);
    showToast("Hito guardado");
  };

  const eliminarHito = async (id: string) => {
    if (!userId) return;
    await supabase.from("crm_escritura_hitos").delete().eq("id", id);
    setHitos(prev => prev.filter(h => h.id !== id));
  };

  const proximoHito = (negId: string) => {
    const pendientes = hitosDeNegocio(negId).filter(h => !h.completado && h.fecha >= new Date().toISOString().slice(0, 10));
    return pendientes[0];
  };

  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>{toast}</div>}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>⚖️ Seguimiento de Escrituras</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Cronograma de hitos para negocios en reserva y escrituración</p>
      </div>

      {negocios.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚖️</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Sin negocios en escrituración</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Los negocios en etapa reserva, escritura o cerrado aparecerán aquí</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {negocios.map(neg => {
            const negHitos = hitosDeNegocio(neg.id);
            const proximo = proximoHito(neg.id);
            const diasProx = proximo ? diasRestantes(proximo.fecha) : null;
            const completados = negHitos.filter(h => h.completado).length;
            const total = negHitos.length;
            const isOpen = expandido === neg.id;
            const contacto = neg.contacto as any;

            return (
              <div key={neg.id} style={{ background: "#1e293b", borderRadius: 14, overflow: "hidden", border: diasProx !== null && diasProx <= 3 && diasProx >= 0 ? "1px solid #ef444444" : "1px solid #334155" }}>
                {/* Header */}
                <div style={{ padding: "18px 22px", cursor: "pointer" }} onClick={() => setExpandido(isOpen ? null : neg.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 15 }}>{neg.titulo}</span>
                        <span style={{ background: "#6366f122", color: "#818cf8", fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>{neg.etapa}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {neg.tipo_operacion} {fmtMonto(neg.valor_operacion, neg.moneda) && `· ${fmtMonto(neg.valor_operacion, neg.moneda)}`}
                        {contacto && ` · Cliente: ${contacto.nombre} ${contacto.apellido}`}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {proximo && (
                        <div style={{ fontSize: 12, color: diasProx !== null && diasProx <= 3 ? "#ef4444" : diasProx !== null && diasProx <= 7 ? "#f59e0b" : "#94a3b8" }}>
                          {TIPOS_HITO.find(t => t.value === proximo.tipo)?.icon} {TIPOS_HITO.find(t => t.value === proximo.tipo)?.label}
                          <br />
                          <strong>{fmtFecha(proximo.fecha)}</strong> {diasProx !== null && <span>({diasProx === 0 ? "hoy" : diasProx < 0 ? `${Math.abs(diasProx)}d vencido` : `en ${diasProx}d`})</span>}
                        </div>
                      )}
                      {total > 0 && <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>{completados}/{total} hitos</div>}
                    </div>
                  </div>
                </div>

                {/* Expandido: hitos */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid #334155", padding: "16px 22px" }}>
                    {/* Línea de tiempo */}
                    {negHitos.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        {negHitos.map(h => {
                          const tipoInfo = TIPOS_HITO.find(t => t.value === h.tipo);
                          const dias = diasRestantes(h.fecha);
                          return (
                            <div key={h.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
                              <button onClick={() => toggleHito(h)}
                                style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${h.completado ? "#22c55e" : tipoInfo?.color ?? "#334155"}`, background: h.completado ? "#22c55e" : "transparent", cursor: "pointer", flexShrink: 0, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                                {h.completado ? "✓" : ""}
                              </button>
                              <span style={{ fontSize: 16, flexShrink: 0 }}>{tipoInfo?.icon}</span>
                              <div style={{ flex: 1 }}>
                                <span style={{ color: h.completado ? "#64748b" : "#f8fafc", fontSize: 14, fontWeight: 500, textDecoration: h.completado ? "line-through" : "none" }}>
                                  {tipoInfo?.label}
                                </span>
                                {h.notas && <div style={{ color: "#64748b", fontSize: 12 }}>{h.notas}</div>}
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 13, color: !h.completado && dias <= 3 ? "#ef4444" : !h.completado && dias <= 7 ? "#f59e0b" : "#94a3b8" }}>
                                  {fmtFecha(h.fecha)}
                                </div>
                                {!h.completado && <div style={{ fontSize: 11, color: "#64748b" }}>{dias < 0 ? `${Math.abs(dias)}d vencido` : dias === 0 ? "hoy" : `en ${dias}d`}</div>}
                              </div>
                              <button onClick={() => eliminarHito(h.id)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Agregar hito */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {TIPOS_HITO.map(t => {
                        const yaExiste = negHitos.some(h => h.tipo === t.value);
                        return (
                          <button key={t.value} onClick={() => setModalHito({ negocioId: neg.id, tipo: t.value, fecha: new Date().toISOString().slice(0, 10), notas: "" })}
                            style={{ background: yaExiste ? "#052e16" : "#0f172a", color: yaExiste ? "#22c55e" : "#94a3b8", border: `1px solid ${yaExiste ? "#166534" : "#334155"}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>
                            {t.icon} {t.label} {yaExiste ? "✓" : "+"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal agregar/editar hito */}
      {modalHito && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, border: "1px solid #1e293b" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700, color: "#f8fafc" }}>
              {TIPOS_HITO.find(t => t.value === modalHito.tipo)?.icon} {TIPOS_HITO.find(t => t.value === modalHito.tipo)?.label}
            </h2>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Fecha *</label>
            <input type="date" value={modalHito.fecha} onChange={e => setModalHito(m => m ? { ...m, fecha: e.target.value } : null)}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Notas</label>
            <input value={modalHito.notas} onChange={e => setModalHito(m => m ? { ...m, notas: e.target.value } : null)} placeholder="Escribano, horario, etc."
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 20, boxSizing: "border-box" }} />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModalHito(null)} style={{ background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 20px", cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardarHito} disabled={guardando || !modalHito.fecha}
                style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, cursor: "pointer", opacity: guardando ? 0.7 : 1 }}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
