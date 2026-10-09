'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Tables are the primary surface in this console. Each one scrolls inside its
 * own box — both axes — with a sticky header, so the card's pagination footer
 * stays in view below it and the page itself rarely needs to scroll.
 */

/**
 * Default scroll height: the viewport minus the app chrome around a list
 * (topbar, page padding, filter bar, pagination), never below 320px.
 */
const DEFAULT_MAX_HEIGHT = 'max(320px, calc(100dvh - 17rem))';

export function TableWrap({
  className,
  style,
  scroll = true,
  maxHeight = DEFAULT_MAX_HEIGHT,
  onScroll,
  ...props
}: React.ComponentProps<'div'> & {
  /** false = no vertical scroll box (the table grows with its rows). */
  scroll?: boolean;
  /** Any CSS length; smaller for embedded tables, e.g. '24rem'. */
  maxHeight?: string;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  return (
    <div
      data-scrolled={scrolled || undefined}
      onScroll={(e) => {
        const next = e.currentTarget.scrollTop > 0;
        if (next !== scrolled) setScrolled(next);
        onScroll?.(e);
      }}
      className={cn(
        'group/table scroll-thin w-full overflow-x-auto',
        scroll && 'overflow-y-auto overscroll-y-contain',
        className,
      )}
      style={scroll ? { maxHeight, ...style } : style}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('w-full min-w-full border-collapse text-sm', className)} {...props} />;
}

export function THead({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn(
        // Sticky inside TableWrap. Borders on sticky rows vanish with
        // border-collapse, so the divider is an inset shadow on the cells.
        'sticky top-0 z-[1] bg-[var(--color-surface)]',
        '[&_th]:bg-[var(--color-surface)] [&_th]:shadow-[inset_0_-1px_0_var(--color-border)]',
        'group-data-[scrolled]/table:[&_th]:shadow-[inset_0_-1px_0_var(--color-border),0_6px_10px_-8px_rgba(0,0,0,0.35)]',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Header cells are always centered across the console; body cells follow the
 * same default so every column lines up under its header. `align` on TD stays
 * available for the rare cell that genuinely needs it.
 */
export function TH({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-center text-xs font-medium text-[var(--color-fg-muted)]',
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-[var(--color-border)]', className)} {...props} />;
}

export function TR({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<'tr'> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors',
        interactive && 'cursor-pointer hover:bg-[var(--color-surface-2)]',
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  align = 'center',
  ...props
}: React.ComponentProps<'td'> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-4 py-2.5 text-[var(--color-fg)]',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-[var(--color-fg-muted)]">
        {children}
      </td>
    </tr>
  );
}

export function TableLoading({ colSpan, rows = 5 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--color-surface-2)]" />
          </td>
        </tr>
      ))}
    </>
  );
}
