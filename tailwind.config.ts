import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neer: {
          bg: '#050816',
          bg2: '#070D18',
          panel: 'rgba(10, 16, 28, 0.72)',
          panelStrong: '#0A1020',
          line: 'rgba(255,255,255,0.08)',
          text: '#EAF0FF',
          muted: '#A7B3C7',
          blue: '#5B8CFF',
          gold: '#D9B56E',
          emerald: '#36D399',
          red: '#FF6B6B'
        }
      },
      boxShadow: {
        soft: '0 20px 60px rgba(3, 10, 27, 0.35)',
        premium: '0 24px 90px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
        glow: '0 0 0 1px rgba(91,140,255,0.22), 0 0 50px rgba(91,140,255,0.14)'
      },
      backgroundImage: {
        aurora: 'radial-gradient(circle at 12% 20%, rgba(91,140,255,0.22), transparent 28%), radial-gradient(circle at 75% 15%, rgba(217,181,110,0.18), transparent 22%), radial-gradient(circle at 64% 78%, rgba(54,211,153,0.13), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
        grid: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)'
      },
      keyframes: {
        drift: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(0,-16px,0) scale(1.03)' } },
        shimmer: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '100% 50%' } },
        glow: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.85' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(18px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }
      },
      animation: {
        drift: 'drift 12s ease-in-out infinite',
        shimmer: 'shimmer 10s linear infinite',
        glow: 'glow 6s ease-in-out infinite',
        marquee: 'marquee 24s linear infinite',
        fadeUp: 'fadeUp 0.8s ease both'
      },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' },
      fontFamily: { sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
};
export default config;
