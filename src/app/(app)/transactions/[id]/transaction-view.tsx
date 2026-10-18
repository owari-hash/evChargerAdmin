'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Square, Undo2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { REFRESH, useAutoRefresh } from '@/lib/live-query';
import {
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPower,
  formatWh,
} from '@/lib/format';
import type { MeterValue, Transaction } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataRow,
  Field,
  Input,
  DetailHeader,
} from '@/components/ui/primitives';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { TransactionStatusBadge } from '@/components/ui/status';
import { StatCard, StatGrid } from '@/components/stat-card';
import { STOP_REASON, mn } from '@/lib/mn';
import { SessionPowerChart } from '@/components/charts/energy-chart';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty } from '@/components/ui/table';
import { StationName } from '@/components/station-name';

/** Pull one measurand out of a MeterValue sample set. */
function sample(mv: MeterValue, measurand: string): number | null {
  const found = mv.sampledValue?.find((s) =>
    measurand === 'Energy.Active.Import.Register'
      ? (s.measurand ?? 'Energy.Active.Import.Register') === measurand
      : s.measurand === measurand,
  );
  if (!found) return null;
  const n = Number(found.value);
  if (!Number.isFinite(n)) return null;
  // Normalise kW/kWh to W/Wh so the chart has one unit.
  if (found.unit === 'kW' || found.unit === 'kWh') return n * 1000;
  return n;
}

