import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { TransactionsView } from './transactions-view';

export const metadata: Metadata = { title: 'Sessions' };
export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; chargePointId?: string; idTag?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();

  return (
    <TransactionsView
      canOperate={hasRole(user, 'OPERATOR')}
      initialStatus={params.status ?? ''}
      initialChargePointId={params.chargePointId ?? ''}
      initialIdTag={params.idTag ?? ''}
    />
  );
}
