import { describe, expect, it } from 'vitest';

import { matchCommunity } from '../catalog';
import { DAY_MS } from '../time';
import {
  FORCED_WIPE_UTC_HOUR,
  detectIntervalDays,
  forcedWipeForMonth,
  nextForcedWipe,
  nextWipeFromRule,
  previousForcedWipe,
  resolveNextWipe,
} from '../wipe-schedule';

/** Fechas fijas: nada de `new Date()` sin inyectar. */
const iso = (s: string) => Date.parse(s);

describe('forced wipe: primer jueves del mes', () => {
  it('mes que empieza en jueves -> el forced wipe es el día 1', () => {
    // 1 de mayo de 2025 fue jueves.
    expect(new Date(forcedWipeForMonth(2025, 5)).toISOString()).toBe('2025-05-01T19:00:00.000Z');
  });

  it('mes que empieza en viernes -> el forced wipe es el día 7', () => {
    // 1 de agosto de 2025 fue viernes; el primer jueves es el 7.
    expect(new Date(forcedWipeForMonth(2025, 8)).toISOString()).toBe('2025-08-07T19:00:00.000Z');
  });

  it('mes que empieza en miércoles -> el forced wipe es el día 2', () => {
    // 1 de octubre de 2025 fue miércoles.
    expect(new Date(forcedWipeForMonth(2025, 10)).toISOString()).toBe('2025-10-02T19:00:00.000Z');
  });

  it('usa la constante de la hora', () => {
    const d = new Date(forcedWipeForMonth(2026, 3));
    expect(d.getUTCHours()).toBe(FORCED_WIPE_UTC_HOUR);
  });
});

describe('forced wipe: siguiente y anterior', () => {
  it('justo antes del forced wipe devuelve el de este mes', () => {
    const now = iso('2025-08-07T18:59:00.000Z');
    expect(new Date(nextForcedWipe(now)).toISOString()).toBe('2025-08-07T19:00:00.000Z');
  });

  it('justo después del forced wipe salta al mes siguiente', () => {
    const now = iso('2025-08-07T19:00:01.000Z');
    expect(new Date(nextForcedWipe(now)).toISOString()).toBe('2025-09-04T19:00:00.000Z');
  });

  it('cambio de año: diciembre -> enero', () => {
    // El forced wipe de diciembre de 2025 fue el jueves 4.
    const now = iso('2025-12-20T00:00:00.000Z');
    expect(new Date(nextForcedWipe(now)).toISOString()).toBe('2026-01-01T19:00:00.000Z');
  });

  it('cambio de año hacia atrás: enero -> diciembre', () => {
    // 1 de enero de 2026 es jueves, así que antes de él toca el de diciembre.
    const now = iso('2026-01-01T10:00:00.000Z');
    expect(new Date(previousForcedWipe(now)).toISOString()).toBe('2025-12-04T19:00:00.000Z');
  });
});

describe('detección del intervalo por el nombre', () => {
  it.each([
    ['Rustafied.com - EU Weekly', 7],
    ['[EU] 2x Vanilla | Wipes Thursday', 7],
    ['Servidor semanal ES', 7],
    ['Bloo Lagoon Medium | Bi-weekly', 14],
    ['Rust 2 Weeks Solo', 14],
    ['Hardcore 3 Day Wipe', 3],
    ['Rust 72h Blitz', 3],
  ])('%s -> %i días', (name, days) => {
    expect(detectIntervalDays(name)).toBe(days);
  });

  it.each([
    ['Rustafied.com - EU Long - Large'],
    ['Vanilla Monthly EU'],
    ['Servidor sin ninguna pista'],
  ])('%s -> mensual (null)', (name) => {
    expect(detectIntervalDays(name)).toBeNull();
  });
});

