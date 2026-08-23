# Rust Wipe Tracker — Especificación v1

## Objetivo

Una web que responda a una sola pregunta: **¿qué servidores de Rust wipean pronto?**

Lista de servidores ordenada por proximidad del próximo wipe, incluyendo servidores **oficiales, de comunidad y modded**. Nada más en la v1.

Zona horaria de referencia del usuario: `Europe/Madrid`. Todas las horas se muestran en la zona local del navegador.

---

## Alcance

### Dentro de la v1
- Listado de servidores con su próximo wipe (confirmado o estimado).
- Filtros básicos y buscador por nombre.
- Countdown al próximo forced wipe oficial.
- Copiar el comando de conexión (`client.connect ip:puerto`).

### Fuera de la v1 (no lo construyas)
- Cuentas de usuario, favoritos, notificaciones, bot de Discord.
- Histórico de wipes, base de datos, gráficas de población.
- Backend propio con scraping continuo.

Si algo de esto parece "fácil de añadir de paso": no lo añadas. Se hace después, si la v1 funciona.

---

## Fuente de datos

### Principal: BattleMetrics API

- Base: `https://api.battlemetrics.com/servers`
- Query base: `?filter[game]=rust&page[size]=100&sort=-players`
- Autenticación: opcional pero recomendada. Cabecera `Authorization: Bearer <token>`. El token se saca creando cuenta gratis en battlemetrics.com → Developers → API tokens. Sin token hay rate limit bajo.
- El token va en `.env.local` como `BATTLEMETRICS_TOKEN` y **solo se usa desde el servidor**, nunca desde el cliente.

Campos relevantes (dentro de `attributes` y `attributes.details`):

| Campo | Uso |
|---|---|
| `attributes.name` | Nombre del servidor |
| `attributes.ip` / `attributes.port` | Comando de conexión |
| `attributes.players` / `maxPlayers` | Población actual |
| `attributes.country` | Región |
| `attributes.details.rust_type` | `official` / `community` / `modded` |
| `attributes.details.rust_last_wipe` | Fecha del último wipe |
| `attributes.details.rust_next_wipe` | Fecha del próximo wipe (no siempre está) |
| `attributes.details.rust_world_size` / `rust_world_seed` | Info del mapa |
| `attributes.details.rust_url` | Web del servidor |

**Importante:** estos nombres de campo son la referencia, no el evangelio. Antes de escribir el parser:

1. Haz una llamada real a la API.
2. Guarda la respuesta en `fixtures/battlemetrics-sample.json`.
3. Inspecciona qué campos existen de verdad y con qué frecuencia vienen rellenos.
4. Escribe los tipos de TypeScript **a partir de esa respuesta real**.

No inventes campos ni asumas que `rust_next_wipe` viene siempre. Trátalo todo como opcional y valida con Zod al entrar.

### Paginación

La API devuelve máximo 100 por página con cursor en `links.next`. Para la v1: trae **3 páginas (300 servidores)** ordenadas por jugadores. Es suficiente y evita machacar la API. Hazlo configurable con una constante `PAGES_TO_FETCH`.

---

## Lógica del próximo wipe

Es el núcleo de la app. Debe estar en un módulo aislado y **con tests**.

### Forced wipe oficial

Es determinista, se calcula sin API: **primer jueves de cada mes**, cuando Facepunch publica la actualización mensual, sobre las **19:00 UTC** (la hora exacta varía un poco; ponla como constante `FORCED_WIPE_UTC_HOUR = 19` y déjala fácil de ajustar).

En ese momento wipean todos los oficiales y la gran mayoría de los de comunidad.

### Resolución por servidor

En este orden:

1. **Si la API da `rust_next_wipe`** → se usa tal cual. Confianza: `confirmado`.
2. **Si no**, se estima con `rust_last_wipe` + intervalo detectado. Confianza: `estimado`.
3. **Si no hay `rust_last_wipe`** → el servidor se marca como `desconocido` y va al final de la lista (no se oculta).

### Detección del intervalo

Heurística sobre el nombre del servidor y sus tags, en minúsculas:

- `weekly` / `semanal` / `wipes thursday` → 7 días
- `biweekly` / `bi-weekly` / `2 weeks` → 14 días
- `monthly` / `mensual` / `vanilla` sin otra pista → hasta el próximo forced wipe
- `3 day` / `3day` / `72h` → 3 días
- Sin pistas → asumir monthly

Reglas adicionales:
- Un wipe estimado **nunca puede ser posterior** al próximo forced wipe. Si el cálculo se pasa, se recorta al forced wipe.
- Si el próximo wipe calculado ya pasó (last_wipe viejo y desactualizado), se va sumando el intervalo hasta que caiga en el futuro.
- Los servidores `official` siempre siguen forced wipe mensual salvo que el nombre indique otra cosa.

### Confianza visible

La UI **tiene que distinguir** entre wipe confirmado y estimado. Un badge o un icono discreto junto a la hora, con tooltip explicando de dónde sale el dato. Nada de mostrar una estimación como si fuera un hecho.

