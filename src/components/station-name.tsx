'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useStationNames } from '@/lib/use-station-names';

/**
 * A station reference: the human name first, the OCPP id as muted secondary
 * text (or just the id when the station has no name). Links to the station.
 *
 * `inline` puts the id in a tooltip instead of a second line, for compact rows.
 */
export function StationName({
  id,
  inline = false,
  link = true,
  className,
}: {
  id: string;
  inline?: boolean;
  link?: boolean;
  className?: string;
}) {
  const nameOf = useStationNames();
  const name = nameOf(id);

  const primary = (
    <span className={cn('font-medium', !name && 'font-mono')}>{name ?? id}</span>
  );

  const body =
    name && !inline ? (
      <span className="inline-flex flex-col leading-tight">
        {primary}
        <span className="font-mono text-[11px] font-normal text-[var(--color-fg-subtle)]">{id}</span>
      </span>
    ) : (
      primary
    );

  if (!link) {
    return (
      <span className={cn('text-xs', className)} title={name ? id : undefined}>
        {body}
      </span>
    );
  }

  return (
    <Link
      href={`/charge-points/${encodeURIComponent(id)}`}
      title={name ? id : undefined}
      onClick={(e) => e.stopPropagation()}
      className={cn('text-xs hover:text-[var(--color-brand)] hover:underline', className)}
    >
      {body}
    </Link>
  );
}

/** Plain-text variant for strings (toasts, modal descriptions, chart labels). */
export function useStationLabel() {
  const nameOf = useStationNames();
  return (id: string | null | undefined) => (id ? (nameOf(id) ?? id) : '');
}
