'use client';

import * as React from 'react';
import { useLiveEvents, type LiveStatus } from '@/lib/use-live-events';
import { LIVE_EVENT_NAMES, type CsmsEvent } from '@/lib/types';

/**
 * One SSE connection per tab for the whole shell. The topbar's live indicator
 * (which also drives SWR revalidation) and the notification bell used to open
 * a stream each; both now subscribe to this one.
 *
 * Page-level feeds filtered to a single station (LiveFeed) still open their
 * own, since they ask the server for a different subset.
 */

/** Financial events the bell reports; not in LIVE_EVENT_NAMES, so asked for explicitly. */
export const NOTIFICATION_ONLY_EVENTS = [
  'payment.paid',
  'payment.canceled',
  'wallet.credited',
  'wallet.debited',
  'transaction.refunded',
] as const;

const SHELL_EVENTS: readonly string[] = [
  ...LIVE_EVENT_NAMES.filter((e) => e !== 'ocpp.message'),
  ...NOTIFICATION_ONLY_EVENTS,
];

type Listener = (event: CsmsEvent) => void;

interface LiveStreamValue {
  status: LiveStatus;
  lastEventAt: Date | null;
  subscribe: (listener: Listener) => () => void;
}

const LiveStreamContext = React.createContext<LiveStreamValue | null>(null);

export function LiveStreamProvider({ children }: { children: React.ReactNode }) {
  const listeners = React.useRef(new Set<Listener>());

  const { status, lastEventAt } = useLiveEvents({
    events: SHELL_EVENTS,
    buffer: 1,
    onEvent: (event) => {
      for (const listener of listeners.current) listener(event);
    },
  });

  const subscribe = React.useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = React.useMemo(
    () => ({ status, lastEventAt, subscribe }),
    [status, lastEventAt, subscribe],
  );

  return <LiveStreamContext.Provider value={value}>{children}</LiveStreamContext.Provider>;
}

function useLiveStream(): LiveStreamValue {
  const ctx = React.useContext(LiveStreamContext);
  if (!ctx) throw new Error('useLiveStream must be used inside LiveStreamProvider');
  return ctx;
}

/** Connection status of the shared stream. */
export function useLiveStreamStatus(): { status: LiveStatus; lastEventAt: Date | null } {
  const { status, lastEventAt } = useLiveStream();
  return { status, lastEventAt };
}

/** Receive every shell event. The handler may change between renders. */
export function useLiveStreamEvents(onEvent: Listener): void {
  const { subscribe } = useLiveStream();
  const ref = React.useRef(onEvent);
  React.useEffect(() => {
    ref.current = onEvent;
  });
  React.useEffect(() => subscribe((event) => ref.current(event)), [subscribe]);
}
