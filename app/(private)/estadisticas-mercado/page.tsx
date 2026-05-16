"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface EstadNegocio {
  etapa: string;
  cantidad: number;
  valor_total: number;
  honorarios_total: number;
}

interface EstadPropiedad {
  operacion: string;
  cantidad: number;
  precio_promedio: number;
  superficie_promedio: number;
}

interface EstadZona {
  zona: string;
  cantidad: number;
  precio_promedio: number;
}

interface EstadHonorarios {
  proyectados_usd: number;
  realizados_usd: number;
  cobrados_usd: number;
  cobrados_ars: number;
}

const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const ETAPA_LABELS: Record<string, string> = {
  prospecto: "Prospecto", contactado: "Contactado",
  visita_coordinada: "Visita coord.", visita_realizada: "Visita realiz.",
  oferta_enviada: "Oferta enviada", negociacion: "Negociación",
  reserva: "Reserva", escritura: "Escritura",
  cerrado: "Cerrado ✓", perdido: "Perdido",
};

const ETAPA_COLORS: Record<string, string> = {
  prospecto: "#6b7280", contactado: "#3b82f6",
  visita_coordinada: "#8b5cf6", visita_realizada: "#a78bfa",
  oferta_enviada: "#f59e0b", negociacion: "#f97316",
  reserva: "#06b6d4", escritura: "#10b981",
  cerrado: "#22c55e", perdido: "#ef4444",
};

const formatMoneda = (v: number, m = "USD") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: m, maximumFractionDigits: 0 }).format(v);

const formatNum = (v: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v);

