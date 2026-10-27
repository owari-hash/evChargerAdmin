'use client';

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatAmount, formatDateTime, formatMoney, formatNumber, formatPhone } from '@/lib/format';
import type { DriverDetailResponse } from '@/lib/types';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';
import { StatCard, StatGrid } from '@/components/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty } from '@/components/ui/table';
import { ConfirmModal } from '@/components/ui/modal';
import { DriverModal } from '../driver-modal';
import { WalletAdjustModal } from '../wallet-adjust-modal';
import { BindTagModal } from '../bind-tag-modal';

export function DriverDetailView({
  driverId,
  canEdit,
  initialData,
}: {
  driverId: string;
  canEdit: boolean;
  initialData: DriverDetailResponse;
}) {
  const router = useRouter();
  const { data, mutate, isValidating } = useSWR<DriverDetailResponse>(
    apiUrl(`drivers/${driverId}`),
    fetcher,
    { fallbackData: initialData, revalidateOnFocus: true },
  );

  const detail = data ?? initialData;
  const d = detail.driver;
  const w = detail.wallet;

  const [editingDriver, setEditingDriver] = React.useState(false);
  const [adjustingWallet, setAdjustingWallet] = React.useState(false);
  const [bindingTag, setBindingTag] = React.useState(false);
  const [unbindingTag, setUnbindingTag] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleUnbindTag(idTag: string) {
    setBusy(true);
    try {
      await api.del(`drivers/${driverId}/rfid/${encodeURIComponent(idTag)}`);
      toast.success('RFID картыг амжилттай салгалаа');
      setUnbindingTag(null);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button & Action Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/drivers"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition"
            title="Жолооч нарын жагсаалт руу буцах"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-fg)]">
                {d.name}
              </h1>
              {d.isActive ? (
                <Badge tone="ok">Идэвхтэй</Badge>
              ) : (
                <Badge tone="danger">Түгжигдсэн</Badge>
              )}
              {d.isInternal ? (
                <Badge tone="brand">Дотоод үнэгүй</Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-fg-muted)] flex items-center gap-2">
              <span className="font-mono">{d.phone ? formatPhone(d.phone) : 'Утасгүй'}</span>
              {d.email ? <span>· {d.email}</span> : null}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mutate()}
            disabled={isValidating}
            title="Шинэчлэх"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
          </Button>

          {canEdit ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAdjustingWallet(true)}
                className="gap-1.5"
              >
                <Coins className="h-3.5 w-3.5" />
                Хэтэвч цэнэглэх / засах
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBindingTag(true)}
                className="gap-1.5"
              >
                <CreditCard className="h-3.5 w-3.5" />
                RFID карт холбох
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setEditingDriver(true)}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Мэдээлэл засах
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* KPI Cards */}
      <StatGrid>
        <StatCard
          label="Хэтэвчний үлдэгдэл"
          value={formatMoney(w.balance)}
          sub={`Төлөв: ${w.status === 'ACTIVE' ? 'Хэвийн' : 'Түгжсэн'}`}
          icon={Wallet}
          tone={w.balance > 0 ? 'ok' : 'idle'}
        />
        <StatCard
          label="Нийт цэнэглэлтэд зарцуулсан"
          value={formatMoney(detail.stats.totalCost)}
          sub={`Нийт дансаа цэнэглэсэн: ${formatMoney(w.totalToppedUp)}`}
          icon={Coins}
          tone="brand"
        />
        <StatCard
          label="Нийт цэнэглэсэн тоо"
          value={`${formatNumber(detail.stats.totalSessions)} удаа`}
          sub="Бүх хугацааны цэнэглэлт"
          icon={Zap}
          tone="info"
        />
        <StatCard
          label="Нийт авсан эрчим хүч"
          value={`${detail.stats.totalEnergyKwh} кВт.ц`}
          sub="Нийт зарцуулсан цахилгаан"
          icon={Car}
          tone="ok"
        />
      </StatGrid>

      {/* Main Grid: Left Details & Right Sessions/Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Profile & Vehicle & Wallet Details */}
        <div className="space-y-6 lg:col-span-1">
          {/* Driver Profile & Vehicle Card */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-[var(--color-fg-subtle)]" />
              Хувийн & Тээврийн хэрэгслийн мэдээлэл
            </h3>

            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-[var(--color-fg-subtle)]">Бүтэн нэр:</dt>
                <dd className="font-semibold text-[var(--color-fg)] mt-0.5">{d.name}</dd>
              </div>

              <div>
                <dt className="text-[var(--color-fg-subtle)]">Утасны дугаар:</dt>
                <dd className="font-mono font-normal text-[var(--color-fg)] mt-0.5">{d.phone ? formatPhone(d.phone) : '—'}</dd>
              </div>

              <div>
                <dt className="text-[var(--color-fg-subtle)]">Имэйл хаяг:</dt>
                <dd className="font-medium text-[var(--color-fg)] mt-0.5">{d.email || '—'}</dd>
              </div>

              <div>
                <dt className="text-[var(--color-fg-subtle)]">Тээврийн хэрэгсэл:</dt>
                <dd className="font-medium text-[var(--color-fg)] mt-0.5">
                  {d.vehicleBrand || d.vehicleModel
                    ? [d.vehicleBrand, d.vehicleModel].filter(Boolean).join(' ')
                    : 'Бүртгүүлээгүй'}
                </dd>
              </div>

              <div>
                <dt className="text-[var(--color-fg-subtle)]">И-Баримт хэрэглэгчийн код:</dt>
                <dd className="font-mono font-medium text-[var(--color-fg)] mt-0.5">
                  {d.ebarimtCustomerNo || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-[var(--color-fg-subtle)]">Бүртгүүлсэн огноо:</dt>
                <dd className="text-[var(--color-fg)] mt-0.5">{formatDateTime(d.createdAt)}</dd>
              </div>

              <div>
                <dt className="text-[var(--color-fg-subtle)]">Сүүлд нэвтэрсэн:</dt>
                <dd className="text-[var(--color-fg)] mt-0.5">
                  {d.lastLoginAt ? formatDateTime(d.lastLoginAt) : 'Нэвтрээгүй'}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Wallet Summary Card */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[var(--color-fg-subtle)]" />
                Хэтэвчний дэлгэрэнгүй
              </h3>
              <Badge tone={w.balance > 0 ? 'ok' : 'idle'}>
                {formatMoney(w.balance)}
              </Badge>
            </div>

            <dl className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <dt className="text-[var(--color-fg-subtle)]">Данс цэнэглэсэн нийт дүн:</dt>
                <dd className="font-mono font-semibold text-[var(--color-fg)]">{formatMoney(w.totalToppedUp)}</dd>
              </div>

              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <dt className="text-[var(--color-fg-subtle)]">Цэнэглэлтэд суутгасан дүн:</dt>
                <dd className="font-mono font-semibold text-[var(--color-fg)]">{formatMoney(w.totalSpent)}</dd>
              </div>

              {w.lastTopUpAt ? (
                <div className="flex justify-between text-[11px]">
                  <dt className="text-[var(--color-fg-subtle)]">Сүүлд цэнэглэсэн:</dt>
                  <dd className="text-[var(--color-fg-muted)]">{formatDateTime(w.lastTopUpAt)}</dd>
                </div>
              ) : null}

              {w.lastSpendAt ? (
                <div className="flex justify-between text-[11px]">
                  <dt className="text-[var(--color-fg-subtle)]">Сүүлд зарцуулсан:</dt>
                  <dd className="text-[var(--color-fg-muted)]">{formatDateTime(w.lastSpendAt)}</dd>
                </div>
              ) : null}
            </dl>

            {canEdit ? (
              <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdjustingWallet(true)}
                  className="w-full text-xs"
                >
                  Үлдэгдэл нэмэх / тохируулах
                </Button>
              </div>
            ) : null}
          </Card>
        </div>

        {/* Right Column: Associated RFID Cards & Charging History */}
        <div className="space-y-6 lg:col-span-2">
          {/* Associated RFID Cards Card */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[var(--color-fg-subtle)]" />
                  Холбогдсон RFID картууд
                </h3>
                <p className="text-xs text-[var(--color-fg-muted)]">
                  Энэ жолоочийн хэтэвчтэй холбогдсон картууд ({detail.rfidCards.length})
                </p>
              </div>

              {canEdit ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBindingTag(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Шинэ карт холбох
                </Button>
              ) : null}
            </div>

            {detail.rfidCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-fg-subtle)]">
                Энэ жолоочид холбосон RFID карт одоогоор алга байна.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {detail.rfidCards.map((card) => (
                  <div
                    key={card.idTag}
                    className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[var(--color-fg)]">
                            {card.idTag}
                          </span>
                          {card.isPrimary ? (
                            <Badge tone="brand" className="text-[10px]">Үндсэн</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                          {card.label || 'Шошгогүй карт'}
                        </p>
                      </div>

                      <Badge tone={card.status === 'Accepted' ? 'ok' : 'danger'}>
                        {card.status === 'Accepted' ? 'Зөвшөөрсөн' : card.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-subtle)] pt-2 border-t border-[var(--color-border)]">
                      <span>
                        {card.isInternal ? 'Үнэгүй дотоод карт' : 'Хэтэвчнээс төлнө'}
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => setUnbindingTag(card.idTag)}
                          className="text-[var(--color-danger)] hover:underline"
                        >
                          Салгах
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Charging Sessions Card */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3.5 sm:px-5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[var(--color-brand)]" />
                  Сүүлийн цэнэглэлтүүд
                </h3>
                <p className="text-xs text-[var(--color-fg-muted)]">
                  Жолоочийн хийсэн цэнэглэлтийн түүх
                </p>
              </div>
              <span className="font-mono text-xs text-[var(--color-fg-subtle)]">
                {detail.stats.totalSessions} цэнэглэлтээс
              </span>
            </div>

            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Цэнэглэлт ID</TH>
                    <TH>Станц / Холбогч</TH>
                    <TH>Цаг хугацаа</TH>
                    <TH align="right" className="text-right px-3">Хэмжээ</TH>
                    <TH align="right" className="text-right px-3">Төлбөр</TH>
                    <TH>Төлөв</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.recentSessions.length === 0 ? (
                    <TableEmpty colSpan={6}>Цэнэглэлтийн түүх олдсонгүй</TableEmpty>
                  ) : (
                    detail.recentSessions.map((s) => (
                      <TR key={s.id}>
                        <TD className="font-mono text-xs font-normal text-[var(--color-fg)]">
                          <Link
                            href={`/transactions/${s.id}`}
                            className="hover:text-[var(--color-brand)] underline-offset-2 hover:underline"
                          >
                            #{s.id}
                          </Link>
                        </TD>

                        <TD>
                          <p className="text-xs font-normal text-[var(--color-fg)]">{s.stationName}</p>
                          <p className="text-[11px] text-[var(--color-fg-subtle)] font-mono">Холбогч #{s.connectorId}</p>
                        </TD>

                        <TD className="text-xs text-[var(--color-fg-muted)] font-mono">
                          {formatDateTime(s.startTimestamp)}
                        </TD>

                        <TD align="right" className="text-right font-mono text-xs font-normal text-[var(--color-fg)] px-3">
                          {s.energyKwh} кВт.ц
                        </TD>

                        <TD align="right" className="text-right font-mono text-xs font-normal text-[var(--color-fg)] px-3">
                          {formatAmount(s.cost)}
                        </TD>

                        <TD>
                          <Badge
                            tone={
                              s.status === 'Completed'
                                ? 'ok'
                                : s.status === 'Active'
                                  ? 'brand'
                                  : 'idle'
                            }
                          >
                            {s.status === 'Completed'
                              ? 'Дууссан'
                              : s.status === 'Active'
                                ? 'Цэнэглэж буй'
                                : s.status}
                          </Badge>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </TableWrap>
          </Card>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editingDriver ? (
        <DriverModal
          driver={{
            id: d.id,
            name: d.name,
            phone: d.phone,
            email: d.email,
            vehicleBrand: d.vehicleBrand,
            vehicleModel: d.vehicleModel,
            ebarimtCustomerNo: d.ebarimtCustomerNo,
            isActive: d.isActive,
            isInternal: d.isInternal,
            idTag: d.idTag,
            wallet: {
              balance: w.balance,
              totalToppedUp: w.totalToppedUp,
              totalSpent: w.totalSpent,
              status: w.status,
            },
            rfidCardsCount: detail.rfidCards.length,
            sessionsCount: detail.stats.totalSessions,
            totalEnergyKwh: detail.stats.totalEnergyKwh,
            createdAt: d.createdAt,
            lastLoginAt: d.lastLoginAt,
          }}
          onClose={() => setEditingDriver(false)}
          onSaved={() => mutate()}
        />
      ) : null}

      {/* Wallet Adjust Modal */}
      {adjustingWallet ? (
        <WalletAdjustModal
          driverId={driverId}
          driverName={d.name}
          currentBalance={w.balance}
          onClose={() => setAdjustingWallet(false)}
          onSaved={() => mutate()}
        />
      ) : null}

      {/* Bind RFID Tag Modal */}
      {bindingTag ? (
        <BindTagModal
          driverId={driverId}
          driverName={d.name}
          onClose={() => setBindingTag(false)}
          onSaved={() => mutate()}
        />
      ) : null}

      {/* Confirm Unbind RFID Tag Modal */}
      {unbindingTag ? (
        <ConfirmModal
          open
          onClose={() => setUnbindingTag(null)}
          onConfirm={() => handleUnbindTag(unbindingTag)}
          title="RFID карт салгах уу?"
          message={`${unbindingTag} картын энэ жолоочтой холбогдсон хэтэвчний холбоосыг салгах гэж байна.`}
          confirmLabel="Салгах"
          tone="danger"
          loading={busy}
        />
      ) : null}
    </div>
  );
}
