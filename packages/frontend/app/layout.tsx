import type { Metadata } from 'next';
import './globals.css';
import { SettingsProvider } from './components/SettingsContext';

export const metadata: Metadata = {
  title: 'VIGIA — Sentient Road Infrastructure',
  description: 'Road hazard detection, DePIN ledger, and swarm intelligence IDE',
  icons: { icon: '/logo.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%', overflow: 'hidden' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* IBM Plex Sans — UI font (300/400/500/600/700) + IBM Plex Mono — data font (400/500) */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        height: '100%', overflow: 'hidden', margin: 0, padding: 0,
        background: 'var(--c-bg)', color: 'var(--c-text)',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        transition: 'background 0.18s ease, color 0.18s ease',
      }}>
        <SettingsProvider>
          <div className="vigia-root" style={{ height: '100%', overflow: 'hidden' }}>
            {children}
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
