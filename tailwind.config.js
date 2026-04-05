/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: '#fdfbf7',
        pencil: '#2d2d2d',
        erased: '#e5e0d8',
        marker: '#ff4d4d',
        pen: '#2d5da1',
        postit: '#fff9c4',
        'paper-dark': '#1e1e1e',
        'pencil-dark': '#e0ddd5',
        'erased-dark': '#333333',
      },
      fontFamily: {
        heading: ['Kalam', 'cursive'],
        body: ['Patrick Hand', 'cursive'],
      },
      boxShadow: {
        hard: '4px 4px 0px 0px #2d2d2d',
        'hard-lg': '8px 8px 0px 0px #2d2d2d',
        'hard-sm': '2px 2px 0px 0px #2d2d2d',
        'hard-dark': '4px 4px 0px 0px #e0ddd5',
        'hard-lg-dark': '8px 8px 0px 0px #e0ddd5',
        'hard-sm-dark': '2px 2px 0px 0px #e0ddd5',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '70%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        'confirmation-pulse': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 180ms ease-out',
        'slide-in-up': 'slide-in-up 180ms ease-out',
        shake: 'shake 200ms ease-out',
        'confirmation-pulse': 'confirmation-pulse 300ms ease-out',
      },
    },
  },
  plugins: [],
}
