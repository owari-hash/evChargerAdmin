import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { withBasePath } from '@/lib/base-path';
import { brand } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — Цэнэглэх сүлжээний удирдлага`,
    template: `%s · ${brand.name}`,
  },
  description: `${brand.domain} цэнэглэх сүлжээний OCPP 1.6J удирдлагын самбар.`,
  robots: { index: false, follow: false },
  icons: {
    // `metadata.icons` is emitted verbatim — unlike <Link> and asset URLs, Next
    // does not apply basePath to it, so a bare '/icon.svg' would resolve against
    // the domain root and land on whatever else is served there.
    icon: [{ url: withBasePath('/icon.svg'), type: 'image/svg+xml' }],
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
    <html lang="mn" suppressHydrationWarning>
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
