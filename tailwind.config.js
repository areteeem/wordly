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
        'slide-up-in': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down-out': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
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
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'count-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'star-burst': {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.4)' },
          '60%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        'shrink-out': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.6)', opacity: '0' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
        'progress-fill': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(600px) rotate(720deg)', opacity: '0' },
        },
        'fab-expand': {
          '0%': { transform: 'scale(0) rotate(-180deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'flip-in': {
          '0%': { transform: 'perspective(800px) rotateY(90deg)' },
          '100%': { transform: 'perspective(800px) rotateY(0deg)' },
        },
        'notification-timer': {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 4px 2px rgba(45, 93, 161, 0.3)' },
          '50%': { boxShadow: '0 0 12px 6px rgba(45, 93, 161, 0.6)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 180ms ease-out',
        'slide-in-up': 'slide-in-up 180ms ease-out',
        'slide-up-in': 'slide-up-in 300ms ease-out',
        'slide-down-out': 'slide-down-out 300ms ease-out',
        shake: 'shake 200ms ease-out',
        'confirmation-pulse': 'confirmation-pulse 300ms ease-out',
        'fade-in': 'fade-in 200ms ease-out',
        'fade-out': 'fade-out 200ms ease-out',
        'count-up': 'count-up 300ms ease-out',
        'star-burst': 'star-burst 400ms ease-out',
        'shrink-out': 'shrink-out 250ms ease-out forwards',
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
        'progress-fill': 'progress-fill 600ms ease-out',
        confetti: 'confetti 1.5s ease-out forwards',
        'fab-expand': 'fab-expand 200ms ease-out',
        'flip-in': 'flip-in 400ms ease-out',
        'notification-timer': 'notification-timer 3s linear forwards',
        'glow-pulse': 'glow-pulse 1.5s ease-in-out 3',
      },
    },
  },
  plugins: [],
}
