'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { Eye, Trash2, Zap } from 'lucide-react';
import { REFRESH } from '@/lib/live-query';
import { apiUrl, fetcher } from '@/lib/client';
import {
  connectorLetter,
  formatAmount,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPower,
  formatWh,
} from '@/lib/format';
import {
  TRANSACTION_STATUSES,
  type Paginated,
  type Transaction,
  type StationPowerItem,
} from '@/lib/types';
import { Button, Card, Input, Select } from '@/components/ui/primitives';
import { DateRangePicker, toIsoDate } from '@/components/ui/date-picker';
import { TransactionStatusBadge } from '@/components/ui/status';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { TRANSACTION_STATUS, mn } from '@/lib/mn';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { ConfirmModal } from '@/components/ui/modal';
import { Tabs, TabCount } from '@/components/ui/tabs';
import { useLiveEvents } from '@/lib/use-live-events';
import { StationPowerStatsPanel } from '@/components/power-monitoring/station-power-stats';
import { StationPowerTable } from '@/components/power-monitoring/station-power-table';
import { PowerAlertsPanel } from '@/components/power-monitoring/power-alerts-panel';
import { StationPowerDetailModal } from '@/components/power-monitoring/station-power-detail-modal';
import { StationElectricalConfigModal } from '@/components/power-monitoring/station-electrical-config-modal';
import { cn } from '@/lib/cn';

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function toStartOfDayIso(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('T')) return new Date(dateStr).toISOString();
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function toEndOfDayIso(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('T')) return new Date(dateStr).toISOString();
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

