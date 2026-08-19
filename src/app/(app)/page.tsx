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
        title="Overview"
        description="Live state of the charging network over the last 24 hours."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Charge points"
          value={`${formatNumber(stats.chargePoints.online)} / ${formatNumber(stats.chargePoints.total)}`}
          sub={`${formatNumber(stats.chargePoints.offline)} offline`}
          icon={Zap}
          tone={stats.chargePoints.online > 0 ? 'ok' : 'idle'}
          href="/charge-points"
        />
        <StatCard
          label="Charging now"
          value={formatNumber(charging)}
          sub={`${formatNumber(totalConnectors)} connectors total`}
          icon={Plug}
          tone={charging > 0 ? 'brand' : 'idle'}
          href="/connectors"
        />
        <StatCard
          label="Active sessions"
          value={formatNumber(stats.transactions.active)}
          sub={`${formatNumber(stats.transactions.last24h)} started in 24h`}
          icon={BatteryCharging}
          tone={stats.transactions.active > 0 ? 'brand' : 'idle'}
          href="/transactions?status=Active"
        />
        <StatCard
          label="Energy · 24h"
          value={formatKwh(stats.energyLast24hKwh, 1)}
          sub={`${formatNumber(stats.transactions.completedLast24h)} sessions completed`}
          icon={Zap}
          tone="info"
        />
        <StatCard
          label="Revenue · 24h"
          value={formatMoney(stats.revenueLast24h)}
          sub="From tariffed sessions"
          icon={Coins}
          tone="ok"
        />
        <StatCard
          label="Security alerts"
          value={formatNumber(stats.unacknowledgedCriticalSecurityEvents)}
          sub="Critical, unacknowledged"
          icon={ShieldAlert}
          tone={stats.unacknowledgedCriticalSecurityEvents > 0 ? 'danger' : 'idle'}
          href="/security"
        />
      </div>

      {faulted > 0 ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {formatNumber(faulted)} connector{faulted === 1 ? ' is' : 's are'} reporting a fault.
          </span>
          <Link href="/connectors?status=Faulted" className="ml-auto font-medium underline">
            Inspect
          </Link>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Energy delivered"
            description="Completed sessions, last 30 days"
          />
          <div className="p-4 pr-5">
            <EnergySeriesChart data={series ?? []} />
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Live activity" description="Streaming from the CSMS" />
          <LiveFeed height="h-[280px]" />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Active sessions"
            description={`${formatNumber(active?.length ?? 0)} in progress`}
            actions={
              <Link
                href="/transactions"
                className="text-xs font-medium text-[var(--color-brand)] hover:underline"
              >
                All sessions
              </Link>
            }
          />
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Session</TH>
                  <TH>Charge point</TH>
                  <TH>Tag</TH>
                  <TH align="right">Energy</TH>
                  <TH align="right">Power</TH>
                  <TH align="right">SoC</TH>
                  <TH align="right">Started</TH>
                </tr>
              </THead>
              <TBody>
                {!active?.length ? (
                  <TableEmpty colSpan={7}>No sessions in progress.</TableEmpty>
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
            <CardHeader title="Connector states" description="Across the whole network" />
            <div className="space-y-2 p-4">
              {connectorEntries.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--color-fg-muted)]">
                  No connectors reported yet.
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
            <CardHeader title="Critical security events" description="Unacknowledged" />
            {!security?.data.length ? (
              <EmptyState
                title="Nothing to review"
                description="No unacknowledged critical events."
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
                      <Badge tone="danger">critical</Badge>
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
        <CardHeader title="Busiest charge points" description="Energy delivered, last 30 days" />
        <div className="p-4">
          <TopChargePointsChart data={top ?? []} />
        </div>
      </Card>
    </>
  );
}
