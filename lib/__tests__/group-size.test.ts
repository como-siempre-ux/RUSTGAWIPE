import { describe, expect, it } from 'vitest';

import { NO_LIMIT, detectGroupLimit, groupLimitLabel } from '../group-size';

describe('detectGroupLimit', () => {
  it('coge el mayor del rango, no el primero que aparece', () => {
    // "Solo/Duo/Trio" permite grupos de hasta 3, no de 1.
    expect(detectGroupLimit('WARBANDITS.GG EU 3X |Solo/Duo/Trio| LootX3')).toBe(3);
    expect(detectGroupLimit('Survivors.gg #1 [ 2x Solo/Duo/Trio/Quad ]')).toBe(4);
    expect(detectGroupLimit('WARBANDITS.GG EU 2X |Solo/Duo| X2')).toBe(2);
  });

  it('entiende solo only', () => {
    expect(detectGroupLimit('WEREWOLF GAMING.CO 3x SOLO ONLY | No Clans/Teams')).toBe(1);
    expect(detectGroupLimit('Rustafied.com - US Solo')).toBe(1);
  });

  it('entiende los formatos numéricos', () => {
    expect(detectGroupLimit('[US] Bloo Lagoon Medium 1.5x | 4 Max | Bi-weekly')).toBe(4);
    expect(detectGroupLimit('Rust EU | Max 2 | Weekly')).toBe(2);
    expect(detectGroupLimit('Servidor con Max Group 3')).toBe(3);
    expect(detectGroupLimit('EU 2x Team Limit 2')).toBe(2);
  });

  it('el 1.5x del nombre no se confunde con un límite de grupo', () => {
    expect(detectGroupLimit('Bloo Lagoon Medium 1.5x | Bi-weekly')).toBeNull();
  });

  it('sin límite declarado es 0, no null', () => {
    expect(detectGroupLimit('EU 5x No Limit Zerg Wars')).toBe(NO_LIMIT);
    expect(detectGroupLimit('Rust EU Unlimited Groups')).toBe(NO_LIMIT);
  });

  it('sin ninguna pista es null: desconocido, que no es "sin límite"', () => {
    expect(detectGroupLimit('Rustafied.com - EU Main')).toBeNull();
    expect(detectGroupLimit('Rustopia US Large')).toBeNull();
  });

  it('descarta números absurdos como límite de grupo', () => {
    expect(detectGroupLimit('Rust EU max 250')).toBeNull();
  });
});

describe('groupLimitLabel', () => {
  it.each([
    [1, 'solo'],
    [2, 'dúo'],
    [3, 'trío'],
    [4, 'cuarteto'],
    [0, 'sin límite'],
  ])('%i -> %s', (limit, label) => {
    expect(groupLimitLabel(limit)).toBe(label);
  });

  it('desconocido no pinta badge', () => {
    expect(groupLimitLabel(null)).toBeNull();
  });

  it('un tope raro se escribe en largo', () => {
    expect(groupLimitLabel(8)).toBe('hasta 8');
  });
});
