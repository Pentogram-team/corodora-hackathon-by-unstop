/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        vault: {
          bg:      '#0f172a',
          panel:   '#0d1b2e',
          border:  '#1e293b',
          muted:   '#334155',
        },
      },
      keyframes: {
        flicker: {
          '0%,19%,21%,23%,25%,54%,56%,100%': { opacity: '1' },
          '20%,24%,55%': { opacity: '0.5' },
        },
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'pulse-glow': {
          '0%,100%': { boxShadow: '0 0 8px rgba(239,68,68,0.3)' },
          '50%':     { boxShadow: '0 0 28px rgba(239,68,68,0.7), 0 0 60px rgba(239,68,68,0.2)' },
        },
        'border-pulse': {
          '0%,100%': { borderColor: 'rgba(239,68,68,0.3)' },
          '50%':     { borderColor: 'rgba(239,68,68,0.9)' },
        },
        'slide-down': {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        flicker:       'flicker 3s infinite',
        scanline:      'scanline 4s linear infinite',
        'pulse-glow':  'pulse-glow 1.5s ease-in-out infinite',
        'border-pulse':'border-pulse 1.5s ease-in-out infinite',
        'slide-down':  'slide-down 0.2s ease-out',
        'fade-in':     'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
