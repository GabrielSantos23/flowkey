/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        island: {
          bg: "var(--color-island-bg)",
          widget: "var(--color-widget-bg)",
          primary: "var(--color-primary)",
          secondary: "var(--color-secondary)",
          textMain: "var(--color-text-main)",
          textSecond: "var(--color-text-second)",
          textThird: "var(--color-text-third)",
          success: "var(--color-success)",
          error: "var(--color-error)",
          icon: "var(--color-icon)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Cascadia Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        island: "0 10px 40px -10px rgba(0, 0, 0, 0.5)",
        notch: "0 15px 35px -5px rgba(0, 0, 0, 0.4)",
        glow: "0 0 25px -5px var(--color-primary)",
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ripple": "ripple 1.5s cubic-bezier(0, 0.2, 0.8, 1) infinite",
      },
      keyframes: {
        ripple: {
          "0%": { transform: "scale(0.8)", opacity: "1" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
