"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Negocio {
  id: string;
  tipo_operacion: string | null;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  split_pct: number | null;
  fecha_cierre: string | null;
  colega_id: string | null;
  etapa: string | null;
}

interface Corredor {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
}

interface CorredorMetricas {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  operacionesCerradas: number;
  honorariosNetaUSD: number;
  ticketPromedio: number;
  honorariosPipeline: number;
  tiempoPromedioMeses: number;
  rankingScore: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcHonorariosNetaUSD(n: Negocio, tc: number): number {
  const precio = n.valor_operacion ?? 0;
  const honPct = n.honorarios_pct ?? 0;
  const splitPct = n.split_pct ?? 0;
  const raw = precio * (honPct / 100) * (1 - splitPct / 100);
  return n.moneda === "ARS" ? raw / tc : raw;
}

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `USD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `USD ${(n / 1_000).toFixed(1)}K`;
  return `USD ${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const AÑOS_DISPONIBLES = [2023, 2024, 2025, 2026];

const MEDALLAS: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };
const MEDALLA_COLORS: Record<number, { border: string; bg: string; text: string }> = {
  0: { border: "rgba(255,215,0,0.45)", bg: "rgba(255,215,0,0.07)", text: "#ffd700" },
  1: { border: "rgba(192,192,192,0.45)", bg: "rgba(192,192,192,0.07)", text: "#c0c0c0" },
  2: { border: "rgba(205,127,50,0.45)", bg: "rgba(205,127,50,0.07)", text: "#cd7f32" },
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProduccionPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [pipeline, setPipeline] = useState<Negocio[]>([]);
  const [corredores, setCorredores] = useState<Corredor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [anio, setAnio] = useState(2025);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  // ── Carga de datos ──────────────────────────────────────────────────────────

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const [
        { data: negData },
        { data: pipeData },
        { data: corrData },
      ] = await Promise.all([
        supabase
          .from("crm_negocios")
          .select(
            "id,tipo_operacion,valor_operacion,moneda,honorarios_pct,split_pct,fecha_cierre,colega_id,etapa"
          )
          .eq("etapa", "cerrado"),
        supabase
          .from("crm_negocios")
          .select(
            "id,tipo_operacion,valor_operacion,moneda,honorarios_pct,split_pct,colega_id,etapa"
          )
          .not("etapa", "in", '("cerrado","perdido")'),
        supabase.from("perfiles").select("id,nombre,apellido,email"),
      ]);

      setNegocios((negData as Negocio[]) ?? []);
      setPipeline(((pipeData as Omit<Negocio, "fecha_cierre">[]) ?? []).map(
        (p) => ({ ...p, fecha_cierre: null })
      ));
      setCorredores((corrData as Corredor[]) ?? []);
      setLoading(false);
    };
    cargar();
  }, []);

  // ── Métricas ────────────────────────────────────────────────────────────────

  const metricas = useMemo((): CorredorMetricas[] => {
    const negAnio = negocios.filter((n) => {
      if (!n.fecha_cierre) return false;
      return new Date(n.fecha_cierre).getFullYear() === anio;
    });

    const lista: CorredorMetricas[] = corredores.map((c) => {
      const misNegocios = negAnio.filter((n) => n.colega_id === c.id);
      const misPipeline = pipeline.filter((n) => n.colega_id === c.id);

      const honorariosNetaTotal = misNegocios.reduce(
        (sum, n) => sum + calcHonorariosNetaUSD(n, tipoCambio),
        0
      );

      const honorariosPipe = misPipeline.reduce(
        (sum, n) => sum + calcHonorariosNetaUSD(n, tipoCambio),
        0
      );

      const ticket =
        misNegocios.length > 0 ? honorariosNetaTotal / misNegocios.length : 0;

      return {
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido,
        email: c.email,
        operacionesCerradas: misNegocios.length,
        honorariosNetaUSD: honorariosNetaTotal,
        ticketPromedio: ticket,
        honorariosPipeline: honorariosPipe,
        tiempoPromedioMeses: 0,
        rankingScore: 0,
      };
    });

    lista.sort((a, b) => b.honorariosNetaUSD - a.honorariosNetaUSD);

    const maxHon = lista.length > 0 ? lista[0].honorariosNetaUSD : 1;
    return lista.map((c) => ({
      ...c,
      rankingScore: maxHon > 0 ? (c.honorariosNetaUSD / maxHon) * 100 : 0,
    }));
  }, [negocios, pipeline, corredores, tipoCambio, anio]);

  const totalHonorarios = useMemo(
    () => metricas.reduce((s, m) => s + m.honorariosNetaUSD, 0),
    [metricas]
  );

  function porcentajeDelTotal(v: number, total: number): string {
    if (total === 0) return "0.0%";
    return `${((v / total) * 100).toFixed(1)}%`;
  }

  // Últimas 5 operaciones cerradas por corredor en el año seleccionado
  function ultimasOps(corredor_id: string): Negocio[] {
    return negocios
      .filter(
        (n) =>
          n.colega_id === corredor_id &&
          n.fecha_cierre &&
          new Date(n.fecha_cierre).getFullYear() === anio
      )
      .sort((a, b) => {
        if (!a.fecha_cierre) return 1;
        if (!b.fecha_cierre) return -1;
        return (
          new Date(b.fecha_cierre).getTime() -
          new Date(a.fecha_cierre).getTime()
        );
      })
      .slice(0, 5);
  }

  const sinDatos =
    !loading && (metricas.length === 0 || totalHonorarios === 0);
  const top3 = metricas.slice(0, 3);
  const chartData = metricas.slice(0, 10);
  const chartMax = chartData.length > 0 ? chartData[0].honorariosNetaUSD : 1;
  const BAR_HEIGHT = 24;
  const BAR_GAP = 8;
  const LABEL_W = 130;
  const VAL_W = 80;
  const svgH = Math.max(60, chartData.length * (BAR_HEIGHT + BAR_GAP) + 20);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');

        .prod-wrap { max-width: 960px; display: flex; flex-direction: column; gap: 24px; }

        .prod-input {
          padding: 8px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          color: #fff;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          outline: none;
        }
        .prod-input:focus { border-color: rgba(204,0,0,0.5); }

        .prod-select {
          padding: 8px 12px;
          background: rgba(10,10,10,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          color: #fff;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          outline: none;
          cursor: pointer;
        }
        .prod-select:focus { border-color: rgba(204,0,0,0.5); }

        .prod-table-row {
          position: relative;
          overflow: hidden;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.15s;
          cursor: pointer;
        }
        .prod-table-row:hover { background: rgba(255,255,255,0.03); }

        .prod-table-bar {
          position: absolute;
          inset-block: 0;
          left: 0;
          background: linear-gradient(90deg, rgba(204,0,0,0.13) 0%, rgba(204,0,0,0.04) 100%);
          pointer-events: none;
          border-radius: 0 4px 4px 0;
          transition: width 0.5s ease;
        }

        .prod-expand {
          background: rgba(14,14,14,0.95);
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 14px 20px;
        }

        .prod-op-row {
          display: flex;
          gap: 16px;
          padding: 7px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 12px;
          font-family: 'Inter', sans-serif;
          color: rgba(255,255,255,0.55);
          flex-wrap: wrap;
          align-items: center;
        }
        .prod-op-row:last-child { border-bottom: none; }

        @media (max-width: 640px) {
          .prod-podio { flex-direction: column !important; }
          .prod-filtros { flex-direction: column !important; }
          .prod-table-th, .prod-table-td { font-size: 11px !important; padding: 8px 6px !important; }
        }
      `}</style>

      <div className="prod-wrap">

        {/* ── Encabezado ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 22,
              color: "#fff",
              margin: 0,
              lineHeight: 1.2,
            }}>
              Producción por <span style={{ color: "#cc0000" }}>Asesor</span>
            </h1>
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.35)",
              margin: "6px 0 0",
            }}>
              Honorarios netos, operaciones cerradas y pipeline activo por corredor
            </p>
          </div>

          {/* Filtros */}
          <div
            className="prod-filtros"
            style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
              }}>
                Año
              </span>
              <select
                className="prod-select"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              >
                {AÑOS_DISPONIBLES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
              }}>
                USD / ARS
              </span>
              <input
                className="prod-input"
                type="number"
                style={{ width: 110 }}
                value={tipoCambio}
                min={1}
                onChange={(e) => setTipoCambio(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            fontFamily: "Inter, sans-serif",
            color: "rgba(255,255,255,0.3)",
            fontSize: 14,
          }}>
            Cargando datos de producción...
          </div>
        )}

        {/* ── Estado vacío ── */}
        {!loading && sinDatos && (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "rgba(14,14,14,0.8)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📊</div>
            <div style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 16,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 8,
            }}>
              Sin datos de producción para {anio}
            </div>
            <div style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.25)",
            }}>
              No hay operaciones cerradas registradas para este período.<br />
              Verificá que existan negocios con estado &quot;cerrado&quot; y corredor asignado.
            </div>
          </div>
        )}

        {/* ── Top 3 Podio ── */}
        {!loading && !sinDatos && top3.length > 0 && (
          <div>
            <div style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
              marginBottom: 14,
            }}>
              Top Asesores {anio}
            </div>
            <div
              className="prod-podio"
              style={{ display: "flex", gap: 12 }}
            >
              {top3.map((c, idx) => {
                const medal = MEDALLA_COLORS[idx];
                return (
                  <div
                    key={c.id}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      background: medal.bg,
                      border: `1px solid ${medal.border}`,
                      borderRadius: 10,
                      padding: "20px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Número de posición grande de fondo */}
                    <span style={{
                      position: "absolute",
                      right: 12,
                      top: 8,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 64,
                      color: medal.border,
                      lineHeight: 1,
                      userSelect: "none",
                      pointerEvents: "none",
                    }}>
                      {idx + 1}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{MEDALLAS[idx]}</span>
                      <span style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#fff",
                        lineHeight: 1.3,
                      }}>
                        {c.nombre} {c.apellido}
                      </span>
                    </div>

                    <div style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 20,
                      color: medal.text,
                    }}>
                      {fmtUSD(c.honorariosNetaUSD)}
                    </div>

                    <div style={{ display: "flex", gap: 14 }}>
                      <div>
                        <div style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.3)",
                          marginBottom: 2,
                        }}>
                          Operaciones
                        </div>
                        <div style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 16,
                          color: "#fff",
                        }}>
                          {c.operacionesCerradas}
                        </div>
                      </div>
                      <div>
                        <div style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.3)",
                          marginBottom: 2,
                        }}>
                          % Total
                        </div>
                        <div style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 16,
                          color: "#fff",
                        }}>
                          {porcentajeDelTotal(c.honorariosNetaUSD, totalHonorarios)}
                        </div>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div style={{
                      height: 3,
                      background: "rgba(255,255,255,0.07)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${c.rankingScore}%`,
                        background: medal.text,
                        borderRadius: 2,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tabla completa ── */}
        {!loading && !sinDatos && metricas.length > 0 && (
          <div>
            <div style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
              marginBottom: 14,
            }}>
              Ranking completo
            </div>

            <div style={{
              background: "rgba(14,14,14,0.9)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              overflow: "hidden",
            }}>
              {/* Cabecera */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 80px 120px 110px 120px 80px",
                padding: "10px 16px",
                background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}>
                {["#", "Asesor", "Ops.", "Hon. Netos USD", "Ticket Prom.", "Pipeline USD", "% Total"].map((h) => (
                  <span
                    key={h}
                    className="prod-table-th"
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.3)",
                      padding: "0 4px",
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Filas */}
              {metricas.map((c, idx) => {
                const isOpen = expandidoId === c.id;
                const ops = isOpen ? ultimasOps(c.id) : [];
                return (
                  <div key={c.id}>
                    <div
                      className="prod-table-row"
                      onClick={() => setExpandidoId(isOpen ? null : c.id)}
                    >
                      {/* Barra de fondo proporcional */}
                      <div
                        className="prod-table-bar"
                        style={{ width: `${c.rankingScore}%` }}
                      />

                      <div
                        className="prod-table-td"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "40px 1fr 80px 120px 110px 120px 80px",
                          padding: "13px 16px",
                          position: "relative",
                          zIndex: 1,
                          alignItems: "center",
                        }}
                      >
                        {/* Rank */}
                        <span style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 800,
                          fontSize: 12,
                          color: idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "rgba(255,255,255,0.3)",
                          paddingRight: 4,
                        }}>
                          {idx < 3 ? MEDALLAS[idx] : `#${idx + 1}`}
                        </span>

                        {/* Nombre */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#fff",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {c.nombre} {c.apellido}
                          </div>
                          {c.email && (
                            <div style={{
                              fontFamily: "Inter, sans-serif",
                              fontSize: 10,
                              color: "rgba(255,255,255,0.25)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginTop: 2,
                            }}>
                              {c.email}
                            </div>
                          )}
                        </div>

                        {/* Ops */}
                        <span style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#fff",
                          paddingLeft: 4,
                        }}>
                          {c.operacionesCerradas}
                        </span>

                        {/* Hon. Netos */}
                        <span style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 13,
                          color: "#cc0000",
                          paddingLeft: 4,
                        }}>
                          {fmtUSD(c.honorariosNetaUSD)}
                        </span>

                        {/* Ticket prom. */}
                        <span style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.55)",
                          paddingLeft: 4,
                        }}>
                          {c.operacionesCerradas > 0 ? fmtUSD(c.ticketPromedio) : "—"}
                        </span>

                        {/* Pipeline */}
                        <span style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.45)",
                          paddingLeft: 4,
                        }}>
                          {c.honorariosPipeline > 0 ? fmtUSD(c.honorariosPipeline) : "—"}
                        </span>

                        {/* % total */}
                        <span style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 600,
                          fontSize: 12,
                          color: "rgba(255,255,255,0.5)",
                          paddingLeft: 4,
                        }}>
                          {porcentajeDelTotal(c.honorariosNetaUSD, totalHonorarios)}
                        </span>
                      </div>
                    </div>

                    {/* Detalle expandido */}
                    {isOpen && (
                      <div className="prod-expand">
                        <div style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.3)",
                          marginBottom: 10,
                        }}>
                          Últimas 5 operaciones cerradas — {anio}
                        </div>
                        {ops.length === 0 ? (
                          <div style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: 12,
                            color: "rgba(255,255,255,0.2)",
                            fontStyle: "italic",
                          }}>
                            Sin operaciones en este período.
                          </div>
                        ) : (
                          ops.map((op) => (
                            <div key={op.id} className="prod-op-row">
                              <span style={{
                                fontFamily: "Montserrat, sans-serif",
                                fontWeight: 700,
                                fontSize: 10,
                                background: "rgba(204,0,0,0.15)",
                                color: "#cc0000",
                                border: "1px solid rgba(204,0,0,0.3)",
                                borderRadius: 4,
                                padding: "2px 7px",
                                flexShrink: 0,
                              }}>
                                {op.tipo_operacion ?? "—"}
                              </span>
                              <span style={{ color: "rgba(255,255,255,0.4)" }}>
                                {fmtFecha(op.fecha_cierre)}
                              </span>
                              <span style={{ color: "rgba(255,255,255,0.55)" }}>
                                {op.valor_operacion != null
                                  ? `${op.moneda ?? ""} ${op.valor_operacion.toLocaleString("es-AR")}`
                                  : "—"}
                              </span>
                              <span>
                                Hon. neta:{" "}
                                <strong style={{ color: "#cc0000" }}>
                                  {fmtUSD(calcHonorariosNetaUSD(op, tipoCambio))}
                                </strong>
                              </span>
                              {op.etapa && (
                                <span style={{
                                  fontFamily: "Montserrat, sans-serif",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  background: "rgba(255,255,255,0.05)",
                                  color: "rgba(255,255,255,0.3)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: 4,
                                  padding: "2px 6px",
                                  flexShrink: 0,
                                }}>
                                  {op.etapa}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Gráfico SVG horizontal ── */}
        {!loading && !sinDatos && chartData.length > 0 && (
          <div>
            <div style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
              marginBottom: 14,
            }}>
              Comparativo — Honorarios Netos USD {anio}
            </div>

            <div style={{
              background: "rgba(14,14,14,0.9)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              padding: "20px 16px",
              overflowX: "auto",
            }}>
              <svg
                viewBox={`0 0 700 ${svgH}`}
                style={{ width: "100%", minWidth: 420, display: "block" }}
                aria-label="Gráfico de barras horizontales por asesor"
              >
                {chartData.map((c, i) => {
                  const y = i * (BAR_HEIGHT + BAR_GAP) + 10;
                  const barW =
                    chartMax > 0
                      ? ((c.honorariosNetaUSD / chartMax) * (700 - LABEL_W - VAL_W - 16))
                      : 0;
                  const barX = LABEL_W + 8;

                  return (
                    <g key={c.id}>
                      {/* Label asesor */}
                      <text
                        x={LABEL_W - 6}
                        y={y + BAR_HEIGHT / 2 + 1}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="rgba(255,255,255,0.55)"
                        fontSize={11}
                        fontFamily="Inter, sans-serif"
                        fontWeight={500}
                      >
                        {`${c.nombre} ${c.apellido}`.length > 18
                          ? `${c.nombre} ${c.apellido}`.slice(0, 17) + "…"
                          : `${c.nombre} ${c.apellido}`}
                      </text>

                      {/* Fondo barra */}
                      <rect
                        x={barX}
                        y={y}
                        width={700 - LABEL_W - VAL_W - 16}
                        height={BAR_HEIGHT}
                        fill="rgba(255,255,255,0.04)"
                        rx={4}
                      />

                      {/* Barra de valor */}
                      <rect
                        x={barX}
                        y={y}
                        width={Math.max(barW, 2)}
                        height={BAR_HEIGHT}
                        fill={
                          i === 0
                            ? "#cc0000"
                            : i === 1
                            ? "rgba(204,0,0,0.75)"
                            : "rgba(204,0,0,0.5)"
                        }
                        rx={4}
                      />

                      {/* Valor a la derecha */}
                      <text
                        x={700 - VAL_W + 6}
                        y={y + BAR_HEIGHT / 2 + 1}
                        dominantBaseline="middle"
                        fill="rgba(255,255,255,0.55)"
                        fontSize={10}
                        fontFamily="Montserrat, sans-serif"
                        fontWeight={700}
                      >
                        {fmtUSD(c.honorariosNetaUSD)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
