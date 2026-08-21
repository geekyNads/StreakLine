import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF7",
        ink: "#14171A",
        graphite: "#6B7280",
        hairline: "#E4E2DC",
        grid: {
          0: "#EBEDF0",
          1: "#9BE9A8",
          2: "#40C463",
          3: "#30A14E",
          4: "#216E39"
        }
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      letterSpacing: {
        tightest: "-0.03em"
      }
    }
  },
  plugins: []
};

export default config;
