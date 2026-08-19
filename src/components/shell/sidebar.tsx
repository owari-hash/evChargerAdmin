'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { brand } from '@/lib/config';
import { visibleSections } from './nav-items';
import { ROLE } from '@/lib/mn';
import type { SessionUser } from '@/lib/types';
import { Button } from '@/components/ui/primitives';

export function Sidebar({
  user,
  open,
  onClose,
}: {
  user: SessionUser;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const sections = visibleSections(user.role);

  return (
    <>
      {/* Scrim for the mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <Logo />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">{brand.name}</div>
              <div className="truncate text-[10px] text-[var(--color-fg-subtle)]">
                OCPP 1.6J удирдлага
              </div>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Цэс хаах">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = item.prefix
                    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                    : pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]'
                            : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-[var(--color-border)] px-4 py-3">
          <p className="truncate text-xs font-medium">{user.email}</p>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
            {ROLE[user.role] ?? user.role}
          </p>
        </div>
      </aside>
    </>
  );
}

function Logo() {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="var(--color-brand-fg)">
        <path d="M13.5 2 5 13.2h5.2L9.4 22 19 10.4h-5.4L13.5 2Z" />
      </svg>
    </span>
  );
}
