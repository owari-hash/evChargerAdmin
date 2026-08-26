'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';

export interface EbarimtMerchantItem {
  id?: string;
  _id?: string;
  name: string;
  merchantTin: string;
  districtCode: string;
  branchNo: string;
  posNo: string;
  envMode: 'PRODUCTION' | 'TEST';
  prodApiUrl: string;
  testApiUrl: string;
  ebarimtApiUrl: string;
  isDefault: boolean;
  enabled: boolean;
}

export function EbarimtMerchantModal({
  merchant,
  onClose,
  onSaved,
}: {
  merchant?: EbarimtMerchantItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !merchant;
  const [name, setName] = React.useState(merchant?.name ?? '');
  const [merchantTin, setMerchantTin] = React.useState(merchant?.merchantTin ?? '');
  const [districtCode, setDistrictCode] = React.useState(merchant?.districtCode ?? '23');
  const [branchNo, setBranchNo] = React.useState(merchant?.branchNo ?? '001');
  const [posNo, setPosNo] = React.useState(merchant?.posNo ?? '0001');
  const [envMode, setEnvMode] = React.useState<'PRODUCTION' | 'TEST'>(merchant?.envMode ?? 'PRODUCTION');
  const [prodApiUrl, setProdApiUrl] = React.useState(
    merchant?.prodApiUrl ?? merchant?.ebarimtApiUrl ?? 'http://103.143.40.43:7080/',
  );
  const [testApiUrl, setTestApiUrl] = React.useState(
    merchant?.testApiUrl ?? 'http://103.236.194.50:7080/',
  );
  const [isDefault, setIsDefault] = React.useState(merchant?.isDefault ?? true);
  const [enabled, setEnabled] = React.useState(merchant?.enabled ?? true);
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !merchantTin.trim()) {
      toast.error('Байгууллагын нэр болон Регистрийн дугаарыг оруулна уу');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        merchantTin: merchantTin.trim(),
        districtCode: districtCode.trim() || '23',
        branchNo: branchNo.trim() || '001',
        posNo: posNo.trim() || '0001',
        envMode,
        prodApiUrl: prodApiUrl.trim() || 'http://103.143.40.43:7080/',
        testApiUrl: testApiUrl.trim() || 'http://103.236.194.50:7080/',
        ebarimtApiUrl: envMode === 'TEST' ? testApiUrl.trim() : prodApiUrl.trim(),
        isDefault,
        enabled,
      };

      if (isNew) {
        await api.post('/ebarimt-merchants', body);
        toast.success('И-Баримт мерчант амжилттай бүртгэгдлээ');
      } else {
        const id = merchant.id || merchant._id;
        await api.put(`/ebarimt-merchants/${encodeURIComponent(id!)}`, body);
        toast.success('И-Баримт мерчант амжилттай шинэчлэгдлээ');
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'И-Баримт Мерчант шинээр нэмэх' : 'И-Баримт Мерчант засах'}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Байгууллагын нэр *" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="Жишээ: ЕПлаг ХХК"
            required
          />
        </Field>

        <Field label="ААН Регистрийн дугаар (Merchant TIN) *" htmlFor="merchantTin">
          <Input
            id="merchantTin"
            value={merchantTin}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMerchantTin(e.target.value)}
            placeholder="Жишээ: 6123456"
            required
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Дүүргийн код" htmlFor="districtCode">
            <Input
              id="districtCode"
              value={districtCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDistrictCode(e.target.value)}
              placeholder="23"
            />
          </Field>
          <Field label="Салбарын №" htmlFor="branchNo">
            <Input
              id="branchNo"
              value={branchNo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranchNo(e.target.value)}
              placeholder="001"
            />
          </Field>
          <Field label="POS №" htmlFor="posNo">
            <Input
              id="posNo"
              value={posNo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPosNo(e.target.value)}
              placeholder="0001"
            />
          </Field>
        </div>

        <Field label="eBarimt Серверийн орчин (Environment Mode)">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setEnvMode('PRODUCTION')}
              className={`rounded-md py-2 text-xs font-semibold transition ${
                envMode === 'PRODUCTION'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Үндсэн Сервер (Production)
            </button>
            <button
              type="button"
              onClick={() => setEnvMode('TEST')}
              className={`rounded-md py-2 text-xs font-semibold transition ${
                envMode === 'TEST'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Туршилтын Сервер (Test)
            </button>
          </div>
        </Field>

        {envMode === 'PRODUCTION' ? (
          <Field label="Үндсэн eBarimt IP (Production URL)" htmlFor="prodApiUrl">
            <Input
              id="prodApiUrl"
              value={prodApiUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProdApiUrl(e.target.value)}
              placeholder="http://103.143.40.43:7080/"
            />
          </Field>
        ) : (
          <Field label="Туршилтын eBarimt IP (Test URL)" htmlFor="testApiUrl">
            <Input
              id="testApiUrl"
              value={testApiUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestApiUrl(e.target.value)}
              placeholder="http://103.236.194.50:7080/"
            />
          </Field>
        )}

        <div className="flex items-center gap-6 pt-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Үндсэн мерчант болгох (Default)
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Идэвхтэй (Active)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Цуцлах
          </Button>
          <Button type="submit" loading={submitting}>
            {isNew ? 'Нэмэх' : 'Шинэчлэх'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
