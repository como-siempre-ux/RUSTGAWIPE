'use client';

import { useEffect, useState } from 'react';

import { countdownParts } from '@/lib/time';

/**
 * El único elemento memorable de la página. Es el dato por el que la gente
 * abre esto: cuánto queda para el forced wipe.
 */
export function ForcedWipeCountdown({ targetMs }: { targetMs: number }) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  // El reloj arranca en cliente para que servidor y cliente pinten lo mismo
  // en el primer render y no salte un error de hidratación.
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = countdownParts(targetMs, nowMs ?? targetMs);
  const ready = nowMs !== null;
  const absolute = new Date(targetMs);

  return (
    <section aria-label="cuenta atrás para el forced wipe" className="pb-6 pt-2">
      <p className="stencil text-oxide-bright">próximo forced wipe</p>

      <div
        className="mt-3 flex items-start gap-2 sm:gap-4 tnum font-display text-clock font-semibold text-ember"
        role="timer"
        aria-live="off"
      >
        {/*
          Mientras no hay reloj se pinta la misma estructura con guiones, para
          que no haya salto de layout al llegar la primera cifra.
        */}
        <Unit value={ready ? parts.days : null} label="días" />
        <Sep />
        <Unit value={ready ? parts.hours : null} label="horas" pad />
        <Sep />
        <Unit value={ready ? parts.minutes : null} label="min" pad />
        <span className="hidden sm:contents">
          <Sep />
          <Unit value={ready ? parts.seconds : null} label="seg" pad muted />
        </span>
      </div>

      <p className="mt-3 text-tiny text-ash">
        {ready ? (
          <>
            <time dateTime={absolute.toISOString()}>
              {absolute.toLocaleString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>{' '}
            en tu hora local · primer jueves de mes, 19:00 UTC
          </>
        ) : (
          'calculando…'
        )}
      </p>
    </section>
  );
}

function Unit({
  value,
  label,
  pad = false,
  muted = false,
}: {
  /** `null` mientras el reloj del cliente todavía no ha arrancado. */
  value: number | null;
  label: string;
  pad?: boolean;
  muted?: boolean;
}) {
  const text = value === null ? '––' : pad ? String(value).padStart(2, '0') : String(value);
  return (
    <span className="flex flex-col items-center leading-none">
      <span className={value === null ? 'text-weld' : muted ? 'text-ember/55' : undefined}>
        {text}
      </span>
      <span className="stencil mt-2 text-ash">{label}</span>
    </span>
  );
}

/**
 * El separador va en la misma estructura de dos filas que `Unit` para que la
 * línea base de los dos puntos cuadre con la de las cifras. Con una etiqueta
 * invisible debajo, las columnas miden lo mismo y la fila no se estira.
 */
function Sep() {
  return (
    <span aria-hidden className="flex flex-col items-center leading-none text-oxide/80">
      <span className="animate-tick motion-reduce:animate-none">:</span>
      <span className="stencil mt-2 invisible">·</span>
    </span>
  );
}
