'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/use-now';
import { TRIGGER_BASE } from './select';
import { POPOVER_PANEL, useAnchoredPopover } from './popover';

/**
 * Themed replacements for <input type="date"> / "datetime-local".
 *
 * Values stay plain ISO strings in local time — `yyyy-mm-dd`, or
 * `yyyy-mm-ddTHH:mm` with `withTime` — exactly what the native inputs produced,
 * so existing query params and payloads keep working. Pass `name` to also emit
 * a hidden input for FormData.
 */

// ---------------------------------------------------------------------------
// Date helpers (local time, no library)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIsoDate(value: string | undefined | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTime(value: string | undefined | null): { h: number; m: number } | null {
  const m = /T(\d{2}):(\d{2})/.exec(value ?? '');
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** Monday-first weekday index, 0..6. */
const weekday = (d: Date) => (d.getDay() + 6) % 7;

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}-р сар`);
const WEEKDAYS = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];
const WEEKDAYS_LONG = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'];

function formatDisplay(iso: string, withTime = false): string {
  const d = parseIsoDate(iso);
  if (!d) return '';
  const date = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const t = withTime ? parseTime(iso) : null;
  return t ? `${date} ${pad(t.h)}:${pad(t.m)}` : date;
}

function longLabel(d: Date): string {
  return `${d.getFullYear()} оны ${MONTHS[d.getMonth()]}ын ${d.getDate()}, ${WEEKDAYS_LONG[weekday(d)]}`;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

interface CalendarProps {
  /** Day that owns keyboard focus; also decides the visible month. */
  focused: Date;
  onFocusedChange: (d: Date) => void;
  today: Date;
  selected?: string;
  rangeFrom?: string;
  rangeTo?: string;
  onPick: (iso: string) => void;
  onHover?: (iso: string | null) => void;
  /** Called on Escape so the owner can close and refocus its trigger. */
  onEscape: () => void;
  autoFocus?: boolean;
}

function Calendar({
  focused,
  onFocusedChange,
  today,
  selected,
  rangeFrom,
  rangeTo,
  onPick,
  onHover,
  onEscape,
  autoFocus,
}: CalendarProps) {
  const [view, setView] = React.useState<'days' | 'months'>('days');
  const gridRef = React.useRef<HTMLDivElement>(null);
  // Only pull focus into the grid when the user is driving it with the keyboard
  // (or the popover just opened) — never when they click the month buttons.
  const wantFocus = React.useRef(Boolean(autoFocus));

  const todayIso = toIsoDate(today);
  const focusedIso = toIsoDate(focused);
  const first = startOfMonth(focused);
  const gridStart = addDays(first, -weekday(first));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  React.useEffect(() => {
    if (!wantFocus.current || view !== 'days') return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusedIso}"]`)?.focus();
  }, [focusedIso, view]);

  const lo = rangeFrom && rangeTo && rangeFrom > rangeTo ? rangeTo : rangeFrom;
  const hi = rangeFrom && rangeTo && rangeFrom > rangeTo ? rangeFrom : rangeTo;

  function onGridKey(e: React.KeyboardEvent) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -weekday(focused)),
      End: () => addDays(focused, 6 - weekday(focused)),
      PageUp: () => addMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      wantFocus.current = true;
      onFocusedChange(moves[e.key]());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onEscape();
    }
  }

  const navBtn =
    'grid h-7 w-7 place-items-center rounded-lg text-[var(--color-fg-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]';

  return (
    <div className="w-[17.5rem] select-none">
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          className={navBtn}
          aria-label={view === 'days' ? 'Өмнөх сар' : 'Өмнөх жил'}
          onClick={() => onFocusedChange(addMonths(focused, view === 'days' ? -1 : -12))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setView((v) => (v === 'days' ? 'months' : 'days'))}
          className="rounded-lg px-2 py-1 text-sm font-semibold transition hover:bg-[var(--color-surface-2)]"
          aria-label="Сар, жил сонгох"
          aria-expanded={view === 'months'}
        >
          {view === 'days' ? `${focused.getFullYear()} оны ${MONTHS[focused.getMonth()]}` : `${focused.getFullYear()} он`}
        </button>
        <button
          type="button"
          className={navBtn}
          aria-label={view === 'days' ? 'Дараах сар' : 'Дараах жил'}
          onClick={() => onFocusedChange(addMonths(focused, view === 'days' ? 1 : 12))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {view === 'months' ? (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {MONTHS.map((label, i) => {
            const current = i === focused.getMonth();
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  wantFocus.current = true;
                  onFocusedChange(new Date(focused.getFullYear(), i, 1));
                  setView('days');
                }}
                className={cn(
                  'h-10 rounded-lg text-sm transition',
                  current
                    ? 'bg-[var(--color-brand)] font-medium text-[var(--color-brand-fg)]'
                    : 'hover:bg-[var(--color-surface-2)]',
                  i === today.getMonth() && focused.getFullYear() === today.getFullYear() && !current &&
                    'ring-1 ring-inset ring-[var(--color-brand)]/50',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <div role="grid" aria-label={`${focused.getFullYear()} оны ${MONTHS[focused.getMonth()]}`} onKeyDown={onGridKey}>
          <div role="row" className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                role="columnheader"
                aria-label={WEEKDAYS_LONG[i]}
                className={cn(
                  'py-1 text-center text-[11px] font-medium text-[var(--color-fg-subtle)]',
                  i >= 5 && 'text-[var(--color-fg-muted)]',
                )}
              >
                {w}
              </span>
            ))}
          </div>
          <div ref={gridRef} className="grid grid-cols-7 gap-y-0.5" onPointerLeave={() => onHover?.(null)}>
            {days.map((d) => {
              const iso = toIsoDate(d);
              const outside = d.getMonth() !== focused.getMonth();
              const isToday = iso === todayIso;
              const isEdge = iso === selected || iso === lo || iso === hi;
              const inRange = Boolean(lo && hi && iso > lo && iso < hi);
              return (
                <div
                  key={iso}
                  role="gridcell"
                  aria-selected={isEdge || inRange}
                  className={cn(
                    'flex justify-center',
                    inRange && 'bg-[var(--color-brand-soft)]',
                    lo && hi && lo !== hi && iso === lo && 'rounded-l-lg bg-[var(--color-brand-soft)]',
                    lo && hi && lo !== hi && iso === hi && 'rounded-r-lg bg-[var(--color-brand-soft)]',
                  )}
                >
                  <button
                    type="button"
                    data-iso={iso}
                    tabIndex={iso === focusedIso ? 0 : -1}
                    aria-label={longLabel(d)}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => onPick(iso)}
                    onPointerEnter={() => onHover?.(iso)}
                    onFocus={() => onHover?.(iso)}
                    className={cn(
                      'relative grid h-9 w-9 place-items-center rounded-lg text-sm tabular-nums transition',
                      outside ? 'text-[var(--color-fg-subtle)]' : 'text-[var(--color-fg)]',
                      !isEdge && 'hover:bg-[var(--color-surface-2)]',
                      inRange && !isEdge && 'text-[var(--color-brand)] hover:bg-[var(--color-brand)]/15',
                      isEdge && 'bg-[var(--color-brand)] font-semibold text-[var(--color-brand-fg)] shadow-sm',
                      isToday && !isEdge && 'font-semibold text-[var(--color-brand)]',
                    )}
                  >
                    {d.getDate()}
                    {isToday ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute bottom-1 h-1 w-1 rounded-full',
                          isEdge ? 'bg-[var(--color-brand-fg)]' : 'bg-[var(--color-brand)]',
                        )}
                      />
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared trigger + panel
// ---------------------------------------------------------------------------

function Trigger({
  triggerRef,
  open,
  label,
  placeholder,
  onToggle,
  onClear,
  disabled,
  id,
  className,
  ariaLabel,
  onKeyDown,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  label: string;
  placeholder: string;
  onToggle: () => void;
  onClear?: () => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  ariaLabel?: string;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <span className={cn('relative inline-flex', /(^|\s)w-auto(\s|$)/.test(className ?? '') ? 'w-auto' : 'w-full', className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}${label ? `: ${label}` : ''}` : undefined}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        className={cn(TRIGGER_BASE, 'h-9 whitespace-nowrap pl-9', onClear && label && 'pr-8')}
      >
        <CalendarDays
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-subtle)]',
            open && 'text-[var(--color-brand)]',
          )}
        />
        <span className={cn('truncate tabular-nums', !label && 'text-[var(--color-fg-subtle)]')}>
          {label || placeholder}
        </span>
      </button>
      {onClear && label && !disabled ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Цэвэрлэх"
          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[var(--color-fg-subtle)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </span>
  );
}

const footerBtn =
  'rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-[var(--color-surface-2)]';

function usePickerState() {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  return { open, setOpen, triggerRef, panelRef };
}

function TimeField({
  value,
  onChange,
}: {
  value: { h: number; m: number };
  onChange: (t: { h: number; m: number }) => void;
}) {
  const field =
    'h-8 w-11 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-center text-sm tabular-nums text-[var(--color-fg)]';
  // Typing always keeps the last two digits, so "0" then "9" reads as 09.
  const clamp = (raw: string, max: number) =>
    Math.max(0, Math.min(max, Number(raw.replace(/\D/g, '').slice(-2)) || 0));
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
      <span>Цаг</span>
      <input
        aria-label="Цаг"
        inputMode="numeric"
        onFocus={(e) => e.currentTarget.select()}
        className={field}
        value={pad(value.h)}
        onChange={(e) => onChange({ ...value, h: clamp(e.target.value, 23) })}
      />
      <span className="text-[var(--color-fg)]">:</span>
      <input
        aria-label="Минут"
        inputMode="numeric"
        onFocus={(e) => e.currentTarget.select()}
        className={field}
        value={pad(value.m)}
        onChange={(e) => onChange({ ...value, m: clamp(e.target.value, 59) })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DatePicker
// ---------------------------------------------------------------------------

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Emit `yyyy-mm-ddTHH:mm` (replacement for datetime-local). */
  withTime?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  /** Show the inline × button on the trigger. Defaults to true. */
  clearable?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  withTime = false,
  id,
  name,
  required,
  disabled,
  className,
  'aria-label': ariaLabel,
  clearable = true,
}: DatePickerProps) {
  const { open, setOpen, triggerRef, panelRef } = usePickerState();
  const now = useNow(60_000);
  const today = new Date(now);
  const [focused, setFocused] = React.useState<Date>(() => parseIsoDate(value) ?? new Date(now));
  const [time, setTime] = React.useState(() => parseTime(value) ?? { h: 0, m: 0 });

  const { position, container, place } = useAnchoredPopover({
    open,
    onDismiss: () => setOpen(false),
    triggerRef,
    panelRef,
    width: 304,
    height: withTime ? 420 : 380,
  });

  const emit = (iso: string, t = time) => onChange(withTime ? `${iso}T${pad(t.h)}:${pad(t.m)}` : iso);

  function openPicker() {
    if (disabled) return;
    setFocused(parseIsoDate(value) ?? new Date(now));
    setTime(parseTime(value) ?? { h: 0, m: 0 });
    place();
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openPicker();
    } else if (open && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  return (
    <>
      <Trigger
        triggerRef={triggerRef}
        open={open}
        label={formatDisplay(value, withTime)}
        placeholder={placeholder ?? (withTime ? 'Огноо, цаг сонгох' : 'Огноо сонгох')}
        onToggle={() => (open ? close(false) : openPicker())}
        onClear={clearable ? () => onChange('') : undefined}
        disabled={disabled}
        id={id}
        className={className}
        ariaLabel={ariaLabel}
        onKeyDown={onTriggerKey}
      />
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}

      {open && position && container
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={ariaLabel ?? 'Огноо сонгох'}
              className={cn(POPOVER_PANEL, 'p-3')}
              style={{ position: 'fixed', left: position.left, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                }
              }}
            >
              <Calendar
                autoFocus
                focused={focused}
                onFocusedChange={setFocused}
                today={today}
                selected={value ? toIsoDate(parseIsoDate(value) ?? today) : undefined}
                onPick={(iso) => {
                  emit(iso);
                  if (!withTime) close();
                  else setFocused(parseIsoDate(iso) ?? focused);
                }}
                onEscape={() => close()}
              />
              {withTime ? (
                <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <TimeField
                    value={time}
                    onChange={(t) => {
                      setTime(t);
                      if (value) emit(toIsoDate(parseIsoDate(value) ?? today), t);
                    }}
                  />
                  <button
                    type="button"
                    className={cn(footerBtn, 'bg-[var(--color-brand)] text-[var(--color-brand-fg)] hover:bg-[var(--color-brand)] hover:brightness-95')}
                    onClick={() => close()}
                  >
                    Болсон
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                <button
                  type="button"
                  className={cn(footerBtn, 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')}
                  onClick={() => {
                    onChange('');
                    close();
                  }}
                >
                  Цэвэрлэх
                </button>
                <button
                  type="button"
                  className={cn(footerBtn, 'text-[var(--color-brand)]')}
                  onClick={() => {
                    const t = new Date();
                    const iso = toIsoDate(t);
                    if (withTime) {
                      const nowTime = { h: t.getHours(), m: t.getMinutes() };
                      setTime(nowTime);
                      emit(iso, nowTime);
                      setFocused(t);
                    } else {
                      emit(iso);
                      close();
                    }
                  }}
                >
                  {withTime ? 'Одоо' : 'Өнөөдөр'}
                </button>
              </div>
            </div>,
            container,
          )
        : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// DateRangePicker
// ---------------------------------------------------------------------------

export interface DateRange {
  from: string;
  to: string;
}

interface Preset {
  label: string;
  range: (today: Date) => DateRange;
}

export const DEFAULT_RANGE_PRESETS: Preset[] = [
  { label: 'Өнөөдөр', range: (t) => ({ from: toIsoDate(t), to: toIsoDate(t) }) },
  { label: 'Сүүлийн 7 хоног', range: (t) => ({ from: toIsoDate(addDays(t, -6)), to: toIsoDate(t) }) },
  { label: 'Энэ сар', range: (t) => ({ from: toIsoDate(startOfMonth(t)), to: toIsoDate(t) }) },
  { label: 'Сүүлийн 30 хоног', range: (t) => ({ from: toIsoDate(addDays(t, -29)), to: toIsoDate(t) }) },
];

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Огнооны муж сонгох',
  presets = DEFAULT_RANGE_PRESETS,
  disabled,
  className,
  id,
  'aria-label': ariaLabel = 'Огнооны муж',
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
  /** Pass [] to hide the preset chips. */
  presets?: Preset[];
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}) {
  const { open, setOpen, triggerRef, panelRef } = usePickerState();
  const now = useNow(60_000);
  const today = new Date(now);
  const [focused, setFocused] = React.useState<Date>(() => parseIsoDate(value.from) ?? new Date(now));
  // While picking: the first click sets `anchor`, the second completes the range.
  const [anchor, setAnchor] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);

  const { position, container, place } = useAnchoredPopover({
    open,
    onDismiss: () => {
      setOpen(false);
      setAnchor(null);
    },
    triggerRef,
    panelRef,
    width: 304,
    height: presets.length ? 440 : 380,
  });

  function openPicker() {
    if (disabled) return;
    setFocused(parseIsoDate(value.to || value.from) ?? new Date(now));
    setAnchor(null);
    setHover(null);
    place();
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    setAnchor(null);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(iso: string) {
    if (!anchor) {
      setAnchor(iso);
      return;
    }
    const [from, to] = anchor <= iso ? [anchor, iso] : [iso, anchor];
    onChange({ from, to });
    close();
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openPicker();
    } else if (open && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  const label =
    value.from || value.to
      ? `${value.from ? formatDisplay(value.from) : '…'} – ${value.to ? formatDisplay(value.to) : '…'}`
      : '';

  // Preview while choosing the second end; otherwise show the committed range.
  const shownFrom = anchor ?? value.from;
  const shownTo = anchor ? (hover ?? anchor) : value.to;

  const activePreset = presets.find((p) => {
    const r = p.range(today);
    return r.from === value.from && r.to === value.to;
  });

  return (
    <>
      <Trigger
        triggerRef={triggerRef}
        open={open}
        label={label}
        placeholder={placeholder}
        onToggle={() => (open ? close(false) : openPicker())}
        onClear={() => onChange({ from: '', to: '' })}
        disabled={disabled}
        id={id}
        className={className}
        ariaLabel={ariaLabel}
        onKeyDown={onTriggerKey}
      />

      {open && position && container
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={ariaLabel}
              className={cn(POPOVER_PANEL, 'p-3')}
              style={{ position: 'fixed', left: position.left, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                }
              }}
            >
              {presets.length ? (
                <div className="mb-3 flex flex-wrap gap-1.5 border-b border-[var(--color-border)] pb-3">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        onChange(p.range(today));
                        close();
                      }}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition',
                        activePreset === p
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]'
                          : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <Calendar
                autoFocus
                focused={focused}
                onFocusedChange={setFocused}
                today={today}
                rangeFrom={shownFrom || undefined}
                rangeTo={shownTo || shownFrom || undefined}
                onPick={pick}
                onHover={setHover}
                onEscape={() => close()}
              />

              <p className="mt-2 text-center text-[11px] text-[var(--color-fg-subtle)]">
                {anchor ? 'Дуусах өдрөө сонгоно уу' : 'Эхлэх өдрөө сонгоно уу'}
              </p>

              <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                <button
                  type="button"
                  className={cn(footerBtn, 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')}
                  onClick={() => {
                    onChange({ from: '', to: '' });
                    close();
                  }}
                >
                  Цэвэрлэх
                </button>
                <button
                  type="button"
                  className={cn(footerBtn, 'text-[var(--color-brand)]')}
                  onClick={() => setFocused(new Date())}
                >
                  Өнөөдөр
                </button>
              </div>
            </div>,
            container,
          )
        : null}
    </>
  );
}
