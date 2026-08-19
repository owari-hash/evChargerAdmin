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
      toast.success(`Certificate signed and pushed to ${csr.chargePointId}`);
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
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {['Pending', 'Signed', 'Delivered', 'Rejected', 'Failed'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Input
            className="w-auto min-w-[180px]"
            placeholder="Charge point id"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Charge point</TH>
                <TH>Status</TH>
                <TH>Signed by</TH>
                <TH>Reason</TH>
                <TH align="right">Received</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={6} />
              ) : error ? (
                <TableEmpty colSpan={6}>Could not load signing requests.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={6}>No signing requests match these filters.</TableEmpty>
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
                          Inspect
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
                              Sign
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
            label="requests"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && status === 'Pending' && !debouncedCp ? (
          <EmptyState
            icon={<FileKey className="h-8 w-8" />}
            title="Nothing waiting to be signed"
            description="Charge points raise these with SignCertificate.req. Trigger one with Extended trigger → SignChargePointCertificate."
          />
        ) : null}
      </Card>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Certificate signing request"
        description={viewing?.chargePointId}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setViewing(null)}>
              Close
            </Button>
            {canOperate && viewing?.status === 'Pending' ? (
              <Button variant="primary" loading={busy} onClick={() => viewing && void sign(viewing)}>
                <Check className="h-3.5 w-3.5" />
                Sign and push
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
                Issued certificate (PEM)
              </p>
              <CodeBlock className="max-h-64">{viewing.certificatePem}</CodeBlock>
            </div>
          ) : null}
          <p className="text-xs text-[var(--color-fg-muted)]">
            Signing issues a leaf certificate from the local CA and delivers it with
            CertificateSigned.req. The charge point must already trust the CA.
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
      toast.success('Signing request rejected');
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
      title="Reject signing request"
      description={csr?.chargePointId}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={saving}>
            Reject
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <p className="text-sm text-[var(--color-fg-muted)]">
          The charge point receives no certificate. It may raise a new request later.
        </p>
        <Field label="Reason" hint="Stored on the request for the audit trail.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
