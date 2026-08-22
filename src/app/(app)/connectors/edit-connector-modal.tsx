'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { LockOpen, TriangleAlert } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import { formatPower, formatRelative, formatWh } from '@/lib/format';
import { Button, DataRow, ErrorNote, Field, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { ConnectorStatusBadge, ErrorCodeBadge } from '@/components/ui/status';
import type { Connector } from '@/lib/types';

type Availability = 'Operative' | 'Inoperative';

/**
 * A connector record is a mirror of what the station reports over OCPP — status,
 * error code and meter values are overwritten by the next StatusNotification, so
 * there is nothing there worth editing by hand. What an operator does control is
 * the two commands sent to the station, which is what this dialog exposes.
 *
 * Mount only while open, so the form always starts from the freshest row.
 */
export function EditConnectorModal({
  connector,
  onClose,
  onSaved,
}: {
  connector: Connector;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [availability, setAvailability] = React.useState<Availability>(
    connector.availability === 'Inoperative' ? 'Inoperative' : 'Operative',
  );
  const [saving, setSaving] = React.useState(false);
  const [unlocking, setUnlocking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const current: Availability =
    connector.availability === 'Inoperative' ? 'Inoperative' : 'Operative';
  const changed = availability !== current;
  const path = `charge-points/${encodeURIComponent(connector.chargePointId)}`;

  async function applyAvailability() {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ status?: string }>(`${path}/change-availability`, {
        connectorId: connector.connectorId,
        type: availability,
      });

      if (res.status === 'Scheduled') {
        // OCPP 1.6: the station accepted it but will not apply it until the
        // transaction in progress finishes.
        toast.success('Хүлээн авлаа. Одоогийн цэнэглэлт дуусмагц хэрэгжинэ.');
      } else if (res.status === 'Rejected') {
        setError('Станц энэ өөрчлөлтийг хүлээж авсангүй.');
        setSaving(false);
        return;
      } else {
        toast.success('Холбогчийн ашиглалт шинэчлэгдлээ.');
      }
      onSaved?.();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  async function unlock() {
    setUnlocking(true);
    setError(null);
    try {
      const res = await api.post<{ status?: string }>(`${path}/unlock-connector`, {
        connectorId: connector.connectorId,
      });
      if (res.status === 'Unlocked') toast.success('Холбогч онгойлоо.');
      else toast.error(`Станц хариулав: ${res.status ?? 'тодорхойгүй'}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Холбогч удирдах"
      description={`${connector.chargePointId} · ${connector.connectorId} дугаар холбогч`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving || unlocking}>
            Хаах
          </Button>
          <Button
            variant="primary"
            onClick={() => void applyAvailability()}
            loading={saving}
            disabled={!changed}
          >
            Хадгалах
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-xs text-[var(--color-fg-muted)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Төлөв, алдааны код, тоолуурын утгыг станц өөрөө мэдээлдэг тул гараар засах
            боломжгүй. Доорх үйлдлүүд станц руу OCPP команд илгээх бөгөөд станц холбогдсон
            байх шаардлагатай.
          </p>
        </div>

        <dl className="divide-y divide-[var(--color-border)]">
          <DataRow label="Төлөв">
            <ConnectorStatusBadge status={connector.status} />
          </DataRow>
          <DataRow label="Алдаа">
            <ErrorCodeBadge code={connector.errorCode} />
          </DataRow>
          <DataRow label="Идэвхтэй цэнэглэлт" mono>
            {connector.currentTransactionId ? `#${connector.currentTransactionId}` : '—'}
          </DataRow>
          <DataRow label="Тоолуур">{formatWh(connector.lastMeterWh)}</DataRow>
          <DataRow label="Чадал">{formatPower(connector.lastPowerW)}</DataRow>
          <DataRow label="Цэнэг">
            {connector.lastSocPercent != null ? `${connector.lastSocPercent}%` : '—'}
          </DataRow>
          <DataRow label="Шинэчлэгдсэн">
            {formatRelative(connector.statusTimestamp ?? connector.updatedAt)}
          </DataRow>
        </dl>

        <Field
          label="Ашиглалт"
          hint={
            connector.connectorId === 0
              ? 'Энэ нь станцын бүх холбогчид нэгэн зэрэг үйлчилнэ.'
              : 'Ажиллагаагүй болгосон холбогч дээр шинэ цэнэглэлт эхлэхгүй. Цэнэглэлт явагдаж байвал дуусмагц хэрэгжинэ.'
          }
        >
          <Select
            value={availability}
            onChange={(e) => setAvailability(e.target.value as Availability)}
          >
            <option value="Operative">Ажиллагаатай</option>
            <option value="Inoperative">Ажиллагаагүй</option>
          </Select>
        </Field>

        {connector.connectorId > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium">Холбогч онгойлгох</p>
              <p className="text-xs text-[var(--color-fg-muted)]">
                Кабель гацсан үед станцад цоожийг суллах команд илгээнэ.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void unlock()}
              loading={unlocking}
              disabled={saving}
            >
              <LockOpen className="h-3.5 w-3.5" />
              Онгойлгох
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
