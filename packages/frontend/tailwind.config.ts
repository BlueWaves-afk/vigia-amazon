import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
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
} satisfies Config;
