import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { csms } from '@/lib/server-api';
import type { ChargePointDetail } from '@/lib/types';
import { StickerSheet } from './sticker-sheet';

export const metadata: Metadata = { title: 'QR наалт' };
export const dynamic = 'force-dynamic';

export default async function StickersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const detail = await csms<ChargePointDetail>(`/charge-points/${encodeURIComponent(id)}`).catch(
    () => null,
  );
  if (!detail) notFound();

  // connectorId 0 is the station as a whole, so it carries no code and no sticker.
  const guns = (detail.connectors ?? [])
    .filter((c) => c.connectorId > 0 && c.code)
    .sort((a, b) => a.connectorId - b.connectorId);

  return (
    <StickerSheet
      stationName={detail.name?.trim() || detail.cpId}
      address={detail.address ?? null}
      chargePointId={detail.id}
      connectors={guns}
    />
  );
}
