'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { CopyButton } from '@/components/ui/copy-button';
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
      toast.success(`Charge point ${res.id} registered`);
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
        title="Charge point registered"
        description={created.id}
        footer={
          <Button variant="primary" onClick={close}>
            I have saved the key
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn-soft)] px-3 py-2.5 text-xs text-[var(--color-warn)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This is the only time the AuthorizationKey is shown. It is stored hashed and cannot be
              retrieved later — only rotated.
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
              <CopyButton value={created.authorizationKey} variant="secondary" label="Copy" />
            </div>
          </div>

          <p className="text-xs text-[var(--color-fg-muted)]">
            Set this as the charge point&apos;s <code className="font-mono">AuthorizationKey</code>{' '}
            configuration key. It connects with HTTP Basic auth using{' '}
            <code className="font-mono">{created.id}</code> as the username.
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
      title="Register charge point"
      description="Pre-registering lets you turn off anonymous connections."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!form.id.trim()}>
            Register
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <Field
          label="Charge point ID"
          hint="Must match the identity in the WebSocket URL. Letters, digits and . : @ _ - only."
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
          <Field label="Display name">
            <Input value={form.name} onChange={set('name')} placeholder="Sukhbaatar Square #1" />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={set('address')} placeholder="Ulaanbaatar" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude">
            <Input value={form.latitude} onChange={set('latitude')} placeholder="47.9186" inputMode="decimal" />
          </Field>
          <Field label="Longitude">
            <Input value={form.longitude} onChange={set('longitude')} placeholder="106.9176" inputMode="decimal" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Registration">
            <Select value={form.registrationStatus} onChange={set('registrationStatus')}>
              {REGISTRATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Security profile">
            <Select value={form.securityProfile} onChange={set('securityProfile')}>
              <option value="1">1 — Basic over ws</option>
              <option value="2">2 — Basic over wss</option>
              <option value="3">3 — Mutual TLS</option>
            </Select>
          </Field>
          <Field label="Heartbeat (s)">
            <Input
              value={form.heartbeatInterval}
              onChange={set('heartbeatInterval')}
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field label="Tariff per kWh (₮)" hint="Used to price completed sessions. Leave empty for free charging.">
          <Input value={form.tariffPerKwh} onChange={set('tariffPerKwh')} placeholder="450" inputMode="decimal" />
        </Field>
      </div>
    </Modal>
  );
}