describe('resolución por servidor', () => {
  const now = iso('2025-08-20T12:00:00.000Z'); // miércoles, forced wipe el 4 de sept.

  it('la fuente da el próximo wipe -> confirmado, tal cual', () => {
    const target = iso('2025-08-21T15:00:00.000Z');
    const r = resolveNextWipe({ name: 'Servidor X', nextWipeMs: target }, now);
    expect(r.confidence).toBe('confirmado');
    expect(r.nextWipeMs).toBe(target);
  });

  it('weekly con last_wipe de hace 10 días -> el siguiente cae en el futuro', () => {
    const r = resolveNextWipe(
      { name: 'Weekly EU 2x', lastWipeMs: now - 10 * DAY_MS },
      now,
    );
    expect(r.confidence).toBe('estimado');
    expect(r.nextWipeMs).not.toBeNull();
    expect(r.nextWipeMs!).toBeGreaterThan(now);
    // 10 días atrás + 7 + 7 = dentro de 4 días.
    expect(new Date(r.nextWipeMs!).toISOString()).toBe('2025-08-24T12:00:00.000Z');
  });

  it('weekly cuyo cálculo se pasaría del forced wipe -> se recorta al forced wipe', () => {
    // Estamos a 2 días del forced wipe y el último wipe fue hace 1 día:
    // 1 + 7 = dentro de 6 días, más allá del forced wipe.
    const near = iso('2025-09-02T12:00:00.000Z');
    const forced = iso('2025-09-04T19:00:00.000Z');
    const r = resolveNextWipe(
      { name: 'Weekly EU 2x', lastWipeMs: near - 1 * DAY_MS },
      near,
    );
    expect(r.nextWipeMs).toBe(forced);
    expect(r.explanation).toContain('recortado al forced wipe');
  });

  it('sin rust_last_wipe y sin calendario -> desconocido', () => {
    const r = resolveNextWipe({ name: 'Servidor misterioso' }, now);
    expect(r.confidence).toBe('desconocido');
    expect(r.nextWipeMs).toBeNull();
  });

  it('servidor oficial sin pistas -> forced wipe mensual', () => {
    const r = resolveNextWipe({ name: 'Rust Server EU', type: 'official' }, now);
    expect(r.nextWipeMs).toBe(iso('2025-09-04T19:00:00.000Z'));
    expect(r.cadence).toBe('monthly');
  });

  it('un next_wipe ya pasado no se usa: cae a la estimación', () => {
    const r = resolveNextWipe(
      { name: 'Weekly EU', nextWipeMs: now - DAY_MS, lastWipeMs: now - 2 * DAY_MS },
      now,
    );
    expect(r.confidence).toBe('estimado');
  });
});

