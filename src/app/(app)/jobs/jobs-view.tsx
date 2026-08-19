'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Cpu, RefreshCw } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import type { Job, Paginated } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, type Tone } from '@/components/ui/primitives';
import { Tabs, TabCount } from '@/components/ui/tabs';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { DIAGNOSTICS_STATUS, FIRMWARE_STATUS, mn } from '@/lib/mn';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

/**
 * Firmware and diagnostics jobs. Statuses come straight from the charge point's
 * FirmwareStatusNotification / DiagnosticsStatusNotification / LogStatusNotification.
 */
const STATUS_TONES: Record<string, Tone> = {
  Idle: 'idle',
  Downloaded: 'info',
  Downloading: 'info',
  DownloadFailed: 'danger',
  DownloadScheduled: 'idle',
  DownloadPaused: 'warn',
  InstallationFailed: 'danger',
  Installing: 'info',
  Installed: 'ok',
  InstallRebooting: 'warn',
  InstallScheduled: 'idle',
  InstallVerificationFailed: 'danger',
  InvalidSignature: 'danger',
  SignatureVerified: 'ok',
  Uploaded: 'ok',
  UploadFailure: 'danger',
  Uploading: 'info',
  Accepted: 'ok',
  Rejected: 'danger',
  AcceptedCanceled: 'warn',
  NoDataAvailable: 'idle',
  BadMessage: 'danger',
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-[var(--color-fg-subtle)]">—</span>;
  // Firmware and diagnostics states share a badge; the dictionaries do not collide.
  return (
    <Badge tone={STATUS_TONES[status] ?? 'idle'}>
      {FIRMWARE_STATUS[status] ?? mn(DIAGNOSTICS_STATUS, status)}
    </Badge>
  );
}

export function JobsView() {
  const [tab, setTab] = React.useState<'firmware' | 'diagnostics'>('firmware');
  const [chargePointId, setChargePointId] = React.useState('');
  const [debouncedCp, setDebouncedCp] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCp(chargePointId);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [chargePointId]);

  // Paging resets in the tab handler below rather than in an effect, so page 3
  // of firmware never briefly applies to the diagnostics list.
  const selectTab = (next: 'firmware' | 'diagnostics') => {
    setTab(next);
    setPage(1);
  };

  const key = apiUrl(`jobs/${tab}`, { chargePointId: debouncedCp, page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<Job>>(key, fetcher, {
    refreshInterval: 20_000,
    keepPreviousData: true,
  });

  // Counts for the tab badges, fetched cheaply.
  const { data: firmwareCount } = useSWR<Paginated<Job>>(apiUrl('jobs/firmware', { limit: 1 }), fetcher);
  const { data: diagCount } = useSWR<Paginated<Job>>(apiUrl('jobs/diagnostics', { limit: 1 }), fetcher);

  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Программ хангамж ба лог"
        description="Программын шинэчлэлт, оношилгооны илгээлт, аюулгүй байдлын логийн хүсэлтүүд."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void mutate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Шинэчлэх
          </Button>
        }
      />

      <Card className="mb-4 overflow-hidden">
        <Tabs
          items={[
            {
              key: 'firmware',
              label: 'Программ хангамж',
              badge: <TabCount>{formatNumber(firmwareCount?.total ?? 0)}</TabCount>,
            },
            {
              key: 'diagnostics',
              label: 'Оношилгоо ба лог',
              badge: <TabCount>{formatNumber(diagCount?.total ?? 0)}</TabCount>,
            },
          ]}
          value={tab}
          onChange={(k) => selectTab(k as 'firmware' | 'diagnostics')}
        />
      </Card>

      <Card>
        <FilterBar>
          <Input
            className="w-auto min-w-[200px]"
            placeholder="Станцын дугаар"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Цэнэглэх станц</TH>
                <TH>Төрөл</TH>
                <TH>Төлөв</TH>
                <TH>Байршил</TH>
                <TH>Файл</TH>
                <TH align="right">Хүсэлтийн дугаар</TH>
                <TH>Товлосон</TH>
                <TH>Алдаа</TH>
                <TH align="right">Үүсгэсэн</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={9} />
              ) : error ? (
                <TableEmpty colSpan={9}>Ажлуудыг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={9}>
                  {tab === 'firmware' ? 'Программын шинэчлэлт бүртгэгдээгүй.' : 'Оношилгооны ажил бүртгэгдээгүй.'}
                </TableEmpty>
              ) : (
                rows.map((job) => (
                  <TR key={job._id}>
                    <TD>
                      <Link
                        href={`/charge-points/${encodeURIComponent(job.chargePointId)}`}
                        className="text-xs hover:text-[var(--color-brand)] hover:underline"
                      >
                        {job.chargePointId}
                      </Link>
                    </TD>
                    <TD className="text-xs font-medium">{job.kind}</TD>
                    <TD>
                      <StatusBadge status={job.status} />
                    </TD>
                    <TD className="max-w-[220px] truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                      {job.location ?? '—'}
                    </TD>
                    <TD className="max-w-[160px] truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                      {job.fileName ?? '—'}
                    </TD>
                    <TD align="right" className="font-mono text-xs">
                      {job.requestId ?? '—'}
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                      {job.retrieveDate ? formatDateTime(job.retrieveDate) : '—'}
                    </TD>
                    <TD className="max-w-[200px] truncate text-xs text-[var(--color-danger)]">
                      {job.error ?? ''}
                    </TD>
                    <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                      {formatRelative(job.createdAt)}
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
            label="ажил"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !debouncedCp ? (
          <EmptyState
            icon={<Cpu className="h-8 w-8" />}
            title={tab === 'firmware' ? 'Программын шинэчлэлт алга' : 'Оношилгооны ажил алга'}
            description="Станцын командын самбараас эхлүүлнэ үү."
          />
        ) : null}
      </Card>
    </>
  );
}
