/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}",],
  theme: {
    extend: {
      screens: {
        "sm-landscape": {
          raw: "(max-width: 768px) and (orientation: landscape)",
        },
      },
    },
  },
  plugins: [],
}