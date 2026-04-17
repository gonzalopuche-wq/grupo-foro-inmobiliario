"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Enlace {
  id: string;
  nombre: string;
  url: string;
  categoria: string | null;
  localidad: string | null;
  activo: boolean;
  estado?: "pendiente" | "ok" | "error" | "timeout";
  codigo?: number | null;
  mensaje?: string;
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: "rgba(255,255,255,0.2)",
  ok: "#22c55e",
  error: "#ff4444",
  timeout: "#eab308",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "—",
  ok: "✓ OK",
  error: "✕ Error",
  timeout: "⏱ Timeout",
};

export default function AdminEnlacesVerificarPage() {
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [filtro, setFiltro] = useState("todos");
  const [resumen, setResumen] = useState({ ok: 0, error: 0, timeout: 0 });

  useEffect(() => {
    const init = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) { window.location.href = "/login"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", user.user.id).single();
      if (perfil?.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      cargar();
    };
    init();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("enlaces_utiles")
      .select("id, nombre, url, categoria, localidad, activo")
      .order("categoria")
      .order("nombre");
    setEnlaces((data ?? []).map(e => ({ ...e, estado: "pendiente" })) as Enlace[]);
    setLoading(false);
  };

  const verificarTodos = async () => {
    setVerificando(true);
    setProgreso(0);
    const total = enlaces.length;
    let ok = 0, error = 0, timeout = 0;

    const verificarUno = async (enlace: Enlace): Promise<Enlace> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`/api/verificar-link?url=${encodeURIComponent(enlace.url)}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        return { ...enlace, estado: data.ok ? "ok" : "error", codigo: data.codigo, mensaje: data.mensaje };
      } catch (e: any) {
        if (e.name === "AbortError") return { ...enlace, estado: "timeout", codigo: null, mensaje: "Timeout (8s)" };
        return { ...enlace, estado: "error", codigo: null, mensaje: e.message };
      }
    };

    // Verificar de a 5 en paralelo
    const BATCH = 5;
    const actualizado = [...enlaces];

    for (let i = 0; i < total; i += BATCH) {
      const batch = actualizado.slice(i, i + BATCH);
      const resultados = await Promise.all(batch.map(e => verificarUno(e)));
      resultados.forEach((r, j) => {
        actualizado[i + j] = r;
        if (r.estado === "ok") ok++;
        else if (r.estado === "timeout") timeout++;
        else error++;
      });
      setEnlaces([...actualizado]);
      setProgreso(Math.min(i + BATCH, total));
    }

    setResumen({ ok, error, timeout });
    setVerificando(false);
  };

  const filtrados = enlaces.filter(e => {
    if (filtro === "todos") return true;
    return e.estado === filtro;
  });

  const pct = enlaces.length > 0 ? Math.round((progreso / enlaces.length) * 100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .av-root { min-height: 100vh; display: flex; flex-direction: column; }
        .av-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .av-topbar-logo { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; }
        .av-topbar-logo span { color: #cc0000; }
        .av-btn-back { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .av-btn-back:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .av-content { flex: 1; padding: 32px; max-width: 1000px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        .av-header h1 { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; }
        .av-header h1 span { color: #cc0000; }
        .av-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .av-acciones { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .av-btn-verificar { padding: 10px 24px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .av-btn-verificar:hover:not(:disabled) { background: #e60000; }
        .av-btn-verificar:disabled { opacity: 0.6; cursor: not-allowed; }
        .av-progreso-wrap { flex: 1; }
        .av-progreso-bar { height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
        .av-progreso-fill { height: 100%; background: #cc0000; border-radius: 3px; transition: width 0.3s; }
        .av-progreso-txt { font-size: 11px; color: rgba(255,255,255,0.35); }
        .av-resumen { display: flex; gap: 12px; flex-wrap: wrap; }
        .av-res-item { padding: 10px 18px; border-radius: 6px; border: 1px solid; text-align: center; min-width: 80px; }
        .av-res-item.ok { background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.25); }
        .av-res-item.error { background: rgba(200,0,0,0.08); border-color: rgba(200,0,0,0.25); }
        .av-res-item.timeout { background: rgba(234,179,8,0.08); border-color: rgba(234,179,8,0.25); }
        .av-res-val { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; }
        .av-res-val.ok { color: #22c55e; }
        .av-res-val.error { color: #ff4444; }
        .av-res-val.timeout { color: #eab308; }
        .av-res-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; font-family: 'Montserrat',sans-serif; }
        .av-filtros { display: flex; gap: 6px; flex-wrap: wrap; }
        .av-filtro { padding: 6px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .av-filtro:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .av-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .av-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .av-tabla { width: 100%; border-collapse: collapse; }
        .av-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .av-tabla th { padding: 11px 16px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .av-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .av-tabla tbody tr:last-child { border-bottom: none; }
        .av-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .av-tabla td { padding: 12px 16px; font-size: 13px; vertical-align: middle; }
        .av-nombre { font-weight: 600; color: #fff; }
        .av-url { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px; word-break: break-all; max-width: 320px; }
        .av-url a { color: rgba(200,0,0,0.6); text-decoration: none; }
        .av-url a:hover { color: #cc0000; }
        .av-cat { font-size: 10px; color: rgba(255,255,255,0.4); }
        .av-estado { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; white-space: nowrap; }
        .av-codigo { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; }
        .av-spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid rgba(255,255,255,0.2); border-top-color: rgba(255,255,255,0.6); border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .av-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }
        .av-inactivo { opacity: 0.4; }
      `}</style>

      <div className="av-root">
        <header className="av-topbar">
          <div className="av-topbar-logo"><span>GFI</span>® · Admin</div>
          <a className="av-btn-back" href="/admin">← Panel Admin</a>
        </header>

        <main className="av-content">
          <div className="av-header">
            <h1>Verificar <span>enlaces útiles</span></h1>
            <p>Chequeá el estado de todos los links sin entrar uno por uno. Se verifican de a 5 en paralelo.</p>
          </div>

          <div className="av-acciones">
            <button
              className="av-btn-verificar"
              onClick={verificarTodos}
              disabled={verificando || loading}
            >
              {verificando ? "Verificando..." : "🔍 Verificar todos los links"}
            </button>
            {verificando && (
              <div className="av-progreso-wrap">
                <div className="av-progreso-bar">
                  <div className="av-progreso-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="av-progreso-txt">{progreso} / {enlaces.length} verificados ({pct}%)</div>
              </div>
            )}
          </div>

          {(resumen.ok + resumen.error + resumen.timeout) > 0 && (
            <div className="av-resumen">
              <div className="av-res-item ok">
                <div className="av-res-val ok">{resumen.ok}</div>
                <div className="av-res-label">✓ Funcionando</div>
              </div>
              <div className="av-res-item error">
                <div className="av-res-val error">{resumen.error}</div>
                <div className="av-res-label">✕ Con error</div>
              </div>
              <div className="av-res-item timeout">
                <div className="av-res-val timeout">{resumen.timeout}</div>
                <div className="av-res-label">⏱ Timeout</div>
              </div>
            </div>
          )}

          <div className="av-filtros">
            {[["todos","Todos"],["ok","Funcionando"],["error","Con error"],["timeout","Timeout"],["pendiente","Sin verificar"]].map(([v,l]) => (
              <button key={v} className={`av-filtro${filtro === v ? " activo" : ""}`} onClick={() => setFiltro(v)}>{l}</button>
            ))}
          </div>

          <div className="av-tabla-wrap">
            {loading ? (
              <div className="av-empty">Cargando enlaces...</div>
            ) : filtrados.length === 0 ? (
              <div className="av-empty">No hay enlaces con ese filtro.</div>
            ) : (
              <table className="av-tabla">
                <thead>
                  <tr>
                    <th>Enlace</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(e => (
                    <tr key={e.id} className={!e.activo ? "av-inactivo" : ""}>
                      <td>
                        <div className="av-nombre">{e.nombre}</div>
                        <div className="av-url">
                          <a href={e.url} target="_blank" rel="noopener noreferrer">{e.url}</a>
                        </div>
                      </td>
                      <td>
                        <div className="av-cat">{e.categoria ?? "—"}</div>
                        {e.localidad && <div className="av-cat">{e.localidad}</div>}
                        {!e.activo && <div style={{ fontSize: 9, color: "#ff4444", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, marginTop: 3 }}>INACTIVO</div>}
                      </td>
                      <td>
                        {e.estado === "pendiente" && !verificando && (
                          <span className="av-estado" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                        )}
                        {e.estado === "pendiente" && verificando && (
                          <span className="av-spinner" />
                        )}
                        {e.estado !== "pendiente" && (
                          <>
                            <div className="av-estado" style={{ color: ESTADO_COLOR[e.estado!] }}>
                              {ESTADO_LABEL[e.estado!]}
                              {e.codigo ? ` (${e.codigo})` : ""}
                            </div>
                            {e.mensaje && e.estado !== "ok" && (
                              <div className="av-codigo">{e.mensaje}</div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
