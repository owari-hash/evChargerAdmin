'use client';

import * as React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle, Info, Zap, ZapOff } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import type { ElectricalEfficiency } from '@/lib/types';
import { cn } from '@/lib/cn';

export function ElectricalLossPanel({
  efficiency,
  totalOutputKw,
}: {
  efficiency?: ElectricalEfficiency | null;
  totalOutputKw: number;
}) {
  const eff = efficiency;

  if (!eff || !eff.inputMeterAvailable || eff.incomingPowerKw === null) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
          <div className="flex items-center gap-2">
            <ZapOff className="size-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
              Цахилгаан алдагдал & Үр ашгийн хяналт (Electrical Loss & Efficiency)
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            Оролтын тоолуур холбогдоогүй
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-fg)]">
              Тэжээлийн оролтын тоолуурын хэмжилт ирээгүй байна
            </p>
            <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed max-w-xl">
              Станцын цахилгаан эрчим хүчний бодит алдагдал (AC/DC хувиргалт, трансформатор, кабелийн халалт)-ыг үнэн зөв тооцохын тулд дэд бүтцийн эх үүсвэр талд тусдаа эрчим хүчний тоолуур (Upstream Electrical Meter) суурилуулсан байх шаардлагатай.
            </p>
          </div>

          <div className="shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-right">
            <span className="text-[11px] text-[var(--color-fg-muted)] block">Одоогийн цэнэглэгчдийн гарц</span>
            <span className="text-lg font-bold font-mono text-brand">{formatNumber(totalOutputKw, 1)} кВт</span>
          </div>
        </div>

        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>
            <strong>Мэдэгдэл:</strong> Цэнэглэгчийн гаралтын телеметрээр зөвхөн бууны чадлын үзүүлэлтийг хянах боломжтой бөгөөд оролтын тоолуургүй тохиолдолд таамагласан алдагдлын хувийг харуулахгүй болохыг анхаарна уу.
          </span>
        </div>
      </div>
    );
  }

  const incoming = eff.incomingPowerKw ?? 0;
  const output = eff.totalOutputKw ?? 0;
  const diff = eff.powerDifferenceKw ?? 0;
  const pct = eff.outputEfficiencyPct ?? 100;
  const isLossHigh = eff.status === 'HIGH_LOSS' || pct < 85;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
            Цахилгаан алдагдал & Үр ашгийн хяналт (Electrical Loss & Efficiency)
          </span>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
            isLossHigh
              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
          )}
        >
          {isLossHigh ? (
            <>
              <AlertTriangle className="size-3" />
              Алдагдал өндөр байна ({Math.round(100 - pct)}%)
            </>
          ) : (
            <>
              <CheckCircle className="size-3" />
              Хувиргалтын үр ашиг хэвийн ({pct}%)
            </>
          )}
        </span>
      </div>

      {/* 3 Step Power Balance Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Incoming Grid Power */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">
            1. Станцын оролтын тэжээл (Incoming Supply)
          </span>
          <p className="text-2xl font-bold font-mono text-[var(--color-fg)]">
            {formatNumber(incoming, 1)} кВт
          </p>
          <span className="text-[10px] text-[var(--color-fg-subtle)] block">
            Дэд станцын оролтын тоолуураар хэмжигдсэн
          </span>
        </div>

        {/* Total Pile Output */}
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-brand">
            2. Цэнэглэгчдийн нийт гарц (Charger Output)
          </span>
          <p className="text-2xl font-bold font-mono text-brand">
            {formatNumber(output, 1)} кВт
          </p>
          <span className="text-[10px] text-[var(--color-fg-subtle)] block">
            Бүх идэвхтэй бууны нийлбэр чадал
          </span>
        </div>

        {/* Measured Power Difference & Efficiency */}
        <div
          className={cn(
            'rounded-xl border p-3.5 space-y-1',
            isLossHigh
              ? 'border-rose-500/40 bg-rose-500/5'
              : 'border-[var(--color-border)] bg-[var(--color-surface-2)]',
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-[var(--color-fg-muted)]">
            <span>3. Хэмжигдсэн зөрүү (Difference)</span>
            <span className="font-bold text-[var(--color-fg)]">Үр ашиг: {pct}%</span>
          </div>
          <p
            className={cn(
              'text-2xl font-bold font-mono',
              isLossHigh ? 'text-rose-500' : 'text-emerald-500',
            )}
          >
            {formatNumber(diff, 1)} кВт
          </p>
          <span className="text-[10px] text-[var(--color-fg-subtle)] block">
            AC/DC хувиргалт, трансформатор, кабель & хөргөлт
          </span>
        </div>
      </div>
    </div>
  );
}
