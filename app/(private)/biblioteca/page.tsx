"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Documento {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  url: string;
  tipo_archivo: string;
  destacado: boolean;
  activo: boolean;
  created_at: string;
  orden: number;
  perfiles?: { nombre: string; apellido: string };
}

const CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "contratos", label: "Modelos de Contratos" },
  { id: "normativa", label: "Normativa y Leyes" },
  { id: "guias", label: "Guías y Manuales" },
  { id: "formularios", label: "Formularios" },
  { id: "jurisprudencia", label: "Jurisprudencia" },
  { id: "otros", label: "Otros" },
];

const TIPO_ICONO: Record<string, string> = {
  pdf: "📄",
  word: "📝",
  excel: "📊",
  imagen: "🖼️",
  link: "🔗",
  otro: "📎",
};

const TIPO_COLOR: Record<string, string> = {
  pdf: "#ff4444",
  word: "#60a5fa",
  excel: "#22c55e",
  imagen: "#c084fc",
  link: "#38bdf8",
  otro: "rgba(255,255,255,0.4)",
};

export default function BibliotecaPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [catActiva, setCatActiva] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [vacio, setVacio] = useState(false);

  useEffect(() => {
    cargarDocumentos();
  }, []);

  const cargarDocumentos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("biblioteca_documentos")
      .select("*, perfiles(nombre, apellido)")
      .eq("activo", true)
      .order("destacado", { ascending: false })
      .order("orden");

    if (error || !data) {
      setVacio(true);
      setLoading(false);
      return;
    }

    setDocumentos(data as unknown as Documento[]);
    setVacio(data.length === 0);
    setLoading(false);
  };

  const docsFiltrados = documentos.filter(d => {
    if (catActiva !== "todos" && d.categoria !== catActiva) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (
        d.titulo.toLowerCase().includes(q) ||
        (d.descripcion ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const destacados = docsFiltrados.filter(d => d.destacado);
  const resto = docsFiltrados.filter(d => !d.destacado);

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <style>{`
        .bib-search-bar { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .bib-search-input { flex: 1; min-width: 220px; padding: 9px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .bib-search-input:focus { border-color: rgba(200,0,0,0.4); }
        .bib-search-input::placeholder { color: rgba(255,255,255,0.2); }
        .bib-cats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
        .bib-cat { padding: 7px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .bib-cat:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .bib-cat.active { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .bib-sec-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.2); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .bib-sec-titulo::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .bib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 24px; }
        .bib-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.2s, transform 0.15s; text-decoration: none; cursor: pointer; }
        .bib-card:hover { border-color: rgba(200,0,0,0.3); transform: translateY(-2px); }
        .bib-card.destacado { border-color: rgba(200,0,0,0.2); background: rgba(200,0,0,0.04); position: relative; overflow: hidden; }
        .bib-card.destacado::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #cc0000, transparent); }
        .bib-card-top { display: flex; align-items: flex-start; gap: 12px; }
        .bib-tipo-icon { font-size: 24px; line-height: 1; flex-shrink: 0; }
        .bib-card-titulo { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: #fff; line-height: 1.3; }
        .bib-card-desc { font-size: 12px; color: rgba(255,255,255,0.45); line-height: 1.5; }
        .bib-card-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: auto; }
        .bib-cat-badge { font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; white-space: nowrap; }
        .bib-fecha { font-size: 10px; color: rgba(255,255,255,0.25); }
        .bib-tipo-badge { font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; font-family: 'Montserrat', sans-serif; }
        .bib-btn-ver { padding: 6px 14px; border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.3); color: #cc0000; text-decoration: none; transition: all 0.2s; white-space: nowrap; }
        .bib-btn-ver:hover { background: rgba(200,0,0,0.2); color: #fff; }
        .bib-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 32px; gap: 16px; }
        .bib-empty-icon { font-size: 48px; opacity: 0.3; }
        .bib-empty-titulo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.3); }
        .bib-empty-sub { font-size: 13px; color: rgba(255,255,255,0.2); text-align: center; max-width: 360px; line-height: 1.5; }
        .bib-count { font-size: 11px; color: rgba(255,255,255,0.25); margin-bottom: 14px; }
        @media (max-width: 600px) { .bib-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Barra de búsqueda */}
      <div className="bib-search-bar">
        <input
          className="bib-search-input"
          placeholder="Buscar documentos..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {/* Categorías */}
      <div className="bib-cats">
        {CATEGORIAS.map(c => (
          <button
            key={c.id}
            className={`bib-cat${catActiva === c.id ? " active" : ""}`}
            onClick={() => setCatActiva(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "64px 32px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
          Cargando documentos...
        </div>
      ) : vacio ? (
        <div className="bib-empty-state">
          <div className="bib-empty-icon">📚</div>
          <div className="bib-empty-titulo">Biblioteca en construcción</div>
          <div className="bib-empty-sub">
            Próximamente encontrarás aquí modelos de contratos, normativa, guías y
            recursos útiles para la actividad inmobiliaria.
          </div>
        </div>
      ) : docsFiltrados.length === 0 ? (
        <div className="bib-empty-state">
          <div className="bib-empty-icon">🔍</div>
          <div className="bib-empty-titulo">Sin resultados</div>
          <div className="bib-empty-sub">No se encontraron documentos para la búsqueda o categoría seleccionada.</div>
        </div>
      ) : (
        <>
          <div className="bib-count">{docsFiltrados.length} documento{docsFiltrados.length !== 1 ? "s" : ""}</div>

          {destacados.length > 0 && (
            <>
              <div className="bib-sec-titulo">⭐ Destacados</div>
              <div className="bib-grid">
                {destacados.map(doc => (
                  <DocCard key={doc.id} doc={doc} formatFecha={formatFecha} />
                ))}
              </div>
            </>
          )}

          {resto.length > 0 && (
            <>
              {destacados.length > 0 && <div className="bib-sec-titulo">Todos los documentos</div>}
              <div className="bib-grid">
                {resto.map(doc => (
                  <DocCard key={doc.id} doc={doc} formatFecha={formatFecha} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function DocCard({ doc, formatFecha }: { doc: Documento; formatFecha: (s: string) => string }) {
  const catLabel = [
    { id: "contratos", label: "Contratos" },
    { id: "normativa", label: "Normativa" },
    { id: "guias", label: "Guías" },
    { id: "formularios", label: "Formularios" },
    { id: "jurisprudencia", label: "Jurisprudencia" },
    { id: "otros", label: "Otros" },
  ].find(c => c.id === doc.categoria)?.label ?? doc.categoria;

  const icono = TIPO_ICONO[doc.tipo_archivo] ?? "📎";
  const color = TIPO_COLOR[doc.tipo_archivo] ?? "rgba(255,255,255,0.4)";

  return (
    <div className={`bib-card${doc.destacado ? " destacado" : ""}`}>
      <div className="bib-card-top">
        <div className="bib-tipo-icon">{icono}</div>
        <div style={{ flex: 1 }}>
          <div className="bib-card-titulo">{doc.titulo}</div>
          {doc.perfiles && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
              {doc.perfiles.apellido}, {doc.perfiles.nombre}
            </div>
          )}
        </div>
      </div>
      {doc.descripcion && <div className="bib-card-desc">{doc.descripcion}</div>}
      <div className="bib-card-footer">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="bib-cat-badge">{catLabel}</span>
          <span
            className="bib-tipo-badge"
            style={{
              background: `${color}18`,
              border: `1px solid ${color}40`,
              color,
            }}
          >
            {doc.tipo_archivo.toUpperCase()}
          </span>
          <span className="bib-fecha">{formatFecha(doc.created_at)}</span>
        </div>
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bib-btn-ver"
          onClick={e => e.stopPropagation()}
        >
          Ver →
        </a>
      </div>
    </div>
  );
}
