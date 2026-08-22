'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { REGISTRATION_STATUS as REGISTRATION_STATUS_MN, mn } from '@/lib/mn';
import { REGISTRATION_STATUSES, type ChargePoint } from '@/lib/types';

/**
 * Editable site metadata for one charge point. The identifier is not here on
 * purpose: it is the OCPP identity the station connects with, so changing it
 * would orphan the station's connectors, transactions and logs.
 *
 * Mount this only while it is open — the form seeds itself from `chargePoint`
 * once, and remounting is what keeps a background list refresh from wiping a
 * half-typed edit.
 */
export function EditChargePointModal({
  chargePoint,
  onClose,
  onSaved,
}: {
  chargePoint: ChargePoint;
  onClose: () => void;
  onSaved?: (updated: ChargePoint) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [form, setForm] = React.useState(() => ({
    name: chargePoint.name ?? '',
    description: chargePoint.description ?? '',
    address: chargePoint.address ?? '',
    latitude: chargePoint.latitude?.toString() ?? '',
    longitude: chargePoint.longitude?.toString() ?? '',
    registrationStatus: chargePoint.registrationStatus,
    securityProfile: String(chargePoint.securityProfile ?? 1),
    heartbeatInterval: String(chargePoint.heartbeatInterval ?? 300),
    tariffPerKwh: chargePoint.tariffPerKwh?.toString() ?? '',
    tags: (chargePoint.tags ?? []).join(', '),
  }));

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    const errors: Record<string, string> = {};

    const latitude = optionalNumber(form.latitude);
    const longitude = optionalNumber(form.longitude);
    const tariffPerKwh = optionalNumber(form.tariffPerKwh);
    const heartbeatInterval = Number(form.heartbeatInterval);

    if (latitude === INVALID || (typeof latitude === 'number' && Math.abs(latitude) > 90)) {
      errors.latitude = '-90 ба 90 хооронд тоо оруулна уу.';
    }
    if (longitude === INVALID || (typeof longitude === 'number' && Math.abs(longitude) > 180)) {
      errors.longitude = '-180 ба 180 хооронд тоо оруулна уу.';
    }
    if (tariffPerKwh === INVALID || (typeof tariffPerKwh === 'number' && tariffPerKwh < 0)) {
      errors.tariffPerKwh = 'Сөрөг бус тоо оруулна уу.';
    }
    if (!Number.isInteger(heartbeatInterval) || heartbeatInterval < 10) {
      errors.heartbeatInterval = 'Хамгийн багадаа 10 секунд.';
    }
    // A station only shows on the driver map with both coordinates, so half a
    // pair is always a mistake worth catching here.
    if ((latitude === null) !== (longitude === null)) {
      errors.latitude = errors.latitude ?? 'Өргөрөг, уртрагийг хамтад нь оруулна уу.';
      errors.longitude = errors.longitude ?? 'Өргөрөг, уртрагийг хамтад нь оруулна уу.';
    }

    setFieldErrors(errors);
    // Comparing against INVALID here, rather than only through `errors`, is what
    // narrows these to `number | null` for the request body below.
    if (latitude === INVALID || longitude === INVALID || tariffPerKwh === INVALID) return;
    if (Object.keys(errors).length) return;

    setSaving(true);
    setError(null);
    try {
      // null clears a field; the API turns those into an $unset.
      const updated = await api.patch<ChargePoint>(
        `charge-points/${encodeURIComponent(chargePoint.id)}`,
        {
          name: form.name.trim() || null,
          description: form.description.trim() || null,
          address: form.address.trim() || null,
          latitude,
          longitude,
          tariffPerKwh,
          registrationStatus: form.registrationStatus,
          securityProfile: Number(form.securityProfile),
          heartbeatInterval,
          tags: parseTags(form.tags),
        },
      );
      toast.success(`${chargePoint.id} шинэчлэгдлээ`);
      onSaved?.(updated);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Станцын мэдээлэл засах"
      description={chargePoint.id}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            Хадгалах
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Харагдах нэр" hint="Хоосон орхивол станцын дугаар харагдана.">
            <Input value={form.name} onChange={set('name')} placeholder="Сүхбаатарын талбай #1" autoFocus />
          </Field>
          <Field label="Хаяг">
            <Input value={form.address} onChange={set('address')} placeholder="Улаанбаатар" />
          </Field>
        </div>

        <Field label="Тайлбар">
          <Textarea
            value={form.description}
            onChange={set('description')}
            rows={2}
            placeholder="Жишээ нь: подвалын 2 давхарт, 24 цагаар нээлттэй."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Өргөрөг"
            error={fieldErrors.latitude}
            hint="Хоёуланг нь оруулснаар станц жолоочийн газрын зураг дээр гарна."
          >
            <Input
              value={form.latitude}
              onChange={set('latitude')}
              placeholder="47.9186"
              inputMode="decimal"
            />
          </Field>
          <Field label="Уртраг" error={fieldErrors.longitude}>
            <Input
              value={form.longitude}
              onChange={set('longitude')}
              placeholder="106.9176"
              inputMode="decimal"
            />
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
          <Field label="Амьд дохио (сек)" error={fieldErrors.heartbeatInterval}>
            <Input
              value={form.heartbeatInterval}
              onChange={set('heartbeatInterval')}
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field
          label="1 кВт·ц тариф (₮)"
          error={fieldErrors.tariffPerKwh}
          hint="Дууссан цэнэглэлтийн төлбөрийг тооцоход ашиглана. Үнэгүй бол хоосон орхино уу."
        >
          <Input
            value={form.tariffPerKwh}
            onChange={set('tariffPerKwh')}
            placeholder="450"
            inputMode="decimal"
          />
        </Field>

        <Field
          label="Шошго"
          hint="Таслалаар тусгаарлана. Жолоочийн апп холбогчийн төрөл, чадлыг эндээс уншина: ccs2, 120kw. Тодорхой холбогчид оноохдоо c2:type2, c2:22kw гэж бичнэ."
        >
          <Input value={form.tags} onChange={set('tags')} placeholder="ccs2, 120kw" />
        </Field>
      </div>
    </Modal>
  );
}

/** Marks input that is present but not a number, so it can be reported as such. */
const INVALID = Symbol('invalid');

/** Blank clears the field (null); otherwise the parsed number. */
function optionalNumber(raw: string): number | null | typeof INVALID {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : INVALID;
}

function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}
