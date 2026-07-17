import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#05070D",
          soft: "#0A0F1C",
          card: "#0C1120",
          elevated: "#111A2E",
        },
        rise: "#E85D50",
        fall: "#2FBF8F",
        gain: "#E85D50",
        loss: "#2FBF8F",
        info: "#5B93F0",
        gold: {
          DEFAULT: "#C9A84C",
          light: "#E3C87A",
          dark: "#9A7E2F",
        },
        slate: {
          950: "#020617",
          900: "#0f172a",
          850: "#121c2e",
          800: "#1e293b",
          750: "#243447",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f1f5f9",
          50: "#f8fafc",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
        serif: [
          "var(--font-serif)",
          "Songti SC",
          "Noto Serif SC",
          "serif",
        ],
        display: [
          "var(--font-serif)",
          "Songti SC",
          "Noto Serif SC",
          "serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(91, 147, 240, 0.22)",
        "glow-gold": "0 0 28px rgba(201, 168, 76, 0.26)",
        premium: "0 18px 50px rgba(0, 0, 0, 0.55)",
        card: "0 10px 34px rgba(0, 0, 0, 0.34)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-premium":
          "linear-gradient(135deg, #2F66C4 0%, #4C83E8 100%)",
        "gradient-gold":
          "linear-gradient(135deg, #DFC06B 0%, #C9A84C 55%, #B8933D 100%)",
        "gradient-dark":
          "radial-gradient(1100px 620px at 12% -8%, rgba(47,102,196,0.16), transparent 60%), radial-gradient(900px 560px at 88% 4%, rgba(201,168,76,0.08), transparent 58%), radial-gradient(760px 700px at 50% 110%, rgba(88,60,180,0.10), transparent 62%), #05070D",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        shimmer: "shimmer 2s infinite linear",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 18px rgba(201, 168, 76, 0.16)" },
          "50%": { boxShadow: "0 0 32px rgba(201, 168, 76, 0.34)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
