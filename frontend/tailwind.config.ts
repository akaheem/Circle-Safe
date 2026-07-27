import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Savanna Trust palette
        primary: { DEFAULT: "#0FA968", light: "#34E0A1", dark: "#0B8452" },
        accent: { DEFAULT: "#F5B301", dark: "#D99A00" },
        ink: "#07231B",
        surface: "#F4FAF7",
        line: "#E4EFE9",
        body: "#1C2B27",
        muted: "#5C7268",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-space-grotesk)", "sans-serif"],
      },
      boxShadow: {
        card: "0 18px 40px -24px rgba(20,40,30,.28)",
        glow: "0 10px 24px -8px rgba(15,169,104,.55)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up .6s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
