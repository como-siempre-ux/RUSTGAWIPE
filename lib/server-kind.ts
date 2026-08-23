/**
 * Distingue los servidores que wipean de los que no.
 *
 * En la lista de Steam conviven servidores de supervivencia con salas de
 * aimtrain, creative, bedwars y demás minijuegos. Esos últimos no wipean: no
 * tienen mapa que reiniciar. En una web de wipes son ruido, y ordenando por
 * población se comían el primer puesto — el de aimtrain más grande tenía
 * 1.087 jugadores, más del doble que cualquier servidor de wipe.
 *
 * Sin imports: se ejecuta tal cual con `node fichero.ts` desde el script de
 * build.
 */

/**
 * Modos que no reinician mapa. `arena` a propósito NO está: lo usan bastantes
 * servidores de supervivencia en su nombre y se llevaba por delante servidores
 * legítimos.
 */
const MODOS_SIN_WIPE =
  /\b(aim ?train\w*|aim ?course|bedwars|creative|sandbox|minigames?|mini-games?|deathmatch|build ?pvp|parkour|prop ?hunt|jump ?training|training ?grounds?|matchmaking|1v1|ffa)\b/i;

/**
 * Señales de que sí es un servidor de wipe, aunque el nombre lleve alguna
 * palabra de las de arriba. Un servidor de creative no se anuncia como
 * "vanilla" ni pone la fecha del wipe en el título.
 */
const SENALES_DE_WIPE = /\b(vanilla|wipe|wiped|monthly|weekly|bi-?weekly)\b/i;

/** `true` si el servidor reinicia mapa, es decir, si pinta algo en esta web. */
export function esServidorDeWipe(name: string): boolean {
  if (!MODOS_SIN_WIPE.test(name)) return true;
  return SENALES_DE_WIPE.test(name);
}
