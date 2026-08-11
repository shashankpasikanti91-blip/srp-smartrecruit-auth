/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Calibri', 'Carlito', 'Segoe UI', 'sans-serif'],
        display: ['Times New Roman', 'Times', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          50: '#FCFCFA',
          100: '#ecfdf3',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#166534',
          600: '#166534',
          700: '#14532d',
          800: '#0B1F14',
          900: '#0B1F14',
        },
        srp: {
          forest: '#0B1F14',
          green: '#166534',
          orange: '#F97316',
          canvas: '#FCFCFA',
        },
        marketing: {
          black: '#0B1F14',
          navy: '#0B1F14',
          'navy-mid': '#102418',
          'navy-light': '#163022',
          cyan: '#F97316',
          violet: '#166534',
          emerald: '#22C55E',
        },
      },
      fontSize: {
        'display-xl': ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(2rem, 4vw, 3.25rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        'marketing-glow': '0 0 40px rgba(249, 115, 22, 0.12), 0 0 80px rgba(22, 101, 52, 0.1)',
        'marketing-card': '0 4px 24px rgba(11, 31, 20, 0.18), 0 0 0 1px rgba(255,255,255,0.06)',
        'cinematic-glow': '0 0 80px rgba(22, 101, 52, 0.22), 0 0 120px rgba(249, 115, 22, 0.08)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #0B1F14 0%, #166534 55%, #0B1F14 100%)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
