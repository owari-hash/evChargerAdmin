'use client';

import * as React from 'react';
import { formatNumber } from '@/lib/format';

/**
 * Shared "glass" chart styling (iOS-style): frosted tooltips, faint grids,
 * glowing smooth strokes and fading gradient fills. CSS custom properties
 * resolve inside SVG paint attributes, so charts follow light/dark mode
 * without re-rendering.
 */

export const AXIS = 'var(--color-fg-subtle)';
export const GRID = 'color-mix(in srgb, var(--color-fg) 7%, transparent)';
export const BRAND = 'var(--color-brand)';
export const INFO = 'var(--color-info)';

export const AXIS_PROPS = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/** Solid horizontal hairlines only, the way iOS charts draw them. */
export const GRID_PROPS = { stroke: GRID, vertical: false } as const;

/** Hover guide for line/area charts. */
export const LINE_CURSOR = { stroke: AXIS, strokeOpacity: 0.35, strokeDasharray: '3 4' };

/** Hover highlight for bar charts. */
export const BAR_CURSOR = { fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)', radius: 8 };

/** White dot with a coloured ring on hover. */
export function activeDot(color: string) {
  return { r: 5, fill: '#fff', stroke: color, strokeWidth: 2.5 };
}

/**
 * Unique, url()-safe ids for one chart's gradients and filters, so several
 * charts on a page never share (and overwrite) each other's <defs>.
 */
export function useChartIds<K extends string>(...names: K[]): Record<K, string> {
  const base = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  return Object.fromEntries(names.map((n) => [n, `${n}-${base}`])) as Record<K, string>;
}

/** Vertical fill that fades from the line colour to nothing. */
export function FadeGradient({ id, color, from = 0.35 }: { id: string; color: string; from?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="70%" stopColor={color} stopOpacity={from * 0.25} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

/** Bar fill: bright at the cap, softer at the base, like a lit glass pill. */
export function BarGradient({ id, color, horizontal = false }: { id: string; color: string; horizontal?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1={horizontal ? '0' : '1'} x2={horizontal ? '1' : '0'} y2="0">
      <stop offset="0%" stopColor={color} stopOpacity={0.45} />
      <stop offset="100%" stopColor={color} stopOpacity={1} />
    </linearGradient>
  );
}

/** Soft glow under a stroke. Apply with `filter={`url(#${id})`}`. */
export function GlowFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-10%" y="-30%" width="120%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

const GLASS_PANEL =
  'rounded-2xl border border-[color-mix(in_srgb,var(--color-fg)_10%,transparent)] ' +
  'bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] backdrop-blur-xl backdrop-saturate-150 ' +
  'shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]';

/** Frosted-glass tooltip used by every chart. */
export function GlassTooltip({
  active,
  payload,
  label,
  formatters,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { name?: string; dataKey?: string | number; value?: number; color?: string; stroke?: string; fill?: string }[];
  label?: string | number;
  formatters?: Record<string, (v: number) => string>;
  labelFormatter?: (label: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={`${GLASS_PANEL} min-w-[9rem] px-3.5 py-2.5 text-xs`}>
      {label !== undefined ? (
        <p className="mb-1.5 font-semibold text-[var(--color-fg)]">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? entry.name ?? '');
        const format = formatters?.[key] ?? ((v: number) => formatNumber(v, 2));
        // Gradient fills come through as url(#…); the stroke holds the real colour.
        const swatch = [entry.stroke, entry.color, entry.fill].find((c) => c && !c.startsWith('url('));
        return (
          <p key={key} className="flex items-center gap-2 py-0.5 text-[var(--color-fg-muted)]">
            <span
              className="inline-block h-2 w-2 rounded-full shadow-[0_0_6px_currentColor]"
              style={{ background: swatch, color: swatch }}
              aria-hidden="true"
            />
            <span>{entry.name}</span>
            <span className="ml-auto pl-3 font-semibold text-[var(--color-fg)] tnum">{format(entry.value ?? 0)}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Small legend chips that match the glass tooltip swatches. */
export function GlassLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--color-fg)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] px-2.5 py-1 text-[var(--color-fg-muted)]"
        >
          <span
            className="h-2 w-2 rounded-full shadow-[0_0_6px_currentColor]"
            style={{ background: it.color, color: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
