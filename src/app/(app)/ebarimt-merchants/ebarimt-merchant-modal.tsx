'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';

export interface EbarimtCheckResult {
  status: 'SUCCESS' | 'ERROR' | 'PENDING';
  message: string;
  statusCode?: number;
  checkedAt?: string;
  rawResponse?: any;
}

export interface EbarimtMerchantItem {
  id?: string;
  _id?: string;
  name: string;
  merchantTin: string;
  districtCode: string;
  khorooCode?: string;
  envMode: 'PRODUCTION' | 'TEST';
  prodApiUrl: string;
  testApiUrl: string;
  ebarimtApiUrl: string;
  isDefault: boolean;
  enabled: boolean;
  autoSend?: boolean;
  lastCheckResult?: EbarimtCheckResult;
}

const DISTRICT_OPTIONS = [
  { code: '23', name: 'Сүхбаатар' },
  { code: '24', name: 'Хан-Уул' },
  { code: '25', name: 'Баянгол' },
  { code: '26', name: 'Баянзүрх' },
  { code: '27', name: 'Сонгинохайрхан' },
  { code: '28', name: 'Чингэлтэй' },
  { code: '01', name: 'Багануур' },
  { code: '02', name: 'Багахангай' },
  { code: '05', name: 'Налайх' },
];

export function EbarimtMerchantModal({
  merchant,
  onClose,
  onSaved,
}: {
  merchant?: EbarimtMerchantItem | null;
  onClose: () => void;
  onSaved: (savedItem?: EbarimtMerchantItem) => void;
}) {
  const isNew = !merchant;
  const [name, setName] = React.useState(merchant?.name ?? '');
  const [merchantTin, setMerchantTin] = React.useState(merchant?.merchantTin ?? '');
  const [districtCode, setDistrictCode] = React.useState(merchant?.districtCode ?? '23');
  const [khorooCode, setKhorooCode] = React.useState(merchant?.khorooCode ?? '20');
  const [envMode, setEnvMode] = React.useState<'PRODUCTION' | 'TEST'>(merchant?.envMode ?? 'PRODUCTION');
  const [prodApiUrl, setProdApiUrl] = React.useState(
    merchant?.prodApiUrl ?? merchant?.ebarimtApiUrl ?? 'http://103.143.40.43:7080/',
  );
  const [testApiUrl, setTestApiUrl] = React.useState(
    merchant?.testApiUrl ?? 'http://103.236.194.50:7080/',
  );
  const [isDefault, setIsDefault] = React.useState(merchant?.isDefault ?? true);
  const [enabled, setEnabled] = React.useState(merchant?.enabled ?? true);
  const [autoSend, setAutoSend] = React.useState(merchant?.autoSend ?? true);
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantTin.trim()) {
      toast.error('Татвар төлөгчийн дугаарыг (TIN) оруулна уу');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name: name.trim() || `Merchant ${merchantTin.trim()}`,
        merchantTin: merchantTin.trim(),
        districtCode: districtCode.trim() || '23',
        khorooCode: khorooCode.trim() || '1',
        envMode,
        prodApiUrl: prodApiUrl.trim() || 'http://103.143.40.43:7080/',
        testApiUrl: testApiUrl.trim() || 'http://103.236.194.50:7080/',
        ebarimtApiUrl: envMode === 'TEST' ? testApiUrl.trim() : prodApiUrl.trim(),
        isDefault,
        enabled,
        autoSend,
      };

      let resultData: EbarimtMerchantItem;
      if (isNew) {
        resultData = await api.post('/ebarimt-merchants', body);
        toast.success('И-Баримт тохиргоо амжилттай хадгалагдлаа');
      } else {
        const id = merchant.id || merchant._id;
        resultData = await api.put(`/ebarimt-merchants/${encodeURIComponent(id!)}`, body);
        toast.success('И-Баримт тохиргоо амжилттай шинэчлэгдлээ');
      }

      onSaved(resultData);
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
      title={isNew ? 'И-Баримт тохиргоо нэмэх' : 'И-Баримт тохиргоо засах'}
    >
      <form onSubmit={submit} className="space-y-4 pt-1">
        {/* Organization name / Label */}
        <Field label="Байгууллагын нэр" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="Жишээ: ЕПлаг ХХК"
          />
        </Field>

        {/* Татвар төлөгчийн дугаар (TIN) */}
        <Field label="Татвар төлөгчийн дугаар (TIN) *" htmlFor="merchantTin">
          <Input
            id="merchantTin"
            value={merchantTin}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMerchantTin(e.target.value)}
            placeholder="37900846788"
            className="font-mono text-base tracking-wider"
            required
          />
        </Field>

        {/* Дүүрэг & Хороо Selects */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дүүрэг" htmlFor="districtCode">
            <select
              id="districtCode"
              value={districtCode}
              onChange={(e) => setDistrictCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {DISTRICT_OPTIONS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name} ({d.code})
                </option>
              ))}
              {!DISTRICT_OPTIONS.some((d) => d.code === districtCode) && (
                <option value={districtCode}>Бусад ({districtCode})</option>
              )}
            </select>
          </Field>

          <Field label="Хороо" htmlFor="khorooCode">
            <select
              id="khorooCode"
              value={khorooCode}
              onChange={(e) => setKhorooCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Array.from({ length: 35 }, (_, i) => String(i + 1)).map((k) => (
                <option key={k} value={k}>
                  {k}-р хороо
                </option>
              ))}
              {isNaN(Number(khorooCode)) && (
                <option value={khorooCode}>{khorooCode}</option>
              )}
            </select>
          </Field>
        </div>

        {/* Toggle 1: И-Баримт ашиглах эсэх */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            И-Баримт ашиглах эсэх
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle 2: И-Баримт автоматаар илгээх эсэх */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            И-Баримт автоматаар илгээх эсэх
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={autoSend}
            onClick={() => setAutoSend(!autoSend)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              autoSend ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                autoSend ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Environment toggle & URL */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-3 bg-slate-50/30 dark:bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              eBarimt REST 3.0 API Орчин:
            </span>
            <div className="flex rounded-md bg-slate-200 dark:bg-slate-800 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEnvMode('PRODUCTION')}
                className={`rounded px-2.5 py-1 transition ${
                  envMode === 'PRODUCTION'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                PROD (103.143.40.43)
              </button>
              <button
                type="button"
                onClick={() => setEnvMode('TEST')}
                className={`rounded px-2.5 py-1 transition ${
                  envMode === 'TEST'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                TEST (103.236.194.50)
              </button>
            </div>
          </div>

          {envMode === 'PRODUCTION' ? (
            <Input
              value={prodApiUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProdApiUrl(e.target.value)}
              placeholder="http://103.143.40.43:7080/"
              className="text-xs font-mono"
            />
          ) : (
            <Input
              value={testApiUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestApiUrl(e.target.value)}
              placeholder="http://103.236.194.50:7080/"
              className="text-xs font-mono"
            />
          )}

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsDefault(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Үндсэн мерчант тохиргоогоор сонгох (Default)
          </label>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Цуцлах
          </Button>
          <Button
            type="submit"
            loading={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 font-semibold shadow-md"
          >
            Хадгалах
          </Button>
        </div>
      </form>
    </Modal>
  );
}
