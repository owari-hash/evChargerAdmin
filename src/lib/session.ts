import 'server-only';

import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';
import { serverConfig } from './config';
import type { SessionUser, UserRole } from './types';

/**
 * The backend JWT lives in an httpOnly cookie, so no script running in the page
 * can read it. Every browser request to the CSMS goes through this app's proxy
 * route, which re-attaches the token server-side.
 */

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(serverConfig.cookieName)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(serverConfig.cookieName, token, {
    httpOnly: true,
    secure: serverConfig.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: tokenTtlSeconds(token),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(serverConfig.cookieName, '', {
    httpOnly: true,
    secure: serverConfig.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Read the principal out of the token. The signature is NOT verified here — this
 * app does not hold JWT_SECRET, and it does not need to: the token is only ever
 * used to talk to the backend, which verifies it on every call. This is used for
 * rendering (which nav items to show), never as the sole gate on a privileged
 * action.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return readPrincipal(token);
}

export function readPrincipal(token: string): SessionUser | null {
  try {
    const claims = decodeJwt(token) as Partial<SessionUser> & { exp?: number };
    if (!claims.id || !claims.email || !claims.role) return null;
    if (claims.exp && claims.exp * 1000 <= Date.now()) return null;
    return { id: claims.id, email: claims.email, role: claims.role };
  } catch {
    return null;
  }
}

function tokenTtlSeconds(token: string): number {
  try {
    const { exp } = decodeJwt(token);
    if (!exp) return 12 * 60 * 60;
    return Math.max(60, Math.floor(exp - Date.now() / 1000));
  } catch {
    return 12 * 60 * 60;
  }
}

const RANK: Record<UserRole, number> = { VIEWER: 0, OPERATOR: 1, ADMIN: 2 };

export function hasRole(user: SessionUser | null, min: UserRole): boolean {
  if (!user) return false;
  return RANK[user.role] >= RANK[min];
}
