'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  KeyRound,
  MapPin,
  PlugZap,
  RefreshCw,
  Trash2,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import {
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPower,
  formatRelative,
  formatWh,
} from '@/lib/format';
import type { ChargePointDetail } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataRow,
  EmptyState,
  PageHeader,
} from '@/components/ui/primitives';
import { Tabs, TabCount, type TabItem } from '@/components/ui/tabs';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { CopyButton } from '@/components/ui/copy-button';
import { ConnectorStatusBadge, ErrorCodeBadge, OnlineBadge, RegistrationBadge } from '@/components/ui/status';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty } from '@/components/ui/table';
import { CommandConsole } from './command-console';
import { MessagesTab } from './messages-tab';
import { CommandLogTab } from './command-log-tab';
import { ConfigurationTab } from './configuration-tab';
import { LiveFeed } from '@/components/live-feed';

type TabKey = 'overview' | 'connectors' | 'configuration' | 'commands' | 'command-log' | 'messages';

export function ChargePointView({
  detail,
  canOperate,
  canAdmin,
}: {
  detail: ChargePointDetail;
  canOperate: boolean;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>('overview');
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmRotate, setConfirmRotate] = React.useState(false);
  const [rotatedKey, setRotatedKey] = React.useState<string | null>(null);

  const connectors = (detail.connectors ?? []).filter((c) => c.connectorId > 0);

  const tabs: TabItem[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'connectors', label: 'Connectors', badge: <TabCount>{connectors.length}</TabCount> },
    {
      key: 'configuration',
      label: 'Configuration',
      badge: <TabCount>{detail.configuration?.length ?? 0}</TabCount>,
    },
    { key: 'commands', label: 'Commands' },
    { key: 'command-log', label: 'Command log' },
    { key: 'messages', label: 'OCPP messages' },
  ];

  async function disconnect() {
    setBusy(true);
    try {
      await api.post(`charge-points/${encodeURIComponent(detail.id)}/disconnect`);
      toast.success('WebSocket closed. The charge point should reconnect shortly.');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey() {
    setBusy(true);
    try {
      const res = await api.post<{ authorizationKey: string }>(
        `charge-points/${encodeURIComponent(detail.id)}/rotate-authorization-key`,
      );
      setRotatedKey(res.authorizationKey);
      setConfirmRotate(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.del(`charge-points/${encodeURIComponent(detail.id)}`);
      toast.success(`${detail.id} deleted`);
      router.replace('/charge-points');
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <Link
        href="/charge-points"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-brand)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All charge points
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono">{detail.id}</span>
            <OnlineBadge online={detail.isOnline} />
            <RegistrationBadge status={detail.registrationStatus} />
            <Badge tone="idle">Profile {detail.securityProfile}</Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {detail.name ? <span>{detail.name}</span> : null}
            {detail.address ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {detail.address}
              </span>
            ) : null}
            <span>Last seen {formatRelative(detail.lastSeenAt)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            {canOperate && detail.isOnline ? (
              <Button variant="secondary" size="sm" onClick={() => void disconnect()} loading={busy}>
                <Unplug className="h-3.5 w-3.5" />
                Force reconnect
              </Button>
            ) : null}
            {canAdmin ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setConfirmRotate(true)}>
                  <KeyRound className="h-3.5 w-3.5" />
                  Rotate key
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <Card className="mb-4 overflow-hidden">
        <Tabs items={tabs} value={tab} onChange={(k) => setTab(k as TabKey)} />
      </Card>

      {tab === 'overview' ? <OverviewTab detail={detail} /> : null}
      {tab === 'connectors' ? <ConnectorsTab detail={detail} /> : null}
      {tab === 'configuration' ? (
        <ConfigurationTab
          chargePointId={detail.id}
          keys={detail.configuration ?? []}
          isOnline={detail.isOnline}
          canOperate={canOperate}
        />
      ) : null}
      {tab === 'commands' ? (
        <CommandConsole
          chargePointId={detail.id}
          isOnline={detail.isOnline}
          canOperate={canOperate}
        />
      ) : null}
      {tab === 'command-log' ? <CommandLogTab chargePointId={detail.id} /> : null}
      {tab === 'messages' ? <MessagesTab chargePointId={detail.id} /> : null}

      {/* ---- Dialogs ---- */}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        loading={busy}
        title="Delete charge point?"
        confirmLabel="Delete permanently"
        message={
          <>
            <span className="block">
              This removes <span className="font-mono font-medium">{detail.id}</span>, its
              connectors and its cached configuration, and closes the WebSocket.
            </span>
            <span className="mt-2 block">
              Sessions and meter values are kept for reporting. This cannot be undone.
            </span>
          </>
        }
      />

      <ConfirmModal
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        onConfirm={() => void rotateKey()}
        loading={busy}
        tone="primary"
        title="Rotate AuthorizationKey?"
        confirmLabel="Generate new key"
        message={
          <>
            <span className="block">
              A new key is generated and pushed to the charge point with
              ChangeConfiguration. It will reconnect using the new credentials.
            </span>
            <span className="mt-2 block">
              If the charge point is offline the push fails and you must set the key manually.
            </span>
          </>
        }
      />

      <Modal
        open={rotatedKey !== null}
        onClose={() => setRotatedKey(null)}
        title="New AuthorizationKey"
        description="Shown once — it is stored hashed."
        footer={
          <Button variant="primary" onClick={() => setRotatedKey(null)}>
            I have saved it
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-xs">
            {rotatedKey}
          </code>
          <CopyButton value={rotatedKey ?? ''} variant="secondary" label="Copy" />
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------

function OverviewTab({ detail }: { detail: ChargePointDetail }) {
  const active = detail.activeTransactions ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader
            title="Active sessions"
            description={`${formatNumber(active.length)} in progress on this charge point`}
          />
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Session</TH>
                  <TH>Connector</TH>
                  <TH>Tag</TH>
                  <TH align="right">Energy</TH>
                  <TH align="right">Power</TH>
                  <TH align="right">SoC</TH>
                  <TH align="right">Duration</TH>
                </tr>
              </THead>
              <TBody>
                {active.length === 0 ? (
                  <TableEmpty colSpan={7}>Nothing charging right now.</TableEmpty>
                ) : (
                  active.map((tx) => (
                    <TR key={tx.transactionId ?? tx.id}>
                      <TD>
                        <Link
                          href={`/transactions/${tx.transactionId ?? tx.id}`}
                          className="font-mono text-xs text-[var(--color-brand)] hover:underline"
                        >
                          #{tx.transactionId ?? tx.id}
                        </Link>
                      </TD>
                      <TD className="text-xs">#{tx.connectorId}</TD>
                      <TD className="font-mono text-xs">{tx.idTag}</TD>
                      <TD align="right" className="text-xs">
                        {formatWh((tx.lastMeterWh ?? tx.meterStart) - tx.meterStart)}
                      </TD>
                      <TD align="right" className="text-xs">
                        {formatPower(tx.lastPowerW)}
                      </TD>
                      <TD align="right" className="text-xs">
                        {tx.lastSocPercent != null ? `${tx.lastSocPercent}%` : '—'}
                      </TD>
                      <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                        {formatDuration(tx.startTimestamp)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="Hardware" />
            <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
              <DataRow label="Vendor">{detail.chargePointVendor ?? '—'}</DataRow>
              <DataRow label="Model">{detail.chargePointModel ?? '—'}</DataRow>
              <DataRow label="Firmware" mono>
                {detail.firmwareVersion ?? '—'}
              </DataRow>
              <DataRow label="Serial" mono>
                {detail.chargePointSerialNumber ?? detail.chargeBoxSerialNumber ?? '—'}
              </DataRow>
              <DataRow label="Meter type">{detail.meterType ?? '—'}</DataRow>
              <DataRow label="Meter serial" mono>
                {detail.meterSerialNumber ?? '—'}
              </DataRow>
              <DataRow label="ICCID" mono>
                {detail.iccid ?? '—'}
              </DataRow>
              <DataRow label="IMSI" mono>
                {detail.imsi ?? '—'}
              </DataRow>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Connection" />
            <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
              <DataRow label="State">
                <OnlineBadge online={detail.isOnline} />
              </DataRow>
              <DataRow label="Protocol" mono>
                {detail.ocppProtocol ?? 'ocpp1.6'}
              </DataRow>
              <DataRow label="Security profile">{detail.securityProfile}</DataRow>
              <DataRow label="Remote address" mono>
                {detail.remoteAddress ?? '—'}
              </DataRow>
              <DataRow label="Heartbeat">{detail.heartbeatInterval}s</DataRow>
              <DataRow label="Last heartbeat">{formatRelative(detail.lastHeartbeatAt)}</DataRow>
              <DataRow label="Last boot">{formatDateTime(detail.lastBootAt)}</DataRow>
              <DataRow label="Disconnected at">{formatDateTime(detail.disconnectedAt)}</DataRow>
            </dl>
          </Card>
        </div>

        <Card>
          <CardHeader title="Site" />
          <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
            <DataRow label="Name">{detail.name ?? '—'}</DataRow>
            <DataRow label="Description">{detail.description ?? '—'}</DataRow>
            <DataRow label="Address">{detail.address ?? '—'}</DataRow>
            <DataRow label="Coordinates" mono>
              {detail.latitude != null && detail.longitude != null
                ? `${detail.latitude}, ${detail.longitude}`
                : '—'}
            </DataRow>
            <DataRow label="Tariff">
              {detail.tariffPerKwh != null ? `${formatMoney(detail.tariffPerKwh)} / kWh` : 'Free'}
            </DataRow>
            <DataRow label="Tags">
              {detail.tags?.length ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {detail.tags.map((t) => (
                    <Badge key={t} tone="idle">
                      {t}
                    </Badge>
                  ))}
                </span>
              ) : (
                '—'
              )}
            </DataRow>
            <DataRow label="Registered">{formatDateTime(detail.createdAt)}</DataRow>
          </dl>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader title="Live activity" description="Events from this charge point" />
        <LiveFeed
          chargePointId={detail.id}
          height="h-[560px]"
          showChargePoint={false}
          refreshOnEvent
        />
      </Card>
    </div>
  );
}

function ConnectorsTab({ detail }: { detail: ChargePointDetail }) {
  const connectors = (detail.connectors ?? []).slice().sort((a, b) => a.connectorId - b.connectorId);

  if (connectors.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<PlugZap className="h-8 w-8" />}
          title="No connectors reported"
          description="Connectors appear once the charge point sends its first StatusNotification."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {connectors
          .filter((c) => c.connectorId > 0)
          .map((c) => (
            <Card key={c.connectorId} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Connector {c.connectorId}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                    {c.availability}
                    {c.info ? ` · ${c.info}` : ''}
                  </p>
                </div>
                <ConnectorStatusBadge status={c.status} />
              </div>

              <dl className="mt-3 space-y-0 border-t border-[var(--color-border)] pt-2">
                <DataRow label="Error">
                  <ErrorCodeBadge code={c.errorCode} />
                </DataRow>
                <DataRow label="Session">
                  {c.currentTransactionId ? (
                    <Link
                      href={`/transactions/${c.currentTransactionId}`}
                      className="font-mono text-[var(--color-brand)] hover:underline"
                    >
                      #{c.currentTransactionId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </DataRow>
                <DataRow label="Meter">{formatWh(c.lastMeterWh)}</DataRow>
                <DataRow label="Power">{formatPower(c.lastPowerW)}</DataRow>
                <DataRow label="SoC">
                  {c.lastSocPercent != null ? `${c.lastSocPercent}%` : '—'}
                </DataRow>
                <DataRow label="Updated">{formatRelative(c.statusTimestamp ?? c.updatedAt)}</DataRow>
              </dl>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader
          title="All connectors"
          description="Connector 0 represents the charge point as a whole."
        />
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>#</TH>
                <TH>Status</TH>
                <TH>Error</TH>
                <TH>Availability</TH>
                <TH>Session</TH>
                <TH align="right">Meter</TH>
                <TH align="right">Power</TH>
                <TH align="right">Updated</TH>
              </tr>
            </THead>
            <TBody>
              {connectors.map((c) => (
                <TR key={c.connectorId}>
                  <TD className="font-mono text-xs">{c.connectorId}</TD>
                  <TD>
                    <ConnectorStatusBadge status={c.status} />
                  </TD>
                  <TD>
                    <ErrorCodeBadge code={c.errorCode} />
                  </TD>
                  <TD className="text-xs">{c.availability}</TD>
                  <TD className="text-xs">
                    {c.currentTransactionId ? (
                      <Link
                        href={`/transactions/${c.currentTransactionId}`}
                        className="font-mono text-[var(--color-brand)] hover:underline"
                      >
                        #{c.currentTransactionId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TD>
                  <TD align="right" className="text-xs">
                    {formatWh(c.lastMeterWh)}
                  </TD>
                  <TD align="right" className="text-xs">
                    {formatPower(c.lastPowerW)}
                  </TD>
                  <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                    {formatRelative(c.statusTimestamp ?? c.updatedAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
