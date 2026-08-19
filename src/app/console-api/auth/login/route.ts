import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { serverConfig } from '@/lib/config';
import { readPrincipal, setSessionCookie } from '@/lib/session';
import type { SessionUser } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'И-мэйл, нууц үгээ зөв оруулна уу' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${serverConfig.apiUrl}${serverConfig.apiBasePath}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'CSMS сервертэй холбогдож чадсангүй. CSMS_API_URL-ээ шалгана уу.' },
      { status: 502 },
    );
  }

  const payload = (await upstream.json().catch(() => null)) as {
    token?: string;
    user?: SessionUser;
    error?: string;
  } | null;

  if (!upstream.ok || !payload?.token) {
    return NextResponse.json(
      { error: payload?.error ?? 'И-мэйл эсвэл нууц үг буруу' },
      { status: upstream.status === 200 ? 502 : upstream.status },
    );
  }

  const user = payload.user ?? readPrincipal(payload.token);
  if (!user) {
    return NextResponse.json({ error: 'Серверээс уншигдахгүй токен ирлээ' }, { status: 502 });
  }

  await setSessionCookie(payload.token);
  return NextResponse.json({ user });
}
