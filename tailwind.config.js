import containerQueries from '@tailwindcss/container-queries'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        subtle: 'rgb(var(--c-subtle) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        sage: {
          DEFAULT: 'rgb(var(--c-sage) / <alpha-value>)',
          50: 'rgb(var(--c-sage-50) / <alpha-value>)',
          100: 'rgb(var(--c-sage-100) / <alpha-value>)',
          600: 'rgb(var(--c-sage-600) / <alpha-value>)',
          700: 'rgb(var(--c-sage-700) / <alpha-value>)',
        },
        coral: {
          DEFAULT: 'rgb(var(--c-coral) / <alpha-value>)',
          50: 'rgb(var(--c-coral-50) / <alpha-value>)',
          600: 'rgb(var(--c-coral-600) / <alpha-value>)',
        },
        success: 'rgb(var(--c-success) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(41,41,41,0.04), 0 8px 24px -16px rgba(41,41,41,0.12)',
        lift: '0 2px 6px rgba(41,41,41,0.05), 0 18px 40px -24px rgba(41,41,41,0.22)',
        soft: '0 1px 2px rgba(41,41,41,0.04)',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { transform: 'scaleY(1) rotate(-1deg)' },
          '50%': { transform: 'scaleY(1.06) rotate(1deg)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.86)' },
          '60%': { opacity: '1', transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.5' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        flicker: 'flicker 1.8s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out both',
        'fade-in': 'fade-in 0.3s ease-out both',
        pop: 'pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'slide-in': 'slide-in 0.3s ease-out both',
        'pulse-ring': 'pulse-ring 2.4s ease-out infinite',
        'spin-slow': 'spin-slow 1s linear infinite',
      },
    },
  },
  plugins: [containerQueries],
}
