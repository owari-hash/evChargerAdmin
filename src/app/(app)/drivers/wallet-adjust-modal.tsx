'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input, Select } from '@/components/ui/primitives';

export function WalletAdjustModal({
  driverId,
  driverName,
  currentBalance,
  onClose,
  onSaved,
}: {
  driverId: string;
  driverName: string;
  currentBalance: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = React.useState('');
  const [type, setType] = React.useState<'TOPUP' | 'BONUS' | 'ADJUSTMENT'>('TOPUP');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount.replace(/[^0-9]/g, ''));
    if (!num || num <= 0) {
      toast.error('Цэнэглэх дүнгээ зөв оруулна уу');
      return;
    }
    if (!note.trim()) {
      toast.error('Гүйлгээний утга/тайлбар заавал шаардлагатай');
      return;
    }

    setBusy(true);
    try {
      await api.post(`drivers/${driverId}/wallet-adjust`, {
        amount: num,
        type,
        note: note.trim(),
      });
      toast.success('Хэтэвчний үлдэгдлийг амжилттай шинэчиллээ');
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
      title="Хэтэвч цэнэглэх / засах"
      description={`${driverName} жолоочийн хэтэвчинд үлдэгдэл оруулах`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <p className="text-xs text-[var(--color-fg-subtle)]">Одоогийн үлдэгдэл:</p>
          <p className="text-xl font-bold text-[var(--color-fg)] tnum">
            {currentBalance.toLocaleString()} ₮
          </p>
        </div>

        <Field label="Гүйлгээний төрөл">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as 'TOPUP' | 'BONUS' | 'ADJUSTMENT')}
            options={[
              { value: 'TOPUP', label: 'Данс цэнэглэлт (Top-up)' },
              { value: 'BONUS', label: 'Урамшуулал / Бонус (Bonus)' },
              { value: 'ADJUSTMENT', label: 'Залруулга / Тохируулга (Adjustment)' },
            ]}
          />
        </Field>

        <Field label="Нэмэх дүн (₮) *">
          <Input
            type="number"
            min="100"
            step="500"
            required
            placeholder="Жишээ: 10000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field label="Тайлбар / Утга *" hint="Шалтгаан эсвэл баримтын дугаар">
          <Input
            type="text"
            required
            placeholder="Жишээ: Бэлнээр төлсөн баримт #1024"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Болих
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Баталгаажуулах
          </Button>
        </div>
      </form>
    </Modal>
  );
}
