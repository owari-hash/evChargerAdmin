'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Zap, X, ChevronRight, Clock, BatteryCharging } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { REFRESH } from '@/lib/live-query';
import {
  connectorLetter,
  formatDuration,
  formatMoney,
  formatPower,
  formatWh,
} from '@/lib/format';
import type { Transaction } from '@/lib/types';
import { cn } from '@/lib/cn';

export function LiveChargingButton() {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Poll live active transactions
  const { data: activeList = [], isLoading } = useSWR<Transaction[]>(
    apiUrl('transactions/active'),
    fetcher,
    {
      refreshInterval: REFRESH.live,
      revalidateOnFocus: true,
    },
  );

  const count = activeList.length;

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Live Session Button */}
      {count > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition shadow-sm active:scale-95',
            open
              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={`${count} идэвхтэй цэнэглэлт явагдаж байна`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Zap className="h-3.5 w-3.5 fill-current text-emerald-500 animate-pulse" />
          <span className="hidden sm:inline">{count} цэнэглэж байна</span>
          <span className="sm:hidden font-mono">{count}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition',
            open
              ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-fg)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Одоогоор идэвхтэй цэнэглэлт алга"
        >
          <Zap className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
          <span className="hidden sm:inline">0 цэнэглэлт</span>
          <span className="sm:hidden font-mono">0</span>
        </button>
      )}

      {/* Popover Modal exact bottom of button */}
      {open && (
        <div
          role="dialog"
          aria-label="Идэвхтэй цэнэглэлтүүд"
          className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] xs:w-84 sm:w-96 max-w-sm z-50 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl ring-1 ring-black/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface-2)]/60">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Zap className="h-4 w-4 fill-current animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--color-fg)]">
                  Идэвхтэй цэнэглэлт
                </span>
                <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {count}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-border)] hover:text-[var(--color-fg)] transition"
              aria-label="Хаах"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sessions List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)] p-2">
            {count === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-fg-muted)] space-y-2">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)]">
                  <Zap className="h-5 w-5" />
                </div>
                <p className="font-medium text-[var(--color-fg)]">Идэвхтэй цэнэглэлт алга</p>
                <p className="text-[11px] text-[var(--color-fg-subtle)]">
                  Одоогоор ямар нэг станц дээр машин цэнэглэгдээгүй байна.
                </p>
              </div>
            ) : (
              activeList.map((tx) => {
                const energyWh = (tx.lastMeterWh ?? tx.meterStart) - tx.meterStart;
                const letter = connectorLetter(tx.connectorId);

                return (
                  <Link
                    key={tx.id}
                    href={`/transactions/${tx.id}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl p-2.5 transition hover:bg-[var(--color-surface-2)] group space-y-2"
                  >
                    {/* Top: ID, Station, Duration */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-emerald-500">
                            #{tx.id}
                          </span>
                          <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.2 font-mono text-[10px] font-semibold text-[var(--color-fg)]">
                            Буу {letter}
                          </span>
                        </div>
                        <p className="truncate text-xs font-semibold text-[var(--color-fg)] mt-0.5">
                          {tx.chargePointName || tx.cpId || 'Станц'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-[var(--color-fg-subtle)] shrink-0 font-mono">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(tx.startTimestamp)}</span>
                      </div>
                    </div>

                    {/* Middle: Power & Battery SoC */}
                    <div className="flex items-center justify-between text-xs rounded-lg bg-[var(--color-bg)]/80 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-emerald-500 animate-pulse fill-emerald-500" />
                        <span className="font-mono font-bold text-[var(--color-fg)]">
                          {tx.lastPowerW ? formatPower(tx.lastPowerW) : 'Цэнэглэж байна'}
                        </span>
                      </div>

                      {tx.lastSocPercent != null ? (
                        <div className="flex items-center gap-1.5" title={`Цэнэгийн хувь: ${tx.lastSocPercent}%`}>
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, tx.lastSocPercent))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            {tx.lastSocPercent}%
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">
                          {formatWh(energyWh)}
                        </span>
                      )}
                    </div>

                    {/* Bottom: Driver & Cost */}
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] pt-0.5">
                      <span className="truncate max-w-[180px]">
                        {tx.driver?.name || tx.driver?.vehicleBrand || tx.idTag}
                      </span>
                      <span className="font-mono font-bold text-[var(--color-fg)]">
                        {tx.cost != null ? formatMoney(tx.cost) : '—'}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer Link */}
          <div className="border-t border-[var(--color-border)] p-2 bg-[var(--color-surface-2)]/40">
            <Link
              href="/transactions?status=Active"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 transition"
            >
              <span>Бүх цэнэглэлтийн жагсаалт харах</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
