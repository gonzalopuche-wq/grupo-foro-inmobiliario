// Medición de distancias con la cámara (método del clinómetro).
//
// En Expo managed no hay acceso a la profundidad de ARCore/LiDAR, pero sí a los
// sensores de movimiento (expo-sensors → DeviceMotion). Con el teléfono a una
// altura conocida sobre el piso, el ángulo de depresión de la cámara permite
// estimar la distancia horizontal a un punto del piso:
//
//        teléfono (a 'alturaDispositivo' del piso)
//          |·                       — horizontal (β = 0)
//          | ·  β  (ángulo de depresión)
//   altura |   ·
//          |     ·
//          |_______·  punto en el piso
//             distancia (horizontal)
//
//   tan(β) = altura / distancia   →   distancia = altura / tan(β)
//
// Para medir el LARGO de una pared, el corredor se para en una esquina y apunta
// a la base de la pared de enfrente: la distancia estimada es esa profundidad.
// Es una ESTIMACIÓN asistida (no milimétrica): la app siempre deja corregir el
// valor a mano. Funciona enteramente en Expo managed, sin dev-client nativo.

export const ALTURA_DISPOSITIVO_DEFAULT = 1.4; // m (teléfono a la altura del pecho)

/** Distancia horizontal (m) a un punto del piso dado el ángulo de depresión (rad). */
export function distanciaPiso(depresionRad: number, alturaDispositivo: number): number | null {
  // Fuera de un rango útil la estimación se dispara: devolvemos null.
  const MIN = 0.09; // ~5°
  const MAX = 1.45; // ~83°
  if (!Number.isFinite(depresionRad) || depresionRad < MIN || depresionRad > MAX) return null;
  const d = alturaDispositivo / Math.tan(depresionRad);
  if (!Number.isFinite(d) || d <= 0 || d > 30) return null;
  return d;
}

/**
 * Convierte el `pitch` de DeviceMotion (rad) en ángulo de depresión (rad).
 *
 * En portrait, con el teléfono vertical mirando al horizonte, |pitch| ≈ π/2.
 * Al inclinar la parte superior hacia abajo para apuntar al piso, |pitch|
 * disminuye. La depresión respecto de la horizontal es por lo tanto
 * (π/2 − |pitch|). Distintos equipos varían el signo; usamos el valor absoluto.
 */
export function depresionDesdePitch(pitchRad: number): number {
  return Math.PI / 2 - Math.abs(pitchRad);
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
