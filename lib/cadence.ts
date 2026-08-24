/**
 * Cada cuánto wipea un servidor, en texto.
 *
 * Sin imports: se ejecuta tal cual con `node fichero.ts`.
 */

import type { Cadence } from './types';

export interface Cadencia {
  /** Para enseñar: "semanal", "cada 3 días", "2 veces por semana". */
  label: string;
  /**
   * Duración media del ciclo en días. Sirve para ordenar y comparar; en
   * `mensual` es aproximada, porque el forced wipe cae entre 28 y 35 días.
   */
  days: number | null;
}

/**
 * `weekdays` importa más de lo que parece: WarBandits tiene cadencia semanal
 * pero wipea lunes **y** viernes. Llamar a eso "semanal" sería engañar — el
 * mapa dura tres o cuatro días, no siete.
 */
export function describeCadence(
  cadence: Cadence | null,
  days: number | null,
  weekdaysCount = 1,
): Cadencia | null {
  if (cadence === 'monthly') {
    return { label: 'mensual', days: null };
  }

  if (cadence === 'weekly') {
    if (weekdaysCount > 1) {
      return {
        label: weekdaysCount === 2 ? '2 veces por semana' : `${weekdaysCount} veces por semana`,
        days: Math.round((7 / weekdaysCount) * 10) / 10,
      };
    }
    return { label: 'semanal', days: 7 };
  }

  if (cadence === 'biweekly') {
    return { label: 'quincenal', days: 14 };
  }

  if (cadence === 'custom' && days !== null) {
    if (days === 1) return { label: 'diario', days: 1 };
    if (days === 7) return { label: 'semanal', days: 7 };
    if (days === 14) return { label: 'quincenal', days: 14 };
    return { label: `cada ${days} días`, days };
  }

  return null;
}

/** Cuánto dura el mapa, en texto, a partir de los días del ciclo. */
export function duracionDelMapa(days: number | null): string | null {
  if (days === null) return null;
  if (days < 1) return 'menos de un día';
  if (days === 1) return 'un día';
  if (days < 2) return `${days} días`;
  return `${Number.isInteger(days) ? days : days.toFixed(1).replace('.', ',')} días`;
}
