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
  sup_semicubierta?: number | null;
  sup_descubierta?: number | null;
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
  // Características físicas (opcionales — solo portales que las proveen)
  orientacion?: string | null;
  piso?: number | null;
  cocheras?: number | null;
  baulera?: boolean;
  antiguedad?: string | null;
  // Condiciones
  amoblado?: boolean;
  acepta_mascotas?: boolean;
  apto_credito?: boolean;
  // Amenities edificio
  com_pileta?: boolean;
  com_gimnasio?: boolean;
  com_sum?: boolean;
  com_ascensor?: boolean;
  com_seguridad?: boolean;
  com_parrilla?: boolean;
  com_quincho?: boolean;
  com_solarium?: boolean;
  com_laundry?: boolean;
  com_cowork?: boolean;
  com_juegos_ninos?: boolean;
  com_estac_visit?: boolean;
  com_bicicletero?: boolean;
  com_microcine?: boolean;
  com_sauna?: boolean;
  com_conserjeria?: boolean;
  com_portero_electrico?: boolean;
  com_wifi_comunes?: boolean;
  com_espacio_verde?: boolean;
  // Ambientes propios
  amb_balcon?: boolean;
  amb_terraza?: boolean;
  amb_jardin?: boolean;
  amb_patio?: boolean;
  // Multimedia
  video_url?: string | null;
  tour_virtual_url?: string | null;
  // Clasificación (portales externos)
  toilettes?: number | null;
  disposicion?: string | null;
  tipo_unidad?: string | null;
  ocupacion?: string | null;
  // Agente
  agente_nombre?: string | null;
  agente_telefono?: string | null;
  agente_email?: string | null;
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

// Busca keywords en un array de strings de amenities
export function hasAmenity(list: string[], ...keywords: string[]): boolean {
  return keywords.some(kw => list.some(a => a.includes(kw)));
}

// Normaliza un array crudo de amenities/features/tags a strings lowercase
export function normalizeAmenities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: unknown) => {
      if (!a) return "";
      if (typeof a === "string") return a.toLowerCase();
      if (typeof a === "object") {
        const obj = a as Record<string, unknown>;
        return String(obj.name ?? obj.label ?? obj.value ?? obj.id ?? "").toLowerCase();
      }
      return "";
    })
    .filter(Boolean);
}
