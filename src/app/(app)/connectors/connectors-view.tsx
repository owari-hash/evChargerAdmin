'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatNumber, formatPower, formatRelative, formatWh } from '@/lib/format';
import { CONNECTOR_STATUSES, type Connector, type Paginated } from '@/lib/types';
import { Badge, Button, Card, Input, PageHeader, Select } from '@/components/ui/primitives';
import { ConnectorStatusBadge, ErrorCodeBadge, connectorTone } from '@/components/ui/status';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

/**
 * Network-wide connector view. Connector 0 is hidden by default because it
 * represents the charge point itself rather than a socket a driver can use.
 */
export function ConnectorsView({
  initialStatus,
  initialChargePointId,
}: {
  initialStatus: string;
  initialChargePointId: string;
}) {
  const [status, setStatus] = React.useState(initialStatus);
  const [chargePointId, setChargePointId] = React.useState(initialChargePointId);
  const [debouncedCp, setDebouncedCp] = React.useState(initialChargePointId);
  const [includeZero, setIncludeZero] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(100);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCp(chargePointId);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [chargePointId]);

  const key = apiUrl('connectors', { status, chargePointId: debouncedCp, page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<Connector>>(key, fetcher, {
    refreshInterval: 10_000,
    keepPreviousData: true,
  });

  const all = data?.data ?? [];
  const rows = includeZero ? all : all.filter((c) => c.connectorId > 0);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of rows) map.set(c.status, (map.get(c.status) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Connectors"
        description="Live status of every connector across the network."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void mutate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {counts.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {counts.map(([s, n]) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(status === s ? '' : s);
                setPage(1);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                status === s
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Badge tone={connectorTone(s)}>{s}</Badge>
                <span className="font-semibold tnum">{formatNumber(n)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <Card>
        <FilterBar>
          <Select
            className="w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {CONNECTOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Input
            className="w-auto min-w-[180px]"
            placeholder="Charge point id"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--color-brand)]"
              checked={includeZero}
              onChange={(e) => setIncludeZero(e.target.checked)}
            />
            Show connector 0
          </label>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Charge point</TH>
                <TH>#</TH>
                <TH>Status</TH>
                <TH>Error</TH>
                <TH>Availability</TH>
                <TH>Session</TH>
                <TH align="right">Meter</TH>
                <TH align="right">Power</TH>
                <TH align="right">SoC</TH>
                <TH align="right">Updated</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={10} />
              ) : error ? (
                <TableEmpty colSpan={10}>Could not load connectors.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={10}>No connectors match these filters.</TableEmpty>
              ) : (
                rows.map((c) => (
                  <TR key={`${c.chargePointId}-${c.connectorId}`}>
                    <TD>
                      <Link
                        href={`/charge-points/${encodeURIComponent(c.chargePointId)}`}
                        className="text-xs font-medium hover:text-[var(--color-brand)] hover:underline"
                      >
                        {c.chargePointId}
                      </Link>
                    </TD>
                    <TD className="font-mono text-xs">{c.connectorId}</TD>
                    <TD>
                      <ConnectorStatusBadge status={c.status} />
                    </TD>
                    <TD>
                      <ErrorCodeBadge code={c.errorCode} />
                    </TD>
                    <TD className="text-xs">{c.availability}</TD>
                    <TD className="text-xs">
                      {c.currentTransactionId ? (
                        <Link
                          href={`/transactions/${c.currentTransactionId}`}
                          className="font-mono text-[var(--color-brand)] hover:underline"
                        >
                          #{c.currentTransactionId}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD align="right" className="text-xs">
                      {formatWh(c.lastMeterWh)}
                    </TD>
                    <TD align="right" className="text-xs">
                      {formatPower(c.lastPowerW)}
                    </TD>
                    <TD align="right" className="text-xs">
                      {c.lastSocPercent != null ? `${c.lastSocPercent}%` : '—'}
                    </TD>
                    <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                      {formatRelative(c.statusTimestamp ?? c.updatedAt)}
                    </TD>
                  </TR>
                ))
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
            label="connectors"
          />
        ) : null}
      </Card>
    </>
  );
}
