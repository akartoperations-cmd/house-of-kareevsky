import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm Luxury Palette
        cream: {
          50: "#fefcfb",
          100: "#fdf8f4",
          200: "#faf0e6",
          300: "#f5e4d3",
          400: "#eed8c0",
          500: "#e5c9a8",
        },
        sand: {
          50: "#faf9f7",
          100: "#f5f3f0",
          200: "#ebe8e2",
          300: "#dcd8ce",
          400: "#c9c3b6",
          500: "#b3ab9a",
        },
        bronze: {
          50: "#fdf8f5",
          100: "#faede3",
          200: "#f5d9c7",
          300: "#edc0a5",
          400: "#e2a17d",
          500: "#d48a5c",
        },
        gold: {
          50: "#fffef7",
          100: "#fffceb",
          200: "#fff7d3",
          300: "#ffefb8",
          400: "#ffe496",
          500: "#ffd66b",
        },
        charcoal: {
          50: "#f7f7f7",
          100: "#e8e8e8",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#6d6d6d",
          600: "#5d5d5d",
          700: "#4f4f4f",
          800: "#454545",
          900: "#3d3d3d",
        },
      },
      fontFamily: {
        heading: ["Playfair Display", "serif"],
        body: ["Merriweather", "serif"],
        elegant: ["Cormorant Garamond", "serif"],
        modern: ["Inter", "sans-serif"],
        fashion: ["Montserrat", "sans-serif"],
        retro: ["Courier Prime", "monospace"],
        ui: ["Inter", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.5s ease-out",
        "sparkle": "sparkle 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        sparkle: {
          "0%": { transform: "scale(0) rotate(0deg)", opacity: "1" },
          "50%": { transform: "scale(1.2) rotate(180deg)", opacity: "1" },
          "100%": { transform: "scale(0) rotate(360deg)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

