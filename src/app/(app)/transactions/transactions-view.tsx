'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import {
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPower,
  formatWh,
} from '@/lib/format';
import { TRANSACTION_STATUSES, type Paginated, type Transaction } from '@/lib/types';
import { Button, Card, Input, PageHeader, Select } from '@/components/ui/primitives';
import { TransactionStatusBadge } from '@/components/ui/status';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { TRANSACTION_STATUS, mn } from '@/lib/mn';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

export function TransactionsView({
  canOperate,
  initialStatus,
  initialChargePointId,
  initialIdTag,
}: {
  canOperate: boolean;
  initialStatus: string;
  initialChargePointId: string;
  initialIdTag: string;
}) {
  const [status, setStatus] = React.useState(initialStatus);
  const [chargePointId, setChargePointId] = React.useState(initialChargePointId);
  const [idTag, setIdTag] = React.useState(initialIdTag);
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
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
    status,
    chargePointId: debounced.chargePointId,
    idTag: debounced.idTag,
    from: from ? new Date(from).toISOString() : '',
    to: to ? new Date(to).toISOString() : '',
    page,
    limit,
  });

  const { data, error, isLoading, mutate } = useSWR<Paginated<Transaction>>(key, fetcher, {
    // Active sessions change constantly; completed ones do not.
    refreshInterval: status === 'Completed' ? 0 : 15_000,
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
      <PageHeader
        title="Цэнэглэлтүүд"
        description="CSMS-д бүртгэгдсэн бүх цэнэглэлт, шинэ нь эхэндээ."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void mutate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Шинэчлэх
          </Button>
        }
      />

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
            className="w-auto min-w-[160px]"
            placeholder="Станцын дугаар"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
          <Input
            className="w-auto min-w-[140px]"
            placeholder="RFID карт"
            value={idTag}
            onChange={(e) => setIdTag(e.target.value)}
          />
          <Input
            className="w-auto"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            aria-label="Эхлэх огноо"
          />
          <Input
            className="w-auto"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            aria-label="Дуусах огноо"
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
                <TH>Цэнэглэлт</TH>
                <TH>Төлөв</TH>
                <TH>Цэнэглэх станц</TH>
                <TH>Карт</TH>
                <TH>Эхэлсэн</TH>
                <TH align="right">Үргэлжилсэн</TH>
                <TH align="right">Эрчим хүч</TH>
                <TH align="right">Чадал</TH>
                <TH align="right">Төлбөр</TH>
                <TH>Зогссон шалтгаан</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={10} />
              ) : error ? (
                <TableEmpty colSpan={10}>Цэнэглэлтийг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={10}>Энэ шүүлтүүрт тохирох цэнэглэлт алга.</TableEmpty>
              ) : (
                rows.map((tx) => {
                  const id = tx.transactionId ?? tx.id;
                  const energyWh =
                    tx.status === 'Active'
                      ? (tx.lastMeterWh ?? tx.meterStart) - tx.meterStart
                      : tx.energyWh;
                  return (
                    <TR key={id}>
                      <TD>
                        <Link
                          href={`/transactions/${id}`}
                          className="font-mono text-xs font-medium text-[var(--color-brand)] hover:underline"
                        >
                          #{id}
                        </Link>
                      </TD>
                      <TD>
                        <TransactionStatusBadge status={tx.status} />
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
                      <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                        {formatDateTime(tx.startTimestamp)}
                      </TD>
                      <TD align="right" className="text-xs">
                        {formatDuration(tx.startTimestamp, tx.stopTimestamp)}
                      </TD>
                      <TD align="right" className="text-xs font-medium">
                        {formatWh(energyWh)}
                      </TD>
                      <TD align="right" className="text-xs">
                        {tx.status === 'Active' ? formatPower(tx.lastPowerW) : '—'}
                      </TD>
                      <TD align="right" className="text-xs">
                        {tx.cost != null ? formatMoney(tx.cost) : '—'}
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
          This page: {formatWh(totals.energyWh)} delivered
          {totals.cost > 0 ? ` · ${formatMoney(totals.cost)} billed` : ''} across{' '}
          {formatNumber(rows.length)} of {formatNumber(data?.total ?? 0)} sessions.
          {canOperate ? ' Open a session to stop or force-close it.' : ''}
        </p>
      ) : null}
    </>
  );
}
