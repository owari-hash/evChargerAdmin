'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { FileSearch, ScrollText } from 'lucide-react';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDate, formatDateTime } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { CERTIFICATE_TYPES, type CertificateRecord, type Paginated } from '@/lib/types';
import { Badge, Button, Card, CodeBlock, EmptyState, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { CopyButton } from '@/components/ui/copy-button';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

export function CertificatesTab() {
  const now = useNow();
  const [type, setType] = React.useState('');
  const [chargePointId, setChargePointId] = React.useState('');
  const [debouncedCp, setDebouncedCp] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [viewing, setViewing] = React.useState<CertificateRecord | null>(null);
  const [inspecting, setInspecting] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCp(chargePointId);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [chargePointId]);

  const key = apiUrl('security/certificates', { type, chargePointId: debouncedCp, page, limit });
  const { data, error, isLoading } = useSWR<Paginated<CertificateRecord>>(key, fetcher, {
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  return (
    <>
      <Card>
        <FilterBar>
          <Select
            className="w-auto"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            aria-label="Гэрчилгээний төрөл"
          >
            <option value="">Бүх төрөл</option>
            {CERTIFICATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            className="w-auto min-w-[180px]"
            placeholder="Станцын дугаар"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setInspecting(true)}>
            <FileSearch className="h-3.5 w-3.5" />
            Inspect a PEM
          </Button>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Эзэмшигч</TH>
                <TH>Төрөл</TH>
                <TH>Цэнэглэх станц</TH>
                <TH>Олгогч</TH>
                <TH>Сериал</TH>
                <TH>Хүчинтэй хугацаа</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={7} />
              ) : error ? (
                <TableEmpty colSpan={7}>Гэрчилгээг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={7}>Бүртгэгдсэн гэрчилгээ алга.</TableEmpty>
              ) : (
                rows.map((cert) => {
                  const expired =
                    cert.validTo != null && new Date(cert.validTo).getTime() < now;
                  return (
                    <TR key={cert._id}>
                      <TD className="max-w-[240px] truncate text-xs font-medium">
                        {cert.subject ?? '—'}
                      </TD>
                      <TD>
                        <Badge tone="idle">{cert.type.replace('Certificate', '')}</Badge>
                      </TD>
                      <TD className="text-xs">
                        {cert.chargePointId ? (
                          <Link
                            href={`/charge-points/${encodeURIComponent(cert.chargePointId)}`}
                            className="hover:text-[var(--color-brand)] hover:underline"
                          >
                            {cert.chargePointId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD className="max-w-[200px] truncate text-xs text-[var(--color-fg-muted)]">
                        {cert.issuer ?? '—'}
                      </TD>
                      <TD className="max-w-[140px] truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                        {cert.serialNumber ?? '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-xs">
                        <span className={expired ? 'text-[var(--color-danger)]' : undefined}>
                          {formatDate(cert.validTo)}
                          {expired ? ' (expired)' : ''}
                        </span>
                      </TD>
                      <TD align="right">
                        <Button variant="ghost" size="sm" onClick={() => setViewing(cert)}>
                          Дэлгэрэнгүй
                        </Button>
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
            label="гэрчилгээ"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !type && !debouncedCp ? (
          <EmptyState
            icon={<ScrollText className="h-8 w-8" />}
            title="Гэрчилгээ бүртгэгдээгүй"
            description="Станц дээр суусан эсвэл дотоод CA-аас олгогдсон гэрчилгээ энд харагдана."
          />
        ) : null}
      </Card>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Гэрчилгээ"
        description={viewing?.subject}
        size="lg"
        footer={
          <>
            {viewing?.pem ? <CopyButton value={viewing.pem} variant="secondary" label="PEM хуулах" /> : null}
            <Button variant="ghost" onClick={() => setViewing(null)}>
              Close
            </Button>
          </>
        }
      >
        {viewing ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              <Detail label="Төрөл" value={viewing.type} />
              <Detail label="Цэнэглэх станц" value={viewing.chargePointId ?? '—'} />
              <Detail label="Эзэмшигч" value={viewing.subject ?? '—'} />
              <Detail label="Олгогч" value={viewing.issuer ?? '—'} />
              <Detail label="Сериал дугаар" value={viewing.serialNumber ?? '—'} mono />
              <Detail label="Хэш алгоритм" value={viewing.hashAlgorithm ?? '—'} />
              <Detail label="Хүчинтэй эхлэх" value={formatDateTime(viewing.validFrom)} />
              <Detail label="Хүчинтэй дуусах" value={formatDateTime(viewing.validTo)} />
              <Detail label="Олгогчийн нэрийн хэш" value={viewing.issuerNameHash ?? '—'} mono />
              <Detail label="Олгогчийн түлхүүрийн хэш" value={viewing.issuerKeyHash ?? '—'} mono />
            </dl>
            {viewing.pem ? <CodeBlock className="max-h-64">{viewing.pem}</CodeBlock> : null}
          </div>
        ) : null}
      </Modal>

      <InspectModal open={inspecting} onClose={() => setInspecting(false)} />
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-1">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">{label}</dt>
      <dd className={`truncate text-xs ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

/** Paste a PEM to get its CertificateHashDataType — the input DeleteCertificate needs. */
function InspectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pem, setPem] = React.useState('');
  const [result, setResult] = React.useState<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.post<unknown>('security/certificates/inspect', { certificate: pem }));
    } catch (err) {
      setError(errorMessage(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Гэрчилгээ шалгах"
      description="DeleteCertificate командад хэрэглэх CertificateHashData-г буцаана."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Хаах
          </Button>
          <Button variant="primary" onClick={submit} loading={loading} disabled={!pem.trim()}>
            Шалгах
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Field label="Гэрчилгээ (PEM)">
          <Textarea
            rows={8}
            value={pem}
            onChange={(e) => setPem(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----"
          />
        </Field>
        {result ? <CodeBlock>{JSON.stringify(result, null, 2)}</CodeBlock> : null}
      </div>
    </Modal>
  );
}
