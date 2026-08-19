import type { Metadata } from 'next';
import { LiveView } from './live-view';

export const metadata: Metadata = { title: 'Шууд урсгал' };
export const dynamic = 'force-dynamic';

export default function LivePage() {
  return <LiveView />;
}
