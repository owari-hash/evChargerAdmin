import { NextResponse, type NextRequest } from 'next/server';

/**
 * Gate every page on the presence of a session cookie and bounce signed-in users
 * away from the login screen.
 *
 * This is a routing convenience, not the security boundary — the cookie is not
 * verified here. Every piece of data is fetched through the proxy with the real
 * token, and the backend authorises each call.
 */

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'eplug_session';

const PUBLIC_PATHS = ['/login'];

export function proxy(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);

  // The console's own route handlers authenticate themselves and answer with a
  // JSON 401. Redirecting them to /login instead would hand fetch() an HTML body
  // with a 200, which the client would then fail to parse.
  if (pathname.startsWith('/console-api/')) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // Remember where they were headed so login can send them back.
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$).*)'],
};
