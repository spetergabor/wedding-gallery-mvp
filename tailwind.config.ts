import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        paper: "#f8f7f4",
        mist: "#ece8df",
        graphite: "#3d3a35",
        sage: "#7b8b7a",
        brass: "#a98952"
      },
      boxShadow: {
        soft: "0 24px 70px rgba(23, 23, 23, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
