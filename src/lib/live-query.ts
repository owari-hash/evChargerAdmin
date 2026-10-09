'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig, type SWRConfiguration } from 'swr';
import type { CsmsEvent } from './types';

/**
 * One place that decides how fresh the console's data is. There are no manual
 * "refresh" buttons: SWR polls (paused while the tab is hidden), revalidates on
 * focus/reconnect, and the CSMS live stream nudges the affected lists the
 * moment something happens on the network.
 */
export const REFRESH = {
  /** Operational lists: charge points, connectors, transactions, logs. */
  live: 5_000,
  /** Slow-changing configuration: users, clients, merchants, settings. */
  config: 20_000,
} as const;

/** Defaults for every useSWR call inside the app shell. */
export const SWR_DEFAULTS: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  // Background refreshes and page/filter changes keep the rows on screen
  // instead of flashing back to a skeleton.
  keepPreviousData: true,
  dedupingInterval: 2_000,
  focusThrottleInterval: 5_000,
};

/**
 * Which CSMS collections a live event can change, as path prefixes under the
 * proxy (`/console-api/csms/<prefix>...`). Heartbeats and meter values are
 * deliberately absent: they are high-volume, and polling already covers them.
 */
const EVENT_PATHS: Record<string, readonly string[]> = {
  'chargepoint.connected': ['charge-points', 'connectors', 'clients'],
  'chargepoint.disconnected': ['charge-points', 'connectors', 'clients'],
  'chargepoint.boot': ['charge-points', 'connectors'],
  'connector.status': ['connectors', 'charge-points', 'clients'],
  'transaction.started': ['transactions', 'connectors', 'charge-points', 'reservations', 'id-tags'],
  'transaction.stopped': ['transactions', 'connectors', 'charge-points', 'reservations', 'id-tags'],
  'security.event': ['security'],
  'firmware.status': ['jobs'],
  'diagnostics.status': ['jobs'],
  'log.status': ['jobs'],
  'command.result': ['charge-points', 'charging-profiles', 'reservations'],
};

const CSMS_MARKER = '/console-api/csms/';

function keyPath(key: unknown): string | null {
  if (typeof key !== 'string') return null;
  const at = key.indexOf(CSMS_MARKER);
  return at === -1 ? null : key.slice(at + CSMS_MARKER.length);
}

function matchesPrefix(path: string, prefix: string): boolean {
  return (
    path === prefix ||
    path.startsWith(`${prefix}/`) ||
    path.startsWith(`${prefix}?`)
  );
}

/**
 * Returns an `onEvent` handler for useLiveEvents that revalidates the SWR keys
 * an event affects. Bursts are coalesced into one revalidation per ~0.8s.
 */
export function useLiveRevalidation(): (event: CsmsEvent) => void {
  const { mutate } = useSWRConfig();
  const pending = React.useRef(new Set<string>());
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return React.useCallback(
    (event: CsmsEvent) => {
      const prefixes = EVENT_PATHS[event.event];
      if (!prefixes) return;
      for (const p of prefixes) pending.current.add(p);
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const wanted = [...pending.current];
        pending.current.clear();
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        void mutate((key) => {
          const path = keyPath(key);
          return path !== null && wanted.some((p) => matchesPrefix(path, p));
        });
      }, 800);
    },
    [mutate],
  );
}

/**
 * Keeps a server-rendered page current by calling router.refresh() on an
 * interval, only while the tab is visible and online, plus once when the tab
 * regains focus. router.refresh() re-renders server components in place, so
 * client state (open modals, half-typed forms, scroll, active tab) survives.
 */
export function useAutoRefresh(interval: number = REFRESH.live, paused = false): void {
  const router = useRouter();

  React.useEffect(() => {
    if (paused || interval <= 0) return;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      // focus + visibilitychange often fire together; refresh once.
      if (Date.now() - last < 1_500) return;
      last = Date.now();
      router.refresh();
    };
    const id = window.setInterval(refresh, interval);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [interval, paused, router]);
}
