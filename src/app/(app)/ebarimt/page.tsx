import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { EbarimtView } from './ebarimt-view';

export const metadata: Metadata = { title: 'И-Баримт' };
export const dynamic = 'force-dynamic';

export default async function EbarimtPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getSessionUser();
  const canAdmin = hasRole(user, 'ADMIN') && !user?.clientId;
  const isClient = user?.role === 'CLIENT' || Boolean(user?.clientId);
  const params = await searchParams;
  return (
    <EbarimtView
      initialQuery={params.q ?? ''}
      initialStatus={params.status ?? 'ALL'}
      canAdmin={canAdmin}
      isClient={isClient}
    />
  );
}
