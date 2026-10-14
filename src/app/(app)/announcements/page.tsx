import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { AnnouncementsView } from './announcements-view';

export const metadata: Metadata = { title: 'Мэдээ' };
export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const user = await getSessionUser();
  return <AnnouncementsView canEdit={hasRole(user, 'OPERATOR')} />;
}
