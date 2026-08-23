/**
 * Catálogo de comunidades conocidas de Rust.
 *
 * Sirve para dos cosas:
 *
 *  1. Capa de precisión sobre los datos en vivo. Adivinar el ciclo de wipe
 *     leyendo el nombre del servidor funciona regular. Las comunidades
 *     grandes publican su calendario, así que para ellas se usa el
 *     calendario y no la heurística.
 *  2. Modo sin credenciales. Si no hay token de BattleMetrics ni clave de
 *     Steam, la app sigue respondiendo a la pregunta con estos servidores.
 *
 * Los horarios salen de las webs oficiales de cada comunidad (ver `sourceUrl`
 * y `verified`). Cuando una comunidad cambia su calendario esto se queda
 * viejo: por eso la UI nunca lo enseña como `confirmado`, sino como
 * `programado`, con el tooltip diciendo de dónde sale.
 */

import type { Cadence, ScheduleRule, ServerType } from './types';

const MON = 1;
const THU = 4;
const FRI = 5;

interface CommunityDef {
  slug: string;
  /** Nombre visible de la comunidad. */
  name: string;
  /** Con qué nombres de servidor casa. */
  match: RegExp;
  url: string;
  sourceUrl: string;
  /** Fecha en que se verificó el calendario contra la web oficial. */
  verified: string;
  /** Hora local del wipe (en la zona de la región del servidor). */
  hourLocal: number;
  minuteLocal?: number;
  /**
   * Zona horaria fija, ignorando la región. La usan las comunidades que
   * wipean a la misma hora absoluta en todo el mundo: los oficiales de
   * Facepunch van a las 19:00 UTC, no a las 19:00 de cada continente.
   */
  fixedTimeZone?: string;
  /** Ciclo y día por defecto de la comunidad. */
  cadence: Cadence;
  weekday: number;
  /**
   * Ajustes por palabras del nombre del servidor, en orden. El primero gana.
   * Ojo con el orden: `\bweekly\b` también casa dentro de "Bi-weekly" (el
   * guion cuenta como límite de palabra), así que lo quincenal va siempre
   * antes que lo semanal.
   */
  overrides?: Array<{
    match: RegExp;
    cadence?: Cadence;
    weekday?: number;
    hourLocal?: number;
  }>;
  human: string;
}

/** Zona horaria deducida de la región que casi siempre va en el nombre. */
export function regionTimeZone(name: string): string {
  const n = name.toLowerCase();
  if (/\b(eu|europe|euro|de|uk|gb|fr|nl|ger)\b/.test(n)) return 'Europe/London';
  if (/\b(au|aus|oce|oceania|sydney)\b/.test(n)) return 'Australia/Sydney';
  if (/\b(sea|asia|sg|singapore|hk|jp)\b/.test(n)) return 'Asia/Singapore';
  if (/\b(sa|south\s*america|br|brazil)\b/.test(n)) return 'America/Sao_Paulo';
  return 'America/New_York';
}

/** Región legible para el filtro, deducida del nombre y del país. */
export function regionLabel(name: string, country?: string | null): string {
  const n = name.toLowerCase();
  if (/\b(eu|europe|euro|uk|gb|de|fr|nl|ger)\b/.test(n)) return 'Europa';
  if (/\b(au|aus|oce|oceania)\b/.test(n)) return 'Oceanía';
  if (/\b(sea|asia|sg|hk|jp)\b/.test(n)) return 'Asia';
  if (/\b(sa|south\s*america|br|brazil)\b/.test(n)) return 'Sudamérica';
  if (/\b(us|usa|na|west|east|ny|la|chicago|dallas|seattle|miami)\b/.test(n)) return 'Norteamérica';

  const EU = 'GB IE FR DE NL BE ES PT IT PL SE NO FI DK CZ AT CH HU RO BG GR TR UA RU LT LV EE SK SI HR RS'.split(' ');
  const NA = ['US', 'CA', 'MX'];
  const OCE = ['AU', 'NZ'];
  const SA = ['BR', 'AR', 'CL', 'CO', 'PE', 'UY'];
  const ASIA = ['SG', 'JP', 'HK', 'KR', 'CN', 'TH', 'MY', 'ID', 'IN', 'PH', 'TW'];

  const c = (country ?? '').toUpperCase();
  if (EU.includes(c)) return 'Europa';
  if (NA.includes(c)) return 'Norteamérica';
  if (OCE.includes(c)) return 'Oceanía';
  if (SA.includes(c)) return 'Sudamérica';
  if (ASIA.includes(c)) return 'Asia';
  return 'Otras';
}

