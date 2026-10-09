'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Custom dropdown that replaces the native <select> (which renders as the
 * OS menu and ignores the theme).
 *
 * It is a drop-in for the old primitive: options can still be written as
 * `<option value disabled>` children, and `onChange` still receives a real
 * `ChangeEvent<HTMLSelectElement>`. That works because a visually hidden native
 * <select> is kept in sync underneath — picking an option sets its value and
 * dispatches a genuine `change` event (the same trick Radix uses), so `name`,
 * `required`, FormData and native validation keep working too.
 *
 * Options may instead be passed as `options`, which also allows a `code`
 * (rendered in muted mono before the label, e.g. bank codes).
 */

export interface SelectOption {
  value: string;
  label: string;
  /** Short identifier shown in muted monospace before the label. */
  code?: string;
  disabled?: boolean;
}

type NativeSelectProps = Omit<
  React.ComponentProps<'select'>,
  'children' | 'value' | 'defaultValue' | 'multiple' | 'size'
>;

export interface SelectProps extends NativeSelectProps {
  value?: string | number;
  defaultValue?: string | number;
  options?: SelectOption[];
  children?: React.ReactNode;
  /** Shown when no option matches the current value. */
  placeholder?: string;
  /** Force the search box on/off. Defaults to on when there are more than 8 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
}

const SEARCH_THRESHOLD = 8;
const PANEL_MAX_HEIGHT = 320;
const ROW_HEIGHT = 34;
const SEARCH_HEIGHT = 45;

/** Trigger look shared by every popover field (Select, DatePicker). */
export const TRIGGER_BASE =
  'relative inline-flex w-full items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-3 pr-8 text-left text-sm text-[var(--color-fg)] transition ' +
  'hover:border-[var(--color-fg-subtle)] aria-expanded:border-[var(--color-brand)] aria-expanded:ring-2 aria-expanded:ring-[var(--color-brand)]/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--color-border-strong)]';

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

function optionsFromChildren(children: React.ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      out.push(...optionsFromChildren((child.props as { children?: React.ReactNode }).children));
      return;
    }
    if (child.type !== 'option') return;
    const props = child.props as React.ComponentProps<'option'> & { 'data-code'?: string };
    const label = textOf(props.children).replace(/\s+/g, ' ').trim();
    out.push({
      value: props.value === undefined ? label : String(props.value),
      label,
      code: props['data-code'],
      disabled: Boolean(props.disabled),
    });
  });
  return out;
}

function matches(option: SelectOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    option.label.toLowerCase().includes(q) ||
    (option.code ?? '').toLowerCase().includes(q) ||
    option.value.toLowerCase().includes(q)
  );
}

interface Position {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
  placement: 'bottom' | 'top';
}

const setNativeValue = (el: HTMLSelectElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
};

