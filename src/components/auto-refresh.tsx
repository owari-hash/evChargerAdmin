'use client';

import { REFRESH, useAutoRefresh } from '@/lib/live-query';

/** Drop into a server-rendered page to keep it current without a refresh button. */
export function AutoRefresh({ interval = REFRESH.live }: { interval?: number }) {
  useAutoRefresh(interval);
  return null;
}
