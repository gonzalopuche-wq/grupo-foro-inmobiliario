"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Parametros {
  ciudad_default: string;
  zona_default: string;
  moneda_default: string;
  operacion_default: string;
  tipo_default: string;
  honorario_propietario_default: string;
  honorario_comprador_default: string;
  honorario_compartir_default: string;
  mostrar_honorarios: boolean;
  codigo_prefijo: string;
  codigo_contador: number;
  campos_obligatorios: string[];
  nota_interna_default: string;
}

const PARAM_VACIO: Parametros = {
  ciudad_default: "Rosario",
  zona_default: "",
  moneda_default: "USD",
  operacion_default: "Venta",
  tipo_default: "Departamento",
  honorario_propietario_default: "3",
  honorario_comprador_default: "3",
  honorario_compartir_default: "50%",
  mostrar_honorarios: true,
  codigo_prefijo: "",
  codigo_contador: 1,
  campos_obligatorios: [],
  nota_interna_default: "",
};

const CAMPOS_POSIBLES = [
  { key: "precio", label: "Precio" },
  { key: "direccion", label: "Dirección" },
  { key: "zona", label: "Zona/Barrio" },
  { key: "dormitorios", label: "Dormitorios" },
  { key: "superficie_cubierta", label: "Superficie cubierta" },
  { key: "descripcion", label: "Descripción" },
  { key: "fotos", label: "Al menos 1 foto" },
];

const s: Record<string, React.CSSProperties> = {
  root: { padding: "28px 32px", maxWidth: 720, margin: "0 auto" },
  h1: { fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 4 },
  sub: { fontSize: 13, color: "#6b7280", marginBottom: 28 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "24px 28px", marginBottom: 20 },
  cardH: { fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
  label: { display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, color: "#111", outline: "none", boxSizing: "border-box" as const },
  select: { width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, color: "#111", outline: "none", boxSizing: "border-box" as const, background: "#fff" },
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" },
  toggleLabel: { fontSize: 13, color: "#374151", fontWeight: 500 },
  checkGrid: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
  btn: { padding: "11px 24px", background: "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  info: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
        background: value ? "#2563eb" : "#d1d5db", position: "relative", transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: value ? 21 : 3, width: 18, height: 18,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s",
      }} />
    </button>
  );
}

