import { describe, expect, it } from 'vitest';

import { CATALOG_SERVERS, COMMUNITIES } from '../catalog';
import { catalogAsServers, normalizeAll, sortServers } from '../normalize';
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

describe('catálogo sin credenciales', () => {
  const servers = catalogAsServers(NOW);

  it('devuelve servidores y todos tienen próximo wipe resuelto', () => {
    expect(servers.length).toBeGreaterThan(30);
    expect(servers.every((s) => s.nextWipeMs !== null)).toBe(true);
  });

  it('nunca se marca nada como confirmado: el catálogo no es el servidor', () => {
    expect(servers.some((s) => s.confidence === 'confirmado')).toBe(false);
  });

  it('los calendarios verificados son programado y los demás estimado', () => {
    expect(servers.every((s) => s.confidence === 'programado' || s.confidence === 'estimado')).toBe(
      true,
    );
    // Tiene que haber de los dos: si no, o no se verifica nada o se verifica todo.
    expect(servers.some((s) => s.confidence === 'programado')).toBe(true);
    expect(servers.some((s) => s.confidence === 'estimado')).toBe(true);

    const rustafied = servers.find((s) => s.name === 'Rustafied.com - EU Main')!;
    expect(rustafied.confidence).toBe('programado');

    const warbandits = servers.find((s) => s.community === 'WarBandits')!;
    expect(warbandits.confidence).toBe('estimado');
  });

  it('todos traen último wipe calculado y en el pasado', () => {
    expect(servers.every((s) => s.lastWipeMs !== null)).toBe(true);
    expect(servers.every((s) => s.lastWipeMs! <= NOW)).toBe(true);
    // Ninguno viene de una fuente real, así que todos van marcados.
    expect(servers.every((s) => s.lastWipeIsDerived)).toBe(true);
  });

  it('el último wipe siempre es anterior al próximo', () => {
    const malos = servers
      .filter((s) => s.lastWipeMs! >= s.nextWipeMs!)
      .map((s) => s.name);
    expect(malos).toEqual([]);
  });

  it('hay servidores de cada tamaño de grupo, para que los filtros sirvan', () => {
    const cuenta = (n: number) => servers.filter((s) => s.groupLimit === n).length;
    expect(cuenta(1)).toBeGreaterThanOrEqual(4); // solo
    expect(cuenta(2)).toBeGreaterThanOrEqual(15); // dúo
    expect(cuenta(3)).toBeGreaterThanOrEqual(10); // trío
    expect(cuenta(4)).toBeGreaterThanOrEqual(4); // cuarteto
    expect(cuenta(0)).toBeGreaterThanOrEqual(1); // sin límite
  });

  it('deduce el tamaño de grupo del nombre', () => {
    const wb = servers.find((s) => s.name.includes('EU 3X |Solo/Duo/Trio|'))!;
    expect(wb.groupLimit).toBe(3);

    const solo = servers.find((s) => s.name.includes('SOLO ONLY | No Clans'))!;
    expect(solo.groupLimit).toBe(1);

    const sinPista = servers.find((s) => s.name === 'Rustafied.com - EU Main')!;
    expect(sinPista.groupLimit).toBeNull();
  });

  it('no se inventa ips', () => {
    expect(servers.every((s) => s.connect === null)).toBe(true);
  });

  it('sale ordenado por wipe más próximo', () => {
    for (let i = 1; i < servers.length; i++) {
      expect(servers[i].nextWipeMs!).toBeGreaterThanOrEqual(servers[i - 1].nextWipeMs!);
    }
  });

  it('cada servidor del catálogo casa con su comunidad', () => {
    const huerfanos = servers.filter((s) => s.community === null).map((s) => s.name);
    expect(huerfanos).toEqual([]);
  });

  it('no hay ids ni nombres repetidos', () => {
    const ids = CATALOG_SERVERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);

    const nombres = CATALOG_SERVERS.map((s) => s.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('todas las comunidades del catálogo tienen al menos un servidor', () => {
    const conServidor = new Set(servers.map((s) => s.community));
    const sinServidor = COMMUNITIES.map((c) => c.name).filter((n) => !conServidor.has(n));
    // Facepunch y Reddit sí los tienen; si alguna otra se queda sin servidor
    // es que la regex de `match` no casa con los nombres que hemos puesto.
    expect(sinServidor).toEqual([]);
  });
});
