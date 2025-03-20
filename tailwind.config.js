/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-gray-50',
    'border-gray-200',
    'text-gray-900',
    'text-gray-700',
    'text-gray-600',
    'hover:bg-gray-50',
    'shadow-lg',
    'rounded-xl'
  ],
  theme: {
    container: false,
    extend: {
      colors: {
        background: 'hsl(0, 0%, 100%)',
        foreground: 'hsl(222.2, 84%, 4.9%)',
        primary: 'hsl(221.2, 83.2%, 53.3%)',
        secondary: 'hsl(210, 40%, 96.1%)',
        muted: 'hsl(210, 40%, 96.1%)',
        accent: 'hsl(210, 40%, 96.1%)',
        destructive: 'hsl(0, 84.2%, 60.2%)',
        border: 'hsl(214.3, 31.8%, 91.4%)',
        popover: 'hsl(0, 0%, 100%)',
        'popover-foreground': 'hsl(222.2, 84%, 4.9%)',
        command: 'hsl(0, 0%, 100%)',
        status: {
          warning: '#2563eb',
          critical: '#f97316',
          exceeded: '#dc2626',
          normal: '#6b7280',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
      fontWeight: {
        semibold: '600',
        bold: '700',
      },
      spacing: {
        'xs': '0.25rem',
        'sm': '0.5rem',
        'md': '1rem',
        'lg': '1.5rem',
        'xl': '2rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      gridTemplateColumns: {
        'auto-fill-350': 'repeat(auto-fill, minmax(350px, 1fr))',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 300ms ease-in-out',
        slideIn: 'slideIn 300ms ease-in-out',
        spin: 'spin 1s linear infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} 