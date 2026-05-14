"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

interface Fuente {
  tipo: "tema";
  titulo: string;
  categoria: string;
  fecha: string;
}

interface Entrada {
  rol: "user" | "assistant";
  texto: string;
  fuentes?: Fuente[];
}

const SUGERENCIAS = [
  "¿Cómo se calculan los honorarios en una venta?",
  "¿Qué dicen los corredores sobre ZonaProp vs Argenprop?",
  "Consejos para captar propiedades exclusivas",
  "¿Cómo manejar clientes que quieren bajar demasiado el precio?",
  "Normativa COCIR sobre publicidad inmobiliaria",
  "¿Cuál es la zona con más demanda en Rosario?",
];

export default function MemoriaColectivaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Entrada[]>([]);
  const [consulta, setConsulta] = useState("");
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historial]);

  async function consultar(texto?: string) {
    const q = (texto ?? consulta).trim();
    if (!q || cargando) return;

    const nueva: Entrada = { rol: "user", texto: q };
    setHistorial(h => [...h, nueva]);
    setConsulta("");
    setCargando(true);

    try {
      const res = await fetch("/api/ia/memoria-colectiva", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ consulta: q }),
      });
      const d = await res.json();
      if (d.error) {
        setHistorial(h => [...h, { rol: "assistant", texto: `Error: ${d.error}` }]);
      } else {
        setHistorial(h => [...h, { rol: "assistant", texto: d.respuesta, fuentes: d.fuentes ?? [] }]);
      }
    } catch {
      setHistorial(h => [...h, { rol: "assistant", texto: "Error de conexión. Intentá nuevamente." }]);
    }
    setCargando(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="text-3xl">🧠</div>
          <div>
            <h1 className="font-bold text-lg">Memoria Colectiva del Foro</h1>
            <p className="text-gray-400 text-xs">Consultá el conocimiento acumulado por la comunidad GFI®</p>
          </div>
        </div>
      </div>

      {/* Conversación */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {historial.length === 0 && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-300 font-semibold mb-1">¿Qué querés saber?</p>
              <p className="text-gray-500 text-sm mb-6">Busco en el historial del Foro GFI® y sintetizo el conocimiento colectivo.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SUGERENCIAS.map(s => (
                  <button
                    key={s}
                    onClick={() => consultar(s)}
                    className="text-left text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-3 text-gray-300 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {historial.map((e, i) => (
            <div key={i} className={`flex ${e.rol === "user" ? "justify-end" : "justify-start"}`}>
              {e.rol === "user" ? (
                <div className="max-w-lg bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
                  {e.texto}
                </div>
              ) : (
                <div className="max-w-2xl flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🧠</span>
                    <span className="text-xs text-gray-400 font-medium">Memoria Colectiva GFI®</span>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-5 py-4 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {e.texto}
                  </div>
                  {e.fuentes && e.fuentes.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-500 font-medium">Fuentes del foro:</p>
                      {e.fuentes.slice(0, 4).map((f, fi) => (
                        <div key={fi} className="flex items-center gap-2 text-xs text-gray-400 bg-gray-900 rounded-lg px-3 py-1.5">
                          <span className="text-gray-500">[{f.categoria}]</span>
                          <span className="truncate">{f.titulo}</span>
                          <span className="text-gray-600 shrink-0">{new Date(f.fecha).toLocaleDateString("es-AR")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {cargando && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-400 flex items-center gap-2">
                <span className="animate-pulse">🧠</span>
                <span>Buscando en el foro...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 bg-gray-900 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            value={consulta}
            onChange={e => setConsulta(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                consultar();
              }
            }}
            placeholder="Consultá el conocimiento del foro... (Enter para enviar)"
            rows={2}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => consultar()}
            disabled={!consulta.trim() || cargando}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 rounded-xl font-semibold transition shrink-0"
          >
            {cargando ? "..." : "↑"}
          </button>
        </div>
        <p className="max-w-3xl mx-auto mt-2 text-xs text-gray-600">
          La IA busca en el historial del Foro GFI® · No reemplaza asesoramiento profesional
        </p>
      </div>
    </div>
  );
}
