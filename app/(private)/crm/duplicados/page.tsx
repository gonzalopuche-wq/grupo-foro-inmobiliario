"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo: string | null;
  estado: string | null;
  created_at: string;
}

interface Par {
  a: Contacto;
  b: Contacto;
  razon: string[];
  score: number;
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

function normalizarTel(t: string): string {
  return t.replace(/\D/g, "").slice(-8); // últimos 8 dígitos
}

function similitudNombre(a: Contacto, b: Contacto): number {
  const na = normalizar(`${a.nombre} ${a.apellido}`);
  const nb = normalizar(`${b.nombre} ${b.apellido}`);
  if (na === nb) return 1;
  // Levenshtein simplificado: ratio de caracteres en común
  const setA = new Set(na.split(""));
  const setB = new Set(nb.split(""));
  const intersect = [...setA].filter(c => setB.has(c)).length;
  return (2 * intersect) / (setA.size + setB.size);
}

function detectarDuplicados(contactos: Contacto[]): Par[] {
  const pares: Par[] = [];
  const descartados = new Set<string>();

  for (let i = 0; i < contactos.length; i++) {
    for (let j = i + 1; j < contactos.length; j++) {
      const a = contactos[i];
      const b = contactos[j];
      const key = `${a.id}_${b.id}`;
      if (descartados.has(key)) continue;

      const razon: string[] = [];
      let score = 0;

      // Mismo teléfono
      if (a.telefono && b.telefono) {
        const ta = normalizarTel(a.telefono);
        const tb = normalizarTel(b.telefono);
        if (ta === tb && ta.length >= 7) {
          razon.push("Teléfono idéntico");
          score += 50;
        }
      }

      // Mismo email
      if (a.email && b.email) {
        if (normalizar(a.email) === normalizar(b.email)) {
          razon.push("Email idéntico");
          score += 45;
        }
      }

      // Nombre similar
      const simNombre = similitudNombre(a, b);
      if (simNombre >= 0.85) {
        razon.push(`Nombre muy similar (${Math.round(simNombre * 100)}%)`);
        score += 30;
      } else if (simNombre >= 0.7) {
        razon.push(`Nombre similar (${Math.round(simNombre * 100)}%)`);
        score += 15;
      }

      if (score >= 30) {
        pares.push({ a, b, razon, score });
      }
    }
  }

  return pares.sort((a, b) => b.score - a.score);
}

export default function DuplicadosPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [descartados, setDescartados] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<"todos" | "alta" | "media">("todos");

  useEffect(() => {
    const stored = localStorage.getItem("crm_dup_descartados_v1");
    if (stored) setDescartados(new Set(JSON.parse(stored)));

    supabase.from("crm_contactos").select("id,nombre,apellido,telefono,email,tipo,estado,created_at")
      .then(({ data }) => {
        setContactos((data ?? []) as Contacto[]);
        setLoading(false);
      });
  }, []);

  const pares = useMemo(() => detectarDuplicados(contactos), [contactos]);

  const paresVisibles = useMemo(() => {
    return pares.filter(p => {
      const key = `${p.a.id}_${p.b.id}`;
      if (descartados.has(key)) return false;
      if (filtro === "alta" && p.score < 50) return false;
      if (filtro === "media" && (p.score >= 50 || p.score < 30)) return false;
      return true;
    });
  }, [pares, descartados, filtro]);

  const descartar = (a: Contacto, b: Contacto) => {
    const key = `${a.id}_${b.id}`;
    const nuevo = new Set([...descartados, key]);
    setDescartados(nuevo);
    localStorage.setItem("crm_dup_descartados_v1", JSON.stringify([...nuevo]));
  };

  const limpiarDescartados = () => {
    setDescartados(new Set());
    localStorage.removeItem("crm_dup_descartados_v1");
  };

  const scoreColor = (score: number) => score >= 70 ? "#cc0000" : score >= 50 ? "#f97316" : "#eab308";
  const scoreLabel = (score: number) => score >= 70 ? "Alta" : score >= 50 ? "Media" : "Baja";

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>🔍 Detector de Duplicados</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Contactos con mismo teléfono, email o nombre similar</p>
          </div>
          <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total contactos", value: contactos.length, color: "#e5e5e5" },
            { label: "Posibles duplicados", value: pares.filter(p => !descartados.has(`${p.a.id}_${p.b.id}`)).length, color: "#cc0000" },
            { label: "Alta confianza", value: paresVisibles.filter(p => p.score >= 50).length, color: "#f97316" },
            { label: "Descartados", value: descartados.size, color: "#6b7280" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Filtrar por confianza:</span>
          {(["todos", "alta", "media"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ background: filtro === f ? "#1f2937" : "transparent", border: `1px solid ${filtro === f ? "#374151" : "#1f2937"}`, borderRadius: 6, color: filtro === f ? "#e5e5e5" : "#6b7280", padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "capitalize" }}>
              {f === "todos" ? "Todos" : f === "alta" ? "🔴 Alta" : "🟠 Media"}
            </button>
          ))}
          {descartados.size > 0 && (
            <button onClick={limpiarDescartados}
              style={{ marginLeft: "auto", background: "transparent", border: "1px solid #cc000044", borderRadius: 6, color: "#cc0000", padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>
              Limpiar {descartados.size} descartados
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Analizando contactos...</div>
        ) : paresVisibles.length === 0 ? (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#22c55e" }}>Sin duplicados detectados</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {descartados.size > 0 ? `${descartados.size} pares marcados como distintos.` : "Tu base de contactos está limpia."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {paresVisibles.map(par => (
              <div key={`${par.a.id}_${par.b.id}`} style={{ background: "#111", border: `1px solid ${scoreColor(par.score)}33`, borderRadius: 12, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {par.razon.map(r => (
                      <span key={r} style={{ background: `${scoreColor(par.score)}22`, color: scoreColor(par.score), padding: "3px 10px", borderRadius: 4, fontSize: 11, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                        {r}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: scoreColor(par.score) }}>
                      {scoreLabel(par.score)} ({par.score})
                    </span>
                    <button onClick={() => descartar(par.a, par.b)}
                      style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>
                      No son duplicados
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[par.a, par.b].map(c => (
                    <div key={c.id} style={{ background: "#0a0a0a", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 6 }}>
                        {c.nombre} {c.apellido}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                        {c.telefono && <div style={{ color: "#6b7280" }}>📞 {c.telefono}</div>}
                        {c.email && <div style={{ color: "#6b7280" }}>✉️ {c.email}</div>}
                        {c.tipo && <div style={{ color: "#4b5563" }}>Tipo: {c.tipo}</div>}
                        {c.estado && <div style={{ color: "#4b5563" }}>Estado: {c.estado}</div>}
                        <div style={{ color: "#374151", fontSize: 10 }}>Creado: {new Date(c.created_at).toLocaleDateString("es-AR")}</div>
                      </div>
                      <Link href={`/crm/contactos?id=${c.id}`}
                        style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>
                        Ver perfil →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", marginTop: 20, fontSize: 12, color: "#6b7280" }}>
          <strong style={{ color: "#9ca3af" }}>📌 Nota:</strong> La detección se basa en teléfono idéntico, email idéntico y similitud de nombre. Revisá cada par antes de decidir. La herramienta no elimina contactos automáticamente.
        </div>
      </div>
    </div>
  );
}
