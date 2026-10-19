'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Pencil,
  RefreshCw,
  Search,
  X,
  Zap,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Info,
  Plug,
} from 'lucide-react';
import { REFRESH } from '@/lib/live-query';
import { apiUrl, fetcher } from '@/lib/client';
import { formatNumber, formatPower, formatRelative, formatWh } from '@/lib/format';
import {
  CONNECTOR_STATUSES,
  type Connector,
  type ConnectorStatus,
  type Paginated,
  type StatsOverview,
} from '@/lib/types';
import { Badge, Button, Card, Dot, Input, Select } from '@/components/ui/primitives';
import { ConnectorStatusBadge, ErrorCodeBadge } from '@/components/ui/status';
import { CONNECTOR_STATUS, mn } from '@/lib/mn';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { EditConnectorModal } from './edit-connector-modal';
import { StationName } from '@/components/station-name';
import { cn } from '@/lib/cn';

/**
 * Network-wide connector view.
 * Connector 0 is hidden by default because it represents the charge point controller
 * itself rather than a physical gun/socket a driver plugs in.
 */
export function ConnectorsView({
  initialStatus,
  initialChargePointId,
  canOperate,
}: {
  initialStatus: string;
  initialChargePointId: string;
  canOperate: boolean;
}) {
  const [status, setStatus] = React.useState(initialStatus);
  const [chargePointId, setChargePointId] = React.useState(initialChargePointId);
  const [debouncedCp, setDebouncedCp] = React.useState(initialChargePointId);
  const [includeZero, setIncludeZero] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [editing, setEditing] = React.useState<Connector | null>(null);

  // Debounce search query
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCp(chargePointId.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [chargePointId]);

  // Overall stats overview for persistent network-wide status counts
  const { data: statsOverview, mutate: mutateOverview } = useSWR<StatsOverview>(
    apiUrl('stats/overview'),
    fetcher,
    {
      refreshInterval: REFRESH.live,
      revalidateOnFocus: true,
    },
  );

  // Paginated connectors list
  const key = apiUrl('connectors', {
    status,
    chargePointId: debouncedCp,
    page,
    limit,
  });
  const { data, error, isLoading, isValidating, mutate } = useSWR<Paginated<Connector>>(
    key,
    fetcher,
    {
      refreshInterval: REFRESH.live,
      keepPreviousData: true,
    },
  );

  const all = data?.data ?? [];
  const rows = React.useMemo(() => (includeZero ? all : all.filter((c) => c.connectorId > 0)), [all, includeZero]);
  const columns = canOperate ? 10 : 9;

  // Pure memoized counts without any state updates or infinite render loops
  const counts = React.useMemo(() => {
    if (data?.statusCounts && Object.keys(data.statusCounts).length > 0) {
      return data.statusCounts;
    }
    const fromOverview: Record<string, number> = {};
    if (statsOverview?.connectors) {
      for (const [s, count] of Object.entries(statsOverview.connectors)) {
        if (count != null) fromOverview[s] = count;
      }
    }
    return fromOverview;
  }, [data?.statusCounts, statsOverview?.connectors]);

  // Total connectors count across the network or current station
  const totalCount = React.useMemo(() => {
    if (status === '' && data?.total != null) return data.total;
    const sum = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
    return sum > 0 ? sum : (data?.total ?? 0);
  }, [status, data?.total, counts]);

  // Live charging statistics
  const chargingCount = counts['Charging'] ?? 0;
  const availableCount = counts['Available'] ?? 0;
  const attentionCount =
    (counts['Faulted'] ?? 0) +
    (counts['Unavailable'] ?? 0) +
    (counts['SuspendedEV'] ?? 0) +
    (counts['SuspendedEVSE'] ?? 0);

  // Calculate live power being delivered on the current visible page
  const livePowerSumW = React.useMemo(() => {
    return rows
      .filter((c) => c.status === 'Charging')
      .reduce((sum, c) => sum + (c.lastPowerW ?? 0), 0);
  }, [rows]);

  function handleRefresh() {
    void mutate();
    void mutateOverview();
  }

  function handleClearFilters() {
    setStatus('');
    setChargePointId('');
    setDebouncedCp('');
    setPage(1);
  }

  const hasActiveFilter = Boolean(status || debouncedCp || includeZero);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-fg)]">Холбогчууд</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs text-[var(--color-fg-muted)]">
              <Dot tone="ok" pulse />
              Бодит цагийн хяналт
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
            Цэнэглэх станцуудын бүх холбогч, бууны бодит цагийн төлөв, чадал болон ашиглалт
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            aria-label="Мэдээлэл шинэчлэх"
            className="text-xs"
            disabled={isValidating}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isValidating && 'animate-spin')} />
            Шинэчлэх
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Total Connectors */}
        <button
          type="button"
          onClick={() => {
            setStatus('');
            setPage(1);
          }}
          className={cn(
            'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all',
            status === ''
              ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]/40 ring-2 ring-[var(--color-brand)]/20 shadow-sm'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-fg-muted)]">Нийт холбогч</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] group-hover:bg-[var(--color-border)]">
              <Plug className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-[var(--color-fg)] tnum">
              {formatNumber(totalCount)}
            </span>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">Сүлжээний бүх буу</p>
          </div>
        </button>

        {/* Charging Now */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'Charging' ? '' : 'Charging');
            setPage(1);
          }}
          className={cn(
            'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all',
            status === 'Charging'
              ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] ring-2 ring-[var(--color-brand)]/30 shadow-sm'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-brand)]">Цэнэглэж байна</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[var(--color-brand)] tnum">
                {formatNumber(chargingCount)}
              </span>
              {livePowerSumW > 0 ? (
                <span className="text-xs font-semibold text-[var(--color-brand)]">
                  {formatPower(livePowerSumW)}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">
              Идэвхтэй цэнэглэлт явагдаж байна
            </p>
          </div>
        </button>

        {/* Available */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'Available' ? '' : 'Available');
            setPage(1);
          }}
          className={cn(
            'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all',
            status === 'Available'
              ? 'border-[var(--color-ok)] bg-[var(--color-ok-soft)] ring-2 ring-[var(--color-ok)]/30 shadow-sm'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-ok)]">Ашиглахад бэлэн</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-ok-soft)] text-[var(--color-ok)]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-[var(--color-ok)] tnum">
              {formatNumber(availableCount)}
            </span>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">
              Жолооч цэнэглэх боломжтой
            </p>
          </div>
        </button>

        {/* Attention Needed */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'Faulted' ? '' : 'Faulted');
            setPage(1);
          }}
          className={cn(
            'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all',
            status === 'Faulted' || status === 'Unavailable'
              ? 'border-[var(--color-danger)] bg-[var(--color-danger-soft)] ring-2 ring-[var(--color-danger)]/30 shadow-sm'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-danger)]">Анхаарах төлөвтэй</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold tracking-tight text-[var(--color-danger)] tnum">
              {formatNumber(attentionCount)}
            </span>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">
              Алдаатай, түдгэлзсэн эсвэл зогссон
            </p>
          </div>
        </button>
      </div>

      {/* Main Table Card */}
      <Card>
        <FilterBar>
          {/* Station search */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
            <Input
              className="h-8 w-60 pl-8 pr-7 text-xs"
              placeholder="Станцын дугаар / ID..."
              value={chargePointId}
              onChange={(e) => setChargePointId(e.target.value)}
              aria-label="Станцын ID-аар хайх"
            />
            {chargePointId ? (
              <button
                type="button"
                onClick={() => setChargePointId('')}
                className="absolute right-2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                aria-label="Хайлт цэвэрлэх"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Status dropdown fallback */}
          <Select
            className="h-8 w-auto py-0 text-xs"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Төлөвөөр шүүх"
          >
            <option value="">Бүх төлөв</option>
            {CONNECTOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {mn(CONNECTOR_STATUS, s)} {counts[s] ? `(${counts[s]})` : ''}
              </option>
            ))}
          </Select>

          {/* Connector 0 checkbox */}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--color-fg-muted)] select-none">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--color-brand)]"
              checked={includeZero}
              onChange={(e) => setIncludeZero(e.target.checked)}
            />
            <span>0-р холбогч (Станцын үндсэн контроллер)</span>
          </label>

          {/* Reset Filters button */}
          {hasActiveFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="ml-auto text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
            >
              <X className="h-3.5 w-3.5" />
              Шүүлтүүр арилгах
            </Button>
          ) : null}
        </FilterBar>

        {/* Connectors Table */}
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Цэнэглэх станц</TH>
                <TH>Холбогч №</TH>
                <TH>Төлөв</TH>
                <TH>Одоогийн явц / Чадал</TH>
                <TH>Алдаа</TH>
                <TH>Ашиглалт</TH>
                <TH>Тоолуур</TH>
                <TH>Шинэчлэгдсэн</TH>
                {canOperate ? (
                  <TH className="text-right">
                    <span className="sr-only">Үйлдэл</span>
                  </TH>
                ) : null}
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={columns} />
              ) : error ? (
                <TableEmpty colSpan={columns}>
                  <div className="flex flex-col items-center justify-center gap-2 py-6">
                    <AlertTriangle className="h-6 w-6 text-[var(--color-danger)]" />
                    <p className="text-xs text-[var(--color-fg-muted)]">
                      Холбогчийн мэдээлэл ачаалж чадсангүй.
                    </p>
                    <Button variant="secondary" size="sm" onClick={handleRefresh}>
                      Дахин оролдох
                    </Button>
                  </div>
                </TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={columns}>
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <SlidersHorizontal className="h-7 w-7 text-[var(--color-fg-subtle)]" />
                    <p className="text-sm font-medium text-[var(--color-fg)]">
                      Тохирох холбогч олдсонгүй
                    </p>
                    <p className="text-xs text-[var(--color-fg-muted)]">
                      Шүүлтүүрийн нөхцлийг өөрчилж эсвэл бүх төлөвийг харна уу.
                    </p>
                    {hasActiveFilter ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleClearFilters}
                        className="mt-2"
                      >
                        Бүх шүүлтүүрийг арилгах
                      </Button>
                    ) : null}
                  </div>
                </TableEmpty>
              ) : (
                rows.map((c) => {
                  const isCharging = c.status === 'Charging';
                  const isAvailable = c.status === 'Available';
                  const hasError = c.errorCode && c.errorCode !== 'NoError';

                  return (
                    <TR
                      key={`${c.chargePointId}-${c.connectorId}`}
                      className={cn(isCharging && 'bg-[var(--color-brand-soft)]/20')}
                    >
                      {/* Station Name & Link */}
                      <TD>
                        <StationName id={c.chargePointId} />
                      </TD>

                      {/* Connector Gun # & metadata */}
                      <TD>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-xs font-semibold',
                              c.connectorId === 0
                                ? 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]'
                                : 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
                            )}
                          >
                            #{c.connectorId}
                          </span>

                          <div className="flex flex-col leading-tight">
                            <div className="flex items-center gap-1.5">
                              {c.connectorType ? (
                                <span className="text-[11px] font-medium text-[var(--color-fg)]">
                                  {c.connectorType}
                                </span>
                              ) : null}
                              {c.label ? (
                                <span className="rounded bg-[var(--color-surface-2)] px-1 text-[10px] font-medium text-[var(--color-brand)]">
                                  {c.label}
                                </span>
                              ) : null}
                            </div>
                            {c.powerKw ? (
                              <span className="text-[10px] text-[var(--color-fg-subtle)]">
                                {c.powerKw} кВт
                              </span>
                            ) : null}
                          </div>

                          {c.code ? (
                            <span
                              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 font-mono text-[10px] text-[var(--color-fg-subtle)]"
                              title="QR стикерийн байнгын код"
                            >
                              {c.code}
                            </span>
                          ) : null}
                        </div>
                      </TD>

                      {/* Status Badge */}
                      <TD>
                        <ConnectorStatusBadge status={c.status} />
                      </TD>

                      {/* Current Session / Live Charging / SoC Progress */}
                      <TD>
                        {isCharging ? (
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center gap-2">
                              {c.currentTransactionId ? (
                                <Link
                                  href={`/transactions/${c.currentTransactionId}`}
                                  className="font-mono font-medium text-[var(--color-brand)] hover:underline"
                                  title="Цэнэглэлтийн дэлгэрэнгүйг харах"
                                >
                                  #{c.currentTransactionId}
                                </Link>
                              ) : null}
                              {c.lastPowerW != null && c.lastPowerW > 0 ? (
                                <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--color-brand)] tnum">
                                  <Zap className="h-3 w-3 fill-current" />
                                  {formatPower(c.lastPowerW)}
                                </span>
                              ) : null}
                            </div>

                            {/* Battery State of Charge (SoC) */}
                            {c.lastSocPercent != null ? (
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                                  <div
                                    className="h-full bg-[var(--color-brand)] transition-all"
                                    style={{ width: `${Math.min(100, c.lastSocPercent)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[10px] font-semibold text-[var(--color-fg-muted)]">
                                  {c.lastSocPercent}%
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : isAvailable ? (
                          <span className="text-xs text-[var(--color-ok)]">Цэнэглэхэд бэлэн</span>
                        ) : c.status === 'Preparing' ? (
                          <span className="text-xs text-[var(--color-info)]">Холбогдож байна</span>
                        ) : c.status === 'SuspendedEV' ? (
                          <span className="text-xs text-[var(--color-warn)]">Машин түр зогсоосон</span>
                        ) : c.status === 'SuspendedEVSE' ? (
                          <span className="text-xs text-[var(--color-warn)]">Станц түр зогсоосон</span>
                        ) : (
                          <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                        )}
                      </TD>

                      {/* Error Code */}
                      <TD>
                        {hasError ? (
                          <ErrorCodeBadge code={c.errorCode} />
                        ) : (
                          <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                        )}
                      </TD>

                      {/* Operative availability */}
                      <TD className="text-xs">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            c.availability === 'Operative'
                              ? 'text-[var(--color-fg-muted)]'
                              : 'text-[var(--color-danger)] font-medium',
                          )}
                        >
                          {c.availability === 'Operative' ? 'Хэвийн' : 'Түдгэлзүүлсэн'}
                        </span>
                      </TD>

                      {/* Total Meter */}
                      <TD className="font-mono text-xs text-[var(--color-fg-muted)]">
                        {formatWh(c.lastMeterWh)}
                      </TD>

                      {/* Updated Timestamp */}
                      <TD className="text-xs text-[var(--color-fg-subtle)]">
                        {formatRelative(c.statusTimestamp ?? c.updatedAt)}
                      </TD>

                      {/* Actions */}
                      {canOperate ? (
                        <TD className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(c)}
                            aria-label={`${c.chargePointId} станцын ${c.connectorId} дугаар холбогчийг тохируулах`}
                            className="text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Засах
                          </Button>
                        </TD>
                      ) : null}
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>

        {/* Pagination */}
        {data && data.total > 0 ? (
          <Pagination
            page={page}
            limit={limit}
            total={data.total}
            onPageChange={setPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
            label="холбогч"
          />
        ) : null}
      </Card>

      {/* Edit Connector Modal */}
      {editing ? (
        <EditConnectorModal
          connector={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void mutate();
            void mutateOverview();
          }}
        />
      ) : null}
    </div>
  );
}
