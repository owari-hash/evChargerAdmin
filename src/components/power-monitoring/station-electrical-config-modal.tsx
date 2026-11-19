'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/client';
import type { StationPowerItem } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input, Select } from '@/components/ui/primitives';

export function StationElectricalConfigModal({
  station,
  open,
  onClose,
  onSaved,
}: {
  station: StationPowerItem | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [ratedCapacityKW, setRatedCapacityKW] = React.useState<number>(120);
  const [configuredGridLimitKW, setConfiguredGridLimitKW] = React.useState<number>(120);
  const [inputMeterAvailable, setInputMeterAvailable] = React.useState<boolean>(false);
  const [powerSharingEnabled, setPowerSharingEnabled] = React.useState<boolean>(true);
  const [powerSharingMode, setPowerSharingMode] = React.useState<'DYNAMIC_DEMAND' | 'EQUAL' | 'PRIORITY' | 'FIFO'>('DYNAMIC_DEMAND');
  const [highUtilizationPct, setHighUtilizationPct] = React.useState<number>(80);
  const [overloadPct, setOverloadPct] = React.useState<number>(95);
  const [minVoltageV, setMinVoltageV] = React.useState<number>(320);
  const [maxVoltageV, setMaxVoltageV] = React.useState<number>(850);
  const [maxCurrentA, setMaxCurrentA] = React.useState<number>(250);
  const [piles, setPiles] = React.useState<{ connectorId: number; ratedPowerKw: number }[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (station) {
      setRatedCapacityKW(station.ratedCapacityKw ?? 120);
      setConfiguredGridLimitKW(station.configuredGridLimitKw ?? station.ratedCapacityKw ?? 120);
      setInputMeterAvailable(station.inputMeterAvailable ?? false);
      setPowerSharingEnabled(true);
      setPowerSharingMode(
        (station.powerSharingStatus === 'EQUAL_SHARING' ? 'EQUAL' : 'DYNAMIC_DEMAND') as any,
      );

      const pList = (station.connectors ?? []).map((c) => ({
        connectorId: c.connectorId,
        ratedPowerKw: c.powerKw || 60,
      }));
      setPiles(pList);
    }
  }, [station]);

  if (!open || !station) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`power-monitoring/stations/${station.id}/electrical-config`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratedCapacityKW,
          configuredGridLimitKW,
          inputMeterAvailable,
          powerSharingEnabled,
          powerSharingMode,
          warningThresholds: {
            highUtilizationPct,
            overloadPct,
            minVoltageV,
            maxVoltageV,
            maxCurrentA,
          },
          piles,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || d.message || 'Тохиргоог хадгалж чадсангүй');
      }

      toast.success('Станцын цахилгаан эрчим хүчний тохиргоо амжилттай хадгалагдлаа');
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${station.name} (${station.cpId}) — Цахилгаан чадлын тохиргоо`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Станцын физик дээд чадал (Rated Capacity kW)">
            <Input
              type="number"
              min={1}
              max={2000}
              value={ratedCapacityKW}
              onChange={(e) => setRatedCapacityKW(Number(e.target.value))}
              required
            />
          </Field>

          <Field label="Тохируулсан сүлжээний хязгаар (Grid Limit kW)">
            <Input
              type="number"
              min={1}
              max={2000}
              value={configuredGridLimitKW}
              onChange={(e) => setConfiguredGridLimitKW(Number(e.target.value))}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Чадлын хуваарилалтын горим (Power Sharing Mode)">
            <Select
              value={powerSharingMode}
              onChange={(e) => setPowerSharingMode(e.target.value as any)}
            >
              <option value="DYNAMIC_DEMAND">Динамик (Машины хэрэгцээгээр)</option>
              <option value="EQUAL">Тэгш хуваарилах (Equal Split)</option>
              <option value="PRIORITY">Тэргүүн ээлж (Priority)</option>
              <option value="FIFO">Түрүүлж ирсэнд нь (First-Come)</option>
            </Select>
          </Field>

          <Field label="Оролтын тоолуур холбогдсон эсэх (Input Meter)">
            <Select
              value={inputMeterAvailable ? 'true' : 'false'}
              onChange={(e) => setInputMeterAvailable(e.target.value === 'true')}
            >
              <option value="false">Холбогдоогүй (Зөвхөн гаралтын телеметр)</option>
              <option value="true">Холбогдсон (Алдагдал & үр ашиг тооцно)</option>
            </Select>
          </Field>
        </div>

        {/* Warning Thresholds */}
        <div className="rounded-xl border border-[var(--color-border)] p-3.5 space-y-3 bg-[var(--color-surface-2)]/40">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)] block">
            Анхааруулгын хязгаарууд (Warning Thresholds)
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Өндөр ачаалал (%)">
              <Input
                type="number"
                min={50}
                max={100}
                value={highUtilizationPct}
                onChange={(e) => setHighUtilizationPct(Number(e.target.value))}
              />
            </Field>

            <Field label="Хэтрэлт (%)">
              <Input
                type="number"
                min={90}
                max={150}
                value={overloadPct}
                onChange={(e) => setOverloadPct(Number(e.target.value))}
              />
            </Field>

            <Field label="Дээд гүйдэл (A)">
              <Input
                type="number"
                min={50}
                max={600}
                value={maxCurrentA}
                onChange={(e) => setMaxCurrentA(Number(e.target.value))}
              />
            </Field>

            <Field label="Доод хүчдэл (V)">
              <Input
                type="number"
                min={100}
                max={450}
                value={minVoltageV}
                onChange={(e) => setMinVoltageV(Number(e.target.value))}
              />
            </Field>

            <Field label="Дээд хүчдэл (V)">
              <Input
                type="number"
                min={500}
                max={1000}
                value={maxVoltageV}
                onChange={(e) => setMaxVoltageV(Number(e.target.value))}
              />
            </Field>
          </div>
        </div>

        {/* Individual Piles Rated Power */}
        {piles.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)] block">
              Цэнэглэх буу бүрийн чадлын тохиргоо (kW)
            </span>
            <div className="grid grid-cols-2 gap-3">
              {piles.map((p, idx) => (
                <Field key={p.connectorId} label={`Буу #${p.connectorId} чадал (кВт)`}>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={p.ratedPowerKw}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPiles((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, ratedPowerKw: val } : item)),
                      );
                    }}
                  />
                </Field>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Болих
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
