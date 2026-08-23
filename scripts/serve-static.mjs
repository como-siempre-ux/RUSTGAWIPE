/**
 * Sirve el export estático igual que lo hará GitHub Pages.
 *
 *   npm run preview:static
 *
 * Existe porque abrir `out/index.html` con doble clic no vale: Pages publica
 * el proyecto bajo /<repo>/, y si no se reproduce esa ruta no se comprueba
 * nada de lo que suele romperse (rutas de los chunks, de la portada, del
 * fichero de datos).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const BASE = process.env.BASE_PATH ?? '/RUSTGAWIPE';
const RAIZ = join(process.cwd(), 'out');
const PUERTO = Number(process.env.PORT ?? 4173);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(RAIZ)) {
  console.error('✗ No existe out/. Lanza antes:  npm run build:static');
  process.exit(1);
}

createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (ruta === '/' || ruta === BASE) {
    res.writeHead(302, { Location: `${BASE}/` });
    return res.end();
  }
  if (!ruta.startsWith(BASE)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(`Fuera de ${BASE}/ — en Pages esto sería un 404 igual.`);
  }

  ruta = ruta.slice(BASE.length) || '/';
  // `normalize` evita salirse de out/ con ../
  let fichero = join(RAIZ, normalize(ruta).replace(/^(\.\.[/\\])+/, ''));

  if (existsSync(fichero) && statSync(fichero).isDirectory()) {
    fichero = join(fichero, 'index.html');
  }
  if (!existsSync(fichero)) {
    const html404 = join(RAIZ, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return existsSync(html404) ? createReadStream(html404).pipe(res) : res.end('404');
  }

  res.writeHead(200, {
    'Content-Type': TIPOS[extname(fichero)] ?? 'application/octet-stream',
  });
  createReadStream(fichero).pipe(res);
}).listen(PUERTO, () => {
  console.log(`Sirviendo out/ como lo hará GitHub Pages:`);
  console.log(`  http://localhost:${PUERTO}${BASE}/`);
});
