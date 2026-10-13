import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser, hasRole } from '@/lib/session';
import { SettlementsView } from './settlements-view';

export const metadata: Metadata = { title: 'Тооцоо' };
export const dynamic = 'force-dynamic';

export default async function SettlementsPage() {
  const user = await getSessionUser();
  // The backend enforces this too; redirecting keeps a VIEWER out of a page
  // that would only show them errors.
  if (!hasRole(user, 'OPERATOR')) redirect('/');

  return <SettlementsView canAdmin={hasRole(user, 'ADMIN')} />;
}
