import type { Metadata } from 'next';
import './globals.css';
import { SettingsProvider } from './components/SettingsContext';
import { ThemeGate } from './components/ThemeGate';

export const metadata: Metadata = {
  title: 'VIGIA — Sentient Road Infrastructure',
  description: 'Road hazard detection, DePIN ledger, and swarm intelligence IDE',
  icons: { icon: '/logo.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning style={{ height: '100%', overflow: 'hidden' }}>
      <head>
        {/* Blocking script: apply saved theme BEFORE first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try{
    var s=localStorage.getItem('vigia-settings');
    if(s){
      var p=JSON.parse(s);
      var t=p.theme||'light';
      document.documentElement.setAttribute('data-theme',t);
      document.documentElement.classList.toggle('vigia-theme-light',t==='light');
      document.documentElement.classList.toggle('vigia-theme-dark',t==='dark'||t==='darker');
      document.documentElement.classList.toggle('vigia-theme-hc',t==='high-contrast');
    } else {
      document.documentElement.setAttribute('data-theme','light');
      document.documentElement.classList.add('vigia-theme-light');
    }
  }catch(e){document.documentElement.setAttribute('data-theme','light');}
})();`,
          }}
        />
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
        fontFamily: 'var(--v-font-ui)',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        transition: 'background 0.18s ease, color 0.18s ease',
      }}>
        <SettingsProvider>
          <ThemeGate>
            <div className="vigia-root" style={{ height: '100%', overflow: 'hidden' }}>
              {children}
            </div>
          </ThemeGate>
        </SettingsProvider>
      </body>
    </html>
  );
}
