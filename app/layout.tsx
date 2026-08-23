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

/**
 * La web se comparte por WhatsApp y Discord, y ahí lo primero que ve la gente
 * es la tarjeta del enlace, no la web. Sin estas etiquetas se pega como un
 * texto pelado.
 *
 * `metadataBase` tiene que ser absoluta: las apps de mensajería no resuelven
 * rutas relativas. Sale del entorno para que valga igual en local, en Pages y
 * en cualquier otro sitio.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://como-siempre-ux.github.io/RUSTGAWIPE/';

const TITULO = 'RUSTGAWIPE — ¿qué servidores de rust wipean pronto?';
const DESCRIPCION =
  'los servidores de rust ordenados por lo que falta para su próximo wipe, con cuenta atrás al forced wipe mensual. filtros por tipo, región, tamaño de grupo y mapa recién estrenado.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: SITE_URL,
    siteName: 'RUSTGAWIPE',
    title: TITULO,
    description: DESCRIPCION,
    images: [
      {
        url: 'imagenes/portada.png',
        width: 1672,
        height: 941,
        alt: 'RUSTGAWIPE: un superviviente de Rust al atardecer.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['imagenes/portada.png'],
  },
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
