/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        display: ['"ZCOOL KuaiLe"', 'sans-serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        cream: {
          50: '#FEFBF5',
          100: '#FDF6EC',
          200: '#F9E8CC',
        },
        pet: {
          orange: '#F4A261',
          orangeLight: '#F8C089',
          orangeDark: '#E0893E',
          mint: '#2A9D8F',
          mintLight: '#6FBFB4',
          mintDark: '#1F7A6E',
          coral: '#E76F51',
          coralLight: '#EF997E',
          coralDark: '#C75A3D',
          slate: '#264653',
          slateLight: '#547A87',
          amber: '#E9C46A',
          amberLight: '#F2DB96',
        }
      },
      boxShadow: {
        'soft': '0 4px 24px -8px rgba(38, 70, 83, 0.12)',
        'softer': '0 2px 12px -4px rgba(38, 70, 83, 0.08)',
        'glow-orange': '0 0 24px -4px rgba(244, 162, 97, 0.4)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'breathe': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(244, 162, 97, 0.4)' },
          '50%': { boxShadow: '0 0 24px 8px rgba(244, 162, 97, 0.15)' },
        },
        'flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        'shake': 'shake 0.4s ease-in-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'breathe': 'breathe 2.5s ease-in-out infinite',
        'flow': 'flow 2s linear infinite',
      },
    },
  },
  plugins: [],
};
