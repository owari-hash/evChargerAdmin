'use client';

import useSWR from 'swr';
import { apiUrl, fetcher } from './client';
import type { ChargePoint, Paginated } from './types';

const PAGE = 200;
const MAX_PAGES = 10;

/**
 * Sessions, reservations, jobs, events… reference a station only by its OCPP
 * identifier. Operators read stations by name, so this loads the station list
 * once (SWR dedupes it across every table on the page) and maps both `cpId` and
 * the CSMS `id` to the station's name.
 */
async function loadNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetcher<Paginated<ChargePoint>>(
      apiUrl('charge-points', { page, limit: PAGE }),
    );
    for (const cp of res.data) {
      const name = cp.name?.trim();
      if (!name) continue;
      names.set(cp.cpId, name);
      names.set(cp.id, name);
    }
    if (page * PAGE >= res.total || res.data.length < PAGE) break;
  }
  return names;
}

export function useStationNames() {
  const { data } = useSWR('station-names', loadNames, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  return (id: string | null | undefined): string | undefined =>
    id ? data?.get(id) : undefined;
}
