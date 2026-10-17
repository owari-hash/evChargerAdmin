'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import type { QpayActiveMerchantConfig, QpayMerchant } from '@/lib/types';
import { Badge, Button, ErrorNote, Field, Input, Select, type SelectOption } from '@/components/ui/primitives';
import { CopyButton } from '@/components/ui/copy-button';
import { Modal } from '@/components/ui/modal';

const POPULAR_BANKS: { code: string; name: string }[] = [
  { code: '050000', name: 'Хаан банк (Khan Bank)' },
  { code: '150000', name: 'Голомт банк (Golomt Bank)' },
  { code: '040000', name: 'Худалдаа хөгжлийн банк (TDB)' },
  { code: '320000', name: 'Хас банк (XacBank)' },
  { code: '340000', name: 'Төрийн банк (State Bank)' },
  { code: '390000', name: 'М банк (M Bank)' },
  { code: '380000', name: 'Богд банк (Bogd Bank)' },
  { code: '300000', name: 'Капитрон банк (Capitron Bank)' },
  { code: '330000', name: 'Чингис хаан банк (Chinggis Khaan Bank)' },
  { code: '190000', name: 'Тээвэр хөгжлийн банк (TransBank)' },
  { code: '210000', name: 'Ариг банк (Arig Bank)' },
  { code: '290000', name: 'Үндэсний хөрөнгө оруулалтын банк (NIBank)' },
];

/** Sentinel option that swaps the dropdown for a free-text bank code field. */
const CUSTOM_BANK = 'custom';

const BANK_OPTIONS: SelectOption[] = [
  ...POPULAR_BANKS.map((b) => ({ value: b.code, code: b.code, label: b.name })),
  { value: CUSTOM_BANK, label: 'Өөр банкны код бичих…' },
];

export function getMerchantId(m: QpayMerchant | Record<string, unknown> | null | undefined): string {
  if (!m) return '';
  const mid = m.merchant_id || (m as Record<string, unknown>).id || (m as Record<string, unknown>).merchantId;
  return mid ? String(mid).trim() : '';
}

