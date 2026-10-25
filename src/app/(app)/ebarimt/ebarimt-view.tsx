'use client';

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Eye, Receipt, RefreshCw, Search, Undo2 } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { Badge, Button, Card, Dot, Input, Select, type Tone } from '@/components/ui/primitives';
import { DateRangePicker } from '@/components/ui/date-picker';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { CopyButton } from '@/components/ui/copy-button';
import { ReturnConfirmModal, type EbarimtReceiptRow } from './return-confirm-modal';
import { ReceiptModal } from './receipt-modal';

interface EbarimtListResponse {
  data: EbarimtReceiptRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalCount: number;
    totalAmount: number;
    successCount: number;
    successAmount: number;
    refundedCount: number;
    refundedAmount: number;
    failedCount: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; tone: Tone }> = {
  SUCCESS: { label: 'Хүчинтэй', tone: 'ok' },
  REFUNDED: { label: 'Буцаагдсан', tone: 'danger' },
  FAILED: { label: 'Алдаатай', tone: 'danger' },
  PENDING: { label: 'Хүлээгдэж буй', tone: 'warn' },
};

export function EbarimtView({
  initialQuery = '',
  initialStatus = 'ALL',
}: {
  initialQuery?: string;
  initialStatus?: string;
}) {
  const [query, setQuery] = React.useState(initialQuery);
  const [status, setStatus] = React.useState(initialStatus);
  const [type, setType] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);

  // Selected receipt for return confirmation or detail/print view
  const [returnTarget, setReturnTarget] = React.useState<EbarimtReceiptRow | null>(null);
  const [viewTarget, setViewTarget] = React.useState<EbarimtReceiptRow | null>(null);

  const [debouncedQuery, setDebouncedQuery] = React.useState(query);
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const key = apiUrl('ebarimt', {
    q: debouncedQuery || undefined,
    status: status !== 'ALL' ? status : undefined,
    type: type || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit,
  });

  const { data, error, isLoading, mutate, isValidating } = useSWR<EbarimtListResponse>(key, fetcher, {
    keepPreviousData: true,
  });

  const summary = data?.summary;
  const receipts = data?.data ?? [];
  const total = data?.total ?? 0;
  const filtered = Boolean(query || status !== 'ALL' || type || from || to);

  return (
    <div className="space-y-4">
      {/* Header Stat Cards */}
      <div className="grid gap-2.5 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Нийт баримт"
          value={formatNumber(summary?.totalCount ?? 0)}
          hint={formatMoney(summary?.totalAmount ?? 0)}
          tone="idle"
        />
        <StatCard
          label="Хүчинтэй (Олгосон)"
          value={formatNumber(summary?.successCount ?? 0)}
          hint={formatMoney(summary?.successAmount ?? 0)}
          tone="ok"
        />
        <StatCard
          label="Буцаагдсан"
          value={formatNumber(summary?.refundedCount ?? 0)}
          hint={formatMoney(summary?.refundedAmount ?? 0)}
          tone="danger"
        />
        <StatCard
          label="Алдаатай"
          value={formatNumber(summary?.failedCount ?? 0)}
          hint="Татварын алдаатай"
          tone="warn"
        />
      </div>

      <Card>
        <FilterBar>
          <div className="relative min-w-0 sm:min-w-[16rem] w-full sm:w-auto flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-subtle)]"
            />
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ДДТД, сугалаа, регистр, утас хайх…"
              aria-label="Хайх"
            />
          </div>

          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-36"
            aria-label="Төлөвөөр шүүх"
          >
            <option value="ALL">Бүх төлөв</option>
            <option value="SUCCESS">Хүчинтэй</option>
            <option value="REFUNDED">Буцаасан</option>
            <option value="FAILED">Алдаатай</option>
            <option value="PENDING">Хүлээгдэж буй</option>
          </Select>

          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-36"
            aria-label="Төрлөөр шүүх"
          >
            <option value="">Бүх төрөл</option>
            <option value="B2C_RECEIPT">Иргэн (B2C)</option>
            <option value="B2B_RECEIPT">ААН (B2B)</option>
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

          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                setStatus('ALL');
                setType('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              Цэвэрлэх
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void mutate()}
            title="Шинэчлэх"
            aria-label="Шинэчлэх"
            disabled={isValidating}
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
          </Button>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH className="w-12 text-center">№</TH>
                <TH>Огноо</TH>
                <TH>Төрөл</TH>
                <TH>ДДТД (Баримтын №)</TH>
                <TH>Сугалаа</TH>
                <TH className="text-right">Нийт дүн</TH>
                <TH className="text-right">НӨАТ</TH>
                <TH>Хэрэглэгч / Регистр</TH>
                <TH>Эх үүсвэр</TH>
                <TH>Төлөв</TH>
                <TH className="text-right">Үйлдэл</TH>
              </TR>
            </THead>
            <TBody>
              {isLoading && receipts.length === 0 ? (
                <TableLoading colSpan={11} />
              ) : error ? (
                <TableEmpty colSpan={11}>И-Баримтыг ачаалж чадсангүй.</TableEmpty>
              ) : receipts.length === 0 ? (
                <TableEmpty colSpan={11}>
                  {debouncedQuery || status !== 'ALL' || type || from || to
                    ? 'Хайлтын нөхцөлд таарах баримт байхгүй байна.'
                    : 'Одоогоор системд олгогдсон цахим төлбөрийн баримт алга байна.'}
                </TableEmpty>
              ) : (
                receipts.map((row, idx) => {
                  const num = (page - 1) * limit + idx + 1;
                  const isB2B = row.type === 'B2B_RECEIPT';
                  const st = STATUS_CONFIG[row.status] || { label: row.status, tone: 'idle' };
                  const isRefunded = row.status === 'REFUNDED';
                  const canRefund = row.status === 'SUCCESS';

                  return (
                    <TR key={row.id}>
                      <TD className="text-center text-xs text-[var(--color-fg-muted)]">{num}</TD>
                      <TD className="whitespace-nowrap text-xs">
                        {row.issuedAt ? formatDateTime(row.issuedAt) : '—'}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <Badge tone={isB2B ? 'brand' : 'idle'} className="text-[11px]">
                          {isB2B ? 'ААН' : 'Иргэн'}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {row.receiptId ? (
                          <div className="flex items-center gap-1 font-mono text-xs">
                            <span title={row.receiptId} className="max-w-[140px] truncate">
                              {row.receiptId}
                            </span>
                            <CopyButton value={row.receiptId} className="h-6 w-6 p-0" />
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {row.lottery ? (
                          <span className="font-mono text-xs font-bold text-[var(--color-brand)]">
                            {row.lottery}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-right font-medium text-xs">
                        {formatMoney(row.totalAmount)}
                      </TD>
                      <TD className="whitespace-nowrap text-right text-xs text-[var(--color-fg-muted)]">
                        {formatMoney(row.totalVAT)}
                      </TD>
                      <TD className="whitespace-nowrap text-xs">
                        <div className="min-w-0">
                          {row.customerTin ? (
                            <span className="font-mono font-semibold text-[var(--color-fg)]">
                              {row.customerTin}
                            </span>
                          ) : row.customerNo ? (
                            <span className="font-mono">{row.customerNo}</span>
                          ) : row.driver?.phone ? (
                            <span className="font-mono">{row.driver.phone}</span>
                          ) : (
                            <span className="text-[var(--color-fg-subtle)]">—</span>
                          )}
                          {row.driver?.name && (
                            <p className="text-[10px] text-[var(--color-fg-subtle)] truncate">
                              {row.driver.name}
                            </p>
                          )}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap text-xs">
                        {row.source === 'TRANSACTION' ? (
                          <Link
                            href={`/transactions/${row.sourceId}`}
                            className="font-medium text-[var(--color-brand)] hover:underline"
                            title="Цэнэглэлтийн дэлгэрэнгүй харах"
                          >
                            Цэнэглэлт #{row.sourceId}
                          </Link>
                        ) : (
                          <span className="text-[var(--color-fg-muted)]">
                            Төлбөр #{String(row.sourceId).slice(-6)}
                          </span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <Badge tone={st.tone} className="gap-1.5 text-[11px]">
                          <Dot tone={st.tone} />
                          {st.label}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* View & Print button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => setViewTarget(row)}
                            title="Баримт харах / хэвлэх"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Харах</span>
                          </Button>

                          {/* Return button */}
                          {canRefund ? (
                            <Button
                              variant="danger"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => setReturnTarget(row)}
                              title="Татварын системээс баримт буцаах"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Буцаах
                            </Button>
                          ) : isRefunded ? (
                            <span
                              className="text-[11px] text-[var(--color-danger)] px-1.5 py-0.5 rounded bg-[var(--color-danger)]/10"
                              title={row.returnedAt ? `Буцаасан: ${formatDateTime(row.returnedAt)}` : 'Буцаагдсан'}
                            >
                              Буцаасан
                            </span>
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

        <Pagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      </Card>

      {/* Return confirmation dialog */}
      <ReturnConfirmModal
        receipt={returnTarget}
        onClose={() => setReturnTarget(null)}
        onSuccess={() => void mutate()}
      />

      {/* Receipt preview & print modal */}
      <ReceiptModal
        receipt={viewTarget}
        onClose={() => setViewTarget(null)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  return (
    <Card className="min-w-0 max-w-full overflow-hidden p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <Dot tone={tone} />
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
