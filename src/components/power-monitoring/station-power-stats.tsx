'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, Activity, BatteryCharging, Clock, GitFork, Settings2, Zap } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatNumber } from '@/lib/format';
import type { StationPowerItem, StationPowerStats } from '@/lib/types';
import { Card, CardBody, CardHeader, Select, Skeleton, EmptyState } from '@/components/ui/primitives';
import { DateRangePicker, toIsoDate } from '@/components/ui/date-picker';
import { AXIS_PROPS, GRID_PROPS, GlassLegend, GlassTooltip, LINE_CURSOR, BAR_CURSOR } from '@/components/charts/glass';
import { cn } from '@/lib/cn';

const TZ = 'Asia/Ulaanbaatar';
const GUN_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const kw = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : `${formatNumber(v, d)} кВт`);

function hhmm(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ, month: '2-digit', day: '2-digit' });
}

function duration(min: number) {
  if (!min) return '0 мин';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} ц ${m} мин` : `${m} мин`;
}

/** Local (browser) day boundaries; the admin runs in Ulaanbaatar. */
function dayStart(d: string) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd, 0, 0, 0, 0).toISOString();
}
function dayEnd(d: string) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd, 23, 59, 59, 999).toISOString();
}

export function StationPowerStatsPanel({
  stations,
  stationsLoading,
  stationId,
  onStationChange,
  onConfigure,
}: {
  stations: StationPowerItem[];
  stationsLoading: boolean;
  stationId: string;
  onStationChange: (id: string) => void;
  onConfigure?: (st: StationPowerItem) => void;
}) {
  const today = React.useMemo(() => toIsoDate(new Date()), []);
  const [range, setRange] = React.useState({ from: today, to: today });

  const live = stations.find((s) => s.id === stationId);
  const from = range.from || today;
  const to = range.to || range.from || today;
  const includesToday = to >= today;

  const { data, error, isLoading } = useSWR<StationPowerStats>(
    stationId
      ? apiUrl(`power-monitoring/stations/${encodeURIComponent(stationId)}/stats`, { from: dayStart(from), to: dayEnd(to) })
      : null,
    fetcher,
    { refreshInterval: includesToday ? 30_000 : 0, keepPreviousData: true },
  );

  const options = React.useMemo(
    () =>
      [...stations]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.id, label: s.name, code: s.cpId })),
    [stations],
  );

  const guns = data?.station.connectors.map((c) => c.connectorId) ?? data?.connectors.map((c) => c.connectorId) ?? [];
  const capacity = data?.station.gridLimitKw ?? data?.station.ratedCapacityKw ?? null;
  const s = data?.summary;
  const singleDay = from === to;

  return (
    <div className="space-y-4">
      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <Card className="overflow-visible">
        <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:p-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Zap className="size-4 shrink-0 text-[var(--color-brand)]" aria-hidden />
            <Select
              className="w-full sm:max-w-md"
              value={stationId}
              onChange={(e) => onStationChange(e.target.value)}
              options={options}
              placeholder={stationsLoading ? 'Ачаалж байна…' : 'Станц сонгох'}
              searchable
              searchPlaceholder="Станцын нэр эсвэл ID"
              aria-label="Станц"
            />
          </div>
          <DateRangePicker
            className="w-full sm:w-auto sm:min-w-[15rem]"
            value={range}
            onChange={(r) => setRange(r)}
            aria-label="Огнооны муж"
          />
        </div>
      </Card>

      {!stationId ? (
        <Card>
          <EmptyState title="Станц сонгоно уу" description="Дээрээс станц сонгоход тухайн станцын чадлын мэдээлэл гарна." />
        </Card>
      ) : error ? (
        <Card>
          <CardBody className="text-sm text-[var(--color-danger)]">
            Мэдээлэл ачаалж чадсангүй: {(error as Error).message}
          </CardBody>
        </Card>
      ) : !data || (isLoading && !data) ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[1.375rem]" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Station identity + live guns ─────────────────────── */}
          <Card>
            <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      live?.isOnline ? 'bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500' : 'bg-[var(--color-fg-subtle)]',
                    )}
                  />
                  <h2 className="truncate text-lg font-semibold text-[var(--color-fg)]">{data.station.name}</h2>
                </div>
                <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                  <span className="font-mono">{data.station.cpId}</span>
                  {data.station.model ? ` · ${data.station.model}` : ''}
                  {' · '}
                  Хүчин чадал:{' '}
                  {capacity ? (
                    <span className="font-semibold text-[var(--color-fg)]">{kw(capacity, 0)}</span>
                  ) : (
                    'тохируулаагүй'
                  )}
                  {live && onConfigure ? (
                    <button
                      type="button"
                      onClick={() => onConfigure(live)}
                      className="ml-1.5 inline-flex items-center gap-1 text-[var(--color-brand)] hover:underline"
                    >
                      <Settings2 className="size-3" /> засах
                    </button>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(live?.connectors ?? []).map((c, i) => {
                  const p = c.powerKw ?? 0;
                  const on = p >= 1;
                  return (
                    <div
                      key={c.connectorId}
                      className={cn(
                        'min-w-[8.5rem] rounded-2xl border px-3.5 py-2.5',
                        on
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)]',
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)]">
                        <span className="size-2 rounded-full" style={{ background: GUN_COLORS[i % GUN_COLORS.length] }} />
                        Буу {c.connectorId} · одоо
                      </div>
                      <div className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--color-fg)]">
                        {formatNumber(p, 1)} <span className="text-xs font-normal text-[var(--color-fg-muted)]">кВт</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* ── Headline numbers ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={<ArrowUp className="size-4" />}
              label="Хамгийн их чадал"
              value={kw(s!.peakKw)}
              hint={s!.peakAt ? `${singleDay ? '' : dayLabel(s!.peakAt) + ' '}${hhmm(s!.peakAt)}-д` : 'цэнэглэлт байхгүй'}
              tone="brand"
              bar={capacity ? s!.peakKw / capacity : undefined}
            />
            <Stat
              icon={<Activity className="size-4" />}
              label="Дундаж чадал"
              value={kw(s!.avgKw)}
              hint="цэнэглэж байх үеийн дундаж"
              bar={capacity ? s!.avgKw / capacity : undefined}
            />
            <Stat
              icon={<ArrowDown className="size-4" />}
              label="Хамгийн бага чадал"
              value={kw(s!.lowKw)}
              hint="цэнэглэж байх үеийн (доод 5%)"
              bar={capacity ? s!.lowKw / capacity : undefined}
            />
            <Stat
              icon={<BatteryCharging className="size-4" />}
              label="Нийт эрчим хүч"
              value={`${formatNumber(s!.energyKwh, 1)} кВт·ц`}
              hint={`${s!.sessions} цэнэглэлт · ${duration(s!.chargingMinutes)}`}
            />
          </div>

          {/* ── Simultaneous charging ────────────────────────────── */}
          <SharingCard data={data} guns={guns} capacity={capacity} />

          {/* ── Power over time ──────────────────────────────────── */}
          <PowerChart data={data} guns={guns} capacity={capacity} singleDay={singleDay} />

          {/* ── Per-day table ─────────────────────────────────────── */}
          {!singleDay ? <DaysTable data={data} onPickDay={(d) => setRange({ from: d, to: d })} /> : null}

          {/* ── Hourly profile ────────────────────────────────────── */}
          <HourlyChart data={data} />
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
  bar,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'brand';
  bar?: number;
}) {
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-fg-muted)]">
          <span className={cn('grid size-7 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)]', tone === 'brand' && 'bg-emerald-500/15 text-emerald-500')}>
            {icon}
          </span>
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-fg)] sm:text-3xl">{value}</div>
        {bar !== undefined ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fg)_8%,transparent)]">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, bar * 100))}%` }} />
          </div>
        ) : null}
        {hint ? <p className="mt-1.5 text-xs text-[var(--color-fg-muted)]">{hint}</p> : null}
      </div>
    </Card>
  );
}