export function getMerchantDisplayName(m: QpayMerchant): string {
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
  // Always fetch latest merchants list from QuickQR endpoint when modal opens
  const { data: fetchedData, isLoading: fetchingList } = useSWR<MerchantListResponse | QpayMerchant[]>(
    open ? apiUrl('qpay/merchants', { page: 1, limit: 100 }) : null,
    fetcher,
    { revalidateOnFocus: true },
  );

  // Consolidated merchants list deduped by merchant_id
  const allMerchants = React.useMemo(() => {
    const list: QpayMerchant[] = [];
    const seen = new Set<string>();

    const add = (m: QpayMerchant) => {
      const mid = getMerchantId(m);
      if (!mid || seen.has(mid)) return;
      seen.add(mid);
      list.push({ ...m, merchant_id: mid });
    };

    // 1. If initialData has a merchantId, include a fallback entry
    if (initialData?.merchantId) {
      add({
        merchant_id: initialData.merchantId,
        company_name: initialData.merchantName,
        name: initialData.merchantName,
        mcc_code: initialData.mccCode,
      });
    }

    // 2. Add passed merchants (table rows + recently created merchants)
    for (const m of merchants) add(m);

    // 3. Add remote fetched merchants
    const fetchedRows = fetchedData
      ? Array.isArray(fetchedData)
        ? fetchedData
        : (fetchedData.rows ?? [])
      : [];
    for (const m of fetchedRows) add(m);

    return list;
  }, [merchants, fetchedData, initialData]);

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
  const [fetchingRemote, setFetchingRemote] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auto-fetch merchant details from backend by ID
  const fetchMerchantDetails = React.useCallback(async (id: string) => {
    const cleanId = id.trim();
    if (!cleanId || cleanId === '__manual__') return;
    setFetchingRemote(true);
    try {
      const details = await api.get<QpayMerchant>(`qpay/merchants/${encodeURIComponent(cleanId)}`);
      if (details) {
        const mid = getMerchantId(details) || cleanId;
        const name = getMerchantDisplayName(details);
        setMerchantId(mid);
        if (name && name !== '—') setMerchantName(name);
        if (details.mcc_code) setMccCode(details.mcc_code);
        setAccountName((prev) => (!prev || prev === 'ЗЭВ ТАБС ХХК' ? name : prev));
      }
    } catch {
      // Keep what was entered if remote fetch fails
    } finally {
      setFetchingRemote(false);
    }
  }, []);

  // Initialize or re-populate when modal opens or initialData/merchants change
  React.useEffect(() => {
    if (!open) return;
    setError(null);

    const targetId = (initialData?.merchantId ? String(initialData.merchantId) : '').trim();
    const bCode = initialData?.bankCode ?? '050000';
    const accNum = initialData?.accountNumber ?? '';
    const accName = initialData?.accountName ?? '';

    if (accNum) setAccountNumber(accNum);
    if (accName) setAccountName(accName);

    const known = POPULAR_BANKS.some((b) => b.code === bCode);
    if (known) {
      setSelectedBank(bCode);
      setCustomBankCode('');
    } else {
      setSelectedBank(CUSTOM_BANK);
      setCustomBankCode(bCode);
    }

    if (targetId) {
      const matched = allMerchants.find((m) => getMerchantId(m) === targetId);
      if (matched) {
        const mid = getMerchantId(matched);
        setSelectedMerchantId(mid);
        setIsManualInput(false);
        setMerchantId(mid);
        const name = getMerchantDisplayName(matched) || initialData?.merchantName || '';
        setMerchantName(name);
        setMccCode(matched.mcc_code || initialData?.mccCode || '5311');
        if (!accName) setAccountName(name);
      } else {
        setSelectedMerchantId(targetId);
        setIsManualInput(false);
        setMerchantId(targetId);
        setMerchantName(initialData?.merchantName ?? '');
        setMccCode(initialData?.mccCode ?? '5311');
        if (!accName && initialData?.merchantName) setAccountName(initialData.merchantName);
        void fetchMerchantDetails(targetId);
      }
    } else if (allMerchants.length > 0) {
      const first = allMerchants[0];
      const mid = getMerchantId(first);
      setSelectedMerchantId(mid);
      setIsManualInput(false);
      setMerchantId(mid);
      const name = getMerchantDisplayName(first);
      setMerchantName(name);
      setMccCode(first.mcc_code || '5311');
      if (!accName) setAccountName(name);
    }
  }, [open, initialData, allMerchants, fetchMerchantDetails]);

  // Handle dropdown selection
  async function handleSelectMerchant(value: string) {
    const val = value.trim();
    setSelectedMerchantId(val);

    if (val === '__manual__') {
      setIsManualInput(true);
      return;
    }

    setIsManualInput(false);
    const matched = allMerchants.find((m) => getMerchantId(m) === val);
    if (matched) {
      const mid = getMerchantId(matched);
      setMerchantId(mid);
      const name = getMerchantDisplayName(matched);
      setMerchantName(name);
      setMccCode(matched.mcc_code || '5311');
      if (!accountName || accountName === 'ЗЭВ ТАБС ХХК' || accountName === merchantName) {
        setAccountName(name);
      }
    } else if (val) {
      setMerchantId(val);
      await fetchMerchantDetails(val);
    }
  }

  const selectedMerchant = React.useMemo(() => {
    return allMerchants.find((m) => getMerchantId(m) === merchantId) ?? null;
  }, [allMerchants, merchantId]);

  const bankCode = selectedBank === CUSTOM_BANK ? customBankCode.trim() : selectedBank;

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
      toast.success('QPay үндсэн идэвхтэй мерчант амжилттай тохируулагдлаа');
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
          {/* Dropdown selector with automatically fetched and passed merchants */}
          <Field
            label="Бүртгэлтэй мерчантаас сонгох *"
            hint="Сонгосон мерчантын ID, нэр, регистр, MCC мэдээлэл автоматаар татагдана"
          >
            <div className="relative">
              <Select
                value={isManualInput ? '__manual__' : selectedMerchantId}
                onChange={(e) => void handleSelectMerchant(e.target.value)}
              >
                <option value="" disabled>
                  {fetchingList ? '— Мерчантууд ачаалж байна… —' : '— Жагсаалтаас мерчант сонгох —'}
                </option>
                {allMerchants.map((m, idx) => {
                  const mid = getMerchantId(m);
                  if (!mid) return null;
                  const name = getMerchantDisplayName(m);
                  const reg = m.register_number ? `РД: ${m.register_number}` : '';
                  const mcc = m.mcc_code ? `MCC: ${m.mcc_code}` : '';
                  const extra = [reg, mcc].filter(Boolean).join(' · ');
                  return (
                    <option key={mid || idx} value={mid}>
                      {name} {extra ? `(${extra})` : ''}
                    </option>
                  );
                })}
                {/* Fallback option if merchantId was manually passed and not yet in allMerchants */}
                {merchantId && !allMerchants.some((m) => getMerchantId(m) === merchantId) && !isManualInput && (
                  <option value={merchantId}>
                    {merchantName || merchantId} (Шинэ мерчант)
                  </option>
                )}
                <option value="__manual__">Гараар өөр UUID оруулах…</option>
              </Select>
            </div>
          </Field>

          {/* Auto-populated details card */}
          {!isManualInput && (selectedMerchant || merchantId) && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                    Сонгогдсон мерчант
                  </span>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-fg)]">
                      {selectedMerchant ? getMerchantDisplayName(selectedMerchant) : merchantName || '—'}
                    </p>
                    {fetchingRemote ? <Loader2 className="h-3 w-3 animate-spin text-[var(--color-brand)]" /> : null}
                  </div>
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

          {/* Fallback manual inputs if user chooses manual UUID mode */}
          {isManualInput && (
            <div className="space-y-3 rounded-lg border border-dashed border-[var(--color-border)] p-3">
              <Field label="Мерчант ID (UUID) *" hint="QPay QuickQR мерчантын ID оруулна уу">
                <div className="flex items-center gap-2">
                  <Input
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    placeholder="жишээ: cc1a2b2f-aa84-474a-953c-c55b575a9883"
                    className="font-mono text-xs"
                    required
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => void fetchMerchantDetails(merchantId)}
                    disabled={!merchantId.trim() || fetchingRemote}
                    title="QPay-ээс мэдээлэл татах"
                    className="shrink-0 text-xs"
                  >
                    {fetchingRemote ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    Татах
                  </Button>
                </div>
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
                  options={BANK_OPTIONS}
                  searchPlaceholder="Банкны нэр эсвэл код…"
                  required
                />
              </Field>

              {selectedBank === CUSTOM_BANK && (
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
