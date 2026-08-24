import { describe, expect, it } from 'vitest';

import { CATALOG_SNAPSHOT_DATE } from '../catalog';
import { catalogAsServers, normalizeAll, sortByPopulation, sortServers } from '../normalize';
import type { RawServer } from '../sources/battlemetrics';

const NOW = Date.parse('2025-08-20T12:00:00.000Z');

const raw = (over: Partial<RawServer>): RawServer => ({
  id: 'x',
  name: 'Servidor',
  rustType: 'community',
  ip: '1.2.3.4',
  port: 28015,
  players: 10,
  maxPlayers: 100,
  country: 'es',
  lastWipeIso: null,
  nextWipeIso: null,
  worldSize: null,
  worldSeed: null,
  url: null,
  ...over,
});

describe('normalizeServer', () => {
  it('monta el comando de conexión', () => {
    const [s] = normalizeAll([raw({})], NOW, 'steam');
    expect(s.connect).toBe('1.2.3.4:28015');
  });

  it('sin ip o sin puerto no hay comando de conexión', () => {
    const [s] = normalizeAll([raw({ ip: null })], NOW, 'steam');
    expect(s.connect).toBeNull();
  });

  it('pasa el país a mayúsculas y deduce la región', () => {
    const [s] = normalizeAll([raw({ country: 'es' })], NOW, 'steam');
    expect(s.country).toBe('ES');
    expect(s.region).toBe('Europa');
  });

  it('reconoce la comunidad y la deja en el modelo', () => {
    const [s] = normalizeAll([raw({ name: 'Rustafied.com - EU Main' })], NOW, 'steam');
    expect(s.community).toBe('Rustafied');
    expect(s.confidence).toBe('programado');
    expect(s.url).toBe('https://www.rustafied.com');
  });

  it('descarta ids repetidos', () => {
    const out = normalizeAll([raw({ id: 'a' }), raw({ id: 'a' })], NOW, 'steam');
    expect(out).toHaveLength(1);
  });
});

describe('sortByPopulation', () => {
  const base = normalizeAll([raw({})], NOW, 'steam')[0];

  it('los de más gente primero', () => {
    const list = [
      { ...base, id: 'poca', players: 40 },
      { ...base, id: 'mucha', players: 800 },
      { ...base, id: 'media', players: 300 },
    ];
    expect(sortByPopulation(list).map((s) => s.id)).toEqual(['mucha', 'media', 'poca']);
  });

  it('a igual población gana el que wipee antes', () => {
    const list = [
      { ...base, id: 'tarde', players: 100, nextWipeMs: NOW + 9000 },
      { ...base, id: 'pronto', players: 100, nextWipeMs: NOW + 1000 },
    ];
    expect(sortByPopulation(list).map((s) => s.id)).toEqual(['pronto', 'tarde']);
  });

  it('los que no dicen cuánta gente tienen van al final, no arriba con un 0', () => {
    const list = [
      { ...base, id: 'sinDato', players: null },
      { ...base, id: 'vacio', players: 0 },
      { ...base, id: 'lleno', players: 500 },
    ];
    expect(sortByPopulation(list).map((s) => s.id)).toEqual(['lleno', 'vacio', 'sinDato']);
  });
});

