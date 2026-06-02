"use client";

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from "react";
import { supabase } from "../../../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContactoImport {
  rowIndex: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  tipo: string;
  notas: string;
  _valido: boolean;
  _errores: string[];
  _importado: boolean;
}

type EstadoImport = "idle" | "preview" | "importing" | "done";
type FiltroVista = "todos" | "validos" | "errores";

const CAMPOS_ESPERADOS = ["nombre", "apellido", "telefono", "email", "tipo", "notas"] as const;
type CampoEsperado = typeof CAMPOS_ESPERADOS[number];

const TIPOS_VALIDOS = ["cliente", "propietario", "colega", "otro"] as const;
type TipoValido = typeof TIPOS_VALIDOS[number];

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  return text.trim().split("\n").map(row =>
    row.split(/[,;]/).map(cell => cell.trim().replace(/^"|"$/g, ""))
  );
}

// ── Validación ────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarContacto(c: Omit<ContactoImport, "_valido" | "_errores" | "_importado">): string[] {
  const errores: string[] = [];
  if (!c.nombre || c.nombre.trim().length < 2) errores.push("Nombre requerido (mín. 2 caracteres)");
  if (c.email && !EMAIL_REGEX.test(c.email.trim())) errores.push("Email con formato inválido");
  if (c.telefono && (c.telefono.replace(/[\d+]/g, "").length > 0 || c.telefono.replace(/\D/g, "").length < 8)) {
    errores.push("Teléfono: solo dígitos y +, mín. 8 dígitos");
  }
  if (c.tipo && !(TIPOS_VALIDOS as readonly string[]).includes(c.tipo)) {
    errores.push(`Tipo inválido (debe ser: ${TIPOS_VALIDOS.join(", ")})`);
  }
  return errores;
}

