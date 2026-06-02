"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Plantillas de checklist ────────────────────────────────────────────────────

interface CheckItem {
  id: string;
  label: string;
  categoria: string;
  responsable: "corredor" | "comprador" | "vendedor" | "escribano" | "banco" | "inquilino" | "propietario";
  obligatorio: boolean;
}

const CHECKLIST_VENTA: CheckItem[] = [
  // Pre-reserva
  { id: "v1", label: "Verificar titularidad en Registro de la Propiedad", categoria: "Pre-reserva", responsable: "escribano", obligatorio: true },
  { id: "v2", label: "Certificado de inhibición del vendedor", categoria: "Pre-reserva", responsable: "escribano", obligatorio: true },
  { id: "v3", label: "Libre deuda TGI (Tasa General de Inmuebles)", categoria: "Pre-reserva", responsable: "vendedor", obligatorio: true },
  { id: "v4", label: "Libre deuda expensas", categoria: "Pre-reserva", responsable: "vendedor", obligatorio: false },
  { id: "v5", label: "Libre deuda agua (Aguas Santafesinas)", categoria: "Pre-reserva", responsable: "vendedor", obligatorio: true },
  { id: "v6", label: "Verificar medidas del plano municipal", categoria: "Pre-reserva", responsable: "corredor", obligatorio: false },
  // Reserva
  { id: "r1", label: "Contrato de reserva firmado por ambas partes", categoria: "Reserva", responsable: "corredor", obligatorio: true },
  { id: "r2", label: "Cobro y depósito del importe de reserva", categoria: "Reserva", responsable: "corredor", obligatorio: true },
  { id: "r3", label: "DNI/CUIT de ambas partes verificados", categoria: "Reserva", responsable: "corredor", obligatorio: true },
  { id: "r4", label: "Verificar estado civil y régimen patrimonial", categoria: "Reserva", responsable: "escribano", obligatorio: true },
  { id: "r5", label: "Consentimiento conyugal (si aplica)", categoria: "Reserva", responsable: "escribano", obligatorio: false },
  { id: "r6", label: "COTI solicitado a AFIP (si precio supera umbral)", categoria: "Reserva", responsable: "vendedor", obligatorio: false },
  // Pre-escritura
  { id: "e1", label: "Boleto de compraventa firmado", categoria: "Pre-escritura", responsable: "escribano", obligatorio: true },
  { id: "e2", label: "Certificados registrales actualizados (30 días)", categoria: "Pre-escritura", responsable: "escribano", obligatorio: true },
  { id: "e3", label: "Tasación banco (si hay hipoteca)", categoria: "Pre-escritura", responsable: "banco", obligatorio: false },
  { id: "e4", label: "Aprobación crédito banco (si aplica)", categoria: "Pre-escritura", responsable: "banco", obligatorio: false },
  { id: "e5", label: "Cuadro de gastos de escritura entregado al comprador", categoria: "Pre-escritura", responsable: "corredor", obligatorio: true },
  { id: "e6", label: "ITI pagado por el vendedor", categoria: "Pre-escritura", responsable: "vendedor", obligatorio: false },
  // Escritura
  { id: "es1", label: "Fecha y hora de escritura confirmada", categoria: "Escritura", responsable: "corredor", obligatorio: true },
  { id: "es2", label: "Todos los fondos listos (efectivo / transferencia)", categoria: "Escritura", responsable: "comprador", obligatorio: true },
  { id: "es3", label: "Escritura firmada por ambas partes", categoria: "Escritura", responsable: "escribano", obligatorio: true },
  { id: "es4", label: "Escritura presentada al Registro", categoria: "Escritura", responsable: "escribano", obligatorio: true },
  { id: "es5", label: "Entrega de llaves", categoria: "Escritura", responsable: "vendedor", obligatorio: true },
  // Post-escritura
  { id: "p1", label: "Honorarios inmobiliaria cobrados", categoria: "Post-escritura", responsable: "corredor", obligatorio: true },
  { id: "p2", label: "Escritura inscripta en Registro (definitiva)", categoria: "Post-escritura", responsable: "escribano", obligatorio: true },
  { id: "p3", label: "Cambio de titularidad en TGI y servicios", categoria: "Post-escritura", responsable: "comprador", obligatorio: false },
  { id: "p4", label: "Feedback al cliente solicitado", categoria: "Post-escritura", responsable: "corredor", obligatorio: false },
  { id: "p5", label: "Negocio cerrado en sistema CRM", categoria: "Post-escritura", responsable: "corredor", obligatorio: true },
];

