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

const SUN = 0;
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;

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
  /** Varios días de wipe por semana. Si está, manda sobre `weekday`. */
  weekdays?: number[];
  /**
   * El ciclo se conoce pero la hora exacta no se ha podido verificar contra
   * una fuente oficial. La UI lo baja a `estimado` en vez de `programado`.
   */
  approximate?: boolean;
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
    weekdays?: number[];
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
    // Los días están verificados; la hora exacta no.
    approximate: true,
    name: 'Rustopia',
    match: /rustopia/i,
    url: 'https://rustopia.gg',
    sourceUrl: 'https://www.rustalyzer.com/org/rustopia',
    verified: '2026-08-23',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: THU,
    overrides: [
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      // Medium, Large y Small van a forced wipe; Main y Hardcore, semanales.
      { match: /\b(medium|large|small|long|monthly)\b/i, cadence: 'monthly' },
      { match: /\bbi-?weekly\b/i, cadence: 'biweekly' },
    ],
    human:
      'Main y Hardcore wipean los jueves; Mondays los lunes; Medium, Large y Small van al forced wipe mensual',
  },
  {
    slug: 'picklerust',
    approximate: true, // ciclo conocido, hora sin verificar contra su web
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
    approximate: true, // ciclo conocido, hora sin verificar contra su web
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
    approximate: true, // ciclo conocido, hora sin verificar contra su web
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
    approximate: true, // ciclo conocido, hora sin verificar contra su web
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
    slug: 'atlas',
    // Se conoce el día de cada tipo de servidor, pero no la hora del wipe.
    approximate: true,
    name: 'Atlas',
    match: /\batlas\b/i,
    url: 'https://atlas-rust.com',
    sourceUrl: 'https://www.rustalyzer.com/org/atlas',
    verified: '2026-08-23',
    hourLocal: 15,
    // La mayoría de sus servidores son mensuales; lo demás va por overrides.
    cadence: 'monthly',
    weekday: THU,
    overrides: [
      { match: /\bmonthly\b/i, cadence: 'monthly' },
      { match: /\b10x\b/i, cadence: 'weekly', weekdays: [MON, FRI] },
      { match: /\b5x\b/i, cadence: 'weekly', weekdays: [WED, SAT] },
      { match: /\bmonday?s?\b/i, cadence: 'weekly', weekday: MON },
      { match: /\bmedium\b/i, cadence: 'biweekly' },
      { match: /\blong\b/i, cadence: 'monthly' },
    ],
    human:
      'el ciclo va por tipo de servidor: 10x lunes y viernes, 5x miércoles y sábado, 3x lunes, medium quincenal, el resto mensual',
  },
  {
    slug: 'hollowservers',
    name: 'HollowServers.co',
    match: /hollow\s*servers|hollowservers/i,
    url: 'https://hollowservers.co',
    sourceUrl: 'https://www.rustalyzer.com/org/hollowservers',
    verified: '2026-08-23',
    // Se conoce el patrón (lunes y viernes), no la hora.
    approximate: true,
    hourLocal: 15,
    cadence: 'weekly',
    weekday: MON,
    weekdays: [MON, FRI],
    overrides: [
      { match: /\bmonthly\b/i, cadence: 'monthly' },
      { match: /\bbi-?\s?weekly\b/i, cadence: 'biweekly' },
    ],
    human: 'dos wipes por semana, lunes y viernes; los "Monthly" van al forced wipe',
  },
  {
    slug: 'magic-rust',
    name: 'Magic Rust',
    match: /magic\s*rust|magicrust/i,
    url: 'https://magicrust.gg',
    sourceUrl: 'https://rustywipe.com/organization/magic-rust',
    verified: '2026-08-23',
    // Comunidad rusa: los wipes van en hora de Moscú, pero la hora exacta no
    // está confirmada, sólo el ciclo de unos 4 días.
    approximate: true,
    fixedTimeZone: 'Europe/Moscow',
    hourLocal: 15,
    cadence: 'weekly',
    weekday: MON,
    weekdays: [MON, FRI],
    overrides: [
      { match: /\bmonthly\b|\blong\b|кл[aа]ccик|классик/i, cadence: 'monthly' },
      { match: /\bbi-?\s?weekly\b/i, cadence: 'biweekly' },
    ],
    human: 'ciclo corto de unos 4 días (dos wipes por semana); los Long y Monthly van al forced wipe',
  },
  {
    slug: 'warbandits',
    name: 'WarBandits',
    match: /war\s*bandits|warbandits/i,
    url: 'https://warbandits.gg',
    sourceUrl: 'https://warbandits.gg/servers',
    verified: '2026-08-23',
    // Su web lista fechas de wipe pero no la hora ni el día fijo: se sabe
    // que el ciclo es de ~3,5 días (dos wipes por semana), no la hora.
    approximate: true,
    hourLocal: 14,
    cadence: 'weekly',
    weekday: MON,
    weekdays: [MON, FRI],
    overrides: [
      { match: /\bmonthly\b/i, cadence: 'monthly' },
      { match: /\bbi-?\s?weekly\b/i, cadence: 'biweekly' },
    ],
    human: 'dos wipes por semana, ciclo de unos 3-4 días (lunes y viernes)',
  },
  {
    slug: 'werewolf',
    name: 'Werewolf Gaming',
    match: /werewolf/i,
    url: 'https://werewolfgaming.co',
    sourceUrl: 'https://www.battlemetrics.com/servers/rust/15988648',
    verified: '2026-08-23',
    approximate: true,
    hourLocal: 14,
    cadence: 'weekly',
    weekday: MON,
    overrides: [
      { match: /\bmonthly\b/i, cadence: 'monthly' },
      { match: /\bbi-?\s?weekly\b/i, cadence: 'biweekly' },
      { match: /\bthursday?s?\b/i, cadence: 'weekly', weekday: THU },
      { match: /\bfriday?s?\b/i, cadence: 'weekly', weekday: FRI },
    ],
    human: 'wipe semanal los lunes; hora aproximada, sobre las 13:00 UTC',
  },
  {
    slug: 'survivors-gg',
    name: 'Survivors.gg',
    match: /survivors\.?\s*gg|survivors\.gg/i,
    url: 'https://survivors.gg',
    sourceUrl: 'https://www.battlemetrics.com/servers/rust/11900765',
    verified: '2026-08-23',
    // Todos sus servidores están en Europa y wipean en hora centroeuropea.
    fixedTimeZone: 'Europe/Berlin',
    hourLocal: 14,
    cadence: 'weekly',
    // Main y el genérico wipean los viernes.
    weekday: FRI,
    overrides: [
      // Cada servidor numerado tiene su propio par de días; van antes que lo
      // genérico para que no los pise la regla por defecto.
      { match: /#\s*1\b/, cadence: 'weekly', weekdays: [MON, THU], hourLocal: 14 },
      { match: /#\s*2\b/, cadence: 'weekly', weekdays: [TUE, SAT], hourLocal: 14 },
      { match: /#\s*3\b/, cadence: 'weekly', weekdays: [SUN, WED], hourLocal: 14 },
      { match: /#\s*4\b/, cadence: 'weekly', weekdays: [SUN, THU], hourLocal: 14 },
      { match: /#\s*5\b/, cadence: 'weekly', weekday: FRI, hourLocal: 14 },
      { match: /#\s*6\b/, cadence: 'weekly', weekdays: [TUE, SAT], hourLocal: 15 },
      { match: /#\s*7\b/, cadence: 'weekly', weekdays: [SUN, WED], hourLocal: 14 },
      { match: /\bmonthly\b/i, cadence: 'monthly' },
      { match: /\bmondays?\b/i, cadence: 'weekly', weekday: MON },
      // El de "Solo/Duo" sin número wipea martes y sábado.
      { match: /^survivors\.gg\s*\[\s*2x\s*solo\/duo\s*\]/i, cadence: 'weekly', weekdays: [TUE, SAT] },
    ],
    human:
      'fullwipe y map wipe dos veces por semana en hora centroeuropea; cada servidor tiene su par de días',
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
  let weekdays = community.weekdays;
  let hourLocal = community.hourLocal;

  for (const ov of community.overrides ?? []) {
    if (ov.match.test(serverName)) {
      cadence = ov.cadence ?? cadence;
      hourLocal = ov.hourLocal ?? hourLocal;
      // Un override que fija un día concreto anula la lista de varios días.
      if (ov.weekdays) {
        weekdays = ov.weekdays;
      } else if (ov.weekday !== undefined) {
        weekday = ov.weekday;
        weekdays = undefined;
      }
      break;
    }
  }

  return {
    community,
    rule: {
      community: community.name,
      cadence,
      weekday,
      weekdays,
      hourLocal,
      minuteLocal: community.minuteLocal ?? 0,
      timeZone: community.fixedTimeZone ?? regionTimeZone(serverName),
      approximate: community.approximate,
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
 * El tamaño de grupo no se declara aquí: se deduce del nombre igual que en
 * los datos en vivo, así la misma lógica cubre las dos fuentes y no hay dos
 * verdades que mantener sincronizadas.
 */

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

  // Rustopia — nombres y ciclo tal como los lista su organización
  { id: 'cat-rustopia-eu-main', name: 'Rustopia.gg - EU Main', type: 'modded', country: 'DE', typicalPlayers: 326, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rustopia-eu-medium', name: 'Rustopia.gg - EU Medium', type: 'modded', country: 'DE', typicalPlayers: 649, maxPlayers: 700, mapSize: 3800 },
  { id: 'cat-rustopia-eu-large', name: 'Rustopia.gg - EU Large', type: 'modded', country: 'DE', typicalPlayers: 300, maxPlayers: 400, mapSize: 4500 },
  { id: 'cat-rustopia-eu-small', name: 'Rustopia.gg - EU Small', type: 'modded', country: 'DE', typicalPlayers: 180, maxPlayers: 250, mapSize: 3000 },
  { id: 'cat-rustopia-eu-mondays', name: 'Rustopia.gg - EU Mondays | Premium', type: 'modded', country: 'DE', typicalPlayers: 280, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rustopia-us-main', name: 'Rustopia.gg - US Main | Premium', type: 'modded', country: 'US', typicalPlayers: 300, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-rustopia-us-medium', name: 'Rustopia.gg - US Medium', type: 'modded', country: 'US', typicalPlayers: 339, maxPlayers: 400, mapSize: 3800 },
  { id: 'cat-rustopia-us-large', name: 'Rustopia.gg - US Large', type: 'modded', country: 'US', typicalPlayers: 250, maxPlayers: 350, mapSize: 4500 },
  { id: 'cat-rustopia-us-small', name: 'Rustopia.gg - US Small', type: 'modded', country: 'US', typicalPlayers: 160, maxPlayers: 250, mapSize: 3000 },
  { id: 'cat-rustopia-us-hardcore', name: 'Rustopia.gg - US Hardcore Trio', type: 'modded', country: 'US', typicalPlayers: 200, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rustopia-au-main', name: 'Rustopia.gg - AU Main', type: 'modded', country: 'AU', typicalPlayers: 150, maxPlayers: 250, mapSize: 4250 },

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

  // WarBandits — el límite de grupo va siempre en el nombre
  { id: 'cat-warbandits-eu-3x-trio', name: 'WARBANDITS.GG EU 3X |Solo/Duo/Trio| LootX3', type: 'modded', country: 'DE', typicalPlayers: 650, maxPlayers: 650, mapSize: 4250 },
  { id: 'cat-warbandits-eu-2x-duo', name: 'WARBANDITS.GG EU 2X |Solo/Duo| X2', type: 'modded', country: 'DE', typicalPlayers: 550, maxPlayers: 600, mapSize: 4250 },
  { id: 'cat-warbandits-us-2x-trio', name: 'WARBANDITS.GG US 2X |Solo/Duo/Trio|', type: 'modded', country: 'US', typicalPlayers: 700, maxPlayers: 850, mapSize: 4500 },
  { id: 'cat-warbandits-eu-5x-quad', name: 'WARBANDITS.GG EU 5X |Solo/Duo/Trio/Quad|', type: 'modded', country: 'DE', typicalPlayers: 400, maxPlayers: 500, mapSize: 4250 },
  { id: 'cat-warbandits-eu-solo', name: 'WARBANDITS.GG EU 3X |Solo Only|', type: 'modded', country: 'DE', typicalPlayers: 300, maxPlayers: 400, mapSize: 3800 },
  { id: 'cat-warbandits-au-2x', name: 'WARBANDITS.GG AU 2X |Solo/Duo/Trio|', type: 'modded', country: 'AU', typicalPlayers: 200, maxPlayers: 300, mapSize: 4000 },

  // Werewolf Gaming — muy conocidos por sus servidores solo only
  { id: 'cat-werewolf-eu-solo', name: 'WEREWOLF GAMING.CO 3x SOLO ONLY | No Clans/Teams', type: 'modded', country: 'DE', typicalPlayers: 250, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-werewolf-eu-duo', name: 'WEREWOLF GAMING.CO 3x Solo/Duo', type: 'modded', country: 'DE', typicalPlayers: 220, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-werewolf-eu-main', name: 'WEREWOLF GAMING.CO 3x EU Main', type: 'modded', country: 'DE', typicalPlayers: 250, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-werewolf-us-solo', name: 'WEREWOLF GAMING.CO 3x US SOLO ONLY', type: 'modded', country: 'US', typicalPlayers: 180, maxPlayers: 250, mapSize: 3800 },

  // Survivors.gg — los 13, cada uno con su par de días
  { id: 'cat-survivors-1', name: 'Survivors.gg #1 [ 2x Solo/Duo/Trio/Quad ]', type: 'modded', country: 'DE', typicalPlayers: 300, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-survivors-2', name: 'Survivors.gg #2 [ 2x Vanilla ]', type: 'modded', country: 'DE', typicalPlayers: 260, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-survivors-3', name: 'Survivors.gg #3 [ 2x Solo/Duo/Trio ]', type: 'modded', country: 'DE', typicalPlayers: 250, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-survivors-4', name: 'Survivors.gg #4 [ 2x Solo/Duo/Trio/Quad/Max5 ]', type: 'modded', country: 'DE', typicalPlayers: 240, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-survivors-5', name: 'Survivors.gg #5 [ 2x Solo/Duo/Trio ]', type: 'modded', country: 'DE', typicalPlayers: 250, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-survivors-6', name: 'Survivors.gg #6 [ 2x Solo/Duo/Trio/Quad ]', type: 'modded', country: 'DE', typicalPlayers: 240, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-survivors-7', name: 'Survivors.gg #7 [ 2x Vanilla ]', type: 'modded', country: 'DE', typicalPlayers: 220, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-survivors-main', name: 'Survivors.gg Main [ 2x Vanilla ]', type: 'modded', country: 'DE', typicalPlayers: 320, maxPlayers: 400, mapSize: 4250 },
  { id: 'cat-survivors-mondays', name: 'Survivors.gg - Mondays [ 2x Vanilla ]', type: 'modded', country: 'DE', typicalPlayers: 280, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-survivors-duo', name: 'Survivors.gg [ 2x Solo/Duo ]', type: 'modded', country: 'DE', typicalPlayers: 230, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-survivors-weekly-duo', name: 'Survivors.gg Weekly [ 2x Solo/Duo ]', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-survivors-monthly', name: 'Survivors.gg - Monthly | 2x Vanilla | No BP Wipes', type: 'modded', country: 'DE', typicalPlayers: 210, maxPlayers: 300, mapSize: 4500 },
  { id: 'cat-survivors-monthly-quad', name: 'Survivors.gg - Monthly | 2x Solo/Duo/Trio/Quad | No BP Wipes', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 4500 },

  // Atlas — tercera organización por jugadores; cada tipo tiene su ciclo
  { id: 'cat-atlas-eu-3x-mon', name: 'Atlas - EU 3x | No BPs | Mondays', type: 'modded', country: 'DE', typicalPlayers: 400, maxPlayers: 500, mapSize: 4250 },
  { id: 'cat-atlas-eu-10x', name: 'Atlas - EU 10x | No BPs | Kits | Shop', type: 'modded', country: 'DE', typicalPlayers: 350, maxPlayers: 450, mapSize: 4000 },
  { id: 'cat-atlas-us-10x', name: 'Atlas - US 10x | No BPs | Kits | Shop', type: 'modded', country: 'US', typicalPlayers: 300, maxPlayers: 450, mapSize: 4000 },
  { id: 'cat-atlas-eu-5x', name: 'Atlas - EU 5x | No BPs | Kits', type: 'modded', country: 'DE', typicalPlayers: 320, maxPlayers: 450, mapSize: 4000 },
  { id: 'cat-atlas-us-5x', name: 'Atlas - US 5x | No BPs | Kits', type: 'modded', country: 'US', typicalPlayers: 280, maxPlayers: 450, mapSize: 4000 },
  { id: 'cat-atlas-eu-monthly', name: 'Atlas - EU 2X Monthly | Vanilla+ | No BP Wipes', type: 'modded', country: 'DE', typicalPlayers: 300, maxPlayers: 400, mapSize: 4500 },
  { id: 'cat-atlas-eu-monthly-quad', name: 'Atlas - EU 2X Monthly Solo/Duo/Trio/Quad | Vanilla+', type: 'modded', country: 'DE', typicalPlayers: 280, maxPlayers: 400, mapSize: 4500 },
  { id: 'cat-atlas-us-monthly', name: 'Atlas - US 2X Monthly | Vanilla+ | No BP Wipes', type: 'modded', country: 'US', typicalPlayers: 260, maxPlayers: 400, mapSize: 4500 },
  { id: 'cat-atlas-us-monthly-quad', name: 'Atlas - US 2X Monthly Solo/Duo/Trio/Quad | Vanilla+', type: 'modded', country: 'US', typicalPlayers: 240, maxPlayers: 400, mapSize: 4500 },
  { id: 'cat-atlas-eu-medium', name: 'Atlas - EU 2X Medium | Vanilla+ | No BP Wipes', type: 'modded', country: 'DE', typicalPlayers: 250, maxPlayers: 350, mapSize: 3800 },
  { id: 'cat-atlas-us-medium', name: 'Atlas - US 2X Medium | Vanilla+ | No BP Wipes', type: 'modded', country: 'US', typicalPlayers: 220, maxPlayers: 350, mapSize: 3800 },
  { id: 'cat-atlas-eu-long', name: 'Atlas - EU Long | Vanilla | No BP wipes', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 4500 },

  // HollowServers.co — 31 servidores, wipes lunes y viernes
  { id: 'cat-hollow-eu-trio', name: 'HollowServers.co 2x Solo/Duo/Trio | 50% Upkeep', type: 'modded', country: 'DE', typicalPlayers: 250, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-hollow-eu-quad', name: 'HollowServers.co 2x Solo/Duo/Trio/Quad | 50% Upkeep', type: 'modded', country: 'DE', typicalPlayers: 230, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-hollow-us-trio', name: '[US] HollowServers.co 2x Solo/Duo/Trio | 50% Upkeep', type: 'modded', country: 'US', typicalPlayers: 200, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-hollow-monthly-duo', name: 'HollowServers.co 2x Monthly Solo/Duo | No BP Wipes', type: 'modded', country: 'DE', typicalPlayers: 180, maxPlayers: 250, mapSize: 4250 },
  { id: 'cat-hollow-monthly-quad', name: 'HollowServers.co - 2x Monthly Solo/Duo/Trio/Quad', type: 'modded', country: 'DE', typicalPlayers: 190, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-hollow-au-10x', name: '[AU] HollowServers.co 10x No BPs [Loot++|Events|MyMini|Shop]', type: 'modded', country: 'AU', typicalPlayers: 150, maxPlayers: 250, mapSize: 3800 },
  { id: 'cat-hollow-au-3x-trio', name: '[AU] HollowServers.co 3x Solo/Duo/Trio | Shared BPs', type: 'modded', country: 'AU', typicalPlayers: 140, maxPlayers: 250, mapSize: 3800 },

  // Magic Rust — servidores numerados, ciclo corto
  { id: 'cat-magic-main', name: 'Magic Rust — Main | Классика x1', type: 'modded', country: 'DE', typicalPlayers: 400, maxPlayers: 500, mapSize: 4250 },
  { id: 'cat-magic-13', name: 'Magic Rust #13 — Vanilla 2x', type: 'modded', country: 'DE', typicalPlayers: 300, maxPlayers: 400, mapSize: 4000 },
  { id: 'cat-magic-14', name: 'Magic Rust #14 — Modded 2x (No limit)', type: 'modded', country: 'DE', typicalPlayers: 280, maxPlayers: 400, mapSize: 4000 },
  { id: 'cat-magic-19', name: 'Magic Rust #19 — 2x | Vanilla+', type: 'modded', country: 'DE', typicalPlayers: 260, maxPlayers: 400, mapSize: 4000 },
  { id: 'cat-magic-7', name: 'Magic Rust #7 — Modded 2x (Solo/Duo/Trio)', type: 'modded', country: 'DE', typicalPlayers: 240, maxPlayers: 350, mapSize: 3800 },
  { id: 'cat-magic-31', name: 'Magic Rust #31 — Modded 2x (Solo/Duo)', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 3500 },
  { id: 'cat-magic-22', name: 'Magic Rust #22 — Vanilla 2x (Biweekly)', type: 'modded', country: 'DE', typicalPlayers: 220, maxPlayers: 350, mapSize: 4250 },
  { id: 'cat-magic-27', name: 'Magic Rust #27 — Vanilla 2x (Monthly)', type: 'modded', country: 'DE', typicalPlayers: 210, maxPlayers: 350, mapSize: 4500 },
  { id: 'cat-magic-long', name: 'Magic Rust — Long | Классика x1', type: 'modded', country: 'DE', typicalPlayers: 190, maxPlayers: 300, mapSize: 4500 },

  // Dúo: el tamaño de grupo con menos oferta y el que más se busca después
  // del solo. Repartidos por comunidades y regiones para que el filtro sirva.
  { id: 'cat-rustoria-eu-duo', name: 'Rustoria.co - EU Duo', type: 'community', country: 'DE', typicalPlayers: 220, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-rustoria-us-duo', name: 'Rustoria.co - US Duo', type: 'community', country: 'US', typicalPlayers: 200, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-rustoria-eu-duo-mon', name: 'Rustoria.co - EU Duo Mondays', type: 'community', country: 'DE', typicalPlayers: 180, maxPlayers: 250, mapSize: 3800 },
  { id: 'cat-rustafied-eu-duo', name: 'Rustafied.com - EU Duo', type: 'community', country: 'DE', typicalPlayers: 200, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rustafied-us-duo', name: 'Rustafied.com - US Duo', type: 'community', country: 'US', typicalPlayers: 190, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rusticated-eu-duo', name: 'Rusticated.com - EU Duo | Thursday Wipes', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rusticated-us-duo', name: 'Rusticated.com - US Duo | Monday Wipes', type: 'modded', country: 'US', typicalPlayers: 180, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-moose-eu-duo', name: 'Rusty Moose |EU Solo/Duo|', type: 'modded', country: 'DE', typicalPlayers: 210, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-moose-us-duo', name: 'Rusty Moose |US Solo/Duo|', type: 'modded', country: 'US', typicalPlayers: 200, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-warbandits-us-duo', name: 'WARBANDITS.GG US 3X |Solo/Duo|', type: 'modded', country: 'US', typicalPlayers: 450, maxPlayers: 600, mapSize: 4000 },
  { id: 'cat-warbandits-eu-5x-duo', name: 'WARBANDITS.GG EU 5X |Solo/Duo|', type: 'modded', country: 'DE', typicalPlayers: 380, maxPlayers: 500, mapSize: 4000 },
  { id: 'cat-hollow-eu-duo', name: 'HollowServers.co 2x Solo/Duo | 50% Upkeep', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-hollow-us-duo', name: '[US] HollowServers.co 3x Solo/Duo | Shared BPs', type: 'modded', country: 'US', typicalPlayers: 180, maxPlayers: 250, mapSize: 3800 },
  { id: 'cat-atlas-eu-duo', name: 'Atlas - EU 3x Solo/Duo | No BPs | Mondays', type: 'modded', country: 'DE', typicalPlayers: 250, maxPlayers: 350, mapSize: 3800 },
  { id: 'cat-atlas-us-duo', name: 'Atlas - US 2X Monthly Solo/Duo | Vanilla+', type: 'modded', country: 'US', typicalPlayers: 200, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-bloo-us-duo', name: '[US] Bloo Lagoon Solo/Duo | Bi-weekly', type: 'modded', country: 'US', typicalPlayers: 190, maxPlayers: 250, mapSize: 3800 },
  { id: 'cat-rustopia-eu-duo', name: 'Rustopia.gg - EU Duo', type: 'modded', country: 'DE', typicalPlayers: 220, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-magic-duo-2', name: 'Magic Rust #9 — Modded 2x (Solo/Duo)', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 3500 },
  { id: 'cat-rustinity-eu-duo', name: 'Rustinity 2x EU Solo/Duo', type: 'modded', country: 'DE', typicalPlayers: 170, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-picklerust-eu-duo', name: 'PickleRust EU Solo/Duo', type: 'modded', country: 'DE', typicalPlayers: 160, maxPlayers: 250, mapSize: 3500 },

  // Trío y solo, para que los otros filtros tengan fondo también
  { id: 'cat-moose-eu-trio', name: 'Rusty Moose |EU Trio|', type: 'modded', country: 'DE', typicalPlayers: 230, maxPlayers: 300, mapSize: 3800 },
  { id: 'cat-picklerust-eu-solo', name: 'PickleRust EU Solo Only', type: 'modded', country: 'DE', typicalPlayers: 160, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rustafied-eu-solo', name: 'Rustafied.com - EU Solo', type: 'community', country: 'DE', typicalPlayers: 210, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rustafied-us-solo', name: 'Rustafied.com - US Solo', type: 'community', country: 'US', typicalPlayers: 200, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rustafied-eu-small', name: 'Rustafied.com - EU Small', type: 'community', country: 'DE', typicalPlayers: 180, maxPlayers: 250, mapSize: 3000 },
  { id: 'cat-rustafied-us-small', name: 'Rustafied.com - US Small', type: 'community', country: 'US', typicalPlayers: 170, maxPlayers: 250, mapSize: 3000 },
  { id: 'cat-rustafied-eu-lowpop', name: 'Rustafied.com - EU Low Pop', type: 'community', country: 'DE', typicalPlayers: 90, maxPlayers: 150, mapSize: 4000 },
  { id: 'cat-rustafied-us-lowpop', name: 'Rustafied.com - US Low Pop', type: 'community', country: 'US', typicalPlayers: 85, maxPlayers: 150, mapSize: 4000 },
  { id: 'cat-rustafied-eu-trio-mon', name: 'Rustafied.com - EU Trio - Monday', type: 'community', country: 'DE', typicalPlayers: 190, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-rustafied-au-medium', name: 'Rustafied.com - AU Medium', type: 'community', country: 'AU', typicalPlayers: 120, maxPlayers: 250, mapSize: 3800 },
  { id: 'cat-rustafied-au-long', name: 'Rustafied.com - AU Long', type: 'community', country: 'AU', typicalPlayers: 110, maxPlayers: 250, mapSize: 4500 },
  { id: 'cat-rustafied-sea-medium', name: 'Rustafied.com - SEA Medium', type: 'community', country: 'SG', typicalPlayers: 100, maxPlayers: 250, mapSize: 3800 },
  { id: 'cat-werewolf-eu-trio', name: 'WEREWOLF GAMING.CO 3x Solo/Duo/Trio', type: 'modded', country: 'DE', typicalPlayers: 200, maxPlayers: 300, mapSize: 4000 },
  { id: 'cat-werewolf-au-solo', name: 'WEREWOLF GAMING.CO 3x AU SOLO ONLY', type: 'modded', country: 'AU', typicalPlayers: 120, maxPlayers: 200, mapSize: 3800 },

  // Oficiales de Facepunch
  { id: 'cat-official-eu-main', name: '[EU] Facepunch Rust Official Main', type: 'official', country: 'DE', typicalPlayers: 250, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-official-us-main', name: '[US] Facepunch Rust Official Main', type: 'official', country: 'US', typicalPlayers: 250, maxPlayers: 300, mapSize: 4250 },
  { id: 'cat-official-eu-medium', name: '[EU] Facepunch Rust Official Medium', type: 'official', country: 'DE', typicalPlayers: 180, maxPlayers: 250, mapSize: 3500 },
  { id: 'cat-official-us-small', name: '[US] Facepunch Rust Official Small', type: 'official', country: 'US', typicalPlayers: 150, maxPlayers: 200, mapSize: 3000 },
  { id: 'cat-official-au-main', name: '[AU] Facepunch Rust Official Main', type: 'official', country: 'AU', typicalPlayers: 120, maxPlayers: 250, mapSize: 4250 },
];
