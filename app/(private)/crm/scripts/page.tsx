"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Script {
  id: string;
  categoria: string;
  titulo: string;
  subtitulo: string;
  icono: string;
  duracion: string;
  objetivo: string;
  pasos: { titulo: string; guion: string; tips?: string }[];
  objeciones?: { objecion: string; respuesta: string }[];
}

// ── Scripts ──────────────────────────────────────────────────────────────────

const SCRIPTS: Script[] = [
  {
    id: "primer_contacto_comprador",
    categoria: "Captación compradores",
    titulo: "Primer contacto con comprador",
    subtitulo: "Cuando llama por una propiedad publicada",
    icono: "📞",
    duracion: "3-5 min",
    objetivo: "Calificar al prospecto y agendar una visita",
    pasos: [
      { titulo: "Presentación", guion: "Buen día / buenas tardes, habla [NOMBRE] de Grupo Foro Inmobiliario. ¿Con quién tengo el gusto?", tips: "Siempre identificate y pedí el nombre. Usá el nombre del interlocutor durante toda la llamada." },
      { titulo: "Confirmar interés", guion: "Llamo en respuesta a su consulta por la propiedad en [DIRECCIÓN/ZONA]. ¿Sigue vigente su interés?", tips: "Si dice que sí, continuá. Si ya resolvió, pedí referencias." },
      { titulo: "Calificación", guion: "Para poder ayudarle mejor, ¿me podría contar un poco más sobre lo que está buscando? ¿Es para vivienda propia o inversión? ¿Tiene algún rango de precio en mente? ¿Está mirando otras zonas también?", tips: "Escuchá más de lo que hablás. Tomá nota del presupuesto, zona y timeline." },
      { titulo: "Presentar solución", guion: "Perfecto. Tenemos esa propiedad y además otras opciones que pueden interesarle según lo que me comentó. ¿Cuándo podría ser buen momento para que la/lo acompañe a verla?", tips: "Ofrecer alternativas muestra que tenés cartera. No presiones, proponé dos opciones de horario." },
      { titulo: "Cierre de llamada", guion: "Muy bien, quedamos para [DÍA] a las [HORA]. Le voy a mandar la ubicación y mis datos por WhatsApp. ¿A qué número le escribo?", tips: "Siempre confirmar la visita y conseguir el WhatsApp." },
    ],
    objeciones: [
      { objecion: "Ya lo vi y no me interesó", respuesta: "Entiendo, ¿qué fue lo que no terminó de convencerle? Así le puedo mostrar algo más ajustado a lo que busca." },
      { objecion: "No tengo tiempo ahora", respuesta: "Sin problema, ¿me puede dar 30 segundos solo para saber si vale la pena coordinar? Si no es lo que busca, no le roba más tiempo." },
      { objecion: "Ya tengo inmobiliaria", respuesta: "Perfecto, no hay exclusividad para comprar. Si quiere podemos coordinar una visita de todas formas, a veces una segunda opinión es útil." },
    ],
  },
  {
    id: "captacion_vendedor",
    categoria: "Captación propietarios",
    titulo: "Captación de propiedad",
    subtitulo: "Llamada a propietario que publicó sin inmobiliaria",
    icono: "🏠",
    duracion: "5-8 min",
    objetivo: "Conseguir una reunión de tasación/captación",
    pasos: [
      { titulo: "Presentación y gancho", guion: "Hola [NOMBRE], habla [NOMBRE AGENTE] de Grupo Foro Inmobiliario. Vi que tiene publicada su propiedad en [PORTAL]. ¿Sigue disponible?", tips: "Sé directo. No preguntes si 'tiene un momento', simplemente avanzá." },
      { titulo: "Credencializar", guion: "Tenemos compradores activos buscando en su zona con el perfil de su propiedad. Por eso quería ponerme en contacto. ¿Está trabajando con alguna inmobiliaria en este momento?", tips: "Si tiene inmobiliaria exclusiva, agradecé y retirarte. Si no, continuar." },
      { titulo: "Propuesta de valor", guion: "Lo que hacemos en Foro es acompañarlo en todo el proceso: desde la tasación, hasta la publicación en todos los portales, coordinación de visitas y el proceso de escrituración. ¿Le gustaría que le hagamos una tasación profesional sin compromiso?", tips: "No vendas servicios genéricos. Mencioná algo específico del mercado de su zona." },
      { titulo: "Objeción precio", guion: "Entiendo que tiene un precio en mente. Lo que nos diferencia es que hacemos una tasación basada en operaciones reales cerradas en la zona, no solo publicaciones. Eso nos permite acercarnos mucho al valor real de mercado.", tips: "Si pregunta cuánto vale, no des número por teléfono. Eso se hace en la visita." },
      { titulo: "Agendar reunión", guion: "¿Cuándo podría pasar por su propiedad para hacerle la tasación? Le lleva no más de 45 minutos y se va con un informe detallado del mercado.", tips: "Proponer dos opciones de horario cierra mejor que una pregunta abierta." },
    ],
    objeciones: [
      { objecion: "Lo vendo yo solo", respuesta: "Perfectamente, muchos propietarios lo intentan primero solos. ¿Tiene claro cuánto tiempo tiene disponible para atender visitas, filtrar compradores y manejar la negociación?" },
      { objecion: "Ya tuve malas experiencias con inmobiliarias", respuesta: "Lo entiendo, y lo valoro que me lo cuente. ¿Me puede decir qué fue lo que falló? Así le puedo mostrar cómo trabajamos nosotros diferente." },
      { objecion: "No quiero pagar comisión", respuesta: "La comisión la pagan ambas partes y está contemplada en el precio de venta. Lo que nos diferencia es que le traemos compradores calificados, no paseantes." },
    ],
  },
  {
    id: "seguimiento_30dias",
    categoria: "Seguimiento",
    titulo: "Seguimiento 30 días sin cierre",
    subtitulo: "Contacto con comprador activo que lleva 30+ días buscando",
    icono: "📡",
    duracion: "3-4 min",
    objetivo: "Reactiva el contacto y detectá cambios en búsqueda",
    pasos: [
      { titulo: "Reactivación", guion: "Hola [NOMBRE], habla [AGENTE]. ¿Cómo está? Lo llamo porque seguimos buscando alternativas para usted.", tips: "No empieces con disculpas. Muestra proactividad." },
      { titulo: "Detectar cambios", guion: "¿Sigue con los mismos parámetros de búsqueda o algo cambió? A veces el presupuesto, la zona o el tipo de propiedad se ajusta con el tiempo.", tips: "Escuchar activamente. Si cambió algo, es una oportunidad nueva." },
      { titulo: "Informar novedades", guion: "Justo tenemos una propiedad nueva que entró esta semana en [ZONA] que podría interesarle. ¿Le cuento brevemente?", tips: "Siempre tener algo nuevo para ofrecer. Si no hay novedad, mejor esperar." },
      { titulo: "Reagendar visita", guion: "¿Cuándo podría ser un buen momento para ir a verla? O si prefiere, le mando las fotos y el detalle primero por WhatsApp.", tips: "Dar opciones. No todos están listos para visitar de nuevo." },
    ],
    objeciones: [
      { objecion: "Todavía estamos analizando", respuesta: "Perfecto, cuánto tiempo más aproximadamente se dan para la decisión? Así me manejo yo con los plazos." },
      { objecion: "El mercado está caro", respuesta: "Tiene razón en que subió. ¿Ajustó el presupuesto o preferiría esperar? Puedo alertarle cuando aparezca algo en su rango original." },
    ],
  },
  {
    id: "oferta_baja",
    categoria: "Negociación",
    titulo: "Presentar oferta baja al vendedor",
    subtitulo: "Cuando el comprador ofrece bastante por debajo del pedido",
    icono: "💰",
    duracion: "5-10 min",
    objetivo: "Presentar la oferta y conseguir una contraoferta razonable",
    pasos: [
      { titulo: "Contexto previo", guion: "Le llamo porque tenemos una oferta concreta por su propiedad. Antes de comunicársela, quería prepararlo un poco para el contexto de mercado actual.", tips: "Nunca dar el número sin contexto. La preparación evita reacciones negativas." },
      { titulo: "Dar contexto", guion: "En los últimos meses, las propiedades similares en su zona están cerrando entre un 8 y 12% por debajo del precio de publicación. El comprador que tenemos es serio y tiene los fondos listos.", tips: "Usar datos reales de la zona. La seriedad del comprador es un argumento clave." },
      { titulo: "Presentar la oferta", guion: "La oferta es de USD [MONTO]. Sé que está por debajo de su expectativa inicial, pero es una oferta en firme con fondos disponibles y plazo de escrituración en [PLAZO].", tips: "Decir el número con claridad. No lo suavices demasiado." },
      { titulo: "Escuchar y contener", guion: "¿Cómo lo ve? Cuénteme. No necesito respuesta hoy mismo si prefiere pensarlo.", tips: "Dejar espacio para la reacción. No defiendes la oferta, la presentás." },
      { titulo: "Buscar acuerdo", guion: "¿Habría algún número que para usted tenga más sentido y que podamos transmitirle al comprador? A veces la diferencia es menor de lo que parece.", tips: "El objetivo no es aceptar o rechazar. Es conseguir una contraoferta." },
    ],
    objeciones: [
      { objecion: "Eso es una oferta ridícula", respuesta: "Lo entiendo, y no estoy acá para convencerlo de aceptar algo que no le cierra. ¿Cuál sería el número mínimo que para usted tendría sentido?" },
      { objecion: "Voy a esperar otro comprador", respuesta: "Es su decisión. ¿Tiene en mente cuánto tiempo más está dispuesto a esperar? A veces cerrar hoy tiene valor que no siempre se recupera esperando." },
    ],
  },
  {
    id: "cierre_escritura",
    categoria: "Cierre",
    titulo: "Coordinación de escritura",
    subtitulo: "Guía para la llamada de coordinación con ambas partes",
    icono: "✍️",
    duracion: "8-12 min (dos llamadas)",
    objetivo: "Confirmar fechas, documentación y escribano",
    pasos: [
      { titulo: "Llamada a vendedor", guion: "Le llamo porque ya tenemos todo acordado y podemos avanzar con la escritura. ¿Ya eligió escribano? Si prefiere, trabajamos con [ESCRIBANO DE CONFIANZA] que ya conoce el proceso.", tips: "Si el vendedor elige escribano, asegurarte de que sea compatible con el comprador." },
      { titulo: "Confirmar documentación", guion: "Vamos a necesitar: DNI vigente de todos los firmantes, título de propiedad original, libre deuda de TGI y expensas, y el informe de dominio actualizado. ¿Tiene todo eso a mano?", tips: "Repasar el checklist de documentación. Si falta algo, aclararlo antes de la fecha." },
      { titulo: "Proponer fecha", guion: "¿Qué semana le viene mejor para la escritura? El escribano tiene disponibilidad los [DÍAS].", tips: "Siempre proponer opciones concretas, no preguntas abiertas." },
      { titulo: "Confirmar fondos", guion: "Y del lado del comprador, ¿van a necesitar gestionar alguna transferencia bancaria o llevan en efectivo? Eso hay que coordinarlo con el escribano para que todo esté preparado.", tips: "Este punto es crítico. Los fondos definen la logística de la escritura." },
      { titulo: "Cierre de llamada", guion: "Perfecto. Les voy a mandar a ambas partes un resumen por WhatsApp con la fecha, el escribano y la lista de documentos. ¿Alguna duda?", tips: "Siempre terminar enviando el resumen escrito." },
    ],
  },
  {
    id: "referido",
    categoria: "Captación compradores",
    titulo: "Llamada por referido",
    subtitulo: "Cuando alguien nos llama porque lo recomendó un cliente anterior",
    icono: "👥",
    duracion: "4-6 min",
    objetivo: "Establecer vínculo y calificar necesidad",
    pasos: [
      { titulo: "Identificar el referido", guion: "Hola [NOMBRE], habla [AGENTE] de Foro Inmobiliario. Me contó [NOMBRE REFERENTE] que podría necesitar ayuda. ¿Es así?", tips: "Mencionar el nombre del referente genera confianza inmediata." },
      { titulo: "Agradecer y validar", guion: "Me alegra que [REFERENTE] me haya recomendado, siempre es un honor. ¿Me puede contar qué es lo que está buscando?", tips: "No seas genérico. La referencia es tu mejor activo — usala." },
      { titulo: "Calificar", guion: "¿Es para compra, alquiler o venta de una propiedad suya? ¿Tiene algún plazo en mente o todavía está en etapa de exploración?", tips: "Calificar suavemente. No es un interrogatorio." },
      { titulo: "Proponer siguiente paso", guion: "Perfecto. ¿Qué le parece si coordinamos para esta semana así le muestro lo que tenemos disponible? Tengo [DÍA] a las [HORA] libre.", tips: "Si es venta, proponer primero una tasación. Si es compra, proponer visita o envío de opciones." },
    ],
  },
];

