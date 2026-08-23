'use client';

import { useMemo } from 'react';

import { HOUR_MS, formatRelative } from '@/lib/time';
import type { RustServer, WipeConfidence } from '@/lib/types';

const TYPE_LABEL: Record<RustServer['type'], string> = {
  official: 'oficial',
  community: 'comunidad',
  modded: 'modded',
  unknown: 'sin clasificar',
};

/** Cada tipo, un material: acero, óxido, azufre. */
const TYPE_STYLE: Record<RustServer['type'], string> = {
  official: 'text-steel border-steel/40 bg-steel/10',
  community: 'text-oxide-bright border-oxide/40 bg-oxide/10',
  modded: 'text-sulfur border-sulfur/40 bg-sulfur/10',
  unknown: 'text-ash border-weld bg-weld/40',
};

const EDGE: Record<RustServer['type'], string> = {
  official: 'before:bg-steel',
  community: 'before:bg-oxide',
  modded: 'before:bg-sulfur',
  unknown: 'before:bg-weld',
};

const CONFIDENCE_LABEL: Record<WipeConfidence, string> = {
  confirmado: 'confirmado',
  programado: 'programado',
  estimado: 'estimado',
  desconocido: 'sin datos',
};

const CONFIDENCE_STYLE: Record<WipeConfidence, string> = {
  confirmado: 'text-bone',
  programado: 'text-steel',
  estimado: 'text-ash',
  desconocido: 'text-ash/70',
};

export function ServerCard({
  server,
  nowMs,
  onCopy,
}: {
  server: RustServer;
  nowMs: number;
  onCopy: (text: string, label: string) => void;
}) {
  const next = server.nextWipeMs;
  const urgent = next !== null && next - nowMs < 6 * HOUR_MS;

  const absolute = useMemo(
    () =>
      next === null
        ? null
        : new Date(next).toLocaleString('es-ES', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
    [next],
  );

  return (
    <li
      className={[
        'plate relative overflow-hidden rounded-sm p-3 pl-4 sm:p-4 sm:pl-5',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[""]',
        EDGE[server.type],
        urgent ? 'ring-1 ring-ember/35' : '',
      ].join(' ')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        {/* Identidad */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`stencil rounded-sm border px-1.5 py-0.5 ${TYPE_STYLE[server.type]}`}>
              {TYPE_LABEL[server.type]}
            </span>
            {server.community && (
              <span className="stencil text-ash/80">{server.community}</span>
            )}
            {server.region && <span className="stencil text-ash/60">{server.region}</span>}
          </div>

          <h3 className="mt-1.5 font-display text-lead font-medium leading-tight text-bone">
            {server.url ? (
              <a
                href={server.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-oxide-bright"
              >
                {server.name}
              </a>
            ) : (
              server.name
            )}
          </h3>

          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-tiny text-ash">
            <Fact label="jugadores">
              <span className="tnum text-bone">{server.players ?? '—'}</span>
              <span className="text-ash">/{server.maxPlayers ?? '—'}</span>
              {server.source === 'catalog' && <span className="text-ash/60"> (típico)</span>}
            </Fact>

            <Fact label="último wipe">
              {server.lastWipeMs ? formatRelative(server.lastWipeMs, nowMs) : 'sin datos'}
            </Fact>

            {server.mapSize && (
              <Fact label="mapa">
                <span className="tnum">{server.mapSize}</span>
                {server.mapSeed && <span className="text-ash/70"> · seed {server.mapSeed}</span>}
              </Fact>
            )}
          </dl>
        </div>

        {/* Wipe */}
        <div className="shrink-0 sm:w-60 sm:text-right">
          <p
            className={`font-display text-head font-semibold leading-none tnum ${
              urgent ? 'text-ember' : next === null ? 'text-ash/60' : 'text-bone'
            }`}
          >
            {next === null ? 'sin fecha' : `wipea ${formatRelative(next, nowMs)}`}
          </p>

          <p className="mt-1 text-tiny text-ash">{absolute ?? 'no se puede estimar'}</p>

          <p
            className={`stencil mt-1.5 inline-flex items-center gap-1 ${CONFIDENCE_STYLE[server.confidence]}`}
            title={server.wipeExplanation}
          >
            <Dot confidence={server.confidence} />
            {CONFIDENCE_LABEL[server.confidence]}
            <span className="sr-only"> — {server.wipeExplanation}</span>
          </p>

          <div className="mt-3">
            {server.connect ? (
              <button
                type="button"
                onClick={() => onCopy(`client.connect ${server.connect}`, server.name)}
                className="stencil w-full rounded-sm border border-weld bg-sheet2 px-3 py-2 text-bone transition-colors hover:border-oxide hover:text-oxide-bright sm:w-auto"
              >
                copiar conexión
              </button>
            ) : (
              <p className="text-tiny text-ash/60">
                sin ip en este modo
                {server.url && (
                  <>
                    {' · '}
                    <a
                      href={server.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-weld underline-offset-2 hover:text-oxide-bright"
                    >
                      web
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="stencil text-ash/60">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Dot({ confidence }: { confidence: WipeConfidence }) {
  const color =
    confidence === 'confirmado'
      ? 'bg-bone'
      : confidence === 'programado'
        ? 'bg-steel'
        : confidence === 'estimado'
          ? 'bg-ash'
          : 'bg-weld';
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}