/**
 * Comunidades ordenadas de más a menos específicas: la primera que case gana,
 * así que las marcas con nombre más largo van antes que las genéricas.
 */
export const COMMUNITIES: CommunityDef[] = [
  {
    slug: 'rustafied',
    name: 'Rustafied',
    match: /rustafied/i,
    url: 'https://www.rustafied.com',
    sourceUrl: 'https://www.rustafied.com/server',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday\b/i, cadence: 'weekly', weekday: MON },
      { match: /\bfriday\b/i, cadence: 'weekly', weekday: FRI },
      { match: /\b(long|low\s*pop)\b/i, cadence: 'monthly' },
      { match: /\b(medium|trio)\b/i, cadence: 'biweekly' },
    ],
    human: 'wipes a las 15:00 hora local del servidor; jueves salvo que el nombre diga otro día',
  },
  {
    slug: 'rusticated',
    name: 'Rusticated',
    match: /rusticated/i,
    url: 'https://rusticated.com',
    sourceUrl: 'https://rusticated.com/servers',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday\b/i, cadence: 'weekly', weekday: MON, hourLocal: 12 },
      { match: /\bfriday\b/i, cadence: 'weekly', weekday: FRI },
      { match: /\b(monthly|long)\b/i, cadence: 'monthly' },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
    ],
    human: 'map wipe semanal (jueves 15:00, lunes 12:00 hora local); blueprints en el forced wipe',
  },
  {
    slug: 'rusty-moose',
    name: 'Rusty Moose',
    match: /rusty\s*moose/i,
    url: 'https://www.rustymoose.io',
    sourceUrl: 'https://www.rustymoose.io',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\bmonthly\b/i, cadence: 'monthly' },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
      { match: /\bfriday?s?\b/i, cadence: 'weekly', weekday: FRI },
    ],
    human: 'wipes a las 15:00 hora local; el ciclo va en el nombre del servidor',
  },
  {
    slug: 'rustoria',
    name: 'Rustoria',
    match: /rustoria/i,
    url: 'https://rustoria.co',
    sourceUrl: 'https://rustoria.co',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\b(long|monthly)\b/i, cadence: 'monthly' },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
    ],
    human: 'map wipe los jueves 15:00 UK (o cuando cae un force update); blueprints mensuales',
  },
  {
    slug: 'bloo-lagoon',
    name: 'Bloo Lagoon',
    match: /bloo\s*lagoon/i,
    url: 'https://bloolagoon.com',
    sourceUrl: 'https://bloolagoon.com',
    verified: '2026-08-23',
    hourLocal: 16,
    cadence: 'biweekly',
    weekday: THU,
    overrides: [
      { match: /\bbi-?\s?weekly\b/i, cadence: 'biweekly' },
      { match: /\bmonthly\b/i, cadence: 'monthly' },
      { match: /\bweekly\b/i, cadence: 'weekly' },
    ],
    human: 'wipe en el forced wipe y cada 2 semanas después, jueves a las 16:00 ET',
  },
  {
    slug: 'rustopia',
    name: 'Rustopia',
    match: /rustopia/i,
    url: 'https://rustopia.gg',
    sourceUrl: 'https://rustopia.gg',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\b(long|monthly)\b/i, cadence: 'monthly' },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
    ],
    human: 'wipe semanal los jueves a las 15:00 hora local del servidor',
  },
  {
    slug: 'picklerust',
    name: 'PickleRust',
    match: /pickle\s*rust|picklerust/i,
    url: 'https://picklerust.com',
    sourceUrl: 'https://picklerust.com',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\b(long|monthly)\b/i, cadence: 'monthly' },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
    ],
    human: 'wipe semanal, jueves a las 15:00 hora local (lunes en los servidores Monday)',
  },
  {
    slug: 'rustez',
    name: 'RustEZ',
    match: /rust\s*ez|rustez/i,
    url: 'https://rustez.com',
    sourceUrl: 'https://rustez.com',
    verified: '2026-08-23',
    hourLocal: 19,
    fixedTimeZone: 'UTC',
    cadence: 'monthly',
    weekday: THU,
    human: 'PvE: sólo wipea en el forced wipe mensual',
  },
  {
    slug: 'rustinity',
    name: 'Rustinity',
    match: /rustinity/i,
    url: 'https://rustinity.com',
    sourceUrl: 'https://rustinity.com',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
      { match: /\bmonthly\b/i, cadence: 'monthly' },
    ],
    human: 'wipe semanal los jueves a las 15:00 hora local',
  },
  {
    slug: 'rustfactor',
    name: 'Rust Factor',
    match: /rust\s*factor|rustfactor/i,
    url: 'https://rustfactor.com',
    sourceUrl: 'https://rustfactor.com',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\b(long|monthly)\b/i, cadence: 'monthly' },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
    ],
    human: 'wipe semanal los jueves a las 15:00 hora local',
  },
  {
    slug: 'vital-rust',
    name: 'Vital Rust',
    match: /vital\s*rust|vitalrust/i,
    url: 'https://vitalrust.com',
    sourceUrl: 'https://vitalrust.com',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
      { match: /\bmonthly\b/i, cadence: 'monthly' },
    ],
    human: 'wipe semanal los jueves a las 15:00 hora local',
  },
  {
    slug: 'atlas-rust',
    name: 'Atlas Rust',
    match: /atlas\s*rust|atlasrust/i,
    url: 'https://atlasrust.com',
    sourceUrl: 'https://atlasrust.com',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
      { match: /\bmonthly\b/i, cadence: 'monthly' },
    ],
    human: 'wipe semanal los jueves a las 15:00 hora local',
  },
  {
    slug: 'reddit-rust',
    name: 'Reddit Rust',
    match: /\breddit\b.*\brust\b|\brust\b.*\breddit\b|\/r\/(playrust|rust)\b/i,
    url: 'https://www.reddit.com/r/playrust/',
    sourceUrl: 'https://www.reddit.com/r/playrust/',
    verified: '2026-08-23',
    hourLocal: 19,
    cadence: 'monthly',
    weekday: THU,
    overrides: [
      { match: /\bbi-?\s?weekly\b/i, cadence: 'biweekly' },
      { match: /\bweekly\b/i, cadence: 'weekly' },
    ],
    human: 'wipe mensual en el forced wipe salvo que el nombre diga lo contrario',
  },
  {
    slug: 'facepunch-official',
    name: 'Facepunch (oficial)',
    match: /\bfacepunch\b|rust\s*(official|oficial)|^\[?(eu|us|au|sea)\]?\s*(rust\s*)?(official|main)\b/i,
    url: 'https://rust.facepunch.com',
    sourceUrl: 'https://rust.facepunch.com',
    verified: '2026-08-23',
    hourLocal: 19,
    fixedTimeZone: 'UTC', // Facepunch wipea a la misma hora absoluta en todo el mundo.
    cadence: 'monthly',
    weekday: THU,
    overrides: [
      { match: /\b(bi-?\s?weekly|medium)\b/i, cadence: 'biweekly' },
      { match: /\b(weekly|small)\b/i, cadence: 'weekly' },
    ],
    human: 'servidor oficial: wipea con el forced wipe mensual de Facepunch, 19:00 UTC',
  },
];