const CHECKLIST_ALQUILER: CheckItem[] = [
  { id: "a1", label: "Identidad y CUIT del inquilino verificados", categoria: "Pre-contrato", responsable: "corredor", obligatorio: true },
  { id: "a2", label: "Recibos de sueldo o documentación de ingresos", categoria: "Pre-contrato", responsable: "inquilino", obligatorio: true },
  { id: "a3", label: "Garantía analizada y aprobada", categoria: "Pre-contrato", responsable: "corredor", obligatorio: true },
  { id: "a4", label: "Contrato redactado y revisado", categoria: "Contrato", responsable: "corredor", obligatorio: true },
  { id: "a5", label: "Contrato firmado por ambas partes", categoria: "Contrato", responsable: "corredor", obligatorio: true },
  { id: "a6", label: "Depósito de garantía cobrado y documentado", categoria: "Contrato", responsable: "corredor", obligatorio: true },
  { id: "a7", label: "Primer mes de alquiler cobrado", categoria: "Contrato", responsable: "corredor", obligatorio: true },
  { id: "a8", label: "Inventario del estado del inmueble firmado", categoria: "Entrega", responsable: "corredor", obligatorio: true },
  { id: "a9", label: "Acta de entrega de llaves firmada", categoria: "Entrega", responsable: "corredor", obligatorio: true },
  { id: "a10", label: "Lecturas de medidores (luz, gas, agua) registradas", categoria: "Entrega", responsable: "corredor", obligatorio: false },
  { id: "a11", label: "Cambio de titularidad servicios notificado", categoria: "Entrega", responsable: "inquilino", obligatorio: false },
  { id: "a12", label: "Honorarios cobrados", categoria: "Post-firma", responsable: "corredor", obligatorio: true },
  { id: "a13", label: "Alta en sistema de gestión de alquileres", categoria: "Post-firma", responsable: "corredor", obligatorio: false },
];

const RESP_COLORS: Record<string, string> = {
  corredor: "#990000",
  comprador: "#3b82f6",
  vendedor: "#d4960c",
  escribano: "#8b5cf6",
  banco: "#06b6d4",
  inquilino: "#3abab6",
  propietario: "#d4960c",
};

const RESP_LABELS: Record<string, string> = {
  corredor: "Corredor", comprador: "Comprador", vendedor: "Vendedor",
  escribano: "Escribano", banco: "Banco", inquilino: "Inquilino", propietario: "Propietario",
};

type TipoOp = "venta" | "alquiler";

interface ChecklistGuardado {
  negocioId: string;
  checks: Record<string, boolean>;
  notas: Record<string, string>;
}

