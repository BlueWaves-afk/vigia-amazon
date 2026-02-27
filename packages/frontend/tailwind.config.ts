import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'ide-bg': '#FFFFFF',
        'ide-panel': '#F5F5F5',
        'ide-hover': '#E5E7EB',
        'ide-border': '#CBD5E1',
        'ide-text': '#000000',
        'ide-text-secondary': '#6B7280',
        'ide-text-tertiary': '#9CA3AF',
      },
      fontFamily: {
        'ui': ['Inter', 'sans-serif'],
        'data': ['JetBrains Mono', 'monospace'],
      },
    },
  },
} satisfies Config;