const CATEGORIAS = Array.from(new Set(SCRIPTS.map(s => s.categoria)));

// ── Componente ───────────────────────────────────────────────────────────────

export default function ScriptsLlamada() {
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos");
  const [scriptSeleccionado, setScriptSeleccionado] = useState<Script | null>(null);
  const [pasoActivo, setPasoActivo] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [modoEnsayo, setModoEnsayo] = useState(false);

  const filtrados = useMemo(() => {
    return SCRIPTS.filter(s => {
      if (categoriaFiltro !== "todos" && s.categoria !== categoriaFiltro) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        return s.titulo.toLowerCase().includes(q) || s.subtitulo.toLowerCase().includes(q) || s.categoria.toLowerCase().includes(q);
      }
      return true;
    });
  }, [categoriaFiltro, busqueda]);

  function abrirScript(script: Script) {
    setScriptSeleccionado(script);
    setPasoActivo(0);
    setModoEnsayo(false);
  }

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "var(--gfi-bg-secondary)", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "var(--font-display)", fontWeight: 800 }}>📞 Scripts de Llamada</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Guiones y objeciones para cada etapa del proceso</p>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>
        {/* Sidebar */}
        <div style={{ width: 320, borderRight: "1px solid #222", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar script..." style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }}>
              <option value="todos">Todas las categorías</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtrados.map(script => {
              const sel = scriptSeleccionado?.id === script.id;
              return (
                <div
                  key={script.id}
                  onClick={() => abrirScript(script)}
                  style={{
                    padding: "14px 16px", borderBottom: "1px solid #111", cursor: "pointer",
                    background: sel ? "#99000015" : "transparent",
                    borderLeft: sel ? "3px solid #990000" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{script.icono}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: sel ? "#fff" : "#ccc" }}>{script.titulo}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{script.subtitulo}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 10, background: "#1a1a1a", color: "#888", padding: "1px 6px", borderRadius: 4 }}>{script.categoria}</span>
                    <span style={{ fontSize: 10, color: "#555" }}>⏱ {script.duracion}</span>
                    <span style={{ fontSize: 10, color: "#555" }}>{script.pasos.length} pasos</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel principal */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!scriptSeleccionado ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "#666" }}>
              <span style={{ fontSize: 48 }}>📞</span>
              <p style={{ margin: 0 }}>Seleccioná un script del panel izquierdo</p>
            </div>
          ) : (
            <div style={{ padding: "28px", maxWidth: 700 }}>
              {/* Header script */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 32 }}>{scriptSeleccionado.icono}</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontFamily: "var(--font-display)", fontWeight: 800 }}>{scriptSeleccionado.titulo}</h2>
                    <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{scriptSeleccionado.subtitulo}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#990000", background: "#99000015", padding: "3px 10px", borderRadius: 6 }}>{scriptSeleccionado.categoria}</span>
                  <span style={{ fontSize: 12, color: "#888" }}>⏱ {scriptSeleccionado.duracion}</span>
                  <span style={{ fontSize: 12, color: "#888" }}>🎯 {scriptSeleccionado.objetivo}</span>
                  <button
                    onClick={() => setModoEnsayo(!modoEnsayo)}
                    style={{
                      marginLeft: "auto", background: modoEnsayo ? "#990000" : "#1a1a1a", border: "1px solid #333",
                      borderRadius: 6, color: "#fff", padding: "6px 14px", fontSize: 12, cursor: "pointer",
                      fontFamily: "var(--font-display)", fontWeight: 700,
                    }}
                  >
                    {modoEnsayo ? "✓ Modo ensayo activo" : "🎭 Modo ensayo"}
                  </button>
                </div>
              </div>

              {/* Pasos */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  {scriptSeleccionado.pasos.map((paso, i) => (
                    <button
                      key={i}
                      onClick={() => setPasoActivo(i)}
                      style={{
                        padding: "4px 12px", fontSize: 12, borderRadius: 20, cursor: "pointer",
                        background: pasoActivo === i ? "#990000" : "#1a1a1a",
                        border: `1px solid ${pasoActivo === i ? "#990000" : "#333"}`,
                        color: pasoActivo === i ? "#fff" : "#888",
                        fontFamily: "var(--font-display)", fontWeight: 700,
                      }}
                    >
                      {i + 1}. {paso.titulo}
                    </button>
                  ))}
                </div>

                {scriptSeleccionado.pasos.map((paso, i) => (
                  <div
                    key={i}
                    style={{
                      display: modoEnsayo ? (pasoActivo === i ? "block" : "none") : "block",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{
                      background: pasoActivo === i ? "var(--gfi-bg-secondary)" : "var(--gfi-bg-primary)",
                      border: `1px solid ${pasoActivo === i ? "#990000" : "#1a1a1a"}`,
                      borderRadius: 10, padding: "16px 20px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onClick={() => setPasoActivo(i)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", background: pasoActivo === i ? "#990000" : "#1a1a1a",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
                          color: pasoActivo === i ? "#fff" : "#666",
                        }}>{i + 1}</div>
                        <span style={{ fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 800, color: pasoActivo === i ? "#fff" : "#888" }}>
                          {paso.titulo}
                        </span>
                      </div>
                      <div style={{
                        background: "#0a0a0a", borderRadius: 6, padding: "14px 16px",
                        fontSize: 14, color: "#e0e0e0", lineHeight: 1.7, fontStyle: "italic",
                        borderLeft: "3px solid #990000",
                      }}>
                        "{paso.guion}"
                      </div>
                      {paso.tips && pasoActivo === i && (
                        <div style={{ marginTop: 10, fontSize: 12, color: "#d4960c", background: "#d4960c10", borderRadius: 6, padding: "8px 12px" }}>
                          💡 {paso.tips}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {modoEnsayo && (
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button
                      onClick={() => setPasoActivo(Math.max(0, pasoActivo - 1))}
                      disabled={pasoActivo === 0}
                      style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: pasoActivo === 0 ? "#444" : "#fff", padding: "10px 20px", fontSize: 13, cursor: pasoActivo === 0 ? "not-allowed" : "pointer" }}
                    >← Anterior</button>
                    <button
                      onClick={() => setPasoActivo(Math.min(scriptSeleccionado.pasos.length - 1, pasoActivo + 1))}
                      disabled={pasoActivo === scriptSeleccionado.pasos.length - 1}
                      style={{ background: "#990000", border: "none", borderRadius: 8, color: "#fff", padding: "10px 20px", fontSize: 13, cursor: pasoActivo === scriptSeleccionado.pasos.length - 1 ? "not-allowed" : "pointer", fontWeight: 700 }}
                    >Siguiente →</button>
                  </div>
                )}
              </div>

              {/* Objeciones */}
              {scriptSeleccionado.objeciones && scriptSeleccionado.objeciones.length > 0 && (
                <div>
                  <h3 style={{ margin: "0 0 12px", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 800, color: "#990000", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    🛡 Manejo de objeciones
                  </h3>
                  {scriptSeleccionado.objeciones.map((obj, i) => (
                    <div key={i} style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: "14px 16px", marginBottom: 10 }}>
                      <div style={{ fontSize: 13, color: "#d4960c", fontWeight: 600, marginBottom: 8 }}>
                        🔴 "{obj.objecion}"
                      </div>
                      <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6, borderLeft: "2px solid #3abab6", paddingLeft: 12 }}>
                        🟢 "{obj.respuesta}"
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
