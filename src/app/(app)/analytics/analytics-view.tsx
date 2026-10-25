'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Clock,
  ExternalLink,
  Globe,
  Laptop,
  RefreshCw,
  Smartphone,
  TrendingUp,
  Users,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatNumber } from '@/lib/format';
import type { AnalyticsOverview } from '@/lib/types';
import { StatCard, StatGrid } from '@/components/stat-card';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';

const AXIS = 'var(--color-fg-subtle)';
const GRID = 'var(--color-border)';

const AXIS_PROPS = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; dataKey?: string | number; value?: number; color?: string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1.5 font-semibold text-[var(--color-fg)]">{label}</p>
      {payload.map((entry) => {
        return (
          <p key={String(entry.dataKey || entry.name)} className="flex items-center gap-2.5 py-0.5 text-[var(--color-fg-muted)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
              style={{ background: entry.color }}
              aria-hidden="true"
            />
            <span className="font-medium">{entry.name}:</span>
            <span className="ml-auto font-semibold text-[var(--color-fg)] tnum">
              {formatNumber(entry.value ?? 0)}
            </span>
          </p>
        );
      })}
    </div>
  );
}

function shortDateLabel(value: string): string {
  const parts = value.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return value;
}

export function AnalyticsView({ initialData }: { initialData: AnalyticsOverview }) {
  const [days, setDays] = React.useState<number>(7);
  const { data, mutate, isValidating } = useSWR<AnalyticsOverview>(
    apiUrl(`/analytics/overview?days=${days}`),
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: true,
      refreshInterval: 30_000,
    },
  );

  const stats = data ?? initialData;
  const s = stats.summary;

  const periods: { label: string; value: number }[] = [
    { label: 'Өнөөдөр', value: 1 },
    { label: 'Сүүлийн 7 хоног', value: 7 },
    { label: '14 хоног', value: 14 },
    { label: '30 хоног', value: 30 },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Title and Time range switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <BarChart3 className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Вэб & Апп Хандалт
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--color-fg-muted)]">
            Өдөр тутмын хэрэглэгчийн хандалт, мобайл апп болон Google Analytics статистик
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setDays(p.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  days === p.value
                    ? 'bg-[var(--color-surface)] text-[var(--color-fg)] shadow-xs'
                    : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => mutate()}
            disabled={isValidating}
            title="Шинэчлэх"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <StatGrid>
        <StatCard
          label="Өнөөдрийн нийт хандалт"
          value={formatNumber(s.todayVisits)}
          sub={
            s.trendPct >= 0
              ? `Өчигдрөөс +${s.trendPct}% өссөн`
              : `Өчигдрөөс ${s.trendPct}% буурсан`
          }
          icon={Activity}
          tone="brand"
        />
        <StatCard
          label="Өнөөдрийн өвөрмөц зочид"
          value={formatNumber(s.todayUnique)}
          sub={`Нийт хугацаанд: ${formatNumber(s.uniqueVisitors)} өвөрмөц`}
          icon={Users}
          tone="ok"
        />
        <StatCard
          label="Вэб хандалт (eplug.mn)"
          value={formatNumber(s.webVisits)}
          sub={`Өнөөдөр: ${formatNumber(s.todayWeb)} (${stats.platforms.webPct}%)`}
          icon={Globe}
          tone="info"
        />
        <StatCard
          label="Мобайл Апп хандалт"
          value={formatNumber(s.appVisits)}
          sub={`iOS: ${formatNumber(s.iosVisits)} · Android: ${formatNumber(s.androidVisits)}`}
          icon={Smartphone}
          tone="ok"
        />
      </StatGrid>

      {/* Main Charts: Daily Trend & Hourly Peak */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Daily Visits Area Chart */}
        <Card className="lg:col-span-2 p-4 sm:p-5">
          <div className="flex flex-row items-center justify-between pb-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[var(--color-fg)]">
                Өдөр тутмын хандалтын динамик
              </h2>
              <p className="text-xs text-[var(--color-fg-muted)]">
                Вэбсайт, iOS апп болон Android апп-ын өдрийн үзүүлэлт
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#06b6d4]" />
                Вэб
              </span>
              <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                iOS
              </span>
              <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
                Android
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="webGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="iosGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="androidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDateLabel} {...AXIS_PROPS} />
                <YAxis allowDecimals={false} {...AXIS_PROPS} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="web"
                  name="Вэб хандалт"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#webGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="ios"
                  name="iOS Апп"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#iosGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="android"
                  name="Android Апп"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#androidGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Peak Hours Distribution Bar Chart */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[var(--color-fg)]">
                Оргил цагийн ачаалал
              </h2>
              <p className="text-xs text-[var(--color-fg-muted)]">
                24 цагийн хандалтын хуваарилалт (00:00 - 23:00)
              </p>
            </div>
            <Clock className="h-4 w-4 text-[var(--color-fg-subtle)]" />
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.hourlyDistribution} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...AXIS_PROPS} interval={3} />
                <YAxis allowDecimals={false} {...AXIS_PROPS} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="total" name="Нийт хандалт" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Breakdowns & Google Analytics Integration Info */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Platform Share */}
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Платформ хуваарилалт</h3>
          <p className="text-xs text-[var(--color-fg-muted)] mb-4">
            Хэрэглэгчид хаанаас хандаж байгаа хувь
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 font-medium text-[var(--color-fg)]">
                  <Globe className="h-3.5 w-3.5 text-[#06b6d4]" />
                  Вэбсайт (eplug.mn)
                </span>
                <span className="font-semibold text-[var(--color-fg)]">
                  {stats.platforms.webPct}% ({formatNumber(stats.platforms.web)})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#06b6d4]"
                  style={{ width: `${stats.platforms.webPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 font-medium text-[var(--color-fg)]">
                  <Smartphone className="h-3.5 w-3.5 text-[#10b981]" />
                  iOS Апп (Apple)
                </span>
                <span className="font-semibold text-[var(--color-fg)]">
                  {stats.platforms.iosPct}% ({formatNumber(stats.platforms.ios)})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#10b981]"
                  style={{ width: `${stats.platforms.iosPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 font-medium text-[var(--color-fg)]">
                  <Smartphone className="h-3.5 w-3.5 text-[#8b5cf6]" />
                  Android Апп (Google)
                </span>
                <span className="font-semibold text-[var(--color-fg)]">
                  {stats.platforms.androidPct}% ({formatNumber(stats.platforms.android)})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#8b5cf6]"
                  style={{ width: `${stats.platforms.androidPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--color-border)] pt-4">
            <h4 className="text-xs font-semibold text-[var(--color-fg-muted)] mb-2">Төхөөрөмжийн төрөл</h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {stats.devices.map((d) => (
                <div key={d.name} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2">
                  <p className="text-[11px] text-[var(--color-fg-subtle)]">{d.name}</p>
                  <p className="mt-0.5 font-bold text-[var(--color-fg)]">{d.pct}%</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Top Pages */}
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Хамгийн их үзсэн хуудсууд</h3>
          <p className="text-xs text-[var(--color-fg-muted)] mb-4">
            Вэб болон апп дээр хамгийн эрэлттэй замууд
          </p>

          <div className="space-y-3">
            {stats.topPages.map((page, idx) => (
              <div key={page.path} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <span className="font-mono text-[10px] text-[var(--color-fg-subtle)] w-4">
                    #{idx + 1}
                  </span>
                  <span className="font-mono font-medium text-[var(--color-fg)] truncate" title={page.path}>
                    {page.path}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium text-[var(--color-fg-muted)] tnum">
                    {formatNumber(page.count)}
                  </span>
                  <Badge tone="idle">
                    {page.pct}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Google Analytics 4 Setup & Link Card */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between border-brand/20 bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-surface-muted)]">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 font-black text-sm">
                  G
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-fg)]">Google Analytics 4 (GA4)</h3>
                  <p className="text-[11px] text-[var(--color-fg-muted)]">Албан ёсны хэмжилт & тайлан</p>
                </div>
              </div>
              <Badge tone={stats.gaConfig?.enabled ? 'ok' : 'info'}>
                {stats.gaConfig?.enabled ? 'Идэвхтэй' : 'Дэмжлэгтэй'}
              </Badge>
            </div>

            <div className="mt-4 space-y-3 text-xs text-[var(--color-fg-muted)]">
              <p>
                Eplug вэбсайт болон мобайл апп нь <strong>Google Analytics (gtag.js)</strong> болон өөрийн дотоод дата цуглуулагчтай бүрэн хоршин ажилладаг.
              </p>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-[var(--color-fg)] flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Холболтын төлөв:
                </p>
                <p className="text-[11px] text-[var(--color-fg-subtle)]">
                  {stats.gaConfig?.measurementId ? (
                    <span className="font-mono text-emerald-500">{stats.gaConfig.measurementId}</span>
                  ) : (
                    <span>NEXT_PUBLIC_GA_ID (G-XXXXXXXXXX) тохируулж болно</span>
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <p className="text-[11px] font-semibold text-[var(--color-fg)] mb-1">
                  Google Analytics Console:
                </p>
                <p className="text-[11px] text-[var(--color-fg-subtle)]">
                  Хэрэглэгчийн газар зүй, маркетинг кампанит ажил болон нарийвчилсан урсгалыг Google-ийн албан ёсны самбараас үзэх.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[var(--color-border)]">
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:opacity-95 active:scale-[0.98]"
            >
              Google Analytics нээх
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </Card>
      </div>

      {/* Real-time Recent Visits Table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Сүүлийн бодит хандалтууд (Live)</h3>
          </div>
          <span className="text-xs text-[var(--color-fg-subtle)]">Шууд бүртгэгдсэн урсгал</span>
        </div>

        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Цаг</TH>
                <TH>Платформ</TH>
                <TH>Хуудас / Үйлдэл</TH>
                <TH>Хөтөч / Апп</TH>
                <TH>Үйлдлийн систем</TH>
              </TR>
            </THead>
            <TBody>
              {stats.recentVisits.map((item) => {
                const date = new Date(item.timestamp);
                const timeStr = date.toLocaleTimeString('mn-MN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <TR key={item.id}>
                    <TD className="font-mono text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
                      {timeStr}
                    </TD>
                    <TD>
                      {item.platform === 'ios' ? (
                        <Badge tone="ok">iOS App</Badge>
                      ) : item.platform === 'android' ? (
                        <Badge tone="brand">Android App</Badge>
                      ) : (
                        <Badge tone="info">Вэбсайт</Badge>
                      )}
                    </TD>
                    <TD className="font-mono text-xs font-semibold text-[var(--color-fg)]">
                      {item.path}
                    </TD>
                    <TD className="text-xs text-[var(--color-fg-muted)]">
                      {item.browser}
                    </TD>
                    <TD className="text-xs text-[var(--color-fg-muted)]">
                      {item.os} ({item.device === 'mobile' ? 'Утас' : 'Компьютер'})
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
