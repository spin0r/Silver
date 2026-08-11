import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: colors.black,
      white: colors.white,
      gray: colors.zinc, // Use zinc for darker, black-ish grays
      red: colors.rose,
      yellow: colors.amber,
      green: colors.green,
      blue: colors.sky,
      indigo: colors.indigo,
      purple: colors.purple,
      pink: colors.pink,
      teal: colors.teal,
      cyan: colors.cyan,
      orange: colors.orange,
    },
    extend: {
      colors: {
        gray: {
          850: '#222226', // Custom dark shade matching OneDrive
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}
