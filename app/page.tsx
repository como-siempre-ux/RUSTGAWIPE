import { Portada } from '@/components/Portada';
import { WipeBoard } from '@/components/WipeBoard';

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      {/*
        La portada se pasa como prop en vez de renderizarla aquí arriba: así
        el hero (cabecera + countdown) sigue siendo una sola pieza y no hay
        que partir el estado del tablero en dos componentes.
      */}
      <WipeBoard
        portada={<Portada />}
        marca={
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-6">
            {/* La marca está, pero no compite: el protagonista es el countdown. */}
            <h1 className="font-display text-lead font-semibold uppercase tracking-[0.18em] text-bone">
              rust<span className="text-oxide-bright">gawipe</span>
            </h1>
            <p className="text-tiny text-ash">qué servidores de rust wipean pronto</p>
          </header>
        }
      />
    </div>
  );
}
