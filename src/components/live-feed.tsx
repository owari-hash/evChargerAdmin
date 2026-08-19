'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pause, Play, Trash2 } from 'lucide-react';
import { Badge, Button, Dot, type Tone } from '@/components/ui/primitives';
import { useLiveEvents } from '@/lib/use-live-events';
import { formatRelative, humanizeEvent } from '@/lib/format';
import { CONNECTOR_STATUS, EVENT, STOP_REASON, mn } from '@/lib/mn';
import type { CsmsEvent } from '@/lib/types';

const EVENT_TONES: Record<string, Tone> = {
  'chargepoint.connected': 'ok',
  'chargepoint.disconnected': 'danger',
  'chargepoint.boot': 'info',
  'chargepoint.heartbeat': 'idle',
  'connector.status': 'info',
  'transaction.started': 'brand',
  'transaction.stopped': 'idle',
  'transaction.metervalue': 'idle',
  'security.event': 'danger',
  'firmware.status': 'warn',
  'diagnostics.status': 'warn',
  'log.status': 'warn',
  'command.result': 'info',
  'ocpp.message': 'idle',
};

/** One-line human summary of an event, chosen per event type. */
function describe(event: CsmsEvent): string {
  const e = event as Record<string, unknown>;
  switch (event.event) {
    case 'connector.status':
      return `${e.connectorId ?? '?'} холбогч → ${mn(CONNECTOR_STATUS, e.status as string)}${
        e.errorCode && e.errorCode !== 'NoError' ? ` (${e.errorCode})` : ''
      }`;
    case 'transaction.started':
      return `#${e.transactionId ?? '?'} цэнэглэлт ${e.connectorId ?? '?'} холбогч дээр эхэллээ (карт ${e.idTag ?? '?'})`;
    case 'transaction.stopped':
      return `#${e.transactionId ?? '?'} цэнэглэлт дуусав${e.reason ? ` — ${mn(STOP_REASON, e.reason as string)}` : ''}`;
    case 'transaction.metervalue': {
      const power = typeof e.powerW === 'number' ? `${(e.powerW / 1000).toFixed(1)} kW` : null;
      const soc = typeof e.socPercent === 'number' ? `${e.socPercent}%` : null;
      const parts = [power, soc].filter(Boolean).join(' · ');
      return `#${e.transactionId ?? '?'} цэнэглэлт${parts ? ` — ${parts}` : ' — тоолуурын утга'}`;
    }
    case 'security.event':
      return `${e.type ?? 'Аюулгүй байдлын үйл явдал'}${e.isCritical ? ' (ноцтой)' : ''}`;
    case 'command.result':
      return `${e.action ?? 'Команд'} → ${e.status ?? 'илгээсэн'}`;
    case 'chargepoint.boot':
      return `Асав: ${e.chargePointVendor ?? ''} ${e.chargePointModel ?? ''}`.trim() || 'Станц асав';
    case 'ocpp.message':
      return `${e.direction ?? ''} ${e.action ?? ''}`.trim();
    default:
      return humanizeEvent(event.event);
  }
}

export function LiveFeed({
  chargePointId,
  height = 'h-[420px]',
  events: wanted,
  showChargePoint = true,
  /** Refresh server-rendered data when a state-changing event arrives. */
  refreshOnEvent = false,
}: {
  chargePointId?: string;
  height?: string;
  events?: readonly string[];
  showChargePoint?: boolean;
  refreshOnEvent?: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = React.useState(false);

  // Coalesce bursts: a busy site can emit many events per second and refreshing
  // the route on each one would thrash the server.
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEvent = React.useCallback(
    (event: CsmsEvent) => {
      if (!refreshOnEvent) return;
      if (event.event === 'transaction.metervalue' || event.event === 'chargepoint.heartbeat') return;
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, 1500);
    },
    [refreshOnEvent, router],
  );

  React.useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const { events, status, clear } = useLiveEvents({
    chargePointId,
    events: wanted,
    buffer: 150,
    enabled: !paused,
    onEvent,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
          <Dot
            tone={paused ? 'idle' : status === 'live' ? 'ok' : status === 'connecting' ? 'warn' : 'danger'}
            pulse={!paused && status === 'live'}
          />
          {paused
            ? 'Түр зогссон'
            : status === 'live'
              ? 'Шууд дамжуулж байна'
              : status === 'connecting'
                ? 'Холбогдож байна…'
                : 'Холболт тасарсан'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Үргэлжлүүлэх' : 'Түр зогсоох'}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={clear} aria-label="Урсгал цэвэрлэх">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ul className={`flex-1 divide-y divide-[var(--color-border)] overflow-y-auto ${height}`}>
        {events.length === 0 ? (
          <li className="px-4 py-10 text-center text-xs text-[var(--color-fg-muted)]">
            {paused ? 'Урсгал түр зогссон.' : 'Үйл ажиллагаа хүлээж байна…'}
          </li>
        ) : (
          events.map((event) => (
            <li
              key={String(event._key)}
              className="animate-in-fade flex items-start gap-3 px-4 py-2.5 text-xs"
            >
              <Badge tone={EVENT_TONES[event.event] ?? 'idle'} className="shrink-0">
                {mn(EVENT, event.event)}
              </Badge>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[var(--color-fg)]">{describe(event)}</p>
                {showChargePoint && event.chargePointId ? (
                  <Link
                    href={`/charge-points/${encodeURIComponent(event.chargePointId)}`}
                    className="truncate font-mono text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-brand)]"
                  >
                    {event.chargePointId}
                  </Link>
                ) : null}
              </div>

              <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--color-fg-subtle)]">
                {formatRelative(event.at as string | undefined)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
