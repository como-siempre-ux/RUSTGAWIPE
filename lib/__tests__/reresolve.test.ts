import { describe, expect, it } from 'vitest';

import { catalogAsServers, reresolveAll } from '../normalize';
import { DAY_MS } from '../time';

/**
 * En GitHub Pages no hay servidor: los datos se cocinan en el build y pueden
 * llegar al navegador con semanas de antigüedad. Las horas se rehacen en el
 * cliente justo por eso. Estos tests comprueban que un payload viejo sigue
 * dando horas correctas, que es lo único que hace creíble al sitio estático.
 */
describe('recalcular las horas con un payload viejo', () => {
  const CONSTRUIDO = Date.parse('2025-08-01T12:00:00.000Z');
  const payloadViejo = catalogAsServers(CONSTRUIDO);

  it('un payload de hace un mes da wipes en el futuro, no en el pasado', () => {
    const unMesDespues = CONSTRUIDO + 31 * DAY_MS;
    const frescos = reresolveAll(payloadViejo, unMesDespues);

    const enElPasado = frescos
      .filter((s) => s.nextWipeMs !== null && s.nextWipeMs <= unMesDespues)
      .map((s) => s.name);
    expect(enElPasado).toEqual([]);
  });

  it('y el último wipe sigue quedando en el pasado', () => {
    const unMesDespues = CONSTRUIDO + 31 * DAY_MS;
    const frescos = reresolveAll(payloadViejo, unMesDespues);

    const enElFuturo = frescos
      .filter((s) => s.lastWipeMs !== null && s.lastWipeMs > unMesDespues)
      .map((s) => s.name);
    expect(enElFuturo).toEqual([]);
  });

  it('las horas cambian al cambiar el reloj: no vienen congeladas del payload', () => {
    const a = reresolveAll(payloadViejo, CONSTRUIDO + 10 * DAY_MS);
    const b = reresolveAll(payloadViejo, CONSTRUIDO + 40 * DAY_MS);

    const porId = new Map(a.map((s) => [s.id, s.nextWipeMs]));
    const algunoCambio = b.some((s) => porId.get(s.id) !== s.nextWipeMs);
    expect(algunoCambio).toBe(true);
  });

  it('rehacer da lo mismo que calcular de cero con esa hora', () => {
    const cuando = CONSTRUIDO + 17 * DAY_MS + 5 * 3_600_000;
    const rehecho = reresolveAll(payloadViejo, cuando);
    const deCero = catalogAsServers(cuando);

    expect(rehecho.map((s) => s.id)).toEqual(deCero.map((s) => s.id));
    expect(rehecho.map((s) => s.nextWipeMs)).toEqual(deCero.map((s) => s.nextWipeMs));
    expect(rehecho.map((s) => s.confidence)).toEqual(deCero.map((s) => s.confidence));
  });

  it('el payload lleva la regla de cada servidor: sin eso no se puede rehacer', () => {
    const conComunidad = payloadViejo.filter((s) => s.community !== null);
    expect(conComunidad.length).toBe(payloadViejo.length);
    expect(conComunidad.every((s) => s.rule !== null)).toBe(true);
  });

  it('sobrevive a ir y volver por JSON, que es como viaja de verdad', () => {
    const viajado = JSON.parse(JSON.stringify(payloadViejo));
    const cuando = CONSTRUIDO + 9 * DAY_MS;
    expect(reresolveAll(viajado, cuando).map((s) => s.nextWipeMs)).toEqual(
      reresolveAll(payloadViejo, cuando).map((s) => s.nextWipeMs),
    );
  });
});
