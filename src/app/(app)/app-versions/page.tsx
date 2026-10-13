import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { AppVersionsView } from './app-versions-view';

export const metadata: Metadata = { title: 'Апп хувилбар' };
export const dynamic = 'force-dynamic';

export default async function AppVersionsPage() {
  const user = await getSessionUser();
  return <AppVersionsView canEdit={hasRole(user, 'OPERATOR')} />;
}
