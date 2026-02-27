import type { Config } from 'tailwindcss';

// In Tailwind v4, design tokens live in globals.css via @theme
// This file only needs to exist for content scanning

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
} satisfies Config;
