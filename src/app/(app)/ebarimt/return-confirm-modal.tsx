'use client';

import * as React from 'react';
import { AlertTriangle, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { formatDateTime, formatMoney } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { Button, Input } from '@/components/ui/primitives';

export interface EbarimtReceiptRow {
  id: string;
  source: 'TRANSACTION' | 'PAYMENT';
  sourceId: string | number;
  receiptId?: string;
  lottery?: string;
  qrData?: string;
  type: 'B2C_RECEIPT' | 'B2B_RECEIPT';
  status: 'SUCCESS' | 'REFUNDED' | 'FAILED' | 'PENDING';
  totalAmount: number;
  totalVAT: number;
  merchantTin: string;
  customerNo?: string;
  customerTin?: string;
  issuedAt?: string;
  returnedAt?: string;
  returnedBy?: string;
  error?: string;
  chargePointId?: string;
  connectorId?: number;
  driver?: { name?: string; phone?: string } | null;
  rawResponse?: unknown;
  returnResponse?: unknown;
}

export function ReturnConfirmModal({
  receipt,
  onClose,
  onSuccess,
}: {
  receipt: EbarimtReceiptRow | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState('');

  if (!receipt) return null;

  async function handleReturn() {
    if (!receipt) return;
    setBusy(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/ebarimt/return', {
        id: receipt.id,
        source: receipt.source,
        receiptId: receipt.receiptId,
        reason: reason.trim() || undefined,
      });

      toast.success(res.message || 'И-баримтыг татварын системээс амжилттай буцаалаа.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const dugaar = receipt.receiptId || (receipt.lottery ? `Сугалаа: ${receipt.lottery}` : `ID: ${receipt.id}`);

  return (
    <Modal
      open={Boolean(receipt)}
      onClose={onClose}
      title="И-Баримт буцаах (Устгах)"
      size="md"
      description="Татварын PosAPI систем рүү буцаалтын хүсэлт илгээж, системээс баримтыг бүрэн буцаана."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Болих
          </Button>
          <Button variant="danger" onClick={handleReturn} disabled={busy} className="gap-1.5">
            <Undo2 className="h-4 w-4" />
            {busy ? 'Татварын системээс буцааж байна…' : 'Тийм, буцаах'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs sm:text-sm">
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3.5 text-[var(--color-fg)]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
            <div className="space-y-1">
              <p className="font-semibold text-[var(--color-danger)]">Анхааруулга: Буцаалтыг эргүүлэх боломжгүй</p>
              <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
                Энэ баримт татварын албаны үндсэн систем (e-barimt)-ээс бүрэн устгагдаж, худалдан авагчийн апп болон сугалааны бүртгэлээс хасагдана.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--color-fg-muted)]">Баримтын дугаар / ДДТД:</span>
            <span className="font-mono font-semibold text-[var(--color-fg)]">{dugaar}</span>
          </div>
          {receipt.lottery && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--color-fg-muted)]">Сугалааны дугаар:</span>
              <span className="font-mono font-bold text-[var(--color-brand)]">{receipt.lottery}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--color-fg-muted)]">Нийт төлбөрийн дүн:</span>
            <span className="font-bold text-[var(--color-fg)]">{formatMoney(receipt.totalAmount)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--color-fg-muted)]">НӨАТ-ын дүн:</span>
            <span>{formatMoney(receipt.totalVAT)}</span>
          </div>
          {receipt.issuedAt && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--color-fg-muted)]">Олгосон огноо:</span>
              <span>{formatDateTime(receipt.issuedAt)}</span>
            </div>
          )}
          {(receipt.customerTin || receipt.customerNo || receipt.driver?.phone) && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--color-fg-muted)]">Худалдан авагч / ТТД / Утас:</span>
              <span className="font-mono">{receipt.customerTin || receipt.customerNo || receipt.driver?.phone}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Буцаалтын шалтгаан (заавал биш):
          </label>
          <Input
            placeholder="Жишээ: Цэнэглэлт амжилтгүй болсон, үйлчлүүлэгч хүсэлт гаргасан..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>
    </Modal>
  );
}
