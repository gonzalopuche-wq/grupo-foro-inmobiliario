"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface DashData {
  saldo: number;
  campanas_activas: number;
  total_adhesiones: number;
  total_administraciones: number;
  total_clics: number;
  total_cobrado: number;
}

export default function SponsorPortalDashboard() {
  const [provId, setProvId] = useState<string | null>(null);
  const [dash, setDash] = useState<DashData>({ saldo: 0, campanas_activas: 0, total_adhesiones: 0, total_administraciones: 0, total_clics: 0, total_cobrado: 0 });
  const [adhesiones, setAdhesiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const { data: prov } = await supabase
        .from("red_proveedores")
        .select("id, nombre")
        .eq("portal_user_id", data.user.id)
        .maybeSingle();
      if (!prov) { setLoading(false); return; }
      setProvId(prov.id);

      const [{ data: saldoData }, { data: campanas }] = await Promise.all([
        supabase.from("sponsor_saldo").select("saldo_usd").eq("proveedor_id", prov.id).maybeSingle(),
        supabase.from("sponsor_campanas").select("id, titulo, activa").eq("proveedor_id", prov.id),
      ]);

      const campanaIds = (campanas ?? []).map((c: any) => c.id);
      const { data: adhs } = campanaIds.length > 0
        ? await supabase.from("sponsor_adhesiones")
            .select(`id, cant_administraciones, monto_cobrado_usd, clics, created_at, token_ref, campana_id, sponsor_campanas(titulo), corredor_id, perfiles(nombre, apellido, matricula)`)
            .in("campana_id", campanaIds)
            .order("created_at", { ascending: false })
        : { data: [] };

      const adList = (adhs ?? []) as any[];
      setDash({
        saldo: saldoData?.saldo_usd ?? 0,
        campanas_activas: (campanas ?? []).filter((c: any) => c.activa).length,
        total_adhesiones: adList.length,
        total_administraciones: adList.reduce((s, a) => s + (a.cant_administraciones ?? 0), 0),
        total_clics: adList.reduce((s, a) => s + (a.clics ?? 0), 0),
        total_cobrado: adList.reduce((s, a) => s + (a.monto_cobrado_usd ?? 0), 0),
      });
      setAdhesiones(adList);
      setLoading(false);
    };
    init();
  }, []);

  if (loading) return <div style={{ color: "rgba(255,255,255,.3)" }}>Cargando...</div>;

  const stats = [
    { val: `$${dash.saldo.toFixed(2)}`, label: "Saldo disponible", color: dash.saldo < 50 ? "#ef4444" : "#22c55e" },
    { val: dash.campanas_activas, label: "Campañas activas", color: "#cc0000" },
    { val: dash.total_adhesiones, label: "Corredores adheridos", color: "#3b82f6" },
    { val: dash.total_administraciones.toLocaleString("es-AR"), label: "Administraciones alcanzadas", color: "#f59e0b" },
    { val: dash.total_clics, label: "Clics en links de referido", color: "#8b5cf6" },
    { val: `$${dash.total_cobrado.toFixed(2)}`, label: "Total invertido", color: "rgba(255,255,255,.5)" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        .sp-hdr { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:800; color:#fff; margin-bottom:20px; }
        .sp-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:28px; }
        .sp-stat { background:rgba(14,14,14,.95); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:18px 20px; }
        .sp-stat-val { font-family:'Montserrat',sans-serif; font-size:24px; font-weight:800; margin-bottom:4px; }
        .sp-stat-label { font-size:11px; color:rgba(255,255,255,.35); }
        .sp-sec { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.25); margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,.06); }
        .sp-table { width:100%; border-collapse:collapse; }
        .sp-table th { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.3); padding:8px 12px; text-align:left; border-bottom:1px solid rgba(255,255,255,.06); }
        .sp-table td { font-size:12px; color:rgba(255,255,255,.7); padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
        .sp-table tr:hover td { background:rgba(255,255,255,.02); }
        .sp-badge-ok { display:inline-block; padding:3px 8px; border-radius:10px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.2); color:#22c55e; font-size:9px; font-weight:700; font-family:'Montserrat',sans-serif; }
      `}</style>

      <div className="sp-hdr">Dashboard</div>

      <div className="sp-stats">
        {stats.map((s, i) => (
          <div key={i} className="sp-stat">
            <div className="sp-stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="sp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {dash.saldo < 50 && (
        <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#ef4444" }}>
          ⚠️ Saldo bajo. Contactá al administrador de GFI® para recargar crédito antes de que las nuevas adhesiones queden bloqueadas.
        </div>
      )}

      <div className="sp-sec">Últimas adhesiones de corredores</div>
      {adhesiones.length === 0
        ? <div style={{ color: "rgba(255,255,255,.2)", fontSize: 13, padding: "20px 0" }}>Todavía no hay adhesiones en tus campañas.</div>
        : (
          <div style={{ background: "rgba(14,14,14,.95)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, overflow: "auto" }}>
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Corredor</th>
                  <th>Campaña</th>
                  <th>Admins</th>
                  <th>Cobrado</th>
                  <th>Clics</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {adhesiones.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "#fff" }}>
                        {a.perfiles?.apellido}, {a.perfiles?.nombre}
                      </div>
                      {a.perfiles?.matricula && <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Mat. {a.perfiles.matricula}</div>}
                    </td>
                    <td>{a.sponsor_campanas?.titulo}</td>
                    <td><strong style={{ color: "#f59e0b" }}>{a.cant_administraciones}</strong></td>
                    <td><strong style={{ color: "#cc0000" }}>${a.monto_cobrado_usd}</strong></td>
                    <td>{a.clics}</td>
                    <td style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>
                      {new Date(a.created_at).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </>
  );
}
