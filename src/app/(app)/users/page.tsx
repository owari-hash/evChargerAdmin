import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser, hasRole } from '@/lib/session';
import { UsersView } from './users-view';

export const metadata: Metadata = { title: 'Хэрэглэгчид' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await getSessionUser();
  // The backend enforces this too; redirecting keeps a VIEWER out of a page
  // that would only show them errors.
  if (!hasRole(user, 'ADMIN')) redirect('/');

  return <UsersView currentUserId={user!.id} />;
}
