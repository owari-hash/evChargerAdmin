import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { FeedbackView } from './feedback-view';

export const metadata: Metadata = { title: 'Санал хүсэлт' };
export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const user = await getSessionUser();
  return <FeedbackView canEdit={hasRole(user, 'OPERATOR')} />;
}
