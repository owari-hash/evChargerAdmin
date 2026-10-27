'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { Banknote, Building2, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatAmount, formatDate, formatMoney, formatNumber, formatWh } from '@/lib/format';
import type {
  Settlement,
  SettlementInput,
  SettlementSummary,
  SettlementSummaryRow,
} from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  DataRow,
  ErrorNote,
  Field,
  Input,
  Textarea,
} from '@/components/ui/primitives';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { DatePicker, DateRangePicker, toIsoDate, type DateRange } from '@/components/ui/date-picker';
import { FilterBar } from '@/components/ui/pagination';
import { StatCard, StatGrid } from '@/components/stat-card';
import {
  Table,
  TableEmpty,
  TableLoading,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Date helpers: the picker emits local `yyyy-mm-dd`; the API wants instants,
// with `to` exclusive, so a range ending on the 31st runs to the 1st 00:00.
// ---------------------------------------------------------------------------

function localDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function rangeStart(iso: string): string | undefined {
  return localDate(iso)?.toISOString();
}

function rangeEnd(iso: string): string | undefined {
  const d = localDate(iso);
  if (!d) return undefined;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
}

function currentMonth(): DateRange {
  const today = new Date();
  return {
    from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toIsoDate(today),
  };
}

/** Revalidates every settlements key: the summary and each open payout history. */
function isSettlementsKey(key: unknown): boolean {
  return typeof key === 'string' && key.startsWith(apiUrl('settlements'));
}

export function SettlementsView({ canAdmin }: { canAdmin: boolean }) {
  const [range, setRange] = React.useState<DateRange>(currentMonth);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState<SettlementSummaryRow | null>(null);

  const key = apiUrl('settlements/summary', {
    from: rangeStart(range.from),
    to: rangeEnd(range.to),
  });
  const { data, error, isLoading } = useSWR<SettlementSummary>(key, fetcher, {
    refreshInterval: REFRESH.config,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];
  const totals = data?.totals;
  const totalEnergyWh = rows.reduce((acc, r) => acc + r.period.energyWh, 0);
  const columns = 8;

  return (
    <>
      <StatGrid className="mb-4">
        <StatCard
          label="Борлуулалт"
          value={formatMoney(totals?.gross)}
          sub={`${formatNumber(totals?.sessions)} цэнэглэлт`}
        />
        <StatCard label="Eplug хураамж" value={formatMoney(totals?.fee)} tone="brand" />
        <StatCard label="Харилцагчид олгох" value={formatMoney(totals?.net)} sub="Сонгосон хугацаанд" />
        <StatCard
          label="Нийт үлдэгдэл"
          value={formatMoney(totals?.outstanding)}
          sub="Бүх хугацааны олгогдоогүй дүн"
          tone={(totals?.outstanding ?? 0) < 0 ? 'warn' : (totals?.outstanding ?? 0) > 0 ? 'info' : 'idle'}
        />
      </StatGrid>

      <Card>
        <FilterBar>
          <DateRangePicker
            className="w-full sm:w-auto min-w-0 sm:min-w-[15rem]"
            value={range}
            onChange={(r) => {
              // Clearing the picker falls back to the current month: a summary
              // always covers some period.
              setRange(r.from || r.to ? { from: r.from || r.to, to: r.to || r.from } : currentMonth());
            }}
            aria-label="Тооцооны хугацаа"
          />
          <p className="text-xs text-[var(--color-fg-muted)]">
            Жолоочийн төлбөр Eplug-ийн дансанд орно. Харилцагчид борлуулалтаас Eplug-ийн
            хураамжийг хассан дүнг олгоно.
          </p>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Харилцагч</TH>
                <TH>Цэнэглэлт</TH>
                <TH>Эрчим хүч</TH>
                <TH align="right" className="text-right px-3">Борлуулалт</TH>
                <TH align="right" className="text-right px-3">Eplug хураамж</TH>
                <TH align="right" className="text-right px-3">Харилцагчид олгох</TH>
                <TH align="right" className="text-right px-3">Нийт үлдэгдэл</TH>
                <TH>
                  <span className="sr-only">Үйлдэл</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={columns} />
              ) : error ? (
                <TableEmpty colSpan={columns}>Тооцооны мэдээлэл ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={columns}>Бүртгэлтэй харилцагч алга байна.</TableEmpty>
              ) : (
                <>
                  {rows.map((r) => {
                    const open = expanded === r.client.id;
                    return (
                      <React.Fragment key={r.client.id}>
                        <TR>
                          <TD align="left" className="whitespace-nowrap px-3 text-left">
                            <div className="inline-flex max-w-[280px] items-center gap-2">
                              <Building2 className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
                              <Link
                                href={`/clients/${encodeURIComponent(r.client.id)}`}
                                className="truncate font-normal hover:text-[var(--color-brand)] hover:underline"
                                title={r.client.name}
                              >
                                {r.client.name}
                              </Link>
                              {r.client.feePercent != null ? (
                                <Badge tone="idle" title="Үйлчилгээний хураамж">
                                  {r.client.feePercent}%
                                </Badge>
                              ) : null}
                              {!r.client.isActive ? <Badge tone="idle">Идэвхгүй</Badge> : null}
                            </div>
                          </TD>
                          <TD className="tnum">{formatNumber(r.period.sessions)}</TD>
                          <TD className="tnum whitespace-nowrap">{formatWh(r.period.energyWh)}</TD>
                          <TD align="right" className="tnum whitespace-nowrap font-mono font-normal text-right px-3">{formatAmount(r.period.gross)}</TD>
                          <TD align="right" className="tnum whitespace-nowrap font-mono font-normal text-right px-3 text-[var(--color-fg-muted)]">
                            {formatAmount(r.period.fee)}
                          </TD>
                          <TD align="right" className="tnum whitespace-nowrap font-mono font-normal text-right px-3">
                            {formatAmount(r.period.net)}
                          </TD>
                          <TD className="whitespace-nowrap">
                            <Outstanding value={r.outstanding} />
                            <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
                              {r.lastPaidAt ? `Сүүлд олгосон ${formatDate(r.lastPaidAt)}` : 'Олгоогүй'}
                            </div>
                          </TD>
                          <TD className="whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpanded(open ? null : r.client.id)}
                                aria-expanded={open}
                                aria-label={`${r.client.name} төлбөрийн түүх`}
                              >
                                {open ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                Түүх
                              </Button>
                              {canAdmin ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setPaying(r)}
                                  title="Төлбөр бүртгэх"
                                  aria-label={`${r.client.name}-д олгосон төлбөр бүртгэх`}
                                >
                                  <Banknote className="h-3.5 w-3.5" />
                                  Олгох
                                </Button>
                              ) : null}
                            </div>
                          </TD>
                        </TR>
                        {open ? (
                          <tr>
                            <td colSpan={columns} className="bg-[var(--color-surface-2)] px-4 py-3">
                              <PayoutHistory row={r} canAdmin={canAdmin} />
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                  {totals ? (
                    <TR className="bg-[var(--color-surface-2)] font-semibold">
                      <TD>Нийт</TD>
                      <TD className="tnum">{formatNumber(totals.sessions)}</TD>
                      <TD className="tnum whitespace-nowrap">{formatWh(totalEnergyWh)}</TD>
                      <TD align="right" className="tnum whitespace-nowrap font-mono font-normal text-right px-3">{formatAmount(totals.gross)}</TD>
                      <TD align="right" className="tnum whitespace-nowrap font-mono font-normal text-right px-3">{formatAmount(totals.fee)}</TD>
                      <TD align="right" className="tnum whitespace-nowrap font-mono font-normal text-right px-3">{formatAmount(totals.net)}</TD>
                      <TD className="whitespace-nowrap">
                        <Outstanding value={totals.outstanding} />
                      </TD>
                      <TD />
                    </TR>
                  ) : null}
                </>
              )}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      {paying ? (
        <PayoutModal row={paying} range={range} onClose={() => setPaying(null)} />
      ) : null}
    </>
  );
}

/** Highlighted when owed, warning when the client has been overpaid (after a refund). */
function Outstanding({ value }: { value: number }) {
  if (value > 0) {
    return (
      <Badge tone="info" className="tnum">
        {formatMoney(value)}
      </Badge>
    );
  }
  if (value < 0) {
    return (
      <Badge tone="warn" className="tnum" title="Олгосон дүн олсон орлогоос их байна (буцаалтын дараа)">
        {formatMoney(value)}
      </Badge>
    );
  }
  return <span className="tnum text-[var(--color-fg-muted)]">{formatMoney(0)}</span>;
}

// ---------------------------------------------------------------------------
// Payout history (expanded row)
// ---------------------------------------------------------------------------

function PayoutHistory({ row, canAdmin }: { row: SettlementSummaryRow; canAdmin: boolean }) {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR<{ data: Settlement[] }>(
    apiUrl('settlements', { clientId: row.client.id, limit: 200 }),
    fetcher,
    { refreshInterval: REFRESH.config },
  );
  const [deleting, setDeleting] = React.useState<Settlement | null>(null);
  const [busy, setBusy] = React.useState(false);

  const items = data?.data ?? [];
  const columns = canAdmin ? 6 : 5;

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`settlements/${encodeURIComponent(deleting.id ?? deleting._id ?? '')}`);
      toast.success('Төлбөрийн бичлэг устгагдлаа');
      setDeleting(null);
      await mutate(isSettlementsKey);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const account = row.client.payoutAccount;

  return (
    <div className="space-y-2 text-left">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--color-fg-muted)]">
        <span className="font-semibold text-[var(--color-fg)]">Төлбөрийн түүх</span>
        <span>
          {`Нийт олсон ${formatMoney(row.earnedTotal)} · олгосон ${formatMoney(row.paidTotal)}`}
          {account?.accountNumber
            ? ` · Данс: ${[account.bankName, account.accountNumber, account.accountName].filter(Boolean).join(' ')}`
            : ' · Данс бүртгээгүй'}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <Table>
          <THead>
            <tr>
              <TH>Олгосон огноо</TH>
              <TH align="right" className="text-right px-3">Дүн</TH>
              <TH>Хамрах хугацаа</TH>
              <TH>Гүйлгээний утга</TH>
              <TH>Бүртгэсэн</TH>
              {canAdmin ? (
                <TH>
                  <span className="sr-only">Үйлдэл</span>
                </TH>
              ) : null}
            </tr>
          </THead>
          <TBody>
            {isLoading && !data ? (
              <TableLoading colSpan={columns} rows={2} />
            ) : error ? (
              <TableEmpty colSpan={columns}>Төлбөрийн түүх ачаалж чадсангүй.</TableEmpty>
            ) : items.length === 0 ? (
              <TableEmpty colSpan={columns}>Одоогоор олгосон төлбөр бүртгэгдээгүй.</TableEmpty>
            ) : (
              items.map((s) => (
                <TR key={s.id ?? s._id}>
                  <TD className="whitespace-nowrap text-xs">{formatDate(s.paidAt)}</TD>
                  <TD align="right" className="tnum whitespace-nowrap font-mono font-normal text-right px-3">{formatAmount(s.amount)}</TD>
                  <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                    {s.periodFrom || s.periodTo
                      ? `${formatDate(s.periodFrom)} – ${formatDate(s.periodTo)}`
                      : '—'}
                  </TD>
                  <TD className="max-w-[260px] text-xs">
                    <div className="truncate font-mono" title={s.reference}>
                      {s.reference || '—'}
                    </div>
                    {s.note ? (
                      <div className="truncate text-[var(--color-fg-muted)]" title={s.note}>
                        {s.note}
                      </div>
                    ) : null}
                  </TD>
                  <TD className="text-xs text-[var(--color-fg-muted)]">{s.createdBy ?? '—'}</TD>
                  {canAdmin ? (
                    <TD>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(s)}
                        aria-label="Төлбөрийн бичлэг устгах"
                        className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        loading={busy}
        tone="danger"
        title="Төлбөрийн бичлэг устгах уу?"
        confirmLabel="Устгах"
        message={
          deleting ? (
            <>
              <span className="font-semibold">{row.client.name}</span>-д{' '}
              {formatDate(deleting.paidAt)}-нд олгосон{' '}
              <span className="font-semibold">{formatMoney(deleting.amount)}</span> төлбөрийн
              бичлэгийг устгана. Үлдэгдэл тэр хэмжээгээр нэмэгдэнэ. Зөвхөн алдаатай бүртгэлийг
              устгана уу.
            </>
          ) : null
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record a payout
// ---------------------------------------------------------------------------

function PayoutModal({
  row,
  range,
  onClose,
}: {
  row: SettlementSummaryRow;
  range: DateRange;
  onClose: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(() => ({
    amount: row.outstanding > 0 ? String(row.outstanding) : '',
    periodFrom: range.from,
    periodTo: range.to,
    paidAt: toIsoDate(new Date()),
    reference: '',
    note: '',
  }));

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const account = row.client.payoutAccount;

  async function submit() {
    const amount = Number(form.amount.trim().replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Дүн 0-ээс их тоо байх ёстой.');
      return;
    }

    setSaving(true);
    setError(null);
    const body: SettlementInput = { clientId: row.client.id, amount };
    if (form.periodFrom) body.periodFrom = rangeStart(form.periodFrom);
    // Exclusive end (the next day's 00:00), the same convention as the summary.
    if (form.periodTo) body.periodTo = rangeEnd(form.periodTo);
    if (form.paidAt && form.paidAt !== toIsoDate(new Date())) {
      // Midday, so the date survives any timezone shift on display.
      const d = localDate(form.paidAt);
      if (d) body.paidAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
    }
    if (form.reference.trim()) body.reference = form.reference.trim();
    if (form.note.trim()) body.note = form.note.trim();

    try {
      await api.post<Settlement>('settlements', body);
      toast.success(`${row.client.name}-д ${formatMoney(amount)} олгосныг бүртгэлээ`);
      await mutate(isSettlementsKey);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Төлбөр бүртгэх"
      description={`${row.client.name} — харилцагчид олгосон төлбөр`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            Бүртгэх
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <dl className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] px-3 py-1">
          <DataRow label="Нийт үлдэгдэл">
            <Outstanding value={row.outstanding} />
          </DataRow>
          <DataRow label="Банк">
            {account?.bankName || account?.bankCode
              ? [account.bankName, account.bankCode].filter(Boolean).join(' · ')
              : '—'}
          </DataRow>
          <DataRow label="Дансны дугаар" mono>
            {account?.accountNumber || '—'}
          </DataRow>
          <DataRow label="Данс эзэмшигч">{account?.accountName || '—'}</DataRow>
        </dl>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Дүн (₮) *" hint="Анхдагчаар нийт үлдэгдэл.">
            <Input
              value={form.amount}
              onChange={set('amount')}
              inputMode="decimal"
              placeholder="0"
              autoFocus
              className="tnum"
            />
          </Field>
          <Field label="Олгосон огноо">
            <DatePicker
              value={form.paidAt}
              onChange={(v) => setForm((f) => ({ ...f, paidAt: v }))}
              clearable={false}
              aria-label="Олгосон огноо"
            />
          </Field>
        </div>

        <Field label="Хамрах хугацаа" hint="Тайланд зориулсан мэдээлэл.">
          <DateRangePicker
            value={{ from: form.periodFrom, to: form.periodTo }}
            onChange={(r) => setForm((f) => ({ ...f, periodFrom: r.from, periodTo: r.to }))}
            aria-label="Хамрах хугацаа"
          />
        </Field>

        <Field label="Гүйлгээний утга / дугаар">
          <Input
            value={form.reference}
            onChange={set('reference')}
            placeholder="Банкны гүйлгээний дугаар"
            maxLength={100}
            className="font-mono"
          />
        </Field>

        <Field label="Тэмдэглэл">
          <Textarea
            rows={2}
            value={form.note}
            onChange={set('note')}
            placeholder="Нэмэлт тайлбар"
            maxLength={500}
          />
        </Field>
      </div>
    </Modal>
  );
}