export default function ParametrosCarteraPage() {
  const [params, setParams] = useState<Parametros>(PARAM_VACIO);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = "/login"; return; }
      setUserId(auth.user.id);

      const { data } = await supabase
        .from("cartera_parametros")
        .select("*")
        .eq("perfil_id", auth.user.id)
        .single();

      if (data) {
        setParams({
          ciudad_default: data.ciudad_default ?? "Rosario",
          zona_default: data.zona_default ?? "",
          moneda_default: data.moneda_default ?? "USD",
          operacion_default: data.operacion_default ?? "Venta",
          tipo_default: data.tipo_default ?? "Departamento",
          honorario_propietario_default: String(data.honorario_propietario_default ?? "3"),
          honorario_comprador_default: String(data.honorario_comprador_default ?? "3"),
          honorario_compartir_default: data.honorario_compartir_default ?? "50%",
          mostrar_honorarios: data.mostrar_honorarios ?? true,
          codigo_prefijo: data.codigo_prefijo ?? "",
          codigo_contador: data.codigo_contador ?? 1,
          campos_obligatorios: data.campos_obligatorios ?? [],
          nota_interna_default: data.nota_interna_default ?? "",
        });
      }
      setLoading(false);
    };
    init();
  }, []);

  const set = (k: keyof Parametros, v: any) => setParams(p => ({ ...p, [k]: v }));

  const toggleCampo = (campo: string) => {
    const arr = params.campos_obligatorios;
    set("campos_obligatorios", arr.includes(campo) ? arr.filter(c => c !== campo) : [...arr, campo]);
  };

  const guardar = async () => {
    setGuardando(true);
    setOk(false);
    const datos = {
      perfil_id: userId,
      ciudad_default: params.ciudad_default,
      zona_default: params.zona_default || null,
      moneda_default: params.moneda_default,
      operacion_default: params.operacion_default,
      tipo_default: params.tipo_default,
      honorario_propietario_default: parseFloat(params.honorario_propietario_default) || null,
      honorario_comprador_default: parseFloat(params.honorario_comprador_default) || null,
      honorario_compartir_default: params.honorario_compartir_default,
      mostrar_honorarios: params.mostrar_honorarios,
      codigo_prefijo: params.codigo_prefijo || null,
      codigo_contador: params.codigo_contador,
      campos_obligatorios: params.campos_obligatorios,
      nota_interna_default: params.nota_interna_default || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("cartera_parametros")
      .upsert(datos, { onConflict: "perfil_id" });

    setGuardando(false);
    if (!error) { setOk(true); setTimeout(() => setOk(false), 3000); }
  };

  if (loading) return <div style={{ padding: 40, color: "#6b7280", textAlign: "center" }}>Cargando…</div>;

  return (
    <div style={s.root}>
      <h1 style={s.h1}>⚙️ Parámetros de Cartera</h1>
      <p style={s.sub}>Configurá los valores por defecto al crear nuevas propiedades. Solo se aplican al abrir el formulario vacío.</p>

      {/* Valores por defecto */}
      <div style={s.card}>
        <div style={s.cardH}>📋 Valores por defecto</div>
        <div style={{ ...s.grid3, marginBottom: 14 }}>
          <div>
            <label style={s.label}>Operación</label>
            <select style={s.select} value={params.operacion_default} onChange={e => set("operacion_default", e.target.value)}>
              <option>Venta</option><option>Alquiler</option><option>Alquiler temporal</option>
            </select>
          </div>
          <div>
            <label style={s.label}>Tipo</label>
            <select style={s.select} value={params.tipo_default} onChange={e => set("tipo_default", e.target.value)}>
              {["Departamento","Casa","PH","Local","Oficina","Terreno","Cochera","Galpon","Otro"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Moneda</label>
            <select style={s.select} value={params.moneda_default} onChange={e => set("moneda_default", e.target.value)}>
              <option value="USD">USD</option><option value="ARS">ARS</option>
            </select>
          </div>
        </div>
        <div style={s.grid2}>
          <div>
            <label style={s.label}>Ciudad por defecto</label>
            <input style={s.input} value={params.ciudad_default} onChange={e => set("ciudad_default", e.target.value)} placeholder="Rosario" />
          </div>
          <div>
            <label style={s.label}>Zona/Barrio por defecto</label>
            <input style={s.input} value={params.zona_default} onChange={e => set("zona_default", e.target.value)} placeholder="Ej: Centro, Fisherton…" />
          </div>
        </div>
      </div>

      {/* Honorarios */}
      <div style={s.card}>
        <div style={s.cardH}>💰 Honorarios</div>
        <div style={s.toggleRow}>
          <span style={s.toggleLabel}>Mostrar campos de honorarios en el formulario</span>
          <Toggle value={params.mostrar_honorarios} onChange={v => set("mostrar_honorarios", v)} />
        </div>
        <div style={{ ...s.grid3, marginTop: 14 }}>
          <div>
            <label style={s.label}>% Vendedor / Propietario</label>
            <input style={s.input} type="number" min="0" max="10" step="0.5" value={params.honorario_propietario_default} onChange={e => set("honorario_propietario_default", e.target.value)} placeholder="3" />
          </div>
          <div>
            <label style={s.label}>% Comprador / Inquilino</label>
            <input style={s.input} type="number" min="0" max="10" step="0.5" value={params.honorario_comprador_default} onChange={e => set("honorario_comprador_default", e.target.value)} placeholder="3" />
          </div>
          <div>
            <label style={s.label}>Compartir honorarios</label>
            <select style={s.select} value={params.honorario_compartir_default} onChange={e => set("honorario_compartir_default", e.target.value)}>
              {["No comparte","50%","40%","30%"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Código de propiedad */}
      <div style={s.card}>
        <div style={s.cardH}>🔢 Código automático</div>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
          Si configurás un prefijo, el código se genera automáticamente como <strong>{params.codigo_prefijo || "PRE"}-{String(params.codigo_contador).padStart(3, "0")}</strong>, <strong>{params.codigo_prefijo || "PRE"}-{String(params.codigo_contador + 1).padStart(3, "0")}</strong>, etc.
        </p>
        <div style={s.grid2}>
          <div>
            <label style={s.label}>Prefijo (opcional)</label>
            <input style={s.input} value={params.codigo_prefijo} onChange={e => set("codigo_prefijo", e.target.value.toUpperCase())} placeholder="Ej: GFI, CORR, INM…" maxLength={6} />
            <p style={s.info}>Dejar vacío para no generar código automático</p>
          </div>
          <div>
            <label style={s.label}>Próximo número</label>
            <input style={s.input} type="number" min="1" value={params.codigo_contador} onChange={e => set("codigo_contador", parseInt(e.target.value) || 1)} />
          </div>
        </div>
      </div>

      {/* Campos obligatorios */}
      <div style={s.card}>
        <div style={s.cardH}>✅ Campos obligatorios al guardar</div>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
          El sistema te avisará si falta alguno de estos campos antes de guardar. No bloquea el guardado.
        </p>
        <div style={s.checkGrid}>
          {CAMPOS_POSIBLES.map(c => {
            const active = params.campos_obligatorios.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCampo(c.key)}
                style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? "#2563eb" : "#e5e7eb"}`, background: active ? "#eff6ff" : "#fff", color: active ? "#2563eb" : "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {active ? "✓ " : ""}{c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nota interna por defecto */}
      <div style={s.card}>
        <div style={s.cardH}>📝 Nota interna por defecto</div>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
          Se pre-carga en el campo "Notas privadas" de cada nueva propiedad.
        </p>
        <textarea
          style={{ ...s.input, minHeight: 80, resize: "vertical" as const }}
          value={params.nota_interna_default}
          onChange={e => set("nota_interna_default", e.target.value)}
          placeholder="Ej: Verificar documentación antes de publicar. CI pendiente."
        />
      </div>

      {/* Botón guardar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={guardar} disabled={guardando} style={s.btn}>
          {guardando ? "Guardando…" : "Guardar parámetros"}
        </button>
        {ok && <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ Guardado correctamente</span>}
      </div>
    </div>
  );
}
