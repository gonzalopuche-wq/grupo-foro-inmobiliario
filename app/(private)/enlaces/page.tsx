"use client";

import { useState } from "react";

interface Enlace {
  id: number;
  nombre: string;
  descripcion: string;
  url: string;
  categoria: string;
  localidad?: string;
  destacado?: boolean;
}

const CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "padron", label: "Padrón y Colegios" },
  { id: "impuestos", label: "Impuestos Provinciales" },
  { id: "catastro", label: "Catastro y Registro" },
  { id: "tasas", label: "Tasas Municipales" },
  { id: "servicios", label: "Servicios Públicos" },
  { id: "tramites", label: "Trámites y Portales" },
];

const ENLACES: Enlace[] = [
  // PADRÓN Y COLEGIOS
  { id: 1, nombre: "Padrón COCIR", descripcion: "Consulta del padrón de matriculados del Colegio de Corredores Inmobiliarios de Santa Fe.", url: "https://www.cocir.org.ar", categoria: "padron", localidad: "Rosario", destacado: true },
  { id: 2, nombre: "Canal de Matriculados COCIR", descripcion: "Canal oficial de comunicaciones de COCIR para corredores matriculados.", url: "https://www.cocir.org.ar", categoria: "padron", localidad: "Rosario" },
  { id: 3, nombre: "Consejo Profesional de Ciencias Económicas", descripcion: "Colegio profesional de contadores y economistas.", url: "https://www.cpcesf.org.ar", categoria: "padron" },
  { id: 4, nombre: "Colegio de Arquitectos de Santa Fe", descripcion: "Colegio profesional de arquitectos de la provincia de Santa Fe.", url: "https://www.capsf.org.ar", categoria: "padron" },
  { id: 5, nombre: "Colegio de Profesionales de la Ingeniería Civil", descripcion: "Colegio profesional de ingenieros civiles.", url: "https://www.cpic.org.ar", categoria: "padron" },
  { id: 6, nombre: "Colegio de Farmacéuticos", descripcion: "Colegio profesional de farmacéuticos.", url: "https://www.cofa.org.ar", categoria: "padron" },
  { id: 7, nombre: "Colegio de Bioquímicos", descripcion: "Colegio profesional de bioquímicos.", url: "https://www.colegiobioquimicossf.org.ar", categoria: "padron" },
  { id: 8, nombre: "Colegio de Ingenieros", descripcion: "Colegio profesional de ingenieros.", url: "https://www.cois.org.ar", categoria: "padron" },
  { id: 9, nombre: "Colegio de Odontólogos", descripcion: "Colegio profesional de odontólogos.", url: "https://www.coesf.com.ar", categoria: "padron" },
  { id: 10, nombre: "Colegio de Psicólogos (2da Circ.)", descripcion: "Colegio profesional de psicólogos, 2da Circunscripción.", url: "https://www.cppsf.org.ar", categoria: "padron" },
  { id: 11, nombre: "Colegio de Kinesiólogos", descripcion: "Colegio profesional de kinesiólogos.", url: "https://www.cokisf.org.ar", categoria: "padron" },

  // IMPUESTOS PROVINCIALES (API)
  { id: 12, nombre: "API — Ver deuda provincial", descripcion: "Consulta y liquidación de deuda de impuestos provinciales (API) para Rosario.", url: "https://www.santafe.gov.ar/index.php/web/content/view/full/93532", categoria: "impuestos", localidad: "Rosario", destacado: true },
  { id: 13, nombre: "API — Boletas provinciales", descripcion: "Impresión de boletas de impuestos provinciales (API) del Gobierno de Santa Fe.", url: "https://www.santafe.gov.ar/index.php/web/content/view/full/93532", categoria: "impuestos" },
  { id: 14, nombre: "API — Boletas (Rosario)", descripcion: "Impresión de boletas de impuestos provinciales (API) para residentes de Rosario.", url: "https://www.santafe.gov.ar/index.php/web/content/view/full/93532", categoria: "impuestos", localidad: "Rosario" },
  { id: 15, nombre: "API — Deuda provincial", descripcion: "Consulta y liquidación de deuda de impuestos provinciales (API).", url: "https://www.santafe.gov.ar/index.php/web/content/view/full/93532", categoria: "impuestos" },

  // CATASTRO Y REGISTRO
  { id: 16, nombre: "Partida Inmobiliaria / Año Plano Mensura (Provincial)", descripcion: "Consulta de datos catastrales provinciales como el número de partida inmobiliaria y el año del plano de mensura.", url: "https://www.santafe.gov.ar/index.php/web/content/view/full/93532", categoria: "catastro", destacado: true },
  { id: 17, nombre: "Registro de la Propiedad / Informes", descripcion: "Acceso al sistema de informes y trámites del Registro General de la Propiedad. Requiere login.", url: "https://www.registrosantafe.gob.ar", categoria: "catastro", destacado: true },
  { id: 18, nombre: "Catastro Municipal de Rosario", descripcion: "Portal de la Municipalidad de Rosario para trámites e información relacionada con Catastro.", url: "https://www.rosario.gob.ar/web/servicios/informacion-sobre-inmuebles/catastro", categoria: "catastro", localidad: "Rosario", destacado: true },
  { id: 19, nombre: "Infomapa (Municipal)", descripcion: "Mapa interactivo de la Municipalidad de Rosario con información urbana y catastral.", url: "https://infomapa.rosario.gob.ar", categoria: "catastro", localidad: "Rosario" },
  { id: 20, nombre: "Consulta Partida Inmobiliaria / Año Plano Mensura", descripcion: "Consulta provincial de datos de la partida inmobiliaria y año del plano de mensura.", url: "https://www.santafe.gov.ar/index.php/web/content/view/full/93532", categoria: "catastro" },
  { id: 21, nombre: "SIRE — Inhibición", descripcion: "Consulta de inhibiciones en el Registro de la Propiedad de Santa Fe.", url: "https://www.registrosantafe.gob.ar", categoria: "catastro" },

  // TASAS MUNICIPALES
  { id: 22, nombre: "Tasa General de Inmuebles (TGI) — Rosario", descripcion: "Enlace municipal de Rosario para imprimir y pagar la Tasa General de Inmuebles.", url: "https://www.rosario.gob.ar/web/servicios/tributos/tasa-general-de-inmuebles", categoria: "tasas", localidad: "Rosario", destacado: true },
  { id: 23, nombre: "Pago TGI online (opciones digitales)", descripcion: "Sección con las diferentes opciones y métodos digitales para pagar la Tasa General de Inmuebles de Funes.", url: "https://www.funes.gob.ar", categoria: "tasas", localidad: "Funes" },
  { id: 24, nombre: "Certificado Urbanístico — Rosario", descripcion: "Solicitud online de certificados urbanísticos en la Municipalidad de Rosario.", url: "https://www.rosario.gob.ar/web/servicios/urbanismo/certificado-urbanistico", categoria: "tasas", localidad: "Rosario", destacado: true },
  { id: 25, nombre: "Trámites municipales (TGI) — Funes", descripcion: "Portal de trámites de la Municipalidad de Funes, incluyendo el pago de diversas tasas e impuestos locales.", url: "https://www.funes.gob.ar", categoria: "tasas", localidad: "Funes" },
  { id: 26, nombre: "Trámites online municipales — Roldán", descripcion: "Portal de trámites de la Municipalidad de Roldán para la gestión de tasas municipales y patentes, incluyendo API.", url: "https://www.roldan.gob.ar", categoria: "tasas", localidad: "Roldán" },
  { id: 27, nombre: "Trámites y gestión de tasas — Villa Constitución", descripcion: "Portal de autogestión y trámites online de la Municipalidad de Villa Constitución para tasas y tributos.", url: "https://www.villaconstitución.gob.ar", categoria: "tasas", localidad: "Villa Constitución" },

  // SERVICIOS PÚBLICOS
  { id: 28, nombre: "EPE — Oficina Virtual", descripcion: "Acceso a la oficina virtual de la EPE (Empresa Provincial de la Energía) para consultas y trámites de luz.", url: "https://www.epe.santafe.gob.ar", categoria: "servicios", destacado: true },
  { id: 29, nombre: "Aguas Santafesinas — Oficina Virtual", descripcion: "Acceso a la oficina virtual de ASSA para gestiones, consultas y pago de boletas del servicio de agua.", url: "https://www.aguassantafesinas.com.ar", categoria: "servicios", destacado: true },
  { id: 30, nombre: "Litoral Gas — Oficina Virtual", descripcion: "Acceso al portal de autogestión de Litoral Gas para consultas de consumo, facturas y trámites.", url: "https://www.litoralgas.com.ar", categoria: "servicios", destacado: true },
  { id: 31, nombre: "COPROL — Agua Potable Roldán", descripcion: "Sitio web de la Cooperativa de Provisión de Agua Potable, Servicios Públicos y Obras de Roldán.", url: "https://www.coprol.com.ar", categoria: "servicios", localidad: "Roldán" },

  // TRÁMITES Y PORTALES
  { id: 32, nombre: "Portal Provincial de Trámites e Impuestos", descripcion: "Portal principal del Gobierno de Santa Fe para acceder a diversos trámites, boletas, catastro y licitaciones.", url: "https://www.santafe.gob.ar", categoria: "tramites", destacado: true },
  { id: 33, nombre: "Impresión de boletas para licencia de conducir", descripcion: "Generación de boletas de pago para la obtención o renovación de la licencia de conducir.", url: "https://www.santafe.gov.ar", categoria: "tramites" },
  { id: 34, nombre: "Consulta e impresión de multas de tránsito", descripcion: "Sistema provincial para verificar la existencia e imprimir boletas de pago de multas de tránsito.", url: "https://www.santafe.gov.ar", categoria: "tramites" },
  { id: 35, nombre: "Reclamos ciudadanos (arbolado municipal)", descripcion: "Plataforma para la presentación de reclamos y pedidos sobre servicios públicos y arbolado municipal de Rosario.", url: "https://www.rosario.gob.ar", categoria: "tramites", localidad: "Rosario" },
];

