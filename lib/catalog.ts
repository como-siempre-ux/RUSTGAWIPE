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
// Catálogo de reserva
// ---------------------------------------------------------------------------

/**
 * Servidores para cuando no hay credenciales.
 *
 * Antes esto era una lista escrita a mano, y escribir a mano una lista de
 * servidores acaba en nombres inventados: al ampliar los de dúo se colaron 37
 * que no existen, y las poblaciones y tamaños de mapa estaban puestos a ojo.
 * Un servidor inventado es peor que no tener servidor, porque la web lo dice
 * con la misma cara con la que dice la verdad.
 *
 * Ahora sale de `catalog-snapshot.json`: una foto de la lista real de Steam.
 * Se regenera con `npm run build:snapshot`.
 *
 * Lo que sí sigue escrito a mano son los **calendarios** de arriba, que están
 * contrastados contra las webs de cada comunidad y llevan su `verified`.
 */
import snapshot from './catalog-snapshot.json' with { type: 'json' };

export interface CatalogServer {
  id: string;
  name: string;
  type: ServerType;
  /** Población el día de la foto. No es en vivo, y la interfaz lo advierte. */
  players: number;
  maxPlayers: number;
  /** Región según Steam, o `null` si no la declaraba. */
  region: string | null;
  /**
   * Último wipe del día de la foto. Vale como **ancla de fase** —dice qué día
   * de la semana wipea el servidor—, no como fecha para enseñar: se avanza al
   * ciclo actual antes de mostrarla.
   */
  lastWipeMs: number | null;
}

/** Fecha de la foto, para poder decir de cuándo son estos datos. */
export const CATALOG_SNAPSHOT_DATE: string = snapshot.takenAt;

export const CATALOG_SERVERS: CatalogServer[] = snapshot.servers.map((s, i) => ({
  id: `snap-${i}`,
  name: s.name,
  type: (s.type === 'official' || s.type === 'modded' ? s.type : 'community') as ServerType,
  players: s.players,
  maxPlayers: s.maxPlayers,
  region: s.region,
  lastWipeMs: s.lastWipeMs,
}));
