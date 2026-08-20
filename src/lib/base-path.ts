/**
 * Path prefix this console is mounted under — `/admin` in production, empty when
 * it owns the domain root.
 *
 * Next.js rewrites `<Link>` hrefs, `router.push()` and `/_next/*` asset URLs for
 * `basePath` on its own. What it does not touch is a hand-written absolute URL
 * passed to `fetch()`, `EventSource` or `window.location`, because those never
 * go through the router. Every one of those in this app must be wrapped in
 * `withBasePath()`, or it will escape the console and hit whatever else is
 * served at the domain root (the driver app, in our deployment).
 *
 * The value is read from `NEXT_PUBLIC_BASE_PATH`, which Next inlines into the
 * browser bundle **at build time** — changing it means rebuilding, not just
 * restarting. It is also what `next.config.ts` feeds to `basePath`, so the two
 * can never drift apart.
 */

function normalise(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw || raw === '/') return '';
  const lead = raw.startsWith('/') ? raw : `/${raw}`;
  return lead.replace(/\/+$/, '');
}

export const BASE_PATH = normalise(process.env.NEXT_PUBLIC_BASE_PATH);

/** `/console-api/x` -> `/admin/console-api/x`. Use for fetch/EventSource/location. */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Inverse of `withBasePath` for a real browser pathname: `/admin/users` ->
 * `/users`. Router APIs re-add the prefix themselves, so anything handed back to
 * `router.push()` — or stored in a `?next=` parameter — must be stripped first,
 * otherwise the prefix ends up doubled as `/admin/admin/users`.
 */
export function stripBasePath(pathname: string): string {
  if (!BASE_PATH) return pathname || '/';
  if (pathname === BASE_PATH) return '/';
  return pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname || '/';
}
