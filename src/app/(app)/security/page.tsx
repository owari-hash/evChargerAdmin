import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { SecurityView } from './security-view';

export const metadata: Metadata = { title: 'Аюулгүй байдал' };
export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const user = await getSessionUser();
  return (
    <SecurityView canOperate={hasRole(user, 'OPERATOR')} canAdmin={hasRole(user, 'ADMIN')} />
  );
}
