import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { ReportsView } from './reports-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Тайлан ба тооцоолол',
};

export default async function ReportsPage() {
  const user = await getSessionUser();
  return <ReportsView user={user} />;
}
