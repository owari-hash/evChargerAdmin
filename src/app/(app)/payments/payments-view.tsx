'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Menu, RefreshCw, Search, Trash2 } from 'lucide-react';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatAmount, formatDateTime, formatMoney, formatNumber, formatPhone } from '@/lib/format';
import { Badge, Button, Card, Dot, Input, Select, type Tone } from '@/components/ui/primitives';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { DateRangePicker } from '@/components/ui/date-picker';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

/**
 * Every payment a driver has made — QPay QRs and Golomt card payments — for
 * support: "I paid but my balance didn't change" is answered here by finding
 * the driver by phone and re-asking the bank. Drivers never see this page.
 */

type PaymentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELED' | 'EXPIRED' | 'REFUNDED' | 'FAILED';

interface PaymentRow {
  id: string;
  senderInvoiceNo: string;
  invoiceId?: string;
  provider: 'QPAY' | 'QPAY_QUICKQR' | 'GOLOMT';
  golomtMode?: 'PAGE' | 'TOKEN';
  golomtChannel?: 'CARD' | 'SOCIALPAY';
  purpose: 'CHARGING' | 'WALLET_TOPUP';
  status: PaymentStatus;
  amount: number;
  paidAmount: number;
  description: string;
  walletCreditedAt?: string;
  lastError?: string;
  createdAt: string;
  paidAt?: string;
  payments?: { paymentWallet?: string }[];
  driver: { name?: string; phone?: string } | null;
}

interface PaymentsPage {
  data: PaymentRow[];
  total: number;
  summary: Partial<Record<PaymentStatus, { count: number; amount: number }>>;
}

const STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Хүлээгдэж буй', tone: 'warn' },
  PARTIALLY_PAID: { label: 'Хэсэгчлэн', tone: 'warn' },
  PAID: { label: 'Төлөгдсөн', tone: 'ok' },
  CANCELED: { label: 'Цуцалсан', tone: 'idle' },
  EXPIRED: { label: 'Хугацаа дууссан', tone: 'idle' },
  REFUNDED: { label: 'Буцаасан', tone: 'info' },
  FAILED: { label: 'Амжилтгүй', tone: 'danger' },
};

function isUuid(val?: string): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));
}

function methodLabel(p: PaymentRow): string {
  if (p.provider === 'GOLOMT') {
    if (p.golomtMode === 'TOKEN') return 'Хадгалсан карт';
    return p.golomtChannel === 'SOCIALPAY' ? 'SocialPay' : 'Карт · Голомт';
  }
  return 'QPay';
}

/** Open payments can be re-asked of the bank; settled ones need nothing. */
const RECHECKABLE: ReadonlySet<PaymentStatus> = new Set(['PENDING', 'PARTIALLY_PAID', 'EXPIRED', 'FAILED']);

