import type { Metadata } from 'next';
import './globals.css';
import { SettingsProvider } from './components/SettingsContext';

export const metadata: Metadata = {
  title: 'VIGIA — Sentient Road Infrastructure',
  description: 'Road hazard detection, DePIN ledger, and swarm intelligence IDE',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%', overflow: 'hidden' }}>
      <head>
        {/* Preconnect for faster font load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body style={{
        height: '100%', overflow: 'hidden', margin: 0, padding: 0,
        background: 'var(--c-bg)', color: 'var(--c-text)',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        transition: 'background 0.18s ease, color 0.18s ease',
      }}>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
