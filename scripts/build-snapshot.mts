/**
 * Congela una foto real de la lista de Steam como catálogo de reserva.
 *
 *   npm run build:snapshot        (necesita STEAM_API_KEY)
 *
 * Por qué existe: el catálogo de reserva estaba escrito a mano, y escribir a
 * mano una lista de servidores acaba en nombres inventados. Pasó: al ampliar
 * los servidores de dúo se colaron 37 que no existen, y las poblaciones y
 * tamaños de mapa de los 145 eran números puestos a ojo.
 *
 * Un servidor inventado es peor que no tener servidor: la web dice algo falso
 * con la misma cara con la que dice la verdad.
 *
 * Así que el catálogo pasa a ser esto: una foto de servidores que existen de
 * verdad, con su población real del día en que se tomó. Lo que sí sigue
 * escrito a mano son los **calendarios de las comunidades** en `catalog.ts`,
 * que están contrastados contra sus webs y llevan su `verified`.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { esServidorDeWipe } from '../lib/server-kind.ts';
import { parseGameType, steamRegionLabel, steamServerType } from '../lib/sources/steam-tags.ts';

const RUST_APPID = 252490;
const ENDPOINT = 'https://api.steampowered.com/IGameServersService/GetServerList/v1/';
const CUANTOS = 200;
const SALIDA = join(process.cwd(), 'lib', 'catalog-snapshot.json');

const key = process.env.STEAM_API_KEY;
if (!key) {
  console.error(
    '✗ Hace falta STEAM_API_KEY para tomar la foto.\n' +
      '  El catálogo de reserva sale de servidores reales; sin clave no hay de dónde sacarlos.',
  );
  process.exit(1);
}

const filter = ['\\appid\\', String(RUST_APPID), '\\dedicated\\1', '\\empty\\1'].join('');
const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&limit=5000&filter=${encodeURIComponent(filter)}`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`✗ Steam respondió ${res.status}.`);
  process.exit(1);
}

const json = (await res.json()) as { response?: { servers?: Array<Record<string, unknown>> } };
const servers = (json.response?.servers ?? []).filter((s) =>
  esServidorDeWipe((s.name as string) ?? ''),
);

const foto = servers
  .map((s) => {
    const tags = parseGameType(s.gametype as string);
    const name = (s.name as string) ?? '';
    const players = (s.players as number) ?? tags.currentPlayers ?? 0;
    const maxPlayers = (s.max_players as number) ?? tags.maxPlayers ?? 0;
    const cola = tags.queued && tags.queued > 0 ? tags.queued : Math.max(0, players - maxPlayers);
    return {
      name,
      type: steamServerType(tags, name),
      // Población del día de la foto. No es en vivo, y la web lo dice.
      players: Math.max(0, Math.min(players - cola, maxPlayers)),
      maxPlayers,
      region: steamRegionLabel(s.region as number),
    };
  })
  .filter((s) => s.name && s.maxPlayers > 0)
  .sort((a, b) => b.players - a.players)
  .slice(0, CUANTOS);

writeFileSync(
  SALIDA,
  JSON.stringify(
    {
      _comment:
        'Foto real de la lista de Steam, no una lista escrita a mano. Se regenera con `npm run build:snapshot`. La población es del día de la foto; la web lo advierte.',
      takenAt: new Date().toISOString().slice(0, 10),
      servers: foto,
    },
    null,
    1,
  ),
);

console.log(`✓ Foto tomada: ${foto.length} servidores reales en lib/catalog-snapshot.json`);
console.log(`  Los 3 con más gente: ${foto.slice(0, 3).map((s) => s.name.slice(0, 34)).join(' · ')}`);
