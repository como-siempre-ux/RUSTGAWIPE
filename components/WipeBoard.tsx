'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DAY_MS, HOUR_MS } from '@/lib/time';
import type { RustServer, WipesPayload } from '@/lib/types';

import { DEFAULT_FILTERS, FilterBar, type Filters, type WindowKey } from './FilterBar';
import { ForcedWipeCountdown } from './ForcedWipeCountdown';
import { ServerCard } from './ServerCard';

const WINDOW_MS: Record<WindowKey, number | null> = {
  '6h': 6 * HOUR_MS,
  '24h': 24 * HOUR_MS,
  '48h': 48 * HOUR_MS,
  '7d': 7 * DAY_MS,
  todos: null,
};

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: WipesPayload };

export function WipeBoard() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [toast, setToast] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // El reloj de la lista va lento a propósito: los relativos son en minutos.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/wipes');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.detail || json?.error || `error ${res.status}`);
      }
      setState({ status: 'ready', data: json as WipesPayload });
      setNowMs(Date.now());
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'error desconocido',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const servers = state.status === 'ready' ? state.data.servers : [];

  const regions = useMemo(
    () => [...new Set(servers.map((s) => s.region).filter(Boolean) as string[])].sort(),
    [servers],
  );

  const visible = useMemo(
    () => servers.filter((s) => matches(s, filters, nowMs)),
    [servers, filters, nowMs],
  );

  const copy = useCopyToClipboard(setToast);
  const dirty = isDirty(filters);

  return (
    <>
      <ForcedWipeCountdown
        targetMs={state.status === 'ready' ? state.data.nextForcedWipeMs : Date.now()}
      />

      <div className="rivets mx-4" aria-hidden />

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">
        {state.status === 'ready' && state.data.notice && (
          <p className="mb-4 rounded-sm border border-sulfur/30 bg-sulfur/5 px-3 py-2 text-tiny text-sulfur">
            {state.data.notice}
          </p>
        )}

        <FilterBar
          filters={filters}
          regions={regions}
          onChange={setFilters}
          resultCount={visible.length}
        />

        <div className="mt-4">
          {state.status === 'loading' && <Skeleton />}

          {state.status === 'error' && (
            <ErrorState message={state.message} onRetry={() => void load()} />
          )}

          {state.status === 'ready' && visible.length === 0 && (
            <EmptyState dirty={dirty} onClear={() => setFilters(DEFAULT_FILTERS)} />
          )}

          {state.status === 'ready' && visible.length > 0 && (
            <ul className="flex flex-col gap-2">
              {visible.map((s) => (
                <ServerCard key={s.id} server={s} nowMs={nowMs} onCopy={copy} />
              ))}
            </ul>
          )}
        </div>

        {state.status === 'ready' && (
          <footer className="mt-8 text-tiny text-ash/60">
            {state.data.count} servidores · fuente: {state.data.source} · actualizado{' '}
            {new Date(state.data.generatedAtMs).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </footer>
        )}
      </main>

      <Toast message={toast} />
    </>
  );
}

// ---------------------------------------------------------------------------

function matches(s: RustServer, f: Filters, nowMs: number): boolean {
  if (f.types.length > 0 && !f.types.includes(s.type)) return false;
  if (f.region !== 'todas' && s.region !== f.region) return false;
  if (f.minMaxPlayers > 0 && (s.maxPlayers ?? 0) < f.minMaxPlayers) return false;

  if (f.query.trim()) {
    const q = f.query.trim().toLowerCase();
    const hay = `${s.name} ${s.community ?? ''} ${s.region ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  const win = WINDOW_MS[f.window];
  if (win !== null) {
    if (s.nextWipeMs === null) return false;
    if (s.nextWipeMs - nowMs > win) return false;
  }

  return true;
}

function isDirty(f: Filters): boolean {
  return (
    f.types.length > 0 ||
    f.window !== 'todos' ||
    f.region !== 'todas' ||
    f.minMaxPlayers > 0 ||
    f.query.trim() !== ''
  );
}

function useCopyToClipboard(setToast: (m: string | null) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    async (text: string, _label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setToast('copiado');
      } catch {
        setToast('tu navegador no ha dejado copiar');
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), 1800);
    },
    [setToast],
  );
}

function Toast({ message }: { message: string | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4"
    >
      {message && (
        <p className="stencil rounded-sm border border-oxide bg-sheet px-4 py-2 text-oxide-bright shadow-plate">
          {message}
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-busy="true" aria-label="cargando servidores">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="plate h-[104px] animate-pulse rounded-sm motion-reduce:animate-none" />
      ))}
    </ul>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="plate rounded-sm p-6">
      <h2 className="font-display text-head text-oxide-bright">no se ha podido cargar la lista</h2>
      <p className="mt-2 text-base text-ash">
        el servidor respondió: <span className="text-bone">{message}</span>
      </p>
      <p className="mt-2 text-base text-ash">
        si acabas de tocar <code className="text-bone">.env.local</code>, reinicia{' '}
        <code className="text-bone">npm run dev</code>. si no, es la api externa: prueba otra vez en
        un minuto.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="stencil mt-4 rounded-sm border border-oxide bg-oxide/10 px-3 py-2 text-oxide-bright hover:bg-oxide/20"
      >
        reintentar
      </button>
    </div>
  );
}

function EmptyState({ dirty, onClear }: { dirty: boolean; onClear: () => void }) {
  return (
    <div className="plate rounded-sm p-6 text-center">
      <h2 className="font-display text-head text-bone">ningún servidor encaja</h2>
      <p className="mt-2 text-base text-ash">
        {dirty
          ? 'los filtros están dejando fuera todo. quítalos y vuelve a mirar.'
          : 'la lista ha vuelto vacía. vuelve a cargar en un minuto.'}
      </p>
      {dirty && (
        <button
          type="button"
          onClick={onClear}
          className="stencil mt-4 rounded-sm border border-weld bg-sheet2 px-3 py-2 text-bone hover:border-oxide hover:text-oxide-bright"
        >
          quitar filtros
        </button>
      )}
    </div>
  );
}
