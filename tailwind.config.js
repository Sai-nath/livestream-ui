/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'rgb(var(--background))',
          darker: 'rgb(var(--background-darker))',
          card: 'rgb(var(--background-card))',
        },
        text: {
          primary: 'rgb(var(--text-primary))',
          secondary: 'rgb(var(--text-secondary))',
        },
        accent: {
          blue: 'rgb(var(--accent-blue))',
          pink: 'rgb(var(--accent-pink))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(to bottom, rgb(var(--background)), rgb(var(--background-darker)))',
      },
    },
  },
  plugins: [
    forms,
  ],
}
