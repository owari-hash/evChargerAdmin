'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Copy, Check, KeyRound, RefreshCw } from 'lucide-react';
import { api } from '@/lib/client';
import type { PartnerMerchant } from '@/lib/types';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let pwd = '';
  for (let i = 0; i < 14; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export function ResetPasswordModal({
  merchant,
  open,
  onClose,
}: {
  merchant: PartnerMerchant | null;
  open: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPassword(generateSecurePassword());
      setCopied(false);
    }
  }, [open]);

  async function handleCopy() {
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
    if (!merchant) return;
    if (password.length < 6) {
      toast.error('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/partner-merchants/${merchant.id}/reset-password`, {
        newPassword: password,
      });
      toast.success(`"${merchant.name}" мерчантын нууц үг амжилттай солигдлоо`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Нууц үг солиход алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }

  if (!merchant) return null;

  return (
    <Modal open={open} onClose={onClose} title="Мерчантын нууц үг шинэчлэх" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-fg-muted)]">Мерчант:</span>
            <span className="font-semibold text-[var(--color-fg)]">{merchant.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-fg-muted)]">Нэвтрэх нэр:</span>
            <span className="font-mono font-medium text-[var(--color-fg)]">{merchant.username}</span>
          </div>
        </div>

        <Field label="Шинэ нууц үг *" hint="Хамтрагч байгууллагад дамжуулах нууц үг">
          <div className="flex items-center gap-2">
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
              onClick={handleCopy}
              title="Хуулах"
              className="shrink-0 h-9 px-2.5"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </Field>

        <p className="text-[11px] text-[var(--color-fg-subtle)] leading-relaxed">
          * Нууц үг шинэчлэгдсэн үед тухайн мерчантын одоо ашиглагдаж буй бүх хуучин токен хүчингүй болж, шинэ нууц
          үгээрээ дахин <code className="px-1 py-0.5 rounded bg-[var(--color-surface-2)]">/api/partner/auth/login</code>{' '}
          дуудаж нэвтрэх шаардлагатай болно.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Болих
          </Button>
          <Button type="submit" variant="primary" disabled={loading || password.length < 6}>
            <KeyRound className="h-4 w-4 mr-1.5" />
            {loading ? 'Хадгалж байна…' : 'Нууц үг шинэчлэх'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
