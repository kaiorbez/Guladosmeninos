import type { Config } from "tailwindcss";

// Paleta tirada do cardápio oficial da Gula dos Meninos.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        creme: { 50: "#FDF9F3", 100: "#F8F0E5", 200: "#F0E2CF", 300: "#E5CFB2" },
        cacau: { 400: "#8A6A55", 500: "#6B4E3D", 700: "#4A3226", 900: "#2E1F17" },
        dourado: { 400: "#CFA35E", 500: "#B8863B", 600: "#96692A" },
        coral: { 400: "#F08A70", 500: "#E8735A", 600: "#CC5A42" },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Nunito Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
