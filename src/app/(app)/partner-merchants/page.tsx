import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { PartnerMerchantsView } from './partner-merchants-view';

export const metadata: Metadata = { title: 'Мерчант — Хамтрагчдын API хандалт' };
export const dynamic = 'force-dynamic';

export default async function PartnerMerchantsPage() {
  const user = await getSessionUser();
  return (
    <PartnerMerchantsView
      canEdit={hasRole(user, 'OPERATOR')}
      canDelete={hasRole(user, 'ADMIN')}
    />
  );
}

