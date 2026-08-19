'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { AUTHORIZATION_STATUSES, type IdTag } from '@/lib/types';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';

/** Create or edit a single RFID tag. Mount with a `key` so state resets per tag. */
export function IdTagModal({
  open,
  tag,
  onClose,
  onSaved,
}: {
  open: boolean;
  tag: IdTag | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = tag !== null;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    idTag: tag?.idTag ?? '',
    status: tag?.status ?? 'Accepted',
    parentIdTag: tag?.parentIdTag ?? '',
    label: tag?.label ?? '',
    ownerName: tag?.ownerName ?? '',
    ownerEmail: tag?.ownerEmail ?? '',
    // <input type="date"> wants YYYY-MM-DD.
    expiryDate: tag?.expiryDate ? tag.expiryDate.slice(0, 10) : '',
    maxActiveTransactions: String(tag?.maxActiveTransactions ?? 1),
    allowedChargePointIds: (tag?.allowedChargePointIds ?? []).join(', '),
    note: tag?.note ?? '',
  });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const allowed = form.allowedChargePointIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        status: form.status,
        maxActiveTransactions: Number(form.maxActiveTransactions) || 0,
        // Send empty strings as undefined so the backend does not store blanks.
        parentIdTag: form.parentIdTag.trim() || undefined,
        label: form.label.trim() || undefined,
        ownerName: form.ownerName.trim() || undefined,
        ownerEmail: form.ownerEmail.trim() || undefined,
        note: form.note.trim() || undefined,
        allowedChargePointIds: allowed.length ? allowed : undefined,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
      };

      if (isEdit) {
        await api.patch(`id-tags/${encodeURIComponent(tag.idTag)}`, body);
        toast.success(`${tag.idTag} updated`);
      } else {
        await api.post('id-tags', { ...body, idTag: form.idTag.trim() });
        toast.success(`${form.idTag.trim()} created`);
      }
      onSaved();
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
      title={isEdit ? 'Edit RFID tag' : 'New RFID tag'}
      description={isEdit ? tag.idTag : 'Tags authorise a driver to start charging.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={saving}
            disabled={!isEdit && !form.idTag.trim()}
          >
            {isEdit ? 'Save changes' : 'Create tag'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {!isEdit ? (
          <Field label="Tag id" hint="The value the reader sends. Up to 20 characters.">
            <Input
              value={form.idTag}
              onChange={set('idTag')}
              className="font-mono"
              placeholder="04A1B2C3D4E5F6"
              autoFocus
            />
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {AUTHORIZATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expiry date" hint="Leave empty for no expiry.">
            <Input type="date" value={form.expiryDate} onChange={set('expiryDate')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label">
            <Input value={form.label} onChange={set('label')} placeholder="Fleet card 12" />
          </Field>
          <Field label="Parent tag" hint="Groups tags so one can stop another's session.">
            <Input value={form.parentIdTag} onChange={set('parentIdTag')} className="font-mono" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner name">
            <Input value={form.ownerName} onChange={set('ownerName')} />
          </Field>
          <Field label="Owner email">
            <Input type="email" value={form.ownerEmail} onChange={set('ownerEmail')} />
          </Field>
        </div>

        <Field
          label="Max concurrent sessions"
          hint="0 means unlimited. 1 is the usual choice."
        >
          <Input
            value={form.maxActiveTransactions}
            onChange={set('maxActiveTransactions')}
            inputMode="numeric"
          />
        </Field>

        <Field
          label="Restrict to charge points"
          hint="Comma-separated ids. Leave empty to allow every charge point."
        >
          <Input
            value={form.allowedChargePointIds}
            onChange={set('allowedChargePointIds')}
            className="font-mono"
            placeholder="CP-UB-001, CP-UB-002"
          />
        </Field>

        <Field label="Note">
          <Textarea rows={2} value={form.note} onChange={set('note')} className="font-sans text-sm" />
        </Field>
      </div>
    </Modal>
  );
}
