import Image from 'next/image';

/**
 * GitHub Pages publica el proyecto bajo /<repo>/, y con `images.unoptimized`
 * (obligatorio en el export estático) `next/image` NO antepone el `basePath`
 * al `src`: lo deja tal cual y la imagen da 404. Hay que ponerlo a mano.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Portada del sitio.
 *
 * El original vive en la carpeta `Imagenes/` del proyecto y se publica desde
 * `public/imagenes/portada.png`, que es lo que Next sirve como estático.
 *
 * Va al lado del countdown, no detrás: puesta de fondo había que taparla con
 * tanto degradado para que las cifras se leyeran que no se veía la imagen.
 * Aquí se ve entera, y el borde izquierdo se funde con el fondo para que no
 * parezca un rectángulo pegado encima.
 */
export function Portada() {
  return (
    <figure className="relative m-0 aspect-[16/10] w-full overflow-hidden rounded-sm border border-weld shadow-plate sm:aspect-[16/9] md:aspect-[4/3]">
      <Image
        src={`${BASE_PATH}/imagenes/portada.png`}
        alt="Portada de RUSTGAWIPE: un superviviente de Rust al atardecer."
        fill
        priority
        sizes="(max-width: 768px) 100vw, 40vw"
        className="object-cover object-[50%_22%]"
      />

      {/* Funde el borde izquierdo con el fondo, hacia el countdown. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-hollow via-hollow/25 to-transparent md:via-hollow/10"
      />

      {/* Tinte de óxido: la foto es cálida, pero no debe cantar frente a la paleta. */}
      <div aria-hidden className="absolute inset-0 bg-oxide/15 mix-blend-color" />

      {/* Viñeta inferior, para que enganche con los remaches de abajo. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-hollow/80 to-transparent" />
    </figure>
  );
}
