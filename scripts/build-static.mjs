/**
 * Lanza `next build` en modo estático.
 *
 * Va en un script en vez de `BUILD_STATIC=1 next build` porque esa sintaxis no
 * funciona en cmd ni en PowerShell, y este proyecto se desarrolla en Windows.
 */
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, BUILD_STATIC: '1' },
});
process.exit(r.status ?? 1);
