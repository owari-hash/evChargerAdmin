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
  SlidersHorizontal,
  Pencil,
  Clock,
  Calendar,
  ExternalLink,
  Menu,
  Trash2,
  PowerOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { connectorLetter, formatNumber, formatPower, formatRelative, formatWh } from '@/lib/format';
import {
  type Connector,
  type ConnectorStatus,
  type Paginated,
  type StatsOverview,
} from '@/lib/types';
import { Badge, Button, Card, Dot, Input, Select } from '@/components/ui/primitives';
import { ErrorCodeBadge } from '@/components/ui/status';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { StatCard, StatGrid } from '@/components/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { ConfirmModal } from '@/components/ui/modal';
import { EditConnectorModal } from './edit-connector-modal';
import { StationName } from '@/components/station-name';
import { cn } from '@/lib/cn';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Бүх төлөв' },
  { value: 'Available', label: 'Бэлэн' },
  { value: 'Preparing', label: 'Бэлтгэж байна' },
  { value: 'Charging', label: 'Цэнэглэж байна' },
  { value: 'SuspendedEV', label: 'Машин түр зогссон' },
  { value: 'SuspendedEVSE', label: 'Станц түр зогссон' },
  { value: 'Finishing', label: 'Дуусгаж байна' },
  { value: 'Reserved', label: 'Захиалагдсан' },
  { value: 'Unavailable', label: 'Идэвхгүй' },
  { value: 'Faulted', label: 'Эвдрэлтэй' },
];

/**
 * Maps connector statuses to clear Mongolian labels and visual tones
 */
