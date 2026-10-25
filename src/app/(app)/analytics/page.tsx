import type { Metadata } from 'next';
import { csmsSafe } from '@/lib/server-api';
import type { AnalyticsOverview } from '@/lib/types';
import { BackendDown } from '@/components/backend-down';
import { AnalyticsView } from './analytics-view';

export const metadata: Metadata = {
  title: 'Вэб & Апп Хандалт (Google Analytics) · Eplug Admin',
  description: 'Өдөр тутмын вэб болон мобайл апп-ын хандалтын статистик, Google Analytics мэдээлэл.',
};

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const initialData = await csmsSafe<AnalyticsOverview>('/analytics/overview?days=7');

  if (!initialData) {
    return <BackendDown />;
  }

  return <AnalyticsView initialData={initialData} />;
}
