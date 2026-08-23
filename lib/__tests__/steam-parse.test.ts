import { describe, expect, it } from 'vitest';

import {
  parseGameType,
  steamRegionLabel,
  steamServerType,
  toRawFromSteam,
} from '../sources/steam';

/**
 * Rust mete sus etiquetas en el campo `gametype` de Steam, separadas por
 * comas. La importante es `born<unix>`: es la fecha del último wipe.
 */
const SAMPLE =
  'mp250,cp187,qp0,v2453,stok,born1754586000,gmrust,oxide,weekly,vanilla,birthday';

describe('parseGameType', () => {
  it('saca el último wipe de la etiqueta born', () => {
    const t = parseGameType(SAMPLE);
    expect(t.bornMs).toBe(1754586000 * 1000);
    expect(new Date(t.bornMs!).toISOString()).toBe('2025-08-07T17:00:00.000Z');
  });

  it('saca jugadores, máximo, cola y versión', () => {
    const t = parseGameType(SAMPLE);
    expect(t.maxPlayers).toBe(250);
    expect(t.currentPlayers).toBe(187);
    expect(t.queued).toBe(0);
    expect(t.version).toBe('2453');
  });

  it('guarda las etiquetas sueltas', () => {
    const t = parseGameType(SAMPLE);
    expect(t.flags).toContain('oxide');
    expect(t.flags).toContain('weekly');
    expect(t.flags).toContain('vanilla');
    expect(t.flags).not.toContain('mp250');
  });

  it('acepta born en milisegundos', () => {
    expect(parseGameType('born1754586000000').bornMs).toBe(1754586000000);
  });

  it('aguanta gametype vacío o ausente', () => {
    expect(parseGameType(null).bornMs).toBeNull();
    expect(parseGameType('').flags).toEqual([]);
    expect(parseGameType(',,,').flags).toEqual([]);
  });
});

describe('steamServerType', () => {
  it('oxide o carbon -> modded', () => {
    expect(steamServerType(parseGameType('oxide'), 'Cualquiera')).toBe('modded');
    expect(steamServerType(parseGameType('carbon'), 'Cualquiera')).toBe('modded');
  });

  it('facepunch -> official', () => {
    expect(steamServerType(parseGameType('stok'), '[EU] Facepunch Main')).toBe('official');
  });

  it('el resto -> community', () => {
    expect(steamServerType(parseGameType('stok'), 'Servidor de Pepe')).toBe('community');
  });
});

describe('steamRegionLabel', () => {
  it.each([
    [0, 'Norteamérica'],
    [1, 'Norteamérica'],
    [2, 'Sudamérica'],
    [3, 'Europa'],
    [4, 'Asia'],
    [5, 'Oceanía'],
    [6, 'Oriente Medio'],
    [7, 'África'],
  ])('código %i -> %s', (code, label) => {
    expect(steamRegionLabel(code)).toBe(label);
  });

  it('"mundo" y los ausentes no dicen nada: null, para caer al nombre', () => {
    expect(steamRegionLabel(255)).toBeNull();
    expect(steamRegionLabel(-1)).toBeNull();
    expect(steamRegionLabel(null)).toBeNull();
    expect(steamRegionLabel(undefined)).toBeNull();
  });
});

describe('toRawFromSteam', () => {
  it('usa gameport para el comando de conexión, no el de consulta', () => {
    const raw = toRawFromSteam({
      addr: '45.88.230.11:28017',
      gameport: 28015,
      name: 'Rustafied.com - EU Main',
      players: 300,
      max_players: 350,
      gametype: SAMPLE,
    });
    expect(raw.ip).toBe('45.88.230.11');
    expect(raw.port).toBe(28015);
    expect(raw.lastWipeIso).toBe('2025-08-07T17:00:00.000Z');
    expect(raw.players).toBe(300);
  });

  it('cae al puerto de addr si no viene gameport', () => {
    const raw = toRawFromSteam({ addr: '1.2.3.4:28015', name: 'X' });
    expect(raw.port).toBe(28015);
  });
});
