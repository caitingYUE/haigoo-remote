/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        haigoo: {
          primary: '#3182CE',
          secondary: '#F59F0B',
          'primary-light': '#EAF3FF',
          'primary-dark': '#1A365D'
        },
        // 背景色系统
        background: {
          light: '#f9fafb',
          'light-purple': '#f9f7ff',
          dark: '#1a151b',
          'dark-purple': '#120e13',
        },
        // 灰色系统
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          'soft': '#6f6c76',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'DEFAULT': '0.5rem',
        'lg': '1rem',
        'xl': '1.5rem',
        'full': '9999px',
      },
      boxShadow: {
        'primary': '0 4px 14px 0 rgba(49, 130, 206, 0.1)',
        'modal': '-10px 0 30px rgba(0, 0, 0, 0.1)'
      }
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
  ],
}