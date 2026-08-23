'use client';

import type { ServerType } from '@/lib/types';

export type WindowKey = '6h' | '24h' | '48h' | '7d' | 'todos';

export interface Filters {
  types: ServerType[];
  window: WindowKey;
  region: string;
  minMaxPlayers: number;
  query: string;
}

export const DEFAULT_FILTERS: Filters = {
  types: [],
  window: 'todos',
  region: 'todas',
  minMaxPlayers: 0,
  query: '',
};

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

const PLAYER_STEPS = [0, 100, 200, 300];

export function FilterBar({
  filters,
  regions,
  onChange,
  resultCount,
}: {
  filters: Filters;
  regions: string[];
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
        <Group label="tipo">
          {TYPES.map((t) => (
            <Chip
              key={t.key}
              active={filters.types.includes(t.key)}
              onClick={() => toggleType(t.key)}
              pressed
            >
              {t.label}
            </Chip>
          ))}
        </Group>

        <Group label="wipea en">
          {WINDOWS.map((w) => (
            <Chip key={w.key} active={filters.window === w.key} onClick={() => set('window', w.key)}>
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

        <Group label="aforo mínimo">
          {PLAYER_STEPS.map((p) => (
            <Chip
              key={p}
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
  pressed = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(pressed ? { 'aria-pressed': active } : {})}
      className={[
        'stencil rounded-sm border px-2 py-1 transition-colors',
        active
          ? 'border-oxide bg-oxide/15 text-oxide-bright'
          : 'border-weld bg-hollow text-ash hover:text-bone',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
