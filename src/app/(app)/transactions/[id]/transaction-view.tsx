'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Square, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
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
  PageHeader,
} from '@/components/ui/primitives';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { TransactionStatusBadge } from '@/components/ui/status';
import { StatCard } from '@/components/stat-card';
import { SessionPowerChart } from '@/components/charts/energy-chart';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty } from '@/components/ui/table';

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
}: {
  tx: Transaction;
  meterValues: MeterValue[];
  meterValueTotal: number;
  canOperate: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [forceClose, setForceClose] = React.useState(false);
  const [meterStop, setMeterStop] = React.useState('');

  const id = tx.transactionId ?? tx.id;
  const isActive = tx.status === 'Active';

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
        toast.success('Stop accepted. The charge point will end the session.');
      } else {
        toast.warning(`The charge point answered ${res.status ?? 'unknown'}.`);
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
      toast.success('Session closed in the database.');
      setForceClose(false);
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
        All sessions
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono">Session #{id}</span>
            <TransactionStatusBadge status={tx.status} />
            {tx.startedRemotely ? <Badge tone="info">Remote start</Badge> : null}
            {tx.stoppedRemotely ? <Badge tone="info">Remote stop</Badge> : null}
          </span>
        }
        description={
          <>
            <Link
              href={`/charge-points/${encodeURIComponent(tx.chargePointId)}`}
              className="font-mono hover:text-[var(--color-brand)] hover:underline"
            >
              {tx.chargePointId}
            </Link>
            {` · connector ${tx.connectorId} · tag `}
            <Link
              href={`/id-tags?search=${encodeURIComponent(tx.idTag)}`}
              className="font-mono hover:text-[var(--color-brand)] hover:underline"
            >
              {tx.idTag}
            </Link>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            {canOperate && isActive ? (
              <>
                <Button variant="primary" size="sm" onClick={() => setConfirmStop(true)}>
                  <Square className="h-3.5 w-3.5" />
                  Stop session
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setForceClose(true)}>
                  <XCircle className="h-3.5 w-3.5" />
                  Force close
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Energy" value={formatWh(energyWh)} />
        <StatCard label="Duration" value={formatDuration(tx.startTimestamp, tx.stopTimestamp)} />
        <StatCard
          label="Power now"
          value={isActive ? formatPower(tx.lastPowerW) : '—'}
          sub={isActive ? 'Latest sample' : 'Session ended'}
        />
        <StatCard
          label="State of charge"
          value={tx.lastSocPercent != null ? `${tx.lastSocPercent}%` : '—'}
        />
        <StatCard
          label="Cost"
          value={tx.cost != null ? formatMoney(tx.cost) : '—'}
          sub={tx.tariffPerKwh != null ? `${formatMoney(tx.tariffPerKwh)} / kWh` : 'No tariff set'}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Power and state of charge"
            description={
              meterValueTotal > meterValues.length
                ? `Showing the first ${formatNumber(meterValues.length)} of ${formatNumber(meterValueTotal)} samples`
                : `${formatNumber(meterValues.length)} meter values`
            }
          />
          <div className="p-4 pr-5">
            <SessionPowerChart data={chartData} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Session details" />
          <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
            <DataRow label="Status">
              <TransactionStatusBadge status={tx.status} />
            </DataRow>
            <DataRow label="Started">{formatDateTime(tx.startTimestamp)}</DataRow>
            <DataRow label="Stopped">{formatDateTime(tx.stopTimestamp)}</DataRow>
            <DataRow label="Stop reason">{tx.stopReason ?? '—'}</DataRow>
            <DataRow label="Meter start" mono>
              {formatWh(tx.meterStart)}
            </DataRow>
            <DataRow label="Meter stop" mono>
              {tx.meterStop != null ? formatWh(tx.meterStop) : formatWh(tx.lastMeterWh)}
            </DataRow>
            <DataRow label="ID tag" mono>
              {tx.idTag}
            </DataRow>
            <DataRow label="Stop ID tag" mono>
              {tx.stopIdTag ?? '—'}
            </DataRow>
            <DataRow label="Reservation">
              {tx.reservationId != null ? `#${tx.reservationId}` : '—'}
            </DataRow>
            <DataRow label="Last sample">{formatDateTime(tx.lastMeterValueAt)}</DataRow>
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Meter values"
          description="Raw sampled values as reported by the charge point."
        />
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Timestamp</TH>
                <TH>Measurand</TH>
                <TH align="right">Value</TH>
                <TH>Unit</TH>
                <TH>Phase</TH>
                <TH>Context</TH>
                <TH>Location</TH>
              </tr>
            </THead>
            <TBody>
              {meterValues.length === 0 ? (
                <TableEmpty colSpan={7}>No meter values recorded for this session.</TableEmpty>
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
                        <TD align="right" className="font-mono text-xs font-medium">
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
        title="Stop this session?"
        confirmLabel="Send RemoteStopTransaction"
        message="The charge point is asked to end the session and unlock the cable. It reports the final meter reading itself."
      />

      <Modal
        open={forceClose}
        onClose={() => setForceClose(false)}
        title="Force close in the database"
        description="Use only when the charge point will never send StopTransaction."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForceClose(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void closeInDatabase()} loading={busy}>
              Force close
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-fg-muted)]">
            This closes the session in the CSMS without talking to the charge point. If the charge
            point later reports the session, the readings may disagree.
          </p>
          <Field
            label="Final meter reading (Wh)"
            hint={`Leave empty to use the last known value (${formatWh(tx.lastMeterWh ?? tx.meterStart)}).`}
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
    </>
  );
}
