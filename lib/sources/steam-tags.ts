/**
 * Parseo de las etiquetas que Rust mete en el campo `gametype` de Steam.
 *
 * Va aparte de `steam.ts` a propósito: aquí no hay credenciales ni `fetch`,
 * sólo funciones puras. Así lo puede usar también el script de diagnóstico
 * (`npm run check:steam`), que corre fuera de Next y no puede importar nada
 * marcado `server-only`.
 *
 * Sin imports: se ejecuta tal cual con `node fichero.ts`.
 */

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

/** Parsea el campo `gametype` de un servidor de Rust. */
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
