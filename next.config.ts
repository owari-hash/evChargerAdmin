import type { NextConfig } from 'next';

/**
 * Path the console is served under. `/admin` in production, where eplug.mn's
 * root belongs to the driver app; empty when this console owns the root.
 *
 * Kept identical to `BASE_PATH` in src/lib/base-path.ts by reading the same
 * variable — Next needs it here to rewrite links and `/_next/*` asset URLs, and
 * the client code needs it there for fetch/EventSource URLs the router never
 * sees. Both are baked in at build time, so changing it requires a rebuild.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim().replace(/\/+$/, '');

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root: without this Turbopack walks up and finds the
  // stray lockfile in the home directory.
  turbopack: { root: import.meta.dirname },
  // The admin console renders no remote images and needs no image optimisation.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // `source` is relative to basePath — Next prefixes it automatically.
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
