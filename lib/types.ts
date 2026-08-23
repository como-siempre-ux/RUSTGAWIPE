import { z } from 'zod';

// ---------------------------------------------------------------------------
// Modelo propio (lo que sale por /api/wipes)
// ---------------------------------------------------------------------------

export type ServerType = 'official' | 'community' | 'modded' | 'unknown';

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'custom';

/**
 * `confirmado`  la fuente da la fecha exacta del próximo wipe.
 * `programado`  sale del calendario publicado por la comunidad.
 * `estimado`    deducido del último wipe + ciclo detectado en el nombre.
 * `desconocido` no hay datos suficientes.
 */
export type WipeConfidence = 'confirmado' | 'programado' | 'estimado' | 'desconocido';

export interface WipeResolution {
  nextWipeMs: number | null;
  /**
   * Último wipe. Si la fuente no lo da pero el servidor tiene calendario, se
   * calcula con las mismas reglas mirando hacia atrás.
   */
  lastWipeMs: number | null;
  /** `true` si el último wipe está calculado, no observado. */
  lastWipeIsDerived: boolean;
  confidence: WipeConfidence;
  cadence: Cadence | null;
  /** Frase corta para el tooltip: de dónde sale el dato. */
  explanation: string;
}

/** Calendario publicado de una comunidad conocida. */
export interface ScheduleRule {
  community: string;
  cadence: Cadence;
  /** 0 = domingo ... 6 = sábado. Irrelevante para `monthly`. */
  weekday: number;
  /**
   * Varios días de wipe en la misma semana, cuando la comunidad wipea más de
   * una vez (Warbandits wipea lunes y viernes; Survivors.gg #1 hace fullwipe
   * el jueves y map wipe el lunes). Si está, manda sobre `weekday`.
   */
  weekdays?: number[];
  hourLocal: number;
  minuteLocal?: number;
  timeZone: string;
  /** Días entre wipes cuando `cadence === 'custom'`. */
  intervalDays?: number;
  /**
   * El calendario no se ha podido verificar contra una fuente oficial: se
   * conoce el ciclo pero no la hora exacta. Baja la confianza a `estimado`
   * para no vender una suposición como un horario publicado.
   */
  approximate?: boolean;
  /** Descripción legible, se muestra en el tooltip. */
  human: string;
}

export interface RustServer {
  id: string;
  name: string;
  type: ServerType;
  /** `ip:puerto` de conexión, si se conoce. */
  connect: string | null;
  players: number | null;
  maxPlayers: number | null;
  /**
   * Tamaño máximo de grupo: `1` solo, `2` dúo… `0` sin límite declarado,
   * `null` no se ha podido determinar. Sale del nombre del servidor.
   */
  groupLimit: number | null;
  /** ISO-3166 alpha-2, en mayúsculas. */
  country: string | null;
  region: string | null;
  lastWipeMs: number | null;
  /** `true` si el último wipe sale del calendario, no de la fuente. */
  lastWipeIsDerived: boolean;
  nextWipeMs: number | null;
  confidence: WipeConfidence;
  cadence: Cadence | null;
  wipeExplanation: string;
  mapSize: number | null;
  mapSeed: number | null;
  url: string | null;
  /** Comunidad reconocida del catálogo, si aplica. */
  community: string | null;
  /** De dónde salió la fila. */
  source: 'battlemetrics' | 'steam' | 'catalog';

  // --- Para recalcular las horas en el cliente ------------------------------
  //
  // Los campos de arriba (`nextWipeMs`, `lastWipeMs`, `confidence`…) se
  // calculan cuando se genera el payload. En un sitio estático ese momento es
  // el del build, que puede ser de hace días: "wipea en 3h" quedaría
  // congelado y mintiendo.
  //
  // Por eso el payload lleva también lo que hace falta para rehacer la cuenta
  // con el reloj del navegador. Lo de arriba vale para el primer pintado; a
  // partir de ahí manda lo de aquí.

  /** Calendario de la comunidad, si la tiene. */
  rule: ScheduleRule | null;
  /**
   * Último wipe según la fuente (etiqueta `born` de Steam). Es un instante
   * absoluto, así que no caduca aunque el payload sea viejo.
   */
  sourceLastWipeMs: number | null;
  /** Tipo tal como lo dio la fuente, para rehacer la heurística del nombre. */
  sourceTags: string[];
}

export interface WipesPayload {
  generatedAtMs: number;
  nextForcedWipeMs: number;
  /** Fuente realmente usada, para que la UI pueda avisar en modo degradado. */
  source: 'battlemetrics' | 'steam' | 'catalog';
  /** Aviso legible cuando se ha caído a una fuente de menor cobertura. */
  notice: string | null;
  count: number;
  servers: RustServer[];
}

// ---------------------------------------------------------------------------
// Esquemas Zod de las fuentes externas
// ---------------------------------------------------------------------------

/**
 * BattleMetrics. Todo opcional a propósito: la documentación lista campos que
 * en la práctica faltan en la mayoría de servidores. Nada aquí se da por hecho.
 */
export const bmDetailsSchema = z
  .object({
    rust_type: z.string().optional().nullable(),
    rust_last_wipe: z.string().optional().nullable(),
    rust_next_wipe: z.string().optional().nullable(),
    rust_world_size: z.coerce.number().optional().nullable(),
    rust_world_seed: z.coerce.number().optional().nullable(),
    rust_url: z.string().optional().nullable(),
    rust_headerimage: z.string().optional().nullable(),
    rust_description: z.string().optional().nullable(),
  })
  .passthrough();

export const bmAttributesSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional().nullable(),
    ip: z.string().optional().nullable(),
    port: z.coerce.number().optional().nullable(),
    players: z.coerce.number().optional().nullable(),
    maxPlayers: z.coerce.number().optional().nullable(),
    country: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    details: bmDetailsSchema.optional().nullable(),
  })
  .passthrough();

export const bmServerSchema = z
  .object({
    id: z.string(),
    type: z.string().optional(),
    attributes: bmAttributesSchema,
  })
  .passthrough();

export const bmResponseSchema = z
  .object({
    data: z.array(bmServerSchema),
    links: z
      .object({ next: z.string().optional().nullable() })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export type BmServer = z.infer<typeof bmServerSchema>;

/** Steam Web API — IGameServersService/GetServerList. */
export const steamServerSchema = z
  .object({
    addr: z.string(),
    gameport: z.coerce.number().optional().nullable(),
    steamid: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    appid: z.coerce.number().optional().nullable(),
    gamedir: z.string().optional().nullable(),
    region: z.coerce.number().optional().nullable(),
    players: z.coerce.number().optional().nullable(),
    max_players: z.coerce.number().optional().nullable(),
    bots: z.coerce.number().optional().nullable(),
    map: z.string().optional().nullable(),
    secure: z.boolean().optional().nullable(),
    dedicated: z.boolean().optional().nullable(),
    os: z.string().optional().nullable(),
    gametype: z.string().optional().nullable(),
  })
  .passthrough();

export const steamResponseSchema = z
  .object({
    response: z
      .object({
        servers: z.array(steamServerSchema).optional().nullable(),
      })
      .passthrough(),
  })
  .passthrough();

export type SteamServer = z.infer<typeof steamServerSchema>;
