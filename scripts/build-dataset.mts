/**
 * Cocina el fichero de datos del sitio estático.
 *
 *   npm run build:static
 *
 * En GitHub Pages no hay servidor, así que `/api/wipes` no existe. En su
 * lugar se escribe `public/data/servers.json` en el build y el navegador lo
 * lee tal cual.
 *
 * Lo importante: **el JSON no lleva horas resueltas que caduquen**. Lleva el
 * calendario de cada servidor, y el navegador hace la cuenta con su propio
 * reloj. Así el sitio dice la verdad aunque el build sea de hace un mes.
 * Lo único que envejece es la población y la ip, y la interfaz lo avisa.
 *
 * Si hay STEAM_API_KEY (en local o como secreto de GitHub Actions) usa la
 * lista en vivo. Si no, el catálogo. Nunca falla por no tener clave.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CATALOG_SERVERS, matchCommunity, regionLabel } from '../lib/catalog.ts';
import { detectGroupLimit } from '../lib/group-size.ts';
import { parseGameType, steamRegionLabel, steamServerType } from '../lib/sources/steam-tags.ts';

const RUST_APPID = 252490;
const ENDPOINT = 'https://api.steampowered.com/IGameServersService/GetServerList/v1/';
/**
 * Se piden muchos y se recortan por población.
 *
 * `GetServerList` no ordena por jugadores: devuelve lo que le apetece. Con
 * limit=300 salían 300 servidores al azar de los ~20.000 que hay, y no
 * aparecían ni Rustafied ni Rustoria ni Atlas. Pidiendo 5.000 y quedándonos
 * con los más poblados salen los que la gente busca de verdad.
 */
const LIMIT_PETICION = 5000;
const CUANTOS_PUBLICAR = 300;
const SALIDA = join(process.cwd(), 'public', 'data', 'servers.json');

interface Crudo {
  id: string;
  name: string;
  rustType: string | null;
  ip: string | null;
  port: number | null;
  players: number | null;
  maxPlayers: number | null;
  country: string | null;
  /** Región según el código numérico de Steam, cuando la fuente lo da. */
  region: string | null;
  lastWipeMs: number | null;
  worldSize: number | null;
}

function leerEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const texto = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const linea of texto.split('\n')) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith('#')) continue;
      const i = limpia.indexOf('=');
      if (i === -1) continue;
      out[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no hay .env.local: normal en CI */
  }
  return out;
}

async function desdeSteam(key: string): Promise<Crudo[]> {
  const filter = ['\\appid\\', String(RUST_APPID), '\\dedicated\\1', '\\empty\\1'].join('');
  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&limit=${LIMIT_PETICION}&filter=${encodeURIComponent(filter)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`steam respondió ${res.status}`);

  const json = (await res.json()) as {
    response?: { servers?: Array<Record<string, unknown>> };
  };
  const servers = json.response?.servers ?? [];
  if (servers.length === 0) throw new Error('steam devolvió una lista vacía');

  console.log(`  Steam ha devuelto ${servers.length}; nos quedamos con los ${CUANTOS_PUBLICAR} de más gente.`);

  return servers
    .map((s) => {
    const tags = parseGameType(s.gametype as string);
    const name = (s.name as string) ?? '(sin nombre)';
    const [ip, portStr] = String(s.addr ?? '').split(':');
    return {
      id: `steam-${s.addr}`,
      name,
      rustType: steamServerType(tags, name),
      ip: ip || null,
      port: (s.gameport as number) ?? (portStr ? Number(portStr) : null),
      players: (s.players as number) ?? tags.currentPlayers,
      maxPlayers: (s.max_players as number) ?? tags.maxPlayers,
      country: null,
      region: steamRegionLabel(s.region as number),
      lastWipeMs: tags.bornMs,
      worldSize: null,
    };
    })
    .sort((a, b) => (b.players ?? 0) - (a.players ?? 0))
    .slice(0, CUANTOS_PUBLICAR);
}

function desdeCatalogo(): Crudo[] {
  return CATALOG_SERVERS.map((c) => ({
    id: c.id,
    name: c.name,
    rustType: c.type,
    ip: null,
    port: null,
    players: c.typicalPlayers,
    maxPlayers: c.maxPlayers,
    country: c.country,
    region: null,
    lastWipeMs: null,
    worldSize: c.mapSize,
  }));
}

function normalizar(crudos: Crudo[], source: string) {
  const vistos = new Set<string>();
  const out = [];

  for (const raw of crudos) {
    if (vistos.has(raw.id)) continue;
    vistos.add(raw.id);

    const match = matchCommunity(raw.name);
    const n = raw.name.toLowerCase();
    const type =
      raw.rustType === 'official' || /facepunch|\bofficial\b/.test(n)
        ? 'official'
        : raw.rustType === 'modded' || /\b(\d+x|oxide|carbon|modded|kits|shop)\b/.test(n)
          ? 'modded'
          : 'community';

    out.push({
      id: raw.id,
      name: raw.name,
      type,
      connect: raw.ip && raw.port ? `${raw.ip}:${raw.port}` : null,
      players: raw.players,
      maxPlayers: raw.maxPlayers,
      groupLimit: detectGroupLimit(raw.name),
      country: raw.country ? raw.country.toUpperCase() : null,
      // La región de Steam manda; si no la da, se deduce del nombre.
      region: raw.region ?? regionLabel(raw.name, raw.country),
      mapSize: raw.worldSize,
      mapSeed: null,
      url: match?.community.url ?? null,
      community: match?.community.name ?? null,
      source,

      // Lo que permite rehacer las horas en el navegador.
      rule: match?.rule ?? null,
      sourceLastWipeMs: raw.lastWipeMs,
      sourceTags: raw.rustType ? [raw.rustType] : [],

      // Valores de arranque; el cliente los recalcula nada más cargar.
      nextWipeMs: null,
      lastWipeMs: raw.lastWipeMs,
      lastWipeIsDerived: false,
      confidence: 'desconocido',
      cadence: null,
      wipeExplanation: '',
    });
  }

  return out;
}

async function main() {
  const env = { ...leerEnvLocal(), ...process.env };
  const key = env.STEAM_API_KEY;

  let crudos: Crudo[];
  let source: string;
  let notice: string | null;

  if (key) {
    try {
      crudos = await desdeSteam(key);
      source = 'steam';
      notice = null;
      console.log(`✓ Steam: ${crudos.length} servidores en vivo.`);
    } catch (err) {
      crudos = desdeCatalogo();
      source = 'catalog';
      notice = `no se pudo usar la lista en vivo (${err instanceof Error ? err.message : err}); se publica el catálogo.`;
      console.warn(`⚠ ${notice}`);
    }
  } else {
    crudos = desdeCatalogo();
    source = 'catalog';
    notice =
      'esta copia se publicó sin clave de Steam: sólo comunidades conocidas, con sus horarios publicados y sin población ni ip en vivo.';
    console.log(`ℹ Sin STEAM_API_KEY: se publica el catálogo (${crudos.length} servidores).`);
  }

  const servers = normalizar(crudos, source);
  const payload = {
    generatedAtMs: Date.now(),
    // El countdown y las horas se calculan en el navegador; esto es sólo
    // informativo, para poder decir de cuándo son la población y las ips.
    source,
    notice,
    count: servers.length,
    servers,
  };

  mkdirSync(dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, JSON.stringify(payload));
  const kb = Math.round(JSON.stringify(payload).length / 1024);
  console.log(`✓ Escrito public/data/servers.json — ${servers.length} servidores, ${kb} KB.`);
}

void main();
