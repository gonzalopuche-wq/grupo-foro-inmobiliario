"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface BarrioStat {
  barrio: string;
  cant: number;
  precio_venta_avg: number;
  precio_m2_avg: number;
}

interface TipoStat {
  tipo: string;
  cant: number;
}

interface MIRStat {
  tipo: string;
  ofrecidos: number;
  busquedas: number;
}

interface ComunidadStat {
  total_corredores: number;
  total_comparables: number;
  total_mir: number;
}

const fmtNum = (v: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v);
const fmtUSD = (v: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

function HBar({
  label, value, max, color = "rgba(200,0,0,0.7)", sub,
}: {
  label: string; value: number; max: number; color?: string; sub?: string;
}) {
  const pct = Math.max((value / Math.max(max, 1)) * 100, value > 0 ? 2 : 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
      <div style={{ width: 120, fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "right", flexShrink: 0, fontFamily: "Inter,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 22, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.5s ease", display: "flex", alignItems: "center", paddingLeft: 6 }}>
          <span style={{ fontSize: 10, color: "#fff", fontWeight: 600, fontFamily: "Montserrat,sans-serif", whiteSpace: "nowrap" }}>
            {value > 0 ? fmtNum(value) : ""}
          </span>
        </div>
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", flexShrink: 0, minWidth: 80, textAlign: "right" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? "#fff", fontFamily: "Montserrat,sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontFamily: "Inter,sans-serif" }}>{sub}</div>}
    </div>
  );
}

export default function ObservatorioPage() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"3m" | "6m" | "12m" | "todo">("12m");
  const [barrioStats, setBarrioStats] = useState<BarrioStat[]>([]);
  const [tipoStats, setTipoStats] = useState<TipoStat[]>([]);
  const [mirStats, setMirStats] = useState<MIRStat[]>([]);
  const [comunidad, setComunidad] = useState<ComunidadStat>({ total_corredores: 0, total_comparables: 0, total_mir: 0 });
  const [precioM2Global, setPrecioM2Global] = useState(0);

  useEffect(() => { cargar(); }, [periodo]);

  const cargar = async () => {
    setLoading(true);
    try {
      // Date range for MIR (ISO date)
      const fechaDesde = (() => {
        if (periodo === "todo") return null;
        const d = new Date();
        d.setMonth(d.getMonth() - (periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12));
        return d.toISOString().slice(0, 10);
      })();

      // For comparables (uses anio+mes, not timestamp)
      const [anioDesdeFiltro, mesDesdeFiltro] = (() => {
        if (periodo === "todo") return [null, null];
        const d = new Date();
        d.setMonth(d.getMonth() - (periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12));
        return [d.getFullYear(), d.getMonth() + 1];
      })();

      // Fetch all in parallel
      let qOf = supabase.from("mir_ofrecidos").select("tipo_propiedad,operacion").eq("activo", true);
      let qBus = supabase.from("mir_busquedas").select("tipo_propiedad,operacion").eq("activo", true);
      if (fechaDesde) {
        qOf = qOf.gte("created_at", fechaDesde);
        qBus = qBus.gte("created_at", fechaDesde);
      }

      let qComps = supabase
        .from("comparables")
        .select("barrio,tipo_inmueble,precio_venta,sup_cubierta,anio,mes");
      if (anioDesdeFiltro !== null) {
        qComps = (qComps as any).or(
          `anio.gt.${anioDesdeFiltro},and(anio.eq.${anioDesdeFiltro},mes.gte.${mesDesdeFiltro})`
        );
      }

      const [
        { data: ofrecidos },
        { data: busquedas },
        { data: comps },
        { count: totalCorredores },
      ] = await Promise.all([
        qOf.limit(3000),
        qBus.limit(3000),
        qComps.limit(3000),
        supabase.from("perfiles").select("id", { count: "exact", head: true }).neq("tipo", "admin"),
      ]);

      // --- Process comparables ---
      const barrioMap: Record<string, { cant: number; precioSum: number; precioM2Sum: number; m2Cnt: number }> = {};
      const tipoMap: Record<string, number> = {};
      let globalM2Sum = 0, globalM2Cnt = 0;

      for (const c of comps ?? []) {
        const b = (c.barrio ?? "").trim() || null;
        const t = (c.tipo_inmueble ?? "Otro").trim();
        tipoMap[t] = (tipoMap[t] ?? 0) + 1;

        if (b) {
          if (!barrioMap[b]) barrioMap[b] = { cant: 0, precioSum: 0, precioM2Sum: 0, m2Cnt: 0 };
          barrioMap[b].cant++;
          if (c.precio_venta) {
            barrioMap[b].precioSum += c.precio_venta;
            if (c.sup_cubierta && c.sup_cubierta > 0) {
              const pm2 = c.precio_venta / c.sup_cubierta;
              barrioMap[b].precioM2Sum += pm2;
              barrioMap[b].m2Cnt++;
              globalM2Sum += pm2;
              globalM2Cnt++;
            }
          }
        }
      }

      const barrioArr = Object.entries(barrioMap)
        .map(([barrio, s]) => ({
          barrio,
          cant: s.cant,
          precio_venta_avg: s.cant > 0 ? s.precioSum / s.cant : 0,
          precio_m2_avg: s.m2Cnt > 0 ? s.precioM2Sum / s.m2Cnt : 0,
        }))
        .sort((a, b) => b.cant - a.cant)
        .slice(0, 12);

      setBarrioStats(barrioArr);
      setPrecioM2Global(globalM2Cnt > 0 ? globalM2Sum / globalM2Cnt : 0);
      setTipoStats(
        Object.entries(tipoMap)
          .map(([tipo, cant]) => ({ tipo, cant }))
          .sort((a, b) => b.cant - a.cant)
          .slice(0, 8)
      );

      // --- Process MIR ---
      const mirMap: Record<string, { ofrecidos: number; busquedas: number }> = {};
      for (const o of ofrecidos ?? []) {
        const k = o.tipo_propiedad ?? "Otro";
        if (!mirMap[k]) mirMap[k] = { ofrecidos: 0, busquedas: 0 };
        mirMap[k].ofrecidos++;
      }
      for (const b of busquedas ?? []) {
        const k = b.tipo_propiedad ?? "Otro";
        if (!mirMap[k]) mirMap[k] = { ofrecidos: 0, busquedas: 0 };
        mirMap[k].busquedas++;
      }
      setMirStats(
        Object.entries(mirMap)
          .map(([tipo, s]) => ({ tipo, ...s }))
          .sort((a, b) => (b.ofrecidos + b.busquedas) - (a.ofrecidos + a.busquedas))
          .slice(0, 8)
      );

      setComunidad({
        total_corredores: totalCorredores ?? 0,
        total_comparables: comps?.length ?? 0,
        total_mir: (ofrecidos?.length ?? 0) + (busquedas?.length ?? 0),
      });
    } finally {
      setLoading(false);
    }
  };

  const maxBarrioCant = Math.max(...barrioStats.map(b => b.cant), 1);
  const maxBarrioM2 = Math.max(...barrioStats.filter(b => b.precio_m2_avg > 0).map(b => b.precio_m2_avg), 1);
  const maxTipo = Math.max(...tipoStats.map(t => t.cant), 1);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
      `}</style>

      <div style={{ fontFamily: "Inter,sans-serif", color: "#fff", maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>🔭</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>
                Observatorio del Mercado
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>
                Datos anonimizados de toda la comunidad GFI® · Comparables + MIR · Solo corredores matriculados
              </p>
            </div>
          </div>

          {/* Filtro período */}
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {(["3m", "6m", "12m", "todo"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                style={{
                  padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: "1px solid",
                  borderColor: periodo === p ? "#cc0000" : "rgba(255,255,255,0.1)",
                  background: periodo === p ? "rgba(200,0,0,0.15)" : "transparent",
                  color: periodo === p ? "#fff" : "rgba(255,255,255,0.45)",
                  fontFamily: "Montserrat,sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {p === "todo" ? "Historial completo" : p === "3m" ? "3 meses" : p === "6m" ? "6 meses" : "12 meses"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
            Procesando datos del mercado…
          </div>
        ) : (
          <>
            {/* KPIs comunidad */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 12, marginBottom: 28 }}>
              <StatCard icon="👥" label="Corredores GFI®" value={fmtNum(comunidad.total_corredores)} sub="Miembros de la red" color="#60a5fa" />
              <StatCard icon="📊" label="Comparables" value={fmtNum(comunidad.total_comparables)} sub="Operaciones registradas" color="#a78bfa" />
              <StatCard icon="🔄" label="Publicaciones MIR" value={fmtNum(comunidad.total_mir)} sub="Ofrecidos + Búsquedas activos" color="#f97316" />
              <StatCard
                icon="💲"
                label="Precio m² promedio"
                value={precioM2Global > 0 ? fmtUSD(precioM2Global) : "—"}
                sub="USD/m² · Todas las zonas"
                color="#22c55e"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Actividad por barrio */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  Actividad por barrio
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                  Operaciones registradas en comparables GFI®
                </p>
                {barrioStats.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin datos suficientes en el período</p>
                ) : barrioStats.map(b => (
                  <HBar key={b.barrio} label={b.barrio} value={b.cant} max={maxBarrioCant} color="rgba(200,0,0,0.7)" sub={`${b.cant} op.`} />
                ))}
              </div>

              {/* Precio m² por barrio */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  Precio m² por barrio
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                  USD/m² promedio · Precio de venta efectiva
                </p>
                {barrioStats.filter(b => b.precio_m2_avg > 0).length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin datos de precio/m² en el período</p>
                ) : (
                  [...barrioStats]
                    .filter(b => b.precio_m2_avg > 0)
                    .sort((a, b) => b.precio_m2_avg - a.precio_m2_avg)
                    .map(b => (
                      <HBar
                        key={b.barrio}
                        label={b.barrio}
                        value={Math.round(b.precio_m2_avg)}
                        max={maxBarrioM2}
                        color="rgba(34,197,94,0.7)"
                        sub={fmtUSD(b.precio_m2_avg) + "/m²"}
                      />
                    ))
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Tipo de inmueble */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  Operaciones por tipo de inmueble
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                  Comparables registrados por categoría
                </p>
                {tipoStats.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin datos</p>
                ) : tipoStats.map(t => (
                  <HBar key={t.tipo} label={t.tipo} value={t.cant} max={maxTipo} color="rgba(99,102,241,0.7)" />
                ))}
              </div>

              {/* MIR Oferta vs Demanda */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  MIR — Oferta vs Demanda
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                  Publicaciones activas en el Motor de Intercambio Recíproco
                </p>
                {mirStats.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin publicaciones en el período</p>
                ) : (
                  <>
                    {mirStats.map(m => {
                      const total = m.ofrecidos + m.busquedas;
                      const pctOf = total > 0 ? (m.ofrecidos / total) * 100 : 0;
                      const pctBus = total > 0 ? (m.busquedas / total) * 100 : 0;
                      return (
                        <div key={m.tipo} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 4, fontFamily: "Inter,sans-serif" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{m.tipo}</span>
                            <span style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                              <span style={{ color: "#f97316" }}>{m.ofrecidos} of.</span>
                              <span style={{ color: "#a78bfa" }}>{m.busquedas} bús.</span>
                            </span>
                          </div>
                          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
                            {m.ofrecidos > 0 && (
                              <div style={{ width: `${pctOf}%`, background: "rgba(249,115,22,0.7)", transition: "width 0.5s" }} />
                            )}
                            {m.busquedas > 0 && (
                              <div style={{ width: `${pctBus}%`, background: "rgba(167,139,250,0.7)", transition: "width 0.5s" }} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 20, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(249,115,22,0.7)", display: "inline-block" }} />
                        Ofrecidos
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(167,139,250,0.7)", display: "inline-block" }} />
                        Búsquedas
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tabla detalle precios por barrio */}
            {barrioStats.some(b => b.precio_venta_avg > 0 || b.precio_m2_avg > 0) && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20, marginBottom: 20, overflowX: "auto" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  Tabla de precios por barrio
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Barrio", "Operaciones", "Precio venta promedio", "Precio m² promedio"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 600, letterSpacing: "0.05em", fontSize: 11 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...barrioStats]
                      .sort((a, b) => b.precio_m2_avg - a.precio_m2_avg)
                      .map(b => (
                        <tr key={b.barrio} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "9px 12px", color: "#fff", fontWeight: 500 }}>{b.barrio}</td>
                          <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.5)" }}>{b.cant}</td>
                          <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.8)" }}>
                            {b.precio_venta_avg > 0 ? fmtUSD(b.precio_venta_avg) : "—"}
                          </td>
                          <td style={{ padding: "9px 12px", color: "#22c55e", fontWeight: 600 }}>
                            {b.precio_m2_avg > 0 ? fmtUSD(b.precio_m2_avg) + "/m²" : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ textAlign: "center", padding: "12px 0", color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: "Inter,sans-serif" }}>
              Datos anonimizados aportados por corredores matriculados GFI® · Actualizado en tiempo real · Exclusivo para miembros
            </div>
          </>
        )}
      </div>
    </>
  );
}
