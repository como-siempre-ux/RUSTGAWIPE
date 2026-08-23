import { NextResponse } from 'next/server';

import { getWipes } from '@/lib/sources';

/**
 * Devuelve los servidores ya normalizados y ordenados. El cliente no ve nunca
 * el JSON crudo de la fuente externa, ni las credenciales.
 */
export const revalidate = 300; // 5 minutos: los wipes no cambian cada segundo.

export async function GET() {
  /**
   * En el sitio estático esta ruta no sirve para nada: el cliente lee
   * `data/servers.json`. Pero Next la prerrenderiza durante el build, y eso
   * significaba llamar a Steam con la clave dentro del proceso de build para
   * generar un fichero que nadie va a leer. Se corta aquí: menos superficie
   * por donde pueda escaparse una credencial, y una llamada menos a la API.
   */
  if (process.env.BUILD_STATIC === '1') {
    return NextResponse.json(
      { error: 'en el sitio estático los datos están en /data/servers.json' },
      { status: 404 },
    );
  }

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
