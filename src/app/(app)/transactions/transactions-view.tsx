'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Zap } from 'lucide-react';
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
import { TRANSACTION_STATUSES, type Paginated, type Transaction } from '@/lib/types';
import { Button, Card, Input, Select } from '@/components/ui/primitives';
import { DateRangePicker, toIsoDate } from '@/components/ui/date-picker';
import { TransactionStatusBadge } from '@/components/ui/status';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { TRANSACTION_STATUS, mn } from '@/lib/mn';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { StationName } from '@/components/station-name';
import { cn } from '@/lib/cn';

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
  initialStatus,
  initialChargePointId,
  initialIdTag,
  initialFrom,
  initialTo,
}: {
  canOperate: boolean;
  initialStatus: string;
  initialChargePointId: string;
  initialIdTag: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [status, setStatus] = React.useState(initialStatus);
  const [chargePointId, setChargePointId] = React.useState(initialChargePointId);
  const [idTag, setIdTag] = React.useState(initialIdTag);

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

  const key = apiUrl('transactions', {
    status: status || undefined,
    chargePointId: debounced.chargePointId || undefined,
    idTag: debounced.idTag || undefined,
    from: toStartOfDayIso(from) || undefined,
    to: toEndOfDayIso(to) || undefined,
    page,
    limit,
  });

  const { data, error, isLoading } = useSWR<Paginated<Transaction>>(key, fetcher, {
    // Active sessions change constantly; completed ones rarely do.
    refreshInterval: status === 'Completed' ? REFRESH.config : REFRESH.live,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];
  const totals = rows.reduce(
    (acc, tx) => {
      acc.energyWh += tx.energyWh ?? 0;
      acc.cost += tx.cost ?? 0;
      return acc;
    },
    { energyWh: 0, cost: 0 },
  );

  return (
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
                <TH>Чадал / SoC</TH>
                <TH align="right" className="text-right px-3">Төлбөр</TH>
                <TH>Зогссон шалтгаан</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={12} />
              ) : error ? (
                <TableEmpty colSpan={12}>Цэнэглэлтийг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={12}>Энэ шүүлтүүрт тохирох цэнэглэлт алга.</TableEmpty>
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
                              <div className="flex items-center gap-1.5" title={`Батарейн цэнэг: ${tx.lastSocPercent}%`}>
                                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                                  <div
                                    className="h-full bg-emerald-500 transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(0, tx.lastSocPercent))}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
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
                              <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                                SoC: {tx.lastSocPercent}%
                              </span>
                            ) : null}
                          </div>
                        )}
                      </TD>
                      <TD align="right" className="text-xs font-mono font-normal">
                        {tx.cost != null ? formatAmount(tx.cost) : '0.00'}
                      </TD>
                      <TD className="text-xs text-[var(--color-fg-muted)]">{tx.stopReason ?? '—'}</TD>
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
    </>
  );
}
