'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { RefreshCw, Search } from 'lucide-react';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { Badge, Button, Card, Input, Select, type Tone } from '@/components/ui/primitives';
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

function methodLabel(p: PaymentRow): string {
  if (p.provider === 'GOLOMT') return p.golomtMode === 'TOKEN' ? 'Хадгалсан карт' : 'Карт · Голомт';
  return 'QPay';
}

/** Open payments can be re-asked of the bank; settled ones need nothing. */
const RECHECKABLE: ReadonlySet<PaymentStatus> = new Set(['PENDING', 'PARTIALLY_PAID', 'EXPIRED', 'FAILED']);

export function PaymentsView({ initialQuery, initialStatus }: { initialQuery: string; initialStatus: string }) {
  const [query, setQuery] = React.useState(initialQuery);
  const [status, setStatus] = React.useState(initialStatus);
  const [provider, setProvider] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [checking, setChecking] = React.useState<string | null>(null);

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

  const filtered = Boolean(query || status || provider || from || to);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Төлбөр</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Жолооч нарын хэтэвч цэнэглэлт. «Мөнгө орсонгүй» гэвэл утасны дугаараар хайгаад «Банкнаас шалгах»-ыг дарна уу.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Төлөгдсөн" value={formatMoney(paid?.amount ?? 0)} hint={`${formatNumber(paid?.count ?? 0)} төлбөр`} tone="ok" />
        <Stat label="Хүлээгдэж буй" value={formatNumber(pending?.count ?? 0)} hint="банкны хариу хүлээж байна" tone="warn" />
        <Stat label="Амжилтгүй" value={formatNumber(failed?.count ?? 0)} hint="карт татгалзсан эсвэл алдаа" tone="danger" />
      </div>

      <Card>
        <FilterBar>
          <div className="relative min-w-[16rem] flex-1">
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
            aria-label="Төлөх арга"
          >
            <option value="">Бүх арга</option>
            <option value="GOLOMT">Карт · Голомт</option>
            <option value="QPAY_QUICKQR">QPay</option>
            <option value="QPAY">QPay (merchant)</option>
          </Select>
          <DateRangePicker
            className="w-auto min-w-[15rem]"
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
                <TH>Огноо</TH>
                <TH>Жолооч</TH>
                <TH>Арга</TH>
                <TH>Дүн</TH>
                <TH>Төлөв</TH>
                <TH>Хэтэвч</TH>
                <TH>Гүйлгээ</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={8} />
              ) : error ? (
                <TableEmpty colSpan={8}>Төлбөрийг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={8}>
                  {filtered ? 'Энэ хайлтад тохирох төлбөр алга.' : 'Одоогоор төлбөр алга.'}
                </TableEmpty>
              ) : (
                rows.map((p) => {
                  const card = p.payments?.find((x) => x.paymentWallet)?.paymentWallet;
                  return (
                    <TR key={p.id}>
                      <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                        {formatDateTime(p.createdAt)}
                      </TD>
                      <TD className="text-xs">
                        <p className="font-medium">{p.driver?.name || '—'}</p>
                        <p className="font-mono text-[var(--color-fg-subtle)]">{p.driver?.phone ?? ''}</p>
                      </TD>
                      <TD className="text-xs">
                        <p>{methodLabel(p)}</p>
                        {card ? <p className="font-mono text-[var(--color-fg-subtle)]">{card}</p> : null}
                      </TD>
                      <TD align="right" className="whitespace-nowrap text-xs font-medium">
                        {formatMoney(p.amount)}
                      </TD>
                      <TD>
                        <Badge tone={STATUS[p.status]?.tone ?? 'idle'}>{STATUS[p.status]?.label ?? p.status}</Badge>
                        {p.lastError && p.status !== 'PAID' ? (
                          <p className="mt-1 max-w-[16rem] truncate text-xs text-[var(--color-fg-subtle)]" title={p.lastError}>
                            {p.lastError}
                          </p>
                        ) : null}
                      </TD>
                      <TD className="text-xs">
                        {p.walletCreditedAt ? (
                          <span className="text-[var(--color-ok)]">✓ Орсон</span>
                        ) : p.status === 'PAID' ? (
                          <span className="text-[var(--color-danger)]">Ороогүй</span>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD className="font-mono text-xs text-[var(--color-fg-muted)]">{p.senderInvoiceNo}</TD>
                      <TD align="right">
                        {RECHECKABLE.has(p.status) ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={checking === p.id}
                            disabled={checking !== null}
                            onClick={() => void recheck(p)}
                          >
                            {checking === p.id ? null : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                            Банкнаас шалгах
                          </Button>
                        ) : null}
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
            label="төлбөр"
          />
        ) : null}
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-fg-muted)]">{label}</p>
        <Badge tone={tone}>{hint}</Badge>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </Card>
  );
}
