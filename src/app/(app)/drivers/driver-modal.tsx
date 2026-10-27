'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { api, apiUrl, fetcher, errorMessage } from '@/lib/client';
import type { ChargePoint, DriverDetailResponse, DriverListItem, Paginated } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input, Select } from '@/components/ui/primitives';

export function DriverModal({
  driver,
  onClose,
  onSaved,
}: {
  driver?: DriverListItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(driver);

  const [name, setName] = React.useState(driver?.name || '');
  const [phone, setPhone] = React.useState(driver?.phone || '');
  const [email, setEmail] = React.useState(driver?.email || '');
  const [password, setPassword] = React.useState('');
  const [vehicleBrand, setVehicleBrand] = React.useState(driver?.vehicleBrand || '');
  const [vehicleModel, setVehicleModel] = React.useState(driver?.vehicleModel || '');
  const [ebarimtCustomerNo, setEbarimtCustomerNo] = React.useState(driver?.ebarimtCustomerNo || '');
  const [idTag, setIdTag] = React.useState(driver?.idTag || '');
  const [tagStatus, setTagStatus] = React.useState('Accepted');
  const [tagExpiryDate, setTagExpiryDate] = React.useState('');
  const [allowedStationIds, setAllowedStationIds] = React.useState<string[]>([]);
  const [initialBalance, setInitialBalance] = React.useState<string>('');
  const [isInternal, setIsInternal] = React.useState(Boolean(driver?.isInternal));
  const [isActive, setIsActive] = React.useState(driver ? driver.isActive : true);

  const [busy, setBusy] = React.useState(false);

  // Fetch stations for dropdown
  const { data: cpData } = useSWR<Paginated<ChargePoint>>(
    apiUrl('charge-points', { limit: 200 }),
    fetcher,
    { revalidateOnFocus: false }
  );
  const stations = cpData?.data ?? [];

  // Load full driver details when editing
  React.useEffect(() => {
    if (driver?.id) {
      api.get<DriverDetailResponse>(`drivers/${driver.id}`)
        .then((res) => {
          if (res?.driver) {
            if (res.driver.name) setName(res.driver.name);
            if (res.driver.phone) setPhone(res.driver.phone);
            if (res.driver.email) setEmail(res.driver.email);
            if (res.driver.vehicleBrand) setVehicleBrand(res.driver.vehicleBrand);
            if (res.driver.vehicleModel) setVehicleModel(res.driver.vehicleModel);
            if (res.driver.ebarimtCustomerNo) setEbarimtCustomerNo(res.driver.ebarimtCustomerNo);
            if (res.driver.idTag) setIdTag(res.driver.idTag);
          }
          const primaryTag = res?.rfidCards?.find((c) => c.isPrimary) || res?.rfidCards?.[0];
          if (primaryTag) {
            if (primaryTag.status) setTagStatus(primaryTag.status);
            if (primaryTag.expiryDate) setTagExpiryDate(primaryTag.expiryDate.slice(0, 10));
            if (primaryTag.allowedChargePointIds) {
              setAllowedStationIds(primaryTag.allowedChargePointIds);
            }
          }
        })
        .catch(() => {});
    }
  }, [driver?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Утасны дугаар заавал шаардлагатай');
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        phone: phone.trim(),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        password: password.trim() || undefined,
        vehicleBrand: vehicleBrand.trim() || undefined,
        vehicleModel: vehicleModel.trim() || undefined,
        ebarimtCustomerNo: ebarimtCustomerNo.trim() || undefined,
        isInternal,
        idTag: idTag.trim() || undefined,
        ...(idTag.trim()
          ? {
              tagStatus,
              tagExpiryDate: tagExpiryDate || undefined,
              allowedChargePointIds: allowedStationIds,
            }
          : {}),
      };

      if (isEditing && driver) {
        await api.patch(`drivers/${driver.id}`, {
          ...payload,
          isActive,
        });
        toast.success('Жолоочийн мэдээллийг шинэчиллээ');
      } else {
        const initBal = Number(initialBalance.replace(/[^0-9]/g, '')) || 0;
        await api.post('drivers', {
          ...payload,
          initialBalance: initBal,
        });
        toast.success('Шинэ жолооч амжилттай бүртгэгдлээ');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? 'Жолоочийн мэдээлэл засах' : 'Шинэ жолооч бүртгэх'}
      description={
        isEditing
          ? 'Жолоочийн хувийн мэдээлэл, нууц үг, картын тохиргоог өөрчлөх'
          : 'Системд шинэ жолооч бүртгэж хэтэвч үүсгэх'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Утасны дугаар *" hint="Жолоочийн нэвтрэх дугаар">
            <Input
              type="tel"
              required
              placeholder="Жишээ: 99112233"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          <Field label="Жолоочийн нэр">
            <Input
              type="text"
              placeholder="Жишээ: Бат-Эрдэнэ"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Имэйл хаяг">
            <Input
              type="email"
              placeholder="user@example.mn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field
            label={isEditing ? 'Нууц үг солих' : 'Нэвтрэх нууц үг / PIN'}
            hint={isEditing ? 'Өөрчлөхгүй бол хоосон орхино' : 'Хамгийн багадаа 4 тэмдэгт'}
          >
            <Input
              type="password"
              placeholder={isEditing ? 'Шинэ нууц үг оруулна уу' : 'Жишээ: 1234'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="И-Баримт код" hint="8 оронтой код">
            <Input
              type="text"
              placeholder="Жишээ: 12345678"
              value={ebarimtCustomerNo}
              onChange={(e) => setEbarimtCustomerNo(e.target.value)}
            />
          </Field>

          <Field label="Машины марк">
            <Input
              type="text"
              placeholder="Жишээ: Nissan, BYD"
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
            />
          </Field>

          <Field label="Машины загвар">
            <Input
              type="text"
              placeholder="Жишээ: Leaf, Atto 3"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
            />
          </Field>
        </div>

        {/* RFID Card Section */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-fg)]">
              RFID карт бүртгэх
            </span>
            <span className="text-[11px] text-[var(--color-fg-subtle)]">
              Жолоочид холбогдох карт
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="RFID картын дугаар" hint="Карт эсвэл Tag дугаар">
              <Input
                type="text"
                placeholder="Жишээ: E1234567"
                className="font-mono"
                value={idTag}
                onChange={(e) => setIdTag(e.target.value)}
              />
            </Field>

            <Field label="Картын төлөв">
              <Select
                value={tagStatus}
                onChange={(e) => setTagStatus(e.target.value)}
                options={[
                  { value: 'Accepted', label: 'Зөвшөөрсөн (Идэвхтэй)' },
                  { value: 'Blocked', label: 'Түгжигдсэн' },
                  { value: 'Expired', label: 'Хугацаа дууссан' },
                ]}
              />
            </Field>
          </div>

          {idTag.trim() ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Field label="Карт дуусах огноо" hint="Хугацаагүй бол хоосон орхино">
                <Input
                  type="date"
                  value={tagExpiryDate}
                  onChange={(e) => setTagExpiryDate(e.target.value)}
                />
              </Field>

              <Field
                label="Зөвшөөрсөн станцууд"
                hint={
                  allowedStationIds.length === 0
                    ? 'Бүх станцад зөвшөөрөгдөнө'
                    : `${allowedStationIds.length} станц сонгосон`
                }
              >
                <div className="space-y-2">
                  <Select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !allowedStationIds.includes(val)) {
                        setAllowedStationIds([...allowedStationIds, val]);
                      }
                    }}
                    options={[
                      { value: '', label: '+ Станц сонгох...' },
                      ...stations.map((st) => {
                        const id = String(st.id || st._id || '');
                        const isSelected =
                          allowedStationIds.includes(id) ||
                          (st.cpId ? allowedStationIds.includes(st.cpId) : false);
                        return {
                          value: id,
                          label: st.name ? `${st.name} (${st.cpId})` : st.cpId,
                          disabled: isSelected,
                        };
                      }),
                    ]}
                  />

                  {allowedStationIds.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {allowedStationIds.map((stId) => {
                        const st = stations.find(
                          (s) => String(s.id || s._id) === stId || s.cpId === stId,
                        );
                        const label = st?.name ? `${st.name} (${st.cpId})` : (st?.cpId || stId);
                        return (
                          <span
                            key={stId}
                            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium text-[var(--color-fg)] shadow-xs"
                          >
                            <span className="truncate max-w-[180px]">{label}</span>
                            <button
                              type="button"
                              className="text-[var(--color-fg-subtle)] hover:text-red-500 ml-1 text-sm font-bold leading-none transition cursor-pointer"
                              onClick={() =>
                                setAllowedStationIds(allowedStationIds.filter((id) => id !== stId))
                              }
                              title="Хасах"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setAllowedStationIds([])}
                        className="text-[11px] text-[var(--color-fg-subtle)] hover:text-red-500 underline ml-1 cursor-pointer"
                      >
                        Бүгдийг арилгах
                      </button>
                    </div>
                  ) : null}
                </div>
              </Field>
            </div>
          ) : null}
        </div>

        {!isEditing ? (
          <Field label="Анхны хэтэвчний үлдэгдэл (₮)" hint="Шинээр үүсэх хэтэвчинд цэнэглэх дүн">
            <Input
              type="number"
              min="0"
              step="500"
              placeholder="0 ₮"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </Field>
        ) : null}

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[var(--color-fg)]">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)]"
            />
            <span>
              Байгууллагын дотоод жолооч (Үнэ төлбөргүй цэнэглэлтийн эрхтэй)
            </span>
          </label>

          {isEditing ? (
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[var(--color-fg)]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)]"
              />
              <span>Хандалт идэвхтэй (Түгжээгүй)</span>
            </label>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Болих
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {isEditing ? 'Шинэчлэх' : 'Бүртгэх'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
