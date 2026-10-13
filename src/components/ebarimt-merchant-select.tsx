'use client';

import useSWR from 'swr';
import { apiUrl, fetcher } from '@/lib/client';
import { Select } from '@/components/ui/primitives';

interface EbarimtMerchantOption {
  id?: string;
  _id?: string;
  name: string;
  merchantTin: string;
  isDefault?: boolean;
  enabled?: boolean;
}

/**
 * Picks an e-barimt merchant for a client or a station. The blank option means
 * "inherit", and `blankLabel` says from where.
 */
export function EbarimtMerchantSelect({
  value,
  onChange,
  blankLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  blankLabel: string;
}) {
  const { data } = useSWR<{ data: EbarimtMerchantOption[] }>(
    apiUrl('ebarimt-merchants', { limit: 200 }),
    fetcher,
  );
  const merchants = data?.data ?? [];

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{blankLabel}</option>
      {merchants.map((m) => {
        const id = m.id ?? m._id ?? '';
        return (
          <option key={id} value={id}>
            {`${m.name} (${m.merchantTin})${m.isDefault ? ' · үндсэн' : ''}${m.enabled === false ? ' · идэвхгүй' : ''}`}
          </option>
        );
      })}
    </Select>
  );
}

/** Blank → null (clear / inherit); otherwise a percentage, or `undefined` when invalid. */
export function parseFeePercent(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return n;
}

/** Name of one e-barimt merchant, for detail panels. */
export function EbarimtMerchantName({ id, fallback }: { id?: string | null; fallback: string }) {
  const { data, error } = useSWR<EbarimtMerchantOption>(
    id ? apiUrl(`ebarimt-merchants/${encodeURIComponent(id)}`) : null,
    fetcher,
  );
  if (!id) return <>{fallback}</>;
  if (error) return <span className="font-mono">{id}</span>;
  if (!data) return <>…</>;
  return <>{`${data.name} (${data.merchantTin})`}</>;
}

/** "Сүлжээний үндсэн (2%)" — the network default fee that an unset value inherits. */
export function NetworkDefaultFee() {
  const { data } = useSWR<{ defaultFeePercent: number }>(apiUrl('settlements/config'), fetcher, {
    revalidateOnFocus: false,
  });
  return <>{data ? `Сүлжээний үндсэн (${data.defaultFeePercent}%)` : 'Сүлжээний үндсэн'}</>;
}
