'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Check, FileKey, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { CsrRequest, Paginated } from '@/lib/types';
import { Button, Card, CodeBlock, EmptyState, ErrorNote, Field, Input, Select } from '@/components/ui/primitives';
import { CsrStatusBadge } from '@/components/ui/status';
import { CSR_STATUS, mn } from '@/lib/mn';
import { Modal } from '@/components/ui/modal';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

/**
 * Certificate signing requests raised by charge points via SignCertificate.req.
 * Signing here issues a leaf from the local CA and pushes it back with
 * CertificateSigned.req (white paper use cases A02/A03).
 */
export function CsrsTab({ canOperate }: { canOperate: boolean }) {
  const [status, setStatus] = React.useState('Pending');
  const [chargePointId, setChargePointId] = React.useState('');
  const [debouncedCp, setDebouncedCp] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [viewing, setViewing] = React.useState<CsrRequest | null>(null);
  const [rejecting, setRejecting] = React.useState<CsrRequest | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCp(chargePointId);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [chargePointId]);

  const key = apiUrl('security/csrs', { status, chargePointId: debouncedCp, page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<CsrRequest>>(key, fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  async function sign(csr: CsrRequest) {
    setBusy(true);
    try {
      await api.post(`security/csrs/${encodeURIComponent(csr._id)}/sign`);
      toast.success(`Гэрчилгээг баталгаажуулж ${csr.chargePointId} руу илгээлээ`);
      setViewing(null);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <FilterBar>
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
            {['Pending', 'Signed', 'Delivered', 'Rejected', 'Failed'].map((s) => (
              <option key={s} value={s}>
                {mn(CSR_STATUS, s)}
              </option>
            ))}
          </Select>
          <Input
            className="w-auto min-w-[180px]"
            placeholder="Станцын дугаар"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Цэнэглэх станц</TH>
                <TH>Төлөв</TH>
                <TH>Баталгаажуулсан</TH>
                <TH>Шалтгаан</TH>
                <TH align="right">Хүлээн авсан</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={6} />
              ) : error ? (
                <TableEmpty colSpan={6}>Гэрчилгээний хүсэлтийг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={6}>Энэ шүүлтүүрт тохирох хүсэлт алга.</TableEmpty>
              ) : (
                rows.map((csr) => (
                  <TR key={csr._id}>
                    <TD>
                      <Link
                        href={`/charge-points/${encodeURIComponent(csr.chargePointId)}`}
                        className="text-xs font-medium hover:text-[var(--color-brand)] hover:underline"
                      >
                        {csr.chargePointId}
                      </Link>
                    </TD>
                    <TD>
                      <CsrStatusBadge status={csr.status} />
                    </TD>
                    <TD className="text-xs text-[var(--color-fg-muted)]">
                      {csr.signedBy ? (
                        <span title={formatDateTime(csr.signedAt)}>{csr.signedBy}</span>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="max-w-[220px] truncate text-xs text-[var(--color-fg-muted)]">
                      {csr.rejectedReason ?? csr.error ?? '—'}
                    </TD>
                    <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                      {formatRelative(csr.createdAt)}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewing(csr)}>
                          Шалгах
                        </Button>
                        {canOperate && csr.status === 'Pending' ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              loading={busy}
                              onClick={() => void sign(csr)}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Баталгаажуулах
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setRejecting(csr)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
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
            label="хүсэлт"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && status === 'Pending' && !debouncedCp ? (
          <EmptyState
            icon={<FileKey className="h-8 w-8" />}
            title="Баталгаажуулах хүлээлгэнд байгаа хүсэлт алга"
            description="Станцууд эдгээрийг SignCertificate.req-ээр илгээнэ. «Өргөтгөсөн дуудалт → SignChargePointCertificate» командаар дуудаж болно."
          />
        ) : null}
      </Card>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Гэрчилгээний хүсэлт"
        description={viewing?.chargePointId}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setViewing(null)}>
              Хаах
            </Button>
            {canOperate && viewing?.status === 'Pending' ? (
              <Button variant="primary" loading={busy} onClick={() => viewing && void sign(viewing)}>
                <Check className="h-3.5 w-3.5" />
                Баталгаажуулж илгээх
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
              CSR (PEM)
            </p>
            <CodeBlock className="max-h-64">{viewing?.csrPem ?? ''}</CodeBlock>
          </div>
          {viewing?.certificatePem ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                Олгосон гэрчилгээ (PEM)
              </p>
              <CodeBlock className="max-h-64">{viewing.certificatePem}</CodeBlock>
            </div>
          ) : null}
          <p className="text-xs text-[var(--color-fg-muted)]">
            Баталгаажуулснаар дотоод CA-аас гэрчилгээ олгож, CertificateSigned.req-ээр хүргэнэ.
            Станц уг CA-д урьдчилан итгэсэн байх ёстой.
          </p>
        </div>
      </Modal>

      <RejectModal
        key={rejecting?._id ?? 'none'}
        csr={rejecting}
        onClose={() => setRejecting(null)}
        onRejected={() => void mutate()}
      />
    </>
  );
}

function RejectModal({
  csr,
  onClose,
  onRejected,
}: {
  csr: CsrRequest | null;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!csr) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`security/csrs/${encodeURIComponent(csr._id)}/reject`, {
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast.success('Гэрчилгээний хүсэлтээс татгалзлаа');
      onRejected();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={csr !== null}
      onClose={onClose}
      title="Хүсэлтээс татгалзах"
      description={csr?.chargePointId}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button variant="danger" onClick={submit} loading={saving}>
            Татгалзах
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <p className="text-sm text-[var(--color-fg-muted)]">
          The charge point receives no certificate. It may raise a new request later.
        </p>
        <Field label="Шалтгаан" hint="Хүсэлтэд хадгалагдаж, аудитын түүхэнд үлдэнэ.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