---

## Arquitectura

**Next.js (App Router) + TypeScript + Tailwind.** Motivo: el route handler hace de proxy para que el token no salga al cliente, el cacheado viene de serie y se despliega en Vercel gratis.

```
/app
  /page.tsx                 → página única
  /api/wipes/route.ts       → proxy a BattleMetrics + normalización
/lib
  /battlemetrics.ts         → cliente HTTP + paginación
  /wipe-schedule.ts         → cálculo del próximo wipe (con tests)
  /types.ts                 → tipos + esquemas Zod
/components
  /ServerCard.tsx
  /FilterBar.tsx
  /ForcedWipeCountdown.tsx
/fixtures
  /battlemetrics-sample.json
/lib/__tests__
  /wipe-schedule.test.ts
```

- Sin base de datos.
- Cache: `revalidate: 300` (5 minutos) en el route handler. Los wipes no cambian cada segundo.
- El endpoint `/api/wipes` devuelve ya los servidores **normalizados y ordenados**, no el JSON crudo de BattleMetrics. El cliente no debe saber nada de la forma de la API externa.

### Tests obligatorios

`wipe-schedule.test.ts` con fechas fijas (nada de `new Date()` sin inyectar):

- Primer jueves de mes calculado bien en meses que empiezan en jueves y en meses que empiezan en viernes.
- Cambio de año (diciembre → enero).
- Servidor weekly con last_wipe de hace 10 días → siguiente wipe en el futuro, no en el pasado.
- Servidor weekly cuyo cálculo se pasaría del forced wipe → recortado al forced wipe.
- Servidor sin `rust_last_wipe` → estado `desconocido`.

---

## Interfaz

### Estructura

1. **Cabecera / hero:** el countdown al próximo forced wipe es el protagonista. Es el dato que todo el mundo abre la web para ver. Días : horas : minutos, grande, con la fecha absoluta en pequeño debajo.
2. **Barra de filtros** (sticky en escritorio):
   - Tipo: Oficial / Comunidad / Modded (multiselección)
   - Cuándo: próximas 6h / 24h / 48h / 7 días / todos
   - Región (a partir de `country`)
   - Rango de jugadores máximos
   - Buscador por nombre
3. **Lista de servidores**, ordenada por wipe más próximo primero.

### Cada servidor muestra

- Nombre
- Badge de tipo (oficial / comunidad / modded, con colores distintos)
- **Próximo wipe**: relativo grande ("en 3h 20m") + fecha absoluta pequeña + indicador confirmado/estimado
- Último wipe (relativo)
- Jugadores actuales / máximos
- Tamaño de mapa y seed si están disponibles
- Botón "Copiar conexión" → copia `client.connect ip:puerto` al portapapeles y confirma con un toast que dice "Copiado"

### Dirección visual

Antes de escribir CSS, define un sistema de tokens corto (4-6 colores con nombre, 2 tipografías con roles claros, escala de tamaños) y justifícalo contra el tema: Rust es óxido, metal, chapa, escasez, urgencia y reloj corriendo. La paleta y la tipografía deben salir de ahí, no de la plantilla oscura con acento verde ácido que sale por defecto en cualquier dashboard.

Un solo elemento memorable: el countdown. Todo lo demás, callado y ordenado.

Suelo de calidad, sin anunciarlo:
- Mobile-first de verdad (se va a consultar desde el móvil).
- Foco de teclado visible.
- `prefers-reduced-motion` respetado.
- Estados de carga (skeleton), error y lista vacía. El error dice qué ha fallado y qué hacer; el vacío invita a quitar filtros.

### Copys

Directos, en español, en minúscula de frase. "Wipea en 3h", no "Próximo evento de reinicio programado". Los botones dicen lo que hacen.

---

## Criterios de aceptación

- [ ] `npm run dev` levanta sin errores y sin token (modo degradado con rate limit).
- [ ] Con token en `.env.local` carga 300 servidores.
- [ ] La lista sale ordenada por wipe más próximo.
- [ ] Se distingue visualmente wipe confirmado de estimado.
- [ ] El countdown al forced wipe es correcto (verificable a mano contra el calendario).
- [ ] Los filtros combinan entre sí sin recargar la página.
- [ ] El botón de copiar conexión funciona.
- [ ] Los tests de `wipe-schedule` pasan.
- [ ] Se ve bien en 375px de ancho.
- [ ] El token de BattleMetrics no aparece en ningún bundle del cliente.

---

## Orden de trabajo sugerido

1. Llamada real a la API y guardado del fixture. **Empieza por aquí**, antes de escribir nada de UI.
2. Tipos + validación Zod a partir del fixture.
3. `wipe-schedule.ts` con sus tests, usando el fixture.
4. Route handler `/api/wipes` devolviendo datos normalizados.
5. UI mínima: lista fea pero con datos reales.
6. Filtros y countdown.
7. Diseño y pulido.

No pases al paso siguiente hasta que el anterior funcione de verdad.
