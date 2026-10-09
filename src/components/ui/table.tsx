import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Tables are the primary surface in this console, so they get a fixed header,
 * horizontal scrolling inside their own container, and tabular numerals.
 */

export function TableWrap({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('w-full overflow-x-auto', className)} {...props} />;
}

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('w-full min-w-full border-collapse text-sm', className)} {...props} />;
}

export function THead({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn('border-b border-[var(--color-border)] bg-[var(--color-surface-2)]', className)}
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
