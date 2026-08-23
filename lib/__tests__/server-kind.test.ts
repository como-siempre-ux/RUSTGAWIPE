import { describe, expect, it } from 'vitest';

import { esServidorDeWipe } from '../server-kind';

/**
 * Los nombres de estos tests son reales: salieron de la lista publicada, no
 * son inventados. Si la regla cambia y algún servidor de verdad empieza a
 * desaparecer de la web, esto lo caza.
 */
describe('esServidorDeWipe', () => {
  it.each([
    ["EU | Helli's Aimtrain | Facechecks/1v1/Speargun/Hellis"],
    ['RustReborn.gg EU - Bedwars | AimTrain | Creative | Arena | FFA'],
    ['[RU] RUST ROOM BUILD 2.0 by GJ | CREATIVE & SANDBOX'],
    ['Rusticated.com - Creative | Bedwars | CREATIVE 4.0 OUT NOW!'],
    ['R2 - Aim training / Matchmaking / Facechecks - RU Main'],
    ['UKN.GG - EU Training Grounds - Main'],
    ['[EU] Builders Sanctuary 3.0 Creative | Sandbox | Minigames'],
    ['DOGFIGHT | BATTLEFIELD/HELI/MINI/AIMTRAIN/PVP/BOW'],
  ])('fuera: %s', (name) => {
    expect(esServidorDeWipe(name)).toBe(false);
  });

  it.each([
    ['WARBANDITS.GG 3X |Solo/Duo/Trio|LootX3| JUST FULLWIPED'],
    ['Atlas - EU 2X Medium | Vanilla+ | No BP Wipes'],
    ['Rusty Moose |US Biweekly|'],
    ['Rustafied.com - EU Main'],
    ['Survivors.gg #4 [ 2x Solo/Duo/Trio/Quad/Max5 ]'],
    ['MIRAGE RUST | SUNDAY 2x | Wipe 23.08'],
    ['Rustopia.gg - US Hardcore Trio'],
    ['[EU] Facepunch Rust Official Main'],
  ])('dentro: %s', (name) => {
    expect(esServidorDeWipe(name)).toBe(true);
  });

  it('una señal de wipe rescata un nombre que si no se descartaría', () => {
    // Éste es real y llevaba "ARENA": si la regla usara `arena` como motivo
    // de descarte, se perdería un servidor de wipe legítimo. Por eso `arena`
    // no está en la lista, y además "WIPE" y "VANILLA" lo rescatan.
    expect(esServidorDeWipe('[WIPE DAY 21/08] ARENA BR SOLO VANILLA | LATAM | SOLO ONLY')).toBe(
      true,
    );
    expect(esServidorDeWipe('EU 2x Creative Vanilla Weekly Wipe')).toBe(true);
  });

  it('"arena" a secas no descarta: lo usan servidores de supervivencia', () => {
    expect(esServidorDeWipe('Arena Rust EU 2x')).toBe(true);
  });
});
