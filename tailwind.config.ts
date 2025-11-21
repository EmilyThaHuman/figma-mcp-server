import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        figma: {
          purple: '#667eea',
          darkpurple: '#764ba2',
        }
      }
    },
  },
  plugins: [],
} satisfies Config;

