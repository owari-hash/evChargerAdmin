import 'server-only';

import { serverConfig } from './config';
import { getSessionToken } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** True when the backend rejected our credentials and the user must sign in again. */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

/**
 * Resolve a domain path against the backend. Callers pass paths without the API
 * prefix — `/stats/overview`, not `/api/stats/overview` — so the prefix stays a
 * single configurable value that matches the backend's API_BASE_PATH.
 */
function buildUrl(path: string, query?: Record<string, unknown>): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(serverConfig.apiUrl + serverConfig.apiBasePath + (clean === '/' ? '' : clean));
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  if (token) return { authorization: `Bearer ${token}` };
  if (serverConfig.apiKey) return { 'x-api-key': serverConfig.apiKey };
  return {};
}

interface FetchOptions {
  query?: Record<string, unknown>;
  method?: string;
  body?: unknown;
  /** Seconds to cache. Defaults to no caching: this is an operations console. */
  revalidate?: number;
  signal?: AbortSignal;
}

/**
 * Call the CSMS backend from a server component or route handler.
 * Throws {@link ApiError} on a non-2xx response.
 */
export async function csms<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { query, method = 'GET', body, revalidate, signal } = options;

  const headers: Record<string, string> = { accept: 'application/json', ...(await authHeaders()) };
  if (body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: revalidate === undefined ? 'no-store' : undefined,
    next: revalidate === undefined ? undefined : { revalidate },
  });

  const text = await res.text();
  const payload = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const message =
      (payload as { error?: string } | undefined)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, (payload as { details?: unknown } | undefined)?.details);
  }

  return payload as T;
}

/** Like {@link csms} but resolves to `null` instead of throwing. */
export async function csmsSafe<T>(path: string, options: FetchOptions = {}): Promise<T | null> {
  try {
    return await csms<T>(path, options);
  } catch {
    return null;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}
