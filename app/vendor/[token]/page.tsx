import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TIPO_NOV: Record<string, { icon: string; color: string }> = {
  nota:      { icon: "📝", color: "#60a5fa" },
  visita:    { icon: "🗓",  color: "#22c55e" },
  oferta:    { icon: "💰",  color: "#f59e0b" },
  escritura: { icon: "📋",  color: "#a78bfa" },
  otro:      { icon: "📌",  color: "#6b7280" },
};

const ETAPAS_ORD = [
  "Ingresada", "En tasación", "Lista para publicar", "Publicada",
  "Con visitas", "Con oferta", "En reserva", "En escritura", "Escriturada",
];

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

async function getData(token: string) {
  const { data: portal } = await sb
    .from("crm_portal_vendedor")
    .select("*, perfiles!corredor_id(nombre, apellido, foto_url, telefono, email, whatsapp_negocio, inmobiliaria, matricula)")
    .eq("token", token)
    .eq("activo", true)
    .single();

  if (!portal) return null;

  // Incrementar vistas
  sb.from("crm_portal_vendedor").update({ vistas: (portal.vistas ?? 0) + 1 }).eq("token", token).then(() => {});

  const { data: novedades } = await sb
    .from("crm_portal_vendedor_novedades")
    .select("*")
    .eq("portal_id", portal.id)
    .order("created_at", { ascending: false });

  return { portal, novedades: novedades ?? [] };
}

export default async function VendorPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getData(token);
  if (!result) notFound();

  const { portal, novedades } = result;
  const corredor = portal.perfiles as any;
  const etapaIdx = ETAPAS_ORD.indexOf(portal.etapa_actual ?? "");
  const pct = etapaIdx >= 0 ? Math.round(((etapaIdx + 1) / ETAPAS_ORD.length) * 100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; }
        body { background: #0a0a0a; color: #fff; font-family: Inter, sans-serif; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0a0a0a", padding: "0 0 60px" }}>
        {/* Header */}
        <div style={{ background: "rgba(6,6,6,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 800, color: "#fff" }}>
            GFI<span style={{ color: "#cc0000" }}>®</span>
          </div>
          <div style={{ height: 16, width: 1, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>
            Portal del Vendedor
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
          {/* Bienvenida */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Portal personalizado para
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "Montserrat,sans-serif", marginBottom: 8 }}>
              {portal.vendedor_nombre}
            </h1>
            <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.7)", fontFamily: "Montserrat,sans-serif", marginBottom: 12 }}>
              {portal.titulo}
            </div>
            {portal.mensaje_bienvenida && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                {portal.mensaje_bienvenida}
              </div>
            )}
          </div>

          {/* Estado de la operación */}
          {portal.etapa_actual && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                Estado actual de su propiedad
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e", fontFamily: "Montserrat,sans-serif", marginBottom: 14 }}>
                {portal.etapa_actual}
              </div>
              {/* Barra de progreso */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #cc0000, #22c55e)", borderRadius: 3, transition: "width 0.5s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif" }}>
                  <span>Ingresada</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{pct}%</span>
                  <span>Escriturada</span>
                </div>
              </div>
              {/* Etapas */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                {ETAPAS_ORD.map((e, i) => {
                  const hecho = i <= etapaIdx;
                  const actual = i === etapaIdx;
                  return (
                    <span key={e} style={{
                      fontSize: 10, padding: "3px 9px", borderRadius: 4, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
                      background: actual ? "rgba(34,197,94,0.15)" : hecho ? "rgba(255,255,255,0.04)" : "transparent",
                      color: actual ? "#22c55e" : hecho ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                      border: `1px solid ${actual ? "rgba(34,197,94,0.3)" : hecho ? "rgba(255,255,255,0.08)" : "transparent"}`,
                    }}>
                      {hecho && !actual ? "✓ " : actual ? "⬤ " : ""}{e}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Novedades */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              Novedades de su operación
            </div>
            {novedades.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                No hay novedades aún. Su corredor las irá actualizando.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {novedades.map(n => {
                  const tc = TIPO_NOV[n.tipo] ?? TIPO_NOV.otro;
                  return (
                    <div key={n.id} style={{ background: "rgba(255,255,255,0.02)", borderLeft: `3px solid ${tc.color}99`, borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: n.contenido ? 6 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{tc.icon} {n.titulo}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{fmtFecha(n.created_at)}</div>
                      </div>
                      {n.contenido && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{n.contenido}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Corredor */}
          {corredor && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                Su corredor inmobiliario
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: "rgba(200,0,0,0.15)", border: "1px solid rgba(200,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: "#cc0000", overflow: "hidden", flexShrink: 0 }}>
                  {corredor.foto_url
                    ? <img src={corredor.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : `${corredor.nombre?.charAt(0) ?? ""}${corredor.apellido?.charAt(0) ?? ""}`}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "Montserrat,sans-serif", marginBottom: 2 }}>
                    {corredor.nombre} {corredor.apellido}
                  </div>
                  {corredor.inmobiliaria && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{corredor.inmobiliaria}</div>}
                  {corredor.matricula && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Mat. {corredor.matricula}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                {(corredor.whatsapp_negocio || corredor.telefono) && (
                  <a href={`https://wa.me/${(corredor.whatsapp_negocio || corredor.telefono).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 8, color: "#25d366", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "Inter,sans-serif" }}>
                    💬 WhatsApp
                  </a>
                )}
                {corredor.email && (
                  <a href={`mailto:${corredor.email}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "Inter,sans-serif" }}>
                    ✉ Email
                  </a>
                )}
              </div>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: "rgba(255,255,255,0.15)", fontFamily: "Inter,sans-serif" }}>
            Portal generado por GFI® Grupo Foro Inmobiliario · Rosario, Argentina
          </div>
        </div>
      </div>
    </>
  );
}
