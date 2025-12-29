// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [],
  theme: {
    extend: {
      fontFamily: {
        "open-light": ["OpenSans_300Light"],
        "open-regular": ["OpenSans_400Regular"],
        "open-medium": ["OpenSans_500Medium"],
        "open-semibold": ["OpenSans_600SemiBold"],
        "open-bold": ["OpenSans_700Bold"],
        "open-extrabold": ["OpenSans_800ExtraBold"],
      },
    },
  },
  plugins: [],
};
