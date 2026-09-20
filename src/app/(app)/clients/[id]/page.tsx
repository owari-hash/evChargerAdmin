import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { ClientDetailView } from './client-detail-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Харилцагч — ${decodeURIComponent(id)}` };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = decodeURIComponent(id);
  const user = await getSessionUser();

  return (
    <ClientDetailView
      clientId={clientId}
      canEdit={hasRole(user, 'OPERATOR')}
      canAdmin={hasRole(user, 'ADMIN')}
    />
  );
}
