import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { DriversView } from './drivers-view';

export const metadata: Metadata = {
  title: 'Жолооч ба RFID карт · Eplug Admin',
  description: 'Цэнэглэгч ашиглагч жолооч нарын бүртгэл, хэтэвч болон холбогдсон RFID картын удирдлага.',
};

export const dynamic = 'force-dynamic';

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; search?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  return <DriversView canEdit={hasRole(user, 'OPERATOR')} initialTab={params.tab} />;
}
