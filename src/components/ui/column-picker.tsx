'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, Columns3 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/primitives';
import { POPOVER_PANEL, useAnchoredPopover } from '@/components/ui/popover';

export interface PickerColumn<K extends string> {
  key: K;
  label: string;
}

const CHANGE_EVENT = 'column-picker:change';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Which table columns are shown, remembered per browser. `storageKey` keeps
 * each table's choice separate; columns never toggled fall back to `defaults`.
 */
export function useVisibleColumns<K extends string>(storageKey: string, defaults: Record<K, boolean>) {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => readStorage(storageKey),
    () => null,
  );
  // Choices that only live in memory, for when storage is blocked.
  const [memory, setMemory] = React.useState<Partial<Record<K, boolean>>>({});

  const visible = React.useMemo(() => {
    let saved: Partial<Record<K, boolean>> = {};
    try {
      saved = raw ? (JSON.parse(raw) as Partial<Record<K, boolean>>) : {};
    } catch {
      // Bad JSON: ignore it.
    }
    return { ...defaults, ...saved, ...memory };
  }, [raw, defaults, memory]);

  const toggle = React.useCallback(
    (key: K) => {
      const next = { ...visible, [key]: !visible[key] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
        window.dispatchEvent(new Event(CHANGE_EVENT));
      } catch {
        setMemory((m) => ({ ...m, [key]: next[key] }));
      }
    },
    [storageKey, visible],
  );

  return { visible, toggle };
}

/** "Багана" button: a checklist of columns the user can show or hide. */
export function ColumnPicker<K extends string>({
  columns,
  visible,
  onToggle,
}: {
  columns: PickerColumn<K>[];
  visible: Record<K, boolean>;
  onToggle: (key: K) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const { position, container, place } = useAnchoredPopover({
    open,
    onDismiss: () => setOpen(false),
    triggerRef,
    panelRef,
    width: 220,
    height: columns.length * 36 + 16,
  });

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        size="md"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          if (!open) place();
          setOpen((o) => !o);
        }}
      >
        <Columns3 className="h-4 w-4" />
        Багана
      </Button>
      {open && position && container
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              className={cn(POPOVER_PANEL, 'fixed w-[220px] p-1.5')}
              style={{ left: position.left, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }}
            >
              {columns.map((c) => {
                const on = visible[c.key];
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={on}
                    onClick={() => onToggle(c.key)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-[var(--color-surface-2)]"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                        on
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                          : 'border-[var(--color-border-strong)]',
                      )}
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className={on ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'}>{c.label}</span>
                  </button>
                );
              })}
            </div>,
            container,
          )
        : null}
    </>
  );
}
