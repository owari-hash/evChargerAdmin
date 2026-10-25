import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { csmsSafe } from '@/lib/server-api';
import { getSessionUser, hasRole } from '@/lib/session';
import type { DriverDetailResponse } from '@/lib/types';
import { DriverDetailView } from './driver-detail-view';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Жолоочийн дэлгэрэнгүй · Eplug Admin` };
}

export const dynamic = 'force-dynamic';

export default async function DriverDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getSessionUser();
  const data = await csmsSafe<DriverDetailResponse>(`/drivers/${encodeURIComponent(id)}`);

  if (!data) {
    notFound();
  }

  return (
    <DriverDetailView
      driverId={id}
      canEdit={hasRole(user, 'OPERATOR')}
      initialData={data}
    />
  );
}