describe('calendarios publicados', () => {
  it('Rustafied EU Main: jueves 15:00 hora de Londres', () => {
    const match = matchCommunity('Rustafied.com - EU Main');
    expect(match).not.toBeNull();
    expect(match!.rule.timeZone).toBe('Europe/London');
    expect(match!.rule.cadence).toBe('weekly');
    expect(match!.rule.weekday).toBe(4);

    // Lunes 18 de agosto de 2025. El jueves siguiente es el 21.
    const now = iso('2025-08-18T10:00:00.000Z');
    const next = nextWipeFromRule(match!.rule, now);
    // Agosto en Londres es BST (UTC+1): 15:00 local = 14:00 UTC.
    expect(new Date(next).toISOString()).toBe('2025-08-21T14:00:00.000Z');
  });

  it('respeta el horario de invierno: en enero 15:00 Londres es 15:00 UTC', () => {
    const match = matchCommunity('Rustafied.com - EU Main')!;
    const now = iso('2026-01-12T10:00:00.000Z'); // lunes
    const next = nextWipeFromRule(match.rule, now);
    expect(new Date(next).toISOString()).toBe('2026-01-15T15:00:00.000Z');
  });

  it('Rustafied EU Monday cambia el día de la semana', () => {
    const match = matchCommunity('Rustafied.com - EU Monday')!;
    expect(match.rule.weekday).toBe(1);
  });

  it('Rustafied Long es mensual: cae en el forced wipe', () => {
    const match = matchCommunity('Rustafied.com - EU Long - Large')!;
    expect(match.rule.cadence).toBe('monthly');
    const now = iso('2025-08-20T12:00:00.000Z');
    expect(nextWipeFromRule(match.rule, now)).toBe(iso('2025-09-04T19:00:00.000Z'));
  });

  it('un calendario semanal nunca se pasa del forced wipe', () => {
    const match = matchCommunity('Rustafied.com - EU Main')!;
    // Viernes 5 de septiembre: el jueves siguiente (11) es posterior al
    // forced wipe de octubre? No. Probamos justo antes de un forced wipe.
    const now = iso('2025-10-01T12:00:00.000Z'); // miércoles, forced el jueves 2
    const next = nextWipeFromRule(match.rule, now);
    expect(next).toBeLessThanOrEqual(iso('2025-10-02T19:00:00.000Z'));
  });

  it('Bloo Lagoon es biweekly anclado al forced wipe', () => {
    const match = matchCommunity('[US] Bloo Lagoon Medium 1.5x | 4 Max | Bi-weekly')!;
    expect(match.rule.cadence).toBe('biweekly');

    // Forced wipe de agosto de 2025: jueves 7 a las 19:00 UTC.
    const now = iso('2025-08-10T00:00:00.000Z');
    const next = nextWipeFromRule(match.rule, now);
    expect(new Date(next).toISOString()).toBe('2025-08-21T19:00:00.000Z');
  });

  it('el calendario gana a la heurística del nombre', () => {
    const match = matchCommunity('Rustafied.com - EU Long - Large')!;
    const now = iso('2025-08-20T12:00:00.000Z');
    const r = resolveNextWipe(
      { name: 'Rustafied.com - EU Long - Large', lastWipeMs: now - 3 * DAY_MS, rule: match.rule },
      now,
    );
    expect(r.confidence).toBe('programado');
    expect(r.explanation).toContain('Rustafied');
  });

  it('los oficiales de Facepunch van en UTC, no en la hora de su región', () => {
    const au = matchCommunity('[AU] Facepunch Rust Official Main')!;
    const us = matchCommunity('[US] Facepunch Rust Official Main')!;
    expect(au.rule.timeZone).toBe('UTC');
    expect(us.rule.timeZone).toBe('UTC');
  });

  it('un oficial "Small" wipea semanalmente el jueves a las 19:00 UTC', () => {
    const rule = matchCommunity('[US] Facepunch Rust Official Small')!.rule;
    expect(rule.cadence).toBe('weekly');
    const now = iso('2025-08-18T10:00:00.000Z'); // lunes
    expect(new Date(nextWipeFromRule(rule, now)).toISOString()).toBe('2025-08-21T19:00:00.000Z');
  });

  it('Survivors.gg #1 wipea lunes y jueves: gana el que caiga antes', () => {
    const rule = matchCommunity('Survivors.gg #1 [ 2x Solo/Duo/Trio/Quad ]')!.rule;
    expect(rule.weekdays).toEqual([1, 4]);
    expect(rule.timeZone).toBe('Europe/Berlin');

    // Martes 19 de agosto de 2025: el próximo de los dos es el jueves 21.
    const martes = iso('2025-08-19T08:00:00.000Z');
    // Agosto en Berlín es CEST (UTC+2): 14:00 local = 12:00 UTC.
    expect(new Date(nextWipeFromRule(rule, martes)).toISOString()).toBe('2025-08-21T12:00:00.000Z');

    // Viernes 22: ahora el próximo es el lunes 25.
    const viernes = iso('2025-08-22T08:00:00.000Z');
    expect(new Date(nextWipeFromRule(rule, viernes)).toISOString()).toBe('2025-08-25T12:00:00.000Z');
  });

  it('Survivors.gg #5 sólo wipea los viernes', () => {
    const rule = matchCommunity('Survivors.gg #5 [ 2x Solo/Duo/Trio ]')!.rule;
    expect(rule.weekdays).toBeUndefined();
    expect(rule.weekday).toBe(5);
  });

  it('un calendario sin verificar se marca estimado, no programado', () => {
    const rule = matchCommunity('WARBANDITS.GG EU 3X |Solo/Duo/Trio| LootX3')!.rule;
    expect(rule.approximate).toBe(true);

    const now = iso('2025-08-20T12:00:00.000Z');
    const r = resolveNextWipe({ name: 'WARBANDITS.GG EU 3X |Solo/Duo/Trio|', rule }, now);
    expect(r.confidence).toBe('estimado');
    expect(r.explanation).toContain('sin hora confirmada');
  });

  it('un calendario verificado sigue siendo programado', () => {
    const rule = matchCommunity('Rustafied.com - EU Main')!.rule;
    expect(rule.approximate).toBeUndefined();

    const now = iso('2025-08-20T12:00:00.000Z');
    expect(resolveNextWipe({ name: 'Rustafied.com - EU Main', rule }, now).confidence).toBe(
      'programado',
    );
  });

  it('WarBandits wipea dos veces por semana', () => {
    const rule = matchCommunity('WARBANDITS.GG US 2X |Solo/Duo/Trio|')!.rule;
    expect(rule.weekdays).toEqual([1, 5]);
  });

  it('un servidor desconocido no casa con ninguna comunidad', () => {
    expect(matchCommunity('Servidor de Pepe 10x')).toBeNull();
  });
});
