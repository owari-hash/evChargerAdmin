'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { AUTHORIZATION_STATUSES, type AuthorizationStatus } from '@/lib/types';
import { Button, ErrorNote, Field, Select, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { formatNumber } from '@/lib/format';

const MAX_TAGS = 5000;

interface ParsedTag {
  idTag: string;
  status: AuthorizationStatus;
  label?: string;
  ownerName?: string;
}

/**
 * Paste-based import. Accepts one tag per line, optionally with a label and
 * owner after commas — enough to migrate a spreadsheet without a file upload.
 */
export function BulkImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = React.useState('');
  const [status, setStatus] = React.useState<AuthorizationStatus>('Accepted');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parsed = React.useMemo<{ tags: ParsedTag[]; skipped: number }>(() => {
    const tags: ParsedTag[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [rawId, label, ownerName] = trimmed.split(',').map((s) => s.trim());
      const idTag = rawId?.slice(0, 20);
      if (!idTag || seen.has(idTag)) {
        skipped += 1;
        continue;
      }
      seen.add(idTag);
      tags.push({
        idTag,
        status,
        ...(label ? { label } : {}),
        ...(ownerName ? { ownerName } : {}),
      });
    }
    return { tags, skipped };
  }, [text, status]);

  const tooMany = parsed.tags.length > MAX_TAGS;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ inserted: number; updated: number }>('id-tags/bulk', {
        tags: parsed.tags,
      });
      toast.success(
        `${formatNumber(res.inserted)} шинэ карт нэмж, ${formatNumber(res.updated)}-г шинэчиллээ`,
      );
      onImported();
      setText('');
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
      title="RFID карт бөөнөөр оруулах"
      description={`Нэг удаад ${formatNumber(MAX_TAGS)} хүртэл карт. Бүртгэлтэй картууд шинэчлэгдэнэ.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={saving}
            disabled={parsed.tags.length === 0 || tooMany}
          >
            {formatNumber(parsed.tags.length)} карт оруулах
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {tooMany ? (
          <ErrorNote>
            {formatNumber(parsed.tags.length)} карт нь {formatNumber(MAX_TAGS)} хязгаараас хэтэрлээ.
            Хэсэгчлэн оруулна уу.
          </ErrorNote>
        ) : null}

        <Field label="Оруулах бүх картад өгөх төлөв">
          <Select
            className="w-auto"
            value={status}
            onChange={(e) => setStatus(e.target.value as AuthorizationStatus)}
          >
            {AUTHORIZATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Картууд"
          hint="Мөр бүрд нэг карт: дугаар, нэр (заавал бус), эзэмшигч (заавал бус). # тэмдэгтээр эхэлсэн мөрийг алгасна."
        >
          <Textarea
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'04A1B2C3D4E5F6, Байгууллагын карт 1, Б. Отгонбилэг\n04FFEEDDCCBBAA, Зочны карт'}
          />
        </Field>

        <p className="text-xs text-[var(--color-fg-muted)]">
          {formatNumber(parsed.tags.length)} tag{parsed.tags.length === 1 ? '' : 's'} ready
          {parsed.skipped > 0
            ? ` · ${formatNumber(parsed.skipped)} line${parsed.skipped === 1 ? '' : 's'} skipped as blank or duplicate`
            : ''}
          .
        </p>
      </div>
    </Modal>
  );
}
