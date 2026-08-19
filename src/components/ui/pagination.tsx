'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Select } from './primitives';
import { formatNumber } from '@/lib/format';

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  label = 'rows',
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-fg-muted)]">
      <div className="flex items-center gap-3">
        <span className="tnum">
          {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)} {label}
        </span>
        {onLimitChange ? (
          <Select
            className="h-7 w-auto py-0 text-xs"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>
        <span className="tnum">
          Page {formatNumber(page)} / {formatNumber(pages)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** Filter row that sits directly above a table. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
      {children}
    </div>
  );
}
