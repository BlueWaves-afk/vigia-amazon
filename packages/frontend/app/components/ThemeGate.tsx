'use client';

import { useSettingsReady } from './SettingsContext';

/**
 * Blocks rendering of the app until theme preferences are fully loaded.
 * Shows a minimal branded loading screen that matches the user's saved theme
 * (applied by the blocking <script> in layout.tsx), preventing any
 * dark→light or light→dark flash.
 */
export function ThemeGate({ children }: { children: React.ReactNode }) {
  const ready = useSettingsReady();

  if (!ready) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          background: 'var(--v-bg-base)',
          color: 'var(--v-text-primary)',
          fontFamily: 'var(--v-font-ui)',
          zIndex: 99999,
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="VIGIA"
          width={32}
          height={32}
          style={{ opacity: 0.85 }}
        />

        {/* Wordmark */}
        <span
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            background:
              'linear-gradient(90deg, var(--v-accent) 0%, var(--v-accent-hover) 55%, var(--v-rose) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          VIGIA
        </span>

        {/* Subtle spinner */}
        <div
          style={{
            width: 20,
            height: 20,
            border: '2px solid var(--v-border-subtle)',
            borderTopColor: 'var(--v-accent)',
            borderRadius: '50%',
            animation: 'vigia-spin 0.7s linear infinite',
          }}
        />

        <style>{`
          @keyframes vigia-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}
