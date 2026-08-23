/**
 * Diagnóstico de la Steam Web API.
 *
 *   npm run check:steam
 *
 * Sirve para separar dos preguntas que si no se mezclan: "¿mi clave sirve?" y
 * "¿la app está rota?". Va contra el endpoint de verdad y cuenta qué llega.
 *
 * Se ejecuta con `node`, que en la v22.6+ entiende TypeScript sin compilar.
 * Por eso sólo importa el parser puro, nunca el adaptador de Next.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseGameType, steamServerType } from '../lib/sources/steam-tags.ts';

const RUST_APPID = 252490;
const ENDPOINT = 'https://api.steampowered.com/IGameServersService/GetServerList/v1/';
const LIMIT = 300;

const COMO_SACAR_LA_CLAVE = `
Cómo conseguirla (2 minutos, y es gratis):

  1. Entra en https://steamcommunity.com/dev/apikey con tu cuenta de Steam.
  2. En "Domain Name" pon cualquier cosa, por ejemplo  localhost
  3. Acepta y copia la clave (32 caracteres).
  4. Pégala en .env.local:

       STEAM_API_KEY=la-clave-que-te-han-dado

  5. Vuelve a lanzar este comando.

Si el botón te pide un móvil verificado o haber gastado algo en Steam, es un
requisito de Valve para dar claves; no hay forma de saltárselo.
`;

/** Lee .env.local sin dependencias. No vale para todo, basta para esto. */
function leerEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let texto: string;
  try {
    texto = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  } catch {
    return out;
  }

  for (const linea of texto.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf('=');
    if (i === -1) continue;
    const clave = limpia.slice(0, i).trim();
    let valor = limpia.slice(i + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    out[clave] = valor;
  }
  return out;
}

function salir(mensaje: string, codigo = 1): never {
  console.error(mensaje);
  process.exit(codigo);
}

async function main() {
  const env = { ...leerEnvLocal(), ...process.env };
  const key = env.STEAM_API_KEY;

  if (!key) {
    salir(
      `✗ No hay STEAM_API_KEY.\n\nLa app funciona igual sin ella, en modo catálogo (145 servidores\nconocidos). Con clave pasa a la lista en vivo, con población e ip reales.\n${COMO_SACAR_LA_CLAVE}`,
    );
  }

  if (key.length < 20) {
    salir(
      `✗ STEAM_API_KEY tiene ${key.length} caracteres; las de Steam tienen 32.\n  Parece que se ha pegado a medias.\n${COMO_SACAR_LA_CLAVE}`,
    );
  }

  const filter = ['\\appid\\', String(RUST_APPID), '\\dedicated\\1', '\\empty\\1'].join('');
  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&limit=${LIMIT}&filter=${encodeURIComponent(filter)}`;

  console.log(`→ Pidiendo hasta ${LIMIT} servidores de Rust a la Steam Web API…`);

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    salir(`✗ No se ha podido conectar: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (res.status === 403) {
    salir(
      `✗ Steam responde 403 (clave rechazada).\n\n  La clave existe pero no vale para este endpoint, o está mal copiada.\n  Revisa que no tenga espacios ni comillas en .env.local.\n${COMO_SACAR_LA_CLAVE}`,
    );
  }
  if (!res.ok) {
    salir(`✗ Steam responde ${res.status} ${res.statusText}.\n  Suele ser temporal: prueba otra vez en un minuto.`);
  }

  const json = (await res.json()) as {
    response?: { servers?: Array<Record<string, unknown>> };
  };
  const servers = json.response?.servers ?? [];

  if (servers.length === 0) {
    salir(
      '✗ La clave funciona, pero la lista ha vuelto vacía.\n  Puede ser un bache de Steam. Prueba otra vez en un minuto.',
    );
  }

  // --- Qué ha llegado de verdad -------------------------------------------
  const conBorn = servers.filter((s) => parseGameType(s.gametype as string).bornMs !== null);
  const conIp = servers.filter((s) => typeof s.addr === 'string' && s.addr.includes(':'));
  const tipos: Record<string, number> = {};
  for (const s of servers) {
    const t = steamServerType(parseGameType(s.gametype as string), (s.name as string) ?? '');
    tipos[t] = (tipos[t] ?? 0) + 1;
  }

  const pct = (n: number) => `${Math.round((n / servers.length) * 100)}%`;

  console.log(`\n✓ La clave funciona.\n`);
  console.log(`  servidores devueltos    ${servers.length}`);
  console.log(`  con último wipe (born)  ${conBorn.length}  (${pct(conBorn.length)})`);
  console.log(`  con ip de conexión      ${conIp.length}  (${pct(conIp.length)})`);
  console.log(
    `  por tipo                ${Object.entries(tipos)
      .map(([t, n]) => `${t} ${n}`)
      .join(' · ')}`,
  );

  const muestra = [...servers]
    .sort((a, b) => Number(b.players ?? 0) - Number(a.players ?? 0))
    .slice(0, 5);

  console.log('\n  Los 5 con más jugadores:\n');
  for (const s of muestra) {
    const tags = parseGameType(s.gametype as string);
    const wipe = tags.bornMs
      ? `wipeó hace ${Math.round((Date.now() - tags.bornMs) / 3_600_000)}h`
      : 'sin fecha de wipe';
    console.log(`    ${String(s.players ?? 0).padStart(4)}/${String(s.max_players ?? 0).padEnd(4)} ${String(s.name ?? '').slice(0, 52).padEnd(54)} ${wipe}`);
  }

  if (conBorn.length < servers.length * 0.5) {
    console.log(
      '\n  ⚠ Menos de la mitad traen la etiqueta `born`. Esos se resolverán con\n    el calendario de su comunidad o con la heurística del nombre.',
    );
  }

  console.log('\n  Ya puedes lanzar `npm run dev`: la app usará esta fuente.\n');
}

void main();