function SharingCard({ data, guns, capacity }: { data: StationPowerStats; guns: number[]; capacity: number | null }) {
  const { sharing, connectors, summary } = data;
  const color = (cid: number) => GUN_COLORS[Math.max(0, guns.indexOf(cid)) % GUN_COLORS.length];

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <GitFork className="size-4 text-[var(--color-brand)]" /> Буу тус бүр ба зэрэг цэнэглэлт
          </span>
        }
        description={
          sharing.minutes
            ? `${duration(sharing.minutes)} хоёр ба түүнээс олон буу зэрэг цэнэглэсэн. Тэр үед нийт дундаж ${kw(sharing.avgTotalKw)}, дээд тал нь ${kw(sharing.peakTotalKw)}.`
            : 'Энэ хугацаанд буунууд зэрэг цэнэглээгүй.'
        }
      />
      <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
        {/* per-gun table */}
        <div className="overflow-x-auto border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-fg-muted)]">
                <th className="px-4 py-2.5 font-medium">Буу</th>
                <th className="px-3 py-2.5 text-right font-medium">Ганцаараа: дундаж / дээд</th>
                <th className="px-3 py-2.5 text-right font-medium">Зэрэг үед: дундаж / дээд</th>
                <th className="px-4 py-2.5 text-right font-medium">кВт·ц</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => {
                const rated = data.station.connectors.find((x) => x.connectorId === c.connectorId)?.ratedKw;
                return (
                  <tr key={c.connectorId} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-[var(--color-fg)]">
                        <span className="size-2.5 rounded-full" style={{ background: color(c.connectorId) }} />
                        Буу {c.connectorId}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                        {c.sessions} цэнэглэлт{rated ? ` · ${rated} кВт` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold text-[var(--color-fg)]">{kw(c.soloAvgKw)}</span>
                      <span className="text-[var(--color-fg-muted)]"> / {kw(c.soloPeakKw)}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold text-[var(--color-fg)]">{kw(c.sharedAvgKw)}</span>
                      <span className="text-[var(--color-fg-muted)]"> / {kw(c.sharedPeakKw)}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-fg)]">{formatNumber(c.energyKwh, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* split patterns */}
        <div className="p-4">
          <p className="mb-3 text-xs font-medium text-[var(--color-fg-muted)]">
            Зэрэг цэнэглэхэд чадал хэрхэн хуваагдсан (5 кВт-аар бөөрөнхийлсөн)
          </p>
          {sharing.splits.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">
              {summary.maxSimultaneous < 2 ? 'Зэрэг цэнэглэлтийн өгөгдөл алга.' : '—'}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {sharing.splits.map((sp, i) => (
                <li key={i}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex flex-wrap items-center gap-x-1.5 tabular-nums">
                      {sp.piles.map((p, j) => (
                        <React.Fragment key={p.connectorId}>
                          {j > 0 ? <span className="text-[var(--color-fg-subtle)]">+</span> : null}
                          <span className="font-semibold" style={{ color: color(p.connectorId) }}>
                            {p.kw}
                          </span>
                        </React.Fragment>
                      ))}
                      <span className="text-[var(--color-fg-muted)]">= {sp.totalKw} кВт</span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--color-fg-muted)]">
                      {sp.pct}% · {duration(sp.minutes)}
                    </span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-fg)_8%,transparent)]">
                    {sp.piles.map((p) => (
                      <div
                        key={p.connectorId}
                        style={{
                          width: `${capacity ? Math.min(100, (p.kw / capacity) * 100) : sp.totalKw ? (p.kw / sp.totalKw) * 100 : 0}%`,
                          background: color(p.connectorId),
                        }}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function PowerChart({
  data,
  guns,
  capacity,
  singleDay,
}: {
  data: StationPowerStats;
  guns: number[];
  capacity: number | null;
  singleDay: boolean;
}) {
  const rows = React.useMemo(
    () =>
      data.series.map((p) => {
        const r: Record<string, number | string> = { t: p.t, total: p.totalKw };
        for (const g of guns) r[`g${g}`] = p.piles[String(g)] ?? 0;
        return r;
      }),
    [data.series, guns],
  );
  const fmtX = (v: string) => (singleDay ? hhmm(v) : `${dayLabel(v)} ${hhmm(v)}`);
  const formatters: Record<string, (v: number) => string> = { total: (v) => kw(v) };
  for (const g of guns) formatters[`g${g}`] = (v) => kw(v);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Clock className="size-4 text-[var(--color-brand)]" /> Чадал цаг хугацаагаар
          </span>
        }
        description={data.bucketMinutes > 1 ? `${data.bucketMinutes} минутын дундаж` : 'Минут тутмын дундаж'}
        actions={
          <GlassLegend
            items={[
              ...guns.map((g, i) => ({ label: `Буу ${g}`, color: GUN_COLORS[i % GUN_COLORS.length] })),
              ...(capacity ? [{ label: `Хязгаар ${capacity} кВт`, color: '#ef4444' }] : []),
            ]}
          />
        }
      />
      <div className="h-72 px-2 pb-3 pt-4 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="t" {...AXIS_PROPS} tickFormatter={fmtX} minTickGap={40} />
            <YAxis {...AXIS_PROPS} unit=" кВт" width={64} domain={[0, (max: number) => Math.ceil(Math.max(max, capacity ?? 0) / 10) * 10]} />
            <Tooltip
              cursor={LINE_CURSOR}
              content={<GlassTooltip formatters={formatters} labelFormatter={(l) => fmtX(String(l))} />}
            />
            {capacity ? <ReferenceLine y={capacity} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.7} /> : null}
            {guns.map((g, i) => (
              <Area
                key={g}
                type="monotone"
                dataKey={`g${g}`}
                name={`Буу ${g}`}
                stackId="1"
                stroke={GUN_COLORS[i % GUN_COLORS.length]}
                fill={GUN_COLORS[i % GUN_COLORS.length]}
                fillOpacity={0.35}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            ))}
            <Line type="monotone" dataKey="total" name="Нийт" stroke="var(--color-fg)" strokeWidth={0} dot={false} activeDot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function DaysTable({ data, onPickDay }: { data: StationPowerStats; onPickDay: (d: string) => void }) {
  return (
    <Card>
      <CardHeader title="Өдөр тутмын чадал" description="Мөр дээр дарж тухайн өдрийг дэлгэрэнгүй харна." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-fg-muted)]">
              <th className="px-4 py-2.5 font-medium">Өдөр</th>
              <th className="px-3 py-2.5 text-right font-medium">Хамгийн их</th>
              <th className="px-3 py-2.5 text-right font-medium">Дундаж</th>
              <th className="px-3 py-2.5 text-right font-medium">Хамгийн бага</th>
              <th className="px-3 py-2.5 text-right font-medium">кВт·ц</th>
              <th className="px-3 py-2.5 text-right font-medium">Цэнэглэлт</th>
              <th className="px-4 py-2.5 text-right font-medium">Зэрэг</th>
            </tr>
          </thead>
          <tbody>
            {data.days.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-fg-muted)]">
                  Энэ хугацаанд цэнэглэлт алга.
                </td>
              </tr>
            ) : (
              data.days.map((d) => (
                <tr
                  key={d.date}
                  onClick={() => onPickDay(d.date)}
                  className="cursor-pointer border-t border-[var(--color-border)] tabular-nums hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]"
                >
                  <td className="px-4 py-2.5 font-medium text-[var(--color-fg)]">{d.date}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-semibold text-[var(--color-fg)]">{kw(d.peakKw)}</span>
                    <span className="ml-1 text-xs text-[var(--color-fg-muted)]">{hhmm(d.peakAt)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{kw(d.avgKw)}</td>
                  <td className="px-3 py-2.5 text-right">{kw(d.lowKw)}</td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(d.energyKwh, 1)}</td>
                  <td className="px-3 py-2.5 text-right">{d.sessions}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-fg-muted)]">
                    {d.simultaneousMinutes ? duration(d.simultaneousMinutes) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function HourlyChart({ data }: { data: StationPowerStats }) {
  return (
    <Card>
      <CardHeader
        title="Цагийн ачаалал"
        description="Өдрийн цаг бүрийн дундаж ба дээд чадал (сонгосон хугацаанд)"
        actions={
          <GlassLegend
            items={[
              { label: 'Дундаж', color: '#10b981' },
              { label: 'Дээд', color: '#0ea5e9' },
            ]}
          />
        }
      />
      <div className="h-56 px-2 pb-3 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.hourly} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="hour" {...AXIS_PROPS} tickFormatter={(h) => `${h}ц`} />
            <YAxis {...AXIS_PROPS} unit=" кВт" width={64} />
            <Tooltip
              cursor={BAR_CURSOR}
              content={
                <GlassTooltip
                  formatters={{ avgKw: (v) => kw(v), peakKw: (v) => kw(v) }}
                  labelFormatter={(h) => `${h}:00 – ${h}:59`}
                />
              }
            />
            <Bar dataKey="avgKw" name="Дундаж" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="peakKw" name="Дээд" fill="#0ea5e9" fillOpacity={0.45} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

