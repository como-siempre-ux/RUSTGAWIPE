/**
 * Cálculo del próximo wipe. Este es el núcleo de la app.
 *
 * Ninguna función llama a `new Date()`: el "ahora" siempre se inyecta.
 */

import { DAY_MS, nthWeekdayOfMonth, zonedParts, zonedWallTimeToUtc } from './time';
import type { Cadence, ScheduleRule, WipeConfidence, WipeResolution } from './types';

/**
 * Hora del forced wipe mensual de Facepunch. La hora exacta baila un poco
 * (va atada a las 14:00 de la costa este de EEUU), así que se deja como
 * constante para ajustarla sin tocar la lógica.
 */
export const FORCED_WIPE_UTC_HOUR = 19;

const THURSDAY = 4;

/** Instante UTC del forced wipe de un mes concreto (primer jueves). */
export function forcedWipeForMonth(year: number, month: number): number {
  const day = nthWeekdayOfMonth(year, month, THURSDAY, 1);
  return Date.UTC(year, month - 1, day, FORCED_WIPE_UTC_HOUR, 0, 0);
}

/** Primer forced wipe estrictamente posterior a `nowMs`. */
export function nextForcedWipe(nowMs: number): number {
  const d = new Date(nowMs);
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth() + 1;

  const thisMonth = forcedWipeForMonth(year, month);
  if (thisMonth > nowMs) return thisMonth;

  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return forcedWipeForMonth(year, month);
}

/** Forced wipe inmediatamente anterior o igual a `nowMs`. */
export function previousForcedWipe(nowMs: number): number {
  const d = new Date(nowMs);
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth() + 1;

  const thisMonth = forcedWipeForMonth(year, month);
  if (thisMonth <= nowMs) return thisMonth;

  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return forcedWipeForMonth(year, month);
}

// ---------------------------------------------------------------------------
// Heurística de intervalo a partir del nombre y los tags
// ---------------------------------------------------------------------------

const INTERVAL_PATTERNS: Array<{ re: RegExp; days: number }> = [
  { re: /\b(3\s*-?\s*day|3day|72\s*h|72h|tri[- ]?daily)\b/, days: 3 },
  { re: /\b(2\s*-?\s*day|2day|48\s*h|48h)\b/, days: 2 },
  { re: /\b(daily|diario|24\s*h|24h)\b/, days: 1 },
  { re: /\b(bi[- ]?weekly|biweekly|quincenal|2\s*weeks?|two\s*weeks?|14\s*d(ays?)?)\b/, days: 14 },
  { re: /\b(weekly|semanal|wipes?\s+(thursday|monday|friday|tuesday|wednesday|saturday|sunday)|7\s*d(ays?)?)\b/, days: 7 },
];

const MONTHLY_PATTERN = /\b(monthly|mensual|vanilla|force\s*wipe\s*only|month(ly)?\s*wipes?|long\s*wipe)\b/;

/**
 * Devuelve el intervalo en días detectado, o `null` si el servidor sigue el
 * ciclo mensual (es decir, wipea con el forced wipe).
 */
export function detectIntervalDays(name: string, tags: string[] = []): number | null {
  const haystack = `${name} ${tags.join(' ')}`.toLowerCase();

  for (const { re, days } of INTERVAL_PATTERNS) {
    if (re.test(haystack)) return days;
  }
  if (MONTHLY_PATTERN.test(haystack)) return null;

  // Sin pistas: asumir mensual.
  return null;
}

// ---------------------------------------------------------------------------
// Calendarios publicados (comunidades conocidas)
// ---------------------------------------------------------------------------

/**
 * Próximo wipe según un calendario publicado por la comunidad.
 *
 * - `weekly`  -> próxima ocurrencia del día de la semana a su hora local.
 * - `biweekly`-> anclado al forced wipe: forced + k*14 días. Así es como lo
 *                hacen de verdad (Bloo Lagoon, Rustafied Medium/Trio...).
 * - `monthly` -> el propio forced wipe.
 */
export function nextWipeFromRule(rule: ScheduleRule, nowMs: number): number {
  const forced = nextForcedWipe(nowMs);

  if (rule.cadence === 'monthly') return forced;

  if (rule.cadence === 'biweekly') {
    let t = previousForcedWipe(nowMs);
    // El ancla es el forced wipe; a partir de ahí, cada 14 días.
    while (t <= nowMs) t += 14 * DAY_MS;
    return Math.min(t, forced);
  }

  // weekly / cada N días con día de la semana fijo
  const stepDays = rule.cadence === 'weekly' ? 7 : rule.intervalDays ?? 7;
  const tz = rule.timeZone;
  const here = zonedParts(tz, nowMs);

  // Primer candidato: el día objetivo de esta semana, a la hora local del wipe.
  const deltaToTarget = (rule.weekday - here.weekday + 7) % 7;
  let candidate = zonedWallTimeToUtc(
    tz,
    here.year,
    here.month,
    here.day + deltaToTarget,
    rule.hourLocal,
    rule.minuteLocal ?? 0,
  );

  let guard = 0;
  while (candidate <= nowMs && guard++ < 60) {
    candidate += stepDays * DAY_MS;
  }

  return Math.min(candidate, forced);
}

