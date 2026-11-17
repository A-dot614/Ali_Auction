import type { Config } from "tailwindcss";

// Mobile-first utility layout (D7). Visual tokens are placeholders pending design review.
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
    },
  },
  plugins: [],
} satisfies Config;
