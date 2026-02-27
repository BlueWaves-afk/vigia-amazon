import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VIGIA — Road Intelligence IDE',
  description: 'Sentient Road Infrastructure System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%', overflow: 'hidden' }}>
      <body style={{
        height: '100%',
        overflow: 'hidden',
        background: '#0E1117',
        color: '#E2E8F0',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        margin: 0,
        padding: 0,
      }}>
        {children}
      </body>
    </html>
  );
}
