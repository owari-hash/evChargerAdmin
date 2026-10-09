'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from './primitives';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

/**
 * Page numbers to show around `page`: always the first and last, two either
 * side of the current one, and an ellipsis for any gap.
 */
function pageWindow(page: number, pages: number): (number | 'gap')[] {
  const wanted = new Set<number>([1, pages]);
  for (let p = page - 1; p <= page + 1; p++) if (p >= 1 && p <= pages) wanted.add(p);
  // Near either end, show a full run instead of a lone ellipsis.
  if (page <= 3) [2, 3, 4].forEach((p) => p <= pages && wanted.add(p));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => p >= 1 && wanted.add(p));

  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const PAGE_SIZES = [25, 50, 100, 200];

/**
 * The standard sizes up to what the endpoint accepts, plus `limit` itself if
 * a page asked for another one.
 */
function pageSizes(limit: number, maxLimit: number): number[] {
  const sizes = PAGE_SIZES.filter((n) => n <= maxLimit);
  return sizes.includes(limit) ? sizes : [...sizes, limit].sort((a, b) => a - b);
}

const PAGE_BTN =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium tnum ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ' +
  'disabled:pointer-events-none disabled:opacity-40';
const PAGE_IDLE =
  'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] ' +
  'hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]';
const PAGE_ACTIVE =
  'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)] font-semibold';

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  label = 'rows',
  maxLimit = Infinity,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  label?: string;
  /** The endpoint's own page-size cap, so no size it rejects is offered. */
  maxLimit?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Хуудаслалт"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-fg-muted)]"
    >
      <span className="tnum">
        {formatNumber(total)} {label}-аас {formatNumber(first)}–{formatNumber(last)}
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={cn(PAGE_BTN, PAGE_IDLE, 'w-8 px-0')}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Өмнөх хуудас"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageWindow(page, pages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="inline-flex h-8 w-6 items-center justify-center" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={cn(PAGE_BTN, p === page ? PAGE_ACTIVE : PAGE_IDLE)}
              onClick={() => p !== page && onPageChange(p)}
              aria-label={`${formatNumber(p)}-р хуудас`}
              aria-current={p === page ? 'page' : undefined}
            >
              {formatNumber(p)}
            </button>
          ),
        )}

        <button
          type="button"
          className={cn(PAGE_BTN, PAGE_IDLE, 'w-8 px-0')}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Дараах хуудас"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {onLimitChange ? (
          <Select
            className="ml-1.5 h-8 w-auto py-0 text-xs"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Хуудсанд харуулах мөр"
          >
            {pageSizes(limit, maxLimit).map((n) => (
              <option key={n} value={n}>
                {n} / хуудас
              </option>
            ))}
          </Select>
        ) : null}
      </div>
    </nav>
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

/**
 * The page's own actions (e.g. "+ Станц бүртгэх"), placed last in a FilterBar
 * so they share the filters' line and height instead of floating above the
 * card. `ml-auto` keeps them right-aligned, including when the row wraps on
 * narrow screens. Renders nothing when there is nothing to show.
 */
export function FilterActions({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>;
}
