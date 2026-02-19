/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        // Base / Body (16px) - TDS Body
        base: ['16px', { lineHeight: '1.5', letterSpacing: '-0.02em' }],
        // Small Labels (13-14px)
        sm: ['14px', { lineHeight: '1.45', letterSpacing: '-0.01em' }],
        xs: ['13px', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        // Titles
        lg: ['18px', { lineHeight: '1.4', letterSpacing: '-0.02em', fontWeight: '700' }],
        xl: ['22px', { lineHeight: '1.35', letterSpacing: '-0.02em', fontWeight: '700' }],
        '2xl': ['26px', { lineHeight: '1.3', letterSpacing: '-0.025em', fontWeight: '800' }],
        '3xl': ['32px', { lineHeight: '1.25', letterSpacing: '-0.03em', fontWeight: '800' }],
      },
      colors: {
        // Toss Bank / TDS Colors (Approximate)
        toss: {
          bg: "#F2F4F6", // Background Grey
          white: "#FFFFFF",
          blue: "#3182F6", // Tess Blue
          blueLight: "#E8F3FF",
          grey900: "#191F28", // Primary Text
          grey800: "#333D4B",
          grey700: "#4E5968",
          grey600: "#6B7684", // Secondary Text
          grey500: "#8B95A1", // Label Text
          grey400: "#B0B8C1",
          grey300: "#D1D6DB", // Borders
          grey200: "#E5E8EB",
          grey100: "#F2F4F6",
          red: "#F04452",
          redLight: "#FFDEDF",
        }
      },
      spacing: {
        '4.5': '1.125rem', // 18px
        '13': '3.25rem',   // 52px (Optimal Touch Target)
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'toss': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'toss-sm': '0 2px 8px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
