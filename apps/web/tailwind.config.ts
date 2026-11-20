import type { Config } from "tailwindcss";

// Mobile-first utilities mirroring the CSS tokens in globals.css: two canvas
// tracks, one pill button vocabulary, thin display type and light-track greens.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        canvas: "#fbfbf5",
        night: "#000000",
        "night-elevated": "#0a0a0a",
        ink: "#000000",
        muted: "#52525b",
        aloe: "#c1fbd4",
        pistachio: "#d4f9e0",
        hairline: "#e4e4e7",
      },
      fontFamily: {
        display: ['"Inter Display"', "Helvetica", "Arial", "sans-serif"],
        body: ['"Inter Variable"', "Inter", "Helvetica", "Arial", "sans-serif"],
        code: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      spacing: {
        1: "2px",
        2: "4px",
        3: "8px",
        4: "12px",
        5: "16px",
        6: "24px",
        7: "32px",
        8: "64px",
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        lg: "12px",
        xl: "20px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 8px 8px rgba(0,0,0,0.1), 0 4px 4px rgba(0,0,0,0.1), 0 2px 2px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.1)",
        dark: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(255,255,255,0.05)",
        modal: "0 25px 50px -12px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