// ---------------------------------------------------------------------------
// Resolución por servidor
// ---------------------------------------------------------------------------

export interface ResolveInput {
  name: string;
  tags?: string[];
  /** `official` fuerza ciclo mensual salvo que el nombre diga otra cosa. */
  type?: 'official' | 'community' | 'modded' | 'unknown';
  /** Fecha del próximo wipe si la fuente la da (ISO o ms). */
  nextWipeMs?: number | null;
  /** Fecha del último wipe si la fuente la da (ISO o ms). */
  lastWipeMs?: number | null;
  /** Calendario publicado de la comunidad, si el servidor pertenece a una. */
  rule?: ScheduleRule | null;
}

/**
 * Orden de resolución, de más a menos fiable:
 *
 *  1. La fuente da la fecha exacta          -> `confirmado`
 *  2. Calendario publicado de la comunidad  -> `programado`
 *  3. Último wipe + intervalo deducido      -> `estimado`
 *  4. Nada de lo anterior                   -> `desconocido`
 */
export function resolveNextWipe(input: ResolveInput, nowMs: number): WipeResolution {
  const forced = nextForcedWipe(nowMs);

  // 1. Dato directo de la fuente.
  if (input.nextWipeMs && input.nextWipeMs > nowMs) {
    return {
      nextWipeMs: input.nextWipeMs,
      confidence: 'confirmado',
      cadence: cadenceLabel(input.rule?.cadence ?? null, input.name, input.tags),
      explanation: 'el servidor publica la fecha de su próximo wipe.',
    };
  }

  // 2. Calendario publicado de la comunidad.
  if (input.rule) {
    return {
      nextWipeMs: nextWipeFromRule(input.rule, nowMs),
      confidence: 'programado',
      cadence: input.rule.cadence,
      explanation: `calendario publicado de ${input.rule.community}: ${input.rule.human}.`,
    };
  }

  // Los oficiales siguen el forced wipe salvo que el nombre diga otra cosa.
  const detected = detectIntervalDays(input.name, input.tags);
  if (input.type === 'official' && detected === null) {
    return {
      nextWipeMs: forced,
      confidence: 'programado',
      cadence: 'monthly',
      explanation: 'servidor oficial: wipea en el forced wipe mensual.',
    };
  }

  // 3. Estimación a partir del último wipe.
  if (input.lastWipeMs) {
    if (detected === null) {
      return {
        nextWipeMs: forced,
        confidence: 'estimado',
        cadence: 'monthly',
        explanation: 'sin pistas de ciclo en el nombre: se asume mensual (forced wipe).',
      };
    }

    let next = input.lastWipeMs + detected * DAY_MS;
    let guard = 0;
    while (next <= nowMs && guard++ < 400) {
      next += detected * DAY_MS;
    }

    // Un wipe estimado nunca puede caer después del forced wipe.
    const clamped = Math.min(next, forced);
    return {
      nextWipeMs: clamped,
      confidence: 'estimado',
      cadence: cadenceFromDays(detected),
      explanation:
        clamped === forced && next > forced
          ? `ciclo de ${detected} días detectado, recortado al forced wipe.`
          : `último wipe + ciclo de ${detected} días detectado en el nombre.`,
    };
  }

  // 4. Nada.
  return {
    nextWipeMs: null,
    confidence: 'desconocido',
    cadence: null,
    explanation: 'no hay fecha de último wipe ni calendario conocido.',
  };
}

function cadenceFromDays(days: number): Cadence {
  if (days === 7) return 'weekly';
  if (days === 14) return 'biweekly';
  return 'custom';
}

function cadenceLabel(fromRule: Cadence | null, name: string, tags?: string[]): Cadence | null {
  if (fromRule) return fromRule;
  const detected = detectIntervalDays(name, tags);
  return detected === null ? 'monthly' : cadenceFromDays(detected);
}

/** Orden de la lista: wipe más próximo primero, desconocidos al final. */
export function compareByNextWipe(
  a: { nextWipeMs: number | null },
  b: { nextWipeMs: number | null },
): number {
  if (a.nextWipeMs === null && b.nextWipeMs === null) return 0;
  if (a.nextWipeMs === null) return 1;
  if (b.nextWipeMs === null) return -1;
  return a.nextWipeMs - b.nextWipeMs;
}

/** Peso para ordenar por fiabilidad cuando dos wipes caen a la vez. */
export const CONFIDENCE_WEIGHT: Record<WipeConfidence, number> = {
  confirmado: 0,
  programado: 1,
  estimado: 2,
  desconocido: 3,
};
