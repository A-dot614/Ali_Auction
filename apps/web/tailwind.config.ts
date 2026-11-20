import type { Config } from "tailwindcss";

// Mobile-first utility layout. The design-system scale lives in globals.css;
// these utilities mirror the same values for Tailwind consumers.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        canvas: "#f7f5ef",
        ink: "#1d2430",
        accent: "#0f766e",
      },
      spacing: {
        1: "0.25rem",
        2: "0.5rem",
        3: "0.75rem",
        4: "1rem",
        5: "1.5rem",
        6: "2rem",
      },
      borderRadius: {
        sm: "8px",
        md: "16px",
      },
    },
  },
  plugins: [],
} satisfies Config;
