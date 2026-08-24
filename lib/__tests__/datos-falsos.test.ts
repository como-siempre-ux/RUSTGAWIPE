import { describe, expect, it } from 'vitest';

import { describeCadence } from '../cadence';
import { matchCommunity } from '../catalog';
import { normalizeAll } from '../normalize';
import type { RawServer } from '../sources/battlemetrics';
import { DAY_MS } from '../time';
import { detectIntervalDays, resolveNextWipe } from '../wipe-schedule';

/**
 * Tres fallos que la web enseñaba como si fueran ciertos. Los nombres son
 * reales, sacados de la lista publicada: si alguno vuelve, esto lo caza.
 */

const NOW = Date.parse('2025-08-24T12:00:00.000Z');

describe('un día de la semana en el nombre significa wipe semanal', () => {
  it.each([
    ['[AU] Winterust - 2x Mondays'],
    ['MIRAGE RUST | SUNDAY 2x | Wipe 23.08'],
    ['MIRAGE RUST | FRIDAY 2x | Wipe 21.08'],
    ['RUST ROOM 1.5x | SATURDAY | Wipe 22.08'],
    ['ВОСТОК | MONDAY X2'],
    ['AQRUX RUST GREEN | X2 | SEMI-CLASSIC | THURSDAY'],
    ['RustVikings | Solo/Duo | Sundays | FULLWIPE 23/08 17:00CEST'],
    ['RustForNoobs.com | Mondays | Solo Duo Trio | AU'],
  ])('%s -> semanal, no mensual', (name) => {
    expect(detectIntervalDays(name)).toBe(7);

    const r = resolveNextWipe({ name, lastWipeMs: NOW - 2 * DAY_MS }, NOW);
    expect(describeCadence(r.cadence, r.cadenceDays)?.label).toBe('semanal');
  });

  it('"bi-weekly thursday" sigue siendo quincenal: lo específico gana', () => {
    expect(detectIntervalDays('[US] Bloo Lagoon Main | Bi-weekly Thursday')).toBe(14);
  });

  it('"monthly" con un día suelto sigue mandando el día', () => {
    // "Mondays" es una afirmación sobre cuándo wipea; ahí no hay ambigüedad.
    expect(detectIntervalDays('Rust EU Mondays')).toBe(7);
  });

  it('un nombre sin día ni ciclo sigue siendo mensual', () => {
    expect(detectIntervalDays('Rustopia.gg - EU Large')).toBeNull();
  });
});

describe('el último wipe real desmiente al calendario', () => {
  const rule = matchCommunity('Rusty Moose |US Small|')!.rule;

  it('el calendario dice semanal pero wipeó hace 18 días: gana el dato real', () => {
    const r = resolveNextWipe(
      { name: 'Rusty Moose |US Small|', rule, lastWipeMs: NOW - 18 * DAY_MS },
      NOW,
    );
    expect(r.confidence).toBe('estimado');
    expect(r.explanation).toContain('no cuadra con el último wipe real');
  });

  it('con el último wipe dentro de lo normal, el calendario manda', () => {
    const r = resolveNextWipe(
      { name: 'Rusty Moose |US Small|', rule, lastWipeMs: NOW - 3 * DAY_MS },
      NOW,
    );
    expect(r.confidence).toBe('programado');
  });

  it('un retraso de un ciclo no dispara la alarma: el margen es generoso', () => {
    const r = resolveNextWipe(
      { name: 'Rusty Moose |US Small|', rule, lastWipeMs: NOW - 10 * DAY_MS },
      NOW,
    );
    expect(r.confidence).toBe('programado');
  });

  it('los mensuales no se juzgan así: su ciclo no es fijo', () => {
    const mensual = matchCommunity('Rustafied.com - EU Long - Large')!.rule;
    const r = resolveNextWipe(
      { name: 'Rustafied.com - EU Long - Large', rule: mensual, lastWipeMs: NOW - 25 * DAY_MS },
      NOW,
    );
    expect(r.confidence).toBe('programado');
  });
});

describe('la cola no se cuenta como gente dentro', () => {
  const raw = (over: Partial<RawServer>): RawServer => ({
    id: 'x',
    name: 'Servidor',
    rustType: 'community',
    ip: '1.2.3.4',
    port: 28015,
    players: 785,
    maxPlayers: 700,
    country: 'de',
    lastWipeIso: null,
    nextWipeIso: null,
    worldSize: null,
    worldSeed: null,
    url: null,
    ...over,
  });

  it('785 de 700 plazas son 700 dentro y 85 esperando', () => {
    const [s] = normalizeAll([raw({})], NOW, 'steam');
    expect(s.players).toBe(700);
    expect(s.maxPlayers).toBe(700);
    expect(s.queued).toBe(85);
  });

  it('la etiqueta `qp` de Steam manda sobre lo que se sale del aforo', () => {
    const [s] = normalizeAll([raw({ players: 720, maxPlayers: 700, queued: 40 })], NOW, 'steam');
    expect(s.players).toBe(680);
    expect(s.queued).toBe(40);
  });

  it('un servidor a medias no inventa cola', () => {
    const [s] = normalizeAll([raw({ players: 120, maxPlayers: 300 })], NOW, 'steam');
    expect(s.players).toBe(120);
    expect(s.queued).toBeNull();
  });

  it('nunca salen jugadores por encima del aforo', () => {
    for (const p of [0, 300, 700, 701, 900, 5000]) {
      const [s] = normalizeAll([raw({ players: p })], NOW, 'steam');
      expect(s.players!, `con ${p} jugadores`).toBeLessThanOrEqual(s.maxPlayers!);
      expect(s.players!).toBeGreaterThanOrEqual(0);
    }
  });
});
