'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { TriangleAlert } from 'lucide-react';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { REGISTRATION_STATUS as REGISTRATION_STATUS_MN, mn } from '@/lib/mn';
import { REGISTRATION_STATUSES, type ChargePoint } from '@/lib/types';

/** Same rule the API applies to a charge point identifier. */
const ID_PATTERN = /^[\w.:@-]+$/;

/**
 * Editable details for one charge point.
 *
 * The identifier is editable too, but it is not an ordinary field: it is the
 * OCPP identity the station connects with, so changing it moves every record
 * that references the station and means the station's own configuration has to
 * be updated to match. Only an admin sees that input, and it is saved through
 * the dedicated rename endpoint rather than through the normal update.
 *
 * Mount this only while it is open — the form seeds itself from `chargePoint`
 * once, and remounting is what keeps a background list refresh from wiping a
 * half-typed edit.
 */
export function EditChargePointModal({
  chargePoint,
  canRename = false,
  onClose,
  onSaved,
}: {
  chargePoint: ChargePoint;
  /** Renaming needs the admin role, matching the endpoint. */
  canRename?: boolean;
  onClose: () => void;
  onSaved?: (updated: ChargePoint) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [form, setForm] = React.useState(() => ({
    cpId: chargePoint.cpId,
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

  const nextId = form.cpId.trim();
  const renaming = canRename && nextId !== chargePoint.cpId;

  async function submit() {
    const errors: Record<string, string> = {};

    if (canRename) {
      if (!nextId) errors.cpId = 'Станцын дугаар хоосон байж болохгүй.';
      else if (nextId.length > 64) errors.cpId = 'Хамгийн ихдээ 64 тэмдэгт.';
      else if (!ID_PATTERN.test(nextId)) {
        errors.cpId = 'Зөвхөн үсэг, тоо болон . : @ _ - тэмдэгт ашиглана.';
      }
    }

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
          ...(renaming ? { cpId: nextId } : {}),
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
      toast.success(
        renaming
          ? `${chargePoint.cpId} → ${updated.cpId} болж өөрчлөгдлөө`
          : `${chargePoint.cpId} шинэчлэгдлээ`,
      );
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
      description={chargePoint.cpId}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button
            variant={renaming ? 'danger' : 'primary'}
            onClick={() => void submit()}
            loading={saving}
          >
            {renaming ? 'Дугаарыг өөрчлөх' : 'Хадгалах'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <Field
          label="Станцын дугаар"
          error={fieldErrors.cpId}
          hint={
            canRename
              ? 'OCPP таних дугаар. Станц энэ нэрээр холбогдож нэвтэрдэг.'
              : 'Дугаарыг зөвхөн админ өөрчилнө.'
          }
        >
          <Input
            value={form.cpId}
            onChange={set('cpId')}
            disabled={!canRename}
            className="font-mono"
          />
        </Field>

        {renaming ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn-soft)] px-3 py-2.5 text-xs text-[var(--color-warn)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">
                Дугаарыг <span className="font-mono">{chargePoint.cpId}</span> →{' '}
                <span className="font-mono">{nextId}</span> болгож өөрчлөх гэж байна.
              </p>
              <p>
                Станцын холбогч, цэнэглэлт, тохиргоо болон бүх түүх хэвээр хадгалагдана —
                тэдгээр нь дотоод дугаартай холбогдсон. Одоогийн холболт тасарна.
              </p>
              <p>
                Станц өөрөө хуучин дугаараар холбогдсоор байх тул түүний тохиргоон дахь
                WebSocket хаяг болон нэвтрэх нэрийг мөн шинэ дугаараар солино уу.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Харагдах нэр" hint="Хоосон орхивол станцын дугаар харагдана.">
            <Input value={form.name} onChange={set('name')} placeholder="Сүхбаатарын талбай #1" />
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
