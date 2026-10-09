'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { brand } from '@/lib/config';
import { withBasePath } from '@/lib/base-path';
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
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
            aria-label={`${brand.name} — нүүр хуудас`}
          >
            <Logo />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-5 tracking-tight text-[var(--color-fg)]">
                {brand.name}
              </div>
              <div className="truncate text-[11px] font-medium leading-4 tracking-wide text-[var(--color-fg-subtle)]">
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

/** The eplug mark: the app icon artwork, rounded like an app tile. */
function Logo() {
  return (
    <Image
      src={withBasePath('/eplug-mark.png')}
      alt=""
      aria-hidden
      width={36}
      height={36}
      priority
      className="size-9 shrink-0 rounded-[10px] object-contain shadow-[0_4px_14px_-6px_rgb(16_185_129/0.55)] ring-1 ring-black/5 dark:ring-white/10"
    />
  );
}
