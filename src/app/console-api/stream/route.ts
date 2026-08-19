import { NextResponse, type NextRequest } from 'next/server';
import { serverConfig } from '@/lib/config';
import { authHeaders } from '@/lib/server-api';
import { getSessionToken } from '@/lib/session';

/**
 * Server-Sent Events proxy for the CSMS live stream.
 *
 * The backend accepts the JWT as a query parameter because EventSource cannot
 * set headers — but putting a token in a URL means it lands in access logs and
 * browser history. Proxying instead lets the browser open a plain, credential-free
 * EventSource against this route while the token travels upstream in a header.
 *
 * Pass-through filters: ?chargePointId= and ?events=a,b,c
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token && !serverConfig.apiKey) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const target = new URL(
    `${serverConfig.apiUrl}${serverConfig.apiBasePath}/events/stream`,
  );
  for (const key of ['chargePointId', 'events'] as const) {
    const value = req.nextUrl.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { accept: 'text/event-stream', ...(await authHeaders()) },
      cache: 'no-store',
      // Abort the upstream request as soon as the browser goes away, so the
      // backend does not keep a dead SSE connection open.
      signal: req.signal,
    });
  } catch {
    return NextResponse.json({ error: 'Cannot reach the CSMS backend' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: 'Live stream unavailable' },
      { status: upstream.status === 200 ? 502 : upstream.status },
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Tell nginx not to buffer, otherwise events arrive in clumps.
      'x-accel-buffering': 'no',
    },
  });
}
