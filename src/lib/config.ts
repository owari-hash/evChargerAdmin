/** Server-side configuration. Never import this from a client component. */
export const serverConfig = {
  /** Base URL of the OCPP CSMS backend, without a trailing slash. */
  apiUrl: (process.env.CSMS_API_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, ''),
  /**
   * Path the backend mounts its REST routes under — must match the backend's
   * own API_BASE_PATH. Normalised to a leading slash and no trailing slash.
   */
  apiBasePath: normalisePath(process.env.CSMS_API_BASE_PATH, '/api'),
  /** Optional machine-to-machine key used when no user session is present. */
  apiKey: process.env.CSMS_API_KEY || undefined,
  cookieName: process.env.SESSION_COOKIE_NAME || 'eplug_session',
  cookieSecure: process.env.COOKIE_SECURE !== 'false',
  /**
   * Scope the session cookie to the console's own subtree. At eplug.mn/admin the
   * driver app owns the root, and a cookie on `/` would attach this console's
   * backend JWT to every request the driver app makes.
   */
  cookiePath: normalisePath(process.env.NEXT_PUBLIC_BASE_PATH, '') || '/',
} as const;

function normalisePath(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').trim() || fallback;
  const lead = raw.startsWith('/') ? raw : `/${raw}`;
  return lead === '/' ? '' : lead.replace(/\/+$/, '');
}

/** Safe to use from anywhere. */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'eplug.mn',
  domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN || 'eplug.mn',
} as const;
