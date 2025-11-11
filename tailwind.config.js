/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        purple: {
          600: '#7C3AED', // Main purple color
          700: '#6D28D9', // Darker purple
          800: '#5B21B6', // Even darker purple
        },
      },
    },
  },
  plugins: [],
  darkMode: 'media',
};
