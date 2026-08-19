import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ApiError, csms } from '@/lib/server-api';
import { getSessionUser, hasRole } from '@/lib/session';
import type { ChargePointDetail } from '@/lib/types';
import { BackendDown } from '@/components/backend-down';
import { ChargePointView } from './charge-point-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: decodeURIComponent(id) };
}

export default async function ChargePointPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chargePointId = decodeURIComponent(id);
  const user = await getSessionUser();

  let detail: ChargePointDetail;
  try {
    detail = await csms<ChargePointDetail>(`/charge-points/${encodeURIComponent(chargePointId)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return <BackendDown what={`${chargePointId} станц`} />;
  }

  return (
    <ChargePointView
      detail={detail}
      canOperate={hasRole(user, 'OPERATOR')}
      canAdmin={hasRole(user, 'ADMIN')}
    />
  );
}
