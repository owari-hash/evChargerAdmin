'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Building2, Check, User } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import type {
  QpayCompanyMerchantInput,
  QpayLocation,
  QpayMerchant,
  QpayMerchantKind,
  QpayPersonMerchantInput,
} from '@/lib/types';
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui/primitives';
import { CopyButton } from '@/components/ui/copy-button';
import { Modal } from '@/components/ui/modal';
import { Tabs } from '@/components/ui/tabs';

/** Fields shared by both merchant kinds. */
const SHARED = {
  register_number: '',
  mcc_code: '',
  city: '',
  district: '',
  address: '',
  phone: '',
  email: '',
};

const EMPTY = {
  ...SHARED,
  // person
  first_name: '',
  last_name: '',
  business_name: '',
  // company
  company_name: '',
  name: '',
};

type Form = typeof EMPTY;

/** Which fields QPay rejects the request without, per merchant kind. */
const REQUIRED: Record<QpayMerchantKind, (keyof Form)[]> = {
  person: [
    'register_number',
    'first_name',
    'last_name',
    'business_name',
    'mcc_code',
    'city',
    'district',
    'address',
    'phone',
    'email',
  ],
  company: [
    'register_number',
    'company_name',
    'name',
    'mcc_code',
    'city',
    'district',
    'address',
    'phone',
    'email',
  ],
};

/**
 * Register a QuickQR merchant, as an individual or as a company. Mount with a
 * `key` tied to `open` so every registration starts from a blank form.
 */
export function MerchantModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = React.useState<QpayMerchantKind>('company');
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<QpayMerchant | null>(null);

  // Cities are a short, stable list; districts depend on the chosen city.
  const { data: cities } = useSWR<QpayLocation[]>(open ? apiUrl('qpay/cities') : null, fetcher);
  const { data: districts, isLoading: districtsLoading } = useSWR<QpayLocation[]>(
    open && form.city ? apiUrl(`qpay/cities/${encodeURIComponent(form.city)}/districts`) : null,
    fetcher,
  );

  const set =
    (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const missing = REQUIRED[kind].filter((key) => !form[key].trim());

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const shared = {
        register_number: form.register_number.trim(),
        mcc_code: form.mcc_code.trim(),
        city: form.city,
        district: form.district,
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      };

      const merchant =
        kind === 'person'
          ? await api.post<QpayMerchant>('qpay/merchants/person', {
              ...shared,
              first_name: form.first_name.trim(),
              last_name: form.last_name.trim(),
              business_name: form.business_name.trim(),
            } satisfies QpayPersonMerchantInput)
          : await api.post<QpayMerchant>('qpay/merchants/company', {
              ...shared,
              company_name: form.company_name.trim(),
              name: form.name.trim(),
            } satisfies QpayCompanyMerchantInput);

      toast.success('Мерчант QPay дээр бүртгэгдлээ');
      setCreated(merchant ?? {});
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ---- Result panel: the merchant_id is what the backend needs afterwards ----

  if (created) {
    const merchantId = created.merchant_id ?? '';
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Мерчант бүртгэгдлээ"
        description={kind === 'person' ? 'Хувь хүн' : 'Байгууллага'}
        footer={
          <Button variant="primary" onClick={onClose}>
            Дуусгах
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--color-ok)]/30 bg-[var(--color-ok-soft)] px-3 py-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ok)]" />
            <p className="text-xs text-[var(--color-fg)]">
              QPay мерчантыг үүсгэлээ. Нэхэмжлэх үүсгэхийн тулд доорх мерчант ID-г
              backend-ийн <code className="font-mono">QPAY_QUICKQR_MERCHANT_ID</code> тохиргоонд
              хийнэ үү.
            </p>
          </div>

          {merchantId ? (
            <Field label="Мерчант ID">
              <div className="flex items-center gap-2">
                <Input readOnly value={merchantId} className="font-mono text-xs" />
                <CopyButton value={merchantId} variant="secondary" />
              </div>
            </Field>
          ) : (
            <ErrorNote>
              QPay мерчант ID буцаасангүй. Жагсаалтыг шинэчилж шалгана уу.
            </ErrorNote>
          )}
        </div>
      </Modal>
    );
  }

  // ---- Registration form ----

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Шинэ QPay мерчант"
      description="QuickQR дээр төлбөр хүлээн авах мерчант бүртгэнэ."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            loading={saving}
            disabled={missing.length > 0}
          >
            Бүртгэх
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs
          className="-mx-5 -mt-4 mb-1 px-3"
          value={kind}
          onChange={(k) => setKind(k as QpayMerchantKind)}
          items={[
            {
              key: 'company',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Байгууллага
                </span>
              ),
            },
            {
              key: 'person',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Хувь хүн
                </span>
              ),
            },
          ]}
        />

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {kind === 'company' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Байгууллагын регистр" hint="Жишээ: 6691374">
                <Input
                  value={form.register_number}
                  onChange={set('register_number')}
                  className="font-mono"
                  placeholder="6691374"
                  autoFocus
                />
              </Field>
              <Field label="Байгууллагын нэр" hint="Улсын бүртгэлийн нэр">
                <Input
                  value={form.company_name}
                  onChange={set('company_name')}
                  placeholder="TEST LLC"
                />
              </Field>
            </div>
            <Field label="Бизнесийн нэр" hint="QR дээр харагдах нэр">
              <Input value={form.name} onChange={set('name')} placeholder="Мерчант12" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Регистрийн дугаар" hint="Жишээ: УЗ96021105">
              <Input
                value={form.register_number}
                onChange={set('register_number')}
                className="font-mono"
                placeholder="УЗ96021105"
                autoFocus
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Овог">
                <Input value={form.last_name} onChange={set('last_name')} placeholder="Гантулга" />
              </Field>
              <Field label="Нэр">
                <Input value={form.first_name} onChange={set('first_name')} placeholder="Ганзул" />
              </Field>
            </div>
            <Field label="Бизнесийн нэр" hint="QR дээр харагдах нэр">
              <Input
                value={form.business_name}
                onChange={set('business_name')}
                placeholder="Мерчант12"
              />
            </Field>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Хот / аймаг">
            <Select
              value={form.city}
              onChange={(e) => {
                const city = e.target.value;
                // The district list is city-specific, so a city change clears it.
                setForm((f) => ({ ...f, city, district: '' }));
              }}
            >
              <option value="">Сонгох…</option>
              {(cities ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Сум / дүүрэг"
            hint={!form.city ? 'Эхлээд хот/аймаг сонгоно уу.' : undefined}
          >
            <Select
              value={form.district}
              onChange={set('district')}
              disabled={!form.city || districtsLoading}
            >
              <option value="">{districtsLoading ? 'Ачаалж байна…' : 'Сонгох…'}</option>
              {(districts ?? []).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Дэлгэрэнгүй хаяг">
          <Input value={form.address} onChange={set('address')} placeholder="6 хороо 14-10" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Утас">
            <Input
              value={form.phone}
              onChange={set('phone')}
              inputMode="tel"
              placeholder="99112210"
            />
          </Field>
          <Field label="И-мэйл">
            <Input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="admin@gmail.com"
            />
          </Field>
          <Field label="MCC код" hint="QPay-н ангилал, ж: 5311">
            <Input
              value={form.mcc_code}
              onChange={set('mcc_code')}
              className="font-mono"
              inputMode="numeric"
              placeholder="5311"
            />
          </Field>
        </div>

        {missing.length > 0 ? (
          <p className="text-xs text-[var(--color-fg-subtle)]">
            Бүх талбарыг QPay шаарддаг. Дүүрэн бөглөх шаардлагатай: {missing.length}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