function BarChart({ data, colorKey }: { data: { label: string; value: number; color?: string }[]; colorKey?: boolean }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 110, fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "right", flexShrink: 0, fontFamily: "Inter,sans-serif" }}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: 22, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${(d.value / max) * 100}%`,
              background: d.color ?? "rgba(200,0,0,0.7)",
              transition: "width 0.5s ease",
              display: "flex", alignItems: "center", paddingLeft: 8,
            }}>
              <span style={{ fontSize: 10, color: "#fff", fontWeight: 600, fontFamily: "Montserrat,sans-serif" }}>
                {d.value > 0 ? formatNum(d.value) : ""}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "18px 20px",
    }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? "#fff", fontFamily: "Montserrat,sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontFamily: "Inter,sans-serif" }}>{sub}</div>}
    </div>
  );
}

export default function EstadisticasMercadoPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<"3m" | "6m" | "12m" | "todo">("12m");

  const [negociosPorEtapa, setNegociosPorEtapa] = useState<EstadNegocio[]>([]);
  const [propiedadesPorTipo, setPropiedadesPorTipo] = useState<EstadPropiedad[]>([]);
  const [propiedadesPorZona, setPropiedadesPorZona] = useState<EstadZona[]>([]);
  const [honorarios, setHonorarios] = useState<EstadHonorarios>({ proyectados_usd: 0, realizados_usd: 0, cobrados_usd: 0, cobrados_ars: 0 });
  const [totalNegocios, setTotalNegocios] = useState(0);
  const [totalPropiedades, setTotalPropiedades] = useState(0);
  const [totalContactos, setTotalContactos] = useState(0);
  const [negociosCerrados, setNegociosCerrados] = useState(0);
  const [negociosMes, setNegociosMes] = useState<{ mes: string; cantidad: number }[]>([]);

  const fechaDesde = (() => {
    if (periodo === "todo") return null;
    const d = new Date();
    d.setMonth(d.getMonth() - (periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12));
    return d.toISOString();
  })();

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);
      await cargarDatos(auth.user.id);
    };
    init();
  }, [periodo]);

  const cargarDatos = async (uid: string) => {
    setLoading(true);
    try {
      // Negocios por etapa
      let qNegocios = supabase
        .from("crm_negocios")
        .select("etapa, valor_operacion, moneda, honorarios_pct, created_at")
        .eq("perfil_id", uid)
        .eq("archivado", false);
      if (fechaDesde) qNegocios = qNegocios.gte("created_at", fechaDesde);
      const { data: negocios } = await qNegocios;

      const etapaMap: Record<string, EstadNegocio> = {};
      for (const n of negocios ?? []) {
        if (!etapaMap[n.etapa]) etapaMap[n.etapa] = { etapa: n.etapa, cantidad: 0, valor_total: 0, honorarios_total: 0 };
        etapaMap[n.etapa].cantidad++;
        if (n.valor_operacion && n.moneda === "USD") {
          etapaMap[n.etapa].valor_total += n.valor_operacion;
          if (n.honorarios_pct) etapaMap[n.etapa].honorarios_total += (n.valor_operacion * n.honorarios_pct) / 100;
        }
      }
      const etapas = Object.values(etapaMap).sort((a, b) => b.cantidad - a.cantidad);
      setNegociosPorEtapa(etapas);
      setTotalNegocios(negocios?.length ?? 0);
      setNegociosCerrados(negocios?.filter(n => n.etapa === "cerrado").length ?? 0);

      // Honorarios
      const proyUSD = etapas.filter(e => e.etapa !== "perdido").reduce((s, e) => s + e.honorarios_total, 0);
      const realUSD = etapas.filter(e => e.etapa === "cerrado").reduce((s, e) => s + e.honorarios_total, 0);

      // Cobros registrados
      let qCobros = supabase.from("crm_honorarios_cobros").select("monto, moneda").eq("perfil_id", uid);
      if (fechaDesde) qCobros = qCobros.gte("created_at", fechaDesde);
      const { data: cobros } = await qCobros;
      const cobradosUSD = cobros?.filter(c => c.moneda === "USD").reduce((s, c) => s + c.monto, 0) ?? 0;
      const cobradosARS = cobros?.filter(c => c.moneda === "ARS").reduce((s, c) => s + c.monto, 0) ?? 0;
      setHonorarios({ proyectados_usd: proyUSD, realizados_usd: realUSD, cobrados_usd: cobradosUSD, cobrados_ars: cobradosARS });

      // Negocios por mes (últimos 6)
      const meses: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        meses[k] = 0;
      }
      for (const n of negocios ?? []) {
        const k = n.created_at.slice(0, 7);
        if (k in meses) meses[k]++;
      }
      setNegociosMes(Object.entries(meses).map(([k, v]) => ({
        mes: MESES_CORTO[parseInt(k.split("-")[1]) - 1],
        cantidad: v,
      })));

      // Propiedades cartera
      let qCart = supabase
        .from("cartera_propiedades")
        .select("operacion, precio, moneda, superficie_total, zona")
        .eq("perfil_id", uid);
      if (fechaDesde) qCart = qCart.gte("created_at", fechaDesde);
      const { data: cartera } = await qCart;

      const tipoMap: Record<string, EstadPropiedad> = {};
      const zonaMap: Record<string, EstadZona> = {};
      for (const p of cartera ?? []) {
        const tipo = (p.operacion ?? "otro").toLowerCase();
        if (!tipoMap[tipo]) tipoMap[tipo] = { operacion: tipo, cantidad: 0, precio_promedio: 0, superficie_promedio: 0 };
        tipoMap[tipo].cantidad++;
        if (p.precio && p.moneda === "USD") tipoMap[tipo].precio_promedio += p.precio;
        if (p.superficie_total) tipoMap[tipo].superficie_promedio += p.superficie_total;

        if (p.zona) {
          const z = p.zona.trim();
          if (!zonaMap[z]) zonaMap[z] = { zona: z, cantidad: 0, precio_promedio: 0 };
          zonaMap[z].cantidad++;
          if (p.precio && p.moneda === "USD") zonaMap[z].precio_promedio += p.precio;
        }
      }
      // Calcular promedios
      for (const t of Object.values(tipoMap)) {
        t.precio_promedio = t.precio_promedio / t.cantidad;
        t.superficie_promedio = t.superficie_promedio / t.cantidad;
      }
      for (const z of Object.values(zonaMap)) {
        z.precio_promedio = z.precio_promedio / z.cantidad;
      }
      setPropiedadesPorTipo(Object.values(tipoMap).sort((a, b) => b.cantidad - a.cantidad));
      setPropiedadesPorZona(Object.values(zonaMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8));
      setTotalPropiedades(cartera?.length ?? 0);

      // Contactos
      const { count: contContacots } = await supabase
        .from("crm_contactos")
        .select("id", { count: "exact", head: true })
        .eq("perfil_id", uid);
      setTotalContactos(contContacots ?? 0);

    } finally {
      setLoading(false);
    }
  };

  const TIPO_LABELS: Record<string, string> = {
    venta: "Venta", alquiler: "Alquiler", alquiler_temporal: "Alq. temporal",
    emprendimiento: "Emprendimiento", otro: "Otro",
  };

  return (
    <div style={{ fontFamily: "Inter,sans-serif", color: "#fff", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 28 }}>📊</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>
              Estadísticas del Mercado
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
              Análisis de tu actividad y cartera — GFI® CRM
            </p>
          </div>
        </div>
        {/* Filtro período */}
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {(["3m","6m","12m","todo"] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: "1px solid",
              borderColor: periodo === p ? "#cc0000" : "rgba(255,255,255,0.1)",
              background: periodo === p ? "rgba(200,0,0,0.15)" : "transparent",
              color: periodo === p ? "#fff" : "rgba(255,255,255,0.45)",
              cursor: "pointer", fontFamily: "Montserrat,sans-serif",
            }}>
              {p === "todo" ? "Todo" : p === "3m" ? "3 meses" : p === "6m" ? "6 meses" : "12 meses"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>Cargando estadísticas...</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12, marginBottom: 28 }}>
            <StatCard label="Negocios activos" value={String(totalNegocios)} sub={`${negociosCerrados} cerrados`} />
            <StatCard label="Propiedades cartera" value={String(totalPropiedades)} />
            <StatCard label="Contactos CRM" value={String(totalContactos)} />
            <StatCard label="Hon. proyectados" value={formatMoneda(honorarios.proyectados_usd)} color="#f59e0b" sub="Negocios activos USD" />
            <StatCard label="Hon. realizados" value={formatMoneda(honorarios.realizados_usd)} color="#22c55e" sub="Negocios cerrados USD" />
            <StatCard label="Hon. cobrados" value={formatMoneda(honorarios.cobrados_usd)} color="#60a5fa"
              sub={honorarios.cobrados_ars > 0 ? `+ ARS ${formatNum(honorarios.cobrados_ars)}` : "Registrados en sistema"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Negocios por etapa */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                Negocios por etapa
              </h3>
              {negociosPorEtapa.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin datos</p>
              ) : (
                <BarChart data={negociosPorEtapa.map(e => ({
                  label: ETAPA_LABELS[e.etapa] ?? e.etapa,
                  value: e.cantidad,
                  color: ETAPA_COLORS[e.etapa],
                }))} />
              )}
            </div>

            {/* Propiedades por tipo */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                Cartera por tipo de operación
              </h3>
              {propiedadesPorTipo.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin propiedades cargadas</p>
              ) : (
                <BarChart data={propiedadesPorTipo.map(p => ({
                  label: TIPO_LABELS[p.operacion] ?? p.operacion,
                  value: p.cantidad,
                  color: "rgba(99,102,241,0.7)",
                }))} />
              )}
              {propiedadesPorTipo.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {propiedadesPorTipo.map(p => p.precio_promedio > 0 && (
                    <div key={p.operacion} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>
                      <span>{TIPO_LABELS[p.operacion] ?? p.operacion} — precio prom.</span>
                      <span>{formatMoneda(p.precio_promedio)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Negocios por mes */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                Negocios cargados por mes
              </h3>
              <BarChart data={negociosMes.map(m => ({ label: m.mes, value: m.cantidad, color: "rgba(200,0,0,0.65)" }))} />
            </div>

            {/* Propiedades por zona */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                Cartera por zona
              </h3>
              {propiedadesPorZona.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin zonas registradas</p>
              ) : (
                <BarChart data={propiedadesPorZona.map(z => ({
                  label: z.zona.length > 14 ? z.zona.slice(0, 12) + "…" : z.zona,
                  value: z.cantidad,
                  color: "rgba(6,182,212,0.65)",
                }))} />
              )}
            </div>
          </div>

          {/* Tabla honorarios por etapa */}
          {negociosPorEtapa.some(e => e.valor_total > 0) && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.7)" }}>
                Valor y honorarios por etapa (USD)
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Etapa","Cant.","Valor total","Hon. estimados"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 600, letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {negociosPorEtapa.filter(e => e.valor_total > 0).map(e => (
                    <tr key={e.etapa} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: ETAPA_COLORS[e.etapa] ?? "#888", marginRight: 7 }} />
                        {ETAPA_LABELS[e.etapa] ?? e.etapa}
                      </td>
                      <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.6)" }}>{e.cantidad}</td>
                      <td style={{ padding: "8px 10px", color: "#fff" }}>{formatMoneda(e.valor_total)}</td>
                      <td style={{ padding: "8px 10px", color: "#f59e0b", fontWeight: 600 }}>
                        {e.honorarios_total > 0 ? formatMoneda(e.honorarios_total) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ textAlign: "center", padding: "12px 0", color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
            Estadísticas basadas en tu actividad personal en GFI® CRM · Actualizado en tiempo real
          </div>
        </>
      )}
    </div>
  );
}
