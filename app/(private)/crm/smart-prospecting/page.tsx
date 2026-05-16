"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Contacto {
  id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  interes: string | null;
  zona_interes: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: string | null;
}

interface Propiedad {
  id: string;
  titulo: string;
  tipo: string;
  operacion: string;
  precio: number | null;
  moneda: string;
  zona: string | null;
  ciudad: string;
  dormitorios: number | null;
  banos: number | null;
  superficie_cubierta: number | null;
  fotos: string[] | null;
}

interface Match {
  contacto: Contacto;
  propiedades: Propiedad[];
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function coincideZona(contacto: Contacto, prop: Propiedad): boolean {
  if (!contacto.zona_interes) return false;
  const zona = normalizar(contacto.zona_interes);
  const propZona = normalizar((prop.zona || "") + " " + prop.ciudad);
  return zona.split(/[,/\s]+/).some(w => w.length > 2 && propZona.includes(w));
}

function coincidePrecio(contacto: Contacto, prop: Propiedad): boolean {
  if (!prop.precio) return false;
  if (contacto.moneda && contacto.moneda !== prop.moneda) return false;
  if (contacto.presupuesto_min && prop.precio < contacto.presupuesto_min) return false;
  if (contacto.presupuesto_max && prop.precio > contacto.presupuesto_max) return false;
  return true;
}

function matchScore(contacto: Contacto, prop: Propiedad): number {
  let score = 0;
  if (coincideZona(contacto, prop)) score += 2;
  if (contacto.presupuesto_max && coincidePrecio(contacto, prop)) score += 3;
  if (contacto.interes) {
    const interes = normalizar(contacto.interes);
    const tipo = normalizar(prop.tipo + " " + prop.operacion);
    if (tipo.split(" ").some(w => w.length > 2 && interes.includes(w))) score += 1;
  }
  return score;
}

const fmt = (n: number, m: string) =>
  m === "USD" ? `USD ${n.toLocaleString("es-AR")}` : `$ ${n.toLocaleString("es-AR")}`;

export default function SmartProspectingPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactoAbierto, setContactoAbierto] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const uid = auth.user.id;

      const [{ data: contactos }, { data: propiedades }] = await Promise.all([
        supabase
          .from("crm_contactos")
          .select("id,nombre,apellido,telefono,email,interes,zona_interes,presupuesto_min,presupuesto_max,moneda")
          .eq("perfil_id", uid)
          .neq("estado", "archivado")
          .or("zona_interes.neq.null,presupuesto_max.neq.null"),
        supabase
          .from("cartera_propiedades")
          .select("id,titulo,tipo,operacion,precio,moneda,zona,ciudad,dormitorios,banos,superficie_cubierta,fotos")
          .eq("perfil_id", uid)
          .eq("estado", "activa"),
      ]);

      if (!contactos || !propiedades) { setLoading(false); return; }

      const resultado: Match[] = [];

      for (const c of contactos as Contacto[]) {
        const props = (propiedades as Propiedad[])
          .map(p => ({ p, score: matchScore(c, p) }))
          .filter(({ score }) => score >= 2)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(({ p }) => p);

        if (props.length > 0) {
          resultado.push({ contacto: c, propiedades: props });
        }
      }

      setMatches(resultado);
      setLoading(false);
    };
    init();
  }, []);

  const waLink = (contacto: Contacto, prop: Propiedad) => {
    const tel = contacto.telefono?.replace(/\D/g, "");
    if (!tel) return null;
    const msg = `Hola ${contacto.nombre || ""}, te comparto esta propiedad que puede interesarte: ${prop.titulo}${prop.precio ? ` — ${fmt(prop.precio, prop.moneda)}` : ""} en ${prop.zona || prop.ciudad}. ¿Te interesa que coordinemos una visita?`;
    return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "Inter,sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
          Smart Prospecting
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
          Contactos de tu CRM con propiedades de tu cartera que coinciden con sus criterios de búsqueda.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>Analizando coincidencias…</div>
      ) : matches.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>Sin coincidencias por ahora</div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", maxWidth: 380, margin: "0 auto" }}>
            Completá los campos <strong>Zona de interés</strong> y <strong>Presupuesto</strong> en tus contactos del CRM para que el sistema detecte propiedades compatibles.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            💡 {matches.length} contacto{matches.length > 1 ? "s" : ""} con propiedades que coinciden con su búsqueda. ¡Contactalos ahora!
          </div>

          {matches.map(({ contacto, propiedades }) => {
            const abierto = contactoAbierto === contacto.id;
            const nombre = [contacto.nombre, contacto.apellido].filter(Boolean).join(" ") || "Sin nombre";
            return (
              <div key={contacto.id} style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
                {/* Header contacto */}
                <button
                  onClick={() => setContactoAbierto(abierto ? null : contacto.id)}
                  style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                      👤
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{nombre}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                        {contacto.zona_interes && `📍 ${contacto.zona_interes}`}
                        {contacto.presupuesto_max && ` · hasta ${fmt(contacto.presupuesto_max, contacto.moneda ?? "USD")}`}
                        {contacto.interes && ` · ${contacto.interes}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#cc0000", background: "rgba(204,0,0,0.12)", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(204,0,0,0.25)" }}>
                      {propiedades.length} propiedad{propiedades.length > 1 ? "es" : ""}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>{abierto ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Propiedades */}
                {abierto && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "12px 20px 20px" }}>
                    {contacto.telefono && (
                      <a
                        href={`https://wa.me/${contacto.telefono.replace(/\D/g,"")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#25D366", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, marginBottom: 14, textDecoration: "none" }}
                      >
                        💬 WhatsApp a {contacto.nombre}
                      </a>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {propiedades.map(prop => {
                        const wa = waLink(contacto, prop);
                        const foto = prop.fotos?.[0];
                        return (
                          <div key={prop.id} style={{ display: "flex", gap: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ width: 80, height: 68, flexShrink: 0, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                              {foto
                                ? <img src={foto} alt={prop.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏠</div>}
                            </div>
                            <div style={{ flex: 1, padding: "10px 0", minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prop.titulo}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                                {[prop.zona, prop.ciudad].filter(Boolean).join(", ")}
                                {prop.dormitorios && ` · ${prop.dormitorios} dorm.`}
                                {prop.superficie_cubierta && ` · ${prop.superficie_cubierta}m²`}
                              </div>
                              {prop.precio && (
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginTop: 2 }}>{fmt(prop.precio, prop.moneda)}</div>
                              )}
                            </div>
                            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                              {wa && (
                                <a
                                  href={wa}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: 11, padding: "5px 10px", background: "#25D366", color: "#fff", borderRadius: 4, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
                                >
                                  Enviar
                                </a>
                              )}
                              <a
                                href={`/crm/cartera/ficha/${prop.id}`}
                                target="_blank"
                                style={{ fontSize: 11, padding: "5px 10px", background: "rgba(204,0,0,0.1)", color: "#cc0000", borderRadius: 4, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", border: "1px solid rgba(204,0,0,0.25)" }}
                              >
                                Ver ficha
                              </a>
                            </div>
                          </div>
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
    </div>
  );
}
