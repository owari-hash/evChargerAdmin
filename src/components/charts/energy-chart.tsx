'use client';

import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EnergySeriesPoint } from '@/lib/types';
import { formatKwh, formatMoney, formatNumber } from '@/lib/format';
import { useStationLabel } from '@/components/station-name';
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
} from './glass';

/** Short axis label: 2026-08-19 -> 08/19 */
function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('mn-MN', { day: '2-digit', month: '2-digit' });
}

export function EnergySeriesChart({ data }: { data: EnergySeriesPoint[] }) {
  const ids = useChartIds('fill', 'glow');
  if (!data.length) {
    return <ChartEmpty message="Энэ хугацаанд дууссан цэнэглэлт алга." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <FadeGradient id={ids.fill} color={BRAND} from={0.4} />
          <GlowFilter id={ids.glow} />
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS_PROPS} minTickGap={24} />
        <YAxis {...AXIS_PROPS} width={56} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <Tooltip
          cursor={LINE_CURSOR}
          content={
            <GlassTooltip
              formatters={{
                energyKwh: (v) => formatKwh(v),
                sessions: (v) => `${formatNumber(v)}`,
              }}
            />
          }
        />
        <Area
          type="natural"
          dataKey="energyKwh"
          name="Эрчим хүч"
          stroke={BRAND}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill={`url(#${ids.fill})`}
          filter={`url(#${ids.glow})`}
          activeDot={activeDot(BRAND)}
          animationDuration={1400}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SessionsAndRevenueChart({ data }: { data: EnergySeriesPoint[] }) {
  const ids = useChartIds('glow');
  if (!data.length) return <ChartEmpty message="Энэ хугацаанд дууссан цэнэглэлт алга." />;

  return (
    <div className="space-y-3">
      <GlassLegend
        items={[
          { label: 'Цэнэглэлт', color: INFO },
          { label: 'Орлого', color: BRAND },
        ]}
      />
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <GlowFilter id={ids.glow} />
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS_PROPS} minTickGap={24} />
          <YAxis yAxisId="left" {...AXIS_PROPS} width={44} />
          <YAxis yAxisId="right" orientation="right" {...AXIS_PROPS} width={64} />
          <Tooltip
            cursor={LINE_CURSOR}
            content={<GlassTooltip formatters={{ sessions: (v) => formatNumber(v), cost: (v) => formatMoney(v) }} />}
          />
          <Line
            yAxisId="left"
            type="natural"
            dataKey="sessions"
            name="Цэнэглэлт"
            stroke={INFO}
            strokeWidth={2.5}
            dot={false}
            activeDot={activeDot(INFO)}
            filter={`url(#${ids.glow})`}
          />
          <Line
            yAxisId="right"
            type="natural"
            dataKey="cost"
            name="Орлого"
            stroke={BRAND}
            strokeWidth={2.5}
            dot={false}
            activeDot={activeDot(BRAND)}
            filter={`url(#${ids.glow})`}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Busiest stations as an iOS Screen Time-style ranked list: full station name
 * on one line, the figure on the right, a glowing capsule bar underneath.
 */
export function TopChargePointsChart({
  data,
}: {
  data: { chargePointId: string; energyKwh: number }[];
}) {
  const stationLabel = useStationLabel();
  if (!data.length) return <ChartEmpty message="Энэ хугацаанд эрчим хүч түгээгээгүй байна." />;

  const top = data.slice(0, 8).map((d) => ({ ...d, label: stationLabel(d.chargePointId) }));
  const max = Math.max(...top.map((d) => d.energyKwh), 0);
  const total = top.reduce((sum, d) => sum + d.energyKwh, 0);

  return (
    <ol className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
      {top.map((d, i) => {
        const pct = max > 0 ? (d.energyKwh / max) * 100 : 0;
        const share = total > 0 ? (d.energyKwh / total) * 100 : 0;
        return (
          <li key={d.chargePointId} className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tnum ' +
                    (i === 0
                      ? 'bg-[var(--color-brand)] text-[var(--color-brand-fg)] shadow-[0_0_12px_color-mix(in_srgb,var(--color-brand)_55%,transparent)]'
                      : 'bg-[color-mix(in_srgb,var(--color-fg)_7%,transparent)] text-[var(--color-fg-muted)]')
                  }
                >
                  {i + 1}
                </span>
                <span className="truncate font-medium text-[var(--color-fg)]" title={d.label}>
                  {d.label}
                </span>
              </span>
              <span className="shrink-0 tnum">
                <span className="font-semibold text-[var(--color-fg)]">{formatKwh(d.energyKwh)}</span>
                <span className="ml-1.5 text-[var(--color-fg-subtle)]">{formatNumber(share, 0)}%</span>
              </span>
            </div>
            <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
              <div
                className="glass-grow relative h-full rounded-full bg-gradient-to-r from-[color-mix(in_srgb,var(--color-brand)_45%,transparent)] to-[var(--color-brand)] shadow-[0_0_14px_color-mix(in_srgb,var(--color-brand)_50%,transparent)] transition-[width] duration-700 ease-out"
                style={{ width: `${d.energyKwh > 0 ? Math.max(2, pct) : 0}%` }}
              >
                {/* Glass highlight across the top half of the pill. */}
                <span className="absolute inset-x-1 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/40 to-transparent" />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Power/SoC over the life of one charging session. */
export function SessionPowerChart({
  data,
}: {
  data: { t: string; power?: number | null; soc?: number | null; energy?: number | null }[];
}) {
  const ids = useChartIds('fill', 'glow');
  if (!data.length) return <ChartEmpty message="Энэ цэнэглэлтэд тоолуурын утга бүртгэгдээгүй байна." />;

  const hasSoc = data.some((d) => d.soc !== null && d.soc !== undefined);

  return (
    <div className="space-y-3">
      <GlassLegend
        items={[
          { label: 'Чадал (Вт)', color: BRAND },
          ...(hasSoc ? [{ label: 'Цэнэгийн түвшин', color: INFO }] : []),
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <FadeGradient id={ids.fill} color={BRAND} from={0.3} />
            <GlowFilter id={ids.glow} />
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="t"
            {...AXIS_PROPS}
            minTickGap={40}
            tickFormatter={(v: string) => new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          />
          <YAxis yAxisId="power" {...AXIS_PROPS} width={56} />
          {hasSoc ? <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} {...AXIS_PROPS} width={40} /> : null}
          <Tooltip
            cursor={LINE_CURSOR}
            content={
              <GlassTooltip
                labelFormatter={(v) => new Date(String(v)).toLocaleString('en-GB')}
                formatters={{
                  power: (v) => `${formatNumber(v / 1000, 2)} kW`,
                  soc: (v) => `${formatNumber(v, 0)}%`,
                }}
              />
            }
          />
          <Area
            yAxisId="power"
            type="monotone"
            dataKey="power"
            name="Чадал (Вт)"
            stroke={BRAND}
            strokeWidth={2.5}
            fill={`url(#${ids.fill})`}
            filter={`url(#${ids.glow})`}
            activeDot={activeDot(BRAND)}
            connectNulls
          />
          {hasSoc ? (
            <Area
              yAxisId="soc"
              type="monotone"
              dataKey="soc"
              name="Цэнэгийн түвшин"
              stroke={INFO}
              strokeWidth={2.5}
              fill="none"
              filter={`url(#${ids.glow})`}
              activeDot={activeDot(INFO)}
              connectNulls
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-[var(--color-fg-muted)]">{message}</div>
  );
}
