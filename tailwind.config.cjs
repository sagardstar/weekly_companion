/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#faf9f6",
          100: "#e7e7dc",
        },
        sage: {
          100: "#e8eddf",
          300: "#bcc9ad",
          500: "#536b47",
          700: "#405638",
          800: "#35482e",
        },
      },
      borderRadius: {
        lg: "14px",
      },
      boxShadow: {
        soft: "0 3px 14px rgba(52, 69, 42, 0.035)",
      },
    },
  },
  plugins: [],
};
