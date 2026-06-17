/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          50: '#EBEAFC',
          100: '#D7D5F9',
          200: '#AFABF3',
          300: '#8780ED',
          400: '#5F56E7',
          500: '#4F46E5',
          600: '#2119D1',
          700: '#1A15A6',
          800: '#13107B',
          900: '#0C0C50',
        },
      },
    },
  },
  plugins: [],
}
