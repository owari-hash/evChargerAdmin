'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  defaultEntries,
  searchEntries,
  type SearchEntry,
  type SearchKind,
} from '@/lib/search-index';
import type { UserRole } from '@/lib/types';

const GROUP_LABELS: Record<SearchKind, string> = {
  menu: 'Цэс',
  function: 'Үйлдэл',
};

/** Keeps the list short enough to scan; the ranking puts the best first anyway. */
const LIMIT_PER_GROUP = 8;

export function GlobalSearch({ role }: { role: UserRole }) {
  const [open, setOpen] = React.useState(false);

  // ⌘K / Ctrl+K anywhere, and "/" when the operator is not already typing.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      if (key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((v) => !v);
      } else if (key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <SearchTrigger onClick={() => setOpen(true)} />
      <SearchDialog role={role} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]',
        'px-2.5 py-1.5 text-sm text-[var(--color-fg-muted)] transition-colors',
        'hover:border-[var(--color-brand)]/40 hover:text-[var(--color-fg)]',
        'sm:w-64 md:w-80',
      )}
      aria-label="Хайх"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="hidden flex-1 text-left sm:inline">Цэс, үйлдэл хайх…</span>
      <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
    </button>
  );
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'items-center rounded border border-[var(--color-border)] bg-[var(--color-surface)]',
        'px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[var(--color-fg-muted)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

function SearchDialog({
  role,
  open,
  onClose,
}: {
  role: UserRole;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = React.useRef<HTMLDialogElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);

  const groups = React.useMemo(() => {
    if (!query.trim()) {
      return [{ kind: 'menu' as SearchKind, entries: defaultEntries(role) }].filter(
        (g) => g.entries.length > 0,
      );
    }

    const results = searchEntries(query, role);
    const menu = results.filter((r) => r.entry.kind === 'menu').slice(0, LIMIT_PER_GROUP);
    const fn = results.filter((r) => r.entry.kind === 'function').slice(0, LIMIT_PER_GROUP);

    return [
      { kind: 'menu' as SearchKind, entries: menu.map((r) => r.entry) },
      { kind: 'function' as SearchKind, entries: fn.map((r) => r.entry) },
    ].filter((g) => g.entries.length > 0);
  }, [query, role]);

  // One flat list underneath the grouping, so ↑/↓ crosses the group boundary.
  const flat = React.useMemo(() => groups.flatMap((g) => g.entries), [groups]);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setQuery('');
      setActive(0);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Keep the highlighted row visible while arrowing through a long list.
  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function go(entry: SearchEntry | undefined) {
    if (!entry) return;
    onClose();
    router.push(entry.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(flat[active]);
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'mx-auto mt-[12vh] mb-auto w-[calc(100vw-2rem)] max-w-xl rounded-xl p-0',
        'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)]',
        'shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-in-fade',
      )}
      aria-label="Цэс, үйлдэл хайх"
    >
      {open ? (
        <div className="flex max-h-[70vh] flex-col" onKeyDown={onKeyDown}>
          <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-4">
            <Search className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // The result list is rebuilt, so the old highlight is meaningless.
                setActive(0);
              }}
              placeholder="данс, тариф, буцаалт, станц…"
              aria-label="Хайх"
              role="combobox"
              aria-expanded
              aria-controls="global-search-results"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-muted)]"
            />
            <Kbd className="inline-flex">ESC</Kbd>
          </div>

          <div id="global-search-results" ref={listRef} role="listbox" className="overflow-y-auto p-2">
            {flat.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[var(--color-fg-muted)]">
                «{query}» -тай тохирох цэс, үйлдэл олдсонгүй.
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.kind} className="mb-1 last:mb-0">
                  <h2 className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
                    {query.trim() ? GROUP_LABELS[group.kind] : 'Түгээмэл'}
                  </h2>
                  {group.entries.map((entry) => {
                    // Position in the flat list, which is what ↑/↓ walks.
                    const i = flat.indexOf(entry);
                    return (
                      <ResultRow
                        key={entry.id}
                        entry={entry}
                        active={i === active}
                        onHover={() => setActive(i)}
                        onPick={() => go(entry)}
                      />
                    );
                  })}
                </section>
              ))
            )}
          </div>

          <footer className="flex items-center gap-3 border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-fg-muted)]">
            <span className="flex items-center gap-1">
              <Kbd className="inline-flex">↑</Kbd>
              <Kbd className="inline-flex">↓</Kbd>
              шилжих
            </span>
            <span className="flex items-center gap-1">
              <Kbd className="inline-flex">
                <CornerDownLeft className="h-2.5 w-2.5" />
              </Kbd>
              нээх
            </span>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}

function ResultRow({
  entry,
  active,
  onHover,
  onPick,
}: {
  entry: SearchEntry;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const Icon = entry.icon;

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-active={active}
      onMouseMove={onHover}
      onClick={onPick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors',
        active ? 'bg-[var(--color-surface-2)]' : 'hover:bg-[var(--color-surface-2)]/60',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          active ? 'text-[var(--color-brand)]' : 'text-[var(--color-fg-muted)]',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{entry.label}</span>
        {/* Functions live inside a page, so say which one — that is the thing
            the operator actually needs to know to find it again. */}
        {entry.kind === 'function' ? (
          <span className="block truncate text-xs text-[var(--color-fg-muted)]">
            {entry.section}
            {entry.hint ? ` · ${entry.hint}` : ''}
          </span>
        ) : null}
      </span>
    </button>
  );
}
