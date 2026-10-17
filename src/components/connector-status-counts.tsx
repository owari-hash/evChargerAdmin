'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, ArrowUpRight } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui/primitives';
import { connectorTone } from '@/components/ui/status';
import { CONNECTOR_STATUS, mn } from '@/lib/mn';
import { formatNumber } from '@/lib/format';
import { CONNECTOR_STATUSES, type ConnectorStatus } from '@/lib/types';
import { cn } from '@/lib/cn';

interface ConnectorStatusCountsProps {
  /** Record of status -> count */
  counts: Record<string, number>;
  /** Currently selected status ('' for all) */
  selectedStatus: string;
  /** Callback when status is clicked */
  onSelectStatus?: (status: string) => void;
  /** Total count (if not provided, will sum the counts) */
  total?: number;
  /** If provided, renders links to /connectors?status=... instead of or alongside clicking */
  linkPrefix?: string;
  /** Class name */
  className?: string;
  /** Show the "Бүгд" (All) tab */
  showAll?: boolean;
}

/**
 * Standard priority order for connector statuses so they appear logically grouped:
 * Available -> Charging -> Preparing -> Suspended -> Finishing -> Reserved -> Unavailable -> Faulted
 */
const STATUS_ORDER: ConnectorStatus[] = [
  'Available',
  'Charging',
  'Preparing',
  'SuspendedEV',
  'SuspendedEVSE',
  'Finishing',
  'Reserved',
  'Unavailable',
  'Faulted',
];

export function ConnectorStatusCounts({
  counts,
  selectedStatus,
  onSelectStatus,
  total,
  linkPrefix,
  className,
  showAll = true,
}: ConnectorStatusCountsProps) {
  // Compute overall total from non-zero values if total isn't passed
  const computedTotal =
    total ??
    Object.entries(counts).reduce((sum, [, count]) => sum + (Number(count) || 0), 0);

  // Group statuses: first ordered ones that exist or have count > 0, then any others
  const entries = React.useMemo(() => {
    const list: { status: string; count: number }[] = [];
    const seen = new Set<string>();

    // First add standard ones that have count > 0
    for (const s of STATUS_ORDER) {
      const count = counts[s] ?? 0;
      if (count > 0 || selectedStatus === s) {
        list.push({ status: s, count });
        seen.add(s);
      }
    }

    // Add any non-standard ones present in counts
    for (const [s, count] of Object.entries(counts)) {
      if (!seen.has(s) && (count > 0 || selectedStatus === s)) {
        list.push({ status: s, count });
        seen.add(s);
      }
    }

    return list;
  }, [counts, selectedStatus]);

  return (
    <div
      role="toolbar"
      aria-label="Холбогчийн төлөвөөр шүүх"
      className={cn(
        'scroll-thin flex snap-x items-center gap-2 overflow-x-auto pb-1.5 pt-0.5',
        className,
      )}
    >
      {/* "All" button */}
      {showAll ? (
        <button
          type="button"
          onClick={() => onSelectStatus?.('')}
          className={cn(
            'group relative flex shrink-0 snap-start items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all select-none',
            selectedStatus === ''
              ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-sm ring-2 ring-[var(--color-brand)]/25 font-semibold'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          {selectedStatus === '' ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-white stroke-[2.5]" aria-hidden="true" />
          ) : null}
          <span>Бүгд</span>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.2 text-[11px] font-bold tnum',
              selectedStatus === ''
                ? 'bg-white/20 text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] group-hover:bg-[var(--color-border)]',
            )}
          >
            {formatNumber(computedTotal)}
          </span>
        </button>
      ) : null}

      {/* Status pills */}
      {entries.map(({ status: s, count }) => {
        const isActive = selectedStatus === s;
        const tone: Tone = connectorTone(s);

        return (
          <button
            key={s}
            type="button"
            onClick={() => {
              if (onSelectStatus) {
                onSelectStatus(isActive ? '' : s);
              }
            }}
            aria-pressed={isActive}
            className={cn(
              'group relative flex shrink-0 snap-start items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all select-none',
              isActive
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-fg)] shadow-sm ring-2 ring-[var(--color-brand)]/40 font-semibold'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
            )}
          >
            {isActive ? (
              <Check
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)] stroke-[2.5]"
                aria-hidden="true"
              />
            ) : null}

            <Badge
              tone={tone}
              className={cn(
                'transition-colors',
                isActive && 'ring-1 ring-[var(--color-brand)]/40 font-semibold',
              )}
            >
              {mn(CONNECTOR_STATUS, s)}
            </Badge>

            <span
              className={cn(
                'rounded-full px-1.5 py-0.2 text-[11px] font-bold tnum',
                isActive
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] group-hover:bg-[var(--color-border)] group-hover:text-[var(--color-fg)]',
              )}
            >
              {formatNumber(count)}
            </span>

            {linkPrefix && !onSelectStatus ? (
              <Link
                href={`${linkPrefix}?status=${encodeURIComponent(s)}`}
                className="ml-0.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-brand)]"
                title={`${mn(CONNECTOR_STATUS, s)} холбогчдыг харах`}
                onClick={(e) => e.stopPropagation()}
              >
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
