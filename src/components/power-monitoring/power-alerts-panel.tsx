'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import type { PowerAlertItem } from '@/lib/types';
import { Button, Card, Select } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

export function PowerAlertsPanel({
  stationId,
}: {
  stationId?: string;
}) {
  const [statusFilter, setStatusFilter] = React.useState<string>('ACTIVE');
  const [severityFilter, setSeverityFilter] = React.useState<string>('ALL');

  const { data, isLoading, mutate } = useSWR<PowerAlertItem[]>(
    apiUrl('power-monitoring/alerts', {
      stationId: stationId || undefined,
      status: statusFilter,
      severity: severityFilter !== 'ALL' ? severityFilter : undefined,
    }),
    fetcher,
    { refreshInterval: 5000 },
  );

  const alerts = data ?? [];

  const handleAction = async (alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
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
    <Card className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-rose-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
            Чадлын анхааруулга & Саатал илрүүлэлт (Alerts & Anomaly Detection)
          </span>
          {alerts.length > 0 && (
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-500">
              {alerts.length}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-8 text-xs w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ACTIVE">Идэвхтэй анхааруулгууд</option>
            <option value="ACKNOWLEDGED">Хүлээж авсан</option>
            <option value="RESOLVED">Шийдвэрлэгдсэн</option>
            <option value="ALL">Бүх төлөв</option>
          </Select>

          <Select
            className="h-8 text-xs w-auto"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">Бүх зэрэглэл</option>
            <option value="CRITICAL">Ноцтой (Critical)</option>
            <option value="WARNING">Анхааруулга (Warning)</option>
            <option value="INFO">Мэдээлэл (Info)</option>
          </Select>

          <Button size="sm" variant="ghost" onClick={() => mutate()}>
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Alerts Feed */}
      {isLoading && alerts.length === 0 ? (
        <div className="py-12 text-center text-xs text-[var(--color-fg-muted)]">
          Анхааруулгуудыг шалгаж байна...
        </div>
      ) : alerts.length === 0 ? (
        <div className="py-12 text-center space-y-1">
          <CheckCircle2 className="size-7 text-emerald-500 mx-auto" />
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            Сүлжээнд ямар нэг чадлын гажиг, саатал бүртгэгдээгүй байна
          </p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Хүчдэл, гүйдэл, чадлын хязгаарууд бүх станц дээр хэвийн ажиллаж байна.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';

            const borderTone = isCritical
              ? 'border-rose-500/30 bg-rose-500/5'
              : isWarning
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-blue-500/30 bg-blue-500/5';

            const badgeTone = isCritical
              ? 'bg-rose-500/10 text-rose-500'
              : isWarning
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-blue-500/10 text-blue-500';

            return (
              <div
                key={alert.id}
                className={cn(
                  'rounded-xl border p-3.5 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3',
                  borderTone,
                )}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-[10px] font-bold font-mono px-2 py-0.5 rounded-full', badgeTone)}>
                      {alert.severity}
                    </span>

                    <span className="font-bold text-sm text-[var(--color-fg)]">
                      {alert.title}
                    </span>

                    <span className="font-mono text-xs text-[var(--color-fg-muted)] px-1.5 py-0.5 rounded bg-[var(--color-surface)]">
                      {alert.cpId} {alert.connectorId ? `(Буу #${alert.connectorId})` : ''}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
                    {alert.message}
                  </p>

                  <div className="flex items-center gap-4 text-[10px] text-[var(--color-fg-subtle)] font-mono">
                    <span>Илэрсэн: {formatDateTime(alert.firstSeenAt)}</span>
                    <span>Сүүлд шалгагдсан: {formatDateTime(alert.lastSeenAt)}</span>
                    {alert.status !== 'ACTIVE' && (
                      <span className="text-emerald-500 font-semibold">Төлөв: {alert.status}</span>
                    )}
                  </div>
                </div>

                {alert.status === 'ACTIVE' && (
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAction(alert.id, 'ACKNOWLEDGED')}
                    >
                      Мэдсэн
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAction(alert.id, 'RESOLVED')}
                    >
                      Шийдвэрлэх
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
