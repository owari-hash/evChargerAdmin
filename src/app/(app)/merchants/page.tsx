import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { MerchantsView } from './merchants-view';

export const metadata: Metadata = { title: 'QPay мерчант' };
export const dynamic = 'force-dynamic';

export default async function MerchantsPage() {
  const user = await getSessionUser();
  return (
    <MerchantsView
      canEdit={hasRole(user, 'OPERATOR')}
      canDelete={hasRole(user, 'ADMIN')}
    />
  );
}
