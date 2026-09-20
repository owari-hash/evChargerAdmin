'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import type { Client, ClientInput } from '@/lib/types';

export function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client?: Client | null;
  onClose: () => void;
  onSaved?: (saved: Client) => void;
}) {
  const isNew = !client;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<ClientInput>({
    name: client?.name ?? '',
    businessRegister: client?.businessRegister ?? '',
    contactPerson: client?.contactPerson ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    description: client?.description ?? '',
    isActive: client?.isActive ?? true,
  });

  const set =
    (key: keyof ClientInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = key === 'isActive' ? e.target.value === 'true' : e.target.value;
      setForm((f) => ({ ...f, [key]: val }));
    };

  async function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      setError('Харилцагчийн нэрийг оруулна уу.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      businessRegister: form.businessRegister?.trim() || null,
      contactPerson: form.contactPerson?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      address: form.address?.trim() || null,
      description: form.description?.trim() || null,
      isActive: form.isActive ?? true,
    };

    try {
      let result: Client;
      if (isNew) {
        result = await api.post<Client>('clients', payload);
        toast.success(`Харилцагч "${result.name}" амжилттай бүртгэгдлээ`);
      } else {
        const id = client.id || client._id;
        result = await api.patch<Client>(`clients/${encodeURIComponent(id!)}`, payload);
        toast.success(`Харилцагч "${result.name}" мэдээлэл шинэчлэгдлээ`);
      }
      onSaved?.(result);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Шинэ харилцагч бүртгэх' : 'Харилцагчийн мэдээлэл засах'}
      description={isNew ? 'Цэнэглэх станц эзэмшигч байгууллага, харилцагчийн мэдээлэл' : client.name}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            {isNew ? 'Бүртгэх' : 'Хадгалах'}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Харилцагчийн нэр *" hint="Компани эсвэл хувь хүний нэр">
            <Input
              value={form.name}
              onChange={set('name')}
              placeholder="Жнь: Шангри-Ла Молл, Номин Холдинг..."
              autoFocus
              required
            />
          </Field>

          <Field label="Регистрийн дугаар" hint="ААН эсвэл иргэний регистр">
            <Input
              value={form.businessRegister ?? ''}
              onChange={set('businessRegister')}
              placeholder="Жнь: 1234567, 5432109..."
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Холбоо барих хүн">
            <Input
              value={form.contactPerson ?? ''}
              onChange={set('contactPerson')}
              placeholder="Ажилтны нэр, албан тушаал"
            />
          </Field>

          <Field label="Утасны дугаар">
            <Input
              value={form.phone ?? ''}
              onChange={set('phone')}
              placeholder="Жнь: 99112233, 77001122"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Имэйл хаяг">
            <Input
              type="email"
              value={form.email ?? ''}
              onChange={set('email')}
              placeholder="contact@company.mn"
            />
          </Field>

          <Field label="Төлөв">
            <Select value={String(form.isActive)} onChange={set('isActive')}>
              <option value="true">Идэвхтэй (Хамтран ажиллаж буй)</option>
              <option value="false">Идэвхгүй (Түр зогсоосон)</option>
            </Select>
          </Field>
        </div>

        <Field label="Хаяг байршил">
          <Input
            value={form.address ?? ''}
            onChange={set('address')}
            placeholder="УБ хот, Сүхбаатар дүүрэг, 1-р хороо..."
          />
        </Field>

        <Field label="Тэмдэглэл / Тайлбар">
          <Textarea
            rows={2}
            value={form.description ?? ''}
            onChange={set('description')}
            placeholder="Гэрээний нөхцөл, онцлог эсвэл бусад нэмэлт мэдээлэл..."
          />
        </Field>
      </form>
    </Modal>
  );
}
