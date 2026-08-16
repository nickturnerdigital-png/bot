import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        risk: {
          ok: "#16a34a",
          tight: "#d97706",
          missed: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};

export default config;
