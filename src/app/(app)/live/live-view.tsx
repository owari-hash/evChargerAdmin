'use client';

import * as React from 'react';
import { Input, Card, CardHeader, PageHeader, Button } from '@/components/ui/primitives';
import { LiveFeed } from '@/components/live-feed';
import { LIVE_EVENT_NAMES } from '@/lib/types';
import { humanizeEvent } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Full-page event stream with per-event-type filtering. */
export function LiveView() {
  const [chargePointId, setChargePointId] = React.useState('');
  const [applied, setApplied] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>(
    LIVE_EVENT_NAMES.filter((e) => e !== 'ocpp.message'),
  );

  React.useEffect(() => {
    const t = setTimeout(() => setApplied(chargePointId.trim()), 400);
    return () => clearTimeout(t);
  }, [chargePointId]);

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  }

  return (
    <>
      <PageHeader
        title="Live feed"
        description="Every event the CSMS emits, streamed over Server-Sent Events."
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Filters" />
            <div className="space-y-3 p-4">
              <Input
                placeholder="Charge point id (optional)"
                value={chargePointId}
                onChange={(e) => setChargePointId(e.target.value)}
              />
              <p className="text-xs text-[var(--color-fg-subtle)]">
                Leave empty to watch the whole network.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Event types"
              actions={
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected([...LIVE_EVENT_NAMES])}
                  >
                    All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                    None
                  </Button>
                </div>
              }
            />
            <div className="space-y-0.5 p-2">
              {LIVE_EVENT_NAMES.map((name) => {
                const on = selected.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggle(name)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                      on
                        ? 'bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]'
                        : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]',
                    )}
                  >
                    <span
                      className={cn(
                        'h-3 w-3 shrink-0 rounded border',
                        on
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]'
                          : 'border-[var(--color-border-strong)]',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{humanizeEvent(name)}</span>
                  </button>
                );
              })}
            </div>
            {selected.includes('ocpp.message') ? (
              <p className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-fg-subtle)]">
                Raw OCPP frames are high volume — expect the feed to move quickly.
              </p>
            ) : null}
          </Card>
        </div>

        <Card className="flex flex-col">
          <CardHeader
            title="Event stream"
            description={applied ? `Filtered to ${applied}` : 'All charge points'}
          />
          {selected.length === 0 ? (
            <div className="flex h-[600px] items-center justify-center text-sm text-[var(--color-fg-muted)]">
              Select at least one event type.
            </div>
          ) : (
            <LiveFeed
              key={`${applied}:${selected.join(',')}`}
              chargePointId={applied || undefined}
              events={selected}
              height="h-[600px]"
            />
          )}
        </Card>
      </div>
    </>
  );
}
