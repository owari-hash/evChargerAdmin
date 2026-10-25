import type { Metadata } from 'next';
import { EbarimtView } from './ebarimt-view';

export const metadata: Metadata = { title: 'И-Баримт' };
export const dynamic = 'force-dynamic';

export default async function EbarimtPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  return <EbarimtView initialQuery={params.q ?? ''} initialStatus={params.status ?? 'ALL'} />;
}
