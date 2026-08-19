'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import type { ChargingProfile, Paginated } from '@/lib/types';
import { Badge, Button, Card, CodeBlock, EmptyState, Input, PageHeader } from '@/components/ui/primitives';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { formatJson } from '@/lib/format';

interface Schedule {
  chargingRateUnit?: string;
  duration?: number;
  minChargingRate?: number;
  chargingSchedulePeriod?: { startPeriod: number; limit: number; numberPhases?: number }[];
}

/** One-line summary of the schedule so the table is readable without expanding. */
function summarise(schedule?: Record<string, unknown>): string {
  const s = schedule as Schedule | undefined;
  const periods = s?.chargingSchedulePeriod;
  if (!periods?.length) return '—';
  const unit = s?.chargingRateUnit ?? '';
  const limits = periods.map((p) => `${p.limit}${unit}`);
  if (limits.length === 1) return `${limits[0]} flat`;
  return `${limits.length} periods · ${limits[0]} → ${limits[limits.length - 1]}`;
}

export function ChargingProfilesView() {
  const [chargePointId, setChargePointId] = React.useState('');
  const [debouncedCp, setDebouncedCp] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCp(chargePointId);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [chargePointId]);

  const key = apiUrl('charging-profiles', { chargePointId: debouncedCp, page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<ChargingProfile>>(key, fetcher, {
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Smart charging profiles"
        description="Charging limits the CSMS has installed on charge points."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void mutate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <Card>
        <FilterBar>
          <Input
            className="w-auto min-w-[200px]"
            placeholder="Charge point id"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
          {data ? (
            <span className="text-xs text-[var(--color-fg-muted)]">
              {formatNumber(data.total)} profile{data.total === 1 ? '' : 's'}
            </span>
          ) : null}
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Profile</TH>
                <TH>Charge point</TH>
                <TH>Connector</TH>
                <TH>Purpose</TH>
                <TH>Kind</TH>
                <TH align="right">Stack</TH>
                <TH>Schedule</TH>
                <TH>Valid</TH>
                <TH align="right">Created</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={10} />
              ) : error ? (
                <TableEmpty colSpan={10}>Could not load charging profiles.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={10}>No charging profiles installed.</TableEmpty>
              ) : (
                rows.map((p) => {
                  const isOpen = expanded === p._id;
                  return (
                    <React.Fragment key={p._id}>
                      <TR interactive onClick={() => setExpanded(isOpen ? null : p._id)}>
                        <TD className="font-mono text-xs font-medium">#{p.chargingProfileId}</TD>
                        <TD>
                          <Link
                            href={`/charge-points/${encodeURIComponent(p.chargePointId)}`}
                            className="text-xs hover:text-[var(--color-brand)] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {p.chargePointId}
                          </Link>
                        </TD>
                        <TD className="font-mono text-xs">{p.connectorId}</TD>
                        <TD className="text-xs">
                          {p.chargingProfilePurpose ? (
                            <Badge tone="info">{p.chargingProfilePurpose}</Badge>
                          ) : (
                            '—'
                          )}
                        </TD>
                        <TD className="text-xs text-[var(--color-fg-muted)]">
                          {p.chargingProfileKind ?? '—'}
                          {p.recurrencyKind ? ` · ${p.recurrencyKind}` : ''}
                        </TD>
                        <TD align="right" className="text-xs">
                          {p.stackLevel ?? 0}
                        </TD>
                        <TD className="text-xs">{summarise(p.chargingSchedule)}</TD>
                        <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                          {p.validFrom || p.validTo
                            ? `${p.validFrom ? formatDateTime(p.validFrom) : '—'} → ${p.validTo ? formatDateTime(p.validTo) : '—'}`
                            : 'Always'}
                        </TD>
                        <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                          {formatRelative(p.createdAt)}
                        </TD>
                        <TD align="right" className="text-xs text-[var(--color-brand)]">
                          {isOpen ? 'Hide' : 'Schedule'}
                        </TD>
                      </TR>
                      {isOpen ? (
                        <tr>
                          <td colSpan={10} className="bg-[var(--color-surface-2)]/50 px-4 py-3">
                            <CodeBlock>{formatJson(p.chargingSchedule) || '(no schedule)'}</CodeBlock>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
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
            label="profiles"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !debouncedCp ? (
          <EmptyState
            icon={<SlidersHorizontal className="h-8 w-8" />}
            title="No charging profiles"
            description="Install one from a charge point's command console with Set charging profile."
          />
        ) : null}
      </Card>
    </>
  );
}
