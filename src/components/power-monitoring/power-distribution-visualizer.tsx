'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, Share2, Zap } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Allocation {
  connectorId: number;
  activePowerKw: number;
  ratedPowerKw: number;
  sharePct: number;
  utilizationOfRatedPct: number;
}

const PILE_COLORS = [
  { bar: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  { bar: 'from-sky-500 to-blue-600', bg: 'bg-sky-500', text: 'text-sky-500', border: 'border-sky-500/30' },
  { bar: 'from-amber-500 to-orange-500', bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500/30' },
  { bar: 'from-purple-500 to-indigo-500', bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500/30' },
];

export function PowerDistributionVisualizer({
  stationCapacityKw,
  totalOutputKw,
  remainingCapacityKw,
  overloadKw,
  allocations,
  status,
  isThrottled,
  isCapacityReached,
}: {
  stationCapacityKw: number;
  totalOutputKw: number;
  remainingCapacityKw: number;
  overloadKw: number;
  allocations: Allocation[];
  status: 'IDLE' | 'SINGLE_PILE' | 'EQUAL_SHARING' | 'DYNAMIC_SHARING' | 'OVERLOAD';
  isThrottled: boolean;
  isCapacityReached: boolean;
}) {
  const cap = Math.max(1, stationCapacityKw);
  const remainingPct = Math.max(0, Math.min(100, (remainingCapacityKw / cap) * 100));

  const statusLabel =
    status === 'OVERLOAD'
      ? 'Ачаалал хэтэрсэн (Overload)'
      : status === 'EQUAL_SHARING'
      ? 'Тэгш хуваарилалт (Equal Sharing)'
      : status === 'DYNAMIC_SHARING'
      ? 'Динамик хуваарилалт (Dynamic Sharing)'
      : status === 'SINGLE_PILE'
      ? 'Нэг буу идэвхтэй'
      : 'Сул зогсолттой (Idle)';

  const statusTone =
    status === 'OVERLOAD'
      ? 'text-rose-500 bg-rose-500/10 border-rose-500/30'
      : status === 'DYNAMIC_SHARING' || status === 'EQUAL_SHARING'
      ? 'text-brand bg-brand/10 border-brand/30'
      : 'text-[var(--color-fg-muted)] bg-[var(--color-surface-2)] border-[var(--color-border)]';

  return (
    <div className="space-y-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-brand" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
            Чадлын динамик хуваарилалтын мониторинг (Power Distribution)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', statusTone)}>
            <span className="size-1.5 rounded-full bg-current" />
            {statusLabel}
          </span>

          {isThrottled && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <AlertCircle className="size-3" />
              Хязгаарлагдсан (Throttled)
            </span>
          )}
        </div>
      </div>

      {/* Multi-Segment Stacked Capacity Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-[var(--color-fg)]">
            Нийт гарц: <strong className="font-mono text-sm">{formatNumber(totalOutputKw, 1)} кВт</strong>
            <span className="text-[var(--color-fg-muted)] font-normal ml-1.5">
              / {formatNumber(stationCapacityKw, 1)} кВт дээд хязгаар
            </span>
          </span>

          <span className="text-xs font-mono">
            {overloadKw > 0 ? (
              <span className="text-rose-500 font-bold">Хэтрэлт: +{formatNumber(overloadKw, 1)} кВт</span>
            ) : (
              <span className="text-emerald-500 font-medium">Боломжит нөөц: {formatNumber(remainingCapacityKw, 1)} кВт ({Math.round(remainingPct)}%)</span>
            )}
          </span>
        </div>

        {/* Visual Multi-Segment Bar */}
        <div className="relative flex h-8 w-full overflow-hidden rounded-xl bg-[var(--color-surface-2)] p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
          {allocations.map((a, idx) => {
            if (a.activePowerKw <= 0) return null;
            const widthPct = Math.max(2, Math.min(100, (a.activePowerKw / cap) * 100));
            const color = PILE_COLORS[idx % PILE_COLORS.length];
            return (
              <div
                key={a.connectorId}
                className={cn(
                  'relative h-full flex items-center justify-center text-[11px] font-bold text-white shadow-xs rounded-lg transition-all duration-500 bg-gradient-to-r',
                  color.bar,
                )}
                style={{ width: `${widthPct}%` }}
                title={`Буу #${a.connectorId}: ${formatNumber(a.activePowerKw, 1)} кВт (${a.sharePct}%)`}
              >
                <span className="truncate px-1.5 drop-shadow-sm font-mono">
                  Буу #{a.connectorId}: {formatNumber(a.activePowerKw, 0)} кВт
                </span>
              </div>
            );
          })}

          {/* Headroom / Remaining segment */}
          {remainingCapacityKw > 0 && (
            <div
              className="h-full flex items-center justify-center text-[10px] font-medium text-[var(--color-fg-muted)] transition-all duration-500"
              style={{ width: `${remainingPct}%` }}
            >
              <span className="truncate px-1 font-mono">
                Нөөц: {formatNumber(remainingCapacityKw, 0)} кВт
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Piles Allocation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
        {allocations.map((a, idx) => {
          const color = PILE_COLORS[idx % PILE_COLORS.length];
          const isDrawing = a.activePowerKw > 0;
          return (
            <div
              key={a.connectorId}
              className={cn(
                'rounded-xl border p-2.5 space-y-1.5 transition',
                isDrawing
                  ? 'border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs'
                  : 'border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/40 opacity-70',
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-[var(--color-fg)]">
                  <span className={cn('size-2 rounded-full', isDrawing ? color.bg : 'bg-gray-400')} />
                  Буу #{a.connectorId}
                </span>

                <span className="font-mono text-[11px] font-semibold text-[var(--color-fg-muted)]">
                  Суурилуулсан: {a.ratedPowerKw} кВт
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className={cn('text-lg font-bold font-mono', isDrawing ? color.text : 'text-[var(--color-fg-muted)]')}>
                    {formatNumber(a.activePowerKw, 1)} кВт
                  </span>
                </div>

                <div className="text-right text-[11px] font-mono text-[var(--color-fg-muted)]">
                  <span>Эзлэх хувь: </span>
                  <strong className="text-[var(--color-fg)]">{a.sharePct}%</strong>
                </div>
              </div>

              {/* Progress bar of rated pile capacity */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[var(--color-fg-muted)]">
                  <span>Бууны ачаалал</span>
                  <span className="font-mono font-semibold">{a.utilizationOfRatedPct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r', color.bar)}
                    style={{ width: `${Math.min(100, Math.max(0, a.utilizationOfRatedPct))}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
