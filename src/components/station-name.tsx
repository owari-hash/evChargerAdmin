'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useStationLookup, useStationNames } from '@/lib/use-station-names';

function isObjectId(val: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(val);
}

/**
 * A station reference: displays the human-friendly name first, and the OCPP cpId
 * (e.g. "EPLUG-001") as muted secondary text. Never displays raw 24-character
 * MongoDB ObjectIds.
 *
 * `inline` puts the cpId in a tooltip instead of a second line, for compact rows.
 */
export function StationName({
  id,
  name: fallbackName,
  cpId: fallbackCpId,
  inline = false,
  link = true,
  className,
}: {
  id: string;
  name?: string | null;
  cpId?: string | null;
  inline?: boolean;
  link?: boolean;
  className?: string;
}) {
  const lookup = useStationLookup();
  const station = lookup(id);

  const cleanName = fallbackName?.trim() || station?.name?.trim();
  const cleanCpId = fallbackCpId?.trim() || station?.cpId || (!isObjectId(id) ? id : undefined);

  // If there's a station name, use it; otherwise use the OCPP cpId; otherwise friendly short label
  const primaryText = cleanName || cleanCpId || (isObjectId(id) ? `Станц #${id.slice(-4)}` : id);

  // Subtext is the OCPP cpId (e.g. "EPLUG-01"), only shown if different from primary
  const subText = cleanName && cleanCpId && cleanName !== cleanCpId ? cleanCpId : null;

  const isMono = !cleanName && Boolean(cleanCpId);

  const primary = (
    <span className={cn('font-medium', isMono && 'font-mono')}>{primaryText}</span>
  );

  const body =
    subText && !inline ? (
      <span className="inline-flex flex-col leading-tight">
        {primary}
        <span className="font-mono text-[11px] font-normal text-[var(--color-fg-subtle)]">
          {subText}
        </span>
      </span>
    ) : (
      primary
    );

  const targetLink = station?.id || id;

  if (!link) {
    return (
      <span
        className={cn('text-xs', className)}
        title={subText ? `${primaryText} (${subText})` : primaryText}
      >
        {body}
      </span>
    );
  }

  return (
    <Link
      href={`/charge-points/${encodeURIComponent(targetLink)}`}
      title={subText ? `${primaryText} (${subText})` : primaryText}
      onClick={(e) => e.stopPropagation()}
      className={cn('text-xs hover:text-[var(--color-brand)] hover:underline', className)}
    >
      {body}
    </Link>
  );
}

/** Plain-text variant for strings (toasts, modal descriptions, chart labels). */
export function useStationLabel() {
  const lookup = useStationLookup();
  return (id: string | null | undefined): string => {
    if (!id) return '';
    const station = lookup(id);
    if (station?.displayName) return station.displayName;
    if (!isObjectId(id)) return id;
    return `Станц #${id.slice(-4)}`;
  };
}
