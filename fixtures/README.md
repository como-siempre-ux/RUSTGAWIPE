# fixtures

## battlemetrics-403-response.json

Respuesta **real** de BattleMetrics, capturada el 2026-08-23 con:

```bash
curl -s "https://api.battlemetrics.com/servers?filter%5Bgame%5D=rust&page%5Bsize%5D=100&sort=-players"
```

Devuelve `403 Forbidden` con `"A subscription is required to use the API"`, tanto sin token
como con token de cuenta gratuita, y también en `/servers/{id}`. Por eso el fixture con datos
de servidores que pedía la especificación no se pudo capturar: la API ya no es gratuita.

El adaptador `lib/sources/battlemetrics.ts` se mantiene porque sigue siendo la mejor fuente si
tienes suscripción, pero no es el camino por defecto.

## battlemetrics-sample.json

Muestra **sintética** con la forma documentada del recurso `server`, escrita a mano a partir de
la documentación pública. Sirve para dos cosas:

- ver qué campos espera el parser sin necesidad de suscripción;
- dejar claro qué campos son opcionales de verdad (`rust_next_wipe` casi nunca viene).

**No es una captura real.** Si consigues acceso a la API, sustitúyela por una respuesta de
verdad y revisa los tipos de `lib/types.ts` contra ella, que es lo que pedía la especificación
en su paso 1.

## Fuente que sí funciona

La Steam Web API (`IGameServersService/GetServerList`) devuelve la lista real de servidores de
Rust con una clave gratuita. Las etiquetas van en el campo `gametype`, y `born<unix>` es la
fecha del último wipe. El parser está en `lib/sources/steam.ts` y sus casos de prueba, con
etiquetas reales, en `lib/__tests__/steam-parse.test.ts`.
