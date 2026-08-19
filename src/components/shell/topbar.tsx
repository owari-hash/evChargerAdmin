'use client';

import * as React from 'react';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { Button, Dot } from '@/components/ui/primitives';
import { logout } from '@/lib/client';
import { useLiveEvents } from '@/lib/use-live-events';
import { formatRelative } from '@/lib/format';
import type { SessionUser } from '@/lib/types';

export function Topbar({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <LiveIndicator />
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          title={`Sign out ${user.email}`}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}

/** Shows whether the SSE stream to the CSMS is currently connected. */
function LiveIndicator() {
  const { status, lastEventAt } = useLiveEvents({ buffer: 1 });

  const tone = status === 'live' ? 'ok' : status === 'connecting' ? 'warn' : 'danger';
  const text = status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Stream down';

  return (
    <span
      className="hidden items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-fg-muted)] sm:inline-flex"
      title={lastEventAt ? `Last event ${formatRelative(lastEventAt)}` : 'No events yet'}
    >
      <Dot tone={tone} pulse={status === 'live'} />
      {text}
    </span>
  );
}

/**
 * The theme lives on <html>, applied by an inline script before first paint, so
 * it is external state as far as React is concerned. useSyncExternalStore reads
 * it without a render-phase DOM read and returns `false` during SSR, where the
 * class is genuinely unknown.
 */
const themeStore = {
  subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  },
  getSnapshot: () => document.documentElement.classList.contains('dark'),
  getServerSnapshot: () => false,
};

function ThemeToggle() {
  // During hydration this returns getServerSnapshot() so the markup matches the
  // server, then re-renders with the real DOM value — no mismatch, no mounted flag.
  const dark = React.useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('eplug-theme', next ? 'dark' : 'light');
    } catch {
      // Private mode; the choice just will not persist.
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle colour theme">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
