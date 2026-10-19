import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ApiError, csms, csmsSafe } from '@/lib/server-api';
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
  const chargePointId = decodeURIComponent(id);
  const detail = await csmsSafe<ChargePointDetail>(`/charge-points/${encodeURIComponent(chargePointId)}`);

  const isHexId = /^[0-9a-fA-F]{24}$/.test(chargePointId);
  const name = detail?.name?.trim();
  const cpId = detail?.cpId?.trim();

  let title = 'Цэнэглэх станц';
  if (name && cpId && name !== cpId) {
    title = `${name} (${cpId})`;
  } else if (name) {
    title = name;
  } else if (cpId && !/^[0-9a-fA-F]{24}$/.test(cpId)) {
    title = cpId;
  } else if (!isHexId) {
    title = chargePointId;
  }

  return { title };
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
