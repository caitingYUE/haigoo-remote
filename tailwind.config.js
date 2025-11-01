/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3f0ff',
          100: '#e9e2ff',
          200: '#d6c9ff',
          300: '#b8a3ff',
          400: '#9470ff',
          500: '#803af2',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // 海狗品牌色彩系统
        haigoo: {
          primary: '#803af2',
          'primary-light': '#9470ff',
          'primary-dark': '#6d28d9',
          purple: {
            50: '#f9f7ff',
            100: '#f3f0ff',
            200: '#e9e2ff',
            300: '#d6c9ff',
            400: '#b8a3ff',
            500: '#9470ff',
            600: '#803af2',
            700: '#7c3aed',
            800: '#6d28d9',
            900: '#5b21b6',
          }
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
        'primary': '0 4px 14px 0 rgba(128, 58, 242, 0.1)',
        'modal': '-10px 0 30px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
  ],
}