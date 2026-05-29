export interface PropExtNorm {
  portal_id: string;
  url: string;
  titulo: string;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string;
  dormitorios: number | null;
  banos: number | null;
  ambientes: number | null;
  superficie_cubierta: number | null;
  sup_terreno: number | null;
  expensas: number | null;
  barrio: string | null;
  ciudad: string;
  provincia: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  imagenes: string[];
  descripcion: string | null;
  datos_raw: Record<string, unknown>;
}

export function normalizeTipo(raw: string | null | undefined): string {
  if (!raw) return "otro";
  const t = raw.toLowerCase();
  if (t.includes("departamento") || t.includes("apartment") || t.includes("depto")) return "departamento";
  if (t.includes(" ph") || t === "ph") return "ph";
  if (t.includes("casa") || t.includes("chalet") || t.includes("house")) return "casa";
  if (t.includes("local") || t.includes("fondo de comercio")) return "local";
  if (t.includes("oficina") || t.includes("office")) return "oficina";
  if (t.includes("terreno") || t.includes("lote") || t.includes("land")) return "terreno";
  if (t.includes("cochera") || t.includes("garage") || t.includes("estacionamiento")) return "cochera";
  if (t.includes("galp") || t.includes("depósito") || t.includes("bodega")) return "galpón";
  return "otro";
}

export function normalizeOperacion(raw: string | null | undefined): string {
  if (!raw) return "venta";
  const o = raw.toLowerCase();
  if (o.includes("temp") || o.includes("vacation") || o.includes("turístico")) return "alquiler_temporal";
  if (o.includes("alquiler") || o.includes("rent") || o.includes("arriend")) return "alquiler";
  return "venta";
}

export function parseNum(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const n = parseFloat(String(val).replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}
