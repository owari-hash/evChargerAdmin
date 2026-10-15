'use client';

/**
 * Browser-side access to the CSMS, always through this app's own proxy so the
 * JWT stays in an httpOnly cookie.
 */

import { BASE_PATH, stripBasePath, withBasePath } from './base-path';

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ClientApiError';
  }
}

/** Build a proxy URL: `charge-points` -> `/admin/console-api/csms/charge-points?...` */
export function apiUrl(path: string, query?: Record<string, unknown>): string {
  const clean = path.replace(/^\/+/, '');
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return withBasePath(`/console-api/csms/${clean}${qs ? `?${qs}` : ''}`);
}

async function parse(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = (await parse(res)) as { error?: string; details?: unknown } | null;

  if (res.status === 401) {
    // The session expired underneath us. A hard navigation is deliberate here
    // rather than router.push: it discards the SWR cache and every other piece
    // of in-memory state belonging to the dead session.
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith(`${BASE_PATH}/login`)) {
      // `next` is stored without the basePath, because the login screen replays
      // it through router.replace(), which puts the prefix back on itself.
      const here = stripBasePath(window.location.pathname) + window.location.search;
      const next = encodeURIComponent(here);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = withBasePath(`/login?next=${next}&expired=1`);
    }
    throw new ClientApiError(401, payload?.error ?? 'Нэвтрэлтийн хугацаа дууслаа');
  }

  if (!res.ok) {
    throw new ClientApiError(
      res.status,
      payload?.error ?? `Request failed (${res.status})`,
      payload?.details,
    );
  }

  return payload as T;
}

/** SWR-compatible fetcher. Pass the full proxy URL as the SWR key. */
export const fetcher = <T>(url: string): Promise<T> => request<T>('GET', url);

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>('GET', apiUrl(path, query)),
  post: <T>(path: string, body?: unknown) => request<T>('POST', apiUrl(path), body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', apiUrl(path), body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', apiUrl(path), body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', apiUrl(path)),
};

/**
 * Like `api.post`/`api.patch`, but for a multipart body (a file upload) —
 * `request()` always JSON-encodes, which would corrupt the file bytes.
 */
export async function apiUploadForm<T>(
  method: 'POST' | 'PATCH',
  path: string,
  form: FormData,
): Promise<T> {
  const res = await fetch(apiUrl(path), { method, body: form, cache: 'no-store' });
  const payload = (await parse(res)) as { error?: string; details?: unknown } | null;
  if (!res.ok) {
    throw new ClientApiError(res.status, payload?.error ?? `Request failed (${res.status})`, payload?.details);
  }
  return payload as T;
}

/** Set when the first-run guide is skipped for this browser session (first-run-guide.tsx). */
export const GUIDE_DISMISSED_COOKIE = 'eplug_guide_dismissed';

export async function logout(): Promise<void> {
  await fetch(withBasePath('/console-api/auth/logout'), { method: 'POST' });
  // The next operator to sign in here gets their own first-run guide decision.
  document.cookie = `${GUIDE_DISMISSED_COOKIE}=; path=${BASE_PATH || '/'}; Max-Age=0; SameSite=Lax`;
  try {
    window.sessionStorage.removeItem('eplug-admin-guide-dismissed');
  } catch {
    // Storage blocked; nothing was stored there either.
  }
  // Full reload on sign-out, so nothing from the previous user survives in memory.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = withBasePath('/login');
}

/** Human-readable message for anything thrown by this module. */
export function errorMessage(err: unknown): string {
  if (err instanceof ClientApiError) {
    if (err.details && typeof err.details === 'object') {
      const flat = err.details as { fieldErrors?: Record<string, string[]> };
      const first = Object.entries(flat.fieldErrors ?? {})[0];
      if (first) return `${err.message}: ${first[0]} ${first[1]?.[0] ?? ''}`.trim();
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
