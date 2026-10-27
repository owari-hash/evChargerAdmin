import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { PaymentsView } from './payments-view';

export const metadata: Metadata = { title: 'Төлбөр' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getSessionUser();
  const canAdmin = hasRole(user, 'ADMIN') && !user?.clientId;
  const params = await searchParams;
  const initialStatus = params.status !== undefined ? params.status : 'PAID';
  return (
    <PaymentsView
      initialQuery={params.q ?? ''}
      initialStatus={initialStatus}
      canAdmin={canAdmin}
    />
  );
}

