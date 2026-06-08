"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface PropiedadCartera {
  id: string;
  descripcion: string | null;
  operacion: string | null;
  tipo: string | null;
  zona: string | null;
  precio: number | null;
  moneda: string | null;
  estado: string | null;
  perfil_id: string;
  fotos: string[] | null;
}

interface FichaPropiedad {
  id: string;
  propiedad_supabase_id: string | null;
  titulo: string;
  subtitulo: string;
  operacion: string;
  tipo: string;
  zona: string;
  ciudad: string;
  precio: number;
  moneda: string;
  precio_expensas: number | null;
  m2_cubiertos: number | null;
  m2_totales: number | null;
  ambientes: number | null;
  dormitorios: number | null;
  banos: number | null;
  piso: string | null;
  orientacion: string | null;
  antiguedad: number | null;
  amenities: string[];
  fotos: string[];
  descripcion_larga: string;
  puntos_destacados: string[];
  nombre_corredor: string;
  telefono_corredor: string;
  email_corredor: string;
  logo_agencia: string;
  color_primario: string;
  created_at: string;
  updated_at: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────

const AMENITIES_DISPONIBLES = [
  "Cochera",
  "Doble cochera",
  "Pileta",
  "Gym",
  "Seguridad 24hs",
  "Laundry",
  "Sauna",
  "SUM",
  "Jardín",
  "Terraza",
  "Balcón",
  "Vista panorámica",
];

const COLORES_DISPONIBLES = [
  { label: "Rojo", value: "#990000" },
  { label: "Azul", value: "#1e40af" },
  { label: "Verde", value: "#15803d" },
  { label: "Negro", value: "#111111" },
  { label: "Dorado", value: "#b45309" },
];

const ORIENTACIONES = ["N", "S", "E", "O", "NE", "NO", "SE", "SO"];

function fichaVacia(base?: Partial<FichaPropiedad>): FichaPropiedad {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    propiedad_supabase_id: null,
    titulo: "",
    subtitulo: "",
    operacion: "",
    tipo: "",
    zona: "",
    ciudad: "",
    precio: 0,
    moneda: "USD",
    precio_expensas: null,
    m2_cubiertos: null,
    m2_totales: null,
    ambientes: null,
    dormitorios: null,
    banos: null,
    piso: null,
    orientacion: null,
    antiguedad: null,
    amenities: [],
    fotos: [],
    descripcion_larga: "",
    puntos_destacados: [],
    nombre_corredor: "",
    telefono_corredor: "",
    email_corredor: "",
    logo_agencia: "GFI",
    color_primario: "#990000",
    created_at: now,
    updated_at: now,
    ...base,
  };
}

// ── Estilos reutilizables ──────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#e0e0e0",
    fontFamily: "var(--font-body)",
    padding: "0 0 60px",
  } as React.CSSProperties,
  card: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 10,
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(224,224,224,0.5)",
    marginBottom: 5,
    fontFamily: "var(--font-display)",
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  input: {
    width: "100%",
    background: "var(--gfi-border-subtle)",
    border: "1px solid #222222",
    borderRadius: 6,
    padding: "9px 12px",
    color: "#e0e0e0",
    fontFamily: "var(--font-body)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  btnPrimary: {
    padding: "10px 20px",
    background: "#990000",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
  } as React.CSSProperties,
  btnSecondary: {
    padding: "9px 16px",
    background: "var(--gfi-border-subtle)",
    color: "rgba(224,224,224,0.7)",
    border: "1px solid #222222",
    borderRadius: 7,
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
  } as React.CSSProperties,
  sectionTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: 13,
    color: "#e0e0e0",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    userSelect: "none" as const,
  } as React.CSSProperties,
};

// ── Componente Sección Colapsable ─────────────────────────────────────────
function Seccion({
  titulo,
  emoji,
  open,
  onToggle,
  children,
}: {
  titulo: string;
  emoji: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...S.card,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <span style={S.sectionTitle}>
          <span>{emoji}</span> {titulo}
        </span>
        <span
          style={{
            color: "rgba(224,224,224,0.3)",
            fontSize: 16,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </div>
      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid #1a1a1a" }}>
          <div style={{ height: 14 }} />
          {children}
        </div>
      )}
    </div>
  );
}

// ── Grilla de inputs ───────────────────────────────────────────────────────
function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