export function TransactionsView({
  canOperate,
  canAdmin = false,
  isClient = false,
  initialStatus,
  initialChargePointId,
  initialIdTag,
  initialFrom,
  initialTo,
  initialTab = 'monitoring',
}: {
  canOperate: boolean;
  canAdmin?: boolean;
  isClient?: boolean;
  initialStatus: string;
  initialChargePointId: string;
  initialIdTag: string;
  initialFrom?: string;
  initialTo?: string;
  initialTab?: string;
}) {
  const [activeTab, setActiveTab] = React.useState<'monitoring' | 'history'>(
    initialTab === 'history' ? 'history' : 'monitoring',
  );

  // Station picked for the power statistics panel (remembered per browser)
  const [pickedStationId, setPickedStationId] = React.useState('');
  const savedStationId = React.useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem('power-stats.station') ?? '';
      } catch {
        return '';
      }
    },
    () => '',
  );
  const pickStatsStation = React.useCallback((id: string) => {
    setPickedStationId(id);
    try {
      localStorage.setItem('power-stats.station', id);
    } catch {}
  }, []);

  // Power Monitoring drill-down and config modal states
  const [selectedStation, setSelectedStation] = React.useState<StationPowerItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);
  const [configStation, setConfigStation] = React.useState<StationPowerItem | null>(null);
  const [configModalOpen, setConfigModalOpen] = React.useState(false);

  // Transactions table filters and state
  const [status, setStatus] = React.useState(initialStatus);
  const [chargePointId, setChargePointId] = React.useState(initialChargePointId);
  const [idTag, setIdTag] = React.useState(initialIdTag);

  const [deleting, setDeleting] = React.useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Default to today's date if no date filter is passed in URL
  const todayIso = React.useMemo(() => toIsoDate(new Date()), []);
  const [from, setFrom] = React.useState(initialFrom !== undefined ? initialFrom : todayIso);
  const [to, setTo] = React.useState(initialTo !== undefined ? initialTo : todayIso);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);

  const [debounced, setDebounced] = React.useState({ chargePointId, idTag });
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced({ chargePointId, idTag });
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [chargePointId, idTag]);

  // SWR for transactions history
  const key = apiUrl('transactions', {
    status: status || undefined,
    chargePointId: debounced.chargePointId || undefined,
    idTag: debounced.idTag || undefined,
    from: toStartOfDayIso(from) || undefined,
    to: toEndOfDayIso(to) || undefined,
    page,
    limit,
  });

  const { data, error, isLoading, mutate } = useSWR<Paginated<Transaction>>(key, fetcher, {
    // Active sessions change constantly; completed ones rarely do.
    refreshInterval: status === 'Completed' ? REFRESH.config : REFRESH.live,
    keepPreviousData: true,
  });

  const { mutate: globalMutate } = useSWRConfig();
  const mutateStats = React.useCallback(
    () => globalMutate((k) => typeof k === 'string' && k.includes('power-monitoring/stations/') && k.includes('/stats')),
    [globalMutate],
  );

  // SWR for stations power monitoring list
  const {
    data: stationsData,
    isLoading: isStationsLoading,
    mutate: mutateStations,
  } = useSWR<StationPowerItem[]>(
    apiUrl('power-monitoring/stations'),
    fetcher,
    { refreshInterval: 4000 },
  );

  // Fall back to the saved station, then the busiest online one, so the
  // panel shows data straight away.
  const statsStationId = React.useMemo(() => {
    const list = stationsData ?? [];
    const has = (id: string) => id && list.some((s) => s.id === id);
    if (has(pickedStationId)) return pickedStationId;
    if (has(savedStationId)) return savedStationId;
    const best = [...list].sort(
      (a, b) => Number(b.isOnline) - Number(a.isOnline) || b.totalOutputPowerKw - a.totalOutputPowerKw,
    )[0];
    return best?.id ?? '';
  }, [stationsData, pickedStationId, savedStationId]);

  // Listen to live CSMS SSE events for zero-refresh real-time updates
  useLiveEvents({
    events: [
      'power.telemetry',
      'power.alert',
      'transaction.metervalue',
      'transaction.started',
      'transaction.stopped',
      'connector.status',
      'chargepoint.connected',
      'chargepoint.disconnected',
    ],
    onEvent: () => {
      void mutateStations();
      if (status !== 'Completed') {
        void mutate();
      }
    },
  });

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const id = deleting.transactionId ?? deleting.id;
      const res = await fetch(apiUrl(`transactions/${id}`), {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Устгаж чадсангүй');
      }
      setDeleting(null);
      await mutate();
    } catch (err: any) {
      alert(err.message || 'Алдаа гарлаа');
    } finally {
      setIsDeleting(false);
    }
  };

  const rows = data?.data ?? [];
  const totals = rows.reduce(
    (acc, tx) => {
      acc.energyWh += tx.energyWh ?? 0;
      acc.cost += tx.cost ?? 0;
      return acc;
    },
    { energyWh: 0, cost: 0 },
  );

  const handleOpenConfig = (st: StationPowerItem) => {
    setConfigStation(st);
    setConfigModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Tab Bar Navigation */}
      <Tabs
        items={[
          {
            key: 'monitoring',
            label: '⚡ Эрчим хүчний хяналт & Мониторинг',
            badge: (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ),
          },
          {
            key: 'history',
            label: '📋 Цэнэглэлтийн түүх',
            badge: data?.total ? <TabCount>{formatNumber(data.total)}</TabCount> : undefined,
          },
        ]}
        value={activeTab}
        onChange={(k) => setActiveTab(k as any)}
      />

      {/* =================================================================== */}
      {/* TAB 1: POWER MONITORING & ANALYTICS DASHBOARD                       */}
      {/* =================================================================== */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Selected station: peak / average / low kW and gun sharing */}
          <StationPowerStatsPanel
            stations={stationsData ?? []}
            stationsLoading={isStationsLoading}
            stationId={statsStationId}
            onStationChange={pickStatsStation}
            onConfigure={canOperate ? handleOpenConfig : undefined}
          />

          {/* All stations, live. Clicking a row shows its statistics above. */}
          <StationPowerTable
            stations={stationsData ?? []}
            isLoading={isStationsLoading}
            onSelectStation={(st) => {
              pickStatsStation(st.id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onConfigureStation={handleOpenConfig}
          />

          {/* Operational Alerts & Anomaly Feed */}
          <PowerAlertsPanel />
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: TRANSACTIONS HISTORY TABLE                                   */}
      {/* =================================================================== */}
      {activeTab === 'history' && (
        <>
          <Card>
            <FilterBar>
              <Select
                className="w-auto"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                aria-label="Төлөв"
              >
                <option value="">Бүх төлөв</option>
                {TRANSACTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {mn(TRANSACTION_STATUS, s)}
                  </option>
                ))}
              </Select>
              <Input
                className="w-full sm:w-auto min-w-0 sm:min-w-[160px]"
                placeholder="Станцын дугаар"
                value={chargePointId}
                onChange={(e) => setChargePointId(e.target.value)}
              />
              <Input
                className="w-full sm:w-auto min-w-0 sm:min-w-[140px]"
                placeholder="RFID карт"
                value={idTag}
                onChange={(e) => setIdTag(e.target.value)}
              />
              <DateRangePicker
                className="w-full sm:w-auto min-w-0 sm:min-w-[15rem]"
                value={{ from, to }}
                onChange={(r) => {
                  setFrom(r.from);
                  setTo(r.to);
                  setPage(1);
                }}
                aria-label="Огнооны муж"
              />
              {status || chargePointId || idTag || from || to ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatus('');
                    setChargePointId('');
                    setIdTag('');
                    setFrom('');
                    setTo('');
                    setPage(1);
                  }}
                >
                  Цэвэрлэх
                </Button>
              ) : null}
            </FilterBar>

            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH className="w-12 text-center">№</TH>
                    <TH>Цэнэглэлт ID</TH>
                    <TH>Төлөв</TH>
                    <TH>Цэнэглэх станц</TH>
                    <TH>Хошуу</TH>
                    <TH>Карт</TH>
                    <TH>Эхэлсэн</TH>
                    <TH>Үргэлжилсэн</TH>
                    <TH>Эрчим хүч</TH>
                    <TH>Боломжит кВт</TH>
                    <TH>Чадал / SoC</TH>
                    <TH align="right" className="text-right px-3">Төлбөр</TH>
                    <TH>Зогссон шалтгаан</TH>
                    {!isClient ? <TH align="center" className="text-center w-24">Үйлдэл</TH> : null}
                  </tr>
                </THead>
                <TBody>
                  {isLoading && !data ? (
                    <TableLoading colSpan={isClient ? 13 : 14} />
                  ) : error ? (
                    <TableEmpty colSpan={isClient ? 13 : 14}>Цэнэглэлтийг ачаалж чадсангүй.</TableEmpty>
                  ) : rows.length === 0 ? (
                    <TableEmpty colSpan={isClient ? 13 : 14}>Энэ шүүлтүүрт тохирох цэнэглэлт алга.</TableEmpty>
                  ) : (
                    rows.map((tx, idx) => {
                      const num = (page - 1) * limit + idx + 1;
                      const id = tx.transactionId ?? tx.id;
                      const isActive = tx.status === 'Active';
                      const energyWh =
                        isActive
                          ? (tx.lastMeterWh ?? tx.meterStart) - tx.meterStart
                          : tx.energyWh;

                      return (
                        <TR
                          key={id}
                          className={cn(
                            'transition-all',
                            isActive &&
                              'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-4 border-l-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.12)]',
                          )}
                        >
                          <TD align="center" className="text-xs text-[var(--color-fg-muted)] font-mono">
                            {num}
                          </TD>
                          <TD>
                            <div className="flex items-center gap-1.5">
                              {isActive ? (
                                <span className="relative flex h-2 w-2 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              ) : null}
                              <Link
                                href={`/transactions/${id}`}
                                className={cn(
                                  'font-mono text-xs hover:underline',
                                  isActive ? 'text-emerald-500 font-bold' : 'text-[var(--color-brand)] font-medium',
                                )}
                              >
                                #{id}
                              </Link>
                            </div>
                          </TD>
                          <TD>
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-sm whitespace-nowrap">
                                <Zap className="h-3.5 w-3.5 fill-current text-emerald-500 animate-pulse" />
                                Цэнэглэж байна
                              </span>
                            ) : (
                              <TransactionStatusBadge status={tx.status} />
                            )}
                          </TD>

                          {/* Цэнэглэх станц */}
                          <TD align="left">
                            <div className="max-w-[200px] truncate text-left">
                              <Link
                                href={`/charge-points/${encodeURIComponent(tx.chargePointId)}`}
                                className="font-medium text-[var(--color-fg)] hover:text-[var(--color-brand)] hover:underline truncate block"
                                title={tx.chargePointName || tx.cpId}
                              >
                                {tx.chargePointName?.trim() || tx.cpId}
                              </Link>
                            </div>
                          </TD>

                          {/* Хошуу */}
                          <TD align="center">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold font-mono text-xs">
                              {connectorLetter(tx.connectorId)}
                            </span>
                          </TD>

                          {/* Карт */}
                          <TD align="center" className="text-xs font-mono">
                            <span className="font-mono text-[var(--color-fg)]">{tx.idTag || '—'}</span>
                            {tx.driver?.name ? (
                              <p className="text-[11px] text-[var(--color-fg-subtle)] truncate max-w-[140px]">
                                {tx.driver.name}
                              </p>
                            ) : null}
                          </TD>
                          <TD align="center" className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                            {formatDateTime(tx.startTimestamp)}
                          </TD>
                          <TD className="text-xs font-mono">
                            {formatDuration(tx.startTimestamp, tx.stopTimestamp)}
                          </TD>
                          <TD className="text-xs font-medium font-mono">
                            {formatWh(energyWh)}
                          </TD>
                          <TD className="text-xs font-mono">
                            {tx.maxAllowedEnergyKwh != null ? (
                              <span
                                className="text-[var(--color-fg-muted)] font-medium"
                                title={tx.maxAllowedCost != null ? `Хязгаар: ${formatMoney(tx.maxAllowedCost)}` : undefined}
                              >
                                {tx.maxAllowedEnergyKwh.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} кВт·ц
                              </span>
                            ) : (
                              <span className="text-[var(--color-fg-subtle)] text-[11px]">Хязгааргүй</span>
                            )}
                          </TD>
                          <TD className="text-xs">
                            {isActive ? (
                              <div className="flex flex-col gap-1">
                                {tx.lastPowerW != null && tx.lastPowerW > 0 ? (
                                  <span className="font-mono text-xs font-bold text-emerald-500 inline-flex items-center gap-1">
                                    <Zap className="h-3 w-3 animate-pulse fill-current" />
                                    {formatPower(tx.lastPowerW)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-emerald-500 font-semibold inline-flex items-center gap-1">
                                    <Zap className="h-3 w-3 animate-pulse fill-current" />
                                    Цэнэглэж байна
                                  </span>
                                )}

                                {tx.lastSocPercent != null ? (
                                  <div
                                    className="flex items-center gap-1.5"
                                    title={
                                      tx.startSocPercent != null
                                        ? `Батерейн цэнэг: ${tx.startSocPercent}% → ${tx.lastSocPercent}%`
                                        : `Батерейн цэнэг: ${tx.lastSocPercent}%`
                                    }
                                  >
                                    <div className="relative h-1.5 w-14 overflow-hidden rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                                      <div
                                        className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${clampPct(tx.lastSocPercent)}%` }}
                                      />
                                      {tx.startSocPercent != null ? (
                                        <div
                                          className="absolute inset-y-0 left-0 bg-emerald-900/70"
                                          style={{ width: `${clampPct(Math.min(tx.startSocPercent, tx.lastSocPercent))}%` }}
                                        />
                                      ) : null}
                                    </div>
                                    <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                      {tx.startSocPercent != null ? `${tx.startSocPercent}% → ` : ''}
                                      {tx.lastSocPercent}%
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5 text-xs">
                                <span className="text-[var(--color-fg-muted)] font-mono">
                                  {tx.lastPowerW ? formatPower(tx.lastPowerW) : '—'}
                                </span>
                                {tx.lastSocPercent != null ? (
                                  <span
                                    className="font-mono text-[10px] text-[var(--color-fg-subtle)] whitespace-nowrap"
                                    title="Эхэлсэн → Дууссан батерейн цэнэг"
                                  >
                                    SoC: {tx.startSocPercent != null ? `${tx.startSocPercent}% → ` : ''}
                                    {tx.lastSocPercent}%
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </TD>
                          <TD align="right" className="text-xs font-mono font-normal">
                            {tx.cost != null ? formatAmount(tx.cost) : '0.00'}
                          </TD>
                          <TD className="text-xs text-[var(--color-fg-muted)]">{tx.stopReason ?? '—'}</TD>
                          {!isClient ? (
                            <TD align="center" className="py-1.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <Link
                                  href={`/transactions/${id}`}
                                  title="Дэлгэрэнгүй харах"
                                  aria-label={`#${id} дэлгэрэнгүй харах`}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition cursor-pointer"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Link>
                                {canAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => setDeleting(tx)}
                                    aria-label={`#${id} устгах`}
                                    title="Устгах"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            </TD>
                          ) : null}
                        </TR>
                      );
                    })
                  )}
                </TBody>
              </Table>
            </TableWrap>

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
                label="цэнэглэлт"
              />
            ) : null}
          </Card>

          {rows.length > 0 ? (
            <p className="mt-3 text-xs text-[var(--color-fg-subtle)]">
              Энэ хуудсанд: Нийт {formatWh(totals.energyWh)} олгосон
              {totals.cost > 0 ? ` · ${formatMoney(totals.cost)} тооцогдсон` : ''} ({formatNumber(data?.total ?? 0)} цэнэглэлтээс {formatNumber(rows.length)}-г харуулж байна).
              {canOperate ? ' Цэнэглэлтийг зогсоох эсвэл албадан дуусгах бол тухайн цэнэглэлт дээр дарж нээнэ үү.' : ''}
            </p>
          ) : null}

          <ConfirmModal
            open={!!deleting}
            onClose={() => setDeleting(null)}
            onConfirm={handleDelete}
            title="Цэнэглэлт устгах"
            message={`Та #${deleting?.transactionId ?? deleting?.id} дугаартай цэнэглэлтийн түүхийг бүрмөсөн устгахдаа итгэлтэй байна уу?`}
            confirmLabel={isDeleting ? 'Устгаж байна...' : 'Устгах'}
            tone="danger"
            loading={isDeleting}
          />
        </>
      )}

      {/* Station Power Drill-Down Modal */}
      <StationPowerDetailModal
        stationId={selectedStation?.id ?? null}
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onConfigure={() => {
          setDetailModalOpen(false);
          if (selectedStation) handleOpenConfig(selectedStation);
        }}
      />

      {/* Station Electrical Configuration Modal */}
      <StationElectricalConfigModal
        station={configStation}
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSaved={() => {
          void mutateStations();
          void mutateStats();
        }}
      />
    </div>
  );
}
