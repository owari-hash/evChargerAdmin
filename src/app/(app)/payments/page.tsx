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
  return <PaymentsView initialQuery={params.q ?? ''} initialStatus={params.status ?? ''} />;
}
