'use client';

import * as React from 'react';
import useSWR from 'swr';
import { SlidersHorizontal } from 'lucide-react';
import { REFRESH } from '@/lib/live-query';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import type { ChargingProfile, Paginated } from '@/lib/types';
import { Badge, Card, CodeBlock, EmptyState, Input } from '@/components/ui/primitives';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { formatJson } from '@/lib/format';
import { StationName } from '@/components/station-name';

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
  const { data, error, isLoading } = useSWR<Paginated<ChargingProfile>>(key, fetcher, {
    refreshInterval: REFRESH.config,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  return (
    <>
      <Card>
        <FilterBar>
          <Input
            className="w-auto min-w-[200px]"
            placeholder="Станцын дугаар"
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
                <TH>Профайл</TH>
                <TH>Цэнэглэх станц</TH>
                <TH>Холбогч</TH>
                <TH>Зориулалт</TH>
                <TH>Төрөл</TH>
                <TH>Давхарга</TH>
                <TH>Хуваарь</TH>
                <TH>Хүчинтэй</TH>
                <TH>Үүсгэсэн</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={10} />
              ) : error ? (
                <TableEmpty colSpan={10}>Цэнэглэх профайлыг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={10}>Суулгасан цэнэглэх профайл алга.</TableEmpty>
              ) : (
                rows.map((p) => {
                  const isOpen = expanded === p._id;
                  return (
                    <React.Fragment key={p._id}>
                      <TR interactive onClick={() => setExpanded(isOpen ? null : p._id)}>
                        <TD className="font-mono text-xs font-medium">#{p.chargingProfileId}</TD>
                        <TD>
                          <StationName id={p.chargePointId} />
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
                        <TD className="text-xs">
                          {p.stackLevel ?? 0}
                        </TD>
                        <TD className="text-xs">{summarise(p.chargingSchedule)}</TD>
                        <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                          {p.validFrom || p.validTo
                            ? `${p.validFrom ? formatDateTime(p.validFrom) : '—'} → ${p.validTo ? formatDateTime(p.validTo) : '—'}`
                            : 'Байнга'}
                        </TD>
                        <TD className="text-xs text-[var(--color-fg-muted)]">
                          {formatRelative(p.createdAt)}
                        </TD>
                        <TD className="text-xs text-[var(--color-brand)]">
                          {isOpen ? 'Хураах' : 'Хуваарь'}
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
            label="профайл"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !debouncedCp ? (
          <EmptyState
            icon={<SlidersHorizontal className="h-8 w-8" />}
            title="Цэнэглэх профайл алга"
            description="Станцын командын самбараас «Цэнэглэх профайл тохируулах» командаар суулгана уу."
          />
        ) : null}
      </Card>
    </>
  );
}
