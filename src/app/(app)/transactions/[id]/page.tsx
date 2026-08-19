import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ApiError, csms, csmsSafe } from '@/lib/server-api';
import { getSessionUser, hasRole } from '@/lib/session';
import type { MeterValue, Paginated, Transaction } from '@/lib/types';
import { BackendDown } from '@/components/backend-down';
import { TransactionView } from './transaction-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `#${id} цэнэглэлт` };
}

export default async function TransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();

  let tx: Transaction;
  try {
    tx = await csms<Transaction>(`/transactions/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return <BackendDown what={`session #${id}`} />;
  }

  // 500 samples covers a long session at a 30s sample interval.
  const meterValues = await csmsSafe<Paginated<MeterValue>>(
    `/transactions/${encodeURIComponent(id)}/meter-values`,
    { query: { limit: 500 } },
  );

  return (
    <TransactionView
      tx={tx}
      meterValues={meterValues?.data ?? []}
      meterValueTotal={meterValues?.total ?? 0}
      canOperate={hasRole(user, 'OPERATOR')}
    />
  );
}
