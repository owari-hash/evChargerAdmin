'use client';

import * as React from 'react';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  BatteryMedium,
  Building2,
  Clock,
  Gauge,
  Radio,
  Share2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { StatCard, StatGrid } from '@/components/stat-card';
import { formatKwh, formatNumber } from '@/lib/format';
import type { PowerMonitoringSummary } from '@/lib/types';
import { cn } from '@/lib/cn';

export function PowerKpiCards({
  summary,
  isLoading,
  activeFilter,
  onFilterChange,
}: {
  summary?: PowerMonitoringSummary | null;
  isLoading: boolean;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}) {
  const s = summary;

  const totalStations = s?.totalStations ?? 0;
  const onlineStations = s?.onlineStations ?? 0;
  const offlineStations = s?.offlineStations ?? 0;
  const chargingPiles = s?.chargingPilesCount ?? 0;
  const activeSessions = s?.activeSessionsCount ?? 0;
  const currentPowerKw = s?.totalCurrentPowerKw ?? 0;
  const availableCapacityKw = s?.totalAvailableCapacityKw ?? 0;
  const totalCapacityKw = s?.totalStationCapacityKw ?? 0;
  const utilizationPct = s?.networkUtilizationPct ?? 0;
  const sharingCount = s?.stationsSharingPowerCount ?? 0;
  const todayKwh = s?.totalEnergyDeliveredTodayKwh ?? 0;

  // Utilization progress color
  const utilColor =
    utilizationPct > 95
      ? 'from-red-500 to-rose-600'
      : utilizationPct > 80
      ? 'from-amber-500 to-orange-500'
      : utilizationPct > 50
      ? 'from-sky-500 to-blue-600'
      : 'from-emerald-500 to-teal-500';

  const lastTelemetryText = s?.lastTelemetryTimestamp
    ? new Date(s.lastTelemetryTimestamp).toLocaleTimeString('mn-MN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Мэдээлэл хүлээж байна';

  return (
    <div className="space-y-4">
      {/* 8 Top-Level KPI Cards */}
      <StatGrid min="9.5rem">
        <StatCard
          label="Нийт станц"
          value={isLoading ? '...' : totalStations}
          icon={Building2}
          tone="idle"
          onClick={onFilterChange ? () => onFilterChange('all') : undefined}
          active={activeFilter === 'all'}
        />
        <StatCard
          label="Онлайн станц"
          value={isLoading ? '...' : onlineStations}
          sub={`${totalStations > 0 ? Math.round((onlineStations / totalStations) * 100) : 0}% идэвхтэй`}
          icon={Zap}
          tone="ok"
          onClick={onFilterChange ? () => onFilterChange('online') : undefined}
          active={activeFilter === 'online'}
        />
        <StatCard
          label="Офлайн станц"
          value={isLoading ? '...' : offlineStations}
          icon={AlertTriangle}
          tone={offlineStations > 0 ? 'warn' : 'idle'}
          onClick={onFilterChange ? () => onFilterChange('offline') : undefined}
          active={activeFilter === 'offline'}
        />
        <StatCard
          label="Цэнэглэж буй буу"
          value={isLoading ? '...' : chargingPiles}
          sub="Буу идэвхтэй"
          icon={BatteryCharging}
          tone="brand"
          onClick={onFilterChange ? () => onFilterChange('charging') : undefined}
          active={activeFilter === 'charging'}
        />
        <StatCard
          label="Идэвхтэй цэнэглэлт"
          value={isLoading ? '...' : activeSessions}
          sub="Session ажиллаж байна"
          icon={Activity}
          tone="brand"
        />
        <StatCard
          label="Одоогийн нийт чадал"
          value={isLoading ? '...' : `${formatNumber(currentPowerKw, 1)} кВт`}
          sub={`Нийт хүчин чадлын ${utilizationPct}%`}
          icon={Gauge}
          tone={utilizationPct > 85 ? 'danger' : 'brand'}
        />
        <StatCard
          label="Боломжит сул чадал"
          value={isLoading ? '...' : `${formatNumber(availableCapacityKw, 1)} кВт`}
          sub="Нэмж цэнэглэх боломжтой"
          icon={BatteryMedium}
          tone="ok"
        />
        <StatCard
          label="Өнөөдөр түгээсэн эрчим хүч"
          value={isLoading ? '...' : formatKwh(todayKwh)}
          sub="Өдрийн эхнээс"
          icon={Sparkles}
          tone="info"
        />
      </StatGrid>

      {/* Network Power Summary & Capacity Allocation Bar */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Сүлжээний цахилгаан эрчим хүчний шууд нэгтгэл (Live Power Summary)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-fg-muted)]">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Clock className="size-3.5 text-[var(--color-fg-subtle)]" />
              <span>Сүүлийн телеметр:</span>
              <span className="font-semibold text-[var(--color-fg)]">{lastTelemetryText}</span>
            </span>

            <span className="h-3 w-px bg-[var(--color-border)] hidden sm:inline" />

            <span className="inline-flex items-center gap-1.5">
              <Share2 className="size-3.5 text-brand" />
              <span>Чадал хуваалцаж буй станц:</span>
              <span className="font-semibold text-[var(--color-fg)] font-mono">{sharingCount}</span>
            </span>
          </div>
        </div>

        {/* Capacity Bar Visual */}
        <div className="mt-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-3">
              <span className="text-[var(--color-fg)]">
                Ашиглалт: <strong className="font-semibold font-mono text-sm">{utilizationPct}%</strong>
              </span>
              <span className="text-[var(--color-fg-muted)]">
                ({formatNumber(currentPowerKw, 1)} кВт / {formatNumber(totalCapacityKw, 1)} кВт)
              </span>
            </div>
            <div className="text-[var(--color-fg-muted)]">
              Сул нөөц чадал:{' '}
              <span className="font-semibold font-mono text-emerald-500">{formatNumber(availableCapacityKw, 1)} кВт</span>
            </div>
          </div>

          <div className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out shadow-sm',
                utilColor,
              )}
              style={{ width: `${Math.min(100, Math.max(0, utilizationPct))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] pt-0.5">
            <span>0 кВт</span>
            <span>25%</span>
            <span>50% (Хэвийн)</span>
            <span>75%</span>
            <span>100% ({formatNumber(totalCapacityKw, 0)} кВт дээд хязгаар)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
