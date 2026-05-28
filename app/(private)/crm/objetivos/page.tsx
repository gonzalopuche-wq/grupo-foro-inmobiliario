"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Negocio {
  id: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  fecha_cierre: string | null;
  created_at: string;
}

interface Objetivo {
  id: string;
  label: string;
  tipo: "cantidad" | "monto";
  meta: number;
  icono: string;
  color: string;
}

const HOY = new Date().toISOString().slice(0, 10);

function mesActual() { return HOY.slice(0, 7); }

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const DEFAULTS: Objetivo[] = [
  { id: "cierres", label: "Cierres del mes", tipo: "cantidad", meta: 3, icono: "🏆", color: "#22c55e" },
  { id: "honorarios", label: "Honorarios mes (USD)", tipo: "monto", meta: 15000, icono: "💰", color: "#a855f7" },
  { id: "nuevos_negocios", label: "Negocios captados", tipo: "cantidad", meta: 8, icono: "🎯", color: "#3b82f6" },
  { id: "interacciones", label: "Interacciones mes", tipo: "cantidad", meta: 50, icono: "📞", color: "#f97316" },
  { id: "visitas", label: "Visitas / reuniones", tipo: "cantidad", meta: 15, icono: "🏠", color: "#eab308" },
  { id: "propiedades_captadas", label: "Propiedades captadas", tipo: "cantidad", meta: 5, icono: "🔑", color: "#06b6d4" },
];

