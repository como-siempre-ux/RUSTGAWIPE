'use client';

import type { ServerType } from '@/lib/types';

export type WindowKey = '6h' | '24h' | '48h' | '7d' | 'todos';

/** `-1` = cualquiera. `0` = sin límite de grupo. `1..5` = tope exacto. */
export type GroupKey = -1 | 0 | 1 | 2 | 3 | 4 | 5;

/** Ventana hacia atrás: servidores que acaban de wipear. */
export type WipedKey = 'cualquiera' | '24h' | '48h';

/** Criterio de orden de la lista. */
export type SortKey = 'poblacion' | 'wipe';

export interface Filters {
  sort: SortKey;
  types: ServerType[];
  window: WindowKey;
  wiped: WipedKey;
  region: string;
  minMaxPlayers: number;
  group: GroupKey;
  query: string;
}

export const DEFAULT_FILTERS: Filters = {
  // Los servidores con más gente primero. La cuenta atrás del forced wipe
  // sigue arriba, y "wipea en 6h" está a un clic para el otro caso de uso.
  sort: 'poblacion',
  types: [],
  window: 'todos',
  wiped: 'cualquiera',
  region: 'todas',
  minMaxPlayers: 0,
  group: -1,
  query: '',
};

/**
 * "Más gente" ordena por jugadores conectados ahora mismo. No hay histórico
 * de picos en ninguna de las fuentes, así que es el mejor indicador de
 * popularidad disponible.
 */
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'poblacion', label: 'más gente' },
  { key: 'wipe', label: 'wipea antes' },
];

const TYPES: Array<{ key: ServerType; label: string }> = [
  { key: 'official', label: 'oficial' },
  { key: 'community', label: 'comunidad' },
  { key: 'modded', label: 'modded' },
];

const WINDOWS: Array<{ key: WindowKey; label: string }> = [
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '48h', label: '48h' },
  { key: '7d', label: '7 días' },
  { key: 'todos', label: 'todos' },
];

/**
 * Mirando hacia atrás: mapa recién estrenado. Es el otro momento en que se
 * entra a un servidor, además de "está a punto de wipear".
 */
const WIPED: Array<{ key: WipedKey; label: string }> = [
  { key: 'cualquiera', label: 'cualquiera' },
  { key: '24h', label: 'últimas 24h' },
  { key: '48h', label: 'últimas 48h' },
];

const PLAYER_STEPS = [0, 100, 200, 300];

/**
 * Tope exacto, no "hasta": quien busca trío quiere servidores de trío, no
 * que le salgan también los de grupo libre. Es como filtra todo el mundo.
 */
const GROUPS: Array<{ key: GroupKey; label: string }> = [
  { key: -1, label: 'cualquiera' },
  { key: 1, label: 'solo' },
  { key: 2, label: 'dúo' },
  { key: 3, label: 'trío' },
  { key: 4, label: 'cuarteto' },
  { key: 0, label: 'sin límite' },
];

export function FilterBar({
  filters,
  regions,
  groupCounts,
  onChange,
  resultCount,
}: {
  filters: Filters;
  regions: string[];
  /** Cuántos servidores hay de cada tamaño de grupo, sobre el total cargado. */
  groupCounts: Record<number, number>;
  onChange: (next: Filters) => void;
  resultCount: number;
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleType = (t: ServerType) =>
    set(
      'types',
      filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t],
    );

  return (
    <div className="plate sticky top-0 z-20 rounded-sm px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-sheet/85 sm:px-4">
      {/* Buscador: lo primero en móvil, es lo que más se usa. */}
      <div className="flex items-center gap-2">
        <label htmlFor="q" className="sr-only">
          buscar servidor por nombre
        </label>
        <input
          id="q"
          type="search"
          value={filters.query}
          onChange={(e) => set('query', e.target.value)}
          placeholder="buscar por nombre…"
          className="min-w-0 flex-1 rounded-sm border border-weld bg-hollow px-3 py-2 text-base text-bone placeholder:text-ash/50"
        />
        <span className="stencil shrink-0 tnum text-ash">{resultCount}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Group label="ordenar por">
          {SORTS.map((o) => (
            <Chip
              key={o.key}
              group="ordenar por"
              active={filters.sort === o.key}
              onClick={() => set('sort', o.key)}
            >
              {o.label}
            </Chip>
          ))}
        </Group>

        <Group label="tipo">
          {TYPES.map((t) => (
            <Chip
              key={t.key}
              active={filters.types.includes(t.key)}
              onClick={() => toggleType(t.key)}
              group="tipo"
              pressed
            >
              {t.label}
            </Chip>
          ))}
        </Group>

        <Group label="wipea en">
          {WINDOWS.map((w) => (
            <Chip
              key={w.key}
              group="wipea en"
              active={filters.window === w.key}
              onClick={() => set('window', w.key)}
            >
              {w.label}
            </Chip>
          ))}
        </Group>

        <Group label="ya wipeó hace">
          {WIPED.map((w) => (
            <Chip
              key={w.key}
              group="ya wipeó hace"
              active={filters.wiped === w.key}
              onClick={() => set('wiped', w.key)}
            >
              {w.label}
            </Chip>
          ))}
        </Group>

        <Group label="región">
          <label htmlFor="region" className="sr-only">
            región
          </label>
          <select
            id="region"
            value={filters.region}
            onChange={(e) => set('region', e.target.value)}
            className="rounded-sm border border-weld bg-hollow px-2 py-1.5 text-tiny text-bone"
          >
            <option value="todas">todas</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Group>

        <Group label="grupo">
          {GROUPS.map((g) => {
            // Sin servidores de ese tamaño, el chip se apaga en vez de llevar
            // a una lista vacía. En modo catálogo pasa con "sin límite".
            const disabled = g.key !== -1 && (groupCounts[g.key] ?? 0) === 0;
            return (
              <Chip
                key={g.key}
                group="tamaño de grupo"
                active={filters.group === g.key}
                disabled={disabled}
                title={disabled ? 'ningún servidor cargado declara este tamaño' : undefined}
                onClick={() => set('group', g.key)}
              >
                {g.label}
              </Chip>
            );
          })}
        </Group>

        <Group label="aforo mínimo">
          {PLAYER_STEPS.map((p) => (
            <Chip
              key={p}
              group="aforo mínimo"
              active={filters.minMaxPlayers === p}
              onClick={() => set('minMaxPlayers', p)}
            >
              {p === 0 ? 'cualquiera' : `${p}+`}
            </Chip>
          ))}
        </Group>
      </div>
    </div>
  );
}

/** Los chips llevan texto plano, así que basta con esto para el aria-label. */
function childrenToText(children: React.ReactNode): string {
  return typeof children === 'string' || typeof children === 'number' ? String(children) : '';
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="stencil text-ash/60">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  group,
  pressed = false,
  disabled = false,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /**
   * Nombre del grupo al que pertenece el chip. Hay tres chips que se llaman
   * "cualquiera"; en pantalla se distinguen por la etiqueta de su grupo, pero
   * un lector de pantalla sólo oiría "cualquiera" tres veces.
   */
  group?: string;
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={group ? `${group}: ${childrenToText(children)}` : undefined}
      {...(pressed ? { 'aria-pressed': active } : {})}
      className={[
        'stencil rounded-sm border px-2 py-1 transition-colors',
        disabled
          ? 'cursor-not-allowed border-weld/50 bg-hollow text-ash/30'
          : active
            ? 'border-oxide bg-oxide/15 text-oxide-bright'
            : 'border-weld bg-hollow text-ash hover:text-bone',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
