'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Clock, TrendingUp, Zap } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatKwh, formatNumber } from '@/lib/format';
import type { HistoricalPowerAnalytics, HistoricalPowerPoint } from '@/lib/types';
import { Button, Card } from '@/components/ui/primitives';
import {
  AXIS_PROPS,
  BRAND,
  FadeGradient,
  GlassLegend,
  GlassTooltip,
  GlowFilter,
  GRID_PROPS,
  INFO,
  LINE_CURSOR,
  activeDot,
  useChartIds,
} from '@/components/charts/glass';
import { cn } from '@/lib/cn';

const TIME_RANGES = [
  { key: '15m', label: '15 мин' },
  { key: '1h', label: '1 цаг' },
  { key: '6h', label: '6 цаг' },
  { key: '24h', label: '24 цаг' },
  { key: '7d', label: '7 хоног' },
  { key: '30d', label: '30 хоног' },
] as const;

const PILE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899'];

export function HistoricalPowerCharts({
  stationId,
}: {
  stationId?: string;
}) {
  const [range, setRange] = React.useState<string>('1h');

  const { data, isLoading } = useSWR<HistoricalPowerAnalytics>(
    apiUrl('power-monitoring/analytics', {
      stationId: stationId || undefined,
      range,
    }),
    fetcher,
    { refreshInterval: range === '15m' || range === '1h' ? 10_000 : 60_000 },
  );

  const ids = useChartIds('stationOutputFill', 'glow');
  const points = data?.points ?? [];
  const capacityKw = data?.stationCapacityKw ?? 120;

  // Extract all pile keys present in the time points
  const pileKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const p of points) {
      if (p.piles) {
        Object.keys(p.piles).forEach((k) => keys.add(k));
      }
    }
    return Array.from(keys);
  }, [points]);

  return (
    <Card className="space-y-4">
      {/* Time Filter Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-brand" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
            Чадлын түүхэн график & Аналитик (Historical Power Analytics)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {TIME_RANGES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? 'primary' : 'ghost'}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && points.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-[var(--color-fg-muted)]">
          Чадлын аналитик мэдээллийг ачаалж байна...
        </div>
      ) : points.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-[var(--color-fg-muted)]">
          Сонгосон хугацаанд чадлын бүртгэл байхгүй байна.
        </div>
      ) : (
        <div className="space-y-6 pt-2">
          {/* Chart 1: Total Station Output Power vs Capacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-fg)]">
                1. Станцын нийт чадал (кВт) ба Тохируулсан дээд хязгаар
              </span>
              <span className="text-[var(--color-fg-muted)] font-mono text-[11px]">
                Дээд чадал: {capacityKw} кВт
              </span>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={points} margin={{ top: 10, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  <FadeGradient id={ids.stationOutputFill} color={BRAND} from={0.4} />
                  <GlowFilter id={ids.glow} />
                </defs>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="t" {...AXIS_PROPS} minTickGap={30} />
                <YAxis {...AXIS_PROPS} width={48} tickFormatter={(v: number) => `${v}`} />
                <Tooltip
                  cursor={LINE_CURSOR}
                  content={
                    <GlassTooltip
                      formatters={{
                        stationOutputKw: (v) => `${formatNumber(v, 1)} кВт`,
                        utilizationPct: (v) => `${v}%`,
                      }}
                    />
                  }
                />
                <ReferenceLine
                  y={capacityKw}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `Хязгаар: ${capacityKw} кВт`,
                    fill: '#ef4444',
                    position: 'top',
                    fontSize: 10,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="stationOutputKw"
                  name="Станцын гарц"
                  stroke={BRAND}
                  strokeWidth={2.5}
                  fill={`url(#${ids.stationOutputFill})`}
                  filter={`url(#${ids.glow})`}
                  activeDot={activeDot(BRAND)}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2: Multi-pile power breakdown comparison */}
          {pileKeys.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--color-fg)]">
                  2. Буу бүрийн чадлын харьцуулалт (Pile Power Breakdown)
                </span>
                <GlassLegend
                  items={pileKeys.map((k, i) => ({
                    label: k.replace('pile_', 'Буу #'),
                    color: PILE_COLORS[i % PILE_COLORS.length],
                  }))}
                />
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={points} margin={{ top: 10, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="t" {...AXIS_PROPS} minTickGap={30} />
                  <YAxis {...AXIS_PROPS} width={48} tickFormatter={(v: number) => `${v}`} />
                  <Tooltip
                    cursor={LINE_CURSOR}
                    content={
                      <GlassTooltip
                        formatters={Object.fromEntries(
                          pileKeys.map((k) => [k, (v: number) => `${formatNumber(v, 1)} кВт`]),
                        )}
                      />
                    }
                  />
                  {pileKeys.map((key, idx) => {
                    const color = PILE_COLORS[idx % PILE_COLORS.length];
                    return (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={`piles.${key}`}
                        name={key.replace('pile_', 'Буу #')}
                        stroke={color}
                        strokeWidth={2}
                        fill={color}
                        fillOpacity={0.15}
                        activeDot={activeDot(color)}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Chart 3: Delivered Energy (kWh) over time */}
          <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-fg)]">
                3. Түгээсэн эрчим хүчний хуримтлал (kWh)
              </span>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={points} margin={{ top: 10, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="t" {...AXIS_PROPS} minTickGap={30} />
                <YAxis {...AXIS_PROPS} width={48} tickFormatter={(v: number) => `${formatNumber(v, 0)}`} />
                <Tooltip
                  cursor={LINE_CURSOR}
                  content={<GlassTooltip formatters={{ energyKwh: (v) => formatKwh(v) }} />}
                />
                <Line
                  type="monotone"
                  dataKey="energyKwh"
                  name="Эрчим хүч"
                  stroke={INFO}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={activeDot(INFO)}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}
