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
