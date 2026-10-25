import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function IdTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const q = params.search ? `&search=${encodeURIComponent(params.search)}` : '';
  redirect(`/drivers?tab=rfid${q}`);
}
