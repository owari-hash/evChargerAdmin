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

/**
 * Top-bar search. The results hang off the field as a dropdown rather than
 * taking over the screen, so the console stays visible behind them.
 */
export function GlobalSearch({ role, className }: { role: UserRole; className?: string }) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
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

  // ⌘K / Ctrl+K anywhere, and "/" when the operator is not already typing.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      if ((key === 'k' && (event.metaKey || event.ctrlKey)) || (key === '/' && !typing)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dismiss when the next click lands anywhere outside the field and its list.
  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the highlighted row visible while arrowing through a long list.
  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function go(entry: SearchEntry | undefined) {
    if (!entry) return;
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    router.push(entry.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      if (!flat.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + flat.length) % flat.length);
      return;
    }

    if (event.key === 'Enter' && open) {
      event.preventDefault();
      go(flat[active]);
    }
  }

  const activeId = flat[active] ? `gs-${flat[active]!.id}` : undefined;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-[var(--color-surface-2)] px-2.5',
          'transition-colors',
          open
            ? 'border-[var(--color-brand)]/50'
            : 'border-[var(--color-border)] hover:border-[var(--color-brand)]/40',
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // The result list is rebuilt, so the old highlight is meaningless.
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Цэс, үйлдэл хайх…"
          aria-label="Цэс, үйлдэл хайх"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-results"
          aria-activedescendant={activeId}
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-muted)]"
        />
        {!open && !query ? <Kbd className="hidden sm:inline-flex">⌘K</Kbd> : null}
      </div>

      {open ? (
        <div
          className={cn(
            'absolute top-full z-40 mt-2 flex max-h-[min(70vh,28rem)] flex-col overflow-hidden',
            'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl',
            // Narrow fields get a dropdown wider than themselves, centred under
            // the input; from sm up it simply matches the field.
            'left-1/2 w-[min(88vw,26rem)] -translate-x-1/2',
            'sm:left-0 sm:right-0 sm:w-auto sm:translate-x-0',
          )}
        >
          {flat.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-fg-muted)]">
              «{query}» -тай тохирох цэс, үйлдэл олдсонгүй.
            </p>
          ) : (
            <>
              {/* Only the results scroll, so the key hints below stay put. */}
              <div
                id="global-search-results"
                ref={listRef}
                role="listbox"
                className="min-h-0 flex-1 overflow-y-auto p-2"
              >
              {groups.map((group) => (
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
              ))}
              </div>

              <footer className="flex shrink-0 items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[11px] text-[var(--color-fg-muted)]">
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
                <span className="ml-auto flex items-center gap-1">
                  <Kbd className="inline-flex">ESC</Kbd>
                  хаах
                </span>
              </footer>
            </>
          )}
        </div>
      ) : null}
    </div>
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
      id={`gs-${entry.id}`}
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