export default function ChecklistCierrePage() {
  const [tipoOp, setTipoOp] = useState<TipoOp>("venta");
  const [negocioId, setNegocioId] = useState<string>("");
  const [negocios, setNegocios] = useState<Array<{ id: string; titulo: string; tipo_operacion: string; etapa: string }>>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [editandoNota, setEditandoNota] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [allChecklists, setAllChecklists] = useState<ChecklistGuardado[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_checklists_cierre")
        .select("checklists")
        .eq("perfil_id", userId)
        .maybeSingle();
      if (row?.checklists && Array.isArray(row.checklists)) {
        setAllChecklists(row.checklists as ChecklistGuardado[]);
      }
      const { data: neg } = await supabase
        .from("crm_negocios")
        .select("id,titulo,tipo_operacion,etapa")
        .eq("perfil_id", userId)
        .eq("archivado", false)
        .order("updated_at", { ascending: false });
      setNegocios(neg ?? []);
      setLoading(false);
    });
  }, []);

  // Load checks/notas for the selected negocio from allChecklists
  useEffect(() => {
    if (!negocioId) return;
    const found = allChecklists.find((c) => c.negocioId === negocioId);
    if (found) {
      setChecks(found.checks);
      setNotas(found.notas);
    } else {
      setChecks({});
      setNotas({});
    }
  }, [negocioId, allChecklists]);

  const guardarSB = useCallback((updated: ChecklistGuardado[]) => {
    if (!uid) return;
    supabase.from("crm_checklists_cierre").upsert(
      { perfil_id: uid, checklists: updated, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id" }
    ).then(() => {});
  }, [uid]);

  function guardar(newChecks: Record<string, boolean>, newNotas: Record<string, string>) {
    if (!negocioId) return;
    const entry: ChecklistGuardado = { negocioId, checks: newChecks, notas: newNotas };
    const updated = allChecklists.some((c) => c.negocioId === negocioId)
      ? allChecklists.map((c) => c.negocioId === negocioId ? entry : c)
      : [...allChecklists, entry];
    setAllChecklists(updated);
    guardarSB(updated);
  }

  function toggleCheck(id: string) {
    const updated = { ...checks, [id]: !checks[id] };
    setChecks(updated);
    guardar(updated, notas);
  }

  function saveNota(id: string, nota: string) {
    const updated = { ...notas, [id]: nota };
    setNotas(updated);
    guardar(checks, updated);
    setEditandoNota(null);
  }

  const lista = tipoOp === "venta" ? CHECKLIST_VENTA : CHECKLIST_ALQUILER;
  const categorias = [...new Set(lista.map((i) => i.categoria))];

  const stats = useMemo(() => {
    const total = lista.length;
    const oblig = lista.filter((i) => i.obligatorio).length;
    const done = lista.filter((i) => checks[i.id]).length;
    const obligDone = lista.filter((i) => i.obligatorio && checks[i.id]).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const pctOblig = oblig > 0 ? Math.round((obligDone / oblig) * 100) : 0;
    return { total, oblig, done, obligDone, pct, pctOblig };
  }, [lista, checks]);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, margin: 0 }}>
            Checklist de Cierre
          </h1>
          <p style={{ color: "#999", fontSize: 13, margin: "6px 0 0" }}>
            Lista de verificación para operaciones de venta y alquiler
          </p>
        </div>

        {/* Selector */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {(["venta", "alquiler"] as TipoOp[]).map((t) => (
              <button key={t} onClick={() => setTipoOp(t)} style={{
                padding: "8px 20px", borderRadius: 8,
                border: tipoOp === t ? "1px solid #990000" : "1px solid #333",
                background: tipoOp === t ? "rgba(153,0,0,0.15)" : "#111",
                color: tipoOp === t ? "#990000" : "#888",
                fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12,
                cursor: "pointer", textTransform: "capitalize",
              }}>
                {t === "venta" ? "Venta" : "Alquiler"}
              </button>
            ))}
          </div>

          <select
            value={negocioId}
            onChange={(e) => setNegocioId(e.target.value)}
            style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: 8, color: "#fff", padding: "8px 14px", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer", maxWidth: 400 }}
          >
            <option value="">— Seleccionar negocio (para guardar progreso) —</option>
            {negocios
              .filter((n) => tipoOp === "alquiler" ? n.tipo_operacion.includes("alquiler") : n.tipo_operacion === "venta")
              .map((n) => (
                <option key={n.id} value={n.id}>{n.titulo} · {n.etapa}</option>
              ))}
          </select>
        </div>

        {/* Progress bar */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <span style={{ fontSize: 24, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff" }}>{stats.pct}%</span>
                <span style={{ fontSize: 12, color: "#666", marginLeft: 6 }}>completado ({stats.done}/{stats.total})</span>
              </div>
              <div>
                <span style={{ fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: stats.pctOblig === 100 ? "#3abab6" : "#990000" }}>{stats.pctOblig}%</span>
                <span style={{ fontSize: 12, color: "#666", marginLeft: 6 }}>obligatorios ({stats.obligDone}/{stats.oblig})</span>
              </div>
            </div>
            {stats.pctOblig === 100 && (
              <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#3abab6", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                ✓ Listo para cerrar
              </div>
            )}
          </div>
          <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${stats.pct}%`, height: "100%", background: stats.pctOblig === 100 ? "#3abab6" : "#990000", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Leyenda responsables */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(RESP_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: RESP_COLORS[key] ?? "#888" }} />
              <span style={{ fontSize: 11, color: "#666" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Checklist por categoría */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {categorias.map((cat) => {
            const catItems = lista.filter((i) => i.categoria === cat);
            const catDone = catItems.filter((i) => checks[i.id]).length;
            const allDone = catDone === catItems.length;
            return (
              <div key={cat} style={{ background: "#111", border: `1px solid ${allDone ? "rgba(34,197,94,0.3)" : "#222"}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", background: allDone ? "rgba(34,197,94,0.06)" : "#161616", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: allDone ? "#3abab6" : "#fff" }}>
                    {allDone ? "✓ " : ""}{cat}
                  </div>
                  <div style={{ fontSize: 11, color: allDone ? "#3abab6" : "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    {catDone}/{catItems.length}
                  </div>
                </div>
                <div>
                  {catItems.map((item) => {
                    const done = !!checks[item.id];
                    const nota = notas[item.id] ?? "";
                    const isEditNota = editandoNota === item.id;
                    return (
                      <div key={item.id} style={{ borderTop: "1px solid #1a1a1a", padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleCheck(item.id)}
                            style={{
                              width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 2,
                              border: `2px solid ${done ? "#3abab6" : item.obligatorio ? "#990000" : "#444"}`,
                              background: done ? "#3abab6" : "transparent",
                              cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {done && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
                          </button>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, color: done ? "#666" : "#fff", textDecoration: done ? "line-through" : "none" }}>
                                {item.label}
                              </span>
                              {item.obligatorio && (
                                <span style={{ fontSize: 9, color: "#990000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, background: "rgba(153,0,0,0.15)", borderRadius: 3, padding: "1px 5px" }}>
                                  OBLIG
                                </span>
                              )}
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: RESP_COLORS[item.responsable] ?? "#888" }} />
                              <span style={{ fontSize: 10, color: "#666" }}>{RESP_LABELS[item.responsable]}</span>
                            </div>

                            {/* Nota */}
                            {isEditNota ? (
                              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                <input
                                  autoFocus
                                  type="text"
                                  defaultValue={nota}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveNota(item.id, e.currentTarget.value);
                                    if (e.key === "Escape") setEditandoNota(null);
                                  }}
                                  onBlur={(e) => saveNota(item.id, e.target.value)}
                                  style={{ flex: 1, background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "Inter, sans-serif" }}
                                />
                              </div>
                            ) : (
                              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                                {nota && (
                                  <span style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>{nota}</span>
                                )}
                                <button
                                  onClick={() => setEditandoNota(item.id)}
                                  style={{ fontSize: 10, color: "#444", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif" }}
                                >
                                  {nota ? "✏ editar" : "+ nota"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reset */}
        {Object.keys(checks).length > 0 && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button
              onClick={() => { setChecks({}); setNotas({}); guardar({}, {}); }}
              style={{ background: "none", border: "1px solid #333", borderRadius: 8, color: "#555", padding: "8px 20px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}
            >
              Reiniciar checklist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