export function PaymentsView({
  initialQuery,
  initialStatus,
  canAdmin = false,
}: {
  initialQuery: string;
  initialStatus: string;
  canAdmin?: boolean;
}) {
  const [query, setQuery] = React.useState(initialQuery);
  const [status, setStatus] = React.useState(initialStatus);
  const [provider, setProvider] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [checking, setChecking] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<PaymentRow | null>(null);
  const [deletingBusy, setDeletingBusy] = React.useState(false);
  const [viewing, setViewing] = React.useState<PaymentRow | null>(null);

  React.useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const [debouncedQuery, setDebouncedQuery] = React.useState(query);
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const key = apiUrl('payments', {
    q: debouncedQuery,
    status,
    provider,
    purpose: 'WALLET_TOPUP',
    from: from ? new Date(from).toISOString() : '',
    to: to ? new Date(to).toISOString() : '',
    page,
    limit,
  });
  const { data, error, isLoading, mutate } = useSWR<PaymentsPage>(key, fetcher, {
    refreshInterval: REFRESH.live,
    keepPreviousData: true,
  });
  const rows = data?.data ?? [];
  const paid = data?.summary.PAID;
  const pending = data?.summary.PENDING;
  const failed = data?.summary.FAILED;

  async function recheck(p: PaymentRow) {
    setChecking(p.id);
    try {
      const next = await api.post<PaymentRow>(`payments/${p.id}/check`);
      if (next.status === 'PAID') {
        toast.success(`Төлөгдсөн — ${formatMoney(next.paidAmount || next.amount)} хэтэвчинд орлоо`);
      } else {
        toast.info(`Банкны хариу: ${STATUS[next.status]?.label ?? next.status}`);
      }
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setChecking(null);
    }
  }

  async function handleDeletePayment() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.del(`payments/${deleting.id}`);
      toast.success('Төлбөрийн бичлэг амжилттай устгагдлаа');
      setDeleting(null);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeletingBusy(false);
    }
  }

  const columns = canAdmin ? 9 : 8;
  const filtered = Boolean(query || status || provider || from || to);

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-3">
        <Stat
          label="Төлөгдсөн"
          value={formatMoney(paid?.amount ?? 0)}
          hint={`${formatNumber(paid?.count ?? 0)} төлбөр амжилттай`}
          tone="ok"
          active={status === 'PAID'}
          onClick={() => {
            setStatus((prev) => (prev === 'PAID' ? '' : 'PAID'));
            setPage(1);
          }}
        />
        <Stat
          label="Хүлээгдэж буй"
          value={`${formatNumber(pending?.count ?? 0)} гүйлгээ`}
          hint="Банкны хариу хүлээж байна"
          tone="warn"
          active={status === 'PENDING'}
          onClick={() => {
            setStatus((prev) => (prev === 'PENDING' ? '' : 'PENDING'));
            setPage(1);
          }}
        />
        <Stat
          label="Амжилтгүй"
          value={`${formatNumber(failed?.count ?? 0)} гүйлгээ`}
          hint="Карт татгалзсан эсвэл алдаа"
          tone="danger"
          active={status === 'FAILED'}
          onClick={() => {
            setStatus((prev) => (prev === 'FAILED' ? '' : 'FAILED'));
            setPage(1);
          }}
        />
      </div>

      <Card>
        <FilterBar>
          <div className="relative min-w-0 sm:min-w-[16rem] w-full sm:w-auto flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
            <Input
              className="pl-9"
              placeholder="Утас, гүйлгээний дугаар (G…/EV-…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Хайх"
            />
          </div>
          <Select
            className="w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Төлөв"
          >
            <option value="">Бүх төлөв</option>
            {(Object.keys(STATUS) as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </Select>
          <Select
            className="w-auto"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            aria-label="Төлбөрийн хэлбэр"
          >
            <option value="">Бүх хэлбэр</option>
            <option value="GOLOMT">Карт · Голомт</option>
            <option value="QPAY_QUICKQR">QPay</option>
            <option value="QPAY">QPay (merchant)</option>
          </Select>
          <DateRangePicker
            className="w-full sm:w-auto min-w-0 sm:min-w-[15rem]"
            value={{ from, to }}
            onChange={(r) => {
              setFrom(r.from);
              setTo(r.to);
              setPage(1);
            }}
            aria-label="Огнооны муж"
          />
          {filtered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                setStatus('');
                setProvider('');
                setFrom('');
                setTo('');
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
                <TH className="w-12 text-center">№</TH>
                <TH className="text-center">Огноо</TH>
                <TH className="text-center">Жолооч</TH>
                <TH className="text-center">Хэлбэр</TH>
                <TH align="right" className="text-right px-3">Дүн</TH>
                <TH className="text-center">Төлөв</TH>
                <TH className="text-center">Хэтэвч</TH>
                <TH className="text-center">Гүйлгээ</TH>
                {canAdmin ? <TH className="text-center">Үйлдэл</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={columns} />
              ) : error ? (
                <TableEmpty colSpan={columns}>Төлбөрийг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={columns}>
                  {filtered ? 'Энэ хайлтад тохирох төлбөр алга.' : 'Одоогоор төлбөр алга.'}
                </TableEmpty>
              ) : (
                rows.map((p, idx) => {
                  const num = (page - 1) * limit + idx + 1;
                  const rawWallet = p.payments?.find((x) => x.paymentWallet)?.paymentWallet;
                  const card = p.provider === 'GOLOMT' && rawWallet && !isUuid(rawWallet) ? rawWallet : null;
                  return (
                    <TR key={p.id}>
                      <TD align="center" className="text-xs text-[var(--color-fg-muted)] font-mono text-center">
                        {num}
                      </TD>
                      <TD align="center" className="whitespace-nowrap text-xs text-[var(--color-fg-muted)] text-center">
                        {formatDateTime(p.createdAt)}
                      </TD>
                      <TD align="left" className="text-xs px-3 text-left">
                        <p className="font-normal text-[var(--color-fg)]">{p.driver?.name || '—'}</p>
                        <p className="font-mono text-[var(--color-fg-subtle)]">{formatPhone(p.driver?.phone)}</p>
                      </TD>
                      <TD align="center" className="text-xs text-center">
                        <p>{methodLabel(p)}</p>
                        {card ? <p className="font-mono text-[var(--color-fg-subtle)]">{card}</p> : null}
                      </TD>
                      <TD align="right" className="whitespace-nowrap text-xs font-mono font-normal px-3 text-right">
                        {formatAmount(p.amount)}
                      </TD>
                      <TD align="center" className="text-center">
                        <Badge tone={STATUS[p.status]?.tone ?? 'idle'}>{STATUS[p.status]?.label ?? p.status}</Badge>
                        {p.lastError && p.status !== 'PAID' ? (
                          <p className="mt-1 max-w-[16rem] mx-auto truncate text-xs text-[var(--color-fg-subtle)]" title={p.lastError}>
                            {p.lastError}
                          </p>
                        ) : null}
                      </TD>
                      <TD align="center" className="text-xs text-center">
                        {p.walletCreditedAt ? (
                          <span className="text-[var(--color-ok)]">✓ Орсон</span>
                        ) : p.status === 'PAID' ? (
                          <span className="text-[var(--color-danger)]">Ороогүй</span>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD align="center" className="font-mono text-xs text-[var(--color-fg-muted)] text-center">
                        {p.senderInvoiceNo}
                      </TD>
                      {canAdmin ? (
                        <TD align="center" className="py-1.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewing(p)}
                              title="Дэлгэрэнгүй харах"
                              aria-label="Дэлгэрэнгүй харах"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition cursor-pointer"
                            >
                              <Menu className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(p)}
                              title="Устгах"
                              aria-label="Төлбөр устгах"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TD>
                      ) : null}
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
            label="төлбөр"
          />
        ) : null}
      </Card>

      {/* Delete confirmation modal */}
      {canAdmin ? (
        <ConfirmModal
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          onConfirm={handleDeletePayment}
          title="Төлбөрийн бичлэг устгах"
          message={
            <span>
              <strong>{deleting?.senderInvoiceNo}</strong> дугаартай төлбөрийн бичлэгийг устгахдаа итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй.
            </span>
          }
          confirmLabel="Устгах"
          tone="danger"
          loading={deletingBusy}
        />
      ) : null}

      {/* Payment details modal */}
      {canAdmin && viewing ? (
        <Modal
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
          title="Төлбөрийн дэлгэрэнгүй"
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <div>
                {RECHECKABLE.has(viewing.status) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={checking === viewing.id}
                    disabled={checking !== null}
                    onClick={async () => {
                      await recheck(viewing);
                      setViewing(null);
                    }}
                  >
                    {checking === viewing.id ? null : <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden />}
                    Банкнаас шалгах
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setViewing(null)}>
                  Хаах
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    const target = viewing;
                    setViewing(null);
                    setDeleting(target);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Устгах
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Driver & Amount overview */}
            <div className="flex items-start justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
              <div>
                <p className="text-xs text-[var(--color-fg-muted)]">Жолооч</p>
                <p className="text-sm font-semibold text-[var(--color-fg)]">{viewing.driver?.name || '—'}</p>
                <p className="font-mono text-xs text-[var(--color-fg-subtle)]">{formatPhone(viewing.driver?.phone)}</p>
              </div>
              <div className="text-right">
                <Badge tone={STATUS[viewing.status]?.tone ?? 'idle'}>
                  {STATUS[viewing.status]?.label ?? viewing.status}
                </Badge>
                <p className="mt-1 font-mono text-base font-bold text-[var(--color-fg)]">
                  {formatMoney(viewing.amount)}
                </p>
              </div>
            </div>

            {/* Key fields */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[var(--color-fg-muted)] block">Нэхэмжлэхийн дугаар:</span>
                <span className="font-mono text-[var(--color-fg)] font-medium break-all">{viewing.senderInvoiceNo}</span>
              </div>
              {viewing.invoiceId ? (
                <div>
                  <span className="text-[var(--color-fg-muted)] block">Банкны Invoice ID:</span>
                  <span className="font-mono text-[var(--color-fg)] break-all">{viewing.invoiceId}</span>
                </div>
              ) : null}
              <div>
                <span className="text-[var(--color-fg-muted)] block">Төлбөрийн хэлбэр:</span>
                <span className="text-[var(--color-fg)] font-medium">{methodLabel(viewing)}</span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)] block">Зориулалт:</span>
                <span className="text-[var(--color-fg)]">
                  {viewing.purpose === 'WALLET_TOPUP' ? 'Хэтэвч цэнэглэлт' : 'Цэнэглэлтийн төлбөр'}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)] block">Төлсөн дүн:</span>
                <span className="font-mono font-medium text-[var(--color-fg)]">
                  {viewing.paidAmount ? formatMoney(viewing.paidAmount) : '—'}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)] block">Хэтэвчинд орсон эсэх:</span>
                <span>
                  {viewing.walletCreditedAt ? (
                    <span className="text-[var(--color-ok)] font-medium">✓ Орсон ({formatDateTime(viewing.walletCreditedAt)})</span>
                  ) : viewing.status === 'PAID' ? (
                    <span className="text-[var(--color-danger)] font-medium">Ороогүй</span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)] block">Үүсгэсэн огноо:</span>
                <span className="text-[var(--color-fg)]">{formatDateTime(viewing.createdAt)}</span>
              </div>
              {viewing.paidAt ? (
                <div>
                  <span className="text-[var(--color-fg-muted)] block">Төлөгдсөн огноо:</span>
                  <span className="text-[var(--color-fg)]">{formatDateTime(viewing.paidAt)}</span>
                </div>
              ) : null}
            </div>

            {viewing.description ? (
              <div className="pt-2 border-t border-[var(--color-border)] text-xs">
                <span className="text-[var(--color-fg-muted)] block">Тайлбар:</span>
                <span className="text-[var(--color-fg)]">{viewing.description}</span>
              </div>
            ) : null}

            {viewing.lastError ? (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                <span className="font-semibold block mb-0.5">Сүүлийн алдаа:</span>
                <p className="break-words font-mono text-[11px]">{viewing.lastError}</p>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`min-w-0 max-w-full overflow-hidden p-3.5 sm:p-4 text-left transition-all ${
        onClick ? 'cursor-pointer hover:border-[var(--color-border-strong)]' : ''
      } ${active ? 'ring-2 ring-[var(--color-brand)] border-transparent bg-[var(--color-bg-subtle)]' : ''}`}
    >
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <Dot tone={tone} pulse={tone === 'warn'} />
          <p className="text-xs font-semibold text-[var(--color-fg-muted)] truncate">{label}</p>
        </span>
      </div>
      <p className="mt-1.5 truncate text-xl sm:text-2xl font-bold tabular-nums tracking-tight text-[var(--color-fg)]">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--color-fg-subtle)]" title={hint}>
        {hint}
      </p>
    </Card>
  );
}
