'use client';

import useSWR from 'swr';
import { apiUrl, fetcher } from '@/lib/client';
import { Checkbox } from '@/components/ui/primitives';
import type { Client, Paginated } from '@/lib/types';

/**
 * Ticks off every client a station should also be visible to, beyond its
 * single owner (`clientId`). Used when one shared site needs to show up on
 * several harилцагч's station lists and internal-member allow-lists.
 */
export function LinkedClientsSelect({
  ownerId,
  value,
  onChange,
}: {
  /** The station's owning client, excluded here — it is already linked by definition. */
  ownerId: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { data } = useSWR<Paginated<Client>>(apiUrl('clients', { limit: 200 }), fetcher);
  const clients = (data?.data ?? []).filter((c) => (c.id ?? c._id) !== ownerId);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  if (clients.length === 0) {
    return (
      <p className="text-xs text-[var(--color-fg-subtle)]">
        Өөр бүртгэлтэй харилцагч алга байна.
      </p>
    );
  }

  return (
    <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2 space-y-1">
      {clients.map((c) => {
        const id = c.id ?? c._id ?? '';
        return (
          <label
            key={id}
            className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-[var(--color-surface-2)] cursor-pointer"
          >
            <Checkbox checked={value.includes(id)} onChange={() => toggle(id)} />
            <span className="truncate">
              {c.name} {c.businessRegister ? `(${c.businessRegister})` : ''}
            </span>
          </label>
        );
      })}
    </div>
  );
}
