import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { TransactionsView } from './transactions-view';

export const metadata: Metadata = { title: 'Цэнэглэлт' };
export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; chargePointId?: string; idTag?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const isClient = user?.role === 'CLIENT' || Boolean(user?.clientId);
  const canAdmin = hasRole(user, 'ADMIN');

  return (
    <TransactionsView
      canOperate={hasRole(user, 'OPERATOR')}
      canAdmin={canAdmin}
      isClient={isClient}
      initialStatus={params.status ?? ''}
      initialChargePointId={params.chargePointId ?? ''}
      initialIdTag={params.idTag ?? ''}
      initialFrom={params.from}
      initialTo={params.to}
    />
  );
}
