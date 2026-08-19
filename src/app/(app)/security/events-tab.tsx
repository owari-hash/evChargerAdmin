'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import type { Paginated, SecurityEvent } from '@/lib/types';
import { Button, Card, EmptyState, Input, Select } from '@/components/ui/primitives';
import { SecurityCriticality } from '@/components/ui/status';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

interface Summary {
  byType: { _id: string; count: number; lastAt: string }[];
  unacknowledgedCritical: number;
}

export function SecurityEventsTab({ canOperate }: { canOperate: boolean }) {
  const [type, setType] = React.useState('');
  const [critical, setCritical] = React.useState('');
  const [acknowledged, setAcknowledged] = React.useState('');
  const [chargePointId, setChargePointId] = React.useState('');
  const [debouncedCp, setDebouncedCp] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [acking, setAcking] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCp(chargePointId);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [chargePointId]);

  const { data: summary } = useSWR<Summary>(apiUrl('security/events/summary'), fetcher, {
    refreshInterval: 60_000,
  });

  const key = apiUrl('security/events', {
    type,
    critical,
    acknowledged,
    chargePointId: debouncedCp,
    page,
    limit,
  });
  const { data, error, isLoading, mutate } = useSWR<Paginated<SecurityEvent>>(key, fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  async function acknowledge(id: string) {
    setAcking(id);
    try {
      await api.post(`security/events/${encodeURIComponent(id)}/acknowledge`);
      toast.success('Үйл явдлыг хүлээн зөвшөөрлөө');
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAcking(null);
    }
  }

  return (
    <>
      {summary?.byType?.length ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.byType.slice(0, 8).map((entry) => (
            <button
              key={entry._id}
              type="button"
              onClick={() => {
                setType(type === entry._id ? '' : entry._id);
                setPage(1);
              }}
              className={`rounded-xl border p-3 text-left transition ${
                type === entry._id
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
              }`}
            >
              <p className="truncate text-xs font-medium">{entry._id}</p>
              <p className="mt-1 text-lg font-semibold tnum">{formatNumber(entry.count)}</p>
              <p className="text-[11px] text-[var(--color-fg-subtle)]">
                last {formatRelative(entry.lastAt)}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      <Card>
        <FilterBar>
          <Input
            className="w-auto min-w-[180px]"
            placeholder="Станцын дугаар"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
          <Input
            className="w-auto min-w-[180px]"
            placeholder="Үйл явдлын төрөл"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-auto"
            value={critical}
            onChange={(e) => {
              setCritical(e.target.value);
              setPage(1);
            }}
            aria-label="Ноцтой байдал"
          >
            <option value="">Бүх түвшин</option>
            <option value="true">Зөвхөн ноцтой</option>
            <option value="false">Зөвхөн мэдээллийн</option>
          </Select>
          <Select
            className="w-auto"
            value={acknowledged}
            onChange={(e) => {
              setAcknowledged(e.target.value);
              setPage(1);
            }}
            aria-label="Хүлээн зөвшөөрөл"
          >
            <option value="">Бүх төлөв</option>
            <option value="false">Хүлээн зөвшөөрөөгүй</option>
            <option value="true">Хүлээн зөвшөөрсөн</option>
          </Select>
          {type || critical || acknowledged || chargePointId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setType('');
                setCritical('');
                setAcknowledged('');
                setChargePointId('');
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
                <TH>Хугацаа</TH>
                <TH>Төрөл</TH>
                <TH>Ноцтой байдал</TH>
                <TH>Цэнэглэх станц</TH>
                <TH>Техникийн мэдээлэл</TH>
                <TH>Хүлээн зөвшөөрсөн</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={7} />
              ) : error ? (
                <TableEmpty colSpan={7}>Аюулгүй байдлын үйл явдлыг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={7}>Энэ шүүлтүүрт тохирох үйл явдал алга.</TableEmpty>
              ) : (
                rows.map((event) => (
                  <TR key={event._id}>
                    <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                      {formatDateTime(event.timestamp)}
                    </TD>
                    <TD className="text-xs font-medium">{event.type}</TD>
                    <TD>
                      <SecurityCriticality critical={event.isCritical} />
                    </TD>
                    <TD>
                      <Link
                        href={`/charge-points/${encodeURIComponent(event.chargePointId)}`}
                        className="text-xs hover:text-[var(--color-brand)] hover:underline"
                      >
                        {event.chargePointId}
                      </Link>
                    </TD>
                    <TD className="max-w-[280px] truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                      {event.techInfo ?? '—'}
                    </TD>
                    <TD className="text-xs text-[var(--color-fg-muted)]">
                      {event.acknowledged ? (
                        <span title={formatDateTime(event.acknowledgedAt)}>
                          {event.acknowledgedBy ?? 'yes'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD align="right">
                      {canOperate && !event.acknowledged ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={acking === event._id}
                          onClick={() => void acknowledge(event._id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Хүлээн зөвшөөрөх
                        </Button>
                      ) : null}
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
            label="үйл явдал"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !type && !critical && !acknowledged && !debouncedCp ? (
          <EmptyState
            icon={<ShieldCheck className="h-8 w-8" />}
            title="Аюулгүй байдлын үйл явдал алга"
            description="Станцууд эдгээрийг SecurityEventNotification-оор мэдээлнэ. Хоосон байх нь сайн шинж."
          />
        ) : null}
      </Card>
    </>
  );
}
