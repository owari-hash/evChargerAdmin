'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui/primitives';
import type { TariffZone } from '@/lib/types';

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Overlap check mirrors the backend's — shown inline so an operator catches
 *  a mistake before submitting rather than reading it back as a 400. */
function overlapError(zones: TariffZone[]): string | null {
  const sorted = [...zones].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMinute < sorted[i - 1].endMinute) return 'Цагийн бүсүүд давхцаж байна';
  }
  for (const z of zones) {
    if (z.endMinute <= z.startMinute) return 'Дуусах цаг эхлэх цагаас хойш байх ёстой';
  }
  return null;
}

/**
 * Time-of-day tariff rows for one station — e.g. 13:00–17:00 at 400₮/кВт·ц,
 * 17:00–20:00 at 600₮/кВт·ц. Whatever time of day falls outside every row
 * bills at the station's own flat "1 кВт·ц тариф" above this editor.
 */
export function TariffZonesEditor({
  zones,
  onChange,
}: {
  zones: TariffZone[];
  onChange: (zones: TariffZone[]) => void;
}) {
  const error = zones.length > 1 ? overlapError(zones) : null;

  function update(index: number, patch: Partial<TariffZone>) {
    onChange(zones.map((z, i) => (i === index ? { ...z, ...patch } : z)));
  }

  function remove(index: number) {
    onChange(zones.filter((_, i) => i !== index));
  }

  function add() {
    // Defaults to right after the last zone, so adding several in a row
    // naturally lays them out back-to-back instead of all starting at 00:00.
    const last = zones[zones.length - 1];
    const start = last ? Math.min(last.endMinute, 1380) : 0;
    onChange([...zones, { startMinute: start, endMinute: Math.min(start + 60, 1440), tariffPerKwh: 0 }]);
  }

  return (
    <div className="space-y-2">
      {zones.map((zone, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            type="time"
            value={minutesToTime(zone.startMinute)}
            onChange={(e) => update(i, { startMinute: timeToMinutes(e.target.value) })}
            className="w-28"
          />
          <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
          <Input
            type="time"
            value={minutesToTime(zone.endMinute === 1440 ? 0 : zone.endMinute)}
            onChange={(e) => {
              const minutes = timeToMinutes(e.target.value);
              update(i, { endMinute: minutes === 0 ? 1440 : minutes });
            }}
            className="w-28"
          />
          <Input
            type="number"
            min={0}
            step="any"
            value={zone.tariffPerKwh}
            onChange={(e) => update(i, { tariffPerKwh: Number(e.target.value) || 0 })}
            placeholder="₮/кВт·ц"
            className="flex-1"
          />
          <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Устгах">
            <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger)]" />
          </Button>
        </div>
      ))}

      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}

      <Button variant="secondary" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        Цагийн бүс нэмэх
      </Button>
    </div>
  );
}
