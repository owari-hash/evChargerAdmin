import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { IdTagsView } from './id-tags-view';

export const metadata: Metadata = { title: 'RFID карт' };
export const dynamic = 'force-dynamic';

export default async function IdTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  return <IdTagsView canEdit={hasRole(user, 'OPERATOR')} initialSearch={params.search ?? ''} />;
}
