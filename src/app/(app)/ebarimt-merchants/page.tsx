import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { EbarimtMerchantsView } from './ebarimt-merchants-view';

export const metadata: Metadata = { title: 'И-Баримт мерчант' };
export const dynamic = 'force-dynamic';

export default async function EbarimtMerchantsPage() {
  const user = await getSessionUser();
  return (
    <EbarimtMerchantsView
      canEdit={hasRole(user, 'OPERATOR')}
      canDelete={hasRole(user, 'ADMIN')}
    />
  );
}