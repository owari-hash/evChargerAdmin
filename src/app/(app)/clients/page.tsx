import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { ClientsView } from './clients-view';

export const metadata: Metadata = { title: 'Харилцагч — Удирдлага' };
export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const user = await getSessionUser();
  return (
    <ClientsView
      canEdit={hasRole(user, 'OPERATOR')}
      canDelete={hasRole(user, 'OPERATOR')}
    />
  );
}
