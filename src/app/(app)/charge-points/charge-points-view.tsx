'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Plus, RefreshCw, Search, Zap } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatNumber, formatRelative } from '@/lib/format';
import type { ChargePoint, Paginated } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from '@/components/ui/primitives';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { ConnectorStatusBadge, OnlineBadge, RegistrationBadge } from '@/components/ui/status';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { CreateChargePointModal } from './create-charge-point-modal';

export function ChargePointsView({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [online, setOnline] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [creating, setCreating] = React.useState(false);

  // Debounce so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const key = apiUrl('charge-points', { search: debounced, online, page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<ChargePoint>>(key, fetcher, {
    refreshInterval: 15_000,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Цэнэглэх станц"
        description="CSMS-д бүртгэлтэй бүх цэнэглэх станц, тэдгээрийн холболтын байдал."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void mutate()} aria-label="Шинэчлэх">
              <RefreshCw className="h-3.5 w-3.5" />
              Шинэчлэх
            </Button>
            {canEdit ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                Станц бүртгэх
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <FilterBar>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
            <Input
              className="pl-8"
              placeholder="Дугаар, нэр, үйлдвэрлэгч, загвараар хайх…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            className="w-auto"
            value={online}
            onChange={(e) => {
              setOnline(e.target.value);
              setPage(1);
            }}
            aria-label="Холболтын шүүлтүүр"
          >
            <option value="">Бүх төлөв</option>
            <option value="true">Зөвхөн онлайн</option>
            <option value="false">Зөвхөн офлайн</option>
          </Select>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Цэнэглэх станц</TH>
                <TH>Холболт</TH>
                <TH>Холбогч</TH>
                <TH>Үйлдвэрлэгч / загвар</TH>
                <TH>Программ</TH>
                <TH>Бүртгэл</TH>
                <TH align="right">Сүүлд холбогдсон</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={7} />
              ) : error ? (
                <TableEmpty colSpan={7}>Станцын мэдээлэл ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={7}>
                  {debounced || online ? 'Энэ шүүлтүүрт тохирох станц алга.' : 'Одоогоор станц бүртгэгдээгүй байна.'}
                </TableEmpty>
              ) : (
                rows.map((cp) => (
                  <TR key={cp.id}>
                    <TD>
                      <Link
                        href={`/charge-points/${encodeURIComponent(cp.id)}`}
                        className="font-medium hover:text-[var(--color-brand)] hover:underline"
                      >
                        {cp.id}
                      </Link>
                      {cp.name ? (
                        <p className="text-xs text-[var(--color-fg-muted)]">{cp.name}</p>
                      ) : null}
                    </TD>
                    <TD>
                      <OnlineBadge online={cp.isOnline} />
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {(cp.connectors ?? [])
                          .filter((c) => c.connectorId > 0)
                          .map((c) => (
                            <span key={c.connectorId} title={`${c.connectorId} дугаар холбогч`}>
                              <ConnectorStatusBadge status={c.status} />
                            </span>
                          ))}
                        {!(cp.connectors ?? []).some((c) => c.connectorId > 0) ? (
                          <span className="text-xs text-[var(--color-fg-subtle)]">
                            Мэдээлээгүй
                          </span>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="text-xs text-[var(--color-fg-muted)]">
                      {cp.chargePointVendor || cp.chargePointModel
                        ? `${cp.chargePointVendor ?? ''} ${cp.chargePointModel ?? ''}`.trim()
                        : '—'}
                    </TD>
                    <TD className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {cp.firmwareVersion ?? '—'}
                    </TD>
                    <TD>
                      <RegistrationBadge status={cp.registrationStatus} />
                    </TD>
                    <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                      {formatRelative(cp.lastSeenAt)}
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
            label="станц"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !debounced && !online && canEdit ? (
          <EmptyState
            icon={<Zap className="h-8 w-8" />}
            title="Одоогоор станц алга"
            description="Эндээс бүртгэх, эсвэл OCPP_ALLOW_ANONYMOUS идэвхтэй бол станц анх холбогдохдоо өөрөө бүртгэгдэнэ."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                Станц бүртгэх
              </Button>
            }
          />
        ) : null}
      </Card>

      {data ? (
        <p className="mt-3 text-xs text-[var(--color-fg-subtle)]">
          {formatNumber(data.total)} бүртгэлтэй · 15 секунд тутам шинэчилнэ
        </p>
      ) : null}

      <CreateChargePointModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => void mutate()}
      />
    </>
  );
}
