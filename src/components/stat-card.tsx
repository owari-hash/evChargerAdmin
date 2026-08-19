import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/components/ui/primitives';

const ICON_TONES: Record<Tone, string> = {
  ok: 'bg-[var(--color-ok-soft)] text-[var(--color-ok)]',
  warn: 'bg-[var(--color-warn-soft)] text-[var(--color-warn)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  idle: 'bg-[var(--color-idle-soft)] text-[var(--color-idle)]',
  brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'idle',
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        'flex h-full items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition',
        href && 'hover:border-[var(--color-border-strong)]',
      )}
    >
      {Icon ? (
        <span
          className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ICON_TONES[tone])}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      ) : null}

      <div className="min-w-0">
        <p className="text-xs text-[var(--color-fg-muted)]">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold tracking-tight tnum">{value}</p>
        {sub ? <p className="mt-0.5 truncate text-xs text-[var(--color-fg-subtle)]">{sub}</p> : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
