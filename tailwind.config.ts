import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.06)",
        glow: "0 0 20px rgba(255, 255, 255, 0.15)",
        "glow-accent": "0 0 20px rgba(16, 185, 129, 0.2)"
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    }
  },
  plugins: []
};
export default config;
