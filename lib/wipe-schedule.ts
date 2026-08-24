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

  // Una comunidad puede wipear varios días por semana: se prueban todos y
  // gana el que caiga antes.
  const targets = rule.weekdays?.length ? rule.weekdays : [rule.weekday];

  let soonest = Infinity;
  for (const weekday of targets) {
    // Primer candidato: ese día de esta semana, a la hora local del wipe.
    const deltaToTarget = (weekday - here.weekday + 7) % 7;
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

    if (candidate < soonest) soonest = candidate;
  }

  return Math.min(soonest, forced);
}

/**
 * Último wipe según el calendario: la misma cuenta, mirando hacia atrás.
 *
 * Un servidor de comunidad wipea también en el forced wipe (por eso
 * `nextWipeFromRule` recorta el siguiente al forced wipe). Hacia atrás vale lo
 * mismo: si el forced wipe cayó después del último hueco del calendario, el
 * último wipe fue el forced wipe.
 */
export function previousWipeFromRule(rule: ScheduleRule, nowMs: number): number {
  const forcedPrev = previousForcedWipe(nowMs);

  if (rule.cadence === 'monthly') return forcedPrev;

  if (rule.cadence === 'biweekly') {
    let t = forcedPrev;
    while (t + 14 * DAY_MS <= nowMs) t += 14 * DAY_MS;
    return t;
  }

  const stepDays = rule.cadence === 'weekly' ? 7 : rule.intervalDays ?? 7;
  const tz = rule.timeZone;
  const here = zonedParts(tz, nowMs);
  const targets = rule.weekdays?.length ? rule.weekdays : [rule.weekday];

  let latest = -Infinity;
  for (const weekday of targets) {
    const deltaBack = (here.weekday - weekday + 7) % 7;
    let candidate = zonedWallTimeToUtc(
      tz,
      here.year,
      here.month,
      here.day - deltaBack,
      rule.hourLocal,
      rule.minuteLocal ?? 0,
    );

    let guard = 0;
    while (candidate > nowMs && guard++ < 60) {
      candidate -= stepDays * DAY_MS;
    }

    if (candidate > latest) latest = candidate;
  }

  return Math.max(latest, forcedPrev);
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

  /**
   * El último wipe real de la fuente siempre gana. Si no lo hay pero el
   * servidor tiene calendario, se deduce de él; así el catálogo también
   * puede decir cuándo wipeó por última vez.
   */
  const lastWipe = (): Pick<WipeResolution, 'lastWipeMs' | 'lastWipeIsDerived'> => {
    if (input.lastWipeMs) return { lastWipeMs: input.lastWipeMs, lastWipeIsDerived: false };
    if (input.rule) {
      return { lastWipeMs: previousWipeFromRule(input.rule, nowMs), lastWipeIsDerived: true };
    }
    return { lastWipeMs: null, lastWipeIsDerived: false };
  };

  // 1. Dato directo de la fuente.
  if (input.nextWipeMs && input.nextWipeMs > nowMs) {
    return {
      nextWipeMs: input.nextWipeMs,
      ...lastWipe(),
      confidence: 'confirmado',
      cadence: cadenceLabel(input.rule?.cadence ?? null, input.name, input.tags),
      cadenceDays: input.rule ? diasDeLaRegla(input.rule) : detectIntervalDays(input.name, input.tags),
      explanation: 'el servidor publica la fecha de su próximo wipe.',
    };
  }

  // 2. Calendario de la comunidad. Si no está verificado contra una fuente
  //    oficial se baja a `estimado`: se conoce el ciclo, no la hora exacta.
  if (input.rule) {
    return {
      nextWipeMs: nextWipeFromRule(input.rule, nowMs),
      ...lastWipe(),
      confidence: input.rule.approximate ? 'estimado' : 'programado',
      cadence: input.rule.cadence,
      cadenceDays: diasDeLaRegla(input.rule),
      explanation: input.rule.approximate
        ? `ciclo conocido de ${input.rule.community}, sin hora confirmada: ${input.rule.human}.`
        : `calendario publicado de ${input.rule.community}: ${input.rule.human}.`,
    };
  }

  // Los oficiales siguen el forced wipe salvo que el nombre diga otra cosa.
  const detected = detectIntervalDays(input.name, input.tags);
  if (input.type === 'official' && detected === null) {
    return {
      nextWipeMs: forced,
      ...lastWipe(),
      confidence: 'programado',
      cadence: 'monthly',
      cadenceDays: null,
      explanation: 'servidor oficial: wipea en el forced wipe mensual.',
    };
  }

  // 3. Estimación a partir del último wipe.
  if (input.lastWipeMs) {
    if (detected === null) {
      return {
        nextWipeMs: forced,
        ...lastWipe(),
        confidence: 'estimado',
        cadence: 'monthly',
        cadenceDays: null,
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
      ...lastWipe(),
      confidence: 'estimado',
      cadence: cadenceFromDays(detected),
      cadenceDays: detected,
      explanation:
        clamped === forced && next > forced
          ? `ciclo de ${detected} días detectado, recortado al forced wipe.`
          : `último wipe + ciclo de ${detected} días detectado en el nombre.`,
    };
  }

  // 4. Nada.
  return {
    nextWipeMs: null,
    ...lastWipe(),
    confidence: 'desconocido',
    cadence: null,
    cadenceDays: null,
    explanation: 'no hay fecha de último wipe ni calendario conocido.',
  };
}

/**
 * Días de ciclo de un calendario. Si wipea varios días por semana el ciclo no
 * es de siete: WarBandits wipea lunes y viernes, así que el mapa dura tres o
 * cuatro días.
 */
function diasDeLaRegla(rule: ScheduleRule): number | null {
  if (rule.cadence === 'monthly') return null;
  if (rule.cadence === 'biweekly') return 14;
  if (rule.cadence === 'custom') return rule.intervalDays ?? null;

  const cuantos = rule.weekdays?.length ?? 1;
  return cuantos > 1 ? Math.round((7 / cuantos) * 10) / 10 : 7;
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
