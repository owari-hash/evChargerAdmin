'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  key: string;
  label: React.ReactNode;
  badge?: React.ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-2',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'text-[var(--color-fg)]'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            <span className="inline-flex items-center gap-2">
              {item.label}
              {item.badge}
            </span>
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--color-brand)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Small count pill for tab labels. */
export function TabCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-fg-muted)] tnum">
      {children}
    </span>
  );
}
