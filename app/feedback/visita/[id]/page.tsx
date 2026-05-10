import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Props { params: Promise<{ id: string }> }

async function getData(id: string) {
  const { data } = await sb
    .from("cartera_visitas")
    .select("id, cliente_nombre, fecha_visita, estado, feedback_at, cartera_propiedades(titulo, direccion, tipo)")
    .eq("id", id)
    .single();
  return data;
}

export default async function FeedbackVisitaPage({ params }: Props) {
  const { id } = await params;
  const visita = await getData(id);
  if (!visita) return notFound();

  const prop = (visita.cartera_propiedades as any) ?? {};
  const yaRespondio = !!visita.feedback_at;

  const fecha = visita.fecha_visita
    ? new Date(visita.fecha_visita).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0a0a0a; color: #fff; font-family: Inter,sans-serif; min-height: 100vh; }
        .wrap { max-width: 480px; margin: 0 auto; padding: 40px 20px 60px; }
        .logo { font-family: Montserrat,sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.15em; color: #cc0000; text-transform: uppercase; margin-bottom: 32px; }
        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 24px; margin-bottom: 24px; }
        .card-label { font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 4px; }
        .card-val { font-size: 15px; color: #fff; font-weight: 500; }
        .title { font-family: Montserrat,sans-serif; font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .subtitle { font-size: 14px; color: rgba(255,255,255,0.4); margin-bottom: 28px; }
        .stars { display: flex; gap: 10px; justify-content: center; margin: 16px 0; }
        .star-btn { font-size: 36px; background: none; border: none; cursor: pointer; opacity: 0.3; transition: all 0.15s; line-height: 1; }
        .star-btn.sel, .star-btn:hover { opacity: 1; transform: scale(1.15); }
        .interes-row { display: flex; gap: 10px; margin: 12px 0; }
        .int-btn { flex: 1; padding: 12px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.5); font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; cursor: pointer; transition: all 0.15s; text-align: center; }
        .int-btn.sel { border-color: #cc0000; background: rgba(204,0,0,0.12); color: #ff6666; }
        .int-btn:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .label { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 6px; margin-top: 18px; }
        textarea { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 8px; color: #fff; font-family: Inter,sans-serif; font-size: 13px; outline: none; resize: none; }
        textarea:focus { border-color: rgba(204,0,0,0.4); }
        textarea::placeholder { color: rgba(255,255,255,0.2); }
        .submit-btn { width: 100%; padding: 14px; background: #cc0000; border: none; border-radius: 8px; color: #fff; font-family: Montserrat,sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; cursor: pointer; margin-top: 20px; transition: opacity 0.15s; }
        .submit-btn:hover { opacity: 0.85; }
        .submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .success { text-align: center; padding: 40px 20px; }
        .success-ico { font-size: 56px; margin-bottom: 16px; }
        .success-title { font-family: Montserrat,sans-serif; font-size: 20px; font-weight: 800; margin-bottom: 8px; }
        .success-sub { color: rgba(255,255,255,0.4); font-size: 14px; }
      `}</style>

      <div className="wrap">
        <div className="logo">GFI · Grupo Foro Inmobiliario</div>

        {yaRespondio ? (
          <div className="success">
            <div className="success-ico">✅</div>
            <div className="success-title">¡Gracias por tu respuesta!</div>
            <div className="success-sub">Ya registramos tu feedback sobre la visita.</div>
          </div>
        ) : (
          <>
            <div className="title">¿Cómo fue la visita?</div>
            <div className="subtitle">Tu opinión nos ayuda a mejorar. Solo toma 1 minuto.</div>

            <div className="card">
              {prop.titulo && <><div className="card-label">Propiedad</div><div className="card-val" style={{ marginBottom: 10 }}>{prop.titulo}</div></>}
              {prop.direccion && <><div className="card-label">Dirección</div><div className="card-val" style={{ marginBottom: 10 }}>{prop.direccion}</div></>}
              {visita.cliente_nombre && <><div className="card-label">Visitante</div><div className="card-val" style={{ marginBottom: 10 }}>{visita.cliente_nombre}</div></>}
              {fecha && <><div className="card-label">Fecha</div><div className="card-val">{fecha}</div></>}
            </div>

            <FeedbackForm visitaId={id} />
          </>
        )}
      </div>
    </>
  );
}

function FeedbackForm({ visitaId }: { visitaId: string }) {
  return (
    <form action="/api/visita-feedback" method="POST">
      <input type="hidden" name="visita_id" value={visitaId} />

      <div className="label">¿Cómo calificás la atención? ⭐</div>
      <div className="stars" id="stars-container">
        {[1,2,3,4,5].map(n => (
          <label key={n} style={{ cursor: "pointer", fontSize: 36, opacity: 0.35, transition: "all 0.15s" }}>
            <input type="radio" name="puntaje" value={n} required style={{ position: "absolute", opacity: 0, width: 0 }} />
            ⭐
          </label>
        ))}
      </div>

      <div className="label">¿Te interesó la propiedad?</div>
      <div style={{ display: "flex", gap: 10, margin: "10px 0" }}>
        {[["si","✅ Sí, me interesa"],["tal_vez","🤔 Tal vez"],["no","❌ No por ahora"]].map(([val, label]) => (
          <label key={val} style={{ flex: 1, textAlign: "center", cursor: "pointer" }}>
            <input type="radio" name="interes" value={val} required style={{ position: "absolute", opacity: 0, width: 0 }} />
            <div style={{ padding: "12px 4px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
              {label}
            </div>
          </label>
        ))}
      </div>

      <div className="label">Comentario (opcional)</div>
      <textarea name="comentario" rows={4} placeholder="¿Qué te pareció? ¿Algo a mejorar?" />

      <button type="submit" className="submit-btn">Enviar feedback →</button>
    </form>
  );
}
