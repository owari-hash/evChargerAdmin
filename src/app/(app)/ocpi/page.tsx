import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { OcpiView } from './ocpi-view';

export const metadata: Metadata = { title: 'OCPI 2.2.1 Роаминг — charger.mn' };
export const dynamic = 'force-dynamic';

export default async function OcpiPage() {
  const user = await getSessionUser();
  return <OcpiView canAdmin={hasRole(user, 'ADMIN')} />;
}
