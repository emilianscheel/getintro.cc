import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./entrypoints/**/*.{html,ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(0 0% 90%)",
        input: "hsl(0 0% 94%)",
        ring: "hsl(0 0% 8%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(0 0% 8%)",
        primary: {
          DEFAULT: "hsl(0 0% 8%)",
          foreground: "hsl(0 0% 98%)"
        },
        muted: {
          DEFAULT: "hsl(0 0% 96%)",
          foreground: "hsl(0 0% 45%)"
        }
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.625rem",
        sm: "0.5rem"
      },
      boxShadow: {
        card: "0 12px 40px rgba(0,0,0,0.2)",
        soft: "0 8px 20px rgba(0,0,0,0.12)"
      }
    }
  },
  plugins: []
} satisfies Config;
