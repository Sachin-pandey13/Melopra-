// tailwind.config.js
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      keyframes: {
        blinkPulse: {
          '0%, 100%': { color: '#ffffff' },
          '50%': { color: '#a855f7' }, // Tailwind purple-500
        },
      },
      animation: {
        blink: 'blinkPulse 3s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};
