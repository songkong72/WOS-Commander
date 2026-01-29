/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ice: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: "#082f49",
        },
        brand: {
          dark: "#020617", // Deep night background
          accent: "#38bdf8", // Clear ice blue
          header: "#0f172a", // Dark header
        },
        txt: {
          primary: "#ffffff",
          secondary: "#94a3b8",
          accent: "#7dd3fc",
        },
        frost: {
          500: 'rgba(255, 255, 255, 0.1)',
          600: 'rgba(255, 255, 255, 0.2)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
