/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // Monochrome "ink" accent: calm, minimal. Status colours stay semantic (green/amber/red).
      colors: {
        brand: {
          50: "#f4f4f5",
          100: "#e4e4e7",
          500: "#71717a",
          600: "#18181b",
          700: "#000000",
        },
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" },
    },
  },
  plugins: [],
};
