"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Campana {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo_beneficio: string;
  valor_descuento_pct: number | null;
  detalle_beneficio: string;
  imagen_url: string | null;
  presupuesto_usd: number;
  costo_por_admin_usd: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  activa: boolean;
  red_proveedores: { id: string; nombre: string; logo_url: string | null; rubro: string; sitio_web: string | null };
}

interface MiAdhesion {
  campana_id: string;
  token_ref: string;
  cant_administraciones: number;
  monto_cobrado_usd: number;
  clics: number;
  created_at: string;
}

const TIPO_LABEL: Record<string, string> = {
  descuento: "% Descuento",
  producto_gratis: "Producto gratis",
  servicio_gratis: "Servicio gratis",
  cashback: "Cashback",
  otro: "Beneficio especial",
};

const TIPO_COLOR: Record<string, string> = {
  descuento: "#22c55e",
  producto_gratis: "#3b82f6",
  servicio_gratis: "#8b5cf6",
  cashback: "#f59e0b",
  otro: "#cc0000",
};

export default function CampanasPage() {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [misAdhesiones, setMisAdhesiones] = useState<MiAdhesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [cantAdmins, setCantAdmins] = useState<number | null>(null);
  const [cantAdminsDeclaradas, setCantAdminsDeclaradas] = useState<number>(0);
  const [uniendose, setUniendose] = useState<string | null>(null);
  const [modalCampana, setModalCampana] = useState<Campana | null>(null);
  const [formAdmins, setFormAdmins] = useState("");
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const showToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);

      const [{ data: perfil }, { data: cams }, { data: adhs }] = await Promise.all([
        supabase.from("perfiles").select("cant_administraciones_declaradas").eq("id", data.user.id).single(),
        supabase.from("sponsor_campanas").select(`
          id, titulo, descripcion, tipo_beneficio, valor_descuento_pct,
          detalle_beneficio, imagen_url, presupuesto_usd, costo_por_admin_usd,
          vigente_desde, vigente_hasta, activa,
          red_proveedores(id, nombre, logo_url, rubro, sitio_web)
        `).eq("activa", true).order("created_at", { ascending: false }),
        supabase.from("sponsor_adhesiones").select("campana_id, token_ref, cant_administraciones, monto_cobrado_usd, clics, created_at").eq("corredor_id", data.user.id),
      ]);

      if (perfil?.cant_administraciones_declaradas) {
        setCantAdmins(perfil.cant_administraciones_declaradas);
        setCantAdminsDeclaradas(perfil.cant_administraciones_declaradas);
        setFormAdmins(String(perfil.cant_administraciones_declaradas));
      }
      setCampanas((cams ?? []) as unknown as Campana[]);
      setMisAdhesiones((adhs ?? []) as MiAdhesion[]);
      setLoading(false);
    };
    init();
  }, []);

  const adherirse = async (campana: Campana) => {
    const cant = parseInt(formAdmins);
    if (!cant || cant <= 0) { showToast("Ingresá una cantidad válida", "err"); return; }
    if (!userId) return;
    setUniendose(campana.id);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/sponsors/adhesion", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ campana_id: campana.id, cant_administraciones_declaradas: cant }),
    });
    const json = await res.json();
    setUniendose(null);

    if (!res.ok) { showToast(json.error ?? "Error al unirse", "err"); return; }

    setToken(json.token_ref);
    setCantAdmins(cant);
    setCantAdminsDeclaradas(cant);
    setMisAdhesiones(prev => [...prev.filter(a => a.campana_id !== campana.id), {
      campana_id: campana.id,
      token_ref: json.token_ref,
      cant_administraciones: cant,
      monto_cobrado_usd: json.monto_cobrado,
      clics: 0,
      created_at: new Date().toISOString(),
    }]);
    showToast(json.yaExistia ? "Ya estabas adherido" : `¡Te sumaste! Se debitaron $${json.monto_cobrado} al sponsor`);
  };

  const copiarLink = (tkn: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/r/${tkn}`);
    setCopiado(true); setTimeout(() => setCopiado(false), 2000);
  };

  const adhId = (id: string) => misAdhesiones.find(a => a.campana_id === id);

  if (loading) return <div style={{ padding: 64, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>Cargando campañas...</div>;

  const misCampanas = campanas.filter(c => adhId(c.id));
  const disponibles = campanas.filter(c => !adhId(c.id));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        .camp-hdr { font-family:'Montserrat',sans-serif; font-size:22px; font-weight:800; color:#fff; margin-bottom:6px; }
        .camp-sub { font-size:13px; color:rgba(255,255,255,0.35); margin-bottom:24px; }
        .camp-sec { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,0.25); margin:24px 0 12px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .camp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }
        .camp-card { background:rgba(14,14,14,.95); border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:20px; display:flex; flex-direction:column; gap:12px; transition:border-color .2s; }
        .camp-card:hover { border-color:rgba(255,255,255,.14); }
        .camp-card.adherido { border-color:rgba(34,197,94,.25); background:rgba(34,197,94,.03); }
        .camp-logo { width:44px; height:44px; border-radius:8px; object-fit:contain; background:rgba(255,255,255,.06); padding:4px; flex-shrink:0; }
        .camp-logo-ph { width:44px; height:44px; border-radius:8px; background:rgba(200,0,0,.12); border:1px solid rgba(200,0,0,.2); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
        .camp-sponsor-row { display:flex; align-items:center; gap:10px; }
        .camp-sponsor-nom { font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; color:rgba(255,255,255,.5); letter-spacing:.06em; text-transform:uppercase; }
        .camp-titulo { font-family:'Montserrat',sans-serif; font-size:15px; font-weight:800; color:#fff; line-height:1.3; }
        .camp-desc { font-size:12px; color:rgba(255,255,255,.45); line-height:1.6; }
        .camp-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
        .camp-detalle { font-size:13px; font-weight:600; color:#fff; padding:10px 14px; background:rgba(255,255,255,.04); border-radius:6px; border:1px solid rgba(255,255,255,.08); }
        .camp-costo { font-size:11px; color:rgba(255,255,255,.35); }
        .camp-costo strong { color:#cc0000; }
        .camp-input { width:100%; padding:10px 13px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:4px; color:#fff; font-size:13px; outline:none; font-family:'Inter',sans-serif; box-sizing:border-box; }
        .camp-input:focus { border-color:rgba(200,0,0,.4); }
        .btn-sumar { padding:11px; background:#cc0000; border:none; border-radius:4px; color:#fff; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; width:100%; }
        .btn-sumar:hover:not(:disabled) { background:#e60000; }
        .btn-sumar:disabled { opacity:.5; cursor:not-allowed; }
        .camp-link-box { background:rgba(34,197,94,.06); border:1px solid rgba(34,197,94,.2); border-radius:6px; padding:12px 14px; }
        .camp-link-url { font-family:'Inter',sans-serif; font-size:11px; color:rgba(34,197,94,.8); word-break:break-all; margin-bottom:8px; }
        .btn-copy { padding:7px 14px; background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.25); border-radius:4px; color:#22c55e; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; cursor:pointer; }
        .camp-stats-row { display:flex; gap:12px; flex-wrap:wrap; }
        .camp-stat { display:flex; flex-direction:column; gap:2px; }
        .camp-stat-val { font-family:'Montserrat',sans-serif; font-size:18px; font-weight:800; color:#cc0000; }
        .camp-stat-label { font-size:10px; color:rgba(255,255,255,.35); }
        .toast { position:fixed; bottom:28px; right:28px; padding:12px 20px; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:12px; font-weight:700; z-index:999; }
        .toast.ok { background:rgba(34,197,94,.15); border:1px solid rgba(34,197,94,.35); color:#22c55e; }
        .toast.err { background:rgba(200,0,0,.15); border:1px solid rgba(200,0,0,.35); color:#ff6666; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="camp-hdr">Campañas de Sponsors</div>
        <div className="camp-sub">
          Sumarte a una campaña conecta a tus administraciones con los beneficios del sponsor.<br/>
          El sponsor paga por cada administración que referenciás — sin costo para vos.
        </div>

        {/* Declarar admins */}
        {!cantAdmins && (
          <div style={{ background: "rgba(200,0,0,.06)", border: "1px solid rgba(200,0,0,.2)", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
              ¿Cuántos consorcios o propiedades administrás?
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginBottom: 12 }}>
              Declaralo una sola vez. Podés actualizarlo desde tu perfil cuando cambie tu cartera de administraciones.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="camp-input"
                type="number" min="1" placeholder="Ej: 80"
                value={formAdmins}
                onChange={e => setFormAdmins(e.target.value)}
                style={{ maxWidth: 160 }}
              />
            </div>
          </div>
        )}

        {/* Mis campañas activas */}
        {misCampanas.length > 0 && (
          <>
            <div className="camp-sec">✅ Mis campañas activas — {misCampanas.length}</div>
            <div className="camp-grid">
              {misCampanas.map(c => {
                const adh = adhId(c.id)!;
                const linkUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${adh.token_ref}`;
                return (
                  <div key={c.id} className="camp-card adherido">
                    <div className="camp-sponsor-row">
                      {c.red_proveedores?.logo_url
                        ? <img src={c.red_proveedores.logo_url} className="camp-logo" alt="" />
                        : <div className="camp-logo-ph">🏢</div>
                      }
                      <div>
                        <div className="camp-sponsor-nom">{c.red_proveedores?.nombre}</div>
                        <div className="camp-titulo">{c.titulo}</div>
                      </div>
                    </div>
                    <div className="camp-stats-row">
                      <div className="camp-stat"><div className="camp-stat-val">{adh.cant_administraciones}</div><div className="camp-stat-label">administraciones referidas</div></div>
                      <div className="camp-stat"><div className="camp-stat-val">{adh.clics}</div><div className="camp-stat-label">clics en tu link</div></div>
                      <div className="camp-stat"><div className="camp-stat-val">${adh.monto_cobrado_usd}</div><div className="camp-stat-label">cobrado al sponsor</div></div>
                    </div>
                    <div className="camp-link-box">
                      <div style={{ fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(34,197,94,.6)", marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>
                        Tu link de referido
                      </div>
                      <div className="camp-link-url">{linkUrl}</div>
                      <button className="btn-copy" onClick={() => copiarLink(adh.token_ref)}>
                        {copiado ? "✓ Copiado" : "Copiar link"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Campañas disponibles */}
        {disponibles.length > 0 && (
          <>
            <div className="camp-sec">🎯 Campañas disponibles — {disponibles.length}</div>
            <div className="camp-grid">
              {disponibles.map(c => {
                const color = TIPO_COLOR[c.tipo_beneficio] ?? "#cc0000";
                const estimado = (cantAdminsDeclaradas || parseInt(formAdmins) || 0) * c.costo_por_admin_usd;
                return (
                  <div key={c.id} className="camp-card">
                    <div className="camp-sponsor-row">
                      {c.red_proveedores?.logo_url
                        ? <img src={c.red_proveedores.logo_url} className="camp-logo" alt="" />
                        : <div className="camp-logo-ph">🏢</div>
                      }
                      <div>
                        <div className="camp-sponsor-nom">{c.red_proveedores?.nombre} · {c.red_proveedores?.rubro}</div>
                        <div className="camp-titulo">{c.titulo}</div>
                      </div>
                    </div>
                    <div>
                      <span className="camp-badge" style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>
                        {TIPO_LABEL[c.tipo_beneficio]}
                        {c.valor_descuento_pct ? ` ${c.valor_descuento_pct}%` : ""}
                      </span>
                    </div>
                    <div className="camp-detalle">{c.detalle_beneficio}</div>
                    {c.descripcion && <div className="camp-desc">{c.descripcion}</div>}
                    {c.vigente_hasta && (
                      <div className="camp-costo">Vigente hasta <strong>{new Date(c.vigente_hasta + "T12:00:00").toLocaleDateString("es-AR")}</strong></div>
                    )}
                    <div className="camp-costo">
                      Costo al sponsor: <strong>${c.costo_por_admin_usd} por administración</strong>
                      {estimado > 0 && <span> · estimado para vos: <strong>${estimado.toFixed(0)}</strong></span>}
                    </div>

                    {/* Input admins si no está declarado */}
                    {!cantAdmins && (
                      <div>
                        <label style={{ fontSize: 10, color: "rgba(255,255,255,.35)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", display: "block", marginBottom: 5 }}>
                          Cantidad de administraciones
                        </label>
                        <input
                          className="camp-input"
                          type="number" min="1" placeholder="Ej: 80"
                          value={formAdmins}
                          onChange={e => setFormAdmins(e.target.value)}
                        />
                      </div>
                    )}
                    {cantAdmins && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>
                        Tus administraciones declaradas: <strong style={{ color: "#fff" }}>{cantAdmins}</strong>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,.25)", marginLeft: 6 }}>
                          (podés cambiarlo en tu perfil)
                        </span>
                      </div>
                    )}

                    <button
                      className="btn-sumar"
                      disabled={uniendose === c.id || (!formAdmins && !cantAdmins)}
                      onClick={() => adherirse(c)}
                    >
                      {uniendose === c.id ? "Procesando..." : "Sumarme a esta campaña"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {campanas.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,.2)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>Sin campañas activas por ahora</div>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
