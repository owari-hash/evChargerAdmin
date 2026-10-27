import type { Metadata } from 'next';
import { PaymentsView } from './payments-view';

export const metadata: Metadata = { title: 'Төлбөр' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const initialStatus = params.status !== undefined ? params.status : 'PAID';
  return <PaymentsView initialQuery={params.q ?? ''} initialStatus={initialStatus} />;
}
