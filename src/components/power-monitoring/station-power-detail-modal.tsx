'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Battery,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Gauge,
  HelpCircle,
  Info,
  Plug,
  RefreshCw,
  Settings,
  Share2,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatDuration, formatKwh, formatNumber } from '@/lib/format';
import type { StationPowerDetail } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button, Card } from '@/components/ui/primitives';
import { PowerDistributionVisualizer } from './power-distribution-visualizer';
import { ElectricalLossPanel } from './electrical-loss-panel';
import { cn } from '@/lib/cn';

export function StationPowerDetailModal({
  stationId,
  open,
  onClose,
  onConfigure,
}: {
  stationId: string | null;
  open: boolean;
  onClose: () => void;
  onConfigure?: () => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<StationPowerDetail>(
    stationId && open ? apiUrl(`power-monitoring/stations/${stationId}`) : null,
    fetcher,
    { refreshInterval: 3000 },
  );

  if (!open || !stationId) return null;

  const st = data?.station;
  const metrics = data?.powerMetrics;
  const sharing = data?.powerSharing;
  const piles = data?.piles ?? [];
  const alerts = data?.alerts ?? [];

  const handleAlertAction = async (alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    try {
      const res = await fetch(apiUrl(`power-monitoring/alerts/${alertId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await mutate();
      }
    } catch {
      // silent
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={st ? `${st.name} (${st.cpId}) — Чадлын хяналт` : 'Станцын чадлын дэлгэрэнгүй'}
      size="xl"
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        {isLoading && !data ? (
          <div className="py-16 text-center text-sm text-[var(--color-fg-muted)]">
            Чадлын бодит үзүүлэлтүүдийг татаж байна...
          </div>
        ) : error || !data ? (
          <div className="py-12 text-center text-sm text-rose-500">
            Станцын чадлын мэдээллийг ачаалж чадсангүй.
          </div>
        ) : (
          <>
            {/* 1. Header Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 space-y-0.5">
                <span className="text-[11px] text-[var(--color-fg-muted)]">Тохируулсан чадал</span>
                <p className="text-xl font-bold font-mono text-[var(--color-fg)]">
                  {metrics?.configuredGridLimitKw} кВт
                </p>
                <span className="text-[10px] text-[var(--color-fg-subtle)]">
                  Дээд хүчин чадал: {metrics?.ratedCapacityKw} кВт
                </span>
              </div>

              <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 space-y-0.5">
                <span className="text-[11px] text-brand">Одоогийн гарц</span>
                <p className="text-xl font-bold font-mono text-brand">
                  {formatNumber(metrics?.totalOutputPowerKw ?? 0, 1)} кВт
                </p>
                <span className="text-[10px] text-[var(--color-fg-subtle)]">
                  Нийт ашиглалт: {metrics?.utilizationPct}%
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-0.5">
                <span className="text-[11px] text-emerald-500">Сул боломжит чадал</span>
                <p className="text-xl font-bold font-mono text-emerald-500">
                  {formatNumber(metrics?.availablePowerKw ?? 0, 1)} кВт
                </p>
                <span className="text-[10px] text-[var(--color-fg-subtle)]">
                  Нэмж авах боломжтой
                </span>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 space-y-0.5">
                <span className="text-[11px] text-[var(--color-fg-muted)]">Хэтрэлт (Overload)</span>
                <p
                  className={cn(
                    'text-xl font-bold font-mono',
                    (metrics?.overloadKw ?? 0) > 0 ? 'text-rose-500' : 'text-[var(--color-fg-muted)]',
                  )}
                >
                  {(metrics?.overloadKw ?? 0) > 0
                    ? `+${formatNumber(metrics!.overloadKw, 1)} кВт`
                    : '0 кВт (Хэвийн)'}
                </p>
                <span className="text-[10px] text-[var(--color-fg-subtle)]">
                  Хязгаар давсан ачаалал
                </span>
              </div>
            </div>

            {/* 2. Simultaneous Charging & Dynamic Power Sharing Visualization */}
            {sharing && (
              <PowerDistributionVisualizer
                stationCapacityKw={metrics?.configuredGridLimitKw ?? 120}
                totalOutputKw={metrics?.totalOutputPowerKw ?? 0}
                remainingCapacityKw={metrics?.availablePowerKw ?? 0}
                overloadKw={metrics?.overloadKw ?? 0}
                allocations={sharing.allocations}
                status={sharing.status}
                isThrottled={sharing.isThrottled}
                isCapacityReached={sharing.isCapacityReached}
              />
            )}

            {/* 3. Individual Charging Pile Monitoring */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                <div className="flex items-center gap-2">
                  <Plug className="size-4 text-brand" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
                    Цэнэглэх буу бүрийн бие даасан мониторинг (Individual Pile Monitoring)
                  </span>
                </div>
                <span className="text-xs text-[var(--color-fg-muted)]">
                  Нийт {piles.length} буу суурилагдсан
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {piles.map((pile) => {
                  const isCharging = pile.status === 'Charging';
                  const diag = pile.diagnosis;

                  // Diagnosis color and label
                  const diagBadge =
                    diag.status === 'NORMAL'
                      ? { text: 'Хэвийн ажиллагаатай', tone: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' }
                      : diag.status === 'LIMITED_BY_VEHICLE'
                      ? { text: 'Машины BMS хязгаарласан', tone: 'bg-blue-500/10 text-blue-500 border-blue-500/30' }
                      : diag.status === 'LIMITED_BY_STATION'
                      ? { text: 'Станцын лимит хязгаарласан', tone: 'bg-amber-500/10 text-amber-500 border-amber-500/30' }
                      : diag.status === 'UNDERPERFORMING'
                      ? { text: 'Хүлээгдэж буй чадалд хүрэхгүй байна', tone: 'bg-rose-500/10 text-rose-500 border-rose-500/30' }
                      : diag.status === 'INSUFFICIENT_TELEMETRY'
                      ? { text: 'Телеметр дутуу', tone: 'bg-gray-500/10 text-gray-400 border-gray-500/30' }
                      : { text: 'Сул зогсолт', tone: 'bg-gray-500/10 text-gray-400 border-gray-500/30' };

                  return (
                    <div
                      key={pile.connectorId}
                      className={cn(
                        'rounded-2xl border p-4 space-y-3 transition bg-[var(--color-surface)]',
                        isCharging
                          ? 'border-[var(--color-brand)]/40 shadow-sm'
                          : 'border-[var(--color-border)] opacity-85',
                      )}
                    >
                      {/* Pile Title & Status */}
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'size-2.5 rounded-full',
                              isCharging ? 'bg-brand animate-pulse' : 'bg-gray-400',
                            )}
                          />
                          <span className="font-bold text-sm text-[var(--color-fg)]">
                            Буу #{pile.connectorId} {pile.label ? `(${pile.label})` : ''}
                          </span>
                          {pile.code && (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                              QR: {pile.code}
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg)]">
                          {pile.status}
                        </span>
                      </div>

                      {/* Performance Diagnosis Pill with explanation */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--color-fg-muted)]">Оношилгоо:</span>
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', diagBadge.tone)}>
                            {diagBadge.text}
                          </span>
                        </div>
                        {diag.explanation && (
                          <p className="text-[11px] text-[var(--color-fg-muted)] bg-[var(--color-surface-2)]/50 rounded-lg p-2 leading-relaxed">
                            {diag.explanation}
                          </p>
                        )}
                      </div>

                      {/* Electrical Specs Table */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                        <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                          <span className="text-[10px] text-[var(--color-fg-muted)] block">Одоогийн чадал</span>
                          <span className="font-bold font-mono text-sm text-brand">
                            {formatNumber(pile.activePowerKw, 1)} кВт
                          </span>
                        </div>

                        <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                          <span className="text-[10px] text-[var(--color-fg-muted)] block">Суурилагдсан чадал</span>
                          <span className="font-bold font-mono text-sm text-[var(--color-fg)]">
                            {pile.ratedPowerKw} кВт
                          </span>
                        </div>

                        <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                          <span className="text-[10px] text-[var(--color-fg-muted)] block">Хүчдэл (V)</span>
                          <span className="font-bold font-mono text-sm text-[var(--color-fg)]">
                            {pile.voltageV ? `${pile.voltageV} V` : '—'}
                          </span>
                        </div>

                        <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                          <span className="text-[10px] text-[var(--color-fg-muted)] block">Гүйдэл (A)</span>
                          <span className="font-bold font-mono text-sm text-[var(--color-fg)]">
                            {pile.currentA ? `${pile.currentA} A` : '—'}
                          </span>
                        </div>

                        <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                          <span className="text-[10px] text-[var(--color-fg-muted)] block">Түгээсэн эрчим хүч</span>
                          <span className="font-bold font-mono text-sm text-[var(--color-fg)]">
                            {formatNumber(pile.energyKwh, 1)} кВтц
                          </span>
                        </div>

                        <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                          <span className="text-[10px] text-[var(--color-fg-muted)] block">Батерей SoC (%)</span>
                          <span className="font-bold font-mono text-sm text-brand">
                            {pile.socPercent !== null ? `${pile.socPercent}%` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Vehicle & Session Info */}
                      {pile.vehicle?.model && (
                        <div className="rounded-xl border border-[var(--color-border)] p-2.5 text-xs flex items-center justify-between">
                          <span className="text-[var(--color-fg-muted)]">Холбогдсон машин:</span>
                          <span className="font-semibold text-[var(--color-fg)]">
                            {pile.vehicle.model} {pile.vehicle.batteryKwh ? `(${pile.vehicle.batteryKwh} кВтц)` : ''}
                          </span>
                        </div>
                      )}

                      {/* Freshness timestamp */}
                      <div className="flex items-center justify-between text-[10px] text-[var(--color-fg-subtle)] pt-1">
                        <span>Телеметрийн төлөв: <strong className="text-[var(--color-fg-muted)]">{pile.qualityStatus}</strong></span>
                        <span>Сүүлд шинэчлэгдсэн: {pile.lastTelemetryAt ? new Date(pile.lastTelemetryAt).toLocaleTimeString() : '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Electrical Loss & Conversion Efficiency Panel */}
            <ElectricalLossPanel
              efficiency={data.efficiency}
              totalOutputKw={metrics?.totalOutputPowerKw ?? 0}
            />

            {/* 5. Active Alerts on this Station */}
            {alerts.length > 0 && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-rose-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-500">
                      Идэвхтэй анхааруулга & Саатал ({alerts.length})
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[var(--color-surface)] border border-rose-500/20 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-rose-500">{a.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-mono font-bold">
                            {a.severity}
                          </span>
                        </div>
                        <p className="text-[var(--color-fg-muted)] leading-relaxed">
                          {a.message}
                        </p>
                        <span className="text-[10px] text-[var(--color-fg-subtle)]">
                          Анх илэрсэн: {formatDateTime(a.firstSeenAt)}
                        </span>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAlertAction(a.id, 'RESOLVED')}
                        >
                          Шийдвэрлэх
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4 mt-4">
        <Button
          variant="secondary"
          onClick={() => {
            if (onConfigure) onConfigure();
          }}
        >
          <Settings className="size-4 mr-2" />
          Чадлын тохиргоо засах
        </Button>

        <Button variant="primary" onClick={onClose}>
          Хаах
        </Button>
      </div>
    </Modal>
  );
}
