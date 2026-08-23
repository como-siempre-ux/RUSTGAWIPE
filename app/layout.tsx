import type { Metadata, Viewport } from 'next';
import { Barlow, Oswald } from 'next/font/google';

import './globals.css';

/**
 * Dos tipografías, dos roles y ninguno más.
 * Oswald: condensada e industrial, para cifras, countdown y nombres.
 * Barlow: grotesca utilitaria, para el cuerpo y los copys.
 */
const display = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RUSTGAWIPE — ¿qué servidores de rust wipean pronto?',
  description:
    'lista de servidores de rust ordenada por proximidad del próximo wipe, con countdown al forced wipe mensual.',
};

export const viewport: Viewport = {
  themeColor: '#0D0A08',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
