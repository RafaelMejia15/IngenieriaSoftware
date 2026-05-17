/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Legacy brand colors replaced by purple spectrum
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Surface palette → deep zinc
        surface: {
          50:  '#09090b',   // main background
          100: '#18181b',   // card/modal bg
          200: '#27272a',   // elevated surface
          300: '#3f3f46',   // borders
          400: '#52525b',   // muted borders
          500: '#71717a',   // muted text
          600: '#a1a1aa',   // secondary text
          700: '#d4d4d8',
          800: '#e4e4e7',
          900: '#f4f4f5',   // primary text
          950: '#fafafa',   // white text
        },
      }
    },
  },
  plugins: [],
}