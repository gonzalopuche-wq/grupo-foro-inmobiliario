import { Ambiente } from './types';

// Layout esquemático del plano 2D.
//
// Armar un plano con adyacencias reales requeriría reconstrucción geométrica
// (qué pared toca con qué) que la app no captura. En su lugar generamos un
// "plano de bloques": cada ambiente es un rectángulo a escala real, acomodados
// en filas (row-packing) dentro de un ancho objetivo. Es un esquema claro y
// honesto, con cada ambiente proporcional a sus medidas reales y rotulado con
// su superficie. El corredor puede usarlo como croquis del aviso.

export interface BloquePlano {
  ambiente: Ambiente;
  x: number; // m, esquina sup-izq
  y: number; // m
  w: number; // m (largo)
  h: number; // m (ancho)
}

export interface PlanoLayout {
  bloques: BloquePlano[];
  ancho: number;  // m, bounding box
  alto: number;   // m, bounding box
}

const GAP = 0.4; // m de separación entre bloques

/**
 * Acomoda los ambientes en filas hasta `anchoObjetivo` (m). Cuando una fila se
 * llena, baja a la siguiente. Devuelve posiciones en metros + bounding box.
 */
export function armarPlano(ambientes: Ambiente[], anchoObjetivo = 9): PlanoLayout {
  const bloques: BloquePlano[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let filaAlto = 0;
  let maxX = 0;

  for (const a of ambientes) {
    const w = Math.max(a.largo || 1, 0.5);
    const h = Math.max(a.ancho || 1, 0.5);

    // Si no entra en la fila actual y ya hay algo, salto de fila.
    if (cursorX > 0 && cursorX + w > anchoObjetivo) {
      cursorX = 0;
      cursorY += filaAlto + GAP;
      filaAlto = 0;
    }

    bloques.push({ ambiente: a, x: cursorX, y: cursorY, w, h });
    cursorX += w + GAP;
    filaAlto = Math.max(filaAlto, h);
    maxX = Math.max(maxX, cursorX - GAP);
  }

  return {
    bloques,
    ancho: Math.max(maxX, 1),
    alto: Math.max(cursorY + filaAlto, 1),
  };
}
