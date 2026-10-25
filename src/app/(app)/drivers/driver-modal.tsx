'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import type { DriverListItem } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input } from '@/components/ui/primitives';

export function DriverModal({
  driver,
  onClose,
  onSaved,
}: {
  driver?: DriverListItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(driver);

  const [name, setName] = React.useState(driver?.name || '');
  const [phone, setPhone] = React.useState(driver?.phone || '');
  const [email, setEmail] = React.useState(driver?.email || '');
  const [vehicleBrand, setVehicleBrand] = React.useState(driver?.vehicleBrand || '');
  const [vehicleModel, setVehicleModel] = React.useState(driver?.vehicleModel || '');
  const [ebarimtCustomerNo, setEbarimtCustomerNo] = React.useState(driver?.ebarimtCustomerNo || '');
  const [idTag, setIdTag] = React.useState(driver?.idTag || '');
  const [initialBalance, setInitialBalance] = React.useState<string>('');
  const [isInternal, setIsInternal] = React.useState(Boolean(driver?.isInternal));
  const [isActive, setIsActive] = React.useState(driver ? driver.isActive : true);

  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Утасны дугаар заавал шаардлагатай');
      return;
    }

    setBusy(true);
    try {
      if (isEditing && driver) {
        await api.patch(`drivers/${driver.id}`, {
          name: name.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          vehicleBrand: vehicleBrand.trim() || undefined,
          vehicleModel: vehicleModel.trim() || undefined,
          ebarimtCustomerNo: ebarimtCustomerNo.trim() || undefined,
          idTag: idTag.trim() || undefined,
          isInternal,
          isActive,
        });
        toast.success('Жолоочийн мэдээллийг шинэчиллээ');
      } else {
        const initBal = Number(initialBalance.replace(/[^0-9]/g, '')) || 0;
        await api.post('drivers', {
          phone: phone.trim(),
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          vehicleBrand: vehicleBrand.trim() || undefined,
          vehicleModel: vehicleModel.trim() || undefined,
          ebarimtCustomerNo: ebarimtCustomerNo.trim() || undefined,
          idTag: idTag.trim() || undefined,
          initialBalance: initBal,
          isInternal,
        });
        toast.success('Шинэ жолооч амжилттай бүртгэгдлээ');
      }
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
      title={isEditing ? 'Жолоочийн мэдээлэл засах' : 'Шинэ жолооч бүртгэх'}
      description={
        isEditing
          ? 'Жолоочийн хувийн мэдээлэл, холбогдох тохиргоог өөрчлөх'
          : 'Системд шинэ жолооч бүртгэж хэтэвч үүсгэх'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Утасны дугаар *" hint="Жолоочийн нэвтрэх дугаар">
            <Input
              type="tel"
              required
              placeholder="Жишээ: 99112233"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          <Field label="Жолоочийн нэр">
            <Input
              type="text"
              placeholder="Жишээ: Бат-Эрдэнэ"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Имэйл хаяг">
            <Input
              type="email"
              placeholder="user@example.mn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="И-Баримт код" hint="Хэрэглэгчийн 8 оронтой код">
            <Input
              type="text"
              placeholder="Жишээ: 12345678"
              value={ebarimtCustomerNo}
              onChange={(e) => setEbarimtCustomerNo(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Машины марк">
            <Input
              type="text"
              placeholder="Жишээ: Nissan, BYD, Tesla"
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
            />
          </Field>

          <Field label="Машины загвар">
            <Input
              type="text"
              placeholder="Жишээ: Leaf, Atto 3, Model Y"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Үндсэн RFID карт" hint="Карт эсвэл Tag дугаар">
            <Input
              type="text"
              placeholder="Жишээ: E1234567"
              value={idTag}
              onChange={(e) => setIdTag(e.target.value)}
            />
          </Field>

          {!isEditing ? (
            <Field label="Анхны хэтэвчний үлдэгдэл (₮)">
              <Input
                type="number"
                min="0"
                step="500"
                placeholder="0 ₮"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[var(--color-fg)]">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)]"
            />
            <span>
              Байгууллагын дотоод жолооч (Үнэ төлбөргүй цэнэглэлтийн эрхтэй)
            </span>
          </label>

          {isEditing ? (
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[var(--color-fg)]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)]"
              />
              <span>Хандалт идэвхтэй (Түгжээгүй)</span>
            </label>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Болих
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {isEditing ? 'Шинэчлэх' : 'Бүртгэх'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