describe('sortServers', () => {
  const base = normalizeAll([raw({})], NOW, 'steam')[0];

  it('el wipe más próximo va primero y los desconocidos al final', () => {
    const list = [
      { ...base, id: 'c', nextWipeMs: null },
      { ...base, id: 'b', nextWipeMs: NOW + 5000 },
      { ...base, id: 'a', nextWipeMs: NOW + 1000 },
    ];
    expect(sortServers(list).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('a igual hora de wipe gana el dato más fiable', () => {
    const list = [
      { ...base, id: 'estimado', nextWipeMs: NOW + 1000, confidence: 'estimado' as const },
      { ...base, id: 'confirmado', nextWipeMs: NOW + 1000, confidence: 'confirmado' as const },
    ];
    expect(sortServers(list).map((s) => s.id)).toEqual(['confirmado', 'estimado']);
  });
});

describe('catálogo de reserva (foto real de Steam)', () => {
  // La foto es de una fecha concreta; el "ahora" tiene que ser posterior o
  // las anclas de wipe caerían en el futuro.
  const AHORA = Date.parse(`${CATALOG_SNAPSHOT_DATE}T12:00:00.000Z`) + 3 * 864e5;
  const servers = catalogAsServers(AHORA);

  it('son servidores reales, no una lista escrita a mano', () => {
    expect(servers.length).toBeGreaterThan(100);
    // Todos vienen de la foto, así que ninguno puede tener un id inventado.
    expect(servers.every((s) => s.id.startsWith('snap-'))).toBe(true);
  });

  it('no se inventa nada que la foto no traiga', () => {
    // Ni ips, ni tamaños de mapa, ni seeds: eso era lo que estaba inventado.
    expect(servers.every((s) => s.connect === null)).toBe(true);
    expect(servers.every((s) => s.mapSize === null)).toBe(true);
    expect(servers.every((s) => s.mapSeed === null)).toBe(true);
  });

  it('la población nunca pasa del aforo', () => {
    const malos = servers
      .filter((s) => s.players !== null && s.maxPlayers !== null && s.players > s.maxPlayers)
      .map((s) => `${s.name} ${s.players}/${s.maxPlayers}`);
    expect(malos).toEqual([]);
  });

  it('nunca se marca nada como confirmado: la foto no es el servidor', () => {
    expect(servers.some((s) => s.confidence === 'confirmado')).toBe(false);
  });

  it('los que casan con una comunidad usan su calendario', () => {
    const conComunidad = servers.filter((s) => s.community !== null);
    expect(conComunidad.length).toBeGreaterThan(50);
    expect(conComunidad.every((s) => s.rule !== null)).toBe(true);
    expect(conComunidad.every((s) => s.confidence !== 'desconocido')).toBe(true);
  });

  it('los de marca desconocida se resuelven por su ancla de wipe', () => {
    const sinComunidad = servers.filter((s) => s.community === null);
    // Es normal que los haya: la foto trae servidores de todo el mundo, no
    // sólo de las comunidades que tenemos fichadas.
    expect(sinComunidad.length).toBeGreaterThan(0);
    const conAncla = sinComunidad.filter((s) => s.sourceLastWipeMs !== null);
    expect(conAncla.every((s) => s.nextWipeMs !== null)).toBe(true);
  });

  it('el próximo wipe siempre cae en el futuro', () => {
    const pasados = servers
      .filter((s) => s.nextWipeMs !== null && s.nextWipeMs <= AHORA)
      .map((s) => s.name);
    expect(pasados).toEqual([]);
  });

  it('el último wipe siempre es anterior al próximo', () => {
    const malos = servers
      .filter((s) => s.lastWipeMs !== null && s.nextWipeMs !== null && s.lastWipeMs >= s.nextWipeMs)
      .map((s) => s.name);
    expect(malos).toEqual([]);
  });

  it('un ancla vieja no se enseña como "wipeó hace tres meses"', () => {
    // La foto es de hace días, pero sus anclas pueden ser de mucho antes.
    // Al avanzarlas al ciclo actual, ningún último wipe puede quedar más
    // atrás que un ciclo mensual.
    const viejos = servers
      .filter((s) => s.lastWipeMs !== null && AHORA - s.lastWipeMs > 40 * 864e5)
      .map((s) => s.name);
    expect(viejos).toEqual([]);
  });

  it('deduce el tamaño de grupo de los nombres reales', () => {
    const conGrupo = servers.filter((s) => s.groupLimit !== null);
    expect(conGrupo.length).toBeGreaterThan(20);
    expect(conGrupo.every((s) => s.groupLimit! >= 0 && s.groupLimit! <= 12)).toBe(true);
  });

  it('sale ordenado por wipe más próximo, con los desconocidos al final', () => {
    const conFecha = servers.filter((s) => s.nextWipeMs !== null);
    for (let i = 1; i < conFecha.length; i++) {
      expect(conFecha[i].nextWipeMs!).toBeGreaterThanOrEqual(conFecha[i - 1].nextWipeMs!);
    }
    const primerNulo = servers.findIndex((s) => s.nextWipeMs === null);
    if (primerNulo !== -1) {
      expect(servers.slice(primerNulo).every((s) => s.nextWipeMs === null)).toBe(true);
    }
  });
});
