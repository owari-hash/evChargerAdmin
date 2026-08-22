import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { ConnectorsView } from './connectors-view';

export const metadata: Metadata = { title: 'Холбогч' };
export const dynamic = 'force-dynamic';

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; chargePointId?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  return (
    <ConnectorsView
      initialStatus={params.status ?? ''}
      initialChargePointId={params.chargePointId ?? ''}
      canOperate={hasRole(user, 'OPERATOR')}
    />
  );
}
