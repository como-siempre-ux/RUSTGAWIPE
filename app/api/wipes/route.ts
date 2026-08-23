import { NextResponse } from 'next/server';

import { getWipes } from '@/lib/sources';

/**
 * Devuelve los servidores ya normalizados y ordenados. El cliente no ve nunca
 * el JSON crudo de la fuente externa, ni las credenciales.
 */
export const revalidate = 300; // 5 minutos: los wipes no cambian cada segundo.

export async function GET() {
  try {
    const data = await getWipes(Date.now());
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error desconocido';
    return NextResponse.json(
      {
        error: 'no se ha podido cargar la lista de servidores',
        detail,
      },
      { status: 502 },
    );
  }
}
