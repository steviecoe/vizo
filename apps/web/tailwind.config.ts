import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#b8d4ff',
          300: '#85b8ff',
          400: '#4d96ff',
          500: '#1a73ff',
          600: '#0057e6',
          700: '#0042b3',
          800: '#002e80',
          900: '#001a4d',
        },
        accent: '#ec5b13',
      },
      fontFamily: {
        sans: ['Figtree Variable', 'Figtree', 'sans-serif'],
        serif: ['Bricolage Grotesque Variable', 'Bricolage Grotesque', 'sans-serif'],
        display: ['Bricolage Grotesque Variable', 'Bricolage Grotesque', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
