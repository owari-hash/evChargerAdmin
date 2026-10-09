'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Tables are the primary surface in this console. Each one scrolls inside its
 * own box — both axes — with a sticky header, so the card's pagination footer
 * stays in view below it and the page itself rarely needs to scroll.
 */

/** Never shrink a list below this, however little room is left. */
const MIN_HEIGHT = 240;

/**
 * Space taken below `el` up to the end of <main>: following siblings at each
 * level (pagination, footnotes) plus each container's bottom padding, border
 * and margin. Measured, so a page with tabs or stat cards above its table
 * still keeps the pagination on screen.
 */
function spaceBelow(el: HTMLElement): number {
  let total = 0;
  let node: HTMLElement | null = el;
  while (node && node.tagName !== 'MAIN' && node !== document.body) {
    total += parseFloat(getComputedStyle(node).marginBottom) || 0;
    let sib = node.nextElementSibling as HTMLElement | null;
    while (sib) {
      const cs = getComputedStyle(sib);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') {
        total += sib.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      }
      sib = sib.nextElementSibling as HTMLElement | null;
    }
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    const ps = getComputedStyle(parent);
    total += (parseFloat(ps.paddingBottom) || 0) + (parseFloat(ps.borderBottomWidth) || 0);
    // Flex/grid gaps between this level's children.
    const gap = parseFloat(ps.rowGap) || 0;
    if (gap && node.nextElementSibling) total += gap;
    node = parent;
  }
  return total;
}

/** Fills the viewport from the table's top down to just above what follows it. */
function useFitHeight(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [height, setHeight] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        const next = Math.max(MIN_HEIGHT, Math.floor(window.innerHeight - top - spaceBelow(el)));
        setHeight((prev) => (prev === next ? prev : next));
      });
    };
    measure();
    window.addEventListener('resize', measure);
    // Content above or below (stat cards loading, filters wrapping) moves it.
    const observer = new ResizeObserver(measure);
    const main = el.closest('main') ?? document.body;
    observer.observe(main);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [ref, enabled]);

  return height;
}

export function TableWrap({
  className,
  style,
  scroll = true,
  maxHeight,
  onScroll,
  ...props
}: React.ComponentProps<'div'> & {
  /** false = no vertical scroll box (the table grows with its rows). */
  scroll?: boolean;
  /**
   * Any CSS length for embedded tables, e.g. '24rem'. Left out, the table
   * fills the screen height that is left, keeping pagination in view.
   */
  maxHeight?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const fitted = useFitHeight(ref, scroll && maxHeight === undefined);
  const [scrolled, setScrolled] = React.useState(false);
  const resolved = maxHeight ?? (fitted !== null ? `${fitted}px` : undefined);

  return (
    <div
      ref={ref}
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
      style={scroll && resolved ? { maxHeight: resolved, ...style } : style}
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
