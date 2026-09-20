'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import type { QpayActiveMerchantConfig, QpayMerchant } from '@/lib/types';
import { Badge, Button, ErrorNote, Field, Input, Select } from '@/components/ui/primitives';
import { CopyButton } from '@/components/ui/copy-button';
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

function getMerchantDisplayName(m: QpayMerchant): string {
  const person = [m.last_name, m.first_name].filter(Boolean).join(' ');
  return m.name || m.business_name || m.company_name || person || '—';
}

interface MerchantListResponse {
  rows?: QpayMerchant[];
  count?: number;
}

export function ActiveMerchantModal({
  open,
  onClose,
  initialData,
  merchants = [],
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<QpayActiveMerchantConfig> | null;
  merchants?: QpayMerchant[];
  onSuccess: () => void;
}) {
  // If no merchants were passed in, fetch from QuickQR endpoint
  const { data: fetchedData } = useSWR<MerchantListResponse | QpayMerchant[]>(
    open && (!merchants || merchants.length === 0)
      ? apiUrl('qpay/merchants', { page: 1, limit: 100 })
      : null,
    fetcher,
  );

  const allMerchants = React.useMemo(() => {
    if (merchants && merchants.length > 0) return merchants;
    if (!fetchedData) return [];
    return Array.isArray(fetchedData) ? fetchedData : (fetchedData.rows ?? []);
  }, [merchants, fetchedData]);

  const [selectedMerchantId, setSelectedMerchantId] = React.useState<string>('');
  const [isManualInput, setIsManualInput] = React.useState<boolean>(false);

  const [merchantId, setMerchantId] = React.useState('');
  const [merchantName, setMerchantName] = React.useState('');
  const [mccCode, setMccCode] = React.useState('5311');
  const [selectedBank, setSelectedBank] = React.useState('050000');
  const [customBankCode, setCustomBankCode] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync state when opened
  React.useEffect(() => {
    if (open) {
      setError(null);
      const targetId = initialData?.merchantId ?? 'cc1a2b2f-aa84-474a-953c-c55b575a9883';
      const bCode = initialData?.bankCode ?? '050000';
      const accNum = initialData?.accountNumber ?? '5475332224';
      const accName = initialData?.accountName ?? 'ЗЭВ ТАБС ХХК';

      const matched = allMerchants.find((m) => m.merchant_id === targetId);

      if (matched && matched.merchant_id) {
        setSelectedMerchantId(matched.merchant_id);
        setIsManualInput(false);
        setMerchantId(matched.merchant_id);
        const name = getMerchantDisplayName(matched) || initialData?.merchantName || 'ЗЭВ ТАБС ХХК';
        setMerchantName(name);
        setMccCode(matched.mcc_code || initialData?.mccCode || '5311');
        setAccountName(accName || name);
      } else if (targetId) {
        setSelectedMerchantId(targetId);
        setIsManualInput(false);
        setMerchantId(targetId);
        setMerchantName(initialData?.merchantName ?? 'ЗЭВ ТАБС ХХК');
        setMccCode(initialData?.mccCode ?? '5311');
        setAccountName(accName);
      } else {
        setSelectedMerchantId('');
        setIsManualInput(false);
        setMerchantId('');
        setMerchantName('');
        setMccCode('5311');
        setAccountName('');
      }

      setAccountNumber(accNum);

      const known = POPULAR_BANKS.some((b) => b.code === bCode);
      if (known) {
        setSelectedBank(bCode);
        setCustomBankCode('');
      } else {
        setSelectedBank('custom');
        setCustomBankCode(bCode);
      }
    }
  }, [open, initialData, allMerchants]);

  // Handle dropdown selection
  function handleSelectMerchant(value: string) {
    setSelectedMerchantId(value);
    if (value === '__manual__') {
      setIsManualInput(true);
      return;
    }

    setIsManualInput(false);
    const matched = allMerchants.find((m) => m.merchant_id === value);
    if (matched && matched.merchant_id) {
      setMerchantId(matched.merchant_id);
      const name = getMerchantDisplayName(matched);
      setMerchantName(name);
      setMccCode(matched.mcc_code || '5311');
      if (!accountName || accountName === 'ЗЭВ ТАБС ХХК') {
        setAccountName(name);
      }
    } else {
      setMerchantId(value);
    }
  }

  const selectedMerchant = React.useMemo(() => {
    return allMerchants.find((m) => m.merchant_id === merchantId) ?? null;
  }, [allMerchants, merchantId]);

  const bankCode = selectedBank === 'custom' ? customBankCode.trim() : selectedBank;

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!merchantId.trim()) {
      setError('Мерчант сонгоно уу эсвэл ID оруулна уу');
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
      toast.success('QPay идэвхтэй мерчант амжилттай тохируулагдлаа');
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
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={() => void handleSave()}
            loading={saving}
          >
            Хадгалах
          </Button>
        </div>
      }
    >
      <form id="active-merchant-form" onSubmit={handleSave} className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="space-y-3">
          {/* Dropdown selector so user does not have to fill or type UUID */}
          <Field
            label="Бүртгэлтэй мерчантаас сонгох *"
            hint="Сонгосон мерчантын ID, нэр, регистр, MCC мэдээлэл автоматаар татагдана"
          >
            <Select
              value={isManualInput ? '__manual__' : selectedMerchantId}
              onChange={(e) => handleSelectMerchant(e.target.value)}
            >
              <option value="" disabled>
                — Жагсаалтаас мерчант сонгох —
              </option>
              {allMerchants.map((m) => {
                const name = getMerchantDisplayName(m);
                const reg = m.register_number ? `РД: ${m.register_number}` : '';
                const mcc = m.mcc_code ? `MCC: ${m.mcc_code}` : '';
                const extra = [reg, mcc].filter(Boolean).join(' · ');
                return (
                  <option key={m.merchant_id} value={m.merchant_id}>
                    {name} {extra ? `(${extra})` : ''}
                  </option>
                );
              })}
              {/* If initial merchant is not in list, render it as an option */}
              {merchantId && !allMerchants.some((m) => m.merchant_id === merchantId) && !isManualInput && (
                <option value={merchantId}>
                  {merchantName || merchantId} (Одоогийн үндсэн мерчант)
                </option>
              )}
              <option value="__manual__">Гараар өөр UUID оруулах…</option>
            </Select>
          </Field>

          {/* Auto-populated details card with user's requested 6 items */}
          {(!isManualInput && (selectedMerchant || merchantId)) && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                    Сонгогдсон мерчант
                  </span>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">
                    {selectedMerchant ? getMerchantDisplayName(selectedMerchant) : merchantName || '—'}
                  </p>
                  {selectedMerchant?.company_name &&
                    selectedMerchant.company_name !== getMerchantDisplayName(selectedMerchant) && (
                      <p className="text-xs text-[var(--color-fg-subtle)]">
                        {selectedMerchant.company_name}
                      </p>
                    )}
                </div>
                {mccCode && <Badge tone="info">MCC: {mccCode}</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-2 text-xs">
                <div>
                  <span className="text-[var(--color-fg-muted)]">Мерчант ID:</span>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-fg)]">
                    <span className="truncate">{merchantId || '—'}</span>
                    {merchantId && <CopyButton value={merchantId} size="icon" className="h-5 w-5" />}
                  </div>
                </div>

                <div>
                  <span className="text-[var(--color-fg-muted)]">Регистр:</span>
                  <p className="font-mono text-[var(--color-fg)]">
                    {selectedMerchant?.register_number || '—'}
                  </p>
                </div>

                <div>
                  <span className="text-[var(--color-fg-muted)]">Холбоо барих:</span>
                  <p className="truncate text-[var(--color-fg)]">
                    {selectedMerchant?.phone || selectedMerchant?.email || '—'}
                  </p>
                </div>

                <div>
                  <span className="text-[var(--color-fg-muted)]">Хаяг:</span>
                  <p className="truncate text-[var(--color-fg)]" title={selectedMerchant?.address || ''}>
                    {selectedMerchant?.address ||
                      [selectedMerchant?.city, selectedMerchant?.district].filter(Boolean).join(', ') ||
                      '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fallback manual inputs only shown if user chooses manual UUID mode */}
          {isManualInput && (
            <div className="space-y-3 rounded-lg border border-dashed border-[var(--color-border)] p-3">
              <Field label="Мерчант ID (UUID) *" hint="QPay QuickQR мерчантын ID оруулна уу">
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

              <Field label="MCC код *" hint="Худалдааны салбарын код (жишээ нь 5311)">
                <Input
                  value={mccCode}
                  onChange={(e) => setMccCode(e.target.value)}
                  placeholder="5311"
                  required
                />
              </Field>
            </div>
          )}

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
