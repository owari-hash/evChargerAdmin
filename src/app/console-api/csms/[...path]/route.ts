import { NextResponse, type NextRequest } from 'next/server';
import { serverConfig } from '@/lib/config';
import { authHeaders } from '@/lib/server-api';
import { getSessionToken } from '@/lib/session';

/**
 * Transparent proxy to the CSMS REST API.
 *
 * The browser calls `/console-api/csms/<backend path>` and this handler re-issues the
 * request against CSMS_API_URL with the session JWT attached from the httpOnly
 * cookie. The token is therefore never exposed to page scripts, and the browser
 * never needs a CORS grant from the backend.
 *
 * Authorisation itself is still the backend's job: the proxy forwards the
 * caller's own token, so a VIEWER stays a VIEWER.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;

  if (!path?.length || path.some((s) => s === '..' || s === '.')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const token = await getSessionToken();
  if (!token && !serverConfig.apiKey) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // `/console-api/csms/charge-points` -> `<backend><apiBasePath>/charge-points`
  const target = new URL(
    `${serverConfig.apiUrl}${serverConfig.apiBasePath}/${path.map(encodeURIComponent).join('/')}`,
  );
  target.search = req.nextUrl.search;

  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(await authHeaders()),
  };

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  let body: string | undefined;
  if (hasBody) {
    body = await req.text();
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body || undefined,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Cannot reach the CSMS backend',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  // 204 and friends must not carry a body.
  if (upstream.status === 204 || upstream.status === 205 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