const LOCALIDADES = ["Todas", "Rosario", "Funes", "Roldán", "Villa Constitución"];

export default function EnlacesPage() {
  const [catActiva, setCatActiva] = useState("todos");
  const [localidad, setLocalidad] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");

  const enlacesFiltrados = ENLACES.filter(e => {
    if (catActiva !== "todos" && e.categoria !== catActiva) return false;
    if (localidad !== "Todas" && e.localidad !== localidad) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      if (!e.nombre.toLowerCase().includes(q) && !e.descripcion.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const destacados = enlacesFiltrados.filter(e => e.destacado);
  const resto = enlacesFiltrados.filter(e => !e.destacado);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .enl-layout { display: grid; grid-template-columns: 200px 1fr; gap: 24px; align-items: start; }
        /* SIDEBAR */
        .enl-side { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 80px; }
        .enl-side-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .enl-side-title { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .enl-side-item { padding: 9px 14px; cursor: pointer; transition: all 0.15s; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; color: rgba(255,255,255,0.5); }
        .enl-side-item:last-child { border-bottom: none; }
        .enl-side-item:hover { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.8); }
        .enl-side-item.active { background: rgba(200,0,0,0.08); color: #fff; border-left: 2px solid #cc0000; font-weight: 600; }
        /* MAIN */
        .enl-main { display: flex; flex-direction: column; gap: 16px; }
        /* TOPBAR */
        .enl-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .enl-search { flex: 1; position: relative; min-width: 200px; }
        .enl-search input { width: 100%; padding: 9px 14px 9px 34px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter',sans-serif; }
        .enl-search input:focus { border-color: rgba(200,0,0,0.4); }
        .enl-search input::placeholder { color: rgba(255,255,255,0.2); }
        .enl-search-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 12px; color: rgba(255,255,255,0.3); }
        .enl-loc-select { padding: 9px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; outline: none; font-family: 'Inter',sans-serif; cursor: pointer; }
        .enl-count { font-size: 11px; color: rgba(255,255,255,0.25); white-space: nowrap; }
        /* SECCIÓN */
        .enl-seccion-titulo { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 8px; }
        .enl-seccion-titulo::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        /* GRID */
        .enl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        /* CARD */
        .enl-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s; text-decoration: none; cursor: pointer; }
        .enl-card:hover { border-color: rgba(200,0,0,0.3); background: rgba(14,14,14,1); transform: translateY(-1px); }
        .enl-card.destacado { border-color: rgba(200,0,0,0.2); background: rgba(200,0,0,0.03); }
        .enl-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .enl-card-nombre { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #fff; line-height: 1.4; flex: 1; }
        .enl-card-destacado-ico { font-size: 11px; color: #eab308; flex-shrink: 0; }
        .enl-card-desc { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.5; }
        .enl-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
        .enl-cat-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; }
        .enl-loc-badge { font-size: 9px; color: rgba(255,255,255,0.25); }
        .enl-arrow { font-size: 12px; color: rgba(200,0,0,0.5); }
        .enl-card:hover .enl-arrow { color: #cc0000; }
        /* EMPTY */
        .enl-empty { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        @media (max-width: 900px) { .enl-layout { grid-template-columns: 1fr; } .enl-side { position: static; flex-direction: row; overflow-x: auto; } .enl-side-box { min-width: 160px; } }
        @media (max-width: 600px) { .enl-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="enl-layout">
        {/* SIDEBAR */}
        <aside className="enl-side">
          <div className="enl-side-box">
            <div className="enl-side-title">Categorías</div>
            {CATEGORIAS.map(c => (
              <div key={c.id} className={`enl-side-item${catActiva === c.id ? " active" : ""}`} onClick={() => setCatActiva(c.id)}>
                {c.label}
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <div className="enl-main">
          {/* TOPBAR */}
          <div className="enl-topbar">
            <div className="enl-search">
              <span className="enl-search-ico">🔍</span>
              <input placeholder="Buscar enlaces..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <select className="enl-loc-select" value={localidad} onChange={e => setLocalidad(e.target.value)}>
              {LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <span className="enl-count">{enlacesFiltrados.length} enlaces</span>
          </div>

          {enlacesFiltrados.length === 0 && (
            <div className="enl-empty">No hay enlaces con esos filtros.</div>
          )}

          {/* DESTACADOS */}
          {destacados.length > 0 && (
            <>
              <div className="enl-seccion-titulo">⭐ Más usados</div>
              <div className="enl-grid">
                {destacados.map(e => (
                  <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="enl-card destacado">
                    <div className="enl-card-top">
                      <div className="enl-card-nombre">{e.nombre}</div>
                      <span className="enl-card-destacado-ico">★</span>
                    </div>
                    <div className="enl-card-desc">{e.descripcion}</div>
                    <div className="enl-card-footer">
                      <span className="enl-cat-badge">{CATEGORIAS.find(c => c.id === e.categoria)?.label}</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {e.localidad && <span className="enl-loc-badge">📍 {e.localidad}</span>}
                        <span className="enl-arrow">↗</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          {/* RESTO */}
          {resto.length > 0 && (
            <>
              {destacados.length > 0 && <div className="enl-seccion-titulo">Todos los enlaces</div>}
              <div className="enl-grid">
                {resto.map(e => (
                  <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="enl-card">
                    <div className="enl-card-top">
                      <div className="enl-card-nombre">{e.nombre}</div>
                    </div>
                    <div className="enl-card-desc">{e.descripcion}</div>
                    <div className="enl-card-footer">
                      <span className="enl-cat-badge">{CATEGORIAS.find(c => c.id === e.categoria)?.label}</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {e.localidad && <span className="enl-loc-badge">📍 {e.localidad}</span>}
                        <span className="enl-arrow">↗</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
