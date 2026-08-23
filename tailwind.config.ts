import type { Config } from 'tailwindcss';

/**
 * Sistema de tokens.
 *
 * Rust es óxido, chapa, escasez y un reloj corriendo. La paleta sale de
 * materiales del propio juego, no de una plantilla de dashboard:
 *
 *   hollow  hollín, el fondo de un búnker de chapa sin luz
 *   sheet   plancha de metal sin pintar (superficies)
 *   weld    soldadura (líneas y bordes)
 *   oxide   óxido (acento primario, marca)
 *   ember   brasa (urgencia: sólo countdown y "wipea ya")
 *   bone    hueso / saco (texto)
 *   ash     ceniza (texto secundario)
 *
 * Los badges de tipo también son materiales: acero (oficial), óxido
 * (comunidad), azufre (modded).
 *
 * Tipografía, dos roles y ninguno más:
 *   Oswald  condensada e industrial -> cifras, countdown, nombres, badges
 *   Barlow  grotesca utilitaria     -> cuerpo, copys, etiquetas
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hollow: '#0D0A08',
        sheet: '#17120F',
        sheet2: '#1F1813',
        weld: '#2A211C',
        oxide: {
          DEFAULT: '#B4441F',
          dim: '#7E2F15',
          bright: '#D65A2E',
        },
        ember: '#F0821E',
        bone: '#EDE4D8',
        ash: '#97897A',
        steel: '#7C93A6',
        sulfur: '#C8A227',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Oswald', 'Impact', 'sans-serif'],
        body: ['var(--font-body)', 'Barlow', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
        tiny: ['0.75rem', { lineHeight: '1.1rem' }],
        base: ['0.9375rem', { lineHeight: '1.4rem' }],
        lead: ['1.125rem', { lineHeight: '1.6rem' }],
        head: ['1.5rem', { lineHeight: '1.7rem' }],
        clock: ['clamp(3rem, 17vw, 6.5rem)', { lineHeight: '0.85', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        plate: '0 1px 0 0 rgba(237,228,216,0.04) inset, 0 12px 28px -18px rgba(0,0,0,0.9)',
      },
      keyframes: {
        tick: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
      },
      animation: {
        tick: 'tick 1s steps(1, end) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