export function Select({
  value: valueProp,
  defaultValue,
  options: optionsProp,
  children,
  placeholder = '—',
  searchable,
  searchPlaceholder = 'Хайх…',
  className,
  id,
  disabled,
  title,
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  ...nativeProps
}: SelectProps) {
  const options = React.useMemo(
    () => optionsProp ?? optionsFromChildren(children),
    [optionsProp, children],
  );

  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = React.useState(() =>
    defaultValue !== undefined ? String(defaultValue) : (options.find((o) => !o.disabled)?.value ?? ''),
  );
  const value = isControlled ? String(valueProp) : internal;
  const selected = options.find((o) => o.value === value);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(-1);
  const [position, setPosition] = React.useState<Position | null>(null);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const nativeRef = React.useRef<HTMLSelectElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const typeahead = React.useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const baseId = React.useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const visible = React.useMemo(
    () => (withSearch && query ? options.filter((o) => matches(o, query)) : options),
    [options, query, withSearch],
  );

  // A filter in a toolbar (`w-auto`) sizes itself to its widest option, like a
  // native select does, so the control does not jump when the selection changes.
  const autoWidth = /(^|\s)w-auto(\s|$)/.test(className ?? '');

  const computePosition = React.useCallback((): Position | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const margin = 8;
    const estimated = Math.min(
      PANEL_MAX_HEIGHT,
      Math.max(1, visible.length) * ROW_HEIGHT + 8 + (withSearch ? SEARCH_HEIGHT : 0),
    );
    const below = vh - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const placement: Position['placement'] =
      below < Math.min(estimated, 200) && above > below ? 'top' : 'bottom';
    const room = placement === 'bottom' ? below : above;
    const width = Math.min(Math.max(rect.width, 180), vw - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, vw - width - margin));
    return {
      left,
      width,
      maxHeight: Math.max(120, Math.min(PANEL_MAX_HEIGHT, room)),
      placement,
      ...(placement === 'bottom' ? { top: rect.bottom + gap } : { bottom: vh - rect.top + gap }),
    };
  }, [visible.length, withSearch]);

  const firstEnabled = (list: SelectOption[], from = 0, step = 1) => {
    for (let i = from; i >= 0 && i < list.length; i += step) if (!list[i].disabled) return i;
    return -1;
  };

  function openMenu() {
    if (disabled || open) return;
    const trigger = triggerRef.current;
    // Inside a modal <dialog> the panel must live in the dialog too: the dialog
    // sits in the browser's top layer, so anything portalled to <body> would be
    // painted underneath it (and be inert). Fixed positioning still escapes the
    // dialog's own scroll clipping.
    setContainer((trigger?.closest('dialog') as HTMLElement | null) ?? document.body);
    setQuery('');
    const idx = options.findIndex((o) => o.value === value && !o.disabled);
    setActive(idx >= 0 ? idx : firstEnabled(options));
    setPosition(computePosition());
    setOpen(true);
  }

  function closeMenu(refocus = true) {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }

  function commit(option: SelectOption | undefined) {
    if (!option || option.disabled) return;
    closeMenu();
    if (option.value === value) return;
    if (!isControlled) setInternal(option.value);
    const el = nativeRef.current;
    if (!el) return;
    setNativeValue(el, option.value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Keep the panel attached to the trigger while anything scrolls or resizes.
  React.useEffect(() => {
    if (!open) return;
    const update = () => setPosition(computePosition());
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, computePosition]);

  // Click outside closes without stealing focus from whatever was clicked.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  React.useEffect(() => {
    if (open && withSearch) searchRef.current?.focus();
  }, [open, withSearch]);

  // Keep the active row in view. Scrolls only the list, never the page.
  React.useEffect(() => {
    const list = listRef.current;
    if (!open || active < 0 || !list) return;
    const el = document.getElementById(`${baseId}-opt-${active}`);
    if (!el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 4;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 4;
  }, [open, active, baseId]);

  function move(step: number, from = active) {
    if (visible.length === 0) return;
    let i = from;
    for (let n = 0; n < visible.length; n++) {
      i = Math.max(0, Math.min(visible.length - 1, i + step));
      if (!visible[i].disabled) {
        setActive(i);
        return;
      }
      if (i === 0 || i === visible.length - 1) break;
    }
  }

  function typeaheadMatch(char: string, now: number): number {
    const t = typeahead.current;
    t.text = now - t.at > 600 ? char : t.text + char;
    t.at = now;
    const typed = t.text.toLowerCase();
    // Repeating one letter cycles through the options that start with it.
    const cycling = typed.split('').every((c) => c === typed[0]);
    const needle = cycling ? typed[0] : typed;
    const list = visible;
    if (list.length === 0) return -1;
    const current = open ? active : list.findIndex((o) => o.value === value);
    const begin = needle.length === 1 ? current + 1 : Math.max(current, 0);
    for (let n = 0; n < list.length; n++) {
      const i = (begin + n + list.length) % list.length;
      const o = list[i];
      if (o.disabled) continue;
      if (o.label.toLowerCase().startsWith(needle) || (o.code ?? '').toLowerCase().startsWith(needle)) {
        return i;
      }
    }
    return -1;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const inSearch = e.target === searchRef.current;
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      } else if (printable) {
        const i = typeaheadMatch(e.key, e.timeStamp);
        if (i >= 0) commit(visible[i]);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        if (inSearch) return;
        e.preventDefault();
        setActive(firstEnabled(visible));
        break;
      case 'End':
        if (inSearch) return;
        e.preventDefault();
        setActive(firstEnabled(visible, visible.length - 1, -1));
        break;
      case 'PageDown':
        e.preventDefault();
        move(1, Math.min(visible.length - 1, active + 7));
        break;
      case 'PageUp':
        e.preventDefault();
        move(-1, Math.max(0, active - 7));
        break;
      case 'Enter':
        e.preventDefault();
        commit(visible[active]);
        break;
      case 'Escape':
        // Stop a surrounding <dialog> from treating this as its own close request.
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        break;
      case 'Tab':
        closeMenu();
        break;
      case ' ':
        if (inSearch) return;
        e.preventDefault();
        commit(visible[active]);
        break;
      default:
        if (printable && !inSearch) {
          const i = typeaheadMatch(e.key, e.timeStamp);
          if (i >= 0) setActive(i);
        }
    }
  }

  const content = (option: SelectOption | undefined, isTrigger: boolean) =>
    option ? (
      <>
        {option.code ? (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
            {option.code}
          </span>
        ) : null}
        <span
          className={cn(
            'min-w-0 truncate',
            isTrigger && option.disabled && 'text-[var(--color-fg-subtle)]',
          )}
        >
          {option.label}
        </span>
      </>
    ) : (
      <span className="truncate text-[var(--color-fg-subtle)]">{placeholder}</span>
    );

  const panel =
    open && position && container
      ? createPortal(
          <div
            ref={panelRef}
            onKeyDown={onKeyDown}
            style={{
              position: 'fixed',
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
              maxHeight: position.maxHeight,
            }}
            className={cn(
              'z-[60] flex flex-col overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-fg)]',
              'shadow-[0_12px_32px_-8px_rgba(13,31,23,0.22)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7)]',
              'animate-in-fade',
            )}
          >
            {withSearch ? (
              <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3">
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-subtle)]" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const q = e.target.value;
                    setQuery(q);
                    const next = options.filter((o) => matches(o, q));
                    setActive(firstEnabled(next));
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-controls={listboxId}
                  aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                  role="combobox"
                  aria-expanded="true"
                  aria-autocomplete="list"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 w-full min-w-0 bg-transparent text-sm text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus-visible:outline-none"
                />
              </div>
            ) : null}
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledby}
              className="scroll-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
            >
              {visible.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-[var(--color-fg-muted)]">
                  Илэрц олдсонгүй
                </p>
              ) : (
                visible.map((option, i) => {
                  const isSelected = option.value === value;
                  const isActive = i === active;
                  return (
                    <div
                      key={`${option.value}-${i}`}
                      id={optionId(i)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      onPointerMove={() => {
                        if (!option.disabled && active !== i) setActive(i);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commit(option)}
                      className={cn(
                        'flex min-h-[34px] cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                        isActive && !option.disabled && 'bg-[var(--color-surface-2)]',
                        isSelected && 'font-medium',
                        option.disabled && 'cursor-default text-[var(--color-fg-subtle)]',
                      )}
                    >
                      {option.code ? (
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                          {option.code}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate" title={option.label}>
                        {option.label}
                      </span>
                      <Check
                        aria-hidden="true"
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          container,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && !withSearch && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-required={nativeProps.required || undefined}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(TRIGGER_BASE, 'h-9', className)}
      >
        <span className="grid min-w-0 flex-1">
          {autoWidth
            ? options.map((o, i) => (
                <span
                  key={`${o.value}-${i}`}
                  aria-hidden="true"
                  className="invisible col-start-1 row-start-1 flex h-0 items-center gap-2 overflow-hidden whitespace-nowrap"
                >
                  {content(o, true)}
                </span>
              ))
            : null}
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
            {content(selected, true)}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-subtle)] transition-transform duration-150',
            open && 'rotate-180 text-[var(--color-brand)]',
          )}
        />
      </button>

      {/* The form-facing half: carries name/required/value and emits onChange. */}
      <select
        {...nativeProps}
        ref={nativeRef}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e)}
        aria-hidden="true"
        tabIndex={-1}
        // Native validation focuses the invalid control; hand that to the trigger.
        onFocus={() => triggerRef.current?.focus()}
        className="sr-only"
      >
        {selected ? null : <option value={value} />}
        {options.map((o, i) => (
          <option key={`${o.value}-${i}`} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>

      {panel}
    </>
  );
}
