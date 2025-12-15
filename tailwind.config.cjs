/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#f8f4ed",
          100: "#e9e0d0",
        },
        sage: {
          100: "#dce7dc",
          300: "#9fb6a2",
          500: "#6c8c72",
        },
      },
      borderRadius: {
        lg: "14px",
      },
      boxShadow: {
        soft: "0 10px 35px rgba(16, 24, 40, 0.07)",
      },
    },
  },
  plugins: [],
};
