'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Trash2, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import { Button, Input } from '@/components/ui/primitives';
import { formatNumber } from '@/lib/format';
import type { TariffZone } from '@/lib/types';
import { cn } from '@/lib/cn';

function FormattedTariffInput({
  value,
  onChange,
  className,
}: {
  value: number | undefined | null;
  onChange: (val: number) => void;
  className?: string;
}) {
  const [focused, setFocused] = React.useState(false);
  const [text, setText] = React.useState('');

  const formattedValue = React.useMemo(() => {
    if (value == null || value === 0) return '';
    return Number(value).toLocaleString('mn-MN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [value]);

  const displayValue = focused ? text : formattedValue;

  function handleFocus() {
    setFocused(true);
    setText(value != null && value !== 0 ? String(value) : '');
  }

  function handleBlur() {
    setFocused(false);
    const cleaned = text.replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    if (!Number.isNaN(num) && num >= 0) {
      const rounded = Math.round(num * 100) / 100;
      onChange(rounded);
    } else {
      onChange(0);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setText(raw);
      const num = parseFloat(raw);
      if (!Number.isNaN(num)) {
        onChange(num);
      } else if (raw === '') {
        onChange(0);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = (value || 0) + 1;
      const rounded = Math.round(current * 100) / 100;
      onChange(rounded);
      setText(String(rounded));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = Math.max(0, (value || 0) - 1);
      const rounded = Math.round(current * 100) / 100;
      onChange(rounded);
      setText(String(rounded));
    }
  }

  function step(delta: number) {
    const next = Math.max(0, (value || 0) + delta);
    const rounded = Math.round(next * 100) / 100;
    onChange(rounded);
    if (focused) {
      setText(String(rounded));
    }
  }

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="0.00"
        className={cn('h-9 text-xs pr-14 font-mono font-semibold', className)}
      />
      {/* Stepper buttons + Currency symbol */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <div className="flex flex-col text-[9px] text-[var(--color-fg-subtle)] leading-none">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => step(1)}
            className="hover:text-[var(--color-fg)] p-0.5 cursor-pointer leading-none"
            aria-label="Ихэсгэх"
          >
            ▲
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => step(-1)}
            className="hover:text-[var(--color-fg)] p-0.5 cursor-pointer leading-none"
            aria-label="Багасгах"
          >
            ▼
          </button>
        </div>
        <span className="text-xs font-medium text-[var(--color-fg-subtle)] pl-0.5">
          ₮
        </span>
      </div>
    </div>
  );
}

function minutesToTime(minutes: number): string {
  if (minutes >= 1440) return '24:00';
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDuration(start: number, end: number): string {
  const duration = end >= start ? end - start : (1440 - start) + end;
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  if (hours > 0 && mins > 0) return `${hours}ц ${mins}м`;
  if (hours > 0) return `${hours} цаг`;
  return `${mins} минут`;
}

/**
 * Expands any overnight zone (e.g. 22:00 -> 06:00) into two intra-day segments
 * [startMinute, 1440) and [0, endMinute) for overlap checking and 24h timeline bar.
 */
function expandTariffZones(zones: TariffZone[]) {
  const expanded: (TariffZone & { origIdx: number; isOvernight?: boolean })[] = [];
  zones.forEach((z, idx) => {
    if (z.startMinute > z.endMinute) {
      expanded.push({ ...z, startMinute: z.startMinute, endMinute: 1440, origIdx: idx, isOvernight: true });
      expanded.push({ ...z, startMinute: 0, endMinute: z.endMinute, origIdx: idx, isOvernight: true });
    } else {
      expanded.push({ ...z, origIdx: idx });
    }
  });
  return expanded;
}

/** Overlap check mirrors backend validateTariffZones */
function overlapError(zones: TariffZone[]): string | null {
  for (const z of zones) {
    if (z.startMinute === z.endMinute) {
      return `"${z.name || 'Цагийн бүс'}" эхлэх болон дуусах цаг ижил байж болохгүй`;
    }
  }
  const expanded = expandTariffZones(zones);
  const sorted = [...expanded].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMinute < sorted[i - 1].endMinute) {
      const nameA = sorted[i - 1].name || `Бүс #${sorted[i - 1].origIdx + 1}`;
      const nameB = sorted[i].name || `Бүс #${sorted[i].origIdx + 1}`;
      return `"${nameA}" болон "${nameB}" цагийн бүсүүд давхцаж байна`;
    }
  }
  return null;
}

const ZONE_COLORS = [
  { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', bar: 'bg-emerald-500', text: 'text-emerald-400' },
  { border: 'border-amber-500/30', bg: 'bg-amber-500/10', bar: 'bg-amber-500', text: 'text-amber-400' },
  { border: 'border-sky-500/30', bg: 'bg-sky-500/10', bar: 'bg-sky-500', text: 'text-sky-400' },
  { border: 'border-violet-500/30', bg: 'bg-violet-500/10', bar: 'bg-violet-500', text: 'text-violet-400' },
  { border: 'border-rose-500/30', bg: 'bg-rose-500/10', bar: 'bg-rose-500', text: 'text-rose-400' },
];

const PRESETS = [
  { name: 'Шөнийн тариф', startMinute: 1320, endMinute: 360, defaultPrice: 168, label: 'Шөнийн (22:00–06:00 · 168₮)' },
  { name: 'Өдрийн тариф', startMinute: 360, endMinute: 1020, defaultPrice: 278, label: 'Өдрийн (06:00–17:00 · 278₮)' },
  { name: 'Оргил ачаалал', startMinute: 1020, endMinute: 1320, defaultPrice: 417, label: 'Оргил цаг (17:00–22:00 · 417₮)' },
];

export function TariffZonesEditor({
  zones,
  onChange,
  baseTariff,
}: {
  zones: TariffZone[];
  onChange: (zones: TariffZone[]) => void;
  baseTariff?: number | string | null;
}) {
  const error = zones.length > 0 ? overlapError(zones) : null;

  function update(index: number, patch: Partial<TariffZone>) {
    onChange(zones.map((z, i) => (i === index ? { ...z, ...patch } : z)));
  }

  function remove(index: number) {
    onChange(zones.filter((_, i) => i !== index));
  }

  function add() {
    const last = zones[zones.length - 1];
    const start = last ? Math.min(last.endMinute, 1380) : 0;
    const end = Math.min(start + 60, 1440);
    const defaultName = start < 360 ? 'Шөнийн тариф' : start < 1020 ? 'Өдрийн тариф' : 'Оргил цаг';
    onChange([
      ...zones,
      {
        name: defaultName,
        startMinute: start,
        endMinute: end,
        tariffPerKwh: 0,
      },
    ]);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    // Check if preset already overlaps
    const overlaps = zones.some(
      (z) => !(preset.endMinute <= z.startMinute || preset.startMinute >= z.endMinute)
    );
    if (overlaps) {
      // Just add anyway, user can edit or notice error
    }
    const newZone: TariffZone = {
      name: preset.name,
      startMinute: preset.startMinute,
      endMinute: preset.endMinute,
      tariffPerKwh: preset.defaultPrice,
    };
    onChange([...zones, newZone]);
  }

  // Calculate timeline segments for 24-hour visual bar (0 to 1440 min)
  const sortedZones = expandTariffZones(zones).sort((a, b) => a.startMinute - b.startMinute);

  return (
    <div className="space-y-4">
      {/* 24-Hour Visual Timeline */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-[var(--color-fg-muted)]">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
            <span>24 цагийн тарифт хуваарь</span>
          </div>
          <span className="text-[11px] text-[var(--color-fg-subtle)]">
            {zones.length === 0
              ? 'Бүх цагт суурь тариф'
              : `${zones.length} бүс тохируулагдсан`}
          </span>
        </div>

        {/* The Bar */}
        <div className="relative h-7 w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex">
          {zones.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-2)] text-[11px] text-[var(--color-fg-muted)]">
              Суурь тариф: {baseTariff != null && baseTariff !== '' ? `${formatNumber(Number(baseTariff), 2)}₮ / кВт·ц` : 'Тохируулаагүй'}
            </div>
          ) : (
            (() => {
              const segments: React.ReactNode[] = [];
              let currentMin = 0;

              sortedZones.forEach((z, idx) => {
                // Gap before this zone
                if (z.startMinute > currentMin) {
                  const gapWidth = ((z.startMinute - currentMin) / 1440) * 100;
                  segments.push(
                    <div
                      key={`gap-${currentMin}`}
                      style={{ width: `${gapWidth}%` }}
                      className="h-full bg-[var(--color-surface-2)] flex items-center justify-center overflow-hidden border-r border-[var(--color-border)]/50 text-[10px] text-[var(--color-fg-subtle)]"
                      title={`Суурь тариф: ${minutesToTime(currentMin)} – ${minutesToTime(z.startMinute)}`}
                    >
                      {gapWidth > 12 ? 'Суурь' : ''}
                    </div>
                  );
                }

                // The zone itself
                const zoneWidth = (Math.max(0, z.endMinute - z.startMinute) / 1440) * 100;
                const origIdx = (z as any).origIdx ?? idx;
                const color = ZONE_COLORS[origIdx % ZONE_COLORS.length];
                segments.push(
                  <div
                    key={`zone-${idx}-${z.startMinute}`}
                    style={{ width: `${zoneWidth}%` }}
                    className={cn(
                      'h-full flex items-center justify-center overflow-hidden border-r border-black/10 px-1 font-medium transition-all text-[10px] text-white select-none',
                      color.bar
                    )}
                    title={`${z.name || 'Бүс ' + (origIdx + 1)}: ${minutesToTime(z.startMinute)} – ${minutesToTime(z.endMinute)} (${formatNumber(z.tariffPerKwh, 2)}₮/кВт·ц)`}
                  >
                    {zoneWidth > 14 ? (
                      <span className="truncate">
                        {z.name || `Бүс ${origIdx + 1}`} ({formatNumber(z.tariffPerKwh, 2)}₮)
                      </span>
                    ) : zoneWidth > 8 ? (
                      <span className="truncate">{formatNumber(z.tariffPerKwh, 2)}₮</span>
                    ) : null}
                  </div>
                );

                currentMin = Math.max(currentMin, z.endMinute);
              });

              // Final gap till end of day
              if (currentMin < 1440) {
                const gapWidth = ((1440 - currentMin) / 1440) * 100;
                segments.push(
                  <div
                    key={`gap-end-${currentMin}`}
                    style={{ width: `${gapWidth}%` }}
                    className="h-full bg-[var(--color-surface-2)] flex items-center justify-center overflow-hidden text-[10px] text-[var(--color-fg-subtle)]"
                    title={`Суурь тариф: ${minutesToTime(currentMin)} – 24:00`}
                  >
                    {gapWidth > 12 ? 'Суурь' : ''}
                  </div>
                );
              }

              return segments;
            })()
          )}
        </div>

        {/* Time tick markers */}
        <div className="flex justify-between text-[10px] text-[var(--color-fg-subtle)] font-mono px-0.5">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-fg-muted)] mr-1">
          <Sparkles className="h-3 w-3 text-[var(--color-brand)]" />
          Бэлэн загварууд:
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(
              PRESETS.map((p) => ({
                name: p.name,
                startMinute: p.startMinute,
                endMinute: p.endMinute,
                tariffPerKwh: p.defaultPrice,
              }))
            );
          }}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-brand)] transition hover:bg-[var(--color-brand)]/20 cursor-pointer shadow-xs"
        >
          <Sparkles className="h-2.5 w-2.5" />
          <span>ЭХЗХ 350 тариф бүрэн оруулах (168 / 278 / 417₮)</span>
        </button>
        {PRESETS.map((preset) => {
          const isAdded = zones.some((z) => z.startMinute === preset.startMinute && z.endMinute === preset.endMinute);
          return (
            <button
              key={`${preset.name}-${preset.startMinute}`}
              type="button"
              onClick={() => applyPreset(preset)}
              disabled={isAdded}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] transition hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
                isAdded && 'bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)]'
              )}
            >
              <Plus className="h-2.5 w-2.5" />
              <span>{preset.label}</span>
            </button>
          );
        })}
        <Link
          href="/tariffs"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-brand)] hover:underline"
        >
          <span>Тарифын тооцоолуур ↗</span>
        </Link>
      </div>

      {/* Validation Error Banner */}
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-2.5 text-xs text-[var(--color-danger)]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Zone Cards List */}
      <div className="space-y-2.5">
        {zones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-center">
            <Clock className="mx-auto h-7 w-7 text-[var(--color-fg-subtle)] mb-1.5" />
            <p className="text-xs font-medium text-[var(--color-fg)]">Цагийн бүс тохируулаагүй байна</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
              Бүх 24 цагийн турш дээрх 1 кВт·ц суурь тариф ашиглагдана.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={add}
              className="mt-3"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Эхний цагийн бүс нэмэх
            </Button>
          </div>
        ) : (
          zones.map((zone, i) => {
            const color = ZONE_COLORS[i % ZONE_COLORS.length];
            const isOvernight = zone.startMinute > zone.endMinute;
            const isMidnightEnd = zone.endMinute === 1440;
            return (
              <div
                key={i}
                className={cn(
                  'group relative rounded-xl border bg-[var(--color-surface)] p-3.5 shadow-sm transition hover:shadow-md',
                  color.border
                )}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--color-border)]/60">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white',
                        color.bar
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xs font-semibold text-[var(--color-fg)]">
                      {zone.name?.trim() ? zone.name : `Цагийн бүс #${i + 1}`}
                    </span>
                    <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-fg-muted)] flex items-center gap-1">
                      {isOvernight ? <span className="text-indigo-400 font-semibold">🌙 Шөнө дамнасан · </span> : null}
                      {formatDuration(zone.startMinute, zone.endMinute)}
                    </span>
                    <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand)] font-mono">
                      {formatNumber(zone.tariffPerKwh, 2)} ₮
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(i)}
                    className="h-7 px-2 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                    aria-label="Бүс устгах"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Устгах</span>
                  </Button>
                </div>

                {/* Card Fields Grid */}
                <div className="mt-3 grid gap-3 sm:grid-cols-12 sm:items-end">
                  {/* Zone Name: 5 cols */}
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-medium text-[var(--color-fg-muted)] flex items-center justify-between">
                      <span>Бүсийн нэр</span>
                      <span className="text-[10px] text-[var(--color-fg-subtle)]">жнь: Шөнийн тариф</span>
                    </label>
                    <Input
                      value={zone.name ?? ''}
                      onChange={(e) => update(i, { name: e.target.value })}
                      placeholder="Шөнийн тариф, Оргил цаг..."
                      className="h-9 text-xs"
                    />
                  </div>

                  {/* Time Range: 4 cols */}
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[11px] font-medium text-[var(--color-fg-muted)] flex items-center justify-between">
                      <span>Цагийн интервал</span>
                      {isOvernight ? (
                        <span className="text-[10px] text-indigo-400 font-medium">Шөнө дамнасан (+1 өдөр)</span>
                      ) : isMidnightEnd ? (
                        <span className="text-[10px] text-amber-500 font-medium">24:00 хүртэл</span>
                      ) : null}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={minutesToTime(zone.startMinute)}
                        onChange={(e) => update(i, { startMinute: timeToMinutes(e.target.value) })}
                        className="h-9 text-xs font-mono text-center px-1"
                        title="Эхлэх цаг"
                      />
                      <span className="text-xs text-[var(--color-fg-subtle)] font-medium">—</span>
                      <Input
                        type="time"
                        value={minutesToTime(isMidnightEnd ? 0 : zone.endMinute)}
                        onChange={(e) => {
                          const minutes = timeToMinutes(e.target.value);
                          const resolvedEnd = minutes === 0 && zone.startMinute >= 720 ? 1440 : minutes;
                          update(i, { endMinute: resolvedEnd });
                        }}
                        className="h-9 text-xs font-mono text-center px-1"
                        title="Дуусах цаг (00:00 сонговол 24:00 шөнө дунд гэж тооцогдоно)"
                      />
                    </div>
                  </div>

                  {/* Tariff: 3 cols */}
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-medium text-[var(--color-fg-muted)]">
                      Тариф (₮ / кВт·ц)
                    </label>
                    <FormattedTariffInput
                      value={zone.tariffPerKwh}
                      onChange={(val) => update(i, { tariffPerKwh: val })}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Custom Zone Button */}
      {zones.length > 0 ? (
        <div className="flex items-center justify-between pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Шинэ цагийн бүс нэмэх
          </Button>

          <p className="text-[11px] text-[var(--color-fg-subtle)]">
            * Тохируулаагүй бусад бүх цагт суурь 1 кВт·ц тариф мөрдөгдөнө.
          </p>
        </div>
      ) : null}
    </div>
  );
}
