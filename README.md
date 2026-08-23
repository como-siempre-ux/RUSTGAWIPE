# RUSTGAWIPE

Una web que responde a una sola pregunta: **¿qué servidores de Rust wipean pronto?**

Lista ordenada por proximidad del próximo wipe, con countdown al forced wipe mensual de
Facepunch. Oficiales, comunidad y modded.

```bash
npm install
npm run dev
```

Arranca en http://localhost:3000 sin configurar nada.

---

## Aviso sobre la fuente de datos

La especificación original apuntaba a la API de BattleMetrics. **Ya no es usable gratis.** A día
de 2026-08-23, esto:

```bash
curl -s "https://api.battlemetrics.com/servers?filter%5Bgame%5D=rust&page%5Bsize%5D=100&sort=-players"
```

devuelve `403 Forbidden — "Access denied. A subscription is required to use the API."`, y lo
mismo `/servers/{id}`. Pasa sin token y con token de cuenta gratuita. La respuesta real está
guardada en [`fixtures/battlemetrics-403-response.json`](fixtures/battlemetrics-403-response.json).

El master server UDP de Valve (`hl2master.steampowered.com`), que es por donde tiran otras webs
de wipes, tampoco resuelve ya.

Así que la app tiene **tres fuentes** detrás de la misma interfaz, y usa la primera que funcione:

| # | Fuente | Necesita | Qué da |
|---|---|---|---|
| 1 | BattleMetrics | `BATTLEMETRICS_TOKEN` (suscripción **de pago**) | lo más completo: tipo, país, mapa, seed, a veces el próximo wipe exacto |
| 2 | Steam Web API | `STEAM_API_KEY` (**gratis**, 2 minutos) | lista real con población en vivo, ip y último wipe |
| 3 | Catálogo local | nada | sólo comunidades conocidas, con su calendario publicado |

### La opción recomendada: Steam

La clave es gratuita e instantánea en https://steamcommunity.com/dev/apikey.

```bash
cp .env.example .env.local
# pega la clave en STEAM_API_KEY
npm run dev
```

El truco: Rust mete sus etiquetas en el campo `gametype` de Steam, y una de ellas es
`born<unix>`, que es la fecha del último wipe. El parser está en
[`lib/sources/steam.ts`](lib/sources/steam.ts).

> El adaptador de Steam está escrito contra la forma documentada del endpoint y su parser tiene
> tests con etiquetas reales, pero **no se ha podido probar contra el endpoint en vivo** porque
> no había clave disponible al construirlo. Si algo falla al meter la tuya, mira la consola del
> servidor: la app cae al catálogo y te dice por qué en el aviso amarillo de arriba.

### Sin ninguna clave

Funciona igual, en modo catálogo: las comunidades grandes de Rust con sus horarios de wipe. No
hay población en vivo ni `client.connect`, porque las IPs cambian entre wipes y **no se inventan
direcciones**.

---

## Precisión de los horarios

Adivinar el ciclo de wipe leyendo el nombre del servidor funciona regular. Las comunidades
grandes publican su calendario, así que para ellas se usa el calendario y no la heurística.
Eso está en [`lib/catalog.ts`](lib/catalog.ts): Rustafied, Rusticated, Rusty Moose, Rustoria,
Bloo Lagoon, Rustopia, PickleRust, RustEZ, Rustinity, Rust Factor, Vital Rust, Atlas Rust,
Reddit Rust y los oficiales de Facepunch.

Cada entrada lleva `sourceUrl` y `verified` con la fecha en que se comprobó contra la web
oficial. **Cuando una comunidad cambia su calendario, esto se queda viejo**, y por eso la UI
nunca lo enseña como confirmado.

La app distingue cuatro niveles de fiabilidad, visibles en cada fila con su explicación en el
tooltip:

| nivel | de dónde sale |
|---|---|
| `confirmado` | la fuente da la fecha exacta del próximo wipe |
| `programado` | calendario publicado de la comunidad |
| `estimado` | último wipe + ciclo deducido del nombre |
| `desconocido` | no hay datos; va al final de la lista, no se oculta |

### Actualizar un horario

Edita la entrada en `COMMUNITIES` dentro de [`lib/catalog.ts`](lib/catalog.ts), sube la fecha de
`verified` y añade un caso en `lib/__tests__/wipe-schedule.test.ts`.

---

## El cálculo del wipe

Todo el cálculo vive en [`lib/wipe-schedule.ts`](lib/wipe-schedule.ts) y ninguna función llama a
`new Date()`: el "ahora" siempre se inyecta, así que los tests son deterministas.

- **Forced wipe**: primer jueves de cada mes a las `FORCED_WIPE_UTC_HOUR` (19) UTC. No necesita
  API.
- Un wipe estimado **nunca** cae después del forced wipe; si el cálculo se pasa, se recorta.
- Si el próximo wipe calculado ya pasó, se va sumando el intervalo hasta que caiga en el futuro.
- Las horas de los calendarios se resuelven con `Intl`, así que el horario de verano sale bien:
  Rustafied EU wipea a las 15:00 de Londres, que son las 14:00 UTC en agosto y las 15:00 UTC en
  enero.

```bash
npm test        # 56 tests
npm run typecheck
```

---

## Arquitectura

```
app/
  page.tsx              página única
  api/wipes/route.ts    proxy: normaliza y ordena, cachea 5 min
lib/
  sources/              battlemetrics · steam · resolutor con fallback
  wipe-schedule.ts      cálculo del próximo wipe (con tests)
  catalog.ts            comunidades conocidas y sus calendarios
  normalize.ts          fuente externa -> modelo propio
  time.ts               zonas horarias sin dependencias
  types.ts              tipos + esquemas Zod
components/             countdown, filtros, tarjeta de servidor
fixtures/               respuestas de la API (ver fixtures/README.md)
```

- Sin base de datos.
- `/api/wipes` devuelve servidores **ya normalizados y ordenados**. El cliente no sabe nada de
  la forma de las APIs externas.
- Las credenciales sólo se leen en módulos marcados `server-only`. Verificado: se compiló con
  valores canario y no aparecen ni ellos ni los nombres de las variables en `.next/static`.

## Diseño

Rust es óxido, chapa, escasez y un reloj corriendo. La paleta sale de materiales del juego
—hollín, plancha, soldadura, óxido, brasa, hueso, ceniza— y los badges de tipo también: acero
para oficial, óxido para comunidad, azufre para modded. Tipografía: Oswald condensada para
cifras y nombres, Barlow para el cuerpo. Un único elemento memorable, el countdown; el resto,
callado.

Mobile-first, foco de teclado visible, `prefers-reduced-motion` respetado, y estados de carga,
error y lista vacía.

## Qué no hay (y es a propósito)

Cuentas, favoritos, notificaciones, bot de Discord, histórico de wipes, gráficas de población y
backend con scraping continuo. Eso es v2, si la v1 se usa.
