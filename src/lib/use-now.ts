'use client';

import { useEffect, useState } from 'react';

/**
 * Current epoch milliseconds as React state.
 *
 * Calling `Date.now()` during render is impure — it returns something different
 * every time, which breaks memoisation and makes renders non-deterministic. Most
 * of this console only needs "now" to decide whether something has expired, so
 * reading it from state (and ticking on an interval) is both correct and nicer:
 * expiry badges flip over on their own without a reload.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
