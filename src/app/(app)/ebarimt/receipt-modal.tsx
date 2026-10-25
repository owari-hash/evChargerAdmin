'use client';

import * as React from 'react';
import { Check, Copy, Printer, QrCode } from 'lucide-react';
import { formatDateTime, formatMoney } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { Badge, Button } from '@/components/ui/primitives';
import type { EbarimtReceiptRow } from './return-confirm-modal';

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: EbarimtReceiptRow | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  if (!receipt) return null;

  const isB2B = receipt.type === 'B2B_RECEIPT';
  const qrUrl = receipt.qrData
    ? `/console-api/qr?data=${encodeURIComponent(receipt.qrData)}&size=300`
    : null;

  async function copyDdtd() {
    if (!receipt?.receiptId) return;
    try {
      await navigator.clipboard.writeText(receipt.receiptId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Modal
      open={Boolean(receipt)}
      onClose={onClose}
      title="Цахим төлбөрийн баримт"
      size="sm"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" />
            Хэвлэх
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Хаах
          </Button>
        </div>
      }
    >
      <div className="print:p-0 flex flex-col items-center text-center font-sans">
        {/* Receipt printable layout */}
        <div className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 shadow-sm space-y-4">
          <div className="border-b border-dashed border-[var(--color-border)] pb-3">
            <h3 className="text-base font-bold tracking-tight text-[var(--color-fg)]">ЦАХИМ ТӨЛБӨРИЙН БАРИМТ</h3>
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              {isB2B ? 'Байгууллагад олгох баримт (B2B)' : 'Иргэнд олгох төлбөрийн баримт (B2C)'}
            </p>
            {receipt.status === 'REFUNDED' && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30">
                БУЦААГДСАН · {receipt.returnedAt ? formatDateTime(receipt.returnedAt) : ''}
              </div>
            )}
            {receipt.status === 'SUCCESS' && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/30">
                ХҮЧИНТЭЙ
              </div>
            )}
          </div>

          <div className="text-xs space-y-1.5 text-left border-b border-dashed border-[var(--color-border)] pb-3">
            <div className="flex justify-between">
              <span className="text-[var(--color-fg-muted)]">Борлуулагчийн ТТД:</span>
              <span className="font-mono font-medium">{receipt.merchantTin || '—'}</span>
            </div>
            {receipt.customerTin && (
              <div className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">Худалдан авагч ТТД:</span>
                <span className="font-mono font-bold">{receipt.customerTin}</span>
              </div>
            )}
            {receipt.customerNo && !receipt.customerTin && (
              <div className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">Хэрэглэгчийн бүртгэл / Утас:</span>
                <span className="font-mono">{receipt.customerNo}</span>
              </div>
            )}
            {receipt.driver?.phone && !receipt.customerNo && (
              <div className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">Жолоочийн утас:</span>
                <span className="font-mono">{receipt.driver.phone}</span>
              </div>
            )}
            {receipt.issuedAt && (
              <div className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">Огноо, цаг:</span>
                <span>{formatDateTime(receipt.issuedAt)}</span>
              </div>
            )}
          </div>

          {/* DDTD & Lottery block */}
          <div className="space-y-2 py-1 text-center bg-[var(--color-surface-muted)]/50 rounded-lg p-3">
            {receipt.receiptId && (
              <div>
                <p className="text-[11px] text-[var(--color-fg-muted)] uppercase tracking-wider font-semibold">ДДТД (33 орон)</p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="font-mono text-xs sm:text-sm font-semibold select-all break-all text-[var(--color-fg)]">
                    {receipt.receiptId}
                  </span>
                  <button
                    type="button"
                    onClick={copyDdtd}
                    className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    title="ДДТД хуулах"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-[var(--color-ok)]" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {receipt.lottery && (
              <div className="pt-1">
                <p className="text-[11px] text-[var(--color-fg-muted)] uppercase tracking-wider font-semibold">Сугалааны дугаар</p>
                <p className="font-mono text-lg font-extrabold text-[var(--color-brand)] tracking-widest mt-0.5">
                  {receipt.lottery}
                </p>
              </div>
            )}
          </div>

          {/* QR Code */}
          {qrUrl ? (
            <div className="flex flex-col items-center justify-center py-2">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-200">
                <img
                  src={qrUrl}
                  alt="E-Barimt QR"
                  width={140}
                  height={140}
                  className="size-36 object-contain"
                />
              </div>
              <p className="text-[10px] text-[var(--color-fg-subtle)] mt-1.5">
                И-баримт аппликейшнээр уншуулж бүртгүүлнэ үү
              </p>
            </div>
          ) : receipt.qrData ? (
            <div className="p-2 text-center text-xs text-[var(--color-fg-muted)]">
              <QrCode className="h-6 w-6 mx-auto mb-1 text-[var(--color-brand)]" />
              <p className="font-mono text-[10px] break-all">{receipt.qrData}</p>
            </div>
          ) : null}

          {/* Items breakdown */}
          <div className="border-t border-dashed border-[var(--color-border)] pt-3 text-xs space-y-1.5 text-left">
            <div className="flex justify-between font-semibold">
              <span>{receipt.source === 'TRANSACTION' ? 'EV Цэнэглэлтийн үйлчилгээ' : 'EV Хэтэвч цэнэглэлт'}</span>
              <span>{formatMoney(receipt.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-fg-muted)]">
              <span>НӨАТ (10%):</span>
              <span>{formatMoney(receipt.totalVAT)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-fg-muted)]">
              <span>НХАТ (0%):</span>
              <span>0 ₮</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-2 text-[var(--color-fg)]">
              <span>НИЙТ ТӨЛСӨН:</span>
              <span>{formatMoney(receipt.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