function construirContacto(
  row: string[],
  mapeo: Record<CampoEsperado, number>,
  rowIndex: number
): ContactoImport {
  const get = (campo: CampoEsperado): string => {
    const idx = mapeo[campo];
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  const base = {
    rowIndex,
    nombre: get("nombre"),
    apellido: get("apellido"),
    telefono: get("telefono"),
    email: get("email"),
    tipo: get("tipo"),
    notas: get("notas"),
  };

  const errores = validarContacto(base);
  return { ...base, _valido: errores.length === 0, _errores: errores, _importado: false };
}

// ── Plantilla CSV ─────────────────────────────────────────────────────────────

function descargarPlantilla() {
  const contenido = [
    "nombre,apellido,telefono,email,tipo,notas",
    "Juan,García,+5411234567,juan@email.com,cliente,contacto portal",
    "María,López,01154321234,maria@email.com,propietario,inmueble en Palermo",
  ].join("\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_contactos_crm.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Styles helpers ────────────────────────────────────────────────────────────

const S = {
  btn: (variant: "primary" | "secondary" | "ghost" = "secondary"): React.CSSProperties => ({
    fontFamily: "Inter,sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 20px",
    borderRadius: 6,
    border: variant === "ghost" ? "1px solid var(--gfi-border)" : "none",
    cursor: "pointer",
    transition: "opacity 0.15s",
    background:
      variant === "primary" ? "#990000"
      : variant === "secondary" ? "var(--gfi-border-subtle)"
      : "transparent",
    color: "#fff",
  }),
  label: (): React.CSSProperties => ({
    fontFamily: "Inter,sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--gfi-text-muted)",
    marginBottom: 6,
    display: "block",
  }),
  select: (): React.CSSProperties => ({
    background: "var(--gfi-border-subtle)",
    border: "1px solid var(--gfi-border)",
    borderRadius: 5,
    color: "#fff",
    fontFamily: "Inter,sans-serif",
    fontSize: 12,
    padding: "5px 8px",
  }),
  input: (): React.CSSProperties => ({
    background: "var(--gfi-border-subtle)",
    border: "1px solid var(--gfi-border)",
    borderRadius: 5,
    color: "#fff",
    fontFamily: "Inter,sans-serif",
    fontSize: 12,
    padding: "4px 8px",
    width: "100%",
    boxSizing: "border-box" as const,
  }),
  card: (): React.CSSProperties => ({
    background: "var(--gfi-bg-card)",
    border: "1px solid var(--gfi-border)",
    borderRadius: 10,
    padding: "20px 24px",
  }),
  chip: (ok: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "Inter,sans-serif",
    background: ok ? "rgba(34,197,94,0.15)" : "rgba(153,0,0,0.18)",
    color: ok ? "#4ade80" : "#f87171",
    border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(153,0,0,0.35)"}`,
    cursor: ok ? "default" : "help",
  }),
};

// ── Paso Indicator ────────────────────────────────────────────────────────────

function PasoIndicator({ paso }: { paso: number }) {
  const pasos = ["Cargar archivo", "Mapear columnas", "Previsualizar", "Importar"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {pasos.map((label, i) => {
        const num = i + 1;
        const activo = num === paso;
        const completado = num < paso;
        return (
          <div key={num} style={{ display: "flex", alignItems: "center", flex: i < pasos.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)",
                fontSize: 13, fontWeight: 700,
                background: completado ? "#990000" : activo ? "rgba(153,0,0,0.2)" : "rgba(255,255,255,0.06)",
                border: activo ? "2px solid #990000" : completado ? "2px solid #990000" : "2px solid var(--gfi-border)",
                color: completado ? "#fff" : activo ? "#990000" : "var(--gfi-text-muted)",
              }}>
                {completado ? "✓" : num}
              </div>
              <span style={{
                fontFamily: "Inter,sans-serif",
                fontSize: 11,
                fontWeight: activo ? 600 : 400,
                color: activo ? "#fff" : "var(--gfi-text-muted)",
                whiteSpace: "nowrap",
              }}>
                {label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div style={{
                flex: 1, height: 1,
                background: completado ? "#990000" : "var(--gfi-border)",
                margin: "-18px 8px 0",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CargaMasivaPage() {
  const [estado, setEstado] = useState<EstadoImport>("idle");
  const [paso, setPaso] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [textoCSV, setTextoCSV] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapeo, setMapeo] = useState<Record<CampoEsperado, number>>(
    {} as Record<CampoEsperado, number>
  );
  const [contactos, setContactos] = useState<ContactoImport[]>([]);
  const [filtroVista, setFiltroVista] = useState<FiltroVista>("todos");
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; campo: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultadoImport, setResultadoImport] = useState<{ ok: number; err: number; errores: string[] } | null>(null);
  const [modoTexto, setModoTexto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── CSV processing ────────────────────────────────────────────────────────

  const procesarTexto = useCallback((text: string) => {
    if (!text.trim()) return;
    setTextoCSV(text);
    const filas = parseCSV(text);
    if (filas.length < 2) return;
    const headers = filas[0].map(h => h.toLowerCase().trim());
    const rows = filas.slice(1).filter(r => r.some(c => c.trim()));
    setRawHeaders(headers);
    setRawRows(rows);

    // Auto-mapeo
    const autoMapeo: Record<CampoEsperado, number> = {
      nombre: -1, apellido: -1, telefono: -1, email: -1, tipo: -1, notas: -1,
    };
    CAMPOS_ESPERADOS.forEach(campo => {
      const idx = headers.findIndex(h =>
        h === campo ||
        (campo === "nombre" && (h === "name" || h === "first name" || h === "firstname")) ||
        (campo === "apellido" && (h === "apellido" || h === "lastname" || h === "last name" || h === "surname")) ||
        (campo === "telefono" && (h === "telefono" || h === "phone" || h === "tel" || h === "celular" || h === "teléfono")) ||
        (campo === "email" && (h === "email" || h === "e-mail" || h === "correo")) ||
        (campo === "tipo" && (h === "tipo" || h === "type" || h === "category" || h === "categoria")) ||
        (campo === "notas" && (h === "notas" || h === "notes" || h === "nota" || h === "comentario" || h === "comentarios"))
      );
      autoMapeo[campo] = idx;
    });
    setMapeo(autoMapeo);
    setPaso(2);
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") procesarTexto(text);
    };
    reader.readAsText(file, "UTF-8");
  }, [procesarTexto]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Mapeo → construir contactos ───────────────────────────────────────────

  const aplicarMapeo = useCallback(() => {
    const built = rawRows.map((row, i) => construirContacto(row, mapeo, i + 2));
    setContactos(built);
    setEstado("preview");
    setPaso(3);
  }, [rawRows, mapeo]);

  // ── Edición inline ────────────────────────────────────────────────────────

  const startEdit = (rowIndex: number, campo: string, valor: string) => {
    setEditingCell({ rowIndex, campo });
    setEditingValue(valor);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { rowIndex, campo } = editingCell;
    setContactos(prev => prev.map(c => {
      if (c.rowIndex !== rowIndex) return c;
      const updated = { ...c, [campo]: editingValue };
      const errores = validarContacto(updated);
      return { ...updated, _valido: errores.length === 0, _errores: errores };
    }));
    setEditingCell(null);
    setEditingValue("");
  };

  const corregirTodos = () => {
    setContactos(prev => prev.map(c => {
      if (c._valido) return c;
      const updated = { ...c, tipo: c.tipo || "cliente" };
      const errores = validarContacto(updated);
      return { ...updated, _valido: errores.length === 0, _errores: errores };
    }));
  };

  // ── Importación ───────────────────────────────────────────────────────────

  const importar = async () => {
    setEstado("importing");
    setPaso(4);
    setProgress(0);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setResultadoImport({ ok: 0, err: 0, errores: ["No autenticado"] });
      setEstado("done");
      return;
    }

    const validos = contactos.filter(c => c._valido && !c._importado);
    const BATCH = 50;
    let importados = 0;
    const errores: string[] = [];

    for (let i = 0; i < validos.length; i += BATCH) {
      const batch = validos.slice(i, i + BATCH);
      const { error } = await supabase.from("crm_contactos").insert(
        batch.map(c => ({
          perfil_id: user.id,
          nombre: c.nombre,
          apellido: c.apellido,
          telefono: c.telefono || null,
          email: c.email || null,
          tipo: c.tipo || "cliente",
          notas: c.notas || null,
          estado: "lead:nuevo",
        }))
      );
      if (error) {
        errores.push(`Lote ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        importados += batch.length;
        setContactos(prev => prev.map(c =>
          batch.some(b => b.rowIndex === c.rowIndex) ? { ...c, _importado: true } : c
        ));
      }
      setProgress(Math.round(((i + BATCH) / validos.length) * 100));
    }

    setProgress(100);
    setResultadoImport({ ok: importados, err: errores.length, errores });
    setEstado("done");
  };

  // ── Reiniciar ─────────────────────────────────────────────────────────────

  const reiniciar = () => {
    setEstado("idle");
    setPaso(1);
    setTextoCSV("");
    setRawHeaders([]);
    setRawRows([]);
    setMapeo({} as Record<CampoEsperado, number>);
    setContactos([]);
    setFiltroVista("todos");
    setEditingCell(null);
    setProgress(0);
    setResultadoImport(null);
    setModoTexto(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalValidos = contactos.filter(c => c._valido).length;
  const totalErrores = contactos.filter(c => !c._valido).length;
  const total = contactos.length;

  const contactosFiltrados = contactos.filter(c => {
    if (filtroVista === "validos") return c._valido;
    if (filtroVista === "errores") return !c._valido;
    return true;
  });

  const mapeoCompleto = CAMPOS_ESPERADOS.filter(c => c !== "notas" && c !== "apellido" && c !== "telefono" && c !== "email" && c !== "tipo")
    .every(campo => mapeo[campo] !== undefined && mapeo[campo] >= 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100%",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "Inter,sans-serif",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 800,
          color: "#fff",
          margin: 0,
          letterSpacing: "-0.02em",
        }}>
          Importación Masiva de Contactos
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--gfi-text-muted)" }}>
          Cargá contactos al CRM desde un archivo CSV o pegando texto de Excel
        </p>
      </div>

      {/* Progress Steps */}
      <PasoIndicator paso={paso} />

      {/* ── PASO 1: Carga ─────────────────────────────────────────────────── */}
      {paso === 1 && (
        <div style={{ maxWidth: 700 }}>
          {/* Drag & Drop */}
          {!modoTexto && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "#990000" : "rgba(255,255,255,0.18)"}`,
                borderRadius: 12,
                padding: "52px 32px",
                textAlign: "center",
                cursor: "pointer",
                background: dragging ? "rgba(153,0,0,0.04)" : "var(--gfi-bg-secondary)",
                transition: "all 0.2s",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>⬆</div>
              <p style={{
                fontFamily: "var(--font-display)",
                fontSize: 15, fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
                margin: "0 0 8px",
              }}>
                Arrastrá tu archivo CSV aquí
              </p>
              <p style={{ fontSize: 13, color: "var(--gfi-text-muted)", margin: 0 }}>
                o hacé clic para seleccionar un archivo .csv / .txt
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                style={{ display: "none" }}
                onChange={onFileChange}
              />
            </div>
          )}

          {/* Toggle modo texto */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => setModoTexto(false)}
              style={{ ...S.btn(modoTexto ? "ghost" : "secondary"), fontSize: 12 }}
            >
              📄 Desde archivo
            </button>
            <button
              onClick={() => setModoTexto(true)}
              style={{ ...S.btn(!modoTexto ? "ghost" : "secondary"), fontSize: 12 }}
            >
              📋 Pegar desde Excel
            </button>
            <button onClick={descargarPlantilla} style={{ ...S.btn("ghost"), fontSize: 12, marginLeft: "auto" }}>
              ⬇ Descargar plantilla
            </button>
          </div>

          {/* Textarea pegar */}
          {modoTexto && (
            <div style={{ marginBottom: 20 }}>
              <label style={S.label()}>Pegá el contenido del CSV o Excel</label>
              <textarea
                value={textoCSV}
                onChange={e => setTextoCSV(e.target.value)}
                rows={10}
                placeholder={"nombre,apellido,telefono,email,tipo,notas\nJuan,García,+5411234567,juan@email.com,cliente,contacto portal"}
                style={{
                  ...S.input(),
                  resize: "vertical",
                  padding: "10px 12px",
                  lineHeight: 1.6,
                  fontFamily: "monospace",
                }}
              />
              <button
                onClick={() => procesarTexto(textoCSV)}
                disabled={!textoCSV.trim()}
                style={{
                  ...S.btn("primary"),
                  marginTop: 12,
                  opacity: textoCSV.trim() ? 1 : 0.4,
                }}
              >
                Procesar texto →
              </button>
            </div>
          )}

          {/* Formato ejemplo */}
          <div style={S.card()}>
            <div style={{ ...S.label(), marginBottom: 10 }}>Formato esperado</div>
            <pre style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: "var(--gfi-text-secondary)",
              margin: 0,
              lineHeight: 1.7,
              overflowX: "auto",
            }}>
{`nombre,apellido,telefono,email,tipo,notas
Juan,García,+5411234567,juan@email.com,cliente,contacto portal
María,López,01154321234,maria@email.com,propietario,inmueble en Palermo
Carlos,Ruiz,,carlos@gmail.com,colega,`}
            </pre>
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
              {["cliente", "propietario", "colega", "otro"].map(t => (
                <span key={t} style={{
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontFamily: "Inter,sans-serif",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.55)",
                  border: "1px solid var(--gfi-border)",
                }}>
                  tipo: {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 2: Mapeo ─────────────────────────────────────────────────── */}
      {paso === 2 && (
        <div style={{ maxWidth: 700 }}>
          <div style={S.card()}>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: 15, fontWeight: 700,
              margin: "0 0 6px",
            }}>
              Mapeo de columnas
            </h2>
            <p style={{ fontSize: 13, color: "var(--gfi-text-muted)", margin: "0 0 20px" }}>
              Se detectaron {rawHeaders.length} columnas y {rawRows.length} filas.
              Confirmá cómo se mapean las columnas del archivo con los campos del CRM.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {CAMPOS_ESPERADOS.map(campo => (
                <div key={campo}>
                  <label style={S.label()}>
                    {campo}
                    {(campo === "nombre") && " *"}
                  </label>
                  <select
                    value={mapeo[campo] ?? -1}
                    onChange={e => setMapeo(prev => ({ ...prev, [campo]: Number(e.target.value) }))}
                    style={{ ...S.select(), width: "100%" }}
                  >
                    <option value={-1}>— no mapear —</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h} (col. {i + 1})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview primera fila */}
            {rawRows.length > 0 && (
              <div style={{ marginTop: 20, padding: "14px 16px", background: "var(--gfi-bg-card)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ ...S.label(), marginBottom: 10 }}>Previsualización — fila 1</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px 16px" }}>
                  {CAMPOS_ESPERADOS.map(campo => {
                    const idx = mapeo[campo];
                    const val = idx >= 0 ? (rawRows[0]?.[idx] ?? "") : "—";
                    return (
                      <div key={campo}>
                        <span style={{ fontSize: 10, color: "var(--gfi-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{campo}</span>
                        <div style={{ fontSize: 13, color: val ? "#fff" : "var(--gfi-text-dim)", marginTop: 2 }}>{val || "vacío"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setPaso(1)} style={S.btn("ghost")}>← Anterior</button>
            <button
              onClick={aplicarMapeo}
              disabled={!mapeoCompleto}
              style={{ ...S.btn("primary"), opacity: mapeoCompleto ? 1 : 0.4 }}
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Previsualización ───────────────────────────────────────── */}
      {paso === 3 && (
        <div>
          {/* Estadísticas */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
            {[
              { label: "Total", val: total, color: "var(--gfi-text-primary)" },
              { label: "Válidos", val: totalValidos, color: "#4ade80" },
              { label: "Con errores", val: totalErrores, color: "#f87171" },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: "14px 20px",
                background: "var(--gfi-bg-card)",
                border: "1px solid var(--gfi-border)",
                borderRadius: 8,
                minWidth: 110,
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.val}</div>
                <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "flex-start" }}>
              {(["todos", "validos", "errores"] as FiltroVista[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroVista(f)}
                  style={{
                    ...S.btn(filtroVista === f ? "secondary" : "ghost"),
                    fontSize: 12,
                    padding: "7px 14px",
                    background: filtroVista === f ? "rgba(153,0,0,0.15)" : "transparent",
                    border: filtroVista === f ? "1px solid rgba(153,0,0,0.4)" : "1px solid var(--gfi-border)",
                  }}
                >
                  {f === "todos" ? "Todos" : f === "validos" ? "Solo válidos" : "Solo errores"}
                </button>
              ))}
            </div>
          </div>

          {/* Acción masiva */}
          {totalErrores > 0 && (
            <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={corregirTodos} style={{ ...S.btn("ghost"), fontSize: 12 }}>
                ✦ Corregir todos — asignar tipo "cliente" donde falte
              </button>
            </div>
          )}

          {/* Tabla */}
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--gfi-border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const, minWidth: 800 }}>
              <thead>
                <tr style={{ background: "var(--gfi-bg-card)" }}>
                  {["#", "Nombre", "Apellido", "Teléfono", "Email", "Tipo", "Estado"].map(h => (
                    <th key={h} style={{
                      padding: "10px 14px",
                      textAlign: "left" as const,
                      fontFamily: "Inter,sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase" as const,
                      color: "var(--gfi-text-muted)",
                      borderBottom: "1px solid var(--gfi-border-subtle)",
                      whiteSpace: "nowrap" as const,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contactosFiltrados.map(c => {
                  const isEditing = (campo: string) =>
                    editingCell?.rowIndex === c.rowIndex && editingCell?.campo === campo;

                  const CeldaEdit = ({ campo, valor }: { campo: string; valor: string }) => {
                    if (isEditing(campo)) {
                      return campo === "tipo" ? (
                        <select
                          autoFocus
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={commitEdit}
                          style={S.select()}
                        >
                          <option value="">—</option>
                          {TIPOS_VALIDOS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <input
                          autoFocus
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === "Enter") commitEdit(); }}
                          style={S.input()}
                        />
                      );
                    }
                    const tieneError = c._errores.some(err => err.toLowerCase().includes(
                      campo === "nombre" ? "nombre"
                      : campo === "email" ? "email"
                      : campo === "telefono" ? "tel"
                      : campo === "tipo" ? "tipo"
                      : ""
                    ));
                    return (
                      <span
                        onClick={() => startEdit(c.rowIndex, campo, valor)}
                        title="Clic para editar"
                        style={{
                          cursor: "text",
                          color: !valor ? "var(--gfi-text-dim)" : tieneError ? "#f87171" : "rgba(255,255,255,0.85)",
                          fontSize: 13,
                          display: "block",
                          minWidth: 60,
                          padding: "2px 4px",
                          borderRadius: 3,
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; }}
                      >
                        {valor || "—"}
                      </span>
                    );
                  };

                  return (
                    <tr
                      key={c.rowIndex}
                      style={{
                        borderBottom: "1px solid var(--gfi-border-subtle)",
                        background: c._importado ? "rgba(34,197,94,0.04)" : "transparent",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c._importado ? "rgba(34,197,94,0.06)" : "var(--gfi-bg-secondary)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = c._importado ? "rgba(34,197,94,0.04)" : "transparent"; }}
                    >
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--gfi-text-dim)", fontFamily: "monospace" }}>{c.rowIndex}</td>
                      <td style={{ padding: "9px 14px" }}><CeldaEdit campo="nombre" valor={c.nombre} /></td>
                      <td style={{ padding: "9px 14px" }}><CeldaEdit campo="apellido" valor={c.apellido} /></td>
                      <td style={{ padding: "9px 14px" }}><CeldaEdit campo="telefono" valor={c.telefono} /></td>
                      <td style={{ padding: "9px 14px" }}><CeldaEdit campo="email" valor={c.email} /></td>
                      <td style={{ padding: "9px 14px" }}><CeldaEdit campo="tipo" valor={c.tipo} /></td>
                      <td style={{ padding: "9px 14px" }}>
                        <span
                          style={S.chip(c._valido)}
                          title={c._errores.length > 0 ? c._errores.join(" | ") : undefined}
                        >
                          {c._importado ? "✓ Importado" : c._valido ? "Válido" : `Error (${c._errores.length})`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {contactosFiltrados.length === 0 && (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--gfi-text-dim)", fontSize: 13 }}>
                No hay registros con este filtro
              </div>
            )}
          </div>

          {/* Botones */}
          <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center" }}>
            <button onClick={() => { setPaso(2); setEstado("idle"); }} style={S.btn("ghost")}>← Anterior</button>
            <button
              onClick={importar}
              disabled={totalValidos === 0}
              style={{
                ...S.btn("primary"),
                opacity: totalValidos > 0 ? 1 : 0.4,
                padding: "10px 24px",
                fontSize: 14,
              }}
            >
              Importar {totalValidos} contacto{totalValidos !== 1 ? "s" : ""} válido{totalValidos !== 1 ? "s" : ""}
            </button>
            {totalErrores > 0 && (
              <span style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>
                {totalErrores} no se importarán
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── PASO 4: Importando / Done ──────────────────────────────────────── */}
      {paso === 4 && (
        <div style={{ maxWidth: 600 }}>
          {estado === "importing" && (
            <div style={S.card()}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>
                Importando contactos...
              </h2>
              <div style={{
                height: 8,
                background: "var(--gfi-border)",
                borderRadius: 4,
                overflow: "hidden",
                marginBottom: 14,
              }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(progress, 100)}%`,
                  background: "#990000",
                  borderRadius: 4,
                  transition: "width 0.3s ease",
                }} />
              </div>
              <p style={{ fontSize: 13, color: "var(--gfi-text-muted)", margin: 0 }}>
                {Math.min(progress, 100)}% completado
              </p>
            </div>
          )}

          {estado === "done" && resultadoImport && (
            <div style={S.card()}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: resultadoImport.ok > 0 ? "rgba(34,197,94,0.15)" : "rgba(153,0,0,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  {resultadoImport.ok > 0 ? "✓" : "✕"}
                </div>
                <div>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, margin: 0 }}>
                    Importación completada
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--gfi-text-muted)" }}>
                    {resultadoImport.ok} importados exitosamente
                    {resultadoImport.err > 0 && `, ${resultadoImport.err} lote${resultadoImport.err !== 1 ? "s" : ""} con errores`}
                  </p>
                </div>
              </div>

              {/* Detalle stats */}
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, padding: "14px 16px", background: "rgba(34,197,94,0.08)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "#4ade80" }}>{resultadoImport.ok}</div>
                  <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 2 }}>Importados</div>
                </div>
                {resultadoImport.err > 0 && (
                  <div style={{ flex: 1, padding: "14px 16px", background: "rgba(153,0,0,0.08)", borderRadius: 8, border: "1px solid rgba(153,0,0,0.2)" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "#f87171" }}>{resultadoImport.err}</div>
                    <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 2 }}>Lotes con error</div>
                  </div>
                )}
              </div>

              {/* Errores de inserción */}
              {resultadoImport.errores.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ ...S.label(), marginBottom: 8 }}>Errores de inserción</div>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                    {resultadoImport.errores.map((err, i) => (
                      <div key={i} style={{
                        padding: "8px 12px",
                        background: "rgba(153,0,0,0.1)",
                        border: "1px solid rgba(153,0,0,0.2)",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#f87171",
                        fontFamily: "monospace",
                      }}>
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={reiniciar} style={S.btn("primary")}>
                  ↺ Importar nuevamente
                </button>
                <a
                  href="/crm"
                  style={{
                    ...S.btn("ghost"),
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Ver contactos →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
