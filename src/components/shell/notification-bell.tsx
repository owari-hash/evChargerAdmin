'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BatteryFull, Bell, PlugZap } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dot } from '@/components/ui/primitives';
import { formatMoney, formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useStationNames } from '@/lib/use-station-names';
import {
  markAllRead,
  parseState,
  readRaw,
  recordNotification,
  subscribeNotifications,
  unreadCount,
  type StoredNotification,
} from '@/lib/notification-store';
import type { CsmsEvent } from '@/lib/types';
import { useLiveStreamEvents } from './live-stream';

type NewNotification = Omit<StoredNotification, 'toasted'>;

const OWNER_LABEL: Record<string, string> = {
  USER: 'жолооч',
  IDTAG: 'карт',
  CLIENT: 'харилцагч',
};

const ENTRY_LABEL: Record<string, string> = {
  TOPUP: 'цэнэглэгдлээ',
  REFUND: 'буцаалт орлоо',
  ADJUSTMENT: 'засварлагдлаа',
  BONUS: 'урамшуулал орлоо',
};

function ownerOf(data: Record<string, unknown>): string {
  const label = OWNER_LABEL[String(data.ownerType ?? '')] ?? '';
  const idTag = data.idTag ? String(data.idTag) : '';
  return [label, idTag].filter(Boolean).join(' ');
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/**
 * Turns one raw CSMS event into a notification, or null for one this bell
 * ignores (station/connector chatter, which LiveIndicator revalidates quietly).
 */
function describe(event: CsmsEvent, stationName: (id?: string) => string | undefined): NewNotification | null {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const at = typeof event.at === 'string' ? event.at : new Date().toISOString();
  // The server timestamp is the same in every tab, which is what dedupes these.
  const key = `${event.event}:${at}:${String(data.transactionId ?? data.idTag ?? '')}`;
  const station = stationName(event.chargePointId) ?? event.chargePointId ?? '—';

  switch (event.event) {
    case 'transaction.started': {
      const id = data.transactionId;
      if (id === undefined || id === null) return null;
      const who = (data.driverName ? String(data.driverName) : '') || (data.idTag ? String(data.idTag) : '');
      return {
        key: `tx:${String(id)}:started`,
        kind: 'transaction.started',
        title: 'Цэнэглэлт эхэллээ',
        detail: [station, data.connectorId !== undefined ? `Холбогч ${String(data.connectorId)}` : null, who || null]
          .filter(Boolean)
          .join(' · '),
        tone: 'brand',
        at,
        href: `/transactions/${encodeURIComponent(String(id))}`,
      };
    }
    case 'transaction.stopped': {
      const id = data.transactionId;
      if (id === undefined || id === null) return null;
      const wh = num(data.energyWh);
      const cost = num(data.cost);
      return {
        // A late StopTransaction re-settling a CSMS-closed session is the same
        // stop, so it shares the key and is not announced twice.
        key: `tx:${String(id)}:stopped`,
        kind: 'transaction.stopped',
        title: 'Цэнэглэлт дууслаа',
        detail: [
          station,
          wh !== undefined ? `${formatNumber(wh / 1000, 2)} кВт·ц` : null,
          cost !== undefined ? `₮${formatNumber(cost, 0)}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        tone: 'ok',
        at,
        href: `/transactions/${encodeURIComponent(String(id))}`,
      };
    }
    case 'payment.paid': {
      const amount = Number(data.paidAmount ?? data.amount ?? 0);
      return {
        key,
        kind: 'payment',
        title: 'Төлбөр төлөгдлөө',
        detail: [formatMoney(amount), data.idTag ? String(data.idTag) : null].filter(Boolean).join(' · '),
        tone: 'ok',
        at,
      };
    }
    case 'payment.canceled':
      return {
        key,
        kind: 'payment',
        title: 'Төлбөр цуцлагдлаа',
        detail: data.idTag ? String(data.idTag) : '—',
        tone: 'warn',
        at,
      };
    case 'wallet.credited': {
      const amount = Number(data.amount ?? 0);
      const action = ENTRY_LABEL[String(data.type ?? '')] ?? 'орлого орлоо';
      return {
        key,
        kind: 'wallet',
        title: `Хэтэвч ${action}`,
        detail: `+${formatMoney(amount)} · ${ownerOf(data)} · үлдэгдэл ${formatMoney(Number(data.balance ?? 0))}`,
        tone: 'ok',
        at,
      };
    }
    case 'wallet.debited': {
      const amount = Number(data.amount ?? 0);
      return {
        key,
        kind: 'wallet',
        title: 'Цэнэглэлтийн төлбөр хасагдлаа',
        detail: `-${formatMoney(amount)} · ${ownerOf(data)} · үлдэгдэл ${formatMoney(Number(data.balance ?? 0))}`,
        tone: 'warn',
        at,
      };
    }
    case 'transaction.refunded':
      return {
        key,
        kind: 'refund',
        title: 'Цэнэглэлт буцаагдлаа',
        detail: data.transactionId ? `Цэнэглэлт #${data.transactionId}` : '—',
        tone: 'warn',
        at,
        href: data.transactionId ? `/transactions/${encodeURIComponent(String(data.transactionId))}` : undefined,
      };
    default:
      return null;
  }
}

function KindIcon({ item, className }: { item: Pick<StoredNotification, 'kind' | 'tone'>; className?: string }) {
  if (item.kind === 'transaction.started') {
    return <PlugZap className={cn('h-4 w-4 shrink-0 text-[var(--color-brand)]', className)} aria-hidden />;
  }
  if (item.kind === 'transaction.stopped') {
    return <BatteryFull className={cn('h-4 w-4 shrink-0 text-[var(--color-ok)]', className)} aria-hidden />;
  }
  return (
    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center', className)}>
      <Dot tone={item.tone} />
    </span>
  );
}

/** At most this many held-back toasts are shown once the first-run guide closes. */
const MAX_FLUSHED_TOASTS = 3;

/**
 * Pops a toast the moment a charging session starts or stops, a payment lands,
 * a wallet changes or a refund happens anywhere on the network, and keeps the
 * history behind the bell. Stored per operator in localStorage (see
 * notification-store), shared by every open tab.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const stationName = useStationNames();

  const raw = React.useSyncExternalStore(
    subscribeNotifications,
    () => readRaw(userId),
    () => '',
  );
  const state = React.useMemo(() => parseState(raw), [raw]);
  const unread = unreadCount(state);

  const show = React.useCallback(
    (item: NewNotification) => {
      const href = item.href;
      toast(item.title, {
        description: item.detail,
        icon: <KindIcon item={item} />,
        action: href ? { label: 'Нээх', onClick: () => router.push(href) } : undefined,
      });
    },
    [router],
  );

  useLiveStreamEvents((event) => {
    const item = describe(event, stationName);
    if (!item) return;
    void recordNotification(userId, item).then((shouldToast) => {
      if (shouldToast) show(item);
    });
  });

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function toggle() {
    setOpen((o) => !o);
    markAllRead(userId);
  }

  return (
    <div ref={rootRef} className="relative">
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Мэдэгдэл">
        <Bell className="h-4 w-4" />
      </Button>
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          <div className="border-b border-[var(--color-border)] px-3 py-2 text-center text-xs font-semibold text-[var(--color-fg-muted)]">
            Мэдэгдлүүд
          </div>
          <div className="max-h-96 overflow-y-auto">
            {state.items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                Одоогоор мэдэгдэл алга.
              </p>
            ) : (
              state.items.map((item) => {
                const body = (
                  <>
                    <KindIcon item={item} className="mt-0.5" />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-xs font-medium">{item.title}</p>
                      <p className="truncate text-xs text-[var(--color-fg-muted)]">{item.detail}</p>
                      <p className="text-[10px] text-[var(--color-fg-subtle)]">{formatRelative(item.at)}</p>
                    </div>
                  </>
                );
                const rowClass =
                  'flex items-start gap-2 border-b border-[var(--color-border)] px-3 py-2.5 last:border-0';
                return item.href ? (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(rowClass, 'transition-colors hover:bg-[var(--color-surface-2)]')}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={item.key} className={rowClass}>
                    {body}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
