import type { Metadata } from 'next';
import { JobsView } from './jobs-view';

export const metadata: Metadata = { title: 'Программ хангамж ба лог' };
export const dynamic = 'force-dynamic';

export default function JobsPage() {
  return <JobsView />;
}
