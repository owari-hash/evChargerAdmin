import type { Metadata } from 'next';
import { ChargingProfilesView } from './charging-profiles-view';

export const metadata: Metadata = { title: 'Ухаалаг цэнэглэлт' };
export const dynamic = 'force-dynamic';

export default function ChargingProfilesPage() {
  return <ChargingProfilesView />;
}
