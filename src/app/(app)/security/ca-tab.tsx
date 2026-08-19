'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Landmark, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  CodeBlock,
  DataRow,
  EmptyState,
  ErrorNote,
  Field,
  Input,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { CopyButton } from '@/components/ui/copy-button';

interface CaInfo {
  present: boolean;
  certPath: string;
  pem?: string;
  subject?: string;
  issuer?: string;
  serialNumber?: string;
  validFrom?: string;
  validTo?: string;
  hashAlgorithm?: string;
}

/**
 * The CSMS's own certificate authority, used to sign charge point CSRs. Points
 * at CSMS_CA_CERT_PATH on the backend — swap those paths for a real PKI if you
 * have one.
 */
export function CaTab({ canAdmin }: { canAdmin: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<CaInfo>(apiUrl('security/ca'), fetcher);
  const [generating, setGenerating] = React.useState(false);
  const now = useNow();

  const expired = data?.validTo != null && new Date(data.validTo).getTime() < now;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Дотоод гэрчилгээжүүлэх төв (CA)"
            description="3-р аюулгүй байдлын профайлд станцын гэрчилгээг баталгаажуулна."
            actions={
              canAdmin ? (
                <Button variant={data?.present ? 'secondary' : 'primary'} size="sm" onClick={() => setGenerating(true)}>
                  {data?.present ? 'CA дахин үүсгэх' : 'CA үүсгэх'}
                </Button>
              ) : null
            }
          />

          {isLoading ? (
            <div className="p-5 text-sm text-[var(--color-fg-muted)]">Ачаалж байна…</div>
          ) : error ? (
            <div className="p-5">
              <ErrorNote>Сервэрээс CA-г уншиж чадсангүй.</ErrorNote>
            </div>
          ) : !data?.present ? (
            <EmptyState
              icon={<Landmark className="h-8 w-8" />}
              title="CA тохируулаагүй байна"
              description={`${data?.certPath ?? 'Заасан зам'} дээр юу ч олдсонгүй. Эндээс үүсгэх, эсвэл сервер дээр "npm run seed -- --ca" ажиллуулна уу.`}
              action={
                canAdmin ? (
                  <Button variant="primary" size="sm" onClick={() => setGenerating(true)}>
                    Generate CA
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              {expired ? (
                <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  This CA has expired. Certificates it signed are no longer trusted.
                </div>
              ) : null}

              <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
                <DataRow label="Төлөв">
                  <Badge tone={expired ? 'danger' : 'ok'}>{expired ? 'Хугацаа дууссан' : 'Идэвхтэй'}</Badge>
                </DataRow>
                <DataRow label="Эзэмшигч">{data.subject ?? '—'}</DataRow>
                <DataRow label="Олгогч">{data.issuer ?? '—'}</DataRow>
                <DataRow label="Сериал дугаар" mono>
                  {data.serialNumber ?? '—'}
                </DataRow>
                <DataRow label="Хэш алгоритм">{data.hashAlgorithm ?? '—'}</DataRow>
                <DataRow label="Хүчинтэй эхлэх">{formatDateTime(data.validFrom)}</DataRow>
                <DataRow label="Хүчинтэй дуусах">{formatDateTime(data.validTo)}</DataRow>
                <DataRow label="Сервер дэх зам" mono>
                  {data.certPath}
                </DataRow>
              </dl>
            </>
          )}
        </Card>

        <Card>
          <CardHeader
            title="CA гэрчилгээ"
            description="Үүнийг станцууд дээрээ суулгана уу."
            actions={data?.pem ? <CopyButton value={data.pem} label="Хуулах" /> : null}
          />
          <div className="p-4">
            {data?.pem ? (
              <CodeBlock className="max-h-[420px]">{data.pem}</CodeBlock>
            ) : (
              <p className="py-8 text-center text-xs text-[var(--color-fg-muted)]">
                Гэрчилгээ байхгүй байна.
              </p>
            )}
          </div>
        </Card>
      </div>

      <GenerateCaModal
        key={generating ? 'open' : 'closed'}
        open={generating}
        hasExisting={data?.present ?? false}
        onClose={() => setGenerating(false)}
        onGenerated={() => void mutate()}
      />
    </>
  );
}

function GenerateCaModal({
  open,
  hasExisting,
  onClose,
  onGenerated,
}: {
  open: boolean;
  hasExisting: boolean;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [commonName, setCommonName] = React.useState('eplug.mn CSMS Root CA');
  const [years, setYears] = React.useState('10');
  const [force, setForce] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post('security/ca/generate', {
        commonName: commonName.trim(),
        years: Number(years) || 10,
        force,
      });
      toast.success('CA үүслээ');
      onGenerated();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={hasExisting ? 'CA дахин үүсгэх' : 'CA үүсгэх'}
      description="Станцын гэрчилгээг баталгаажуулах өөрөө гарын үсэг зурсан үндсэн гэрчилгээ үүсгэнэ."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button
            variant={hasExisting ? 'danger' : 'primary'}
            onClick={submit}
            loading={saving}
            disabled={hasExisting && !force}
          >
            Үүсгэх
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {hasExisting ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3 py-2.5 text-xs text-[var(--color-danger)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              A CA already exists. Replacing it invalidates every certificate it signed — those
              charge points will fail mutual TLS until they are re-issued and the new CA is
              installed on them.
            </p>
          </div>
        ) : null}

        <Field label="Нэр (Common name)">
          <Input value={commonName} onChange={(e) => setCommonName(e.target.value)} />
        </Field>

        <Field label="Хүчинтэй хугацаа (жил)" hint="1-ээс 30 хооронд.">
          <Input value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" />
        </Field>

        {hasExisting ? (
          <label className="flex items-start gap-2 text-xs text-[var(--color-fg-muted)]">
            <Checkbox
              className="mt-0.5"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            <span>
              Энэ нь одоо байгаа CA-г дарж бичих бөгөөд өмнө олгосон гэрчилгээнүүд ажиллахгүй болохыг ойлголоо.
            </span>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