export function TransactionView({
  tx,
  meterValues,
  meterValueTotal,
  canOperate,
  canRefund,
}: {
  tx: Transaction;
  meterValues: MeterValue[];
  meterValueTotal: number;
  canOperate: boolean;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [forceClose, setForceClose] = React.useState(false);
  const [meterStop, setMeterStop] = React.useState('');
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [refundReason, setRefundReason] = React.useState('');

  const id = tx.transactionId ?? tx.id;
  const isActive = tx.status === 'Active';
  const refundable = tx.status === 'Completed' && (tx.cost ?? 0) > 0 && tx.refund?.state !== 'PENDING';
  const hasReceipt = tx.ebarimt?.status === 'SUCCESS';
  // Server-rendered detail: a running session updates every few seconds; a
  // finished one only needs the occasional check.
  useAutoRefresh(isActive ? REFRESH.live : REFRESH.config);

  const energyWh = isActive ? (tx.lastMeterWh ?? tx.meterStart) - tx.meterStart : tx.energyWh;

  const chartData = React.useMemo(
    () =>
      meterValues
        .slice()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((mv) => ({
          t: mv.timestamp,
          power: sample(mv, 'Power.Active.Import'),
          soc: sample(mv, 'SoC'),
          energy: sample(mv, 'Energy.Active.Import.Register'),
        })),
    [meterValues],
  );

  async function stopRemotely() {
    setBusy(true);
    try {
      const res = await api.post<{ status?: string }>(`transactions/${id}/stop`);
      if (res.status === 'Accepted') {
        toast.success('Зогсоох хүсэлтийг хүлээн авлаа. Станц цэнэглэлтийг дуусгана.');
      } else {
        toast.warning(`Станц ${res.status ?? 'тодорхойгүй'} гэж хариулав.`);
      }
      setConfirmStop(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function closeInDatabase() {
    setBusy(true);
    try {
      await api.post(`transactions/${id}/force-close`, {
        ...(meterStop ? { meterStop: Number(meterStop) } : {}),
      });
      toast.success('Цэнэглэлтийг өгөгдлийн санд хаалаа.');
      setForceClose(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function refund() {
    setBusy(true);
    try {
      const res = await api.post<Transaction>(`transactions/${id}/refund`, { reason: refundReason.trim() });
      toast.success(
        `${formatMoney(res.refund?.amount ?? 0)} хэтэвчинд буцаалаа${res.refund?.ebarimtReturned ? ', е-баримт буцаагдсан' : ''}.`,
      );
      setRefundOpen(false);
      setRefundReason('');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link
        href="/transactions"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-brand)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Бүх цэнэглэлт
      </Link>

      <Card className="mb-4">
        <DetailHeader
          className="border-b-0"
          leading={
            <>
              <span className="font-mono text-sm font-semibold text-[var(--color-fg)]">#{id}</span>
              <TransactionStatusBadge status={tx.status} />
              {tx.startedRemotely ? <Badge tone="info">Алсаас эхэлсэн</Badge> : null}
              {tx.stoppedRemotely ? <Badge tone="info">Алсаас зогссон</Badge> : null}
              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
                <StationName
                  id={tx.chargePointId}
                  name={tx.chargePointName}
                  cpId={tx.cpId}
                  inline
                />
                {` · ${tx.connectorId} холбогч · карт `}
                <Link
                  href={`/id-tags?search=${encodeURIComponent(tx.idTag)}`}
                  className="font-mono hover:text-[var(--color-brand)] hover:underline"
                >
                  {tx.idTag}
                </Link>
              </span>
            </>
          }
          actions={
            <>
              {canOperate && isActive ? (
                <>
                  <Button variant="primary" size="sm" onClick={() => setConfirmStop(true)}>
                    <Square className="h-3.5 w-3.5" />
                    Цэнэглэлт зогсоох
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setForceClose(true)}>
                    <XCircle className="h-3.5 w-3.5" />
                    Албадан хаах
                  </Button>
                </>
              ) : null}
              {canRefund && refundable ? (
                <Button variant="danger" size="sm" onClick={() => setRefundOpen(true)}>
                  <Undo2 className="h-3.5 w-3.5" />
                  Буцаалт
                </Button>
              ) : null}
            </>
          }
        />
      </Card>

      <StatGrid>
        <StatCard label="Эрчим хүч" value={formatWh(energyWh)} />
        <StatCard label="Үргэлжилсэн" value={formatDuration(tx.startTimestamp, tx.stopTimestamp)} />
        <StatCard
          label="Одоогийн чадал"
          value={isActive ? formatPower(tx.lastPowerW) : '—'}
          sub={isActive ? 'Сүүлийн хэмжилт' : 'Цэнэглэлт дууссан'}
        />
        <StatCard
          label="Цэнэгийн түвшин"
          value={tx.lastSocPercent != null ? `${tx.lastSocPercent}%` : '—'}
        />
        <StatCard
          label="Төлбөр"
          value={tx.cost != null ? formatMoney(tx.cost) : '—'}
          sub={tx.tariffPerKwh != null ? `${formatMoney(tx.tariffPerKwh)} / кВт·ц` : 'Тариф тохируулаагүй'}
        />
      </StatGrid>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Чадал ба цэнэгийн түвшин"
            description={
              meterValueTotal > meterValues.length
                ? `Нийт ${formatNumber(meterValueTotal)} хэмжилтээс эхний ${formatNumber(meterValues.length)}-г харуулж байна`
                : `${formatNumber(meterValues.length)} тоолуурын утга`
            }
          />
          <div className="p-4 pr-5">
            <SessionPowerChart data={chartData} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Цэнэглэлтийн дэлгэрэнгүй" />
          <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
            <DataRow label="Төлөв">
              <TransactionStatusBadge status={tx.status} />
            </DataRow>
            <DataRow label="Эхэлсэн">{formatDateTime(tx.startTimestamp)}</DataRow>
            <DataRow label="Дууссан">{formatDateTime(tx.stopTimestamp)}</DataRow>
            <DataRow label="Зогссон шалтгаан">{mn(STOP_REASON, tx.stopReason)}</DataRow>
            <DataRow label="Эхний тоолуур" mono>
              {formatWh(tx.meterStart)}
            </DataRow>
            <DataRow label="Эцсийн тоолуур" mono>
              {tx.meterStop != null ? formatWh(tx.meterStop) : formatWh(tx.lastMeterWh)}
            </DataRow>
            <DataRow label="RFID карт" mono>
              {tx.idTag}
            </DataRow>
            <DataRow label="Жолооч">{tx.driver?.name || tx.driver?.phone || '—'}</DataRow>
            <DataRow label="Машин">
              {[tx.driver?.vehicleBrand, tx.driver?.vehicleModel].filter(Boolean).join(' ') || tx.vehicleModel || '—'}
            </DataRow>
            {tx.vehicleVin ? (
              <DataRow label="Машины VIN" mono>
                <span className="font-bold text-[var(--color-brand)]">{tx.vehicleVin}</span>
              </DataRow>
            ) : null}
            <DataRow label="Зогсоосон карт" mono>
              {tx.stopIdTag ?? '—'}
            </DataRow>
            <DataRow label="Захиалга">
              {tx.reservationId != null ? `#${tx.reservationId}` : '—'}
            </DataRow>
            <DataRow label="Сүүлийн хэмжилт">{formatDateTime(tx.lastMeterValueAt)}</DataRow>
            {tx.energyCost != null ? (
              <>
                <DataRow label="Эрчим хүчний төлбөр">{formatMoney(tx.energyCost)}</DataRow>
                <DataRow label="Үйлчилгээний хураамж">
                  {`${formatMoney(tx.feeAmount ?? 0)}${tx.feePercent != null ? ` (${tx.feePercent}%)` : ''}`}
                </DataRow>
                <DataRow label="Нийт">
                  <span className="font-semibold">{formatMoney(tx.cost)}</span>
                </DataRow>
              </>
            ) : (
              // Sessions from before the service fee only carry the total.
              <DataRow label="Нийт">{formatMoney(tx.cost)}</DataRow>
            )}
            <DataRow label="Е-баримт">
              {tx.ebarimt?.status === 'REFUNDED'
                ? 'Буцаагдсан'
                : tx.ebarimt?.status === 'SUCCESS'
                  ? `Олгосон · ${tx.ebarimt.receiptId ?? ''}`
                  : '—'}
            </DataRow>
            {tx.refund?.state === 'DONE' ? (
              <>
                <DataRow label="Буцаасан дүн">{formatMoney(tx.refund.amount ?? 0)}</DataRow>
                <DataRow label="Буцаалтын шалтгаан">{tx.refund.reason ?? '—'}</DataRow>
                <DataRow label="Буцаасан">
                  {`${formatDateTime(tx.refund.refundedAt)} · ${tx.refund.refundedBy ?? '—'}`}
                </DataRow>
              </>
            ) : null}
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Тоолуурын утгууд"
          description="Станцаас ирсэн түүхий хэмжилтийн утгууд."
        />
        <TableWrap maxHeight="24rem">
          <Table>
            <THead>
              <tr>
                <TH>Хугацаа</TH>
                <TH>Хэмжигдэхүүн</TH>
                <TH>Утга</TH>
                <TH>Нэгж</TH>
                <TH>Фаз</TH>
                <TH>Нөхцөл</TH>
                <TH>Байрлал</TH>
              </tr>
            </THead>
            <TBody>
              {meterValues.length === 0 ? (
                <TableEmpty colSpan={7}>Энэ цэнэглэлтэд тоолуурын утга бүртгэгдээгүй.</TableEmpty>
              ) : (
                meterValues
                  .slice()
                  .reverse()
                  .slice(0, 200)
                  .flatMap((mv) =>
                    (mv.sampledValue ?? []).map((sv, i) => (
                      <TR key={`${mv._id}-${i}`}>
                        <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                          {formatDateTime(mv.timestamp)}
                        </TD>
                        <TD className="text-xs">
                          {sv.measurand ?? 'Energy.Active.Import.Register'}
                        </TD>
                        <TD className="font-mono text-xs font-medium">
                          {sv.value}
                        </TD>
                        <TD className="text-xs text-[var(--color-fg-muted)]">{sv.unit ?? '—'}</TD>
                        <TD className="text-xs text-[var(--color-fg-muted)]">{sv.phase ?? '—'}</TD>
                        <TD className="text-xs text-[var(--color-fg-muted)]">{sv.context ?? '—'}</TD>
                        <TD className="text-xs text-[var(--color-fg-muted)]">{sv.location ?? '—'}</TD>
                      </TR>
                    )),
                  )
              )}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <ConfirmModal
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        onConfirm={() => void stopRemotely()}
        loading={busy}
        tone="primary"
        title="Энэ цэнэглэлтийг зогсоох уу?"
        confirmLabel="RemoteStopTransaction илгээх"
        message="Станцаас цэнэглэлтийг дуусгаж, кабелийг тайлахыг хүснэ. Эцсийн тоолуурын заалтыг станц өөрөө мэдээлнэ."
      />

      <Modal
        open={forceClose}
        onClose={() => setForceClose(false)}
        title="Өгөгдлийн санд албадан хаах"
        description="Станц StopTransaction илгээхгүй нь тодорхой үед л ашиглана уу."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForceClose(false)} disabled={busy}>
              Цуцлах
            </Button>
            <Button variant="danger" onClick={() => void closeInDatabase()} loading={busy}>
              Албадан хаах
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Энэ нь станцтай холбогдолгүйгээр цэнэглэлтийг CSMS дээр хаана. Хожим станц уг
            цэнэглэлтийн жинхэнэ эцсийн заалтыг мэдээлбэл төлбөр автоматаар залруулагдана.
          </p>
          <Field
            label="Эцсийн тоолуурын заалт (Вт·ц)"
            hint={`Хоосон орхивол сүүлд мэдэгдсэн утгыг (${formatWh(tx.lastMeterWh ?? tx.meterStart)}) ашиглана.`}
          >
            <Input
              value={meterStop}
              onChange={(e) => setMeterStop(e.target.value)}
              inputMode="numeric"
              placeholder={String(tx.lastMeterWh ?? tx.meterStart)}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Буцаалт хийх уу?"
        description={`Цэнэглэлт #${id} · ${formatMoney(tx.cost ?? 0)}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundOpen(false)} disabled={busy}>
              Цуцлах
            </Button>
            <Button
              variant="danger"
              onClick={() => void refund()}
              loading={busy}
              disabled={!refundReason.trim()}
            >
              Буцаалт хийх
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Энэ цэнэглэлтэд хэтэвчнээс хассан мөнгийг жолоочийн хэтэвчинд буцааж, цэнэглэлтийн
            төлөвийг «Буцаагдсан» болгоно.
            {hasReceipt
              ? ' Олгосон е-баримтыг эхлээд PosAPI-д буцаана; амжилтгүй бол мөнгө буцаахгүй.'
              : ''}{' '}
            Энэ үйлдлийг буцаах боломжгүй.
          </p>
          <Field label="Шалтгаан" hint="Хэтэвчийн хуулга болон аудитад хадгалагдана.">
            <Input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Жишээ: станцын алдаагаар цэнэглэгдээгүй"
              maxLength={255}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
