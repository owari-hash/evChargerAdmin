'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Plus, RefreshCw, Store, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import type { PaymentsConfig, QpayMerchant } from '@/lib/types';
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { CopyButton } from '@/components/ui/copy-button';
import { ConfirmModal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
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
import { MerchantModal } from './merchant-modal';

/**
 * QuickQR returns the merchant list as `{ rows, count }`, but a bare array shows
 * up too depending on the endpoint version — accept either.
 */
interface MerchantList {
  rows?: QpayMerchant[];
  count?: number;
}

function readRows(data: MerchantList | QpayMerchant[] | undefined): QpayMerchant[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.rows ?? []);
}

function readTotal(data: MerchantList | QpayMerchant[] | undefined, rows: number): number {
  if (!data) return 0;
  return Array.isArray(data) ? data.length : (data.count ?? rows);
}

/** Display name: whichever of the company/person name fields QPay filled in. */
function merchantName(m: QpayMerchant): string {
  const person = [m.last_name, m.first_name].filter(Boolean).join(' ');
  return m.name || m.business_name || m.company_name || person || '—';
}

export function MerchantsView({
  canEdit,
  canDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(10);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<QpayMerchant | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Whether QuickQR is configured at all decides between "empty" and "not set up".
  const { data: config } = useSWR<PaymentsConfig>(apiUrl('payments/config'), fetcher);
  const ready = config?.quickQrEnabled ?? true;

  const { data, error, isLoading, mutate } = useSWR<MerchantList | QpayMerchant[]>(
    ready ? apiUrl('qpay/merchants', { page, limit }) : null,
    fetcher,
    { keepPreviousData: true },
  );

  const rows = readRows(data);
  const total = readTotal(data, rows.length);

  async function remove() {
    if (!deleting?.merchant_id) return;
    setBusy(true);
    try {
      await api.del(`qpay/merchants/${encodeURIComponent(deleting.merchant_id)}`);
      toast.success('Мерчант устгагдлаа');
      setDeleting(null);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="QPay мерчант"
        description="QuickQR дээр төлбөр хүлээн авах мерчантуудын бүртгэл."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void mutate()} disabled={!ready}>
              <RefreshCw className="h-3.5 w-3.5" />
              Шинэчлэх
            </Button>
            {canEdit ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreating(true)}
                disabled={!ready}
              >
                <Plus className="h-3.5 w-3.5" />
                Шинэ мерчант
              </Button>
            ) : null}
          </>
        }
      />

      {config && !config.quickQrEnabled ? (
        <Card className="mb-6">
          <div className="flex items-start gap-3 px-5 py-4">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warn)]" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-[var(--color-fg)]">
                QuickQR тохируулаагүй байна
              </p>
              <p className="text-xs text-[var(--color-fg-muted)]">
                Мерчант бүртгэхийн тулд backend дээр{' '}
                <code className="font-mono">QPAY_QUICKQR_ENABLED=true</code> болгож,{' '}
                <code className="font-mono">QPAY_QUICKQR_TERMINAL_ID</code>-д QPay-с авсан
                терминалын дугаарыг тохируулна уу. Дараа нь{' '}
                <code className="font-mono">npm run qpay:check</code> ажиллуулж холболтыг
                шалгана.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Нэр</TH>
                <TH>Мерчант ID</TH>
                <TH>Регистр</TH>
                <TH>MCC</TH>
                <TH>Холбоо барих</TH>
                <TH>Хаяг</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {!ready ? (
                <TableEmpty colSpan={7}>QuickQR тохиргоо хийгдээгүй.</TableEmpty>
              ) : isLoading && !data ? (
                <TableLoading colSpan={7} />
              ) : error ? (
                <TableEmpty colSpan={7}>{errorMessage(error)}</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={7}>Одоогоор бүртгэсэн мерчант алга.</TableEmpty>
              ) : (
                rows.map((m, i) => (
                  <TR key={m.merchant_id ?? i}>
                    <TD className="text-xs font-medium">
                      {merchantName(m)}
                      {m.company_name && m.company_name !== merchantName(m) ? (
                        <p className="text-[var(--color-fg-subtle)]">{m.company_name}</p>
                      ) : null}
                    </TD>
                    <TD>
                      {m.merchant_id ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                            {m.merchant_id.slice(0, 8)}…
                          </span>
                          <CopyButton value={m.merchant_id} size="icon" />
                        </span>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="font-mono text-xs">{m.register_number ?? '—'}</TD>
                    <TD className="text-xs">
                      {m.mcc_code ? <Badge tone="info">{m.mcc_code}</Badge> : '—'}
                    </TD>
                    <TD className="text-xs">
                      {m.phone ?? '—'}
                      {m.email ? (
                        <p className="text-[var(--color-fg-subtle)]">{m.email}</p>
                      ) : null}
                    </TD>
                    <TD className="max-w-[220px] truncate text-xs text-[var(--color-fg-muted)]">
                      {m.address ?? '—'}
                    </TD>
                    <TD align="right">
                      {canDelete && m.merchant_id ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(m)}
                          title="Устгах"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>

        {total > 0 ? (
          <Pagination
            page={page}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
            label="мерчант"
          />
        ) : null}

        {ready && !isLoading && !error && rows.length === 0 && canEdit ? (
          <EmptyState
            icon={<Store className="h-8 w-8" />}
            title="Мерчант бүртгэгдээгүй"
            description="Байгууллага эсвэл хувь хүнээр мерчант бүртгэснээр QR-аар төлбөр хүлээн авах боломжтой болно."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                Шинэ мерчант
              </Button>
            }
          />
        ) : null}
      </Card>

      <MerchantModal
        key={creating ? 'create' : 'closed'}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => void mutate()}
      />

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        loading={busy}
        title="Мерчантыг устгах уу?"
        confirmLabel="Устгах"
        message={
          <>
            <span className="block">
              <span className="font-medium">{deleting ? merchantName(deleting) : ''}</span> QPay
              дээрээс устгагдана.
            </span>
            <span className="mt-2 block">
              Уг мерчантаар үүсгэсэн нэхэмжлэхүүд ажиллахаа болино.
            </span>
          </>
        }
      />
    </>
  );
}
