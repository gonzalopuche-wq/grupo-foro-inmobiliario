// Etiqueta legible en español para un tipo de propiedad, venga como venga:
// minúscula, inglés de portales, snake_case, etc. Si no está mapeado, lo prolijea
// (reemplaza guiones bajos y capitaliza) para que NUNCA se muestre crudo.

const TIPO_PROPIEDAD_LABELS: Record<string, string> = {
  // ── Español (normaliza mayúsculas y variantes) ──
  departamento: "Departamento",
  depto: "Departamento",
  "departamento de pasillo": "Departamento de Pasillo",
  monoambiente: "Monoambiente",
  ph: "PH",
  casa: "Casa",
  chalet: "Casa",
  "casa quinta": "Casa Quinta",
  quinta: "Casa Quinta",
  duplex: "Dúplex",
  "dúplex": "Dúplex",
  triplex: "Tríplex",
  terreno: "Terreno o Lote",
  "terreno o lote": "Terreno o Lote",
  lote: "Terreno o Lote",
  cochera: "Cochera",
  oficina: "Oficina",
  local: "Local Comercial",
  "local comercial": "Local Comercial",
  galpon: "Galpón",
  "galpón": "Galpón",
  deposito: "Galpón",
  "depósito": "Galpón",
  campo: "Campo",
  chacra: "Chacra",
  "establecimiento rural": "Establecimiento Rural",
  "inmueble comercial": "Inmueble Comercial",
  "negocio o fondo de comercio": "Negocio o Fondo de Comercio",
  "fondo de comercio": "Negocio o Fondo de Comercio",
  consultorio: "Consultorio",
  baulera: "Baulera",
  hotel: "Hotel",
  habitacion: "Habitación",
  "habitación": "Habitación",
  edificio: "Edificio",

  // ── Inglés / snake_case (portales: Tokko, ML, etc.) ──
  apartment: "Departamento",
  apartments: "Departamento",
  condo: "Departamento",
  flat: "Departamento",
  studio: "Monoambiente",
  house: "Casa",
  houses: "Casa",
  country_houses: "Casa Quinta",
  residential_lands: "Terreno o Lote",
  land: "Terreno o Lote",
  lands: "Terreno o Lote",
  land_lots: "Terreno o Lote",
  lots: "Terreno o Lote",
  retail_spaces: "Local Comercial",
  commercial: "Local Comercial",
  business_premises: "Local Comercial",
  shop: "Local Comercial",
  store: "Local Comercial",
  offices: "Oficina",
  office: "Oficina",
  medical_offices: "Consultorio",
  warehouses: "Galpón",
  warehouse: "Galpón",
  garages: "Cochera",
  garage: "Cochera",
  parking: "Cochera",
  parking_lots: "Cochera",
  parking_spaces: "Cochera",
  farms: "Campo",
  farm: "Campo",
  field: "Campo",
  ranches: "Establecimiento Rural",
  buildings: "Edificio",
  building: "Edificio",
  hotels: "Hotel",
  rooms: "Habitación",
};

export function etiquetaTipoPropiedad(tipo?: string | null): string {
  if (!tipo) return "Propiedad";
  const k = tipo.toString().trim().toLowerCase();
  if (!k) return "Propiedad";
  if (TIPO_PROPIEDAD_LABELS[k]) return TIPO_PROPIEDAD_LABELS[k];
  // Fallback prolijo: snake_case → palabras, capitalizar cada una.
  const limpio = k.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return limpio.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) || "Propiedad";
}
