/**
 * Cliente de la Steam Web API (`IGameServersService/GetServerList`).
 *
 * Es la fuente recomendada: la clave es gratis e instantánea en
 * https://steamcommunity.com/dev/apikey y devuelve la lista real de servidores
 * de Rust con población en vivo.
 *
 * El truco está en el campo `gametype`: Rust mete ahí sus etiquetas separadas
 * por comas, y una de ellas es `born<unix>`, que es la fecha del último wipe.
 *
 * Sólo se importa desde el servidor: la clave nunca sale de aquí.
 */

import 'server-only';

import { steamResponseSchema, type SteamServer } from '../types';
import type { RawServer } from './battlemetrics';

const RUST_APPID = 252490;
const ENDPOINT = 'https://api.steampowered.com/IGameServersService/GetServerList/v1/';

/** Cuántos servidores pedir. Steam ordena por relevancia/población. */
export const STEAM_LIMIT = 300;

export interface SteamTags {
  /** Último wipe según la etiqueta `born<unix>`. */
  bornMs: number | null;
  maxPlayers: number | null;
  currentPlayers: number | null;
  queued: number | null;
  version: string | null;
  /** Etiquetas sueltas: `weekly`, `vanilla`, `oxide`, `hardcore`... */
  flags: string[];
}

/**
 * Parsea el campo `gametype` de un servidor de Rust.
 * Exportado aparte porque es la única parte con lógica de verdad y tiene test.
 */
export function parseGameType(gametype: string | null | undefined): SteamTags {
  const out: SteamTags = {
    bornMs: null,
    maxPlayers: null,
    currentPlayers: null,
    queued: null,
    version: null,
    flags: [],
  };
  if (!gametype) return out;

  for (const rawTag of gametype.split(',')) {
    const tag = rawTag.trim().toLowerCase();
    if (!tag) continue;

    const born = /^born(\d{9,13})$/.exec(tag);
    if (born) {
      const n = Number(born[1]);
      // Rust publica segundos; se acepta ms por si acaso.
      out.bornMs = n > 1e11 ? n : n * 1000;
      continue;
    }

    const mp = /^mp(\d+)$/.exec(tag);
    if (mp) {
      out.maxPlayers = Number(mp[1]);
      continue;
    }

    const cp = /^cp(\d+)$/.exec(tag);
    if (cp) {
      out.currentPlayers = Number(cp[1]);
      continue;
    }

    const qp = /^qp(\d+)$/.exec(tag);
    if (qp) {
      out.queued = Number(qp[1]);
      continue;
    }

    const v = /^v(\d{3,})$/.exec(tag);
    if (v) {
      out.version = v[1];
      continue;
    }

    out.flags.push(tag);
  }

  return out;
}

/** Tipo de servidor deducido de las etiquetas de Steam y del nombre. */
export function steamServerType(tags: SteamTags, name: string): string {
  const n = name.toLowerCase();
  if (tags.flags.includes('oxide') || tags.flags.includes('carbon') || tags.flags.includes('modded')) {
    return 'modded';
  }
  if (/facepunch|official/.test(n)) return 'official';
  return 'community';
}

export function toRawFromSteam(s: SteamServer): RawServer {
  const tags = parseGameType(s.gametype);
  const [ip, portStr] = (s.addr ?? '').split(':');
  const name = s.name ?? '(sin nombre)';

  return {
    id: `steam-${s.addr}`,
    name,
    rustType: steamServerType(tags, name),
    ip: ip || null,
    // El puerto de juego (para `client.connect`) no es el de consulta.
    port: s.gameport ?? (portStr ? Number(portStr) : null),
    players: s.players ?? tags.currentPlayers,
    maxPlayers: s.max_players ?? tags.maxPlayers,
    country: null, // Steam no lo da; se deduce del nombre.
    lastWipeIso: tags.bornMs ? new Date(tags.bornMs).toISOString() : null,
    nextWipeIso: null, // Steam nunca lo da.
    worldSize: null,
    worldSeed: null,
    url: null,
  };
}

export function hasSteamKey(): boolean {
  return Boolean(process.env.STEAM_API_KEY);
}

/** Trae hasta `STEAM_LIMIT` servidores de Rust, ordenados por jugadores. */
export async function fetchSteam(signal?: AbortSignal): Promise<RawServer[]> {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error('steam: falta STEAM_API_KEY');

  const filter = ['\\appid\\', String(RUST_APPID), '\\dedicated\\1', '\\empty\\1'].join('');
  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&limit=${STEAM_LIMIT}&filter=${encodeURIComponent(filter)}`;

  const res = await fetch(url, { signal, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`steam ${res.status}: comprueba STEAM_API_KEY`);
  }

  const parsed = steamResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error('steam: respuesta con forma inesperada');
  }

  return (parsed.data.response.servers ?? [])
    .map(toRawFromSteam)
    .sort((a, b) => (b.players ?? 0) - (a.players ?? 0));
}
