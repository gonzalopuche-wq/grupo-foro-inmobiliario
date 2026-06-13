// Modelo de datos del relevamiento. Las medidas están en metros.

export interface Ambiente {
  id: string;
  nombre: string;
  largo: number; // m
  ancho: number; // m
  alto: number;  // m (altura de techo)
  fotoUri?: string;    // uri local de la foto tomada en el recorrido
  fotoBase64?: string; // jpeg base64 (sin prefijo) reescalado, para la IA
}

export interface Relevamiento {
  id: string;          // uuid (Supabase)
  titulo: string;
  direccion?: string;
  tipo?: string;       // departamento, casa, ph, local…
  operacion?: string;  // venta | alquiler
  altoTecho: number;   // altura por defecto para ambientes nuevos
  ambientes: Ambiente[];
  descripcionIa?: string;
  tono?: string;
  createdAt: string;
}

export const TIPOS = ['Departamento', 'Casa', 'PH', 'Local', 'Oficina', 'Terreno'];
export const OPERACIONES = ['venta', 'alquiler'];
export const TONOS = ['profesional', 'premium', 'amigable', 'vendedor'];

export function areaAmbiente(a: Pick<Ambiente, 'largo' | 'ancho'>): number {
  return (a.largo || 0) * (a.ancho || 0);
}

export function superficieTotal(ambientes: Ambiente[]): number {
  return ambientes.reduce((s, a) => s + areaAmbiente(a), 0);
}

export function nuevoAmbiente(altoTecho: number, n: number): Ambiente {
  return {
    id: `amb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nombre: `Ambiente ${n}`,
    largo: 3,
    ancho: 3,
    alto: altoTecho || 2.6,
  };
}
