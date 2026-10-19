import type { Metadata } from 'next';
import { csmsSafe } from '@/lib/server-api';
import { getSessionUser, hasRole } from '@/lib/session';
import type { Client } from '@/lib/types';
import { ClientDetailView } from './client-detail-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const clientId = decodeURIComponent(id);
  const client = await csmsSafe<Client>(`/clients/${encodeURIComponent(clientId)}`);
  const name = client?.name?.trim();
  return { title: name ? `${name} — Харилцагч` : 'Харилцагчийн дэлгэрэнгүй' };
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
