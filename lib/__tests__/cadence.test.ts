import { describe, expect, it } from 'vitest';

import { describeCadence, duracionDelMapa } from '../cadence';
import { matchCommunity } from '../catalog';
import { resolveNextWipe } from '../wipe-schedule';

describe('describeCadence', () => {
  it('los ciclos con nombre propio', () => {
    expect(describeCadence('weekly', 7)).toEqual({ label: 'semanal', days: 7 });
    expect(describeCadence('biweekly', 14)).toEqual({ label: 'quincenal', days: 14 });
    expect(describeCadence('monthly', null)).toEqual({ label: 'mensual', days: null });
  });

  it('los ciclos raros se dicen en días', () => {
    expect(describeCadence('custom', 3)).toEqual({ label: 'cada 3 días', days: 3 });
    expect(describeCadence('custom', 1)).toEqual({ label: 'diario', days: 1 });
    expect(describeCadence('custom', 2)).toEqual({ label: 'cada 2 días', days: 2 });
  });

  it('wipear dos veces por semana NO es "semanal"', () => {
    // El error fácil: WarBandits tiene cadencia semanal en el modelo, pero
    // wipea lunes y viernes. Decir "semanal" sería mentir sobre lo que dura
    // el mapa, que es lo que se pregunta.
    expect(describeCadence('weekly', 3.5, 2)).toEqual({
      label: '2 veces por semana',
      days: 3.5,
    });
    expect(describeCadence('weekly', 2.3, 3)).toEqual({
      label: '3 veces por semana',
      days: 2.3,
    });
  });

  it('sin datos no se inventa nada', () => {
    expect(describeCadence(null, null)).toBeNull();
    expect(describeCadence('custom', null)).toBeNull();
  });
});

describe('duracionDelMapa', () => {
  it.each([
    [7, '7 días'],
    [14, '14 días'],
    [1, 'un día'],
    [3, '3 días'],
    [3.5, '3,5 días'],
  ])('%s -> %s', (days, texto) => {
    expect(duracionDelMapa(days)).toBe(texto);
  });

  it('sin días no hay texto', () => {
    expect(duracionDelMapa(null)).toBeNull();
  });
});

describe('la cadencia que sale de la resolución real', () => {
  const now = Date.parse('2025-08-20T12:00:00.000Z');

  const cadenciaDe = (nombre: string) => {
    const rule = matchCommunity(nombre)?.rule ?? null;
    const r = resolveNextWipe({ name: nombre, rule }, now);
    return describeCadence(r.cadence, r.cadenceDays, rule?.weekdays?.length ?? 1);
  };

  it.each([
    ['Rustafied.com - EU Main', 'semanal'],
    ['Rustafied.com - EU Long - Large', 'mensual'],
    ['Rustafied.com - EU Trio', 'quincenal'],
    ['WARBANDITS.GG EU 3X |Solo/Duo/Trio| LootX3', '2 veces por semana'],
    ['Survivors.gg #1 [ 2x Solo/Duo/Trio/Quad ]', '2 veces por semana'],
    ['Survivors.gg #5 [ 2x Solo/Duo/Trio ]', 'semanal'],
    ['Atlas - EU 10x | No BPs | Kits | Shop', '2 veces por semana'],
    ['Atlas - EU 2X Medium | Vanilla+ | No BP Wipes', 'quincenal'],
    ['[EU] Facepunch Rust Official Main', 'mensual'],
  ])('%s -> %s', (nombre, esperado) => {
    expect(cadenciaDe(nombre)?.label).toBe(esperado);
  });

  it('un servidor cualquiera con "3 Day" en el nombre', () => {
    const r = resolveNextWipe({ name: 'Hardcore 3 Day Wipe EU', lastWipeMs: now - 1000 }, now);
    expect(describeCadence(r.cadence, r.cadenceDays)?.label).toBe('cada 3 días');
  });

  it('un servidor sin pistas es mensual, no desconocido', () => {
    const r = resolveNextWipe({ name: 'Servidor de Pepe', lastWipeMs: now - 1000 }, now);
    expect(describeCadence(r.cadence, r.cadenceDays)?.label).toBe('mensual');
  });
});
