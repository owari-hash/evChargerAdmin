'use client';

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Car,
  ChevronRight,
  CreditCard,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import type { DriverListItem, Paginated } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, Select } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { StatCard, StatGrid } from '@/components/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { IdTagsView } from '../id-tags/id-tags-view';
import { DriverModal } from './driver-modal';

export function DriversView({
  canEdit,
  initialTab = 'drivers',
}: {
  canEdit: boolean;
  initialTab?: string;
}) {
  const [activeTab, setActiveTab] = React.useState<'drivers' | 'rfid'>(
    initialTab === 'rfid' ? 'rfid' : 'drivers',
  );

  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState<'all' | 'active' | 'blocked'>('all');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);

  const [creatingDriver, setCreatingDriver] = React.useState(false);
  const [editingDriver, setEditingDriver] = React.useState<DriverListItem | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const key = apiUrl('drivers', { search: debounced, status, page, limit });
  const { data, isLoading, mutate, isValidating } = useSWR<Paginated<DriverListItem>>(
    activeTab === 'drivers' ? key : null,
    fetcher,
    { keepPreviousData: true },
  );

  const drivers = data?.data ?? [];
  const total = data?.total ?? 0;

  // Compute page totals
  const totalBalance = drivers.reduce((sum, d) => sum + (d.wallet?.balance ?? 0), 0);
  const totalSessions = drivers.reduce((sum, d) => sum + d.sessionsCount, 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <Users className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Жолооч ба RFID карт
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--color-fg-muted)]">
            Цэнэглэгч ашиглагч жолооч нарын бүртгэл, хэтэвч болон холбогдсон RFID картын удирдлага
          </p>
        </div>

        {/* Tab selection */}
        <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('drivers')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'drivers'
                ? 'bg-[var(--color-surface)] text-[var(--color-fg)] shadow-xs'
                : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Жолооч нар
            <span className="ml-1 rounded-full bg-[var(--color-border)] px-1.5 py-0.2 text-[10px]">
              {total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rfid')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'rfid'
                ? 'bg-[var(--color-surface)] text-[var(--color-fg)] shadow-xs'
                : 'text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            RFID картууд
          </button>
        </div>
      </div>

      {activeTab === 'rfid' ? (
        /* RFID Cards Tab (Preserves existing full RFID management inside Drivers) */
        <IdTagsView canEdit={canEdit} initialSearch="" />
      ) : (
        /* Drivers Directory Tab */
        <>
          {/* Quick Stats */}
          <StatGrid>
            <StatCard
              label="Нийт бүртгэлтэй жолооч"
              value={formatNumber(total)}
              sub="Системд бүртгэлтэй хэрэглэгчид"
              icon={Users}
              tone="brand"
            />
            <StatCard
              label="Энэ хуудасны хэтэвчний үлдэгдэл"
              value={formatMoney(totalBalance)}
              sub="Жолооч нарын нийт үлдэгдэл"
              icon={Wallet}
              tone="ok"
            />
            <StatCard
              label="Энэ хуудасны нийт цэнэглэлт"
              value={formatNumber(totalSessions)}
              sub="Хийгдсэн цэнэглэлтийн тоо"
              icon={Car}
              tone="info"
            />
          </StatGrid>

          {/* Filter Bar */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                <div className="relative min-w-[220px] flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
                  <Input
                    type="search"
                    placeholder="Нэр, утас, имэйл, RFID карт, машинаар хайх..."
                    className="pl-9 h-9 text-xs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'blocked')}
                  options={[
                    { value: 'all', label: 'Төлөв: Бүгд' },
                    { value: 'active', label: 'Зөвхөн идэвхтэй' },
                    { value: 'blocked', label: 'Түгжигдсэн' },
                  ]}
                  className="w-44 text-xs"
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => mutate()}
                  disabled={isValidating}
                  title="Шинэчлэх"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {canEdit ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCreatingDriver(true)}
                  className="shrink-0 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Шинэ жолооч бүртгэх
                </Button>
              ) : null}
            </div>
          </Card>

          {/* Drivers Table */}
          <Card className="overflow-hidden">
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH className="w-10">№</TH>
                    <TH>Жолооч</TH>
                    <TH>Утас / Имэйл</TH>
                    <TH>Тээврийн хэрэгсэл</TH>
                    <TH className="text-right">Хэтэвч үлдэгдэл</TH>
                    <TH>RFID карт</TH>
                    <TH className="text-right">Цэнэглэлт</TH>
                    <TH>Төлөв</TH>
                    <TH className="text-right">Үйлдэл</TH>
                  </TR>
                </THead>
                <TBody>
                  {isLoading && drivers.length === 0 ? (
                    <TableLoading colSpan={9} rows={8} />
                  ) : drivers.length === 0 ? (
                    <TableEmpty colSpan={9}>Жолоочийн бүртгэл олдсонгүй</TableEmpty>
                  ) : (
                    drivers.map((d, index) => {
                      const rowNum = (page - 1) * limit + index + 1;
                      return (
                        <TR key={d.id} className="group hover:bg-[var(--color-surface-2)]">
                          <TD className="font-mono text-xs text-[var(--color-fg-subtle)] border-r border-[var(--color-border)]">
                            {rowNum}
                          </TD>

                          {/* Driver Name with link to detail */}
                          <TD>
                            <Link
                              href={`/drivers/${d.id}`}
                              className="font-semibold text-xs text-[var(--color-fg)] group-hover:text-[var(--color-brand)] transition flex items-center gap-1.5"
                            >
                              {d.name}
                              <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                            </Link>
                            <p className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
                              Бүртгүүлсэн: {formatDateTime(d.createdAt).split(' ')[0]}
                            </p>
                          </TD>

                          {/* Phone / Email */}
                          <TD>
                            <p className="font-mono text-xs font-medium text-[var(--color-fg)]">
                              {d.phone || '—'}
                            </p>
                            {d.email ? (
                              <p className="text-[11px] text-[var(--color-fg-subtle)] truncate max-w-[160px]">
                                {d.email}
                              </p>
                            ) : null}
                          </TD>

                          {/* Vehicle */}
                          <TD>
                            {d.vehicleBrand || d.vehicleModel ? (
                              <p className="text-xs font-medium text-[var(--color-fg)]">
                                {[d.vehicleBrand, d.vehicleModel].filter(Boolean).join(' ')}
                              </p>
                            ) : (
                              <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                            )}
                          </TD>

                          {/* Wallet balance */}
                          <TD className="text-right">
                            <span className="font-mono text-xs font-bold text-[var(--color-fg)]">
                              {formatMoney(d.wallet.balance)}
                            </span>
                            <p className="text-[10px] text-[var(--color-fg-subtle)]">
                              Нийт: {formatMoney(d.wallet.totalSpent)}
                            </p>
                          </TD>

                          {/* RFID Cards */}
                          <TD>
                            <div className="flex flex-wrap items-center gap-1">
                              {d.idTag ? (
                                <Badge tone="info" className="font-mono text-[10px]">
                                  {d.idTag}
                                </Badge>
                              ) : null}
                              {d.rfidCardsCount > 1 ? (
                                <Badge tone="idle" className="text-[10px]">
                                  +{d.rfidCardsCount - 1} карт
                                </Badge>
                              ) : null}
                              {!d.idTag && d.rfidCardsCount === 0 ? (
                                <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                              ) : null}
                            </div>
                          </TD>

                          {/* Sessions */}
                          <TD className="text-right">
                            <span className="font-mono text-xs font-medium text-[var(--color-fg)]">
                              {formatNumber(d.sessionsCount)} удаа
                            </span>
                            <p className="text-[10px] text-[var(--color-fg-subtle)] font-mono">
                              {d.totalEnergyKwh} кВт.ц
                            </p>
                          </TD>

                          {/* Status */}
                          <TD>
                            <div className="flex flex-col gap-1 items-start">
                              {d.isActive ? (
                                <Badge tone="ok">Идэвхтэй</Badge>
                              ) : (
                                <Badge tone="danger">Түгжигдсэн</Badge>
                              )}
                              {d.isInternal ? (
                                <Badge tone="brand" className="text-[10px]">Дотоод үнэгүй</Badge>
                              ) : null}
                            </div>
                          </TD>

                          {/* Actions */}
                          <TD className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingDriver(d)}
                                  title="Засах"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                              <Link
                                href={`/drivers/${d.id}`}
                                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-xs font-medium text-[var(--color-fg)]"
                              >
                                Дэлгэрэнгүй
                              </Link>
                            </div>
                          </TD>
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
                label="жолооч"
              />
            ) : null}
          </Card>
        </>
      )}

      {/* Driver Create/Edit Modals */}
      {creatingDriver ? (
        <DriverModal
          onClose={() => setCreatingDriver(false)}
          onSaved={() => mutate()}
        />
      ) : null}

      {editingDriver ? (
        <DriverModal
          driver={editingDriver}
          onClose={() => setEditingDriver(null)}
          onSaved={() => mutate()}
        />
      ) : null}
    </div>
  );
}
