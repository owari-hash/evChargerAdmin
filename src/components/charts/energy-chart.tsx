'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EnergySeriesPoint } from '@/lib/types';
import { formatKwh, formatMoney, formatNumber } from '@/lib/format';

/**
 * CSS custom properties resolve inside SVG paint attributes, so the charts
 * follow the light/dark theme without re-rendering on toggle.
 */
const AXIS = 'var(--color-fg-subtle)';
const GRID = 'var(--color-border)';
const BRAND = 'var(--color-brand)';
const INFO = 'var(--color-info)';

const AXIS_PROPS = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function TooltipBox({
  active,
  payload,
  label,
  formatters,
}: {
  active?: boolean;
  payload?: { name?: string; dataKey?: string | number; value?: number; color?: string }[];
  label?: string | number;
  formatters?: Record<string, (v: number) => string>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-[var(--color-fg)]">{label}</p>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? entry.name ?? '');
        const format = formatters?.[key] ?? ((v: number) => formatNumber(v, 2));
        return (
          <p key={key} className="flex items-center gap-2 text-[var(--color-fg-muted)]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color }}
              aria-hidden="true"
            />
            <span>{entry.name}</span>
            <span className="ml-auto font-medium text-[var(--color-fg)] tnum">
              {format(entry.value ?? 0)}
            </span>
          </p>
        );
      })}
    </div>
  );
}

/** Short axis label: 2026-08-19 -> 19 Aug */
function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function EnergySeriesChart({ data }: { data: EnergySeriesPoint[] }) {
  if (!data.length) {
    return <ChartEmpty message="No completed sessions in this period." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS_PROPS} minTickGap={24} />
        <YAxis {...AXIS_PROPS} width={56} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <Tooltip
          content={
            <TooltipBox
              formatters={{
                energyKwh: (v) => formatKwh(v),
                sessions: (v) => `${formatNumber(v)}`,
              }}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="energyKwh"
          name="Energy"
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#energyFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SessionsAndRevenueChart({ data }: { data: EnergySeriesPoint[] }) {
  if (!data.length) return <ChartEmpty message="No completed sessions in this period." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS_PROPS} minTickGap={24} />
        <YAxis yAxisId="left" {...AXIS_PROPS} width={44} />
        <YAxis yAxisId="right" orientation="right" {...AXIS_PROPS} width={64} />
        <Tooltip
          content={
            <TooltipBox
              formatters={{ sessions: (v) => formatNumber(v), cost: (v) => formatMoney(v) }}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="sessions"
          name="Sessions"
          stroke={INFO}
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cost"
          name="Revenue"
          stroke={BRAND}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopChargePointsChart({
  data,
}: {
  data: { chargePointId: string; energyKwh: number }[];
}) {
  if (!data.length) return <ChartEmpty message="No energy delivered in this period." />;

  const top = data.slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, top.length * 34 + 30)}>
      <BarChart data={top} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...AXIS_PROPS} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <YAxis
          type="category"
          dataKey="chargePointId"
          {...AXIS_PROPS}
          width={120}
          tick={{ fill: AXIS, fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-surface-2)' }}
          content={<TooltipBox formatters={{ energyKwh: (v) => formatKwh(v) }} />}
        />
        <Bar dataKey="energyKwh" name="Energy" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {top.map((entry) => (
            <Cell key={entry.chargePointId} fill={BRAND} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Power/SoC over the life of one charging session. */
export function SessionPowerChart({
  data,
}: {
  data: { t: string; power?: number | null; soc?: number | null; energy?: number | null }[];
}) {
  if (!data.length) return <ChartEmpty message="No meter values recorded for this session." />;

  const hasSoc = data.some((d) => d.soc !== null && d.soc !== undefined);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="t"
          {...AXIS_PROPS}
          minTickGap={40}
          tickFormatter={(v: string) =>
            new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          }
        />
        <YAxis yAxisId="power" {...AXIS_PROPS} width={56} />
        {hasSoc ? (
          <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} {...AXIS_PROPS} width={40} />
        ) : null}
        <Tooltip
          labelFormatter={(v) => new Date(String(v)).toLocaleString('en-GB')}
          content={
            <TooltipBox
              formatters={{
                power: (v) => `${formatNumber(v / 1000, 2)} kW`,
                soc: (v) => `${formatNumber(v, 0)}%`,
              }}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
        <Line
          yAxisId="power"
          type="monotone"
          dataKey="power"
          name="Power (W)"
          stroke={BRAND}
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        {hasSoc ? (
          <Line
            yAxisId="soc"
            type="monotone"
            dataKey="soc"
            name="State of charge"
            stroke={INFO}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-[var(--color-fg-muted)]">
      {message}
    </div>
  );
}