// ── Función generar HTML para impresión ───────────────────────────────────
function generarHtmlFicha(ficha: FichaPropiedad): string {
  const formatPrecio = (p: number, m: string) =>
    `${m} ${p.toLocaleString("es-AR")}`;

  const amenitiesHtml = ficha.amenities
    .map(
      (a) =>
        `<span style="display:inline-block;background:${ficha.color_primario}22;border:1px solid ${ficha.color_primario}44;color:${ficha.color_primario};padding:4px 12px;border-radius:20px;font-size:11px;font-family:var(--font-display);font-weight:700;margin:3px;">${a}</span>`
    )
    .join("");

  const puntosHtml = ficha.puntos_destacados
    .map(
      (p) =>
        `<li style="margin-bottom:6px;font-size:13px;color:#333;line-height:1.5;">${p}</li>`
    )
    .join("");

  const caract: { label: string; value: string }[] = [];
  if (ficha.dormitorios) caract.push({ label: "Dormitorios", value: String(ficha.dormitorios) });
  if (ficha.banos) caract.push({ label: "Baños", value: String(ficha.banos) });
  if (ficha.ambientes) caract.push({ label: "Ambientes", value: String(ficha.ambientes) });
  if (ficha.m2_cubiertos) caract.push({ label: "m² cubiertos", value: `${ficha.m2_cubiertos} m²` });
  if (ficha.m2_totales) caract.push({ label: "m² totales", value: `${ficha.m2_totales} m²` });
  if (ficha.antiguedad) caract.push({ label: "Antigüedad", value: `${ficha.antiguedad} años` });
  if (ficha.piso) caract.push({ label: "Piso", value: ficha.piso });
  if (ficha.orientacion) caract.push({ label: "Orientación", value: ficha.orientacion });
  if (ficha.precio_expensas) caract.push({ label: "Expensas", value: `$ ${ficha.precio_expensas.toLocaleString("es-AR")}` });

  const caractHtml = caract
    .map(
      (c) => `
      <div style="background:#f8f8f8;border:1px solid #e8e8e8;border-radius:8px;padding:12px 16px;text-align:center;">
        <div style="font-size:10px;font-family:var(--font-display);font-weight:700;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">${c.label}</div>
        <div style="font-size:16px;font-family:var(--font-display);font-weight:800;color:#111;">${c.value}</div>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${ficha.titulo} - ${ficha.logo_agencia}</title>
  <style>
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); background: #fff; color: #222; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 794px; margin: 0 auto; padding: 0; }
    @media print { body { margin: 0; } .page { max-width: 100%; } }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div style="background:${ficha.color_primario};padding:28px 36px;display:flex;align-items:center;justify-content:space-between;gap:20px;">
      <div>
        <div style="font-family:var(--font-display);font-weight:800;font-size:26px;color:#fff;letter-spacing:0.08em;">${ficha.logo_agencia}</div>
        <div style="font-size:11px;color:var(--gfi-text-primary);margin-top:3px;font-family:var(--font-display);letter-spacing:0.08em;text-transform:uppercase;">${ficha.operacion} · ${ficha.tipo}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;color:rgba(255,255,255,0.9);font-family:var(--font-body);">${ficha.telefono_corredor}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.9);font-family:var(--font-body);">${ficha.email_corredor}</div>
      </div>
    </div>

    <!-- Fotos -->
    ${ficha.fotos && ficha.fotos.length > 0 ? `
    <div style="display:grid;grid-template-columns:${ficha.fotos.length === 1 ? "1fr" : ficha.fotos.length === 2 ? "1fr 1fr" : "2fr 1fr"};gap:3px;height:220px;overflow:hidden;">
      ${ficha.fotos.slice(0, 3).map((url, i) => `<img src="${url}" alt="Foto ${i+1}" style="width:100%;height:100%;object-fit:cover;${i === 0 && ficha.fotos!.length >= 3 ? "grid-row:span 2;" : ""}" />`).join("")}
    </div>` : ""}

    <!-- Título y precio -->
    <div style="padding:28px 36px 20px;border-bottom:2px solid ${ficha.color_primario}22;">
      <div style="font-family:var(--font-display);font-weight:800;font-size:22px;color:#111;line-height:1.2;margin-bottom:6px;">${ficha.titulo}</div>
      <div style="font-size:13px;color:#666;font-family:var(--font-body);margin-bottom:14px;">${ficha.subtitulo}</div>
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
        <div style="font-family:var(--font-display);font-weight:800;font-size:24px;color:${ficha.color_primario};">${formatPrecio(ficha.precio, ficha.moneda)}</div>
        ${ficha.zona ? `<div style="font-size:13px;color:#555;font-family:var(--font-body);">📍 ${ficha.zona}${ficha.ciudad ? `, ${ficha.ciudad}` : ""}</div>` : ""}
      </div>
    </div>

    <!-- Características -->
    ${caract.length > 0 ? `
    <div style="padding:24px 36px;border-bottom:1px solid #eee;">
      <div style="font-family:var(--font-display);font-weight:700;font-size:10px;color:#999;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:14px;">Características</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;">
        ${caractHtml}
      </div>
    </div>` : ""}

    <!-- Amenities -->
    ${ficha.amenities.length > 0 ? `
    <div style="padding:20px 36px;border-bottom:1px solid #eee;">
      <div style="font-family:var(--font-display);font-weight:700;font-size:10px;color:#999;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;">Amenities</div>
      <div>${amenitiesHtml}</div>
    </div>` : ""}

    <!-- Descripción -->
    ${ficha.descripcion_larga ? `
    <div style="padding:20px 36px;border-bottom:1px solid #eee;">
      <div style="font-family:var(--font-display);font-weight:700;font-size:10px;color:#999;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">Descripción</div>
      <p style="font-size:13px;color:#444;line-height:1.7;font-family:var(--font-body);">${ficha.descripcion_larga.replace(/\n/g, "<br/>")}</p>
    </div>` : ""}

    <!-- Puntos destacados -->
    ${ficha.puntos_destacados.length > 0 ? `
    <div style="padding:20px 36px;border-bottom:1px solid #eee;">
      <div style="font-family:var(--font-display);font-weight:700;font-size:10px;color:#999;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">Puntos destacados</div>
      <ul style="padding-left:18px;list-style-type:disc;">${puntosHtml}</ul>
    </div>` : ""}

    <!-- Footer corredor -->
    <div style="padding:24px 36px;background:#f8f8f8;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">
      <div>
        <div style="font-family:var(--font-display);font-weight:800;font-size:14px;color:#111;">${ficha.nombre_corredor}</div>
        <div style="font-size:11px;color:#888;font-family:var(--font-body);margin-top:2px;">Corredor inmobiliario</div>
      </div>
      <div style="text-align:right;">
        ${ficha.telefono_corredor ? `<div style="font-size:12px;color:#555;font-family:var(--font-body);">📞 ${ficha.telefono_corredor}</div>` : ""}
        ${ficha.email_corredor ? `<div style="font-size:12px;color:#555;font-family:var(--font-body);">✉️ ${ficha.email_corredor}</div>` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Componente principal ───────────────────────────────────────────────────
export default function FichaPropiedadPage() {
  const [tab, setTab] = useState<"fichas" | "editor" | "preview">("fichas");
  const [fichas, setFichas] = useState<FichaPropiedad[]>([]);
  const [fichaActual, setFichaActual] = useState<FichaPropiedad | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  // Cartera de Supabase
  const [propiedades, setPropiedades] = useState<PropiedadCartera[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);
  const [mostrarSelector, setMostrarSelector] = useState(false);

  // Secciones colapsables del editor
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<
    Record<string, boolean>
  >({
    basicos: true,
    caracteristicas: false,
    amenities: false,
    fotos: true,
    descripcion: false,
    precio: false,
    corredor: false,
    estilo: false,
  });

  // Nuevo punto destacado
  const [nuevoPunto, setNuevoPunto] = useState("");

  // ── Auth + carga desde Supabase ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUid(user.id);
      const { data } = await supabase
        .from("crm_fichas_propiedades")
        .select("fichas")
        .eq("perfil_id", user.id)
        .maybeSingle();
      if (data?.fichas) {
        setFichas(data.fichas as FichaPropiedad[]);
      }
    })();
  }, []);

  const guardarEnStorage = useCallback(async (lista: FichaPropiedad[]) => {
    setFichas(lista);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("crm_fichas_propiedades").upsert({
      perfil_id: user.id,
      fichas: lista,
      updated_at: new Date().toISOString(),
    });
  }, []);

  // ── Cargar cartera de Supabase ────────────────────────────────────────
  const cargarPropiedades = useCallback(async () => {
    setLoadingProps(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoadingProps(false); return; }
    const { data } = await supabase
      .from("cartera_propiedades")
      .select("id, descripcion, operacion, tipo, zona, precio, moneda, estado, perfil_id, fotos")
      .eq("perfil_id", auth.user.id)
      .order("id", { ascending: false });
    if (data) setPropiedades(data as PropiedadCartera[]);
    setLoadingProps(false);
  }, []);

  // ── Acciones fichas ───────────────────────────────────────────────────
  const crearFichaDesdePropiedad = (prop: PropiedadCartera) => {
    const f = fichaVacia({
      propiedad_supabase_id: prop.id,
      titulo: prop.descripcion ?? "",
      subtitulo: `${prop.tipo ?? ""} ${prop.operacion ? "en " + prop.operacion.toLowerCase() : ""} - ${prop.zona ?? ""}`.trim(),
      operacion: prop.operacion ?? "",
      tipo: prop.tipo ?? "",
      zona: prop.zona ?? "",
      precio: prop.precio ?? 0,
      moneda: prop.moneda ?? "USD",
      fotos: prop.fotos ?? [],
    });
    setFichaActual(f);
    setMostrarSelector(false);
    setTab("editor");
  };

  const crearFichaManual = () => {
    setFichaActual(fichaVacia());
    setTab("editor");
  };

  const seleccionarFicha = (f: FichaPropiedad) => {
    setFichaActual({ ...f });
    setTab("editor");
  };

  const duplicarFicha = async (f: FichaPropiedad) => {
    const now = new Date().toISOString();
    const copia: FichaPropiedad = {
      ...f,
      id: crypto.randomUUID(),
      titulo: `${f.titulo} (copia)`,
      created_at: now,
      updated_at: now,
    };
    const nueva = [copia, ...fichas];
    await guardarEnStorage(nueva);
  };

  const eliminarFicha = async (id: string) => {
    if (!confirm("¿Eliminár esta ficha?")) return;
    const nueva = fichas.filter((f) => f.id !== id);
    await guardarEnStorage(nueva);
    if (fichaActual?.id === id) {
      setFichaActual(null);
    }
  };

  const guardarFicha = async () => {
    if (!fichaActual) return;
    const updated: FichaPropiedad = {
      ...fichaActual,
      updated_at: new Date().toISOString(),
    };
    const existe = fichas.find((f) => f.id === updated.id);
    const nueva = existe
      ? fichas.map((f) => (f.id === updated.id ? updated : f))
      : [updated, ...fichas];
    await guardarEnStorage(nueva);
    setFichaActual(updated);
  };

  const imprimirFicha = (f: FichaPropiedad) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(generarHtmlFicha(f));
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ── Helpers de edición ────────────────────────────────────────────────
  function setField<K extends keyof FichaPropiedad>(
    key: K,
    value: FichaPropiedad[K]
  ) {
    if (!fichaActual) return;
    setFichaActual({ ...fichaActual, [key]: value });
  }

  const toggleSeccion = (key: string) =>
    setSeccionesAbiertas((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAmenity = (a: string) => {
    if (!fichaActual) return;
    const tiene = fichaActual.amenities.includes(a);
    setField(
      "amenities",
      tiene
        ? fichaActual.amenities.filter((x) => x !== a)
        : [...fichaActual.amenities, a]
    );
  };

  const agregarPunto = () => {
    if (!fichaActual || !nuevoPunto.trim()) return;
    setField("puntos_destacados", [
      ...fichaActual.puntos_destacados,
      nuevoPunto.trim(),
    ]);
    setNuevoPunto("");
  };

  const eliminarPunto = (i: number) => {
    if (!fichaActual) return;
    setField(
      "puntos_destacados",
      fichaActual.puntos_destacados.filter((_, idx) => idx !== i)
    );
  };

  // ── Formatos ──────────────────────────────────────────────────────────
  const formatFecha = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const formatPrecio = (precio: number, moneda: string) =>
    `${moneda} ${precio.toLocaleString("es-AR")}`;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`
        
        * { box-sizing: border-box; }
        input, textarea, select { transition: border-color 0.15s; }
        input:focus, textarea:focus, select:focus { border-color: rgba(153,0,0,0.5) !important; outline: none; }
        button:active { opacity: 0.82; }
        @keyframes pulse-skeleton {
          0% { background: var(--gfi-border-subtle); }
          50% { background: var(--gfi-border); }
          100% { background: var(--gfi-border-subtle); }
        }
        .skel { animation: pulse-skeleton 1.4s ease-in-out infinite; border-radius: 6px; }
      `}</style>

      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "24px 28px 0",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 20,
            color: "#fff",
            marginBottom: 4,
          }}
        >
          Fichas de Propiedad
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(224,224,224,0.4)",
            fontFamily: "var(--font-body)",
          }}
        >
          Generá fichas técnicas para compartir con clientes o imprimir
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "0 28px",
          display: "flex",
          gap: 4,
          borderBottom: "1px solid #222222",
          marginBottom: 24,
        }}
      >
        {(
          [
            { key: "fichas", label: "Mis fichas" },
            { key: "editor", label: "Editor" },
            { key: "preview", label: "Vista previa" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t.key ? "#990000" : "transparent"}`,
              color:
                tab === t.key
                  ? "#fff"
                  : "rgba(224,224,224,0.4)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "10px 16px 11px",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
            {t.key === "fichas" && fichas.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: "rgba(153,0,0,0.2)",
                  color: "#990000",
                  borderRadius: 10,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 6px",
                }}
              >
                {fichas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 28px" }}>
        {/* ───────────────────────────────────────────────────────────────── */}
        {/* TAB 1 — MIS FICHAS                                                */}
        {/* ───────────────────────────────────────────────────────────────── */}
        {tab === "fichas" && (
          <div>
            {/* Botones de acción */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                style={S.btnPrimary}
                onClick={() => {
                  cargarPropiedades();
                  setMostrarSelector(true);
                }}
              >
                + Nueva ficha desde cartera
              </button>
              <button style={S.btnSecondary} onClick={crearFichaManual}>
                + Nueva ficha manual
              </button>
            </div>

            {/* Lista de fichas */}
            {fichas.length === 0 ? (
              <div
                style={{
                  ...S.card,
                  padding: "48px 32px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏠</div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "rgba(224,224,224,0.6)",
                    marginBottom: 6,
                  }}
                >
                  Todavía no tenés fichas creadas
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(224,224,224,0.3)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Creá tu primera ficha desde la cartera o manualmente
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {fichas.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      ...S.card,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {/* Foto principal */}
                    <div style={{ height: 120, background: "#1a1a1a", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {f.fotos?.[0]
                        ? <img src={f.fotos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 36, opacity: 0.15 }}>🏠</span>
                      }
                    </div>
                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Indicador de color */}
                    <div
                      style={{
                        width: 28,
                        height: 4,
                        borderRadius: 2,
                        background: f.color_primario,
                        marginBottom: 2,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 800,
                          fontSize: 14,
                          color: "#fff",
                          marginBottom: 3,
                          lineHeight: 1.3,
                        }}
                      >
                        {f.titulo || "Sin título"}
                      </div>
                      {f.subtitulo && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(224,224,224,0.45)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {f.subtitulo}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      {f.precio > 0 && (
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: 13,
                            color: f.color_primario,
                          }}
                        >
                          {formatPrecio(f.precio, f.moneda)}
                        </span>
                      )}
                      {f.zona && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "rgba(224,224,224,0.4)",
                          }}
                        >
                          📍 {f.zona}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(224,224,224,0.25)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      Creada {formatFecha(f.created_at)}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginTop: 2,
                      }}
                    >
                      <button
                        onClick={() => seleccionarFicha(f)}
                        style={{
                          ...S.btnSecondary,
                          fontSize: 10,
                          padding: "6px 12px",
                        }}
                      >
                        Ver / Editar
                      </button>
                      <button
                        onClick={() => {
                          setFichaActual({ ...f });
                          setTab("preview");
                        }}
                        style={{
                          ...S.btnSecondary,
                          fontSize: 10,
                          padding: "6px 12px",
                        }}
                      >
                        Vista previa
                      </button>
                      <button
                        onClick={() => duplicarFicha(f)}
                        style={{
                          ...S.btnSecondary,
                          fontSize: 10,
                          padding: "6px 12px",
                        }}
                      >
                        Duplicar
                      </button>
                      <button
                        onClick={() => imprimirFicha(f)}
                        style={{
                          ...S.btnPrimary,
                          fontSize: 10,
                          padding: "6px 12px",
                        }}
                      >
                        Imprimir PDF
                      </button>
                      <button
                        onClick={() => eliminarFicha(f.id)}
                        style={{
                          background: "rgba(153,0,0,0.08)",
                          border: "1px solid rgba(153,0,0,0.2)",
                          borderRadius: 6,
                          color: "#990000",
                          fontSize: 10,
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    </div>{/* end padding div */}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* TAB 2 — EDITOR                                                    */}
        {/* ───────────────────────────────────────────────────────────────── */}
        {tab === "editor" && (
          <div>
            {!fichaActual ? (
              <div
                style={{
                  ...S.card,
                  padding: "48px 32px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>✏️</div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "rgba(224,224,224,0.6)",
                    marginBottom: 16,
                  }}
                >
                  Seleccioná o creá una ficha para editarla
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    style={S.btnPrimary}
                    onClick={() => {
                      cargarPropiedades();
                      setMostrarSelector(true);
                    }}
                  >
                    + Desde cartera
                  </button>
                  <button style={S.btnSecondary} onClick={crearFichaManual}>
                    + Manual
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Nombre ficha en edición */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: 14,
                        color: "#fff",
                      }}
                    >
                      {fichaActual.titulo || "Nueva ficha"}
                    </div>
                    {fichaActual.propiedad_supabase_id && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(224,224,224,0.3)",
                          marginTop: 2,
                        }}
                      >
                        Vinculada a cartera
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={S.btnSecondary}
                      onClick={() => {
                        guardarFicha();
                        setTab("preview");
                      }}
                    >
                      Vista previa
                    </button>
                    <button style={S.btnPrimary} onClick={guardarFicha}>
                      Guardar ficha
                    </button>
                  </div>
                </div>

                {/* Sección 1 — Datos básicos */}
                <Seccion
                  titulo="Datos básicos"
                  emoji="📋"
                  open={seccionesAbiertas.basicos}
                  onToggle={() => toggleSeccion("basicos")}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Campo label="Título">
                      <input
                        style={S.input}
                        placeholder="Ej: Luminoso departamento de 3 ambientes"
                        value={fichaActual.titulo}
                        onChange={(e) => setField("titulo", e.target.value)}
                      />
                    </Campo>
                    <Campo label="Subtítulo">
                      <input
                        style={S.input}
                        placeholder="Ej: Departamento en venta - Macrocentro"
                        value={fichaActual.subtitulo}
                        onChange={(e) => setField("subtitulo", e.target.value)}
                      />
                    </Campo>
                    <Grid2>
                      <Campo label="Tipo de operación">
                        <input
                          style={S.input}
                          placeholder="Venta / Alquiler"
                          value={fichaActual.operacion}
                          onChange={(e) =>
                            setField("operacion", e.target.value)
                          }
                        />
                      </Campo>
                      <Campo label="Tipo de propiedad">
                        <input
                          style={S.input}
                          placeholder="Departamento / Casa / Local"
                          value={fichaActual.tipo}
                          onChange={(e) =>
                            setField("tipo", e.target.value)
                          }
                        />
                      </Campo>
                      <Campo label="Barrio">
                        <input
                          style={S.input}
                          placeholder="Ej: Palermo"
                          value={fichaActual.zona}
                          onChange={(e) => setField("zona", e.target.value)}
                        />
                      </Campo>
                      <Campo label="Ciudad">
                        <input
                          style={S.input}
                          placeholder="Ej: Buenos Aires"
                          value={fichaActual.ciudad}
                          onChange={(e) => setField("ciudad", e.target.value)}
                        />
                      </Campo>
                    </Grid2>
                  </div>
                </Seccion>

                {/* Sección 2 — Características */}
                <Seccion
                  titulo="Características"
                  emoji="📐"
                  open={seccionesAbiertas.caracteristicas}
                  onToggle={() => toggleSeccion("caracteristicas")}
                >
                  <Grid2>
                    <Campo label="m² cubiertos">
                      <input
                        style={S.input}
                        type="number"
                        min={0}
                        placeholder="—"
                        value={fichaActual.m2_cubiertos ?? ""}
                        onChange={(e) =>
                          setField(
                            "m2_cubiertos",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </Campo>
                    <Campo label="m² totales">
                      <input
                        style={S.input}
                        type="number"
                        min={0}
                        placeholder="—"
                        value={fichaActual.m2_totales ?? ""}
                        onChange={(e) =>
                          setField(
                            "m2_totales",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </Campo>
                    <Campo label="Ambientes">
                      <input
                        style={S.input}
                        type="number"
                        min={0}
                        placeholder="—"
                        value={fichaActual.ambientes ?? ""}
                        onChange={(e) =>
                          setField(
                            "ambientes",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </Campo>
                    <Campo label="Dormitorios">
                      <input
                        style={S.input}
                        type="number"
                        min={0}
                        placeholder="—"
                        value={fichaActual.dormitorios ?? ""}
                        onChange={(e) =>
                          setField(
                            "dormitorios",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </Campo>
                    <Campo label="Baños">
                      <input
                        style={S.input}
                        type="number"
                        min={0}
                        placeholder="—"
                        value={fichaActual.banos ?? ""}
                        onChange={(e) =>
                          setField(
                            "banos",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </Campo>
                    <Campo label="Piso">
                      <input
                        style={S.input}
                        placeholder="Ej: 3°"
                        value={fichaActual.piso ?? ""}
                        onChange={(e) =>
                          setField("piso", e.target.value || null)
                        }
                      />
                    </Campo>
                    <Campo label="Orientación">
                      <select
                        style={S.input}
                        value={fichaActual.orientacion ?? ""}
                        onChange={(e) =>
                          setField("orientacion", e.target.value || null)
                        }
                      >
                        <option value="">— Sin especificar</option>
                        {ORIENTACIONES.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo label="Antigüedad (años)">
                      <input
                        style={S.input}
                        type="number"
                        min={0}
                        placeholder="—"
                        value={fichaActual.antiguedad ?? ""}
                        onChange={(e) =>
                          setField(
                            "antiguedad",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </Campo>
                  </Grid2>
                </Seccion>

                {/* Sección 3 — Amenities */}
                <Seccion
                  titulo="Amenities"
                  emoji="✨"
                  open={seccionesAbiertas.amenities}
                  onToggle={() => toggleSeccion("amenities")}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {AMENITIES_DISPONIBLES.map((a) => {
                      const activo = fichaActual.amenities.includes(a);
                      return (
                        <button
                          key={a}
                          onClick={() => toggleAmenity(a)}
                          style={{
                            padding: "7px 14px",
                            borderRadius: 20,
                            border: `1px solid ${activo ? "#990000" : "#333"}`,
                            background: activo
                              ? "rgba(153,0,0,0.12)"
                              : "var(--gfi-bg-card)",
                            color: activo
                              ? "#990000"
                              : "rgba(224,224,224,0.5)",
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </Seccion>

                {/* Sección 4 — Fotos */}
                <Seccion
                  titulo="Fotos"
                  emoji="📸"
                  open={seccionesAbiertas.fotos}
                  onToggle={() => toggleSeccion("fotos")}
                >
                  {fichaActual.fotos.length === 0 ? (
                    <div style={{ fontSize: 13, color: "rgba(224,224,224,0.3)", padding: "8px 0" }}>
                      Sin fotos cargadas. Las fotos se importan desde la propiedad en cartera.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                      {fichaActual.fotos.map((url, i) => (
                        <div key={i} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
                          <img src={url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          {i === 0 && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", fontSize: 9, color: "#fff", textAlign: "center", padding: "2px 0", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                              PRINCIPAL
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "rgba(224,224,224,0.2)", marginTop: 10 }}>
                    Para agregar o modificar fotos, editá la propiedad en <a href="/crm/cartera" style={{ color: "#3abab6", textDecoration: "none" }}>Cartera</a>.
                  </div>
                </Seccion>

                {/* Sección 5 — Descripción */}
                <Seccion
                  titulo="Descripción"
                  emoji="📝"
                  open={seccionesAbiertas.descripcion}
                  onToggle={() => toggleSeccion("descripcion")}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Campo label="Descripción larga">
                      <div style={{ position: "relative" }}>
                        <textarea
                          style={{
                            ...S.input,
                            minHeight: 120,
                            resize: "vertical",
                            lineHeight: 1.6,
                          }}
                          placeholder="Describí la propiedad en detalle para los potenciales compradores..."
                          value={fichaActual.descripcion_larga}
                          onChange={(e) =>
                            setField("descripcion_larga", e.target.value)
                          }
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: 8,
                            right: 10,
                            fontSize: 10,
                            color: "rgba(224,224,224,0.25)",
                            pointerEvents: "none",
                          }}
                        >
                          {fichaActual.descripcion_larga.length} caracteres
                        </div>
                      </div>
                    </Campo>

                    <Campo label="Puntos destacados">
                      {fichaActual.puntos_destacados.length > 0 && (
                        <ul
                          style={{
                            listStyle: "none",
                            padding: 0,
                            margin: "0 0 10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {fichaActual.puntos_destacados.map((p, i) => (
                            <li
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: "var(--gfi-bg-card)",
                                border: "1px solid #1e1e1e",
                                borderRadius: 6,
                                padding: "7px 12px",
                              }}
                            >
                              <span
                                style={{
                                  color: "#990000",
                                  fontSize: 14,
                                  lineHeight: 1,
                                }}
                              >
                                •
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 13,
                                  color: "#e0e0e0",
                                }}
                              >
                                {p}
                              </span>
                              <button
                                onClick={() => eliminarPunto(i)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "rgba(224,224,224,0.25)",
                                  cursor: "pointer",
                                  fontSize: 14,
                                  padding: "0 2px",
                                  lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          style={{ ...S.input, flex: 1 }}
                          placeholder="Ej: Acceso directo al subte a 100m"
                          value={nuevoPunto}
                          onChange={(e) => setNuevoPunto(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              agregarPunto();
                            }
                          }}
                        />
                        <button
                          onClick={agregarPunto}
                          style={{ ...S.btnSecondary, flexShrink: 0 }}
                        >
                          + Agregar
                        </button>
                      </div>
                    </Campo>
                  </div>
                </Seccion>

                {/* Sección 5 — Precio */}
                <Seccion
                  titulo="Precio"
                  emoji="💰"
                  open={seccionesAbiertas.precio}
                  onToggle={() => toggleSeccion("precio")}
                >
                  <Grid2>
                    <Campo label="Precio">
                      <input
                        style={S.input}
                        type="number"
                        min={0}
                        placeholder="0"
                        value={fichaActual.precio || ""}
                        onChange={(e) =>
                          setField("precio", Number(e.target.value) || 0)
                        }
                      />
                    </Campo>
                    <Campo label="Moneda">
                      <select
                        style={S.input}
                        value={fichaActual.moneda}
                        onChange={(e) => setField("moneda", e.target.value)}
                      >
                        <option value="USD">USD</option>
                        <option value="ARS">ARS</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </Campo>
                    <Campo label="Expensas (ARS / mes)">
                      <input
                        style={S.input}
                        type="number"
                        min={0}
                        placeholder="Sin expensas"
                        value={fichaActual.precio_expensas ?? ""}
                        onChange={(e) =>
                          setField(
                            "precio_expensas",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </Campo>
                  </Grid2>
                </Seccion>

                {/* Sección 6 — Datos del corredor */}
                <Seccion
                  titulo="Datos del corredor"
                  emoji="👤"
                  open={seccionesAbiertas.corredor}
                  onToggle={() => toggleSeccion("corredor")}
                >
                  <Grid2>
                    <Campo label="Nombre del corredor">
                      <input
                        style={S.input}
                        placeholder="Ej: Juan Pérez"
                        value={fichaActual.nombre_corredor}
                        onChange={(e) =>
                          setField("nombre_corredor", e.target.value)
                        }
                      />
                    </Campo>
                    <Campo label="Teléfono">
                      <input
                        style={S.input}
                        type="tel"
                        placeholder="Ej: +54 11 1234-5678"
                        value={fichaActual.telefono_corredor}
                        onChange={(e) =>
                          setField("telefono_corredor", e.target.value)
                        }
                      />
                    </Campo>
                    <Campo label="Email">
                      <input
                        style={S.input}
                        type="email"
                        placeholder="corredor@agencia.com"
                        value={fichaActual.email_corredor}
                        onChange={(e) =>
                          setField("email_corredor", e.target.value)
                        }
                      />
                    </Campo>
                    <Campo label="Logo / Nombre de agencia">
                      <input
                        style={S.input}
                        placeholder="Ej: GFI"
                        value={fichaActual.logo_agencia}
                        onChange={(e) =>
                          setField("logo_agencia", e.target.value)
                        }
                      />
                    </Campo>
                  </Grid2>
                </Seccion>

                {/* Sección 7 — Estilo */}
                <Seccion
                  titulo="Estilo de ficha"
                  emoji="🎨"
                  open={seccionesAbiertas.estilo}
                  onToggle={() => toggleSeccion("estilo")}
                >
                  <Campo label="Color primario">
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {COLORES_DISPONIBLES.map((c) => {
                        const activo = fichaActual.color_primario === c.value;
                        return (
                          <button
                            key={c.value}
                            onClick={() => setField("color_primario", c.value)}
                            title={c.label}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: c.value,
                              border: activo
                                ? "3px solid #fff"
                                : "2px solid transparent",
                              cursor: "pointer",
                              outline: activo
                                ? `2px solid ${c.value}`
                                : "none",
                              outlineOffset: 2,
                              transition: "transform 0.15s",
                              transform: activo ? "scale(1.1)" : "scale(1)",
                            }}
                          />
                        );
                      })}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: "rgba(224,224,224,0.3)",
                      }}
                    >
                      Color seleccionado:{" "}
                      <span style={{ color: fichaActual.color_primario }}>
                        {COLORES_DISPONIBLES.find(
                          (c) => c.value === fichaActual.color_primario
                        )?.label ?? fichaActual.color_primario}
                      </span>
                    </div>
                  </Campo>
                </Seccion>

                {/* Botón guardar inferior */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    style={S.btnSecondary}
                    onClick={() => {
                      guardarFicha();
                      imprimirFicha(fichaActual);
                    }}
                  >
                    Imprimir PDF
                  </button>
                  <button
                    style={S.btnSecondary}
                    onClick={() => {
                      guardarFicha();
                      setTab("preview");
                    }}
                  >
                    Vista previa / Imprimir PDF
                  </button>
                  <button style={S.btnPrimary} onClick={guardarFicha}>
                    Guardar ficha
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* TAB 3 — VISTA PREVIA                                              */}
        {/* ───────────────────────────────────────────────────────────────── */}
        {tab === "preview" && (
          <div>
            {!fichaActual ? (
              <div
                style={{
                  ...S.card,
                  padding: "48px 32px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>👁️</div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "rgba(224,224,224,0.6)",
                    marginBottom: 6,
                  }}
                >
                  No hay ficha para previsualizar
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(224,224,224,0.3)",
                  }}
                >
                  Seleccioná o editá una ficha primero
                </div>
              </div>
            ) : (
              <>
                {/* Barra de acciones */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "rgba(224,224,224,0.5)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Vista previa — {fichaActual.titulo || "Sin título"}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={S.btnSecondary}
                      onClick={() => setTab("editor")}
                    >
                      ← Editar
                    </button>
                    <button
                      style={S.btnPrimary}
                      onClick={() => imprimirFicha(fichaActual)}
                    >
                      🖨 Imprimir / PDF
                    </button>
                  </div>
                </div>

                {/* Ficha simulada A4 */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    overflow: "hidden",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                    maxWidth: 794,
                    margin: "0 auto",
                    color: "#222",
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      background: fichaActual.color_primario,
                      padding: "24px 32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 800,
                          fontSize: 24,
                          color: "#fff",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {fichaActual.logo_agencia || "GFI"}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--gfi-text-primary)",
                          marginTop: 3,
                          fontFamily: "var(--font-display)",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        {fichaActual.operacion}
                        {fichaActual.tipo
                          ? ` · ${fichaActual.tipo}`
                          : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {fichaActual.telefono_corredor && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.9)",
                            marginBottom: 2,
                          }}
                        >
                          {fichaActual.telefono_corredor}
                        </div>
                      )}
                      {fichaActual.email_corredor && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.9)",
                          }}
                        >
                          {fichaActual.email_corredor}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fotos */}
                  {fichaActual.fotos.length > 0 && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: fichaActual.fotos.length === 1 ? "1fr" : fichaActual.fotos.length === 2 ? "1fr 1fr" : "2fr 1fr",
                      gap: 3, height: 200, overflow: "hidden",
                    }}>
                      {fichaActual.fotos.slice(0, 3).map((url, i) => (
                        <img key={i} src={url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", gridRow: i === 0 && fichaActual.fotos.length >= 3 ? "span 2" : undefined }} />
                      ))}
                    </div>
                  )}

                  {/* Título y precio */}
                  <div
                    style={{
                      padding: "24px 32px 18px",
                      borderBottom: `2px solid ${fichaActual.color_primario}22`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: 20,
                        color: "var(--gfi-bg-secondary)",
                        lineHeight: 1.2,
                        marginBottom: 5,
                      }}
                    >
                      {fichaActual.titulo || "Sin título"}
                    </div>
                    {fichaActual.subtitulo && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#777",
                          marginBottom: 12,
                        }}
                      >
                        {fichaActual.subtitulo}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 18,
                        flexWrap: "wrap",
                      }}
                    >
                      {fichaActual.precio > 0 && (
                        <div
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 800,
                            fontSize: 22,
                            color: fichaActual.color_primario,
                          }}
                        >
                          {formatPrecio(fichaActual.precio, fichaActual.moneda)}
                        </div>
                      )}
                      {fichaActual.zona && (
                        <div style={{ fontSize: 13, color: "#555" }}>
                          📍 {fichaActual.zona}
                          {fichaActual.ciudad ? `, ${fichaActual.ciudad}` : ""}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grilla de características */}
                  {(fichaActual.dormitorios ||
                    fichaActual.banos ||
                    fichaActual.ambientes ||
                    fichaActual.m2_cubiertos ||
                    fichaActual.m2_totales ||
                    fichaActual.antiguedad ||
                    fichaActual.piso ||
                    fichaActual.orientacion ||
                    fichaActual.precio_expensas) && (
                    <div
                      style={{
                        padding: "20px 32px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 9,
                          color: "#aaa",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          marginBottom: 12,
                        }}
                      >
                        Características
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(100px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {[
                          fichaActual.dormitorios
                            ? {
                                label: "Dormitorios",
                                value: String(fichaActual.dormitorios),
                              }
                            : null,
                          fichaActual.banos
                            ? {
                                label: "Baños",
                                value: String(fichaActual.banos),
                              }
                            : null,
                          fichaActual.ambientes
                            ? {
                                label: "Ambientes",
                                value: String(fichaActual.ambientes),
                              }
                            : null,
                          fichaActual.m2_cubiertos
                            ? {
                                label: "m² cubiertos",
                                value: `${fichaActual.m2_cubiertos}`,
                              }
                            : null,
                          fichaActual.m2_totales
                            ? {
                                label: "m² totales",
                                value: `${fichaActual.m2_totales}`,
                              }
                            : null,
                          fichaActual.antiguedad
                            ? {
                                label: "Antigüedad",
                                value: `${fichaActual.antiguedad} años`,
                              }
                            : null,
                          fichaActual.piso
                            ? { label: "Piso", value: fichaActual.piso }
                            : null,
                          fichaActual.orientacion
                            ? {
                                label: "Orientación",
                                value: fichaActual.orientacion,
                              }
                            : null,
                          fichaActual.precio_expensas
                            ? {
                                label: "Expensas",
                                value: `$ ${fichaActual.precio_expensas.toLocaleString("es-AR")}`,
                              }
                            : null,
                        ]
                          .filter(
                            (
                              x
                            ): x is { label: string; value: string } =>
                              x !== null
                          )
                          .map((c) => (
                            <div
                              key={c.label}
                              style={{
                                background: "#f8f8f8",
                                border: "1px solid #e8e8e8",
                                borderRadius: 7,
                                padding: "10px 12px",
                                textAlign: "center",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  fontFamily: "var(--font-display)",
                                  fontWeight: 700,
                                  color: "#aaa",
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                  marginBottom: 3,
                                }}
                              >
                                {c.label}
                              </div>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontFamily: "var(--font-display)",
                                  fontWeight: 800,
                                  color: "var(--gfi-bg-secondary)",
                                }}
                              >
                                {c.value}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Amenities */}
                  {fichaActual.amenities.length > 0 && (
                    <div
                      style={{
                        padding: "18px 32px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 9,
                          color: "#aaa",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          marginBottom: 10,
                        }}
                      >
                        Amenities
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {fichaActual.amenities.map((a) => (
                          <span
                            key={a}
                            style={{
                              display: "inline-block",
                              background: `${fichaActual.color_primario}18`,
                              border: `1px solid ${fichaActual.color_primario}33`,
                              color: fichaActual.color_primario,
                              padding: "4px 12px",
                              borderRadius: 20,
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descripción */}
                  {fichaActual.descripcion_larga && (
                    <div
                      style={{
                        padding: "18px 32px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 9,
                          color: "#aaa",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Descripción
                      </div>
                      <p
                        style={{
                          fontSize: 13,
                          color: "#444",
                          lineHeight: 1.7,
                          margin: 0,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {fichaActual.descripcion_larga}
                      </p>
                    </div>
                  )}

                  {/* Puntos destacados */}
                  {fichaActual.puntos_destacados.length > 0 && (
                    <div
                      style={{
                        padding: "18px 32px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 9,
                          color: "#aaa",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Puntos destacados
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          listStyleType: "disc",
                        }}
                      >
                        {fichaActual.puntos_destacados.map((p, i) => (
                          <li
                            key={i}
                            style={{
                              fontSize: 13,
                              color: "#444",
                              marginBottom: 5,
                              lineHeight: 1.5,
                            }}
                          >
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer corredor */}
                  <div
                    style={{
                      padding: "20px 32px",
                      background: "#f8f8f8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 800,
                          fontSize: 13,
                          color: "var(--gfi-bg-secondary)",
                        }}
                      >
                        {fichaActual.nombre_corredor || "Corredor inmobiliario"}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#888",
                          marginTop: 2,
                        }}
                      >
                        Corredor inmobiliario
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {fichaActual.telefono_corredor && (
                        <div style={{ fontSize: 12, color: "#555" }}>
                          📞 {fichaActual.telefono_corredor}
                        </div>
                      )}
                      {fichaActual.email_corredor && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#555",
                            marginTop: 2,
                          }}
                        >
                          ✉️ {fichaActual.email_corredor}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modal selector de cartera ──────────────────────────────────────── */}
      {mostrarSelector && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setMostrarSelector(false)}
        >
          <div
            style={{
              background: "var(--gfi-bg-secondary)",
              border: "1px solid #222",
              borderRadius: 12,
              padding: 28,
              maxWidth: 560,
              width: "100%",
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMostrarSelector(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 14,
                background: "none",
                border: "none",
                color: "rgba(224,224,224,0.3)",
                fontSize: 20,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>

            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 14,
                color: "#fff",
                marginBottom: 4,
              }}
            >
              Seleccionar propiedad de la cartera
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(224,224,224,0.35)",
                marginBottom: 18,
                fontFamily: "var(--font-body)",
              }}
            >
              Los datos disponibles se pre-cargarán en la ficha
            </div>

            {loadingProps ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  flex: 1,
                  overflow: "auto",
                }}
              >
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="skel"
                    style={{ height: 60, borderRadius: 8 }}
                  />
                ))}
              </div>
            ) : propiedades.length === 0 ? (
              <div
                style={{
                  padding: "32px 0",
                  textAlign: "center",
                  color: "rgba(224,224,224,0.35)",
                  fontSize: 13,
                }}
              >
                No hay propiedades en tu cartera
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {propiedades.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => crearFichaDesdePropiedad(p)}
                    style={{
                      background: "var(--gfi-bg-card)",
                      border: "1px solid #222",
                      borderRadius: 8,
                      padding: "10px 12px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.15s, background 0.15s",
                      width: "100%",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "rgba(153,0,0,0.4)";
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(153,0,0,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "#222";
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--gfi-bg-card)";
                    }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 6, flexShrink: 0, overflow: "hidden", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {p.fotos?.[0]
                        ? <img src={p.fotos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 22, opacity: 0.2 }}>🏠</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#e0e0e0",
                        marginBottom: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.descripcion || "Propiedad sin descripción"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      {p.tipo && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(224,224,224,0.4)",
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                          }}
                        >
                          {p.tipo}
                        </span>
                      )}
                      {p.operacion && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(224,224,224,0.4)",
                          }}
                        >
                          {p.operacion}
                        </span>
                      )}
                      {p.zona && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(224,224,224,0.35)",
                          }}
                        >
                          📍 {p.zona}
                        </span>
                      )}
                      {p.precio && p.moneda && (
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            color: "#990000",
                          }}
                        >
                          {p.moneda} {p.precio.toLocaleString("es-AR")}
                        </span>
                      )}
                      {p.estado && (
                        <span
                          style={{
                            fontSize: 9,
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid #222",
                            borderRadius: 4,
                            padding: "2px 7px",
                            color: "rgba(224,224,224,0.3)",
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {p.estado}
                        </span>
                      )}
                    </div>
                    </div>{/* end flex inner */}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setMostrarSelector(false)}
              style={{
                marginTop: 16,
                background: "none",
                border: "none",
                color: "rgba(224,224,224,0.25)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                textAlign: "center",
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
