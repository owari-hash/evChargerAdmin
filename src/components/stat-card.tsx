import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CountUp } from '@/components/count-up';
import type { Tone } from '@/components/ui/primitives';

const ICON_TONES: Record<Tone, string> = {
  ok: 'bg-[var(--color-ok-soft)] text-[var(--color-ok)] shadow-[0_0_18px_-2px_var(--color-ok)]',
  warn: 'bg-[var(--color-warn-soft)] text-[var(--color-warn)] shadow-[0_0_18px_-2px_var(--color-warn)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] shadow-[0_0_18px_-2px_var(--color-danger)]',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info)] shadow-[0_0_18px_-2px_var(--color-info)]',
  idle: 'bg-[var(--color-idle-soft)] text-[var(--color-idle)] shadow-[0_0_18px_-6px_var(--color-idle)]',
  brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)] shadow-[0_0_18px_-2px_var(--color-brand)]',
};

/** Coloured light behind the frosted panel, so the glass has something to blur. */
const GLOW_TONES: Record<Tone, string> = {
  ok: 'bg-[var(--color-ok)]',
  warn: 'bg-[var(--color-warn)]',
  danger: 'bg-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]',
  idle: 'bg-[var(--color-idle)]',
  brand: 'bg-[var(--color-brand)]',
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'idle',
  href,
  onClick,
  active = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
  /** Makes the card a filter toggle; pair with `active`. */
  onClick?: () => void;
  /** Highlights the card as the filter currently applied. */
  active?: boolean;
}) {
  const interactive = Boolean(href || onClick);
  const body = (
    <div
      className={cn(
        // Frosted glass, iOS-widget style: a milky translucent panel with a lit
        // top edge, a tinted light drifting inside it, and a shine on hover.
        'glass-shine glass-flow relative isolate flex h-full items-start gap-2.5 sm:gap-3 overflow-hidden rounded-[1.375rem] p-3.5 sm:p-4 text-left',
        'border border-[var(--glass-edge-dim)] [border-top-color:var(--glass-edge)]',
        'bg-[linear-gradient(145deg,var(--glass-from),var(--glass-to))] backdrop-blur-2xl backdrop-saturate-150',
        'shadow-[var(--glass-shadow),inset_0_1px_0_var(--glass-highlight)]',
        'transition-[box-shadow,border-color] duration-300 ease-out',
        interactive && 'hover:border-[var(--glass-edge)]',
        active && 'border-[var(--color-brand)] [border-top-color:var(--color-brand)] ring-1 ring-[var(--color-brand)]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'glass-drift pointer-events-none absolute -left-10 -top-12 -z-10 h-32 w-32 rounded-full opacity-25 blur-2xl',
          GLOW_TONES[tone],
        )}
      />

      {Icon ? (
        <span
          className={cn(
            'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-white/15',
            ICON_TONES[tone],
          )}
        >
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </span>
      ) : null}

      <div className="glass-card-content min-w-0 flex-1">
        <p className="truncate text-[11px] sm:text-xs font-medium text-[var(--color-fg-muted)]">{label}</p>
        <p className="mt-0.5 truncate text-xl sm:text-2xl font-semibold tracking-tight tnum">
          <CountUp value={value} />
        </p>
        {sub ? (
          <p className="mt-1.5 inline-flex max-w-full truncate rounded-full bg-[var(--glass-edge-dim)] px-2 py-0.5 text-[10px] sm:text-[11px] text-[var(--color-fg-muted)]">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block h-full">
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className="group block h-full w-full cursor-pointer">
        {body}
      </button>
    );
  }
  return body;
}

/**
 * One-row group of KPI cards. Columns are equal width and sized to the number
 * of cards (grid-auto-flow: column), so five cards are five columns rather than
 * wrapping 4 + 1. When they cannot fit at their minimum width the row scrolls
 * horizontally with snapping instead of wrapping.
 */
export function StatGrid({
  children,
  min = '10rem',
  className,
}: {
  children: React.ReactNode;
  /** Minimum width of one card before the row starts to scroll. */
  min?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass-rise grid snap-x snap-mandatory grid-flow-col gap-2.5 sm:gap-3 overflow-x-auto overscroll-x-contain pb-1 [&>*]:snap-start scroll-thin',
        className,
      )}
      style={{ gridAutoColumns: `minmax(min(${min}, calc(100vw - 3rem)), 1fr)` }}
    >
      {children}
    </div>
  );
}
