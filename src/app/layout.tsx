import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { brand } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — Charging network console`,
    template: `%s · ${brand.name}`,
  },
  description: `Operations console for the ${brand.domain} OCPP 1.6J charging network.`,
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f14' },
  ],
};

/**
 * Applied before first paint so a dark-mode user never sees a white flash.
 * Kept inline and tiny on purpose.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('eplug-theme');
    var dark = stored ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-fg)',
              border: '1px solid var(--color-border)',
            },
          }}
        />
      </body>
    </html>
  );
}
