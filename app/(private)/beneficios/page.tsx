"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Beneficio {
  id: string;
  proveedor_id: string;
  titulo: string;
  descripcion: string | null;
  imagen_url: string | null;
  vigente_desde: string;
  vigente_hasta: string | null;
  activo: boolean;
  created_at: string;
  red_proveedores?: {
    nombre: string; rubro: string; logo_url: string | null;
    sitio_web: string | null; telefono: string | null; email: string | null;
    suscripcion_estado: string | null;
  };
}

export default function BeneficiosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [misIntereses, setMisIntereses] = useState<string[]>([]);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("todos");
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = (msg: string, tipo: "ok" | "err" = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      const uid = data.user.id;
      setUserId(uid);
      const { data: ints } = await supabase.from("sponsor_beneficio_interesados").select("proveedor_id").eq("perfil_id", uid);
      setMisIntereses((ints ?? []).map((r: any) => r.proveedor_id));
    };
    init();
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const hoy = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("sponsor_beneficios")
      .select("*, red_proveedores!sponsor_beneficios_proveedor_id_fkey(nombre,rubro,logo_url,sitio_web,telefono,email,suscripcion_estado)")
      .eq("activo", true)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .order("created_at", { ascending: false });
    setBeneficios(((data ?? []) as any[]).filter((b: any) => b.red_proveedores?.suscripcion_estado === "activa"));
    setLoading(false);
  };

  const toggleInteres = async (proveedorId: string) => {
    if (!userId) return;
    setProcesando(proveedorId);
    const ya = misIntereses.includes(proveedorId);
    if (ya) {
      await supabase.from("sponsor_beneficio_interesados").delete().eq("proveedor_id", proveedorId).eq("perfil_id", userId);
      setMisIntereses(mi => mi.filter(id => id !== proveedorId));
      showToast("Interés cancelado");
    } else {
      await supabase.from("sponsor_beneficio_interesados").insert({ proveedor_id: proveedorId, perfil_id: userId });
      setMisIntereses(mi => [...mi, proveedorId]);
      showToast("¡Registrado! GFI te incluirá en el listado de este sponsor.");
    }
    setProcesando(null);
  };

  const hoy = new Date();
  const diasHasta = (f: string) => Math.ceil((new Date(f).getTime() - hoy.getTime()) / 86400000);
  const ff = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const rubros = ["todos", ...Array.from(new Set(beneficios.map(b => b.red_proveedores?.rubro).filter(Boolean))).sort()] as string[];
  const filtrados = filtro === "todos" ? beneficios : beneficios.filter(b => b.red_proveedores?.rubro === filtro);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .bn-wrap{display:flex;flex-direction:column;gap:20px}
        .bn-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .bn-titulo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:#fff}
        .bn-titulo span{color:#cc0000}
        .bn-sub{font-size:13px;color:rgba(255,255,255,0.35);margin-top:4px}
        .bn-filtros{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
        .bn-filtro{padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.4);font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s}
        .bn-filtro.activo{border-color:rgba(200,0,0,0.4);background:rgba(200,0,0,0.1);color:#cc0000}
        .bn-count{font-size:11px;color:rgba(255,255,255,0.25);margin-left:4px}
        .bn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
        .bn-card{background:#0f0f0f;border:1px solid rgba(200,0,0,0.2);border-radius:10px;overflow:hidden;transition:border-color 0.2s;position:relative}
        .bn-card:hover{border-color:rgba(200,0,0,0.4)}
        .bn-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#cc0000 40%,transparent)}
        .bn-imagen{width:100%;height:180px;object-fit:cover;display:block;background:rgba(200,0,0,0.07)}
        .bn-imagen-ph{width:100%;height:180px;background:linear-gradient(135deg,rgba(200,0,0,0.08),rgba(0,0,0,0.3));display:flex;align-items:center;justify-content:center;font-size:48px}
        .bn-body{padding:16px}
        .bn-sponsor-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
        .bn-sponsor-logo{width:28px;height:28px;border-radius:6px;object-fit:cover;border:1px solid rgba(255,255,255,0.08);flex-shrink:0}
        .bn-sponsor-logo-ph{width:28px;height:28px;border-radius:6px;background:rgba(200,0,0,0.1);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
        .bn-sponsor-nombre{font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#cc0000}
        .bn-sponsor-rubro{font-family:'Montserrat',sans-serif;font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-left:auto}
        .bn-titulo-b{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:800;color:#fff;margin-bottom:6px;line-height:1.3}
        .bn-desc{font-size:12px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:12px}
        .bn-venc{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-family:'Inter',sans-serif;padding:3px 9px;border-radius:20px;margin-bottom:12px}
        .bn-venc.ok{background:rgba(34,197,94,0.08);color:rgba(34,197,94,0.8);border:1px solid rgba(34,197,94,0.2)}
        .bn-venc.pronto{background:rgba(245,158,11,0.08);color:#f59e0b;border:1px solid rgba(245,158,11,0.2)}
        .bn-venc.sin{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.08)}
        .bn-actions{display:flex;gap:8px;flex-wrap:wrap}
        .bn-btn-interes{flex:1;padding:9px 14px;border-radius:5px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;border:1px solid rgba(200,0,0,0.4);background:rgba(200,0,0,0.1);color:#cc0000;white-space:nowrap}
        .bn-btn-interes:hover:not(:disabled){background:rgba(200,0,0,0.2)}
        .bn-btn-interes.registrado{border-color:rgba(34,197,94,0.4);background:rgba(34,197,94,0.08);color:#22c55e}
        .bn-btn-interes:disabled{opacity:0.5;cursor:not-allowed}
        .bn-btn-web{padding:9px 14px;border-radius:5px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:rgba(255,255,255,0.5);font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:all 0.2s}
        .bn-btn-web:hover{border-color:rgba(255,255,255,0.25);color:#fff}
        .bn-empty{padding:64px 32px;text-align:center;color:rgba(255,255,255,0.2);font-size:14px;font-style:italic;background:rgba(14,14,14,0.9);border:1px solid rgba(255,255,255,0.07);border-radius:8px}
        .bn-spinner{display:flex;justify-content:center;padding:48px}
        .bn-spin{width:28px;height:28px;border:2px solid rgba(200,0,0,0.2);border-top-color:#cc0000;border-radius:50%;animation:spin 0.7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .toast{position:fixed;bottom:28px;right:28px;padding:12px 20px;border-radius:5px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;z-index:999;animation:toastIn 0.3s ease}
        .toast.ok{background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.35);color:#22c55e}
        .toast.err{background:rgba(200,0,0,0.15);border:1px solid rgba(200,0,0,0.35);color:#ff6666}
        @keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:600px){.bn-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="bn-wrap">
        <div className="bn-header">
          <div>
            <div className="bn-titulo">Beneficios <span>Sponsors GFI®</span></div>
            <div className="bn-sub">Descuentos y ofertas exclusivas para corredores de la red</div>
          </div>
        </div>

        <div className="bn-filtros">
          {rubros.map(r => (
            <button key={r} className={`bn-filtro${filtro===r?" activo":""}`} onClick={()=>setFiltro(r)}>
              {r === "todos" ? "Todos" : r}
            </button>
          ))}
          <span className="bn-count">{filtrados.length} beneficio{filtrados.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="bn-spinner"><div className="bn-spin"/></div>
        ) : filtrados.length === 0 ? (
          <div className="bn-empty">{beneficios.length === 0 ? "Todavía no hay beneficios publicados. ¡Pronto habrá novedades!" : "No hay beneficios con ese filtro."}</div>
        ) : (
          <div className="bn-grid">
            {filtrados.map(b => {
              const p = b.red_proveedores;
              const ya = misIntereses.includes(b.proveedor_id);
              const dias = b.vigente_hasta ? diasHasta(b.vigente_hasta) : null;
              return (
                <div key={b.id} className="bn-card">
                  {b.imagen_url
                    ? <img src={b.imagen_url} alt={b.titulo} className="bn-imagen" />
                    : <div className="bn-imagen-ph">🎁</div>}
                  <div className="bn-body">
                    <div className="bn-sponsor-row">
                      {p?.logo_url ? <img src={p.logo_url} alt={p?.nombre} className="bn-sponsor-logo"/> : <div className="bn-sponsor-logo-ph">🏢</div>}
                      <span className="bn-sponsor-nombre">{p?.nombre}</span>
                      <span className="bn-sponsor-rubro">{p?.rubro}</span>
                    </div>
                    <div className="bn-titulo-b">{b.titulo}</div>
                    {b.descripcion && <div className="bn-desc">{b.descripcion}</div>}
                    {dias !== null ? (
                      <div className={`bn-venc ${dias <= 15 ? "pronto" : "ok"}`}>
                        {dias <= 0 ? "⚠️ Vencido" : `⏳ Válido hasta ${ff(b.vigente_hasta!)}${dias <= 30 ? ` · ${dias}d` : ""}`}
                      </div>
                    ) : (
                      <div className="bn-venc sin">⏳ Sin vencimiento</div>
                    )}
                    <div className="bn-actions">
                      <button
                        className={`bn-btn-interes${ya ? " registrado" : ""}`}
                        disabled={procesando === b.proveedor_id}
                        onClick={() => toggleInteres(b.proveedor_id)}
                      >
                        {ya ? "✓ Me interesa — anotado" : "🎁 Me interesa"}
                      </button>
                      {p?.sitio_web && <a href={p.sitio_web} target="_blank" rel="noopener noreferrer" className="bn-btn-web">🌐 Web</a>}
                      {p?.telefono && <a href={`https://wa.me/54${p.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="bn-btn-web">📱 WA</a>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
