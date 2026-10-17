'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Activity,
  ArrowUpRight,
  Check,
  Filter,
  Search,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import { Input, Card, CardHeader, Button, Badge, Dot } from '@/components/ui/primitives';
import { LiveFeed } from '@/components/live-feed';
import { LIVE_EVENT_NAMES, type CsmsEvent, type StatsOverview } from '@/lib/types';
import { formatNumber, humanizeEvent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { apiUrl, fetcher } from '@/lib/client';
import { REFRESH } from '@/lib/live-query';
import { ConnectorStatusCounts } from '@/components/connector-status-counts';

// Useful event groups for quick filtering
const CHARGING_EVENTS = [
  'transaction.started',
  'transaction.stopped',
  'transaction.metervalue',
  'connector.status',
];

const SECURITY_AND_ERROR_EVENTS = [
  'security.event',
  'chargepoint.disconnected',
  'firmware.status',
  'diagnostics.status',
  'log.status',
];

/** Full-page event stream with live connector counts and per-event-type filtering. */
export function LiveView() {
  const [chargePointId, setChargePointId] = React.useState('');
  const [applied, setApplied] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>(
    LIVE_EVENT_NAMES.filter((e) => e !== 'ocpp.message'),
  );

  // Status filter selected from connector status bar (for quick navigation / filtering)
  const [selectedConnectorStatus, setSelectedConnectorStatus] = React.useState('');

  // Per-event-type live counter
  const [eventCounts, setEventCounts] = React.useState<Record<string, number>>({});
  const [totalReceived, setTotalReceived] = React.useState(0);

  // Real-time connector counts from stats/overview
  const { data: stats } = useSWR<StatsOverview>(apiUrl('stats/overview'), fetcher, {
    refreshInterval: REFRESH.live,
  });

  const connectorCounts = React.useMemo(() => {
    const formatted: Record<string, number> = {};
    if (stats?.connectors) {
      for (const [s, count] of Object.entries(stats.connectors)) {
        if (count != null) formatted[s] = count;
      }
    }
    return formatted;
  }, [stats?.connectors]);

  React.useEffect(() => {
    const t = setTimeout(() => setApplied(chargePointId.trim()), 400);
    return () => clearTimeout(t);
  }, [chargePointId]);

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  }

  const handleEvent = React.useCallback((event: CsmsEvent) => {
    setTotalReceived((n) => n + 1);
    setEventCounts((prev) => ({
      ...prev,
      [event.event]: (prev[event.event] ?? 0) + 1,
    }));
  }, []);

  const handleClear = React.useCallback(() => {
    setEventCounts({});
    setTotalReceived(0);
  }, []);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-fg)]">Шууд урсгал</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs text-[var(--color-fg-muted)]">
              <Dot tone="ok" pulse />
              Бодит цагийн үйл явдал
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
            Цэнэглэх сүлжээний бодит цагийн үйл явдал, мессеж болон төлөвийн урсгал
          </p>
        </div>

        {totalReceived > 0 ? (
          <span className="text-xs text-[var(--color-fg-muted)]">
            Хүлээн авсан: <strong className="text-[var(--color-fg)] tnum">{formatNumber(totalReceived)}</strong> үйл явдал
          </span>
        ) : null}
      </div>

      {/* Real-time Connector Status Counts Bar (Requested by user) */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-xs">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-[var(--color-fg)]">
            Холбогчдын бодит цагийн төлөв
          </span>
          <Link
            href={
              selectedConnectorStatus
                ? `/connectors?status=${encodeURIComponent(selectedConnectorStatus)}`
                : '/connectors'
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand)] hover:underline"
          >
            Холбогчдын хуудас руу очих
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ConnectorStatusCounts
          counts={connectorCounts}
          selectedStatus={selectedConnectorStatus}
          onSelectStatus={(s) => {
            setSelectedConnectorStatus(s);
            if (s === 'Charging') {
              setSelected(CHARGING_EVENTS);
            }
          }}
        />
      </div>

      {/* Main Grid: Filters Sidebar + Event Stream */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          {/* Station Filter */}
          <Card>
            <CardHeader title="Станцын шүүлтүүр" />
            <div className="space-y-2.5 p-4">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
                <Input
                  className="h-8 pl-8 pr-7 text-xs"
                  placeholder="Станцын дугаар / ID..."
                  value={chargePointId}
                  onChange={(e) => setChargePointId(e.target.value)}
                  aria-label="Станцын дугаараар шүүх"
                />
                {chargePointId ? (
                  <button
                    type="button"
                    onClick={() => setChargePointId('')}
                    className="absolute right-2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                    aria-label="Цэвэрлэх"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="text-[11px] text-[var(--color-fg-subtle)]">
                Хоосон орхивол бүх станцын үйл явдлыг харна.
              </p>
            </div>
          </Card>

          {/* Event Types Filter with Live Counters */}
          <Card>
            <CardHeader
              title="Үйл явдлын төрөл"
              actions={
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px]"
                    onClick={() => setSelected([...LIVE_EVENT_NAMES])}
                  >
                    Бүгд
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px]"
                    onClick={() => setSelected([])}
                  >
                    Хоослох
                  </Button>
                </div>
              }
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] p-2">
              <button
                type="button"
                onClick={() => setSelected(CHARGING_EVENTS)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                Зөвхөн цэнэглэлт
              </button>
              <button
                type="button"
                onClick={() => setSelected(SECURITY_AND_ERROR_EVENTS)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
              >
                Алдаа & Аюулгүй байдал
              </button>
            </div>

            {/* Event Types List */}
            <div className="space-y-0.5 p-2">
              {LIVE_EVENT_NAMES.map((name) => {
                const on = selected.includes(name);
                const count = eventCounts[name] ?? 0;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggle(name)}
                    className={cn(
                      'group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors select-none',
                      on
                        ? 'bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]'
                        : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                          on
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                            : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] group-hover:border-[var(--color-fg-muted)]',
                        )}
                        aria-hidden="true"
                      >
                        {on ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : null}
                      </span>
                      <span className="truncate">{humanizeEvent(name)}</span>
                    </div>

                    {count > 0 ? (
                      <span
                        className={cn(
                          'ml-2 rounded-full px-1.5 py-0.2 text-[10px] font-bold tnum',
                          on
                            ? 'bg-[var(--color-brand)] text-white'
                            : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]',
                        )}
                      >
                        {formatNumber(count)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selected.includes('ocpp.message') ? (
              <p className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-fg-subtle)]">
                Түүхий OCPP мессеж их хэмжээтэй — урсгал маш хурдан гүйнэ.
              </p>
            ) : null}
          </Card>
        </div>

        {/* Live Feed Stream Card */}
        <Card className="flex flex-col">
          <CardHeader
            title="Үйл явдлын урсгал"
            description={applied ? `${applied}-аар шүүсэн` : 'Бүх цэнэглэх станц'}
          />
          {selected.length === 0 ? (
            <div className="flex h-[600px] flex-col items-center justify-center gap-2 text-sm text-[var(--color-fg-muted)]">
              <SlidersHorizontal className="h-8 w-8 text-[var(--color-fg-subtle)]" />
              <p>Дор хаяж нэг үйл явдлын төрөл сонгоно уу.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelected([...LIVE_EVENT_NAMES])}
              >
                Бүх төрлийг сонгох
              </Button>
            </div>
          ) : (
            <LiveFeed
              key={`${applied}:${selected.join(',')}`}
              chargePointId={applied || undefined}
              events={selected}
              height="h-[600px]"
              onEvent={handleEvent}
              onClear={handleClear}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
