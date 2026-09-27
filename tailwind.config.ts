import type { Config } from "tailwindcss";

// Cores da marca (cardápio oficial) como variáveis CSS: o painel usa o tema escuro
// e a caixa de login usa o tema claro (.tema-claro em globals.css).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // superfícies: 100 = fundo da página, 50 = cartões, 200 = realces, 300 = bordas
        creme: { 50: v("creme-50"), 100: v("creme-100"), 200: v("creme-200"), 300: v("creme-300") },
        // texto: 900 = principal, 700 = secundário, 500/400 = apoio
        cacau: { 400: v("cacau-400"), 500: v("cacau-500"), 700: v("cacau-700"), 900: v("cacau-900") },
        dourado: { 400: v("dourado-400"), 500: v("dourado-500"), 600: v("dourado-600") },
        coral: { 400: v("coral-400"), 500: v("coral-500"), 600: v("coral-600") },
        pedidosya: "#FA0050",
      },
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
