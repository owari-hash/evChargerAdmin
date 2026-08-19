import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { ReservationsView } from './reservations-view';

export const metadata: Metadata = { title: 'Reservations' };
export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const user = await getSessionUser();
  return <ReservationsView canOperate={hasRole(user, 'OPERATOR')} />;
}
