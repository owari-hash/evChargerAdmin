'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Copy, Check, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { api, apiUrl, fetcher } from '@/lib/client';
import type { PartnerMerchant, PartnerMerchantInput, Client, ChargePoint } from '@/lib/types';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';

const AVAILABLE_SCOPES = [
  { id: 'stations:read', label: 'Станцууд харах', desc: 'Станцын байршил, жагсаалт, мэдээлэл татах' },
  { id: 'connectors:read', label: 'Холбогчийн төлөв харах', desc: 'Чөлөөтэй, цэнэглэж буй эсэхийг шалгах' },
  { id: 'sessions:read', label: 'Цэнэглэлтийн сесс харах', desc: 'Идэвхтэй болон дууссан цэнэглэлтүүдийг харах' },
  { id: 'sessions:control', label: 'Алсаас цэнэглэх / зогсоох', desc: 'RemoteStart / RemoteStop команд өгөх' },
  { id: 'tariffs:read', label: 'Тариф харах', desc: 'Станцуудын үнэ тарифын мэдээлэл харах' },
];

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let pwd = '';
  for (let i = 0; i < 14; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export function PartnerMerchantModal({
  merchant,
  open,
  onClose,
  onSaved,
}: {
  merchant: PartnerMerchant | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!merchant;

  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [clientId, setClientId] = React.useState('');
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>([
    'stations:read',
    'connectors:read',
    'sessions:read',
    'sessions:control',
    'tariffs:read',
  ]);
  const [stationScopeMode, setStationScopeMode] = React.useState<'all' | 'custom'>('all');
  const [allowedStations, setAllowedStations] = React.useState<string[]>([]);
  const [ipWhitelist, setIpWhitelist] = React.useState('');
  const [contactName, setContactName] = React.useState('');
  const [contactPhone, setContactPhone] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Fetch clients & stations options
  const { data: clientsData } = useSWR<{ items: Client[] }>(open ? apiUrl('clients', { limit: 200 }) : null, fetcher);
  const { data: stationsData } = useSWR<{ items: ChargePoint[] }>(
    open ? apiUrl('charge-points', { limit: 300 }) : null,
    fetcher,
  );

  const clients = clientsData?.items || [];
  const stations = stationsData?.items || [];

  React.useEffect(() => {
    if (!open) return;

    if (merchant) {
      setName(merchant.name || '');
      setCode(merchant.code || '');
      setUsername(merchant.username || '');
      setPassword('');
      setClientId(merchant.client?.id || '');
      setSelectedScopes(merchant.allowedScopes || []);
      const stList = merchant.allowedStations || [];
      if (stList.length > 0) {
        setStationScopeMode('custom');
        setAllowedStations(stList);
      } else {
        setStationScopeMode('all');
        setAllowedStations([]);
      }
      setIpWhitelist((merchant.ipWhitelist || []).join(', '));
      setContactName(merchant.contactName || '');
      setContactPhone(merchant.contactPhone || '');
      setContactEmail(merchant.contactEmail || '');
      setDescription(merchant.description || '');
      setIsActive(merchant.isActive ?? true);
      setCopied(false);
    } else {
      setName('');
      setCode('');
      setUsername('');
      setPassword(generateSecurePassword());
      setClientId('');
      setSelectedScopes([
        'stations:read',
        'connectors:read',
        'sessions:read',
        'sessions:control',
        'tariffs:read',
      ]);
      setStationScopeMode('all');
      setAllowedStations([]);
      setIpWhitelist('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setDescription('');
      setIsActive(true);
      setCopied(false);
    }
  }, [open, merchant]);

  function handleAutoCode(inputName: string) {
    setName(inputName);
    if (!isEditing && !code) {
      const generatedCode = inputName
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '')
        .slice(0, 16);
      setCode(generatedCode);
      if (!username) {
        setUsername(`${generatedCode}_api`);
      }
    }
  }

  function toggleScope(scopeId: string) {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId],
    );
  }

  function toggleStation(cpId: string) {
    setAllowedStations((prev) =>
      prev.includes(cpId) ? prev.filter((id) => id !== cpId) : [...prev, cpId],
    );
  }

  async function handleCopyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success('Нууц үг хуулагдлаа');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Хуулахад алдаа гарлаа');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Мерчантын нэрийг оруулна уу');
    if (!code.trim()) return toast.error('Код оруулна уу');
    if (!username.trim()) return toast.error('Хэрэглэгчийн нэр оруулна уу');
    if (!isEditing && !password) return toast.error('Нууц үг оруулна уу');

    setLoading(true);
    try {
      const body: PartnerMerchantInput = {
        name: name.trim(),
        code: code.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        clientId: clientId || null,
        allowedScopes: selectedScopes,
        allowedStations: stationScopeMode === 'all' ? [] : allowedStations,
        ipWhitelist: ipWhitelist
          .split(/[\n,]/)
          .map((ip) => ip.trim())
          .filter(Boolean),
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        description: description.trim() || undefined,
        isActive,
      };

      if (!isEditing) {
        body.password = password;
        await api.post('/partner-merchants', body);
        toast.success(`"${name}" мерчант амжилттай бүртгэгдлээ`);
      } else {
        await api.put(`/partner-merchants/${merchant.id}`, body);
        toast.success(`"${name}" мерчантын мэдээлэл шинэчлэгдлээ`);
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Мерчантын мэдээлэл засах' : 'Шинэ мерчант бүртгэх (API Хамтрагч)'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic credentials */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] flex items-center gap-1.5 border-b border-[var(--color-border)] pb-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Үндсэн мэдээлэл ба Нэвтрэх эрх
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Мерчантын нэр *" hint="Жишээ: Токи ХХК, Таван Богд, Монпэй">
              <Input
                value={name}
                onChange={(e) => handleAutoCode(e.target.value)}
                placeholder="Байгууллагын нэр"
                required
              />
            </Field>

            <Field label="Мерчант код (Slug) *" hint="Зөвхөн англи үсэг, тоо">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="toki, tavanbogd"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Нэвтрэх хэрэглэгчийн нэр *" hint="API дуудахад ашиглагдах username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                placeholder="toki_api"
                required
              />
            </Field>

            {!isEditing ? (
              <Field label="Нууц үг *" hint="Хамтрагчид дамжуулах нууц үг">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Хамгийн багадаа 6 тэмдэгт"
                    className="font-mono text-sm"
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPassword(generateSecurePassword())}
                    title="Шинэ нууц үг үүсгэх"
                    className="shrink-0 h-9 px-2.5"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyPassword}
                    title="Хуулах"
                    className="shrink-0 h-9 px-2.5"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </Field>
            ) : (
              <Field label="Харилцагчтай холбох" hint="Сонголтоор: Станц эзэмшигч харилцагч">
                <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">(Холбохгүй / Бие даасан партнер)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {!isEditing && (
            <Field label="Харилцагчтай холбох" hint="Сонголтоор: Станц эзэмшигч харилцагч">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">(Холбохгүй / Бие даасан партнер)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {/* API Scopes */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] border-b border-[var(--color-border)] pb-1.5">
            Зөвшөөрөгдсөн API эрхүүд (Scopes)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVAILABLE_SCOPES.map((scope) => {
              const active = selectedScopes.includes(scope.id);
              return (
                <label
                  key={scope.id}
                  onClick={() => toggleScope(scope.id)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-500/15'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {}} // handled by parent onClick
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-medium text-[var(--color-fg)]">{scope.label}</div>
                    <div className="text-[11px] text-[var(--color-fg-muted)]">{scope.desc}</div>
                    <code className="text-[10px] text-[var(--color-fg-subtle)] font-mono">{scope.id}</code>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Station scoping */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] flex items-center gap-1.5 border-b border-[var(--color-border)] pb-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            Станцын хамрах хүрээ
          </h4>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="stationScopeMode"
                checked={stationScopeMode === 'all'}
                onChange={() => setStationScopeMode('all')}
                className="text-emerald-600"
              />
              <span className="font-medium">Бүх станц руу хандах</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="stationScopeMode"
                checked={stationScopeMode === 'custom'}
                onChange={() => setStationScopeMode('custom')}
                className="text-emerald-600"
              />
              <span className="font-medium">Зөвхөн сонгосон станцууд руу</span>
            </label>
          </div>

          {stationScopeMode === 'custom' && (
            <div className="max-h-40 overflow-y-auto p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 space-y-1">
              {stations.map((st) => {
                const checked = allowedStations.includes(st.cpId);
                return (
                  <label
                    key={st.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--color-surface)] text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStation(st.cpId)}
                      className="rounded text-emerald-600"
                    />
                    <span className="font-medium text-[var(--color-fg)]">{st.name || st.cpId}</span>
                    <span className="text-[var(--color-fg-subtle)] font-mono text-[11px]">({st.cpId})</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Security & Contacts */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] border-b border-[var(--color-border)] pb-1.5">
            Аюулгүй байдал & Холбоо барих
          </h4>

          <Field
            label="Зөвшөөрөх IP хаяг (IP Whitelist)"
            hint="Сонголтоор: Таслал эсвэл шинэ мөрөөр зааглан бичнэ. Хоосон үед бүх IP-аас хандана."
          >
            <Input
              value={ipWhitelist}
              onChange={(e) => setIpWhitelist(e.target.value)}
              placeholder="Жишээ: 202.131.224.10, 103.57.92.0/24"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Хариуцсан хүн">
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Овог нэр"
              />
            </Field>
            <Field label="Утасны дугаар">
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="99112233"
              />
            </Field>
            <Field label="И-мэйл">
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="dev@partner.mn"
              />
            </Field>
          </div>

          <Field label="Тайлбар, тэмдэглэл">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Хамтрагчтай байгуулсан гэрээ, API ашиглах зорилго..."
              rows={2}
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-emerald-600 h-4 w-4"
            />
            <span className="text-xs font-semibold text-[var(--color-fg)]">
              Мерчант идэвхтэй (Хэрэв унтраавал бүх API хандалт тэр даруй хаагдана)
            </span>
          </label>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Болих
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Хадгалж байна…' : isEditing ? 'Өөрчлөлтийг хадгалах' : 'Мерчант үүсгэх'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
