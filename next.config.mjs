/**
 * Dos modos de build:
 *
 *   npm run build                → app con servidor (Vercel, Docker, local).
 *                                  `/api/wipes` se recalcula en cada petición.
 *
 *   BUILD_STATIC=1 npm run build → sitio estático para GitHub Pages.
 *                                  No hay servidor: los datos se cocinan en el
 *                                  build y las horas las recalcula el
 *                                  navegador (ver components/WipeBoard.tsx).
 *
 * GitHub Pages sirve un proyecto en /<repo>/, no en la raíz, así que en modo
 * estático hace falta `basePath`. Se puede cambiar con BASE_PATH por si el
 * repo se llama de otra forma o se usa un dominio propio.
 */
const isStatic = process.env.BUILD_STATIC === '1';
const basePath = isStatic ? (process.env.BASE_PATH ?? '/RUSTGAWIPE') : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  ...(isStatic
    ? {
        output: 'export',
        basePath,
        // Pages no tiene el optimizador de imágenes de Next, que necesita un
        // servidor. Sin esto el build estático falla.
        images: { unoptimized: true },
        // Cada ruta como carpeta con index.html, que es como Pages resuelve
        // las urls sin extensión.
        trailingSlash: true,
      }
    : {}),

  env: {
    // Lo lee el cliente para saber de dónde pedir los datos.
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC: isStatic ? '1' : '',
  },
};

export default nextConfig;
