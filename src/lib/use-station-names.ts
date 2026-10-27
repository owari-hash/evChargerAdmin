'use client';

import useSWR from 'swr';
import { apiUrl, fetcher } from './client';
import type { ChargePoint, Paginated } from './types';

const PAGE = 200;
const MAX_PAGES = 10;

export interface StationLookupInfo {
  id: string;
  cpId: string;
  name?: string;
  displayName: string;
}

/**
 * Sessions, reservations, jobs, events… reference a station by its OCPP
 * identifier or internal mongo id. This loads the station list once and maps
 * both `cpId` and `id` to the station's readable name and cpId.
 */
async function loadNames(): Promise<Map<string, StationLookupInfo>> {
  const map = new Map<string, StationLookupInfo>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetcher<Paginated<ChargePoint>>(
      apiUrl('charge-points', { page, limit: PAGE }),
    );
    for (const cp of res.data) {
      const displayName = cp.name?.trim() || cp.cpId;
      const info: StationLookupInfo = {
        id: String(cp.id || cp._id || ''),
        cpId: cp.cpId,
        name: cp.name?.trim() || undefined,
        displayName,
      };
      if (cp.cpId) {
        map.set(cp.cpId, info);
        map.set(cp.cpId.toLowerCase(), info);
      }
      if (cp.id) {
        map.set(String(cp.id), info);
        map.set(String(cp.id).toLowerCase(), info);
      }
      if (cp._id) {
        map.set(String(cp._id), info);
        map.set(String(cp._id).toLowerCase(), info);
      }
    }
    if (page * PAGE >= res.total || res.data.length < PAGE) break;
  }
  return map;
}

export function useStationLookup() {
  const { data } = useSWR('station-names', loadNames, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  return (id: string | null | undefined): StationLookupInfo | undefined => {
    if (!id) return undefined;
    const clean = String(id).trim();
    return data?.get(clean) || data?.get(clean.toLowerCase());
  };
}

export function useStationNames() {
  const lookup = useStationLookup();
  return (id: string | null | undefined): string | undefined =>
    id ? lookup(id)?.displayName : undefined;
}