function renderConnectorStatus(status?: string) {
  if (!status) return <span className="text-[var(--color-fg-subtle)]">—</span>;

  if (status === 'Available') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        <Dot tone="ok" />
        Бэлэн
      </span>
    );
  }

  if (status === 'Charging') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-500 whitespace-nowrap">
        <Dot tone="brand" pulse />
        Цэнэглэж байна
      </span>
    );
  }

  if (status === 'SuspendedEV') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500 whitespace-nowrap">
        <Dot tone="warn" />
        Зогссон
      </span>
    );
  }

  if (status === 'SuspendedEVSE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500 whitespace-nowrap">
        <Dot tone="warn" />
        Станц зогссон
      </span>
    );
  }

  if (status === 'Preparing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-500 whitespace-nowrap">
        <Dot tone="info" pulse />
        Бэлтгэж байна
      </span>
    );
  }

  if (status === 'Finishing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-500 whitespace-nowrap">
        <Dot tone="info" />
        Дуусгаж байна
      </span>
    );
  }

  if (status === 'Reserved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-500 whitespace-nowrap">
        <Dot tone="info" />
        Захиалагдсан
      </span>
    );
  }

  if (status === 'Faulted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-500 whitespace-nowrap">
        <Dot tone="danger" />
        Эвдрэлтэй
      </span>
    );
  }

  if (status === 'Unavailable') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-500 whitespace-nowrap">
        <Dot tone="idle" />
        Идэвхгүй
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-fg-muted)] whitespace-nowrap">
      <Dot tone="idle" />
      {status}
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
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [editing, setEditing] = React.useState<Connector | null>(null);
  const [deleting, setDeleting] = React.useState<Connector | null>(null);
  const [busyDelete, setBusyDelete] = React.useState(false);

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
  const { data, error, isLoading, mutate } = useSWR<Paginated<Connector>>(
    key,
    fetcher,
    {
      refreshInterval: REFRESH.live,
      keepPreviousData: true,
    },
  );

  const rows = React.useMemo(() => (data?.data ?? []).filter((c) => c.connectorId > 0), [data?.data]);
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
  const inactiveCount = counts['Unavailable'] ?? 0;

  async function handleDeleteConnector() {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      const targetId = deleting.id || (deleting as any)._id;
      await api.del(`connectors/${encodeURIComponent(targetId)}`);
      toast.success('Холбогч амжилттай устгагдлаа');
      setDeleting(null);
      void mutate();
      void mutateOverview();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyDelete(false);
    }
  }

  function handleClearFilters() {
    setStatus('');
    setChargePointId('');
    setDebouncedCp('');
    setPage(1);
  }

  const hasActiveFilter = Boolean(status || debouncedCp);

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatCard
          label="Нийт холбогч"
          value={formatNumber(totalCount)}
          sub="Сүлжээнд буй бүгд"
          icon={Plug}
          tone="brand"
          active={status === ''}
          onClick={() => {
            setStatus('');
            setPage(1);
          }}
        />
        <StatCard
          label="Цэнэглэж байгаа"
          value={formatNumber(chargingCount)}
          sub="Идэвхтэй цэнэглэлт явагдаж байна"
          icon={Zap}
          tone="info"
          active={status === 'Charging'}
          onClick={() => {
            setStatus(status === 'Charging' ? '' : 'Charging');
            setPage(1);
          }}
        />
        <StatCard
          label="Ашиглахад бэлэн"
          value={formatNumber(availableCount)}
          sub="Жолооч цэнэглэх боломжтой"
          icon={CheckCircle2}
          tone="ok"
          active={status === 'Available'}
          onClick={() => {
            setStatus(status === 'Available' ? '' : 'Available');
            setPage(1);
          }}
        />
        <StatCard
          label="Идэвхгүй"
          value={formatNumber(inactiveCount)}
          sub="Ашиглах боломжгүй холбогч"
          icon={PowerOff}
          tone="idle"
          active={status === 'Unavailable'}
          onClick={() => {
            setStatus(status === 'Unavailable' ? '' : 'Unavailable');
            setPage(1);
          }}
        />
      </StatGrid>

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
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} {counts[opt.value] ? `(${counts[opt.value]})` : ''}
              </option>
            ))}
          </Select>

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
                  <TH>Ашиглалт</TH>
                  <TH>Төлбөр</TH>
                  <TH>Шинэчлэгдсэн</TH>
                  <TH>Үйлдэл</TH>
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
                      <Button variant="secondary" size="sm" onClick={() => {
                          void mutate();
                          void mutateOverview();
                        }}
                      >
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
                    const num = (page - 1) * limit + idx + 1;
                    const isCharging = c.status === 'Charging';
                    const hasError = c.errorCode && c.errorCode !== 'NoError';
                    const letter = c.connectorId === 0 ? '#0' : connectorLetter(c.connectorId);
                    const powerText = c.powerKw ? `${c.powerKw} кВт` : '60 кВт';

                    return (
                      <TR
                        key={`${c.chargePointId}-${c.connectorId}`}
                        className={cn(isCharging && 'bg-blue-500/5 hover:bg-blue-500/10')}
                      >
                        {/* 0. № */}
                        <TD align="center" className="text-xs text-[var(--color-fg-muted)] font-mono">
                          {num}
                        </TD>

                        {/* 1. Цэнэглэх станц */}
                        <TD align="left">
                          <div className="max-w-[200px] truncate text-left">
                            <StationName id={c.chargePointId} inline link />
                          </div>
                        </TD>

                        {/* 2. Холбогч № */}
                        <TD align="center">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="font-bold">{letter}</span>
                            <span>{c.connectorType || 'CCS2'}</span>
                            <span className="text-[10px] opacity-80">{powerText}</span>
                          </span>
                        </TD>

                        {/* 3. Төлөв */}
                        <TD align="center">{renderConnectorStatus(c.status)}</TD>

                        {/* 4. Одоогийн явц / Чадал */}
                        <TD align="center">
                          {isCharging ? (
                            <div className="flex flex-col items-center gap-1 text-xs">
                              <div className="flex items-center gap-1.5">
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

                        {/* 5. Алдаа */}
                        <TD align="center">
                          {hasError ? (
                            <ErrorCodeBadge code={c.errorCode} />
                          ) : (
                            <span className="text-xs text-[var(--color-fg-muted)]">Хэвийн</span>
                          )}
                        </TD>

                        {/* 6. Ашиглалт */}
                        <TD align="right" className="font-mono text-xs">
                          {c.lastMeterWh ? `${formatNumber(c.lastMeterWh / 1000, 2)} кВтц` : '—'}
                        </TD>

                        {/* 7. Төлбөр */}
                        <TD align="right" className="font-mono text-xs text-[var(--color-fg-subtle)]">
                          —
                        </TD>

                        {/* 8. Шинэчлэгдсэн */}
                        <TD align="center" className="text-xs text-[var(--color-fg-subtle)] whitespace-nowrap">
                          {formatRelative(c.statusTimestamp ?? c.updatedAt)}
                        </TD>

                        {/* 9. Үйлдэл */}
                        <TD align="center" className="py-1.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {canOperate ? (
                              <button
                                type="button"
                                onClick={() => setEditing(c)}
                                title="Засах / Тохируулах"
                                aria-label="Холбогч засах"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            <Link
                              href={`/charge-points/${encodeURIComponent(c.chargePointId)}`}
                              title="Станцын дэлгэрэнгүй харах"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition"
                            >
                              <Menu className="h-3.5 w-3.5" />
                            </Link>
                            {canOperate ? (
                              <button
                                type="button"
                                onClick={() => setDeleting(c)}
                                title="Холбогч устгах"
                                aria-label="Холбогч устгах"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
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

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {canOperate ? (
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        title="Засах / Тохируулах"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <Link
                      href={`/charge-points/${encodeURIComponent(c.chargePointId)}`}
                      title="Станцын дэлгэрэнгүй харах"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition"
                    >
                      <Menu className="h-3.5 w-3.5" />
                    </Link>
                    {canOperate ? (
                      <button
                        type="button"
                        onClick={() => setDeleting(c)}
                        title="Холбогч устгах"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConnector}
        title="Холбогч устгах"
        confirmLabel="Устгах"
        loading={busyDelete}
        tone="danger"
        message={
          <p className="text-xs">
            Та энэ холбогчийг баазаас устгахдаа итгэлтэй байна уу? Хэрэв тухайн холбогч дээр идэвхтэй цэнэглэлт явагдаж байвал устгах боломжгүй.
          </p>
        }
      />
    </div>
  );
}
