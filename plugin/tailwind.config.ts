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
          foreground: "hsl(0 0% 100%)"
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
      transitionProperty: {
        "colors-and-shadows":
          "color, background-color, border-color, text-decoration-color, fill, stroke, box-shadow"
      },
      boxShadow: {
        card: "0 12px 40px rgba(0,0,0,0.2)",
        soft: "0 8px 20px rgba(0,0,0,0.12)",
        button:
          "inset 0 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 0 2px 1px rgba(255, 255, 255, 0.15), 0 8px 16px rgba(17, 24, 39, 0.1)",
        "button-hover":
          "inset 0 0 6px 1px rgba(255, 255, 255, 0.25), inset 0.5px 0.5px 1px 0.5px rgba(255, 255, 255, 0.35), 0 10px 20px rgba(17, 24, 39, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