export interface CommunityMatch {
  community: CommunityDef;
  rule: ScheduleRule;
}

/** Busca la comunidad de un servidor por su nombre y construye su regla. */
export function matchCommunity(serverName: string): CommunityMatch | null {
  const community = COMMUNITIES.find((c) => c.match.test(serverName));
  if (!community) return null;

  let cadence = community.cadence;
  let weekday = community.weekday;
  let hourLocal = community.hourLocal;

  for (const ov of community.overrides ?? []) {
    if (ov.match.test(serverName)) {
      cadence = ov.cadence ?? cadence;
      weekday = ov.weekday ?? weekday;
      hourLocal = ov.hourLocal ?? hourLocal;
      break;
    }
  }

  return {
    community,
    rule: {
      community: community.name,
      cadence,
      weekday,
      hourLocal,
      minuteLocal: community.minuteLocal ?? 0,
      timeZone: community.fixedTimeZone ?? regionTimeZone(serverName),
      human: community.human,
    },
  };
}

// ---------------------------------------------------------------------------
// Semilla para el modo sin credenciales
// ---------------------------------------------------------------------------

export interface CatalogServer {
  id: string;
  name: string;
  type: ServerType;
  country: string;
  /** Población típica en hora punta. Es una referencia, no un dato en vivo. */
  typicalPlayers: number;
  maxPlayers: number;
  mapSize: number | null;
}

