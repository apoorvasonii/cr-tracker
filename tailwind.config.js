/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Deep teal-blue that carries the primary buttons, active tab and avatar.
        brand: {
          50: '#eef6fa',
          100: '#d8eaf2',
          500: '#1f6d8f',
          600: '#1a5b7a',
          700: '#154b66',
        },
        ink: {
          DEFAULT: '#1f2933',
          soft: '#4b5563',
          muted: '#8a94a2',
        },
        line: '#e6eaf0',
        page: '#f1f4f8',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04)',
        pop: '0 12px 32px rgba(16,24,40,0.14)',
      },
    },
  },
  plugins: [],
}
