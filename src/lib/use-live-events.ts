'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { withBasePath } from './base-path';
import { LIVE_EVENT_NAMES, type CsmsEvent } from './types';

export type LiveStatus = 'connecting' | 'live' | 'offline';

interface Options {
  /** Only receive events for one charge point. */
  chargePointId?: string;
  /** Restrict to these event names. Defaults to every event except the noisy raw frames. */
  events?: readonly string[];
  /** How many events to keep in `events` state. */
  buffer?: number;
  /** Called for every event, including ones beyond the buffer. */
  onEvent?: (event: CsmsEvent) => void;
  enabled?: boolean;
}

/** Every event except `ocpp.message`, which is one entry per raw frame. */
const DEFAULT_EVENTS = LIVE_EVENT_NAMES.filter((e) => e !== 'ocpp.message');

/**
 * Subscribe to the CSMS live stream through this app's SSE proxy.
 *
 * EventSource reconnects on its own, so this hook only tracks status and keeps
 * a bounded ring of recent events.
 */
export function useLiveEvents({
  chargePointId,
  events: wanted = DEFAULT_EVENTS,
  buffer = 100,
  onEvent,
  enabled = true,
}: Options = {}) {
  const [events, setEvents] = useState<CsmsEvent[]>([]);
  const [streamStatus, setStreamStatus] = useState<LiveStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  // Keep the callback out of the effect deps so a new inline function on every
  // render does not tear down and rebuild the EventSource. Assigned in an effect
  // rather than during render, so a discarded render cannot leak its callback.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  // Derived rather than stored: when the caller disables the stream there is
  // nothing to synchronise, so no effect needs to write status.
  const status: LiveStatus = enabled ? streamStatus : 'offline';

  const wantedKey = wanted.join(',');

  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams();
    if (chargePointId) params.set('chargePointId', chargePointId);
    if (wantedKey) params.set('events', wantedKey);

    const source = new EventSource(withBasePath(`/console-api/stream?${params.toString()}`));
    let closed = false;

    const handle = (raw: MessageEvent<string>, name: string) => {
      let payload: CsmsEvent;
      try {
        payload = { ...(JSON.parse(raw.data) as CsmsEvent) };
      } catch {
        return;
      }
      payload.event ||= name;
      // The stream has no per-message id; a monotonic key keeps React lists stable.
      const stamped: CsmsEvent = {
        ...payload,
        _key: `${Date.now()}-${Math.round(performance.now() * 1000)}`,
      };

      setLastEventAt(new Date());
      setEvents((prev) => [stamped, ...prev].slice(0, buffer));
      onEventRef.current?.(stamped);
    };

    source.addEventListener('ready', () => {
      if (!closed) setStreamStatus('live');
    });

    for (const name of wantedKey ? wantedKey.split(',') : LIVE_EVENT_NAMES) {
      source.addEventListener(name, (e) => handle(e as MessageEvent<string>, name));
    }

    source.onopen = () => {
      if (!closed) setStreamStatus('live');
    };
    source.onerror = () => {
      // EventSource retries by itself; surface the gap without tearing down.
      if (!closed) setStreamStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [chargePointId, wantedKey, buffer, enabled]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, status, lastEventAt, clear };
}
