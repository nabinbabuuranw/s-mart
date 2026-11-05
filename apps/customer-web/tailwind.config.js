/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)', surface: 'var(--surface)', ink: 'var(--ink)', muted: 'var(--muted)',
        line: 'var(--line)', soft: 'var(--soft)', primary: 'var(--primary)', 'primary-hover': 'var(--primary-hover)',
        'on-primary': 'var(--on-primary)', accent: 'var(--accent)', 'accent-text': 'var(--accent-text)',
        'accent-soft': 'var(--accent-soft)', success: 'var(--success)', danger: 'var(--danger)', info: 'var(--info)',
      },
      fontFamily: {
        display: ['"DM Sans Variable"', '"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans Variable"', '"DM Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
