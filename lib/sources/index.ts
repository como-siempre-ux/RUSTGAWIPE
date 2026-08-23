/**
 * Elige la fuente de datos y cae a la siguiente si falla.
 *
 * Orden:
 *   1. BattleMetrics  — la mejor, pero su API pide suscripción de pago.
 *   2. Steam Web API  — clave gratis, población en vivo, último wipe vía `born`.
 *   3. Catálogo local — sin credenciales, sólo servidores famosos.
 */

import 'server-only';

import { catalogAsServers, normalizeAll } from '../normalize';
import type { RustServer, WipesPayload } from '../types';
import { nextForcedWipe } from '../wipe-schedule';
import { fetchBattlemetrics, hasBattlemetricsToken } from './battlemetrics';
import { fetchSteam, hasSteamKey } from './steam';

const CATALOG_NOTICE =
  'modo sin credenciales: sólo se listan comunidades conocidas, con horarios de su calendario publicado y sin población ni ip en vivo. añade STEAM_API_KEY en .env.local para la lista completa.';

export async function getWipes(nowMs: number): Promise<WipesPayload> {
  const attempts: string[] = [];

  if (hasBattlemetricsToken()) {
    try {
      const raw = await fetchBattlemetrics();
      return payload(normalizeAll(raw, nowMs, 'battlemetrics'), nowMs, 'battlemetrics', null);
    } catch (err) {
      attempts.push(`battlemetrics: ${message(err)}`);
    }
  }

  if (hasSteamKey()) {
    try {
      const raw = await fetchSteam();
      if (raw.length > 0) {
        return payload(normalizeAll(raw, nowMs, 'steam'), nowMs, 'steam', notice(attempts));
      }
      attempts.push('steam: la lista vino vacía');
    } catch (err) {
      attempts.push(`steam: ${message(err)}`);
    }
  }

  const fallbackNotice = attempts.length
    ? `${CATALOG_NOTICE} (${attempts.join(' · ')})`
    : CATALOG_NOTICE;

  return payload(catalogAsServers(nowMs), nowMs, 'catalog', fallbackNotice);
}

function payload(
  servers: RustServer[],
  nowMs: number,
  source: WipesPayload['source'],
  notice: string | null,
): WipesPayload {
  return {
    generatedAtMs: nowMs,
    nextForcedWipeMs: nextForcedWipe(nowMs),
    source,
    notice,
    count: servers.length,
    servers,
  };
}

function notice(attempts: string[]): string | null {
  return attempts.length ? `fuente principal no disponible — ${attempts.join(' · ')}` : null;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
