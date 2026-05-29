"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

interface DatosRecibo {
  // Suscripción
  id: string;
  periodo: string | null;
  monto_usd: number | null;
  monto_ars: number | null;
  dolar_ref: number | null;
  fecha_confirmacion: string | null;
  fecha_vencimiento: string | null;
  estado: string;
  // Perfil corredor
  nombre: string;
  apellido: string;
  matricula: string | null;
  cuit: string | null;
  // Emisor (desde indicadores)
  titular: string;
  cuit_emisor: string;
}

function nroRecibo(id: string, fecha: string | null): string {
  const year = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear();
  const suffix = id.replace(/-/g, "").slice(-6).toUpperCase();
  return `${year}-${suffix}`;
}

function periodoLabel(periodo: string | null): string {
  if (!periodo) return "—";
  const [y, m] = periodo.split("-");
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${meses[parseInt(m) - 1]} ${y}`;
}

export default function ReciboPage() {
  const params = useParams();
  const id = params?.id as string;
  const [datos, setDatos] = useState<DatosRecibo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }

      const [{ data: sub, error: errSub }, { data: ind }] = await Promise.all([
        supabase
          .from("suscripciones")
          .select("id, periodo, monto_usd, monto_ars, dolar_ref, fecha_confirmacion, fecha_vencimiento, estado, perfil_id, perfiles(nombre, apellido, matricula, cuit)")
          .eq("id", id)
          .single(),
        supabase.from("indicadores").select("clave,valor_texto,valor").in("clave", ["cbu_titular","cbu_cuit"]),
      ]);

      if (errSub || !sub) { setError("Comprobante no encontrado."); setLoading(false); return; }

      // Solo el dueño o admin puede ver
      const { data: perfAdmin } = await supabase.from("perfiles").select("tipo").eq("id", session.user.id).single();
      const esAdmin = ["admin","master"].includes(perfAdmin?.tipo ?? "");
      if (!esAdmin && sub.perfil_id !== session.user.id) { setError("No tenés permiso para ver este comprobante."); setLoading(false); return; }

      const perf = Array.isArray(sub.perfiles) ? sub.perfiles[0] : sub.perfiles;
      const get = (k: string) => ind?.find((i: any) => i.clave === k);
      const titularInd = get("cbu_titular");
      const cuitInd    = get("cbu_cuit");

      setDatos({
        id: sub.id,
        periodo: sub.periodo,
        monto_usd: sub.monto_usd,
        monto_ars: sub.monto_ars,
        dolar_ref: sub.dolar_ref,
        fecha_confirmacion: sub.fecha_confirmacion,
        fecha_vencimiento: sub.fecha_vencimiento,
        estado: sub.estado,
        nombre: perf?.nombre ?? "—",
        apellido: perf?.apellido ?? "—",
        matricula: perf?.matricula ?? null,
        cuit: perf?.cuit ?? null,
        titular: (titularInd?.valor_texto ?? titularInd?.valor?.toString()) ?? "Gonzalo Leandro Puche",
        cuit_emisor: (cuitInd?.valor_texto ?? cuitInd?.valor?.toString()) ?? "20-25750876-6",
      });
      setLoading(false);
    };
    cargar();
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif", fontSize: 14, color: "#666" }}>
      Cargando comprobante...
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
      <div style={{ textAlign: "center", color: "#cc0000" }}>{error}</div>
    </div>
  );

  if (!datos) return null;

  // Cálculos
  const subtotalArs = datos.dolar_ref && datos.monto_usd ? Math.round(datos.monto_usd * datos.dolar_ref) : (datos.monto_ars ? Math.round(datos.monto_ars / 1.21) : null);
  const ivaArs      = subtotalArs ? Math.round(subtotalArs * 0.21) : null;
  const totalArs    = datos.monto_ars ?? (subtotalArs && ivaArs ? subtotalArs + ivaArs : null);
  const nro         = nroRecibo(datos.id, datos.fecha_confirmacion);
  const fmtFecha    = (s: string | null) => s ? new Date(s + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const fmtARS      = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #f5f5f5; }

        .recibo-wrapper {
          min-height: 100vh;
          background: #f5f5f5;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 16px 48px;
          font-family: 'Inter', sans-serif;
        }

        .recibo-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          width: 100%;
          max-width: 680px;
        }

        .btn-print {
          padding: 10px 22px;
          background: #cc0000;
          border: none;
          border-radius: 4px;
          color: #fff;
          font-family: 'Montserrat', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .btn-volver {
          padding: 10px 18px;
          background: transparent;
          border: 1px solid #ddd;
          border-radius: 4px;
          color: #666;
          font-family: 'Montserrat', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        .recibo {
          width: 100%;
          max-width: 680px;
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 2px 16px rgba(0,0,0,0.08);
        }

        /* Cabecera */
        .recibo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 36px 24px;
          border-bottom: 2px solid #cc0000;
        }

        .recibo-logo-area {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .recibo-logo {
          width: 56px;
          height: 56px;
          object-fit: contain;
        }

        .recibo-brand-text {}
        .recibo-brand-name {
          font-family: 'Montserrat', sans-serif;
          font-size: 26px;
          font-weight: 800;
          color: #111;
          line-height: 1;
        }
        .recibo-brand-name span { color: #cc0000; }
        .recibo-brand-sub {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #888;
          margin-top: 4px;
        }

        .recibo-doc-info {
          text-align: right;
        }
        .recibo-doc-tipo {
          font-family: 'Montserrat', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #cc0000;
          margin-bottom: 6px;
        }
        .recibo-doc-nro {
          font-family: 'Montserrat', sans-serif;
          font-size: 16px;
          font-weight: 800;
          color: #111;
        }
        .recibo-doc-fecha {
          font-size: 12px;
          color: #888;
          margin-top: 4px;
        }

        /* Cuerpo */
        .recibo-body {
          padding: 28px 36px;
        }

        .recibo-partes {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .recibo-parte-titulo {
          font-family: 'Montserrat', sans-serif;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #bbb;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #f0f0f0;
        }

        .recibo-parte-nombre {
          font-family: 'Montserrat', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #111;
          margin-bottom: 4px;
        }

        .recibo-parte-dato {
          font-size: 12px;
          color: #666;
          margin-bottom: 2px;
        }

        .recibo-parte-dato strong {
          color: #333;
          font-weight: 600;
        }

        /* Concepto */
        .recibo-concepto {
          background: #fafafa;
          border: 1px solid #ececec;
          border-radius: 4px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }

        .recibo-concepto-titulo {
          font-family: 'Montserrat', sans-serif;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #bbb;
          margin-bottom: 8px;
        }

        .recibo-concepto-texto {
          font-size: 14px;
          font-weight: 600;
          color: #111;
        }

        .recibo-concepto-periodo {
          font-size: 12px;
          color: #888;
          margin-top: 4px;
        }

        /* Tabla de montos */
        .recibo-montos {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }

        .recibo-montos tr {
          border-bottom: 1px solid #f0f0f0;
        }

        .recibo-montos tr:last-child {
          border-bottom: none;
        }

        .recibo-montos td {
          padding: 9px 0;
          font-size: 13px;
        }

        .recibo-montos td:last-child {
          text-align: right;
          font-weight: 600;
          color: #333;
        }

        .recibo-montos td:first-child {
          color: #666;
        }

        .recibo-total-row td {
          padding: 14px 0 0 !important;
          font-family: 'Montserrat', sans-serif;
          font-size: 15px;
          font-weight: 800 !important;
          color: #111 !important;
          border-top: 2px solid #111 !important;
        }

        /* Estado */
        .recibo-estado {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 12px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.3);
          color: #16a34a;
        }

        /* Footer */
        .recibo-footer {
          padding: 18px 36px;
          border-top: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafafa;
        }

        .recibo-footer-left {
          font-size: 10px;
          color: #bbb;
          line-height: 1.6;
        }

        .recibo-footer-aviso {
          font-size: 9px;
          color: #ccc;
          text-align: right;
          max-width: 240px;
          line-height: 1.5;
        }

        /* Print */
        @media print {
          body { background: #fff !important; }
          .recibo-wrapper { background: #fff !important; padding: 0 !important; }
          .recibo-actions { display: none !important; }
          .recibo {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 100% !important;
          }
          @page { margin: 1.5cm; }
        }

        @media (max-width: 640px) {
          .recibo-header { flex-direction: column; gap: 16px; text-align: left; }
          .recibo-doc-info { text-align: left; }
          .recibo-partes { grid-template-columns: 1fr; }
          .recibo-body { padding: 20px; }
          .recibo-footer { flex-direction: column; gap: 8px; }
          .recibo-footer-aviso { text-align: left; }
        }
      `}</style>

      <div className="recibo-wrapper">
        {/* Botones de acción */}
        <div className="recibo-actions">
          <button className="btn-print" onClick={() => window.print()}>
            ↓ Guardar como PDF / Imprimir
          </button>
          <a className="btn-volver" href="/suscripcion">← Volver</a>
        </div>

        <div className="recibo">
          {/* Cabecera */}
          <div className="recibo-header">
            <div className="recibo-logo-area">
              <img src="/logo_gfi.png" alt="GFI" className="recibo-logo" />
              <div className="recibo-brand-text">
                <div className="recibo-brand-name">GFI<span>®</span></div>
                <div className="recibo-brand-sub">Grupo Foro Inmobiliario</div>
              </div>
            </div>
            <div className="recibo-doc-info">
              <div className="recibo-doc-tipo">Comprobante de pago</div>
              <div className="recibo-doc-nro">N° {nro}</div>
              <div className="recibo-doc-fecha">
                {datos.fecha_confirmacion ? fmtFecha(datos.fecha_confirmacion) : "—"}
              </div>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="recibo-body">
            {/* Emisor / Receptor */}
            <div className="recibo-partes">
              <div>
                <div className="recibo-parte-titulo">Emisor</div>
                <div className="recibo-parte-nombre">{datos.titular}</div>
                <div className="recibo-parte-dato"><strong>CUIT:</strong> {datos.cuit_emisor}</div>
                <div className="recibo-parte-dato">Responsable Inscripto</div>
                <div className="recibo-parte-dato">Rosario, Santa Fe</div>
              </div>
              <div>
                <div className="recibo-parte-titulo">Receptor</div>
                <div className="recibo-parte-nombre">{datos.apellido}, {datos.nombre}</div>
                {datos.matricula && (
                  <div className="recibo-parte-dato"><strong>Matrícula:</strong> {datos.matricula}</div>
                )}
                {datos.cuit ? (
                  <div className="recibo-parte-dato"><strong>CUIT:</strong> {datos.cuit}</div>
                ) : (
                  <div className="recibo-parte-dato" style={{ color: "#ccc" }}>CUIT no registrado</div>
                )}
                <div className="recibo-parte-dato">Corredor inmobiliario</div>
              </div>
            </div>

            {/* Concepto */}
            <div className="recibo-concepto">
              <div className="recibo-concepto-titulo">Concepto</div>
              <div className="recibo-concepto-texto">Acceso GFI® — {periodoLabel(datos.periodo)}</div>
              <div className="recibo-concepto-periodo">
                2da Circunscripción COCIR · Período {datos.periodo ?? "—"}
                {datos.fecha_vencimiento && ` · Vence: ${fmtFecha(datos.fecha_vencimiento)}`}
              </div>
            </div>

            {/* Montos */}
            <table className="recibo-montos">
              <tbody>
                {datos.monto_usd && datos.dolar_ref && (
                  <tr>
                    <td>Cuota mensual (USD {datos.monto_usd} × dólar ref. ${datos.dolar_ref.toLocaleString("es-AR")})</td>
                    <td>{subtotalArs ? fmtARS(subtotalArs) : "—"}</td>
                  </tr>
                )}
                <tr>
                  <td>IVA 21%</td>
                  <td>{ivaArs ? fmtARS(ivaArs) : "—"}</td>
                </tr>
                <tr className="recibo-total-row">
                  <td>Total</td>
                  <td>{totalArs ? fmtARS(totalArs) : "—"}</td>
                </tr>
              </tbody>
            </table>

            {/* Estado */}
            <div>
              <span className="recibo-estado">
                ✓ Pago confirmado
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="recibo-footer">
            <div className="recibo-footer-left">
              GFI® Grupo Foro Inmobiliario<br />
              2da Circunscripción COCIR · Rosario, Santa Fe<br />
              foroinmobiliariomatriculados@gmail.com
            </div>
            <div className="recibo-footer-aviso">
              Este comprobante no reemplaza la factura fiscal.<br />
              La factura AFIP correspondiente se emite por separado.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
