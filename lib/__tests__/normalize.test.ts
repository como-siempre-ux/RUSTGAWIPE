import { describe, expect, it } from 'vitest';

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

  it('todos van marcados como programado, nunca como confirmado', () => {
    expect(servers.every((s) => s.confidence === 'programado')).toBe(true);
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
    expect(servers.every((s) => s.community !== null)).toBe(true);
  });
});
