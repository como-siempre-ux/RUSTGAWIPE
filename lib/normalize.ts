/**
 * Convierte lo que devuelve cualquier fuente en el modelo propio, ya con el
 * próximo wipe resuelto. El cliente no sabe nada de la forma de las APIs
 * externas: sólo consume `RustServer`.
 */

import { CATALOG_SERVERS, matchCommunity, regionLabel } from './catalog';
import { detectGroupLimit } from './group-size';
import type { RawServer } from './sources/battlemetrics';
import type { RustServer, ServerType } from './types';
import { CONFIDENCE_WEIGHT, resolveNextWipe } from './wipe-schedule';

/**
 * Rust mete la cola dentro del número de jugadores, así que un servidor de
 * 700 plazas puede decir que tiene 785. Aquí se separan: dentro van los que
 * caben, y el resto es cola.
 *
 * Se usa la etiqueta `qp` de Steam cuando está; si no, lo que se sale del
 * aforo. Nunca al revés: `qp` es el dato, el desbordamiento es la deducción.
 */
function separarCola(
  players: number | null,
  maxPlayers: number | null,
  queued: number | null,
): { players: number | null; maxPlayers: number | null; queued: number | null } {
  if (players === null || maxPlayers === null) return { players, maxPlayers, queued };

  const cola = queued && queued > 0 ? queued : Math.max(0, players - maxPlayers);
  const dentro = Math.max(0, Math.min(players - cola, maxPlayers));

  return { players: dentro, maxPlayers, queued: cola > 0 ? cola : null };
}

function parseIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeType(rustType: string | null, name: string): ServerType {
  const t = (rustType ?? '').toLowerCase();
  if (t === 'official') return 'official';
  if (t === 'modded') return 'modded';
  if (t === 'community') return 'community';

  const n = name.toLowerCase();
  if (/facepunch|\bofficial\b/.test(n)) return 'official';
  if (/\b(\d+x|oxide|carbon|modded|kits|shop|zombies|raidable)\b/.test(n)) return 'modded';
  return 'community';
}

/** Tags implícitos que ayudan a la heurística de ciclo. */
function tagsFor(raw: RawServer): string[] {
  return [raw.rustType ?? ''].filter(Boolean);
}

export function normalizeServer(
  raw: RawServer,
  nowMs: number,
  source: RustServer['source'],
): RustServer {
  const type = normalizeType(raw.rustType, raw.name);
  const match = matchCommunity(raw.name);

  const resolution = resolveNextWipe(
    {
      name: raw.name,
      tags: tagsFor(raw),
      type,
      nextWipeMs: parseIso(raw.nextWipeIso),
      lastWipeMs: parseIso(raw.lastWipeIso),
      rule: match?.rule ?? null,
    },
    nowMs,
  );

  return {
    id: raw.id,
    name: raw.name,
    type,
    connect: raw.ip && raw.port ? `${raw.ip}:${raw.port}` : null,
    ...separarCola(raw.players, raw.maxPlayers, raw.queued ?? null),
    groupLimit: detectGroupLimit(raw.name),
    country: raw.country ? raw.country.toUpperCase() : null,
    region: raw.region ?? regionLabel(raw.name, raw.country),
    lastWipeMs: resolution.lastWipeMs,
    lastWipeIsDerived: resolution.lastWipeIsDerived,
    nextWipeMs: resolution.nextWipeMs,
    confidence: resolution.confidence,
    cadence: resolution.cadence,
    cadenceDays: resolution.cadenceDays,
    wipeExplanation: resolution.explanation,
    mapSize: raw.worldSize,
    mapSeed: raw.worldSeed,
    url: raw.url ?? match?.community.url ?? null,
    community: match?.community.name ?? null,
    source,

    rule: match?.rule ?? null,
    sourceLastWipeMs: parseIso(raw.lastWipeIso),
    sourceTags: tagsFor(raw),
  };
}

/**
 * Rehace la resolución con la hora que se le pase. La usa el cliente para que
 * las horas sean correctas aunque el payload venga de un build de hace días,
 * que es lo que pasa en un sitio estático.
 */
