'use client';

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Car,
  ChevronRight,
  CreditCard,
  Menu,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import type { DriverDetailResponse, DriverListItem, Paginated } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, Select } from '@/components/ui/primitives';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { StatCard, StatGrid } from '@/components/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { IdTagsView } from '../id-tags/id-tags-view';
import { DriverModal } from './driver-modal';

function formatPhone(phone?: string | null): string {
  if (!phone) return '—';
  let clean = phone.trim();
  if (clean.startsWith('+976')) clean = clean.slice(4);
  else if (clean.startsWith('976') && clean.length > 8) clean = clean.slice(3);
  return clean || '—';
}

function formatAmount(val?: number | null): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  const [deletingDriver, setDeletingDriver] = React.useState<DriverListItem | null>(null);
  const [viewingSessionsDriver, setViewingSessionsDriver] = React.useState<DriverListItem | null>(null);
  const [busyDelete, setBusyDelete] = React.useState(false);

  const { data: detailData, isLoading: loadingDetail } = useSWR<DriverDetailResponse>(
    viewingSessionsDriver ? apiUrl(`drivers/${encodeURIComponent(viewingSessionsDriver.id)}`) : null,
    fetcher,
  );

  async function removeDriver() {
    if (!deletingDriver) return;
    setBusyDelete(true);
    try {
      await api.del(`drivers/${encodeURIComponent(deletingDriver.id)}`);
      toast.success(`${deletingDriver.name || deletingDriver.phone || 'Жолооч'} амжилттай устгагдлаа`);
      setDeletingDriver(null);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyDelete(false);
    }
  }

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

  // Compute totals across all pages if provided by backend, fallback to current page
  const totalBalance =
    data?.summary?.totalBalance ?? drivers.reduce((sum, d) => sum + (d.wallet?.balance ?? 0), 0);
  const totalSessions =
    data?.summary?.totalSessions ?? drivers.reduce((sum, d) => sum + d.sessionsCount, 0);

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
              label="Нийт хэтэвчний үлдэгдэл"
              value={formatAmount(totalBalance)}
              sub="Бүх жолооч нарын нийт үлдэгдэл"
              icon={Wallet}
              tone="ok"
            />
            <StatCard
              label="Нийт цэнэглэлт"
              value={formatNumber(totalSessions)}
              sub="Системийн нийт цэнэглэлтийн тоо"
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
                    <TH className="w-10 text-center">№</TH>
                    <TH className="text-center">Жолооч</TH>
                    <TH className="text-center">Утас</TH>
                    <TH className="text-center">Имэйл</TH>
                    <TH className="text-center">Тээврийн хэрэгсэл</TH>
                    <TH className="text-center">RFID карт</TH>
                    <TH className="text-center">Цэнэглэлт</TH>
                    <TH align="right" className="text-right px-3">Хэтэвч үлдэгдэл</TH>
                    <TH className="text-center">Төрөл</TH>
                    <TH className="text-center">Төлөв</TH>
                    <TH className="text-center">Үйлдэл</TH>
                  </TR>
                </THead>
                <TBody>
                  {isLoading && drivers.length === 0 ? (
                    <TableLoading colSpan={11} rows={8} />
                  ) : drivers.length === 0 ? (
                    <TableEmpty colSpan={11}>Жолоочийн бүртгэл олдсонгүй</TableEmpty>
                  ) : (
                    drivers.map((d, index) => {
                      const rowNum = (page - 1) * limit + index + 1;
                      const isEven = index % 2 === 1;
                      return (
                        <TR key={d.id} className="group">
                          <TD className="font-mono text-xs font-normal text-[var(--color-fg-subtle)] border-r border-[var(--color-border)] text-center py-1.5">
                            {rowNum}
                          </TD>

                          {/* Driver Name (starts from start / left-aligned) */}
                          <TD align="left" className="border-r border-[var(--color-border)] py-1.5 px-3 text-left">
                            <Link
                              href={`/drivers/${d.id}`}
                              className="text-xs font-normal text-[var(--color-fg)] hover:text-[var(--color-brand)] hover:underline transition"
                            >
                              {d.name}
                            </Link>
                          </TD>

                          {/* Phone */}
                          <TD align="center" className="border-r border-[var(--color-border)] py-1.5 text-center">
                            <span className="font-mono text-xs font-normal text-[var(--color-fg)]">
                              {formatPhone(d.phone)}
                            </span>
                          </TD>

                          {/* Email (left start) */}
                          <TD align="left" className="border-r border-[var(--color-border)] py-1.5 px-3 text-left">
                            <span className="text-xs font-normal text-[var(--color-fg-subtle)] truncate max-w-[170px] inline-block">
                              {d.email || '—'}
                            </span>
                          </TD>

                          {/* Vehicle */}
                          <TD align="center" className="border-r border-[var(--color-border)] py-1.5 text-center">
                            {d.vehicleBrand || d.vehicleModel ? (
                              <span className="text-xs font-normal text-[var(--color-fg)]">
                                {[d.vehicleBrand, d.vehicleModel].filter(Boolean).join(' ')}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                            )}
                          </TD>

                          {/* RFID Cards */}
                          <TD align="center" className="border-r border-[var(--color-border)] py-1.5 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {d.idTag ? (
                                <Badge tone="info" className="font-mono text-[10px] font-normal">
                                  {d.idTag}
                                </Badge>
                              ) : null}
                              {d.rfidCardsCount > 1 ? (
                                <Badge tone="idle" className="text-[10px] font-normal">
                                  +{d.rfidCardsCount - 1} карт
                                </Badge>
                              ) : null}
                              {!d.idTag && d.rfidCardsCount === 0 ? (
                                <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                              ) : null}
                            </div>
                          </TD>

                          {/* Sessions */}
                          <TD align="center" className="border-r border-[var(--color-border)] py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => setViewingSessionsDriver(d)}
                              className="inline-flex items-center justify-center font-mono text-xs font-normal text-[var(--color-fg)] underline underline-offset-2 hover:opacity-75 transition cursor-pointer"
                              title="Цэнэглэлтийн мэдээлэл харах"
                            >
                              {formatNumber(d.sessionsCount)} удаа
                            </button>
                          </TD>

                          {/* Wallet balance (Amount related field into end, right-aligned, formatted 123,123.00 without tugrug) */}
                          <TD align="right" className="border-r border-[var(--color-border)] py-1.5 px-3 text-right">
                            <span className="font-mono text-xs font-normal text-[var(--color-fg)]">
                              {formatAmount(d.wallet.balance)}
                            </span>
                          </TD>

                          {/* Төрөл (SEPARATE) */}
                          <TD align="center" className="border-r border-[var(--color-border)] py-1.5 text-center">
                            {d.isInternal ? (
                              <Badge tone="brand" className="font-normal">Дотоод</Badge>
                            ) : (
                              <Badge tone="idle" className="font-normal">Энгийн</Badge>
                            )}
                          </TD>

                          {/* Төлөв (SEPARATE) */}
                          <TD align="center" className="border-r border-[var(--color-border)] py-1.5 text-center">
                            {d.isActive ? (
                              <Badge tone="ok" className="font-normal">Идэвхтэй</Badge>
                            ) : (
                              <Badge tone="danger" className="font-normal">Түгжигдсэн</Badge>
                            )}
                          </TD>

                          {/* Actions */}
                          <TD align="center" className="py-1.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingDriver(d)}
                                  title="Засах"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              <Link
                                href={`/drivers/${d.id}`}
                                title="Дэлгэрэнгүй харах"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition"
                              >
                                <Menu className="h-3.5 w-3.5" />
                              </Link>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => setDeletingDriver(d)}
                                  title="Устгах"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
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

      <ConfirmModal
        open={deletingDriver !== null}
        onClose={() => setDeletingDriver(null)}
        onConfirm={() => void removeDriver()}
        loading={busyDelete}
        title="Жолоочийг устгах уу?"
        confirmLabel="Устгах"
        message={
          <>
            <span className="block">
              <span className="font-semibold text-[var(--color-fg)]">
                {deletingDriver?.name || deletingDriver?.phone}
              </span>{' '}
              бүртгэлийг системээс бүрмөсөн устгах уу?
            </span>
            <span className="mt-2 block text-xs text-[var(--color-fg-subtle)]">
              Холбогдсон RFID картуудын холболт цуцлагдана.
            </span>
          </>
        }
      />

      <Modal
        open={viewingSessionsDriver !== null}
        onClose={() => setViewingSessionsDriver(null)}
        title="Цэнэглэлтийн мэдээлэл"
        description={`${viewingSessionsDriver?.name || 'Жолооч'} (${viewingSessionsDriver?.phone || ''})`}
        size="md"
      >
        <div className="space-y-4 py-1">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-center">
            <div>
              <p className="text-[11px] text-[var(--color-fg-muted)]">Нийт цэнэглэлт</p>
              <p className="font-mono text-sm font-bold text-[var(--color-fg)]">
                {viewingSessionsDriver?.sessionsCount ?? 0} удаа
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--color-fg-muted)]">Нийт эрчим хүч</p>
              <p className="font-mono text-sm font-bold text-[var(--color-brand)]">
                {viewingSessionsDriver?.totalEnergyKwh ?? 0} кВт.ц
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--color-fg-muted)]">Хэтэвчний үлдэгдэл</p>
              <p className="font-mono text-sm font-bold text-[var(--color-fg)]">
                {formatMoney(viewingSessionsDriver?.wallet.balance ?? 0)}
              </p>
            </div>
          </div>

          {/* Recent Sessions list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--color-fg)]">
                Сүүлийн цэнэглэлтүүд
              </h4>
              {viewingSessionsDriver ? (
                <Link
                  href={`/drivers/${viewingSessionsDriver.id}`}
                  onClick={() => setViewingSessionsDriver(null)}
                  className="text-xs font-medium text-[var(--color-brand)] hover:underline flex items-center gap-1"
                >
                  Бүх түүхийг харах <ChevronRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>

            {loadingDetail ? (
              <div className="py-8 text-center text-xs text-[var(--color-fg-subtle)]">
                Уншиж байна…
              </div>
            ) : detailData?.recentSessions?.length ? (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {detailData.recentSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 text-xs hover:bg-[var(--color-surface-2)] transition">
                    <div>
                      <p className="font-medium text-[var(--color-fg)]">
                        {s.stationName} <span className="text-[var(--color-fg-muted)]">#{s.id}</span>
                      </p>
                      <p className="text-[10px] text-[var(--color-fg-subtle)] font-mono">
                        {s.startTimestamp ? formatDateTime(s.startTimestamp) : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-[var(--color-fg)]">
                        {s.energyKwh} кВт.ц
                      </p>
                      <p className="text-[10px] text-[var(--color-fg-subtle)] font-mono">
                        {formatMoney(s.cost)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[var(--color-fg-subtle)] rounded-xl border border-dashed border-[var(--color-border)]">
                Цэнэглэлтийн түүх байхгүй байна.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
