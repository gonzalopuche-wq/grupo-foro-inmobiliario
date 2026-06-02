"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

type Categoria =
  | "legal"
  | "fiscal"
  | "ventas"
  | "marketing"
  | "procesos"
  | "plantillas"
  | "otro";

interface Articulo {
  id: string;
  titulo: string;
  categoria: Categoria;
  contenido: string;
  tags: string[];
  favorito: boolean;
  created_at: string;
  updated_at: string;
}

const CAT_COLORS: Record<Categoria, string> = {
  legal: "#3b82f6",
  fiscal: "#d4960c",
  ventas: "#3abab6",
  marketing: "#8b5cf6",
  procesos: "#d4960c",
  plantillas: "#ec4899",
  otro: "#6b7280",
};

const CAT_LABELS: Record<Categoria, string> = {
  legal: "Legal",
  fiscal: "Fiscal",
  ventas: "Ventas",
  marketing: "Marketing",
  procesos: "Procesos",
  plantillas: "Plantillas",
  otro: "Otro",
};

const CATEGORIAS: Categoria[] = [
  "legal",
  "fiscal",
  "ventas",
  "marketing",
  "procesos",
  "plantillas",
  "otro",
];

const ARTICULOS_INICIALES: Articulo[] = [
  {
    id: "init-1",
    titulo: "Pasos para escritura de compraventa",
    categoria: "legal",
    contenido:
      "1. Firma boleto de compraventa\n2. Solicitar informe de dominio al Registro de la Propiedad\n3. Obtener certificado de libre deuda TGI (Municipalidad)\n4. Coordinar con escribanía la fecha de escritura\n5. Preparar documentación: DNI, CUIT, planos aprobados\n6. Firma de escritura y pago de gastos notariales\n7. Inscripción en el Registro de la Propiedad (15-30 días)",
    tags: ["escritura", "legal", "venta"],
    favorito: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "init-2",
    titulo: "Template: email de seguimiento comprador",
    categoria: "plantillas",
    contenido:
      "Asunto: Seguimiento de su consulta - [Dirección de propiedad]\n\nEstimado/a [Nombre],\n\nMe comunico para dar seguimiento a su consulta sobre la propiedad ubicada en [Dirección].\n\n¿Tuvo oportunidad de evaluar la propuesta? Quedo a disposición para cualquier consulta o para coordinar una visita.\n\nSaludos cordiales,\n[Nombre del corredor]\n[Teléfono] | [Email]",
    tags: ["email", "plantilla", "comprador", "seguimiento"],
    favorito: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "init-3",
    titulo: "Gastos de compraventa en Rosario 2024",
    categoria: "fiscal",
    contenido:
      "COMPRADORES:\n- Honorarios inmobiliaria: 3-4% + IVA\n- Escribanía: 1.5-2% (varía por monto)\n- Sellado provincial: 1.5%\n- IVA actos jurídicos: 0.3%\n- Impuesto de sellos municipal: 0.3%\nTotal estimado comprador: 6.5-8%\n\nVENDEDORES:\n- Honorarios inmobiliaria: 3-4% + IVA\n- Plusvalía/ITI: 1.5% (bienes pre-2018) o 15% cedular (post-2018)\n- Certificados varios: $50.000-80.000\nTotal estimado vendedor: 5-8%",
    tags: ["gastos", "compraventa", "rosario", "fiscal"],
    favorito: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "init-4",
    titulo: "Checklist de tasación",
    categoria: "procesos",
    contenido:
      "PRE-VISITA:\n☐ Confirmar dirección y horario\n☐ Investigar operaciones comparables en la zona\n☐ Revisar valuación fiscal (API Santa Fe/catastro municipal)\n\nDURANTE LA VISITA:\n☐ Fotografiar todos los ambientes\n☐ Medir superficie cubierta y semicubierta\n☐ Registrar estado general (bueno/regular/malo)\n☐ Anotar amenities del edificio\n☐ Verificar año de construcción\n\nINFORME:\n☐ Buscar 3+ comparables recientes\n☐ Aplicar ajustes por diferencias\n☐ Calcular rango de valor (±10%)\n☐ Redactar informe en PDF",
    tags: ["tasación", "checklist", "proceso"],
    favorito: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FormState {
  titulo: string;
  categoria: Categoria;
  contenido: string;
  tagsInput: string;
  favorito: boolean;
}

const FORM_VACIO: FormState = {
  titulo: "",
  categoria: "otro",
  contenido: "",
  tagsInput: "",
  favorito: false,
};

function articuloToForm(a: Articulo): FormState {
  return {
    titulo: a.titulo,
    categoria: a.categoria,
    contenido: a.contenido,
    tagsInput: a.tags.join(", "),
    favorito: a.favorito,
  };
}

export default function BaseConocimientoPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [esNuevo, setEsNuevo] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCat, setFiltroCat] = useState<Categoria | "todos">("todos");

  // Auth + cargar desde Supabase
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      const { data: row } = await supabase
        .from("crm_base_conocimiento")
        .select("articulos")
        .eq("perfil_id", data.user.id)
        .single();
      if (row && Array.isArray(row.articulos) && row.articulos.length > 0) {
        setArticulos(row.articulos as Articulo[]);
      } else {
        setArticulos(ARTICULOS_INICIALES);
      }
      setHidratado(true);
    });
  }, []);

  // Guardar en Supabase en cada cambio
  useEffect(() => {
    if (!hidratado || !uid) return;
    supabase
      .from("crm_base_conocimiento")
      .upsert({ perfil_id: uid, articulos, updated_at: new Date().toISOString() }, { onConflict: "perfil_id" });
  }, [articulos, hidratado, uid]);

  const articuloSeleccionado = useMemo(
    () => articulos.find((a) => a.id === seleccionadoId) ?? null,
    [articulos, seleccionadoId]
  );

  const articulosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return articulos.filter((a) => {
      const matchCat = filtroCat === "todos" || a.categoria === filtroCat;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        a.titulo.toLowerCase().includes(q) ||
        a.contenido.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [articulos, busqueda, filtroCat]);

  function handleSeleccionar(id: string) {
    setSeleccionadoId(id);
    setModoEdicion(false);
    setEsNuevo(false);
  }

  function handleNuevo() {
    setSeleccionadoId(null);
    setEsNuevo(true);
    setModoEdicion(true);
    setForm(FORM_VACIO);
  }

  function handleEditar() {
    if (!articuloSeleccionado) return;
    setForm(articuloToForm(articuloSeleccionado));
    setModoEdicion(true);
    setEsNuevo(false);
  }

  function handleCancelar() {
    setModoEdicion(false);
    setEsNuevo(false);
    if (esNuevo) setSeleccionadoId(null);
  }

  function handleGuardar() {
    const tags = form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const now = new Date().toISOString();

    if (esNuevo) {
      const nuevo: Articulo = {
        id: crypto.randomUUID(),
        titulo: form.titulo.trim() || "Sin título",
        categoria: form.categoria,
        contenido: form.contenido,
        tags,
        favorito: form.favorito,
        created_at: now,
        updated_at: now,
      };
      setArticulos((prev) => [nuevo, ...prev]);
      setSeleccionadoId(nuevo.id);
    } else if (articuloSeleccionado) {
      const actualizado: Articulo = {
        ...articuloSeleccionado,
        titulo: form.titulo.trim() || "Sin título",
        categoria: form.categoria,
        contenido: form.contenido,
        tags,
        favorito: form.favorito,
        updated_at: now,
      };
      setArticulos((prev) =>
        prev.map((a) => (a.id === actualizado.id ? actualizado : a))
      );
    }

    setModoEdicion(false);
    setEsNuevo(false);
  }

  function handleDuplicar() {
    if (!articuloSeleccionado) return;
    const now = new Date().toISOString();
    const copia: Articulo = {
      ...articuloSeleccionado,
      id: crypto.randomUUID(),
      titulo: `Copia de ${articuloSeleccionado.titulo}`,
      favorito: false,
      created_at: now,
      updated_at: now,
    };
    setArticulos((prev) => [copia, ...prev]);
    setSeleccionadoId(copia.id);
  }

  function handleToggleFavorito() {
    if (!articuloSeleccionado) return;
    setArticulos((prev) =>
      prev.map((a) =>
        a.id === articuloSeleccionado.id
          ? { ...a, favorito: !a.favorito, updated_at: new Date().toISOString() }
          : a
      )
    );
  }

  function handleEliminar() {
    if (!articuloSeleccionado) return;
    const ok = window.confirm(
      `¿Eliminar "${articuloSeleccionado.titulo}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setArticulos((prev) => prev.filter((a) => a.id !== articuloSeleccionado.id));
    setSeleccionadoId(null);
    setModoEdicion(false);
  }

  function setFormField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (!hidratado) {
    return (
      <div
        style={{
          background: "#0a0a0a",
          color: "var(--gfi-text-muted)",
          height: "calc(100vh - 140px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
        }}
      >
        Cargando...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        background: "#0a0a0a",
        minHeight: "calc(100vh - 140px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid #1e1e1e",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 22,
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Base de Conocimiento
        </h1>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "var(--gfi-text-muted)",
            margin: "4px 0 0",
          }}
        >
          Wiki interna · {articulos.length} artículos guardados
        </p>
      </div>

      {/* Body: sidebar + panel */}
      <div
        style={{
          display: "flex",
          gap: 0,
          flex: 1,
          height: "calc(100vh - 210px)",
          background: "#0a0a0a",
        }}
      >
        {/* SIDEBAR */}
        <div
          style={{
            width: 260,
            borderRight: "1px solid #1e1e1e",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Búsqueda */}
          <div style={{ padding: "12px 12px 8px" }}>
            <input
              type="text"
              placeholder="Buscar artículos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "var(--gfi-bg-secondary)",
                border: "1px solid #2a2a2a",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#fff",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          {/* Filtro categorías */}
          <div
            style={{
              padding: "0 10px 10px",
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            {(["todos", ...CATEGORIAS] as Array<Categoria | "todos">).map((cat) => {
              const activo = filtroCat === cat;
              const color =
                cat === "todos" ? "#fff" : CAT_COLORS[cat as Categoria];
              return (
                <button
                  key={cat}
                  onClick={() => setFiltroCat(cat)}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 20,
                    border: activo
                      ? `1px solid ${color}`
                      : "1px solid #2a2a2a",
                    background: activo
                      ? `${color}22`
                      : "transparent",
                    color: activo ? color : "var(--gfi-text-muted)",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.4px",
                    transition: "all 0.15s",
                  }}
                >
                  {cat === "todos" ? "Todos" : CAT_LABELS[cat as Categoria]}
                </button>
              );
            })}
          </div>

          {/* Lista artículos */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {articulosFiltrados.length === 0 && (
              <div
                style={{
                  padding: "24px 16px",
                  color: "var(--gfi-text-muted)",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Sin resultados
              </div>
            )}
            {articulosFiltrados.map((a) => {
              const activo = a.id === seleccionadoId;
              return (
                <button
                  key={a.id}
                  onClick={() => handleSeleccionar(a.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: activo ? "#1a1a1a" : "transparent",
                    borderLeft: activo
                      ? "3px solid #990000"
                      : "3px solid transparent",
                    borderTop: "none",
                    borderRight: "none",
                    borderBottom: "1px solid #141414",
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "block",
                  }}
                >
                  {/* Título + favorito */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 4,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        color: activo ? "#fff" : "rgba(255,255,255,0.85)",
                        lineHeight: 1.3,
                        flex: 1,
                      }}
                    >
                      {a.titulo}
                    </span>
                    {a.favorito && (
                      <span style={{ fontSize: 11, flexShrink: 0 }}>⭐</span>
                    )}
                  </div>

                  {/* Badge categoría */}
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: "Inter, sans-serif",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: CAT_COLORS[a.categoria],
                      background: `${CAT_COLORS[a.categoria]}1a`,
                      border: `1px solid ${CAT_COLORS[a.categoria]}44`,
                      borderRadius: 4,
                      padding: "2px 6px",
                      marginBottom: 5,
                    }}
                  >
                    {CAT_LABELS[a.categoria]}
                  </span>

                  {/* Tags */}
                  {a.tags.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 3,
                        marginTop: 4,
                      }}
                    >
                      {a.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: 10,
                            color: "var(--gfi-text-muted)",
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: 3,
                            padding: "1px 5px",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {a.tags.length > 3 && (
                        <span
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: 10,
                            color: "var(--gfi-text-dim)",
                          }}
                        >
                          +{a.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Botón nuevo */}
          <div
            style={{
              padding: 12,
              borderTop: "1px solid #1e1e1e",
            }}
          >
            <button
              onClick={handleNuevo}
              style={{
                width: "100%",
                background: "#990000",
                border: "none",
                borderRadius: 6,
                padding: "9px 0",
                color: "#fff",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                letterSpacing: "0.3px",
              }}
            >
              + Nuevo artículo
            </button>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {/* Estado vacío */}
          {!articuloSeleccionado && !modoEdicion && (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--gfi-text-dim)",
                fontFamily: "Inter, sans-serif",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 48 }}>📚</span>
              <p style={{ fontSize: 15, margin: 0 }}>
                Seleccioná un artículo o creá uno nuevo
              </p>
              <button
                onClick={handleNuevo}
                style={{
                  marginTop: 8,
                  background: "transparent",
                  border: "1px solid #990000",
                  borderRadius: 6,
                  padding: "8px 20px",
                  color: "#990000",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                + Nuevo artículo
              </button>
            </div>
          )}

          {/* Modo edición */}
          {modoEdicion && (
            <div style={{ maxWidth: 760 }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--gfi-text-secondary)",
                  margin: "0 0 20px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {esNuevo ? "Nuevo artículo" : "Editar artículo"}
              </h2>

              {/* Título */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Título</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setFormField("titulo", e.target.value)}
                  placeholder="Título del artículo..."
                  style={{
                    ...inputStyle,
                    fontSize: 18,
                    fontWeight: 600,
                    fontFamily: "var(--font-display)",
                  }}
                />
              </div>

              {/* Categoría */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Categoría</label>
                <select
                  value={form.categoria}
                  onChange={(e) =>
                    setFormField("categoria", e.target.value as Categoria)
                  }
                  style={inputStyle}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {CAT_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Tags{" "}
                  <span style={{ color: "var(--gfi-text-muted)", fontWeight: 400 }}>
                    (separados por coma)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.tagsInput}
                  onChange={(e) => setFormField("tagsInput", e.target.value)}
                  placeholder="escritura, legal, venta..."
                  style={inputStyle}
                />
              </div>

              {/* Favorito */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    color: "var(--gfi-text-secondary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.favorito}
                    onChange={(e) => setFormField("favorito", e.target.checked)}
                    style={{ accentColor: "#990000", width: 14, height: 14 }}
                  />
                  Marcar como favorito ⭐
                </label>
              </div>

              {/* Contenido */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Contenido</label>
                <textarea
                  value={form.contenido}
                  onChange={(e) => setFormField("contenido", e.target.value)}
                  placeholder="Escribí el contenido del artículo..."
                  style={{
                    ...inputStyle,
                    height: 400,
                    resize: "vertical",
                    fontFamily: "monospace",
                    fontSize: 13,
                    lineHeight: 1.6,
                    background: "var(--gfi-bg-secondary)",
                  }}
                />
              </div>

              {/* Botones */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleGuardar}
                  style={{
                    background: "#990000",
                    border: "none",
                    borderRadius: 6,
                    padding: "10px 24px",
                    color: "#fff",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Guardar
                </button>
                <button
                  onClick={handleCancelar}
                  style={{
                    background: "transparent",
                    border: "1px solid #2a2a2a",
                    borderRadius: 6,
                    padding: "10px 20px",
                    color: "var(--gfi-text-secondary)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Modo lectura */}
          {articuloSeleccionado && !modoEdicion && (
            <div style={{ maxWidth: 760 }}>
              {/* Header artículo */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h2
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: 22,
                        color: "#fff",
                        margin: 0,
                        letterSpacing: "-0.3px",
                      }}
                    >
                      {articuloSeleccionado.titulo}
                    </h2>
                    {articuloSeleccionado.favorito && (
                      <span style={{ fontSize: 16 }}>⭐</span>
                    )}
                  </div>

                  {/* Badge categoría */}
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      color: CAT_COLORS[articuloSeleccionado.categoria],
                      background: `${CAT_COLORS[articuloSeleccionado.categoria]}1a`,
                      border: `1px solid ${CAT_COLORS[articuloSeleccionado.categoria]}44`,
                      borderRadius: 4,
                      padding: "3px 8px",
                    }}
                  >
                    {CAT_LABELS[articuloSeleccionado.categoria]}
                  </span>
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                  <button
                    onClick={handleEditar}
                    style={accionBtnStyle}
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleDuplicar}
                    style={accionBtnStyle}
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={handleToggleFavorito}
                    title={
                      articuloSeleccionado.favorito
                        ? "Quitar de favoritos"
                        : "Marcar favorito"
                    }
                    style={{
                      ...accionBtnStyle,
                      color: articuloSeleccionado.favorito
                        ? "#d4960c"
                        : "var(--gfi-text-secondary)",
                    }}
                  >
                    {articuloSeleccionado.favorito ? "★" : "☆"}
                  </button>
                  <button
                    onClick={handleEliminar}
                    style={{
                      ...accionBtnStyle,
                      color: "#990000",
                      borderColor: "#99000033",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Tags */}
              {articuloSeleccionado.tags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 20,
                  }}
                >
                  {articuloSeleccionado.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 11,
                        color: "var(--gfi-text-secondary)",
                        background: "var(--gfi-border-subtle)",
                        border: "1px solid var(--gfi-border)",
                        borderRadius: 4,
                        padding: "3px 8px",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Separador */}
              <div
                style={{
                  borderTop: "1px solid #1e1e1e",
                  marginBottom: 20,
                }}
              />

              {/* Contenido */}
              <pre
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                  background: "transparent",
                }}
              >
                {articuloSeleccionado.contenido}
              </pre>

              {/* Pie: fecha */}
              <div
                style={{
                  marginTop: 32,
                  paddingTop: 16,
                  borderTop: "1px solid #1a1a1a",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 11,
                  color: "var(--gfi-text-dim)",
                }}
              >
                Última actualización: {fmtFecha(articuloSeleccionado.updated_at)}
                {articuloSeleccionado.created_at !==
                  articuloSeleccionado.updated_at && (
                  <span style={{ marginLeft: 12 }}>
                    · Creado: {fmtFecha(articuloSeleccionado.created_at)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared styles
const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "Inter, sans-serif",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--gfi-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--gfi-bg-secondary)",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  padding: "10px 12px",
  color: "#fff",
  fontFamily: "Inter, sans-serif",
  fontSize: 14,
  outline: "none",
  display: "block",
};

const accionBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  padding: "7px 14px",
  color: "var(--gfi-text-secondary)",
  fontFamily: "Inter, sans-serif",
  fontSize: 12,
  cursor: "pointer",
};
