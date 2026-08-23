/**
 * Tamaño máximo de grupo permitido en un servidor.
 *
 * Ni BattleMetrics ni Steam lo dan como campo. En Rust la convención es
 * meterlo en el nombre ("Solo/Duo/Trio", "Max 2", "4 Max", "No Limit"), así
 * que se saca de ahí. Cuando no hay pista se devuelve `null`: desconocido,
 * que no es lo mismo que "sin límite".
 */

/** `null` = no se ha podido determinar. `0` = sin límite declarado. */
export type GroupLimit = number | null;

export const NO_LIMIT = 0;

/**
 * Los servidores suelen listar el rango entero ("Solo/Duo/Trio"): el límite
 * real es el mayor de los que aparecen. Por eso se buscan todos y se coge el
 * máximo, en vez de parar en la primera coincidencia.
 */
const WORDS: Array<{ re: RegExp; n: number }> = [
  { re: /\bsolo\s*only\b|\bsolo\b/i, n: 1 },
  { re: /\bduos?\b|\bduo\s*only\b/i, n: 2 },
  { re: /\btrios?\b|\btrio\s*only\b/i, n: 3 },
  { re: /\bquads?\b|\bsquads?\b/i, n: 4 },
  { re: /\bquints?\b|\bmax\s*5\b|\b5\s*max\b/i, n: 5 },
];

const NO_LIMIT_PATTERN = /\bno\s*-?\s*limit|\bnolimit\b|\bunlimited\b|\bno\s*group\s*limit\b|\bzerg/i;

export function detectGroupLimit(name: string): GroupLimit {
  const n = name.toLowerCase();

  // "Max 3", "3 Max", "Max Group 4", "Group Limit 2", "Team Limit 3"
  const numeric =
    /\bmax\s*(?:group\s*)?(\d{1,2})\b/.exec(n) ??
    /\b(\d{1,2})\s*max\b/.exec(n) ??
    /\b(?:group|team)\s*(?:limit|size)\s*(\d{1,2})\b/.exec(n) ??
    /\blimit\s*(\d{1,2})\b/.exec(n);

  let best = 0;
  if (numeric) {
    const v = Number(numeric[1]);
    if (v >= 1 && v <= 12) best = v;
  }

  for (const { re, n: value } of WORDS) {
    if (re.test(n)) best = Math.max(best, value);
  }

  if (best > 0) return best;
  if (NO_LIMIT_PATTERN.test(n)) return NO_LIMIT;
  return null;
}

const LABELS: Record<number, string> = {
  0: 'sin límite',
  1: 'solo',
  2: 'dúo',
  3: 'trío',
  4: 'cuarteto',
  5: 'quinteto',
};

export function groupLimitLabel(limit: GroupLimit): string | null {
  if (limit === null) return null;
  return LABELS[limit] ?? `hasta ${limit}`;
}
