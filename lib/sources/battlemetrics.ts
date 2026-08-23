/**
 * Cliente de BattleMetrics.
 *
 * Aviso: desde 2026 `api.battlemetrics.com/servers` responde
 * `403 "A subscription is required to use the API"` incluso con un token de
 * cuenta gratuita. Este adaptador se mantiene porque es la mejor fuente si
 * tienes suscripción, pero no es el camino por defecto. Ver README.
 *
 * Este módulo sólo se importa desde el servidor: el token nunca sale de aquí.
 */

import 'server-only';

import { bmResponseSchema, type BmServer } from '../types';

const BASE = 'https://api.battlemetrics.com/servers';

/** Páginas de 100 servidores. 3 páginas = 300 servidores. */
export const PAGES_TO_FETCH = 3;

export interface RawServer {
  id: string;
  name: string;
  rustType: string | null;
  ip: string | null;
  port: number | null;
  players: number | null;
  maxPlayers: number | null;
  country: string | null;
  lastWipeIso: string | null;
  nextWipeIso: string | null;
  worldSize: number | null;
  worldSeed: number | null;
  url: string | null;
}

function toRaw(s: BmServer): RawServer {
  const a = s.attributes;
  const d = a.details ?? {};
  return {
    id: s.id,
    name: a.name ?? '(sin nombre)',
    rustType: d.rust_type ?? null,
    ip: a.ip ?? null,
    port: a.port ?? null,
    players: a.players ?? null,
    maxPlayers: a.maxPlayers ?? null,
    country: a.country ?? null,
    lastWipeIso: d.rust_last_wipe ?? null,
    nextWipeIso: d.rust_next_wipe ?? null,
    worldSize: d.rust_world_size ?? null,
    worldSeed: d.rust_world_seed ?? null,
    url: d.rust_url ?? null,
  };
}

export function hasBattlemetricsToken(): boolean {
  return Boolean(process.env.BATTLEMETRICS_TOKEN);
}

/**
 * Trae hasta `PAGES_TO_FETCH * 100` servidores ordenados por jugadores.
 * Lanza si la API responde con error: quien llama decide si cae a otra fuente.
 */
export async function fetchBattlemetrics(signal?: AbortSignal): Promise<RawServer[]> {
  const token = process.env.BATTLEMETRICS_TOKEN;
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  let url: string | null =
    `${BASE}?filter[game]=rust&filter[status]=online&page[size]=100&sort=-players`;
  const out: RawServer[] = [];

  for (let page = 0; page < PAGES_TO_FETCH && url; page++) {
    const res: Response = await fetch(url, { headers, signal, cache: 'no-store' });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `battlemetrics ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
      );
    }

    const parsed = bmResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error('battlemetrics: respuesta con forma inesperada');
    }

    out.push(...parsed.data.data.map(toRaw));
    url = parsed.data.links?.next ?? null;
  }

  return out;
}
