import type { Config } from 'tailwindcss';

export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'vigia-dark': '#0a0a0a',
        'vigia-panel': '#1a1a1a',
        'vigia-accent': '#3b82f6',
        'vigia-danger': '#ef4444',
        'vigia-success': '#10b981',
      },
    },
  },
  plugins: [],
} satisfies Config;
