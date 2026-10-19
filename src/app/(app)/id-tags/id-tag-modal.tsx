'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { AUTHORIZATION_STATUSES, type Client, type IdTag, type Paginated } from '@/lib/types';
import { Button, Checkbox, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { ID_TAG_STATUS, mn } from '@/lib/mn';
import { Modal } from '@/components/ui/modal';
import { DatePicker } from '@/components/ui/date-picker';

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
    ownerPhone: tag?.ownerPhone ?? '',
    // The DatePicker works in YYYY-MM-DD.
    expiryDate: tag?.expiryDate ? tag.expiryDate.slice(0, 10) : '',
    maxActiveTransactions: String(tag?.maxActiveTransactions ?? 1),
    allowedChargePointIds: (tag?.allowedChargePointIds ?? []).join(', '),
    note: tag?.note ?? '',
  });

  const [isInternal, setIsInternal] = React.useState(Boolean(tag?.isInternal));
  const [isOrgCard, setIsOrgCard] = React.useState(tag?.walletOwnerType === 'CLIENT');
  const [clientId, setClientId] = React.useState(
    tag?.walletOwnerType === 'CLIENT' ? (tag.walletOwnerId ?? '') : '',
  );

  const { data: clientsData } = useSWR<Paginated<Client>>(
    isOrgCard ? apiUrl('clients', { limit: 200, status: 'active' }) : null,
    fetcher,
  );
  const clients = clientsData?.data ?? [];

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // Picking a client defaults the allow-list to exactly its own stations — an
  // internal member card has no reason to charge anywhere else, and this is
  // still a plain text field the admin can widen or narrow afterward.
  async function selectClient(id: string) {
    setClientId(id);
    if (!id) return;
    try {
      const picked = await api.get<Client>(`clients/${encodeURIComponent(id)}`);
      if (picked.stations) {
        setForm((f) => ({
          ...f,
          allowedChargePointIds: picked.stations!.map((s) => s.cpId).join(', '),
        }));
      }
    } catch {
      // Best-effort convenience fill; the admin can still type stations in by hand.
    }
  }

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
        ownerPhone: form.ownerPhone.trim() || undefined,
        isInternal: isInternal || isOrgCard,
        note: form.note.trim() || undefined,
        allowedChargePointIds: allowed.length ? allowed : undefined,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
        ...(isOrgCard
          ? { walletOwnerType: 'CLIENT', walletOwnerId: clientId }
          : isEdit && tag.walletOwnerType === 'CLIENT'
            ? { walletOwnerType: null, walletOwnerId: null }
            : {}),
      };

      if (isOrgCard && !clientId) {
        throw new Error('Байгууллага сонгоно уу');
      }

      if (isEdit) {
        await api.patch(`id-tags/${encodeURIComponent(tag.idTag)}`, body);
        toast.success(`${tag.idTag} шинэчлэгдлээ`);
      } else {
        await api.post('id-tags', { ...body, idTag: form.idTag.trim() });
        toast.success(`${form.idTag.trim()} үүслээ`);
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
      title={isEdit ? 'RFID карт засах' : 'Шинэ RFID карт'}
      description={isEdit ? tag.idTag : 'Карт нь жолоочид цэнэглэх зөвшөөрөл олгоно.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={saving}
            disabled={(!isEdit && !form.idTag.trim()) || (isOrgCard && !clientId)}
          >
            {isEdit ? 'Хадгалах' : 'Карт үүсгэх'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {!isEdit ? (
          <Field label="Картын дугаар" hint="Уншигчийн илгээх утга. Хамгийн ихдээ 20 тэмдэгт.">
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
          <Field label="Төлөв">
            <Select value={form.status} onChange={set('status')}>
              {AUTHORIZATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {mn(ID_TAG_STATUS, s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дуусах огноо" hint="Хугацаагүй бол хоосон орхино уу.">
            <DatePicker
              value={form.expiryDate}
              onChange={(expiryDate) => setForm((f) => ({ ...f, expiryDate }))}
              placeholder="Хугацаагүй"
              aria-label="Дуусах огноо"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Нэр">
            <Input value={form.label} onChange={set('label')} placeholder="Байгууллагын карт 12" />
          </Field>
          <Field label="Эцэг карт" hint="Картуудыг бүлэглэж, нэг нь нөгөөгийн цэнэглэлтийг зогсоох боломжтой болгоно.">
            <Input value={form.parentIdTag} onChange={set('parentIdTag')} className="font-mono" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Эзэмшигчийн нэр">
            <Input value={form.ownerName} onChange={set('ownerName')} />
          </Field>
          <Field label="Эзэмшигчийн и-мэйл">
            <Input type="email" value={form.ownerEmail} onChange={set('ownerEmail')} />
          </Field>
        </div>

        <Field label="Эзэмшигчийн утас" hint="Kiosk/аппад бүртгүүлсэн бол автоматаар бөглөгдөнө.">
          <Input value={form.ownerPhone} onChange={set('ownerPhone')} inputMode="tel" />
        </Field>

        <Field
          label="Зэрэг цэнэглэх дээд тоо"
          hint="0 бол хязгааргүй. Ихэвчлэн 1 байдаг."
        >
          <Input
            value={form.maxActiveTransactions}
            onChange={set('maxActiveTransactions')}
            inputMode="numeric"
          />
        </Field>

        <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-3">
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
              <Checkbox
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
              />
              Дотоод хэрэглэгч (Үнэ төлбөргүй цэнэглэх)
            </label>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              Энэ хэрэглэгч/карт станцуудад үнэ төлбөргүй цэнэглэнэ (хэтэвчний үлдэгдэл шаардахгүй). Зарцуулсан кВт болон хураамж админ тайланд бүрэн тооцогдож харагдана.
            </p>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)]">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={isOrgCard}
                onChange={(e) => {
                  setIsOrgCard(e.target.checked);
                  if (e.target.checked) setIsInternal(true);
                  if (!e.target.checked) setClientId('');
                }}
              />
              Байгууллагын дотоод гишүүний карт
            </label>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              Сонгосон харилцагчийн станцуудад энэ карт үнэ төлбөргүй цэнэглэнэ.
            </p>

            {isOrgCard ? (
              <div className="mt-3">
                <Field label="Харилцагч">
                  <Select value={clientId} onChange={(e) => void selectClient(e.target.value)}>
                    <option value="">(Сонгоогүй)</option>
                    {clients.map((c) => (
                      <option key={c.id ?? c._id} value={c.id ?? c._id}>
                        {c.name} {c.businessRegister ? `(${c.businessRegister})` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : null}
          </div>
        </div>

        <Field
          label="Зөвшөөрөх станцууд"
          hint="Таслалаар тусгаарлана. Хоосон орхивол бүх станцад ажиллана."
        >
          <Input
            value={form.allowedChargePointIds}
            onChange={set('allowedChargePointIds')}
            className="font-mono"
            placeholder="CP-UB-001, CP-UB-002"
          />
        </Field>

        <Field label="Тэмдэглэл">
          <Textarea rows={2} value={form.note} onChange={set('note')} className="font-sans text-sm" />
        </Field>
      </div>
    </Modal>
  );
}