export function reresolve(server: RustServer, nowMs: number): RustServer {
  const r = resolveNextWipe(
    {
      name: server.name,
      tags: server.sourceTags,
      type: server.type,
      lastWipeMs: server.sourceLastWipeMs,
      rule: server.rule,
    },
    nowMs,
  );

  return {
    ...server,
    nextWipeMs: r.nextWipeMs,
    lastWipeMs: r.lastWipeMs,
    lastWipeIsDerived: r.lastWipeIsDerived,
    confidence: r.confidence,
    cadence: r.cadence,
    cadenceDays: r.cadenceDays,
    wipeExplanation: r.explanation,
  };
}

/** Rehace la lista entera y la vuelve a ordenar. */
export function reresolveAll(servers: RustServer[], nowMs: number): RustServer[] {
  return sortServers(servers.map((s) => reresolve(s, nowMs)));
}

/**
 * Ordena por población: los servidores con más gente primero.
 *
 * A igualdad de jugadores gana el que wipee antes, y los que no tienen dato
 * de población van al final en vez de mezclarse arriba con un 0.
 */
export function sortByPopulation(servers: RustServer[]): RustServer[] {
  return [...servers].sort((a, b) => {
    const pa = a.players ?? -1;
    const pb = b.players ?? -1;
    if (pa !== pb) return pb - pa;

    if (a.nextWipeMs === null && b.nextWipeMs === null) return 0;
    if (a.nextWipeMs === null) return 1;
    if (b.nextWipeMs === null) return -1;
    const wipe = a.nextWipeMs - b.nextWipeMs;
    return wipe !== 0 ? wipe : a.id.localeCompare(b.id);
  });
}

/** Ordena por wipe más próximo; a igualdad, por fiabilidad y luego población. */
export function sortServers(servers: RustServer[]): RustServer[] {
  return [...servers].sort((a, b) => {
    if (a.nextWipeMs === null && b.nextWipeMs === null) {
      const pob = (b.players ?? 0) - (a.players ?? 0);
      return pob !== 0 ? pob : a.id.localeCompare(b.id);
    }
    if (a.nextWipeMs === null) return 1;
    if (b.nextWipeMs === null) return -1;

    if (a.nextWipeMs !== b.nextWipeMs) return a.nextWipeMs - b.nextWipeMs;

    const conf = CONFIDENCE_WEIGHT[a.confidence] - CONFIDENCE_WEIGHT[b.confidence];
    if (conf !== 0) return conf;

    const pob = (b.players ?? 0) - (a.players ?? 0);
    if (pob !== 0) return pob;

    // Último desempate por id: sin esto el orden dependía del orden de
    // entrada, así que reordenar la misma lista podía dar resultados
    // distintos. En un sitio estático eso se nota entre recargas.
    return a.id.localeCompare(b.id);
  });
}

export function normalizeAll(
  raws: RawServer[],
  nowMs: number,
  source: RustServer['source'],
): RustServer[] {
  const seen = new Set<string>();
  const out: RustServer[] = [];

  for (const raw of raws) {
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    out.push(normalizeServer(raw, nowMs, source));
  }

  return sortServers(out);
}

/** Lista del catálogo, para cuando no hay ninguna credencial configurada. */
export function catalogAsServers(nowMs: number): RustServer[] {
  const raws: RawServer[] = CATALOG_SERVERS.map((c) => ({
    id: c.id,
    name: c.name,
    rustType: c.type,
    // Sin ip: las direcciones cambian entre wipes y no se inventan.
    ip: null,
    port: null,
    players: c.players,
    maxPlayers: c.maxPlayers,
    queued: null,
    // Ni país ni tamaño de mapa: la foto no los trae y no se rellenan a ojo.
    country: null,
    region: c.region,
    lastWipeIso: c.lastWipeMs ? new Date(c.lastWipeMs).toISOString() : null,
    nextWipeIso: null,
    worldSize: null,
    worldSeed: null,
    url: null,
  }));

  return normalizeAll(raws, nowMs, 'catalog');
}
