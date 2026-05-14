"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Movimiento {
  id: string; tipo: string; monto_usd: number; descripcion: string | null; created_at: string;
}

export default function SponsorSaldoPage() {
  const [provId, setProvId] = useState<string | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: prov } = await supabase.from("red_proveedores").select("id").eq("portal_user_id", data.user.id).maybeSingle();
      if (!prov) return;
      setProvId(prov.id);
      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from("sponsor_saldo").select("saldo_usd").eq("proveedor_id", prov.id).maybeSingle(),
        supabase.from("sponsor_movimientos").select("id, tipo, monto_usd, descripcion, created_at").eq("proveedor_id", prov.id).order("created_at", { ascending: false }).limit(100),
      ]);
      setSaldo(s?.saldo_usd ?? 0);
      setMovimientos((m ?? []) as Movimiento[]);
      setLoading(false);
    };
    init();
  }, []);

  const TIPO_LABEL: Record<string, string> = { recarga: "Recarga", debito_adhesion: "Débito adhesión", ajuste: "Ajuste" };
  const TIPO_COLOR: Record<string, string> = { recarga: "#22c55e", debito_adhesion: "#ef4444", ajuste: "#f59e0b" };

  if (loading) return <div style={{ color: "rgba(255,255,255,.3)" }}>Cargando...</div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500&display=swap');
        .sl-hdr { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:800; color:#fff; margin-bottom:20px; }
        .sl-card { background:rgba(14,14,14,.95); border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:28px 32px; display:inline-flex; flex-direction:column; gap:4px; margin-bottom:28px; }
        .sl-val { font-family:'Montserrat',sans-serif; font-size:42px; font-weight:800; }
        .sl-label { font-size:12px; color:rgba(255,255,255,.35); }
        .sl-sec { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.25); margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,.06); }
        .sl-table { width:100%; border-collapse:collapse; }
        .sl-table th { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.3); padding:8px 12px; text-align:left; border-bottom:1px solid rgba(255,255,255,.06); }
        .sl-table td { font-size:12px; color:rgba(255,255,255,.65); padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.04); }
      `}</style>

      <div className="sl-hdr">Saldo y Movimientos</div>

      <div className="sl-card">
        <div className="sl-val" style={{ color: saldo < 50 ? "#ef4444" : saldo < 200 ? "#f59e0b" : "#22c55e" }}>
          ${saldo.toFixed(2)}
        </div>
        <div className="sl-label">Saldo disponible (USD)</div>
      </div>

      {saldo < 50 && (
        <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#ef4444", maxWidth: 500 }}>
          ⚠️ Saldo bajo. Contactá al equipo de GFI® para recargar tu crédito.
          Las adhesiones de nuevos corredores quedan bloqueadas sin saldo disponible.
        </div>
      )}

      <div className="sl-sec">Historial de movimientos</div>

      {movimientos.length === 0
        ? <div style={{ color: "rgba(255,255,255,.2)", fontSize: 13 }}>Sin movimientos registrados.</div>
        : (
          <div style={{ background: "rgba(14,14,14,.95)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, overflow: "auto" }}>
            <table className="sl-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Descripción</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td>
                      <span style={{ color: TIPO_COLOR[m.tipo] ?? "#fff", fontWeight: 600 }}>
                        {TIPO_LABEL[m.tipo] ?? m.tipo}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: m.monto_usd >= 0 ? "#22c55e" : "#ef4444" }}>
                      {m.monto_usd >= 0 ? "+" : ""}{m.monto_usd.toFixed(2)} USD
                    </td>
                    <td style={{ maxWidth: 300, fontSize: 11, color: "rgba(255,255,255,.4)" }}>{m.descripcion ?? "—"}</td>
                    <td style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>
                      {new Date(m.created_at).toLocaleDateString("es-AR")}
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
