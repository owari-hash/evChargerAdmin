import Link from 'next/link';
import {
  AlertTriangle,
  BatteryCharging,
  Coins,
  Plug,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { csmsSafe } from '@/lib/server-api';
import { formatKwh, formatMoney, formatNumber, formatRelative, formatWh } from '@/lib/format';
import type {
  EnergySeriesPoint,
  Paginated,
  SecurityEvent,
  StatsOverview,
  TopChargePoint,
  Transaction,
} from '@/lib/types';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { StatCard } from '@/components/stat-card';
import { LiveFeed } from '@/components/live-feed';
import { EnergySeriesChart, TopChargePointsChart } from '@/components/charts/energy-chart';
import { ConnectorStatusBadge } from '@/components/ui/status';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty } from '@/components/ui/table';
import { BackendDown } from '@/components/backend-down';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [stats, series, top, active, security] = await Promise.all([
    csmsSafe<StatsOverview>('/stats/overview'),
    csmsSafe<EnergySeriesPoint[]>('/stats/energy-series', { query: { days: 30 } }),
    csmsSafe<TopChargePoint[]>('/stats/top-charge-points', { query: { days: 30 } }),
    csmsSafe<Transaction[]>('/transactions/active'),
    csmsSafe<Paginated<SecurityEvent>>('/security/events', {
      query: { critical: 'true', acknowledged: 'false', limit: 5 },
    }),
  ]);

  if (!stats) return <BackendDown />;

  const connectorEntries = Object.entries(stats.connectors ?? {}).sort((a, b) => b[1] - a[1]);
  const totalConnectors = connectorEntries.reduce((sum, [, n]) => sum + n, 0);
  const charging = stats.connectors?.Charging ?? 0;
  const faulted = stats.connectors?.Faulted ?? 0;

  return (
    <>
      <PageHeader
        title="Ерөнхий тойм"
        description="Цэнэглэх сүлжээний сүүлийн 24 цагийн байдал."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Цэнэглэх станц"
          value={`${formatNumber(stats.chargePoints.online)} / ${formatNumber(stats.chargePoints.total)}`}
          sub={`${formatNumber(stats.chargePoints.offline)} офлайн`}
          icon={Zap}
          tone={stats.chargePoints.online > 0 ? 'ok' : 'idle'}
          href="/charge-points"
        />
        <StatCard
          label="Одоо цэнэглэж буй"
          value={formatNumber(charging)}
          sub={`Нийт ${formatNumber(totalConnectors)} холбогч`}
          icon={Plug}
          tone={charging > 0 ? 'brand' : 'idle'}
          href="/connectors"
        />
        <StatCard
          label="Идэвхтэй цэнэглэлт"
          value={formatNumber(stats.transactions.active)}
          sub={`24 цагт ${formatNumber(stats.transactions.last24h)} эхэлсэн`}
          icon={BatteryCharging}
          tone={stats.transactions.active > 0 ? 'brand' : 'idle'}
          href="/transactions?status=Active"
        />
        <StatCard
          label="Эрчим хүч · 24ц"
          value={formatKwh(stats.energyLast24hKwh, 1)}
          sub={`${formatNumber(stats.transactions.completedLast24h)} цэнэглэлт дууссан`}
          icon={Zap}
          tone="info"
        />
        <StatCard
          label="Орлого · 24ц"
          value={formatMoney(stats.revenueLast24h)}
          sub="Тарифтай цэнэглэлтээс"
          icon={Coins}
          tone="ok"
        />
        <StatCard
          label="Аюулгүй байдлын сэрэмжлүүлэг"
          value={formatNumber(stats.unacknowledgedCriticalSecurityEvents)}
          sub="Ноцтой, хүлээн зөвшөөрөөгүй"
          icon={ShieldAlert}
          tone={stats.unacknowledgedCriticalSecurityEvents > 0 ? 'danger' : 'idle'}
          href="/security"
        />
      </div>

      {faulted > 0 ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{formatNumber(faulted)} холбогч эвдрэл мэдээлж байна.</span>
          <Link href="/connectors?status=Faulted" className="ml-auto font-medium underline">
            Шалгах
          </Link>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Түгээсэн эрчим хүч"
            description="Дууссан цэнэглэлт, сүүлийн 30 хоног"
          />
          <div className="p-4 pr-5">
            <EnergySeriesChart data={series ?? []} />
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Шууд үйл ажиллагаа" description="CSMS-ээс шууд дамжуулж байна" />
          <LiveFeed height="h-[280px]" />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Идэвхтэй цэнэглэлт"
            description={`${formatNumber(active?.length ?? 0)} үргэлжилж байна`}
            actions={
              <Link
                href="/transactions"
                className="text-xs font-medium text-[var(--color-brand)] hover:underline"
              >
                Бүх цэнэглэлт
              </Link>
            }
          />
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Цэнэглэлт</TH>
                  <TH>Цэнэглэх станц</TH>
                  <TH>Карт</TH>
                  <TH align="right">Эрчим хүч</TH>
                  <TH align="right">Чадал</TH>
                  <TH align="right">Цэнэг</TH>
                  <TH align="right">Эхэлсэн</TH>
                </tr>
              </THead>
              <TBody>
                {!active?.length ? (
                  <TableEmpty colSpan={7}>Одоогоор идэвхтэй цэнэглэлт алга.</TableEmpty>
                ) : (
                  active.slice(0, 8).map((tx) => (
                    <TR key={tx.transactionId}>
                      <TD>
                        <Link
                          href={`/transactions/${tx.transactionId}`}
                          className="font-mono text-xs text-[var(--color-brand)] hover:underline"
                        >
                          #{tx.transactionId}
                        </Link>
                      </TD>
                      <TD>
                        <Link
                          href={`/charge-points/${encodeURIComponent(tx.chargePointId)}`}
                          className="text-xs hover:text-[var(--color-brand)] hover:underline"
                        >
                          {tx.chargePointId}
                        </Link>
                        <span className="ml-1 text-xs text-[var(--color-fg-subtle)]">
                          #{tx.connectorId}
                        </span>
                      </TD>
                      <TD className="font-mono text-xs">{tx.idTag}</TD>
                      <TD align="right" className="text-xs">
                        {formatWh((tx.lastMeterWh ?? tx.meterStart) - tx.meterStart)}
                      </TD>
                      <TD align="right" className="text-xs">
                        {tx.lastPowerW ? `${(tx.lastPowerW / 1000).toFixed(1)} kW` : '—'}
                      </TD>
                      <TD align="right" className="text-xs">
                        {tx.lastSocPercent != null ? `${tx.lastSocPercent}%` : '—'}
                      </TD>
                      <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                        {formatRelative(tx.startTimestamp)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Холбогчийн төлөв" description="Сүлжээний хэмжээнд" />
            <div className="space-y-2 p-4">
              {connectorEntries.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--color-fg-muted)]">
                  Одоогоор холбогч бүртгэгдээгүй байна.
                </p>
              ) : (
                connectorEntries.map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <ConnectorStatusBadge status={status} />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-brand)]"
                        style={{
                          width: `${totalConnectors ? (count / totalConnectors) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tnum">{formatNumber(count)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Ноцтой аюулгүй байдлын үйл явдал" description="Хүлээн зөвшөөрөөгүй" />
            {!security?.data.length ? (
              <EmptyState
                title="Шалгах зүйл алга"
                description="Хүлээн зөвшөөрөөгүй ноцтой үйл явдал байхгүй."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {security.data.map((event) => (
                  <li key={event._id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href="/security"
                        className="truncate text-xs font-medium hover:text-[var(--color-brand)]"
                      >
                        {event.type}
                      </Link>
                      <Badge tone={event.isCritical ? 'danger' : 'idle'}>
                        {event.isCritical ? 'ноцтой' : 'мэдээлэл'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                      {event.chargePointId} · {formatRelative(event.timestamp)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Хамгийн ачаалалтай станцууд" description="Түгээсэн эрчим хүч, сүүлийн 30 хоног" />
        <div className="p-4">
          <TopChargePointsChart data={top ?? []} />
        </div>
      </Card>
    </>
  );
}
