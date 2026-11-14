'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Zap, DollarSign, Activity, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input } from '@/components/ui/primitives';
import { formatMoney, formatNumber } from '@/lib/format';
import {
  buildStationRevenueWorkbook,
  type RevenueReportClient,
  type RevenueReportParams,
  type RevenueReportSessionItem,
  type RevenueReportStation,
} from '@/lib/revenue-report-excel';

interface StationRevenueReportModalProps {
  open: boolean;
  onClose: () => void;
  station: RevenueReportStation;
  client?: RevenueReportClient | null;
  from: string; // "YYYY-MM-DD"
  to: string;   // "YYYY-MM-DD"
  sessions: RevenueReportSessionItem[];
  totals: {
    sessionsCount: number;
    energyKwh: number;
    gross: number;
    fee: number;
    net: number;
  };
  isLoading?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function StationRevenueReportModal({
  open,
  onClose,
  station,
  client,
  from,
  to,
  sessions,
  totals,
  isLoading = false,
}: StationRevenueReportModalProps) {
  const stationName = station.name || station.cpId;
  const clientName = client?.name || 'Материал Импекс';

  const toParts = to.split('-');
  const year = toParts[0] || String(new Date().getFullYear());
  const month = toParts[1] || '01';
  const cleanCode = (station.cpId || 'META').replace(/[^a-zA-Z0-9\u0400-\u04FF_-]/g, '').toUpperCase();
  const defaultReportNumber = `NEV-${cleanCode}-${year}-${month}`;

  // Find latest session date for default meter reading date
  const lastSessionDate = React.useMemo(() => {
    if (!sessions.length) return `${to} 23:59`;
    const sorted = [...sessions].sort((a, b) => {
      const ta = new Date(a.stopTimestamp || a.startTimestamp).getTime();
      const tb = new Date(b.stopTimestamp || b.startTimestamp).getTime();
      return tb - ta;
    });
    const latest = sorted[0]?.stopTimestamp || sorted[0]?.startTimestamp;
    if (!latest) return `${to} 23:59`;
    const d = new Date(latest);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }, [sessions, to]);

  // Form states
  const [reportNumber, setReportNumber] = React.useState(defaultReportNumber);
  const [meterDate, setMeterDate] = React.useState(lastSessionDate);
  const [meterKwhInput, setMeterKwhInput] = React.useState('');
  const [electricityCostInput, setElectricityCostInput] = React.useState('');
  const [clientSharePercent, setClientSharePercent] = React.useState('');
  const [qpayPercent, setQpayPercent] = React.useState('1.0');
  const [otherCostsInput, setOtherCostsInput] = React.useState('0');
  const [notes, setNotes] = React.useState('');

  // Sync defaults when modal opens or station/totals change
  React.useEffect(() => {
    if (open) {
      setReportNumber(defaultReportNumber);
      setMeterDate(lastSessionDate);
      // Meter consumption defaults to 1.1x platform energy (10% standard conversion loss)
      const defMeter = round2((totals?.energyKwh || 0) * 1.1);
      setMeterKwhInput(String(defMeter || 1100));
      // Electricity cost defaults to 50% of gross revenue
      const defElec = round2((totals?.gross || 0) * 0.5);
      setElectricityCostInput(String(defElec || 2000000));
      // Client share defaults to (100 - feePercent)
      const defShare = client?.feePercent != null ? 100 - client.feePercent : 80;
      setClientSharePercent(String(defShare));
      setQpayPercent('1.0');
      setOtherCostsInput('0');
    }
  }, [open, defaultReportNumber, lastSessionDate, totals?.energyKwh, totals?.gross, client?.feePercent]);

  // Derived values for live preview
  const platformKwh = round2(totals?.energyKwh || 0);
  const grossRevenue = round2(totals?.gross || 0);
  const sessionsCount = totals?.sessionsCount || sessions.length;

  const meterKwh = parseFloat(meterKwhInput) || 0;
  const electricityCost = parseFloat(electricityCostInput) || 0;
  const qpayRate = (parseFloat(qpayPercent) || 0) / 100;
  const qpayFee = round2(grossRevenue * qpayRate);
  const otherCosts = parseFloat(otherCostsInput) || 0;
  const totalDirectCost = round2(electricityCost + qpayFee + otherCosts);
  const distributableNet = round2(grossRevenue - totalDirectCost);

  const clientShare = (parseFloat(clientSharePercent) || 0) / 100;
  const payoutAmount = round2(distributableNet * clientShare);

  const diffKwh = round2(meterKwh - platformKwh);
  const lossRatioPercent = meterKwh > 0 ? ((diffKwh / meterKwh) * 100).toFixed(2) : '0.00';

  const [downloading, setDownloading] = React.useState(false);

  function handleDownload() {
    try {
      setDownloading(true);
      const params: RevenueReportParams = {
        station,
        client: {
          ...client,
          name: clientName,
        },
        from,
        to,
        sessionsCount,
        platformKwh,
        grossRevenue,
        meterKwh,
        electricityCost,
        meterDate,
        clientShare,
        qpayRate,
        otherDirectCosts: otherCosts,
        reportNumber,
        notes: notes.trim() || undefined,
      };

      const wb = buildStationRevenueWorkbook(params, sessions);
      const safeName = (station.cpId || 'station').replace(/[^\w-]+/g, '_');
      XLSX.writeFile(wb, `EV-орлого-хуваарилалт-${safeName}-${from}-to-${to}.xlsx`);
      toast.success('Орлого хуваарилалтын Excel тайлан амжилттай татагдлаа');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Тайлан үүсгэхэд алдаа гарлаа');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
          <span>EV цэнэглэх станцын орлого хуваарилалтын тайлан</span>
        </div>
      }
      description={
        <span>
          {stationName} ({station.cpId}) · {from} – {to}
        </span>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[var(--color-fg-muted)]">
            Хуудас: <strong className="text-[var(--color-fg)]">1. Тайлан</strong> (Тооцоолол, томьёотой) ·{' '}
            <strong className="text-[var(--color-fg)]">2. Цэнэглэлтийн лог</strong> ({sessions.length} сеанс)
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Болих
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={downloading || isLoading}
              disabled={isLoading || downloading}
              onClick={handleDownload}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 px-4 shadow-sm"
              autoFocus
            >
              <Download className="h-4 w-4" />
              Excel татах (.xlsx)
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1 pr-2">
        {/* Top summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)] font-medium">
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              Дууссан сесс
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--color-fg)]">
              {formatNumber(sessionsCount)}
            </div>
            <div className="text-[10px] text-[var(--color-fg-muted)]">Платформоор</div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)] font-medium">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Платформын хэрэглээ
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--color-fg)]">
              {formatNumber(platformKwh, 2)} <span className="text-xs font-normal">кВтц</span>
            </div>
            <div className="text-[10px] text-[var(--color-fg-muted)]">DC гаралт</div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)] font-medium">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              Цэнэглэлтийн орлого
            </div>
            <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(grossRevenue)}
            </div>
            <div className="text-[10px] text-[var(--color-fg-muted)]">Борлуулалтын дүн</div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)] font-medium">
              <Percent className="h-3.5 w-3.5 text-purple-500" />
              Төлөх дүн
            </div>
            <div className="mt-1 text-lg font-bold text-purple-600 dark:text-purple-400">
              {formatMoney(payoutAmount)}
            </div>
            <div className="text-[10px] text-[var(--color-fg-muted)]">Эзэмшигчид олгох ({clientSharePercent}%)</div>
          </div>
        </div>

        {/* Section: Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Left Column: Report & Cost Inputs */}
          <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg-muted)] flex items-center gap-1.5">
              <span>ОРЛОГО, ЗАРДЛЫН ТОХИРГОО</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Тайлангийн дугаар">
                <Input
                  value={reportNumber}
                  onChange={(e) => setReportNumber(e.target.value)}
                  placeholder="NEV-META-2026-01"
                  className="h-8 text-xs font-mono"
                />
              </Field>

              <Field label="Тайлан хүлээн авагч">
                <Input
                  value={clientName}
                  disabled
                  className="h-8 text-xs bg-[var(--color-surface-2)]"
                  title="Станцын эзэмшигч харилцагч"
                />
              </Field>
            </div>

            <Field label="Цахилгааны зардал (₮) — Нэхэмжлэлийн дүн">
              <Input
                type="number"
                value={electricityCostInput}
                onChange={(e) => setElectricityCostInput(e.target.value)}
                placeholder="2000000"
                className="h-8 text-xs font-mono font-medium"
              />
              <span className="text-[10px] text-[var(--color-fg-subtle)]">
                УБЦТС эсвэл цахилгааны байгууллагын нэхэмжлэлийн дүн
              </span>
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="QPay шимтгэл (%)">
                <Input
                  type="number"
                  step="0.1"
                  value={qpayPercent}
                  onChange={(e) => setQpayPercent(e.target.value)}
                  placeholder="1.0"
                  className="h-8 text-xs font-mono"
                />
              </Field>

              <Field label="Бусад шууд зардал (₮)">
                <Input
                  type="number"
                  value={otherCostsInput}
                  onChange={(e) => setOtherCostsInput(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono"
                />
              </Field>
            </div>

            <Field label="Станц эзэмшигчийн ногдох хувь (%)">
              <Input
                type="number"
                step="1"
                min="0"
                max="100"
                value={clientSharePercent}
                onChange={(e) => setClientSharePercent(e.target.value)}
                placeholder="80"
                className="h-8 text-xs font-mono font-semibold"
              />
              <span className="text-[10px] text-[var(--color-fg-subtle)]">
                Хуваарилах цэвэр орлогоос станц эзэмшигчид олгох хувь (жишээ: 80%)
              </span>
            </Field>
          </div>

          {/* Right Column: Meter & Energy Reconciliation */}
          <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg-muted)] flex items-center gap-1.5">
              <span>ЭРЧИМ ХҮЧНИЙ ТУЛГАЛТЫН ТОХИРГОО</span>
            </h3>

            <Field label="Тоолуурын хэрэглээ (кВтц)">
              <Input
                type="number"
                step="0.01"
                value={meterKwhInput}
                onChange={(e) => setMeterKwhInput(e.target.value)}
                placeholder="1100"
                className="h-8 text-xs font-mono font-medium"
              />
              <span className="text-[10px] text-[var(--color-fg-subtle)]">
                Гадна ерөнхий цахилгааны тоолуурын хэрэглээ (хаалт заалт)
              </span>
            </Field>

            <Field label="Тоолуурын заалтын огноо">
              <Input
                value={meterDate}
                onChange={(e) => setMeterDate(e.target.value)}
                placeholder="2026-11-12 09:58"
                className="h-8 text-xs font-mono"
              />
              <span className="text-[10px] text-[var(--color-fg-subtle)]">
                Тоолуур хаасан огноо, цаг (Тайлбар баганад орно)
              </span>
            </Field>

            {/* Reconciliation live card */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-[var(--color-fg-muted)]">Платформын хэрэглээ (DC):</span>
                <span className="font-mono text-[var(--color-fg)]">{formatNumber(platformKwh, 2)} кВтц</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-[var(--color-fg-muted)]">Тоолуурын хэрэглээ:</span>
                <span className="font-mono text-[var(--color-fg)]">{formatNumber(meterKwh, 2)} кВтц</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t border-[var(--color-border)]">
                <span className="text-[var(--color-fg-muted)]">Шууд зөрүү (Тоолуур − Платформ):</span>
                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {formatNumber(diffKwh, 2)} кВтц
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-[var(--color-fg-muted)]">Зөрүү/тоолуур (алдагдлын хувь):</span>
                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {lossRatioPercent}%
                </span>
              </div>
            </div>

            <Field label="Нэмэлт тайлбар (сонголтоор)">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Тайлангийн доод хэсэгт бичигдэх нэмэлт тайлбар..."
                className="h-8 text-xs"
              />
            </Field>
          </div>
        </div>

        {/* Calculation summary sheet preview table */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/30 overflow-hidden">
          <div className="bg-[var(--color-surface-2)] px-3.5 py-2 text-xs font-bold text-[var(--color-fg)] border-b border-[var(--color-border)] flex items-center justify-between">
            <span>ЭЦСИЙН ТООЦООНЫ ХУРААНГУЙ (ШУУД УРЬДЧИЛАН ХАРАХ)</span>
            <span className="text-[11px] font-normal text-[var(--color-fg-muted)]">
              Excel файлын «Тайлан» хуудсанд томьёотой бичигдэнэ
            </span>
          </div>

          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Left table */}
            <div className="space-y-1.5">
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="font-medium text-[var(--color-fg)]">Цэнэглэлтийн орлого:</span>
                <span className="font-mono font-bold text-[var(--color-fg)]">{formatMoney(grossRevenue)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-[var(--color-fg-muted)]">
                <span>− Цахилгааны зардал:</span>
                <span className="font-mono">{formatMoney(electricityCost)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-[var(--color-fg-muted)]">
                <span>− QPay шимтгэл ({qpayPercent}%):</span>
                <span className="font-mono">{formatMoney(qpayFee)}</span>
              </div>
              {otherCosts > 0 && (
                <div className="flex justify-between py-0.5 text-[var(--color-fg-muted)]">
                  <span>− Бусад шууд зардал:</span>
                  <span className="font-mono">{formatMoney(otherCosts)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-t border-[var(--color-border)] text-[var(--color-fg)]">
                <span className="font-semibold">Нийт шууд зардал:</span>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                  {formatMoney(totalDirectCost)}
                </span>
              </div>
            </div>

            {/* Right allocation */}
            <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-[var(--color-border)] md:pl-3 pt-2 md:pt-0">
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="font-medium text-[var(--color-fg)]">Хуваарилах цэвэр орлого:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(distributableNet)}
                </span>
              </div>
              <div className="flex justify-between py-0.5 text-[var(--color-fg-muted)]">
                <span>Эзэмшигчид ногдох хувь:</span>
                <span className="font-mono font-semibold text-[var(--color-fg)]">
                  {clientSharePercent}% ({clientShare})
                </span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-[var(--color-border)] text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 rounded-lg">
                <span>ТӨЛӨХ ДҮН:</span>
                <span className="font-mono text-base">{formatMoney(payoutAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