export default function ObjetivosPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [objetivos, setObjetivos] = useState<Objetivo[]>(DEFAULTS);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [interacciones, setInteracciones] = useState<{ created_at: string; tipo: string }[]>([]);
  const [tc, setTc] = useState(1300);
  const [honPct, setHonPct] = useState(3);
  const [editMode, setEditMode] = useState(false);
  const [mes, setMes] = useState(mesActual());
  const [historial, setHistorial] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);

      // Load negocios and interacciones
      Promise.all([
        supabase.from("crm_negocios").select("id,etapa,tipo_operacion,valor_operacion,moneda,honorarios_pct,fecha_cierre,created_at").eq("perfil_id", userId),
        supabase.from("crm_interacciones").select("created_at,tipo").eq("perfil_id", userId),
      ]).then(([{ data: n }, { data: i }]) => {
        setNegocios((n ?? []) as Negocio[]);
        setInteracciones(i ?? []);
      });

      // Load objectives config from Supabase (rows where anio IS NULL = config rows)
      const { data: objRows } = await supabase
        .from("crm_objetivos")
        .select("*")
        .eq("perfil_id", userId)
        .is("anio", null)
        .order("created_at", { ascending: true });

      if (objRows && objRows.length > 0) {
        const mapped: Objetivo[] = objRows.map((row: Record<string, unknown>) => ({
          id: row.titulo as string,
          label: row.descripcion as string,
          tipo: (row.categoria as string) === "monto" ? "monto" : "cantidad",
          meta: row.meta as number,
          icono: row.unidad as string,
          color: row.periodo as string,
        }));
        setObjetivos(mapped);
      }

      // Load historial from Supabase (rows where anio IS NOT NULL = per-month entries)
      const { data: histRows } = await supabase
        .from("crm_objetivos")
        .select("*")
        .eq("perfil_id", userId)
        .not("anio", "is", null)
        .order("created_at", { ascending: true });

      if (histRows && histRows.length > 0) {
        const hist: Record<string, Record<string, number>> = {};
        for (const row of histRows as Record<string, unknown>[]) {
          const anio = row.anio as number;
          const mes_ = String(row.mes as number).padStart(2, "0");
          const key = `${anio}-${mes_}`;
          if (!hist[key]) hist[key] = {};
          const titulo = row.titulo as string;
          const progreso = row.progreso as number | null;
          const meta_ = row.meta as number | null;
          if (progreso !== null && progreso !== undefined) {
            hist[key][titulo] = progreso;
          }
          if (meta_ !== null && meta_ !== undefined) {
            hist[key][`meta_${titulo}`] = meta_;
          }
        }
        setHistorial(hist);
      }
    });
  }, []);

  const guardarObjetivos = async (list: Objetivo[]) => {
    setObjetivos(list);
    if (!uid) return;

    // Delete existing config rows (anio IS NULL) and re-insert
    await supabase
      .from("crm_objetivos")
      .delete()
      .eq("perfil_id", uid)
      .is("anio", null);

    const rows = list.map((obj) => ({
      perfil_id: uid,
      titulo: obj.id,
      descripcion: obj.label,
      categoria: obj.tipo,
      meta: obj.meta,
      unidad: obj.icono,
      periodo: obj.color,
      completado: false,
    }));

    if (rows.length > 0) {
      await supabase.from("crm_objetivos").insert(rows);
    }
  };

  const valorUSD = (n: Negocio) => {
    const v = n.valor_operacion ?? 0;
    return n.moneda === "ARS" ? v / tc : v;
  };
  const honUSD = (n: Negocio) => valorUSD(n) * (n.honorarios_pct ?? honPct) / 100;

  const real = useMemo(() => {
    const esMes = (fecha: string) => fecha.slice(0, 7) === mes;
    const cerrados = negocios.filter(n => n.etapa === "cerrado" && n.fecha_cierre && esMes(n.fecha_cierre));
    const nuevosNegocios = negocios.filter(n => esMes(n.created_at));
    const ints = interacciones.filter(i => esMes(i.created_at));
    const visitas = ints.filter(i => ["visita","reunion"].includes(i.tipo));
    const honorarios = cerrados.reduce((s, n) => s + honUSD(n), 0);
    return {
      cierres: cerrados.length,
      honorarios,
      nuevos_negocios: nuevosNegocios.length,
      interacciones: ints.length,
      visitas: visitas.length,
      propiedades_captadas: nuevosNegocios.filter(n => n.tipo_operacion === "captacion").length,
    };
  }, [negocios, interacciones, mes, tc, honPct]);

  const getMeta = (obj: Objetivo) => {
    return historial[mes]?.[`meta_${obj.id}`] ?? obj.meta;
  };

  const getRealManual = (obj: Objetivo) => historial[mes]?.[obj.id];

  const getRealAuto = (id: string): number => {
    return (real as Record<string, number>)[id] ?? 0;
  };

  const getRealFinal = (obj: Objetivo) => {
    const manual = getRealManual(obj);
    if (manual !== undefined) return manual;
    return getRealAuto(obj.id);
  };

  const upsertHistorialRow = async (
    mesKey: string,
    objId: string,
    progresoVal: number | null,
    metaVal: number | null
  ) => {
    if (!uid) return;
    const [anio, mesNum] = mesKey.split("-").map(Number);
    // Find existing row for this month+objId
    const { data: existing } = await supabase
      .from("crm_objetivos")
      .select("id")
      .eq("perfil_id", uid)
      .eq("titulo", objId)
      .eq("anio", anio)
      .eq("mes", mesNum)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (progresoVal !== null) updates.progreso = progresoVal;
      if (metaVal !== null) updates.meta = metaVal;
      await supabase
        .from("crm_objetivos")
        .update(updates)
        .eq("id", existing.id)
        .eq("perfil_id", uid);
    } else {
      const insert: Record<string, unknown> = {
        perfil_id: uid,
        titulo: objId,
        anio,
        mes: mesNum,
        completado: false,
      };
      if (progresoVal !== null) insert.progreso = progresoVal;
      if (metaVal !== null) insert.meta = metaVal;
      await supabase.from("crm_objetivos").insert(insert);
    }
  };

  const setRealManual = async (id: string, val: number) => {
    const nuevo = { ...historial, [mes]: { ...(historial[mes] ?? {}), [id]: val } };
    setHistorial(nuevo);
    const metaVal = historial[mes]?.[`meta_${id}`] ?? null;
    await upsertHistorialRow(mes, id, val, metaVal);
  };

  const setMetaOverride = async (id: string, val: number) => {
    const nuevo = { ...historial, [mes]: { ...(historial[mes] ?? {}), [`meta_${id}`]: val } };
    setHistorial(nuevo);
    const progresoVal = historial[mes]?.[id] ?? null;
    await upsertHistorialRow(mes, id, progresoVal, val);
  };

  const mesesDisp = useMemo(() => {
    const set = new Set<string>();
    set.add(mesActual());
    set.add(mes);
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      set.add(d.toISOString().slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [mes]);

  const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const [a, m] = mes.split("-");
  const mesLabel = `${MESES_LABEL[parseInt(m)-1]} ${a}`;

  const cumplimiento = useMemo(() => {
    let sum = 0;
    objetivos.forEach(o => {
      const meta = getMeta(o);
      const realV = getRealFinal(o);
      sum += Math.min(1, meta > 0 ? realV / meta : 0);
    });
    return objetivos.length > 0 ? (sum / objetivos.length) * 100 : 0;
  }, [objetivos, historial, mes, real]);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>🎯 Objetivos del Mes</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Seguimiento de metas mensuales — {mesLabel}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
            <button onClick={() => setEditMode(!editMode)}
              style={{ background: editMode ? "#cc000033" : "#1f2937", color: editMode ? "#cc0000" : "#e5e5e5", border: `1px solid ${editMode ? "#cc000066" : "#374151"}`, borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
              {editMode ? "✓ Listo" : "✏️ Editar metas"}
            </button>
          </div>
        </div>

        {/* Config */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Mes</label>
            <select value={mes} onChange={e => setMes(e.target.value)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13 }}>
              {mesesDisp.map(mv => {
                const [ya, ym] = mv.split("-");
                return <option key={mv} value={mv}>{MESES_LABEL[parseInt(ym)-1]} {ya}</option>;
              })}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>TC</label>
            <input type="number" value={tc} onChange={e => setTc(parseFloat(e.target.value)||1)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: 90 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>% Honorarios</label>
            <input type="number" value={honPct} onChange={e => setHonPct(parseFloat(e.target.value)||0)} step={0.5}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: 70 }} />
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Cumplimiento global</div>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: cumplimiento >= 80 ? "#22c55e" : cumplimiento >= 50 ? "#f97316" : "#cc0000" }}>
              {cumplimiento.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Barra cumplimiento global */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 18px", marginBottom: 24 }}>
          <div style={{ background: "#1a1a1a", borderRadius: 8, height: 14, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: `${Math.min(100, cumplimiento)}%`, height: "100%", background: cumplimiento >= 80 ? "#22c55e" : cumplimiento >= 50 ? "#f97316" : "#cc0000", transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280" }}>
            <span>0%</span>
            <span style={{ color: cumplimiento >= 80 ? "#22c55e" : cumplimiento >= 50 ? "#f97316" : "#cc0000", fontWeight: 700 }}>
              {cumplimiento.toFixed(0)}% de cumplimiento — {mesLabel}
            </span>
            <span>100%</span>
          </div>
        </div>

        {/* Objetivos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {objetivos.map(obj => {
            const meta = getMeta(obj);
            const realV = getRealFinal(obj);
            const pct = meta > 0 ? Math.min(100, (realV / meta) * 100) : 0;
            const restante = Math.max(0, meta - realV);
            const isAuto = getRealManual(obj) === undefined;
            return (
              <div key={obj.id} style={{ background: "#111", border: `1px solid ${obj.color}33`, borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 24 }}>{obj.icono}</span>
                    <div>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>{obj.label}</div>
                      <div style={{ fontSize: 11, color: "#4b5563" }}>{isAuto ? "Auto desde CRM" : "Ingresado manualmente"}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: obj.color }}>
                      {obj.tipo === "monto" ? `USD ${fmt(realV)}` : realV}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      meta: {editMode ? (
                        <input type="number" defaultValue={meta}
                          onBlur={e => setMetaOverride(obj.id, parseFloat(e.target.value) || 0)}
                          style={{ background: "#0a0a0a", border: "1px solid #555", borderRadius: 4, color: "#e5e5e5", padding: "2px 6px", fontSize: 12, width: 80 }} />
                      ) : (
                        <span style={{ color: "#9ca3af" }}>{obj.tipo === "monto" ? `USD ${fmt(meta)}` : meta}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ background: "#1a1a1a", borderRadius: 8, height: 12, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#22c55e" : pct >= 60 ? obj.color : `${obj.color}88`, transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: pct >= 100 ? "#22c55e" : "#6b7280" }}>
                    {pct >= 100 ? "✅ Meta cumplida" : `${pct.toFixed(0)}% — Faltan ${obj.tipo === "monto" ? `USD ${fmt(restante)}` : restante}`}
                  </span>
                  {editMode && !isAuto && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>Real:</span>
                      <input type="number" defaultValue={realV}
                        onBlur={e => setRealManual(obj.id, parseFloat(e.target.value) || 0)}
                        style={{ background: "#0a0a0a", border: "1px solid #555", borderRadius: 4, color: "#e5e5e5", padding: "2px 6px", fontSize: 12, width: 80 }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tip */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", marginTop: 24, fontSize: 12, color: "#6b7280" }}>
          <strong style={{ color: "#9ca3af" }}>📌 Tip:</strong> Los valores de cierres, honorarios, nuevos negocios e interacciones se calculan automáticamente desde el CRM.
          Los indicadores de visitas y propiedades captadas pueden ingresarse manualmente en modo edición.
        </div>
      </div>
    </div>
  );
}