/**
 * Servidores famosos de Rust, para que la app responda algo útil sin token.
 *
 * No se inventan IPs: en este modo no hay `client.connect` porque las
 * direcciones cambian entre wipes. Con `STEAM_API_KEY` o `BATTLEMETRICS_TOKEN`
 * la lista pasa a ser en vivo y sí trae IP, población y último wipe reales.
 */
export const CATALOG_SERVERS: CatalogServer[] = [
  // Rustafied
  { id: 'cat-rustafied-eu-main', name: 'Rustafied.com - EU Main', type: 'community', country: 'DE', typicalPlayers: 350, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rustafied-us-main', name: 'Rustafied.com - US Main', type: 'community', country: 'US', typicalPlayers: 300, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-rustafied-eu-medium', name: 'Rustafied.com - EU Medium - Large', type: 'community', country: 'DE', typicalPlayers: 250, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-rustafied-us-medium', name: 'Rustafied.com - US Medium - Large', type: 'community', country: 'US', typicalPlayers: 220, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-rustafied-eu-long', name: 'Rustafied.com - EU Long - Large', type: 'community', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 4500 },
  { id: 'cat-rustafied-us-long', name: 'Rustafied.com - US Long - Large', type: 'community', country: 'US', typicalPlayers: 180, maxPlayers: 300, mapSize: 4500 },
  { id: 'cat-rustafied-eu-trio', name: 'Rustafied.com - EU Trio', type: 'community', country: 'DE', typicalPlayers: 200, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rustafied-us-trio', name: 'Rustafied.com - US Trio', type: 'community', country: 'US', typicalPlayers: 180, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rustafied-eu-monday', name: 'Rustafied.com - EU Monday', type: 'community', country: 'DE', typicalPlayers: 250, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-rustafied-us-monday', name: 'Rustafied.com - US Monday', type: 'community', country: 'US', typicalPlayers: 230, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-rustafied-eu-friday', name: 'Rustafied.com - EU Friday', type: 'community', country: 'DE', typicalPlayers: 240, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-rustafied-us-friday', name: 'Rustafied.com - US Friday', type: 'community', country: 'US', typicalPlayers: 220, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-rustafied-au-main', name: 'Rustafied.com - AU Main', type: 'community', country: 'AU', typicalPlayers: 150, maxPlayers: 250, mapSize: 4000 },
  { id: 'cat-rustafied-sea-main', name: 'Rustafied.com - SEA Main', type: 'community', country: 'SG', typicalPlayers: 120, maxPlayers: 250, mapSize: 4000 },

  // Rusticated
  { id: 'cat-rusticated-eu-thu', name: 'Rusticated.com - EU | 2x Vanilla | Thursday | Shared BPs', type: 'modded', country: 'DE', typicalPlayers: 300, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rusticated-eu-mon', name: 'Rusticated.com - EU | 2x Vanilla | Monday | Shared BPs', type: 'modded', country: 'DE', typicalPlayers: 280, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rusticated-us-thu', name: 'Rusticated.com - US | 2x Vanilla | Thursday | Shared BPs', type: 'modded', country: 'US', typicalPlayers: 280, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rusticated-us-mon', name: 'Rusticated.com - US | 2x Vanilla | Monday | Shared BPs', type: 'modded', country: 'US', typicalPlayers: 260, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rusticated-us-trio-thu', name: 'Rusticated.com - US Premium Trio | Thursday Wipes', type: 'modded', country: 'US', typicalPlayers: 200, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rusticated-us-trio-mon', name: 'Rusticated.com - US Trio | Monday Wipes', type: 'modded', country: 'US', typicalPlayers: 180, maxPlayers: 250, mapSize: 3500 },

  // Rusty Moose
  { id: 'cat-moose-eu-main', name: 'Rusty Moose |EU Main|', type: 'modded', country: 'DE', typicalPlayers: 300, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-moose-us-main', name: 'Rusty Moose |US Main|', type: 'modded', country: 'US', typicalPlayers: 300, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-moose-us-monday', name: 'Rusty Moose |US Mondays|', type: 'modded', country: 'US', typicalPlayers: 280, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-moose-eu-monday', name: 'Rusty Moose |EU Mondays|', type: 'modded', country: 'DE', typicalPlayers: 260, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-moose-us-biweekly', name: 'Rusty Moose |US Biweekly|', type: 'modded', country: 'US', typicalPlayers: 220, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-moose-us-monthly', name: 'Rusty Moose |US Monthly|', type: 'modded', country: 'US', typicalPlayers: 200, maxPlayers: 300, mapSize: 4500 },
  { id: 'cat-moose-eu-monthly', name: 'Rusty Moose |EU Monthly|', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 4500 },

  // Rustoria
  { id: 'cat-rustoria-eu-main', name: 'Rustoria.co - EU Main', type: 'community', country: 'DE', typicalPlayers: 300, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rustoria-us-main', name: 'Rustoria.co - US Main', type: 'community', country: 'US', typicalPlayers: 280, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rustoria-eu-long', name: 'Rustoria.co - EU Long', type: 'community', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 4500 },
  { id: 'cat-rustoria-us-long', name: 'Rustoria.co - US Long', type: 'community', country: 'US', typicalPlayers: 190, maxPlayers: 300, mapSize: 4500 },
  { id: 'cat-rustoria-oce-main', name: 'Rustoria.co - OCE Main', type: 'community', country: 'AU', typicalPlayers: 140, maxPlayers: 250, mapSize: 4000 },

  // Bloo Lagoon
  { id: 'cat-bloo-us-main', name: '[US] Bloo Lagoon Main | Bi-weekly', type: 'modded', country: 'US', typicalPlayers: 250, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-bloo-us-medium', name: '[US] Bloo Lagoon Medium 1.5x | 4 Max | Bi-weekly', type: 'modded', country: 'US', typicalPlayers: 200, maxPlayers: 250, mapSize: 3800 },
  { id: 'cat-bloo-eu-main', name: '[EU] Bloo Lagoon Main | Bi-weekly', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 4250 },

  // Rustopia
  { id: 'cat-rustopia-us-large', name: 'Rustopia US Large', type: 'modded', country: 'US', typicalPlayers: 300, maxPlayers: 350, mapSize: 4500 },
  { id: 'cat-rustopia-eu-large', name: 'Rustopia EU Large', type: 'modded', country: 'DE', typicalPlayers: 280, maxPlayers: 350, mapSize: 4500 },
  { id: 'cat-rustopia-us-monday', name: 'Rustopia US Monday', type: 'modded', country: 'US', typicalPlayers: 220, maxPlayers: 300, mapSize: 4250 },

  // Otras comunidades grandes
  { id: 'cat-picklerust-eu', name: 'PickleRust EU Main', type: 'modded', country: 'DE', typicalPlayers: 220, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-picklerust-us', name: 'PickleRust US Main', type: 'modded', country: 'US', typicalPlayers: 200, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-rustinity-eu', name: 'Rustinity 2x Main EU', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-rustinity-us', name: 'Rustinity 2x Main US', type: 'modded', country: 'US', typicalPlayers: 190, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-rustfactor-eu', name: 'Rust Factor EU Main', type: 'modded', country: 'NL', typicalPlayers: 180, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-vitalrust-eu', name: 'Vital Rust EU Main', type: 'modded', country: 'DE', typicalPlayers: 160, maxPlayers: 250, mapSize: 4000 },
  { id: 'cat-atlasrust-eu', name: 'Atlas Rust EU Main', type: 'modded', country: 'DE', typicalPlayers: 150, maxPlayers: 250, mapSize: 4000 },
  { id: 'cat-rustez-us', name: 'RustEZ US Medium PvE', type: 'modded', country: 'US', typicalPlayers: 120, maxPlayers: 200, mapSize: 4000 },
  { id: 'cat-rustez-eu', name: 'RustEZ EU Medium PvE', type: 'modded', country: 'DE', typicalPlayers: 110, maxPlayers: 200, mapSize: 4000 },

  // Oficiales de Facepunch
  { id: 'cat-official-eu-main', name: '[EU] Facepunch Rust Official Main', type: 'official', country: 'DE', typicalPlayers: 250, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-official-us-main', name: '[US] Facepunch Rust Official Main', type: 'official', country: 'US', typicalPlayers: 250, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-official-eu-medium', name: '[EU] Facepunch Rust Official Medium', type: 'official', country: 'DE', typicalPlayers: 180, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-official-us-small', name: '[US] Facepunch Rust Official Small', type: 'official', country: 'US', typicalPlayers: 150, maxPlayers: 200, mapSize: 3000 },
  { id: 'cat-official-au-main', name: '[AU] Facepunch Rust Official Main', type: 'official', country: 'AU', typicalPlayers: 120, maxPlayers: 250, mapSize: 4250 },
];
