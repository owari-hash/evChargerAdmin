'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { CopyButton } from '@/components/ui/copy-button';
import { REGISTRATION_STATUS as REGISTRATION_STATUS_MN, mn } from '@/lib/mn';
import { REGISTRATION_STATUSES } from '@/lib/types';

interface CreatedResponse {
  id: string;
  authorizationKey: string;
}

export function CreateChargePointModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<CreatedResponse | null>(null);

  const [form, setForm] = React.useState({
    id: '',
    name: '',
    address: '',
    registrationStatus: 'Accepted',
    heartbeatInterval: '300',
    tariffPerKwh: '',
    securityProfile: '1',
    latitude: '',
    longitude: '',
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function reset() {
    setForm({
      id: '',
      name: '',
      address: '',
      registrationStatus: 'Accepted',
      heartbeatInterval: '300',
      tariffPerKwh: '',
      securityProfile: '1',
      latitude: '',
      longitude: '',
    });
    setError(null);
    setCreated(null);
  }

  function close() {
    onClose();
    // Let the closing animation finish before wiping the one-time key.
    setTimeout(reset, 200);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        id: form.id.trim(),
        registrationStatus: form.registrationStatus,
        securityProfile: Number(form.securityProfile),
        heartbeatInterval: Number(form.heartbeatInterval) || 300,
      };
      if (form.name.trim()) body.name = form.name.trim();
      if (form.address.trim()) body.address = form.address.trim();
      if (form.tariffPerKwh) body.tariffPerKwh = Number(form.tariffPerKwh);
      if (form.latitude) body.latitude = Number(form.latitude);
      if (form.longitude) body.longitude = Number(form.longitude);

      const res = await api.post<CreatedResponse>('charge-points', body);
      setCreated(res);
      onCreated?.();
      router.refresh();
      toast.success(`${res.id} станц бүртгэгдлээ`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ---- Step 2: show the generated key exactly once ------------------------
  if (created) {
    return (
      <Modal
        open={open}
        onClose={close}
        title="Станц бүртгэгдлээ"
        description={created.id}
        footer={
          <Button variant="primary" onClick={close}>
            Түлхүүрийг хадгаллаа
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn-soft)] px-3 py-2.5 text-xs text-[var(--color-warn)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              AuthorizationKey зөвхөн энэ удаа харагдана. Түлхүүр хэшлэгдэж хадгалагдах тул
              дараа нь харах боломжгүй — зөвхөн шинэчлэх боломжтой.
            </p>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-fg-muted)]">
              <KeyRound className="h-3.5 w-3.5" />
              AuthorizationKey
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-xs">
                {created.authorizationKey}
              </code>
              <CopyButton value={created.authorizationKey} variant="secondary" label="Хуулах" />
            </div>
          </div>

          <p className="text-xs text-[var(--color-fg-muted)]">
            Үүнийг станцын <code className="font-mono">AuthorizationKey</code> тохиргоонд
            оруулна уу. Станц HTTP Basic нэвтрэлтээр{' '}
            <code className="font-mono">{created.id}</code> хэрэглэгчийн нэрээр холбогдоно.
          </p>
        </div>
      </Modal>
    );
  }

  // ---- Step 1: the form ---------------------------------------------------
  return (
    <Modal
      open={open}
      onClose={close}
      title="Станц бүртгэх"
      description="Урьдчилан бүртгэснээр нэргүй холболтыг хааж болно."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Цуцлах
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!form.id.trim()}>
            Бүртгэх
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <Field
          label="Станцын дугаар"
          hint="WebSocket хаяг дахь нэртэй яг таарах ёстой. Зөвхөн үсэг, тоо болон . : @ _ - тэмдэгт."
        >
          <Input
            value={form.id}
            onChange={set('id')}
            placeholder="CP-UB-001"
            autoFocus
            className="font-mono"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Харагдах нэр">
            <Input value={form.name} onChange={set('name')} placeholder="Сүхбаатарын талбай #1" />
          </Field>
          <Field label="Хаяг">
            <Input value={form.address} onChange={set('address')} placeholder="Улаанбаатар" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Өргөрөг">
            <Input value={form.latitude} onChange={set('latitude')} placeholder="47.9186" inputMode="decimal" />
          </Field>
          <Field label="Уртраг">
            <Input value={form.longitude} onChange={set('longitude')} placeholder="106.9176" inputMode="decimal" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Бүртгэлийн төлөв">
            <Select value={form.registrationStatus} onChange={set('registrationStatus')}>
              {REGISTRATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {mn(REGISTRATION_STATUS_MN, s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Аюулгүй байдлын профайл">
            <Select value={form.securityProfile} onChange={set('securityProfile')}>
              <option value="1">1 — ws дээр Basic</option>
              <option value="2">2 — wss дээр Basic</option>
              <option value="3">3 — Харилцан TLS</option>
            </Select>
          </Field>
          <Field label="Амьд дохио (сек)">
            <Input
              value={form.heartbeatInterval}
              onChange={set('heartbeatInterval')}
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field label="1 кВт·ц тариф (₮)" hint="Дууссан цэнэглэлтийн төлбөрийг тооцоход ашиглана. Үнэгүй бол хоосон орхино уу.">
          <Input value={form.tariffPerKwh} onChange={set('tariffPerKwh')} placeholder="450" inputMode="decimal" />
        </Field>
      </div>
    </Modal>
  );
}
