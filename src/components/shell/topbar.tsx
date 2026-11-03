'use client';

import * as React from 'react';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { Button, Dot } from '@/components/ui/primitives';
import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';
import { LiveChargingButton } from './live-charging-button';
import { logout } from '@/lib/client';
import { useLiveStreamEvents, useLiveStreamStatus } from './live-stream';
import { useLiveRevalidation } from '@/lib/live-query';
import { formatRelative } from '@/lib/format';
import type { SessionUser } from '@/lib/types';

export function Topbar({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 sm:gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 sm:px-4 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[220px] xs:max-w-xs sm:max-w-sm md:max-w-md">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          onClick={onMenu}
          aria-label="Цэс нээх"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <GlobalSearch role={user.role} className="w-full" />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
        {user.role === 'CLIENT' && user.clientName && (
          <span
            title={user.clientName}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[var(--color-brand)]/10 text-[var(--color-brand)] border border-[var(--color-brand)]/20 max-w-[180px] 2xl:max-w-[260px] whitespace-nowrap"
          >
            <span className="truncate">{user.clientName}</span>
          </span>
        )}
        <LiveChargingButton />
        <LiveIndicator />
        <span data-tour="notifications" className="inline-flex">
          <NotificationBell userId={user.id} />
        </span>
        <div data-tour="account" className="flex items-center gap-0.5 sm:gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="sm:h-8 sm:w-auto sm:px-2.5 sm:gap-1.5"
            onClick={() => void logout()}
            title={`${user.email} — Гарах`}
          >
            <LogOut className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline text-xs font-medium">Гарах</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * Shows whether the SSE stream to the CSMS is currently connected, and uses
 * that same (single, app-wide) stream to revalidate whichever lists an event
 * affects — this is what makes the tables update without a refresh button.
 */
function LiveIndicator() {
  // The shell's single shared stream (see live-stream.tsx), also feeding the bell.
  useLiveStreamEvents(useLiveRevalidation());
  const { status, lastEventAt } = useLiveStreamStatus();

  const tone = status === 'live' ? 'ok' : status === 'connecting' ? 'warn' : 'danger';
  const text =
    status === 'live' ? 'Шууд' : status === 'connecting' ? 'Холбогдож байна' : 'Холболт тасарсан';

  return (
    <span
      data-tour="live-status"
      className="hidden items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-fg-muted)] sm:inline-flex"
      title={lastEventAt ? `Сүүлийн үйл явдал ${formatRelative(lastEventAt)}` : 'Одоогоор үйл явдал алга'}
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
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Өнгөний горим солих">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
