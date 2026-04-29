"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface PerfilPublico {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  telefono: string | null;
  email: string | null;
  inmobiliaria: string | null;
  especialidades: string[] | null;
  foto_url: string | null;
  zona_trabajo: string | null;
  anos_experiencia: number | null;
  web_propia: string | null;
  instagram: string | null;
  linkedin: string | null;
  bio: string | null;
  socio_cir: boolean;
  tipo: string;
  created_at: string;
}

interface Props {
  perfilId: string;
  onClose: () => void;
  miUserId: string | null;
}

export default function PerfilRapidoModal({ perfilId, onClose, miUserId }: Props) {
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardandoCRM, setGuardandoCRM] = useState(false);
  const [enCRM, setEnCRM] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from("perfiles")
        .select("id,nombre,apellido,matricula,telefono,email,inmobiliaria,especialidades,foto_url,zona_trabajo,anos_experiencia,web_propia,instagram,linkedin,bio,socio_cir,tipo,created_at")
        .eq("id", perfilId)
        .single();
      if (data) setPerfil(data as PerfilPublico);
      setLoading(false);

      // Verificar si ya está en el CRM
      if (miUserId) {
        const { data: crm } = await supabase
          .from("crm_contactos")
          .select("id")
          .eq("perfil_id", miUserId)
          .eq("corredor_ref_id", perfilId)
          .maybeSingle();
        if (crm) setEnCRM(true);
      }
    };
    cargar();
  }, [perfilId, miUserId]);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const guardarEnCRM = async () => {
    if (!miUserId || !perfil) return;
    setGuardandoCRM(true);
    const { error } = await supabase.from("crm_contactos").insert({
      perfil_id: miUserId,
      nombre: perfil.nombre,
      apellido: perfil.apellido,
      telefono: perfil.telefono,
      email: perfil.email,
      matricula: perfil.matricula,
      inmobiliaria: perfil.inmobiliaria,
      corredor_ref_id: perfilId,
      etiquetas: ["colega", "GFI"],
      notas: `Corredor GFI®${perfil.matricula ? ` · Mat. ${perfil.matricula}` : ""}`,
    });
    setGuardandoCRM(false);
    if (!error) {
      setEnCRM(true);
      mostrarToast("Guardado en tu CRM");
    }
  };

  const iniciales = perfil ? `${perfil.nombre?.charAt(0) ?? ""}${perfil.apellido?.charAt(0) ?? ""}`.toUpperCase() : "?";
  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <>
      <style>{`
        .prm-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 24px; }
        .prm-modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.2); border-radius: 8px; width: 100%; max-width: 420px; position: relative; overflow: hidden; animation: prm-in 0.2s ease; }
        @keyframes prm-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .prm-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); }
        .prm-close { position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.4); font-size: 14px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; z-index: 2; }
        .prm-close:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .prm-header { padding: 22px 22px 16px; display: flex; gap: 16px; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .prm-avatar { width: 56px; height: 56px; border-radius: 10px; background: rgba(200,0,0,0.15); border: 2px solid rgba(200,0,0,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #cc0000; flex-shrink: 0; overflow: hidden; }
        .prm-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .prm-info { flex: 1; min-width: 0; }
        .prm-nombre { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; }
        .prm-mat { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; font-family: 'Montserrat',sans-serif; }
        .prm-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .prm-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; font-family: 'Montserrat',sans-serif; }
        .prm-badge.mat { background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); color: #cc0000; }
        .prm-badge.cir { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); color: #818cf8; }
        .prm-badge.admin { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.25); color: #eab308; }
        .prm-body { padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; }
        .prm-row { display: flex; flex-direction: column; gap: 4px; }
        .prm-row-label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.25); }
        .prm-row-val { font-size: 13px; color: rgba(255,255,255,0.7); }
        .prm-especialidades { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
        .prm-esp { font-size: 10px; padding: 3px 8px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
        .prm-bio { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.6; font-style: italic; background: rgba(255,255,255,0.03); border-left: 2px solid rgba(200,0,0,0.25); padding: 8px 12px; border-radius: 0 4px 4px 0; }
        .prm-desde { font-size: 11px; color: rgba(255,255,255,0.25); }
        .prm-acciones { padding: 14px 22px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; flex-wrap: wrap; }
        .prm-btn { flex: 1; min-width: 100px; padding: 9px 14px; border-radius: 4px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; border: 1px solid; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; }
        .prm-btn-wa { background: rgba(37,211,102,0.1); border-color: rgba(37,211,102,0.3); color: #25d366; }
        .prm-btn-wa:hover { background: rgba(37,211,102,0.2); }
        .prm-btn-crm { background: rgba(200,0,0,0.1); border-color: rgba(200,0,0,0.3); color: #cc0000; }
        .prm-btn-crm:hover:not(:disabled) { background: rgba(200,0,0,0.2); color: #fff; }
        .prm-btn-crm:disabled { opacity: 0.5; cursor: not-allowed; }
        .prm-btn-crm.guardado { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e; }
        .prm-btn-perfil { background: transparent; border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.4); }
        .prm-btn-perfil:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .prm-spinner { display: flex; align-items: center; justify-content: center; padding: 40px; }
        .prm-spin { width: 24px; height: 24px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .prm-toast { position: fixed; bottom: 28px; right: 28px; padding: 10px 18px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; z-index: 999; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; animation: toastIn 0.3s ease; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div className="prm-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="prm-modal">
          <button className="prm-close" onClick={onClose}>✕</button>

          {loading ? (
            <div className="prm-spinner"><div className="prm-spin" /></div>
          ) : !perfil ? (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              No se encontró el perfil
            </div>
          ) : (
            <>
              <div className="prm-header">
                <div className="prm-avatar">
                  {perfil.foto_url ? <img src={perfil.foto_url} alt="Foto" /> : iniciales}
                </div>
                <div className="prm-info">
                  <div className="prm-nombre">{perfil.apellido}, {perfil.nombre}</div>
                  {perfil.matricula && <div className="prm-mat">Mat. {perfil.matricula} · COCIR 2da Circ.</div>}
                  {perfil.inmobiliaria && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{perfil.inmobiliaria}</div>}
                  <div className="prm-badges">
                    {perfil.matricula && <span className="prm-badge mat">✓ Matriculado</span>}
                    {perfil.socio_cir && <span className="prm-badge cir">CIR</span>}
                    {perfil.tipo === "admin" && <span className="prm-badge admin">Admin</span>}
                  </div>
                </div>
              </div>

              <div className="prm-body">
                {perfil.bio && <div className="prm-bio">"{perfil.bio}"</div>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {perfil.zona_trabajo && (
                    <div className="prm-row">
                      <div className="prm-row-label">Zona</div>
                      <div className="prm-row-val">📍 {perfil.zona_trabajo}</div>
                    </div>
                  )}
                  {perfil.anos_experiencia && (
                    <div className="prm-row">
                      <div className="prm-row-label">Experiencia</div>
                      <div className="prm-row-val">🏆 {perfil.anos_experiencia} años</div>
                    </div>
                  )}
                  {perfil.telefono && (
                    <div className="prm-row">
                      <div className="prm-row-label">Teléfono</div>
                      <div className="prm-row-val">📞 {perfil.telefono}</div>
                    </div>
                  )}
                  {perfil.email && (
                    <div className="prm-row">
                      <div className="prm-row-label">Email</div>
                      <div className="prm-row-val" style={{ wordBreak: "break-all", fontSize: 12 }}>✉️ {perfil.email}</div>
                    </div>
                  )}
                </div>

                {(perfil.especialidades ?? []).length > 0 && (
                  <div className="prm-row">
                    <div className="prm-row-label">Especialidades</div>
                    <div className="prm-especialidades">
                      {(perfil.especialidades ?? []).map(e => (
                        <span key={e} className="prm-esp">{e}</span>
                      ))}
                    </div>
                  </div>
                )}

                {(perfil.instagram || perfil.linkedin || perfil.web_propia) && (
                  <div className="prm-row">
                    <div className="prm-row-label">Redes</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      {perfil.instagram && (
                        <a href={`https://instagram.com/${perfil.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#e1306c", textDecoration: "none" }}>
                          📸 Instagram
                        </a>
                      )}
                      {perfil.linkedin && (
                        <a href={perfil.linkedin.startsWith("http") ? perfil.linkedin : `https://${perfil.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#0077b5", textDecoration: "none" }}>
                          💼 LinkedIn
                        </a>
                      )}
                      {perfil.web_propia && (
                        <a href={perfil.web_propia.startsWith("http") ? perfil.web_propia : `https://${perfil.web_propia}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#cc0000", textDecoration: "none" }}>
                          🌐 Web
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="prm-desde">
                  Miembro desde {formatFecha(perfil.created_at)}
                </div>
              </div>

              <div className="prm-acciones">
                {perfil.telefono && (
                  <a
                    className="prm-btn prm-btn-wa"
                    href={`https://wa.me/54${perfil.telefono.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📱 WhatsApp
                  </a>
                )}
                {miUserId && miUserId !== perfilId && (
                  <button
                    className={`prm-btn prm-btn-crm${enCRM ? " guardado" : ""}`}
                    onClick={guardarEnCRM}
                    disabled={guardandoCRM || enCRM}
                  >
                    {enCRM ? "✓ En tu CRM" : guardandoCRM ? "Guardando..." : "💾 Guardar en CRM"}
                  </button>
                )}
                <a className="prm-btn prm-btn-perfil" href="/padron-gfi">
                  👤 Ver padrón
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className="prm-toast">{toast}</div>}
    </>
  );
}
