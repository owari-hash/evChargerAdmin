'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import type { QpayActiveMerchantConfig } from '@/lib/types';
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';

const POPULAR_BANKS: { code: string; name: string }[] = [
  { code: '050000', name: '050000 - Хаан банк (Khan Bank)' },
  { code: '040000', name: '040000 - Голомт банк (Golomt Bank)' },
  { code: '020000', name: '020000 - Худалдаа хөгжлийн банк (TDB)' },
  { code: '150000', name: '150000 - Хас банк (XacBank)' },
  { code: '340000', name: '340000 - Төрийн банк (State Bank)' },
  { code: '380000', name: '380000 - Богд банк (Bogd Bank)' },
  { code: '320000', name: '320000 - Капитрон банк (Capitron Bank)' },
  { code: '360000', name: '360000 - Чингис хаан банк (Chinggis Khaan Bank)' },
  { code: '290000', name: '290000 - Тээвэр хөгжлийн банк (TransBank)' },
  { code: '300000', name: '300000 - Ариг банк (Arig Bank)' },
  { code: 'custom', name: 'Өөр банкны код бичих…' },
];

export function ActiveMerchantModal({
  open,
  onClose,
  initialData,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<QpayActiveMerchantConfig> | null;
  onSuccess: () => void;
}) {
  const [merchantId, setMerchantId] = React.useState('');
  const [merchantName, setMerchantName] = React.useState('');
  const [mccCode, setMccCode] = React.useState('5311');
  const [selectedBank, setSelectedBank] = React.useState('050000');
  const [customBankCode, setCustomBankCode] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      const mId = initialData?.merchantId ?? 'cc1a2b2f-aa84-474a-953c-c55b575a9883';
      const mName = initialData?.merchantName ?? 'ЗЭВ ТАБС ХХК';
      const mcc = initialData?.mccCode ?? '5311';
      const bCode = initialData?.bankCode ?? '050000';
      const accNum = initialData?.accountNumber ?? '5475332224';
      const accName = initialData?.accountName ?? 'ЗЭВ ТАБС ХХК';

      setMerchantId(mId);
      setMerchantName(mName);
      setMccCode(mcc);
      setAccountNumber(accNum);
      setAccountName(accName);

      const known = POPULAR_BANKS.some((b) => b.code === bCode);
      if (known) {
        setSelectedBank(bCode);
        setCustomBankCode('');
      } else {
        setSelectedBank('custom');
        setCustomBankCode(bCode);
      }
    }
  }, [open, initialData]);

  const bankCode = selectedBank === 'custom' ? customBankCode.trim() : selectedBank;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantId.trim()) {
      setError('Мерчант ID оруулна уу');
      return;
    }
    if (!bankCode) {
      setError('Банкны код сонгоно уу');
      return;
    }
    if (!accountNumber.trim()) {
      setError('Дансны дугаар оруулна уу');
      return;
    }
    if (!accountName.trim()) {
      setError('Дансны нэр оруулна уу');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.put('qpay/active-merchant', {
        merchantId: merchantId.trim(),
        merchantName: merchantName.trim() || accountName.trim(),
        mccCode: mccCode.trim() || '5311',
        bankCode,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });
      toast.success('QPay идэвхтэй мерчант амжилттай хадгалагдлаа');
      onSuccess();
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
      title="QPay үндсэн мерчант тохируулах"
      description="QuickQR нэхэмжлэх үүсгэхэд ашиглах үндсэн мерчант болон төлбөр хүлээн авах дансыг тохируулна."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={saving}>
            Болих
          </Button>
          <Button variant="primary" size="sm" type="submit" form="active-merchant-form" loading={saving}>
            Хадгалах
          </Button>
        </div>
      }
    >
      <form id="active-merchant-form" onSubmit={handleSave} className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="space-y-3">
          <Field label="Мерчант ID (UUID) *" hint="QPay QuickQR мерчантын дахин давтагдашгүй дугаар">
            <Input
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="жишээ: cc1a2b2f-aa84-474a-953c-c55b575a9883"
              className="font-mono text-xs"
              required
            />
          </Field>

          <Field label="Мерчантын нэр" hint="Байгууллага эсвэл бизнесийн нэр">
            <Input
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="ЗЭВ ТАБС ХХК"
            />
          </Field>

          <Field label="MCC код *" hint="Худалдааны салбарын код (ихэвчлэн 5311 эсвэл 5541)">
            <Input
              value={mccCode}
              onChange={(e) => setMccCode(e.target.value)}
              placeholder="5311"
              required
            />
          </Field>

          <div className="border-t border-[var(--color-border)] pt-3">
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">
              Төлбөр хүлээн авах данс (Settlement Account)
            </p>

            <div className="space-y-3">
              <Field label="Банк *">
                <Select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                >
                  {POPULAR_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedBank === 'custom' && (
                <Field label="Банкны код (6 орон) *">
                  <Input
                    value={customBankCode}
                    onChange={(e) => setCustomBankCode(e.target.value)}
                    placeholder="жишээ: 050000"
                    maxLength={10}
                    required
                  />
                </Field>
              )}

              <Field label="Дансны дугаар *">
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="5475332224"
                  className="font-mono"
                  required
                />
              </Field>

              <Field label="Дансны нэр (Эзэмшигч) *">
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="ЗЭВ ТАБС ХХК"
                  required
                />
              </Field>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
