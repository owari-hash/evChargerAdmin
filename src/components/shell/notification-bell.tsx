'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dot, type Tone } from '@/components/ui/primitives';
import { useLiveEvents } from '@/lib/use-live-events';
import { formatMoney, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { CsmsEvent } from '@/lib/types';

/**
 * Every live event worth surfacing to an operator as a notification, beyond
 * the station/connector chatter `LiveIndicator` already revalidates quietly.
 * All financial: a payment, a wallet change, a refund.
 */
const NOTIFICATION_EVENTS = [
  'payment.paid',
  'payment.canceled',
  'wallet.credited',
  'wallet.debited',
  'transaction.refunded',
] as const;

interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  at: Date;
}

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

/** Turns one raw CSMS event into a notification, or null for one this bell ignores. */
function describe(event: CsmsEvent): NotificationItem | null {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const at = typeof event.at === 'string' ? new Date(event.at) : new Date();
  const id = `${event.event}-${String(event._key ?? at.getTime())}`;

  switch (event.event) {
    case 'payment.paid': {
      const amount = Number(data.paidAmount ?? data.amount ?? 0);
      return {
        id,
        title: 'Төлбөр төлөгдлөө',
        detail: [formatMoney(amount), data.idTag ? String(data.idTag) : null].filter(Boolean).join(' · '),
        tone: 'ok',
        at,
      };
    }
    case 'payment.canceled':
      return {
        id,
        title: 'Төлбөр цуцлагдлаа',
        detail: data.idTag ? String(data.idTag) : '—',
        tone: 'warn',
        at,
      };
    case 'wallet.credited': {
      const amount = Number(data.amount ?? 0);
      const action = ENTRY_LABEL[String(data.type ?? '')] ?? 'орлого орлоо';
      return {
        id,
        title: `Хэтэвч ${action}`,
        detail: `+${formatMoney(amount)} · ${ownerOf(data)} · үлдэгдэл ${formatMoney(Number(data.balance ?? 0))}`,
        tone: 'ok',
        at,
      };
    }
    case 'wallet.debited': {
      const amount = Number(data.amount ?? 0);
      return {
        id,
        title: 'Цэнэглэлтийн төлбөр хасагдлаа',
        detail: `-${formatMoney(amount)} · ${ownerOf(data)} · үлдэгдэл ${formatMoney(Number(data.balance ?? 0))}`,
        tone: 'warn',
        at,
      };
    }
    case 'transaction.refunded':
      return {
        id,
        title: 'Цэнэглэлт буцаагдлаа',
        detail: data.transactionId ? `Цэнэглэлт #${data.transactionId}` : '—',
        tone: 'warn',
        at,
      };
    default:
      return null;
  }
}

/**
 * Pops a toast the moment a payment, wallet change or refund happens anywhere
 * on the network, and keeps a short history behind the bell for whatever was
 * missed while looking elsewhere. In-memory only — reloading the console
 * clears it, same as the live station feed.
 */
export function NotificationBell() {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  useLiveEvents({
    events: NOTIFICATION_EVENTS,
    buffer: 1,
    onEvent: (event) => {
      const item = describe(event);
      if (!item) return;
      setItems((prev) => [item, ...prev].slice(0, 50));
      setUnread((n) => Math.min(n + 1, 99));
      toast(item.title, { description: item.detail });
    },
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
    setUnread(0);
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
        <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          <div className="border-b border-[var(--color-border)] px-3 py-2 text-center text-xs font-semibold text-[var(--color-fg-muted)]">
            Мэдэгдлүүд
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                Одоогоор мэдэгдэл алга.
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 border-b border-[var(--color-border)] px-3 py-2.5 last:border-0"
                >
                  <Dot tone={item.tone} />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className={cn('truncate text-xs text-[var(--color-fg-muted)]')}>{item.detail}</p>
                    <p className="text-[10px] text-[var(--color-fg-subtle)]">{formatRelative(item.at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
