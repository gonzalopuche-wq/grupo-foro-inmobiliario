"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Plantillas predefinidas por etapa/propósito ───────────────────────────────

interface Template {
  id: string;
  categoria: string;
  nombre: string;
  emoji: string;
  texto: string;
  variables: string[];
}

const TEMPLATES: Template[] = [
  // Primer contacto
  {
    id: "primer_contacto_web",
    categoria: "primer_contacto",
    nombre: "Lead web — primer contacto",
    emoji: "👋",
    texto: `Hola {nombre}! Soy {agente} de {inmobiliaria}. Vi que consultaste por la propiedad en {direccion}. ¿Tiene unos minutos para contarme qué está buscando? Con gusto le ayudo a encontrar la mejor opción 🏠`,
    variables: ["{nombre}", "{agente}", "{inmobiliaria}", "{direccion}"],
  },
  {
    id: "primer_contacto_referido",
    categoria: "primer_contacto",
    nombre: "Referido — presentación",
    emoji: "🤝",
    texto: `Hola {nombre}, ¿cómo está? Soy {agente} de {inmobiliaria}. Me contacto de parte de {referido} quien me comentó que podría estar buscando propiedades. ¿Cuándo le viene bien hablar? 😊`,
    variables: ["{nombre}", "{agente}", "{inmobiliaria}", "{referido}"],
  },
  // Visita
  {
    id: "confirmar_visita",
    categoria: "visita",
    nombre: "Confirmar visita",
    emoji: "📅",
    texto: `Hola {nombre}! Le confirmo la visita a {direccion} para el {fecha} a las {hora}. Cualquier cambio me avisa con anticipación. ¡Hasta el {dia}! 🏠`,
    variables: ["{nombre}", "{direccion}", "{fecha}", "{hora}", "{dia}"],
  },
  {
    id: "recordatorio_visita",
    categoria: "visita",
    nombre: "Recordatorio de visita (día anterior)",
    emoji: "🔔",
    texto: `Hola {nombre}! Le recuerdo que mañana tenemos la visita a las {hora} en {direccion}. Le espero allí. Si necesita reprogramar, avíseme cuanto antes. ¡Hasta mañana! 👋`,
    variables: ["{nombre}", "{hora}", "{direccion}"],
  },
  {
    id: "post_visita",
    categoria: "visita",
    nombre: "Seguimiento post-visita",
    emoji: "🏠",
    texto: `Hola {nombre}! Fue un gusto mostrarle la propiedad de {direccion}. ¿Qué le pareció? ¿Tiene alguna duda o consulta que pueda responderle? Quedo a disposición 😊`,
    variables: ["{nombre}", "{direccion}"],
  },
  // Oferta
  {
    id: "envio_oferta",
    categoria: "oferta",
    nombre: "Envío de propuesta formal",
    emoji: "📋",
    texto: `Hola {nombre}! Le adjunto la propuesta formal por la propiedad ubicada en {direccion}. El precio es {precio} {moneda}. Quedamos abiertos a conversar. ¿Le parece bien que hablemos esta semana? 🤝`,
    variables: ["{nombre}", "{direccion}", "{precio}", "{moneda}"],
  },
  {
    id: "contrapropuesta",
    categoria: "oferta",
    nombre: "Transmitir contrapropuesta",
    emoji: "💬",
    texto: `Hola {nombre}! Hablé con el {parte} y la contrapropuesta es {precio} {moneda}. {condiciones}. ¿Qué le parece? Puedo coordinar una llamada para conversar los detalles si lo prefiere 📞`,
    variables: ["{nombre}", "{parte}", "{precio}", "{moneda}", "{condiciones}"],
  },
  // Reserva y escritura
  {
    id: "instrucciones_reserva",
    categoria: "cierre",
    nombre: "Instrucciones para la reserva",
    emoji: "✍️",
    texto: `Hola {nombre}! Excelente noticias, avanzamos con la reserva de {direccion}. Para concretarla necesitamos: {requisitos}. ¿Puede tenerlo listo para el {fecha}? Cualquier duda me consulta 🏡`,
    variables: ["{nombre}", "{direccion}", "{requisitos}", "{fecha}"],
  },
  {
    id: "confirmacion_escritura",
    categoria: "cierre",
    nombre: "Confirmación fecha escritura",
    emoji: "⚖️",
    texto: `Hola {nombre}! La escritura queda agendada para el {fecha} a las {hora} en la escribanía {escribania}, {direccion_escribania}. Por favor confirme asistencia y tenga preparado: {documentos}. ¡Falta poco! 🎉`,
    variables: ["{nombre}", "{fecha}", "{hora}", "{escribania}", "{direccion_escribania}", "{documentos}"],
  },
  {
    id: "felicitacion_cierre",
    categoria: "cierre",
    nombre: "Felicitación por el cierre",
    emoji: "🎉",
    texto: `Hola {nombre}! Quería felicitarlo por la operación concretada. Fue un gusto acompañarlo en este proceso. Si en el futuro necesita algo o conoce a alguien que busque o quiera vender una propiedad, cuente conmigo. ¡Éxitos en su nuevo hogar! 🏠✨`,
    variables: ["{nombre}"],
  },
  // Seguimiento
  {
    id: "reactivar_contacto",
    categoria: "seguimiento",
    nombre: "Reactivar contacto inactivo",
    emoji: "🔄",
    texto: `Hola {nombre}, ¿cómo está? Soy {agente} de {inmobiliaria}. Hace un tiempo hablamos sobre su búsqueda de propiedades. ¿Sigue buscando? Acaban de entrar algunas opciones interesantes que podrían interesarle 🏠`,
    variables: ["{nombre}", "{agente}", "{inmobiliaria}"],
  },
  {
    id: "nueva_propiedad",
    categoria: "seguimiento",
    nombre: "Nueva propiedad que puede interesar",
    emoji: "🆕",
    texto: `Hola {nombre}! Pensé en usted apenas entró esta propiedad: {descripcion_propiedad}, {precio} {moneda}. Se ajusta a lo que buscaba. ¿Le interesa verla? Puedo coordinar una visita esta semana 📍`,
    variables: ["{nombre}", "{descripcion_propiedad}", "{precio}", "{moneda}"],
  },
  {
    id: "bajon_precio",
    categoria: "seguimiento",
    nombre: "Baja de precio de propiedad de interés",
    emoji: "🏷️",
    texto: `Hola {nombre}! Buenas noticias: la propiedad de {direccion} que vio anteriormente bajó de precio. Ahora está en {precio_nuevo} {moneda} (antes {precio_anterior}). ¿Le interesa que retomemos? 😊`,
    variables: ["{nombre}", "{direccion}", "{precio_nuevo}", "{moneda}", "{precio_anterior}"],
  },
  // Captación
  {
    id: "tasacion_gratuita",
    categoria: "captacion",
    nombre: "Oferta de tasación gratuita",
    emoji: "📊",
    texto: `Hola {nombre}! Soy {agente} de {inmobiliaria}. Ofrecemos tasaciones gratuitas y sin compromiso. Si está pensando en vender o simplemente quiere saber cuánto vale su propiedad, puedo ayudarle. ¿Le interesa? 🏠`,
    variables: ["{nombre}", "{agente}", "{inmobiliaria}"],
  },
  {
    id: "propietario_zona",
    categoria: "captacion",
    nombre: "Contacto con propietario de la zona",
    emoji: "🗺️",
    texto: `Hola {nombre}! Soy {agente} de {inmobiliaria}. Tenemos clientes buscando específicamente en {zona} con presupuesto de {presupuesto} {moneda}. ¿Estaría interesado en una valuación de su propiedad? 📞`,
    variables: ["{nombre}", "{agente}", "{inmobiliaria}", "{zona}", "{presupuesto}", "{moneda}"],
  },
  // Documentación
  {
    id: "solicitud_documentos",
    categoria: "documentacion",
    nombre: "Solicitud de documentación",
    emoji: "📁",
    texto: `Hola {nombre}! Para avanzar con la operación necesitamos los siguientes documentos: {lista_documentos}. ¿Puede enviarlos antes del {fecha}? Puede mandármelos por acá o al email {email}. ¡Gracias! 🙏`,
    variables: ["{nombre}", "{lista_documentos}", "{fecha}", "{email}"],
  },
];

