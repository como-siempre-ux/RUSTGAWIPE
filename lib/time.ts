/**
 * Utilidades de tiempo. Sin dependencias: todo se apoya en `Intl` para
 * resolver desfases horarios reales (incluido horario de verano).
 *
 * Regla del proyecto: ninguna función de aquí llama a `new Date()` por su
 * cuenta. El "ahora" siempre entra como parámetro para que los tests sean
 * deterministas.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Desfase de una zona horaria (en ms) en un instante UTC concreto. */
export function tzOffsetMs(timeZone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  // `hour` puede venir como 24 para medianoche en algunos entornos.
  const hour = get('hour') % 24;
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Convierte una hora de pared en una zona horaria a un instante UTC.
 * Doble pasada para resolver correctamente los saltos de horario de verano.
 */
export function zonedWallTimeToUtc(
  timeZone: string,
  y: number,
  m: number, // 1-12
  d: number,
  hh = 0,
  mm = 0,
): number {
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  let utc = naive - tzOffsetMs(timeZone, naive);
  utc = naive - tzOffsetMs(timeZone, utc);
  return utc;
}

/** Partes de calendario de un instante UTC vistas desde una zona horaria. */
export function zonedParts(timeZone: string, utcMs: number) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdayIndex, // 0 = domingo
  };
}

/**
 * Fecha (en la zona indicada) del n-ésimo día de la semana de un mes.
 * `weekday`: 0 = domingo ... 4 = jueves. `nth` empieza en 1.
 */
export function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): number {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const delta = (weekday - firstWeekday + 7) % 7;
  return 1 + delta + (nth - 1) * 7;
}

/** Formatea "en 3h 20m" / "hace 2d 4h". Devuelve también el signo. */
export function formatRelative(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  const future = diff >= 0;
  const abs = Math.abs(diff);

  const d = Math.floor(abs / DAY_MS);
  const h = Math.floor((abs % DAY_MS) / HOUR_MS);
  const m = Math.floor((abs % HOUR_MS) / MINUTE_MS);

  let body: string;
  if (d > 0) body = h > 0 ? `${d}d ${h}h` : `${d}d`;
  else if (h > 0) body = m > 0 ? `${h}h ${m}m` : `${h}h`;
  else if (m > 0) body = `${m}m`;
  else return future ? 'ahora mismo' : 'justo ahora';

  return future ? `en ${body}` : `hace ${body}`;
}

/** Desglose días/horas/minutos/segundos para el countdown. */
export function countdownParts(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(diff / DAY_MS),
    hours: Math.floor((diff % DAY_MS) / HOUR_MS),
    minutes: Math.floor((diff % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((diff % MINUTE_MS) / 1000),
    total: diff,
  };
}
