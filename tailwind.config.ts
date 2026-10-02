import type { Config } from "tailwindcss";

// Cores como variáveis CSS (globals.css): mudam sozinhas entre o tema claro e o escuro (.dark).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // superfícies: 100 = fundo da página, 50 = cartões, 200 = realces, 300 = bordas
        creme: { 50: v("creme-50"), 100: v("creme-100"), 200: v("creme-200"), 300: v("creme-300") },
        // texto: 900 = principal, 700 = secundário, 500/400 = apoio
        cacau: { 400: v("cacau-400"), 500: v("cacau-500"), 700: v("cacau-700"), 900: v("cacau-900") },
        // botão principal e item ativo: chocolate no claro, dourado no escuro
        primary: { DEFAULT: v("primary"), fg: v("primary-fg") },
        dourado: { 400: v("dourado-400"), 500: v("dourado-500"), 600: v("dourado-600") },
        coral: { 400: v("coral-400"), 500: v("coral-500"), 600: v("coral-600") },
        pedidosya: "#FA0050",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
