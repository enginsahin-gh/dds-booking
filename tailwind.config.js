/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        violet: {
          50: '#F2F4F8',
          100: '#E6EAF1',
          200: '#CDD5E3',
          300: '#B4C0D6',
          400: '#7B8AA8',
          500: '#3B4E6C',
          600: '#2B3C57',
          700: '#22324A',
          800: '#1A2638',
          900: '#111B2C',
        },
      },
    },
  },
};
