import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { ChargePointsView } from './charge-points-view';

export const metadata: Metadata = { title: 'Charge points' };
export const dynamic = 'force-dynamic';

export default async function ChargePointsPage() {
  const user = await getSessionUser();
  return <ChargePointsView canEdit={hasRole(user, 'OPERATOR')} />;
}
