'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input } from '@/components/ui/primitives';

export function BindTagModal({
  driverId,
  driverName,
  onClose,
  onSaved,
}: {
  driverId: string;
  driverName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [idTag, setIdTag] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [isInternal, setIsInternal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idTag.trim()) {
      toast.error('RFID картын дугаар оруулна уу');
      return;
    }

    setBusy(true);
    try {
      await api.post(`drivers/${driverId}/rfid`, {
        idTag: idTag.trim(),
        label: label.trim() || undefined,
        isInternal,
      });
      toast.success('RFID карт амжилттай холбогдлоо');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="RFID карт холбох"
      description={`${driverName} жолоочийн хэтэвчинд шинэ карт холбох`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="RFID картын дугаар (ID Tag) *" hint="Физик карт эсвэл NFC дугаар">
          <Input
            type="text"
            required
            placeholder="Жишээ: 04A1B2C3D4"
            value={idTag}
            onChange={(e) => setIdTag(e.target.value)}
          />
        </Field>

        <Field label="Картын шошго / нэр" hint="Картыг ялгах тайлбар">
          <Input
            type="text"
            placeholder="Жишээ: Цэнхэр түлхүүрийн оосор"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[var(--color-fg)]">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)]"
            />
            <span>Энэ картыг дотоод үнэ төлбөргүй цэнэглэлтээр ашиглах</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Болих
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Холбох
          </Button>
        </div>
      </form>
    </Modal>
  );
}
