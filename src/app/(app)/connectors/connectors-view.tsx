'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Plug,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  RefreshCw,
  SlidersHorizontal,
  Pencil,
  Clock,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { REFRESH } from '@/lib/live-query';
import { apiUrl, fetcher } from '@/lib/client';
import { connectorLetter, formatNumber, formatPower, formatRelative, formatWh } from '@/lib/format';
import {
  CONNECTOR_STATUSES,
  type Connector,
  type ConnectorStatus,
  type Paginated,
  type StatsOverview,
} from '@/lib/types';
import { Badge, Button, Card, Dot, Input, Select } from '@/components/ui/primitives';
import { ErrorCodeBadge } from '@/components/ui/status';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { EditConnectorModal } from './edit-connector-modal';
import { StationName } from '@/components/station-name';
import { cn } from '@/lib/cn';

/**
 * Maps connector statuses to the exact user-facing labels and visual tones from Image 2
 */
function renderConnectorStatus(status?: string) {
  if (!status) return <span className="text-[var(--color-fg-subtle)]">—</span>;

  if (status === 'Available') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <Dot tone="ok" />
        Бэлэн
      </span>
    );
  }

  if (status === 'Charging') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-500">
        <Dot tone="brand" pulse />
        Цэнэглэж байгаа
      </span>
    );
  }

  if (status === 'SuspendedEV' || status === 'SuspendedEVSE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
        <Dot tone="warn" />
        Машин түр зогссон
      </span>
    );
  }

  if (status === 'Preparing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-500">
        <Dot tone="info" pulse />
        Бэлтгэж байна
      </span>
    );
  }

  if (status === 'Faulted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-500">
        <Dot tone="danger" />
        Эвдрэлтэй
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-fg-muted)]">
      <Dot tone="idle" />
      Ашиглах боломжгүй
    </span>
  );
}

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
  const columns = 10;

  // Status counts
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

  // Total connectors count
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
    <div className="space-y-5">
      {/* 1. Header Title matching Image 2 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm">
            <Plug className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Холбогч
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-fg-muted)]">
              Бүх станцын холбогчуудын бодит цагийн төлөв ба ашиглалт
            </p>
          </div>
        </div>

        {/* Top Right: Live indicator & Refresh */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-fg-muted)] shadow-sm">
            <Dot tone="ok" pulse />
            Бодит цагийн хяналт
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            aria-label="Мэдээлэл шинэчлэх"
            className="text-xs h-8"
            disabled={isValidating}
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isValidating && 'animate-spin')} />
            Шинэчлэх
          </Button>
        </div>
      </div>

      {/* 2. 4 KPI Stat Cards matching Image 2 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Card 1: Нийт холбогч */}
        <button
          type="button"
          onClick={() => {
            setStatus('');
            setPage(1);
          }}
          className={cn(
            'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all shadow-sm',
            status === ''
              ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-fg-muted)]">Нийт холбогч</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Plug className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-[var(--color-fg)] tnum font-mono">
              {formatNumber(totalCount)}
            </span>
            <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">Сүлжээнд буй бүгд</p>
          </div>
        </button>

        {/* Card 2: Цэнэглэж байгаа */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'Charging' ? '' : 'Charging');
            setPage(1);
          }}
          className={cn(
            'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all shadow-sm',
            status === 'Charging'
              ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-500">Цэнэглэж байгаа</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-blue-500 tnum font-mono">
              {formatNumber(chargingCount)}
            </span>
            <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">Идэвхтэй цэнэглэлт явагдаж байна</p>
          </div>
        </button>

        {/* Card 3: Ашиглахад бэлэн */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'Available' ? '' : 'Available');
            setPage(1);
          }}
          className={cn(
            'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all shadow-sm',
            status === 'Available'
              ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Ашиглахад бэлэн</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tnum font-mono">
              {formatNumber(availableCount)}
            </span>
            <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">Жолооч цэнэглэх боломжтой</p>
          </div>
        </button>

        {/* Card 4: Ашиглахад төвөгтэй */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'Faulted' ? '' : 'Faulted');
            setPage(1);
          }}
          className={cn(
            'group flex flex-col justify-between rounded-xl border p-4 text-left transition-all shadow-sm',
            status === 'Faulted' || status === 'Unavailable'
              ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/30'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-500">Ашиглахад төвөгтэй</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-rose-500 tnum font-mono">
              {formatNumber(attentionCount)}
            </span>
            <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">Алдаатай, түдгэлзсэн зогссон</p>
          </div>
        </button>
      </div>

      {/* 3. Main Connectors Table Card matching Image 2 */}
      <Card>
        {/* Filter Bar */}
        <FilterBar>
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
            <Input
              className="h-8 w-full sm:w-64 pl-8 pr-7 text-xs"
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

          <Select
            className="h-8 w-auto py-0 text-xs font-medium"
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
                {s === 'Available'
                  ? 'Бэлэн'
                  : s === 'Charging'
                  ? 'Цэнэглэж байгаа'
                  : s === 'SuspendedEV' || s === 'SuspendedEVSE'
                  ? 'Машин түр зогссон'
                  : s === 'Unavailable'
                  ? 'Ашиглах боломжгүй'
                  : s === 'Faulted'
                  ? 'Эвдрэлтэй'
                  : s}{' '}
                {counts[s] ? `(${counts[s]})` : ''}
              </option>
            ))}
          </Select>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--color-fg-muted)] select-none">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-500"
              checked={includeZero}
              onChange={(e) => setIncludeZero(e.target.checked)}
            />
            <span>0-р холбогч (Станцын үндсэн контроллер)</span>
          </label>

          {hasActiveFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="ml-auto text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] h-8"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Шүүлтүүр арилгах
            </Button>
          ) : null}
        </FilterBar>

        {/* Desktop Table View matching Image 2 columns */}
        <div className="hidden md:block">
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="w-12 text-center">№</TH>
                  <TH>Цэнэглэх станц</TH>
                  <TH>Холбогч №</TH>
                  <TH>Төлөв</TH>
                  <TH>Одоогийн явц / Чадал</TH>
                  <TH>Алдаа</TH>
                  <TH className="text-right">Ашиглалт</TH>
                  <TH className="text-right">Төлбөр</TH>
                  <TH>Шинэчлэгдсэн</TH>
                  <TH className="text-right">Үйлдэл</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={columns} />
                ) : error ? (
                  <TableEmpty colSpan={columns}>
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                      <AlertTriangle className="h-6 w-6 text-rose-500" />
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
                  rows.map((c, idx) => {
                    const rowNumber = (page - 1) * limit + idx + 1;
                    const isCharging = c.status === 'Charging';
                    const hasError = c.errorCode && c.errorCode !== 'NoError';
                    const letter = c.connectorId === 0 ? '#0' : connectorLetter(c.connectorId);
                    const powerText = c.powerKw ? `${c.powerKw} кВт` : '60 кВт';

                    return (
                      <TR
                        key={`${c.chargePointId}-${c.connectorId}`}
                        className={cn(isCharging && 'bg-blue-500/5 hover:bg-blue-500/10')}
                      >
                        {/* 1. № */}
                        <TD className="w-12 text-center font-mono text-xs text-[var(--color-fg-subtle)]">
                          {rowNumber}
                        </TD>

                        {/* 2. Цэнэглэх станц */}
                        <TD>
                          <StationName id={c.chargePointId} />
                        </TD>

                        {/* 3. Холбогч № (Pill badge like: A CCS2 60 кВт) */}
                        <TD>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="font-bold">{letter}</span>
                            <span>{c.connectorType || 'CCS2'}</span>
                            <span className="text-[10px] opacity-80">{powerText}</span>
                          </span>
                        </TD>

                        {/* 4. Төлөв (Dot badge) */}
                        <TD>{renderConnectorStatus(c.status)}</TD>

                        {/* 5. Одоогийн явц / Чадал */}
                        <TD>
                          {isCharging ? (
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-2">
                                {c.currentTransactionId ? (
                                  <Link
                                    href={`/transactions/${c.currentTransactionId}`}
                                    className="font-mono font-bold text-blue-500 hover:underline"
                                    title="Цэнэглэлтийн дэлгэрэнгүйг харах"
                                  >
                                    #{c.currentTransactionId}
                                  </Link>
                                ) : null}
                                {c.lastPowerW != null && c.lastPowerW > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 font-semibold text-blue-500 tnum font-mono">
                                    <Zap className="h-3 w-3 fill-current" />
                                    {formatPower(c.lastPowerW)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-blue-500 font-medium">Цэнэглэж байна</span>
                                )}
                              </div>

                              {c.lastSocPercent != null ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                                    <div
                                      className="h-full bg-blue-500 transition-all"
                                      style={{ width: `${Math.min(100, c.lastSocPercent)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[10px] font-semibold text-[var(--color-fg-muted)]">
                                    {c.lastSocPercent}%
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                          )}
                        </TD>

                        {/* 6. Алдаа */}
                        <TD>
                          {hasError ? (
                            <ErrorCodeBadge code={c.errorCode} />
                          ) : (
                            <span className="text-xs text-[var(--color-fg-muted)]">Хэвийн</span>
                          )}
                        </TD>

                        {/* 7. Ашиглалт */}
                        <TD className="text-right font-mono text-xs text-[var(--color-fg-muted)]">
                          {c.lastMeterWh ? `${formatNumber(c.lastMeterWh / 1000, 2)} кВтц` : '—'}
                        </TD>

                        {/* 8. Төлбөр */}
                        <TD className="text-right font-mono text-xs text-[var(--color-fg-subtle)]">
                          —
                        </TD>

                        {/* 9. Шинэчлэгдсэн */}
                        <TD className="text-xs text-[var(--color-fg-subtle)] whitespace-nowrap">
                          {formatRelative(c.statusTimestamp ?? c.updatedAt)}
                        </TD>

                        {/* 10. Үйлдэл: Дэлгэрэнгүй */}
                        <TD className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(c)}
                            className="text-xs h-7 text-emerald-500 hover:text-emerald-400 font-medium"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Дэлгэрэнгүй
                          </Button>
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </TableWrap>
        </div>

        {/* Mobile Cards View matching Image 2 phone mockup */}
        <div className="block md:hidden p-3 space-y-3">
          {isLoading && !data ? (
            <div className="py-8 text-center text-xs text-[var(--color-fg-muted)]">Ачаалж байна...</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--color-fg-muted)]">
              Тохирох холбогч олдсонгүй.
            </div>
          ) : (
            rows.map((c, idx) => {
              const rowNumber = (page - 1) * limit + idx + 1;
              const hasError = c.errorCode && c.errorCode !== 'NoError';
              const letter = c.connectorId === 0 ? '#0' : connectorLetter(c.connectorId);
              const powerText = c.powerKw ? `${c.powerKw} кВт` : '60 кВт';

              return (
                <div
                  key={`${c.chargePointId}-${c.connectorId}`}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-sm space-y-2.5"
                >
                  {/* Top: Row number, Station, and Connector Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] font-mono font-bold text-[var(--color-fg)]">
                        {rowNumber}
                      </span>
                      <StationName id={c.chargePointId} />
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                      <span>{letter}</span>
                      <span>{c.connectorType || 'CCS2'}</span>
                    </span>
                  </div>

                  {/* Status row */}
                  <div className="flex items-center justify-between border-y border-[var(--color-border)] py-2 text-xs">
                    <span className="text-[var(--color-fg-subtle)]">Төлөв:</span>
                    {renderConnectorStatus(c.status)}
                  </div>

                  {/* 2x2 grid stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--color-fg-subtle)] uppercase">Чадал / Явц:</span>
                      <div className="font-mono font-semibold text-[var(--color-fg)] mt-0.5">
                        {c.lastPowerW ? formatPower(c.lastPowerW) : '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--color-fg-subtle)] uppercase">Ашиглалт:</span>
                      <div className="font-mono font-semibold text-[var(--color-fg)] mt-0.5">
                        {c.lastMeterWh ? `${formatNumber(c.lastMeterWh / 1000, 1)} кВтц` : '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--color-fg-subtle)] uppercase">Алдаа:</span>
                      <div className="mt-0.5">
                        {hasError ? (
                          <ErrorCodeBadge code={c.errorCode} />
                        ) : (
                          <span className="text-[var(--color-fg-muted)]">Хэвийн</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--color-fg-subtle)] uppercase">Шинэчлэгдсэн:</span>
                      <div className="text-[var(--color-fg-muted)] text-[11px] mt-0.5">
                        {formatRelative(c.statusTimestamp ?? c.updatedAt)}
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing(c)}
                    className="w-full text-xs h-7 text-emerald-500 hover:text-emerald-400 font-medium"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Дэлгэрэнгүй
                  </Button>
                </div>
              );
            })
          )}
        </div>

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
