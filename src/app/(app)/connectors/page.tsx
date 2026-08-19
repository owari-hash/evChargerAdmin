import type { Metadata } from 'next';
import { ConnectorsView } from './connectors-view';

export const metadata: Metadata = { title: 'Connectors' };
export const dynamic = 'force-dynamic';

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; chargePointId?: string }>;
}) {
  const params = await searchParams;
  return (
    <ConnectorsView
      initialStatus={params.status ?? ''}
      initialChargePointId={params.chargePointId ?? ''}
    />
  );
}
