'use client';

/**
 * The bell's history, kept in localStorage under the signed-in operator's id so
 * a different operator on the same browser starts with an empty bell.
 *
 * Every open tab receives the same live event. Writes go through a Web Lock so
 * exactly one tab records each notification; the others see it via the
 * `storage` event. The dedupe key (e.g. `tx:42:stopped`) also absorbs a repeat
 * after a stream reconnect.
 */

import type { Tone } from '@/components/ui/primitives';
import { apiUrl } from './client';

export type NotificationKind =
  | 'transaction.started'
  | 'transaction.stopped'
  | 'payment'
  | 'wallet'
  | 'refund';

export interface StoredNotification {
  /** Dedupe key, unique per real-world occurrence. */
  key: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  tone: Tone;
  /** ISO timestamp. */
  at: string;
  /** Console route to open when clicked. */
  href?: string;
  /** Some tab already showed it as a toast. */
  toasted?: boolean;
}

export interface StoredState {
  items: StoredNotification[];
  /** ISO timestamp of the last time the operator opened the bell. */
  readAt?: string;
}

const MAX_ITEMS = 50;
const PREFIX = 'eplug-admin-notifications:';

export function storageKey(userId: string): string {
  return PREFIX + userId;
}

/** Same-tab writes do not fire `storage`, so they announce themselves with this. */
const LOCAL_EVENT = 'eplug-admin-notifications';

/** Raw stored JSON — a string, so it is a stable useSyncExternalStore snapshot. */
export function readRaw(userId: string): string {
  try {
    return window.localStorage.getItem(storageKey(userId)) ?? '';
  } catch {
    return '';
  }
}

export function parseState(raw: string): StoredState {
  if (!raw) return { items: [] };
  try {
    const parsed = JSON.parse(raw) as StoredState;
    return { items: Array.isArray(parsed.items) ? parsed.items : [], readAt: parsed.readAt };
  } catch {
    return { items: [] };
  }
}

function readState(userId: string): StoredState {
  return parseState(readRaw(userId));
}

function writeState(userId: string, state: StoredState): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Storage full or blocked — the bell just will not survive a reload.
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

/** Change notifications from this tab and every other tab. */
export function subscribeNotifications(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

async function withLock<T>(userId: string, fn: () => T): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return fn();
  return locks.request(storageKey(userId), () => fn());
}

/** Fetches notifications saved on the server and synchronizes local state. */
export async function fetchServerNotifications(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const res = await fetch(apiUrl('notifications'), { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: StoredNotification[] };
    if (!data || !Array.isArray(data.items)) return;

    await withLock(userId, () => {
      const state = readState(userId);
      const existingKeys = new Set(state.items.map((i) => i.key));
      const serverItems = data.items ?? [];
      const newFromServer = serverItems.filter((i) => !existingKeys.has(i.key));

      if (newFromServer.length > 0 || (state.items.length === 0 && serverItems.length > 0)) {
        const merged = [...state.items, ...newFromServer]
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
          .slice(0, MAX_ITEMS);
        writeState(userId, { ...state, items: merged });
      }
    });
  } catch {
    // Network down or server unreachable — cached state persists.
  }
}

/**
 * Record a notification unless some tab already has. Returns whether this tab
 * should toast it: the tab that records it toasts when visible; if that tab was
 * hidden, the first visible tab to see the event toasts instead.
 */
export async function recordNotification(
  userId: string,
  item: Omit<StoredNotification, 'toasted'>,
): Promise<boolean> {
  const visible = document.visibilityState === 'visible';

  // Persist to server
  try {
    void fetch(apiUrl('notifications'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item),
    }).catch(() => {});
  } catch {
    // Network down
  }

  return withLock(userId, () => {
    const state = readState(userId);
    const existing = state.items.find((n) => n.key === item.key);
    if (existing) {
      if (existing.toasted || !visible) return false;
      existing.toasted = true;
      writeState(userId, state);
      return true;
    }
    state.items = [{ ...item, toasted: visible }, ...state.items].slice(0, MAX_ITEMS);
    writeState(userId, state);
    return visible;
  });
}

export function markAllRead(userId: string): void {
  try {
    void fetch(apiUrl('notifications/read-all'), {
      method: 'POST',
    }).catch(() => {});
  } catch {
    // Network down
  }

  void withLock(userId, () => {
    const state = readState(userId);
    state.readAt = new Date().toISOString();
    writeState(userId, state);
  });
}

export function unreadCount(state: StoredState): number {
  const since = state.readAt ? Date.parse(state.readAt) : 0;
  return state.items.filter((n) => Date.parse(n.at) > since).length;
}