const CATEGORIAS = [
  { id: "todos", label: "Todos", emoji: "📋" },
  { id: "primer_contacto", label: "Primer contacto", emoji: "👋" },
  { id: "visita", label: "Visitas", emoji: "📅" },
  { id: "oferta", label: "Ofertas", emoji: "💬" },
  { id: "cierre", label: "Cierre", emoji: "✍️" },
  { id: "seguimiento", label: "Seguimiento", emoji: "🔄" },
  { id: "captacion", label: "Captación", emoji: "🎯" },
  { id: "documentacion", label: "Documentación", emoji: "📁" },
];

export default function WhatsAppTemplates() {
  const [categoria, setCategoria] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, Record<string, string>>>({});

  const filtrados = useMemo(() => {
    return TEMPLATES.filter(t => {
      if (categoria !== "todos" && t.categoria !== categoria) return false;
      if (busqueda && !t.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !t.texto.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
  }, [categoria, busqueda]);

  function textoPersonalizado(t: Template): string {
    let texto = t.texto;
    const vals = valores[t.id] ?? {};
    for (const v of t.variables) {
      texto = texto.replaceAll(v, vals[v] || v);
    }
    return texto;
  }

  function copiar(t: Template) {
    const texto = textoPersonalizado(t);
    navigator.clipboard.writeText(texto).catch(() => {});
    setCopiado(t.id);
    setTimeout(() => setCopiado(null), 2000);
  }

  function abrirWhatsApp(t: Template) {
    const texto = encodeURIComponent(textoPersonalizado(t));
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  }

  function setVar(templateId: string, varName: string, value: string) {
    setValores(prev => ({
      ...prev,
      [templateId]: { ...(prev[templateId] ?? {}), [varName]: value },
    }));
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--gfi-bg-primary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, padding: "16px 18px",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <Link href="/crm" style={{ color: "var(--gfi-text-muted)", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, margin: 0 }}>Plantillas WhatsApp</h1>
        <span style={{ background: "#3abab6", color: "#000", fontSize: 9, fontWeight: 700, fontFamily: "var(--font-display)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>MENSAJES</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginBottom: 20 }}>{TEMPLATES.length} plantillas listas para usar · personalizables por contacto</div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIAS.map(c => (
            <button key={c.id} onClick={() => setCategoria(c.id)}
              style={{ background: categoria === c.id ? "rgba(34,197,94,0.15)" : "var(--gfi-border-subtle)", border: `1px solid ${categoria === c.id ? "rgba(34,197,94,0.4)" : "var(--gfi-border)"}`, borderRadius: 6, color: categoria === c.id ? "#3abab6" : "var(--gfi-text-muted)", fontSize: 11, padding: "5px 10px", cursor: "pointer", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <input
          placeholder="Buscar plantilla…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)", borderRadius: 6, color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 12, padding: "7px 12px", marginLeft: "auto" }}
        />
      </div>

      {/* Grid de plantillas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 14 }}>
        {filtrados.map(t => {
          const isOpen = expandido === t.id;
          const isCopied = copiado === t.id;
          const vals = valores[t.id] ?? {};
          const textoFinal = textoPersonalizado(t);
          const tieneVarsVacias = t.variables.some(v => !vals[v]);

          return (
            <div key={t.id} style={{ ...cardStyle, borderColor: isOpen ? "rgba(34,197,94,0.2)" : "var(--gfi-border-subtle)" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{t.emoji}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700 }}>{t.nombre}</span>
                  </div>
                  <span style={{ background: "rgba(255,255,255,0.06)", color: "var(--gfi-text-muted)", fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>
                    {CATEGORIAS.find(c => c.id === t.categoria)?.emoji} {CATEGORIAS.find(c => c.id === t.categoria)?.label}
                  </span>
                </div>
                <button onClick={() => setExpandido(isOpen ? null : t.id)}
                  style={{ background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 5, color: "var(--gfi-text-muted)", fontSize: 10, padding: "4px 10px", cursor: "pointer" }}>
                  {isOpen ? "▲ Cerrar" : "▼ Personalizar"}
                </button>
              </div>

              {/* Preview del texto */}
              <div style={{ background: "var(--gfi-bg-secondary)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--gfi-text-primary)", lineHeight: 1.6, fontFamily: "Inter,sans-serif", marginBottom: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {textoFinal}
              </div>

              {/* Variables editables */}
              {isOpen && t.variables.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>Variables</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {t.variables.map(v => (
                      <div key={v}>
                        <div style={{ fontSize: 9, color: "var(--gfi-text-muted)", marginBottom: 2 }}>{v}</div>
                        <input
                          value={vals[v] ?? ""}
                          onChange={e => setVar(t.id, v, e.target.value)}
                          placeholder={v.replace("{", "").replace("}", "")}
                          style={{ background: "#0a0a0a", border: "1px solid var(--gfi-border)", borderRadius: 4, color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 12, padding: "5px 8px", width: "100%", boxSizing: "border-box" }}
                        />
                      </div>
                    ))}
                  </div>
                  {tieneVarsVacias && (
                    <div style={{ fontSize: 10, color: "#d4960c", marginTop: 6 }}>⚠ Completá las variables antes de enviar</div>
                  )}
                </div>
              )}

              {/* Acciones */}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => copiar(t)}
                  style={{ flex: 1, background: isCopied ? "rgba(34,197,94,0.15)" : "var(--gfi-border-subtle)", border: `1px solid ${isCopied ? "rgba(34,197,94,0.4)" : "var(--gfi-border)"}`, borderRadius: 6, color: isCopied ? "#3abab6" : "var(--gfi-text-secondary)", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, padding: "7px 0", cursor: "pointer", letterSpacing: "0.05em" }}>
                  {isCopied ? "✓ Copiado!" : "📋 Copiar"}
                </button>
                <button onClick={() => abrirWhatsApp(t)}
                  style={{ flex: 1, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, color: "#3abab6", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, padding: "7px 0", cursor: "pointer", letterSpacing: "0.05em" }}>
                  WhatsApp ↗
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--gfi-text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }}>Sin resultados para "{busqueda}"</div>
        </div>
      )}
    </div>
  );
}
