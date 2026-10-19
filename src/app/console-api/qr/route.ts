import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getSessionUser } from '@/lib/session';

/**
 * Renders a QR code as PNG for the console to display and print.
 *
 * Server-side rather than in the browser so the connector cards and the sticker
 * sheet cost the client bundle nothing, and so a print preview has the codes in
 * its first paint instead of after hydration.
 *
 * Always black on white regardless of console theme: a code inverted for dark
 * mode is within spec but a good number of phone cameras will not read it, and
 * these end up on a printed label anyway.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // The proxy already gates this path, but the check is cheap and this endpoint
  // would otherwise be an open encoder for anyone who got past it.
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });
  }

  const url = new URL(request.url);
  const data = url.searchParams.get('data')?.trim();
  if (!data) {
    return NextResponse.json({ error: 'data шаардлагатай' }, { status: 400 });
  }
  // A connector sticker URL is ~24 characters; anything near this cap is misuse.
  if (data.length > 512) {
    return NextResponse.json({ error: 'data хэт урт байна' }, { status: 400 });
  }

  const sizeParam = url.searchParams.get('size') || url.searchParams.get('width');
  const width = sizeParam
    ? Math.min(2048, Math.max(64, parseInt(sizeParam, 10) || 512))
    : 512;

  const png = await QRCode.toBuffer(data, {
    type: 'png',
    width,
    // Quartile survives a scratched or partly iced label in the field.
    errorCorrectionLevel: 'Q',
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      // The code for a given string never changes, so let the browser keep it.
      'cache-control': 'private, max-age=86400, immutable',
    },
  });
}
