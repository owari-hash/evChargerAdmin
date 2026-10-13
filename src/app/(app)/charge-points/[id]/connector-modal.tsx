'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { CONNECTOR_TYPES, type Connector, type ConnectorType } from '@/lib/types';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';

/**
 * Registers a gun by hand, or edits the metadata OCPP never reports.
 *
 * Connectors are normally created by the station's first StatusNotification,
 * but they can be registered before it has ever connected so the QR stickers
 * can be printed and fitted during installation. The station then adopts the
 * row it finds rather than making a second one, so the printed code survives.
 */
export function ConnectorModal({
  open,
  onClose,
  chargePointId,
  connector,
  takenIds,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  chargePointId: string;
  /** Null when adding. */
  connector: Connector | null;
  /** Connector numbers already registered here, so the picker cannot clash. */
  takenIds: number[];
  onSaved: () => void;
}) {
  const editing = connector !== null;

  // Seeded once per mount. The parent keys this component per open, so a
  // cancelled edit leaves nothing behind without an effect resetting state.
  const [connectorId, setConnectorId] = React.useState(() =>
    connector
      ? String(connector.connectorId)
      : // Offer the next free number rather than making the operator work it out.
        String(Math.max(0, ...takenIds) + 1),
  );
  const [connectorType, setConnectorType] = React.useState<ConnectorType | ''>(
    (connector?.connectorType as ConnectorType) ?? '',
  );
  const [powerKw, setPowerKw] = React.useState(
    connector?.powerKw != null ? String(connector.powerKw) : '',
  );
  const [label, setLabel] = React.useState(connector?.label ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);

    const body = {
      connectorId: Number(connectorId),
      connectorType: connectorType || null,
      powerKw: powerKw.trim() === '' ? null : Number(powerKw),
      label: label.trim() || null,
    };

    try {
      if (editing) {
        const { connectorId: _ignored, ...patch } = body;
        await api.patch(`connectors/${connector.id}`, patch);
        toast.success('Холбогч шинэчлэгдлээ');
      } else {
        await api.post(`charge-points/${chargePointId}/connectors`, body);
        toast.success('Холбогч бүртгэгдэж, QR код үүслээ');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const numberTaken = !editing && takenIds.includes(Number(connectorId));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Холбогч №${connector.connectorId}` : 'Холбогч нэмэх'}
      description={
        editing
          ? 'OCPP-ээс ирдэггүй мэдээллийг л энд засна. Төлөв, тоолуурыг станц өөрөө мэдээлнэ.'
          : 'Станц холбогдоогүй байсан ч бүртгэж болно. QR код шууд үүсэх тул наалтаа хэвлүүлээд угсралтын үеэр наана.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Болих
          </Button>
          <Button
            variant="primary"
            onClick={save}
            loading={saving}
            disabled={numberTaken || connectorId.trim() === ''}
          >
            {editing ? 'Хадгалах' : 'Нэмэх'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <Field
          label="Холбогчийн дугаар"
          hint={
            editing
              ? 'Дугаарыг өөрчлөх боломжгүй — станц үүгээр таних тул.'
              : 'Станц дээрх гарцын дугаар. OCPP-д 1-ээс эхэлнэ.'
          }
          error={numberTaken ? `№${connectorId} аль хэдийн бүртгэгдсэн` : undefined}
          htmlFor="connector-number"
        >
          <Input
            id="connector-number"
            value={connectorId}
            onChange={(e) => setConnectorId(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            disabled={editing}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Холбогчийн төрөл" htmlFor="connector-type">
            <Select
              id="connector-type"
              value={connectorType}
              onChange={(e) => setConnectorType(e.target.value as ConnectorType | '')}
            >
              <option value="">Тодорхойгүй</option>
              {CONNECTOR_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Чадал (кВт)" hint="Жишээ: 120" htmlFor="connector-power">
            <Input
              id="connector-power"
              value={powerKw}
              onChange={(e) => setPowerKw(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder="120"
            />
          </Field>
        </div>

        <Field
          label="Нэр, байрлал"
          hint="Заавал биш. Наалт болон аппад харагдана, ж: “Зүүн тал”."
          htmlFor="connector-label"
        >
          <Input
            id="connector-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            placeholder="Зүүн тал"
          />
        </Field>
      </div>
    </Modal>
  );
}
