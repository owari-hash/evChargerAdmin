'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  KeyRound,
  MapPin,
  Pencil,
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
import { EditChargePointModal } from '../edit-charge-point-modal';

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
  const [editing, setEditing] = React.useState(false);
  const [confirmRotate, setConfirmRotate] = React.useState(false);
  const [rotatedKey, setRotatedKey] = React.useState<string | null>(null);

  const connectors = (detail.connectors ?? []).filter((c) => c.connectorId > 0);

  const tabs: TabItem[] = [
    { key: 'overview', label: 'Тойм' },
    { key: 'connectors', label: 'Холбогч', badge: <TabCount>{connectors.length}</TabCount> },
    {
      key: 'configuration',
      label: 'Тохиргоо',
      badge: <TabCount>{detail.configuration?.length ?? 0}</TabCount>,
    },
    { key: 'commands', label: 'Команд' },
    { key: 'command-log', label: 'Командын түүх' },
    { key: 'messages', label: 'OCPP мессеж' },
  ];

  async function disconnect() {
    setBusy(true);
    try {
      await api.post(`charge-points/${encodeURIComponent(detail.id)}/disconnect`);
      toast.success('WebSocket холболт хаагдлаа. Станц удахгүй дахин холбогдоно.');
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
      toast.success(`${detail.cpId} устгагдлаа`);
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
        Бүх цэнэглэх станц
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono">{detail.cpId}</span>
            <OnlineBadge online={detail.isOnline} />
            <RegistrationBadge status={detail.registrationStatus} />
            <Badge tone="idle">{detail.securityProfile}-р профайл</Badge>
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
            <span>Сүүлд холбогдсон {formatRelative(detail.lastSeenAt)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Шинэчлэх
            </Button>
            {canOperate ? (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Засах
              </Button>
            ) : null}
            {canOperate && detail.isOnline ? (
              <Button variant="secondary" size="sm" onClick={() => void disconnect()} loading={busy}>
                <Unplug className="h-3.5 w-3.5" />
                Дахин холбуулах
              </Button>
            ) : null}
            {canAdmin ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setConfirmRotate(true)}>
                  <KeyRound className="h-3.5 w-3.5" />
                  Түлхүүр шинэчлэх
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Устгах
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
          cpLabel={detail.cpId}
          isOnline={detail.isOnline}
          canOperate={canOperate}
        />
      ) : null}
      {tab === 'command-log' ? <CommandLogTab chargePointId={detail.id} /> : null}
      {tab === 'messages' ? <MessagesTab chargePointId={detail.id} /> : null}

      {/* ---- Dialogs ---- */}

      {/* Mounted only while open, so the form always seeds from the freshest
          server data rather than from whatever it held last time. */}
      {editing ? (
        <EditChargePointModal
          chargePoint={detail}
          canRename={canAdmin}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            // A rename moves the station to a new URL; this page's own address
            // no longer resolves.
            if (updated.id !== detail.id) {
              router.replace(`/charge-points/${encodeURIComponent(updated.id)}`);
              return;
            }
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        loading={busy}
        title="Станцыг устгах уу?"
        confirmLabel="Бүрмөсөн устгах"
        message={
          <>
            <span className="block">
              Энэ үйлдэл <span className="font-mono font-medium">{detail.cpId}</span> станц, түүний
              холбогч болон хадгалагдсан тохиргоог устгаж, WebSocket холболтыг хаана.
            </span>
            <span className="mt-2 block">
              Цэнэглэлт болон тоолуурын утга тайланд үлдэнэ. Үйлдлийг буцаах боломжгүй.
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
        title="AuthorizationKey шинэчлэх үү?"
        confirmLabel="Шинэ түлхүүр үүсгэх"
        message={
          <>
            <span className="block">
              Шинэ түлхүүр үүсгэж ChangeConfiguration командаар станц руу илгээнэ. Станц шинэ
              нэвтрэх мэдээллээр дахин холбогдоно.
            </span>
            <span className="mt-2 block">
              Хэрэв станц офлайн байвал илгээлт амжилтгүй болох тул түлхүүрийг гараар оруулна.
            </span>
          </>
        }
      />

      <Modal
        open={rotatedKey !== null}
        onClose={() => setRotatedKey(null)}
        title="Шинэ AuthorizationKey"
        description="Ганц удаа харагдана — хэшлэгдэж хадгалагдана."
        footer={
          <Button variant="primary" onClick={() => setRotatedKey(null)}>
            Хадгаллаа
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-xs">
            {rotatedKey}
          </code>
          <CopyButton value={rotatedKey ?? ''} variant="secondary" label="Хуулах" />
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
            title="Идэвхтэй цэнэглэлт"
            description={`Энэ станц дээр ${formatNumber(active.length)} цэнэглэлт үргэлжилж байна`}
          />
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Цэнэглэлт</TH>
                  <TH>Холбогч</TH>
                  <TH>Карт</TH>
                  <TH align="right">Эрчим хүч</TH>
                  <TH align="right">Чадал</TH>
                  <TH align="right">Цэнэг</TH>
                  <TH align="right">Үргэлжилсэн</TH>
                </tr>
              </THead>
              <TBody>
                {active.length === 0 ? (
                  <TableEmpty colSpan={7}>Одоогоор цэнэглэж буй зүйл алга.</TableEmpty>
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
            <CardHeader title="Тоног төхөөрөмж" />
            <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
              <DataRow label="Үйлдвэрлэгч">{detail.chargePointVendor ?? '—'}</DataRow>
              <DataRow label="Загвар">{detail.chargePointModel ?? '—'}</DataRow>
              <DataRow label="Программ" mono>
                {detail.firmwareVersion ?? '—'}
              </DataRow>
              <DataRow label="Сериал дугаар" mono>
                {detail.chargePointSerialNumber ?? detail.chargeBoxSerialNumber ?? '—'}
              </DataRow>
              <DataRow label="Тоолуурын төрөл">{detail.meterType ?? '—'}</DataRow>
              <DataRow label="Тоолуурын сериал" mono>
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
            <CardHeader title="Холболт" />
            <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
              <DataRow label="Төлөв">
                <OnlineBadge online={detail.isOnline} />
              </DataRow>
              <DataRow label="Протокол" mono>
                {detail.ocppProtocol ?? 'ocpp1.6'}
              </DataRow>
              <DataRow label="Аюулгүй байдлын профайл">{detail.securityProfile}</DataRow>
              <DataRow label="Алсын хаяг" mono>
                {detail.remoteAddress ?? '—'}
              </DataRow>
              <DataRow label="Амьд дохио">{detail.heartbeatInterval} сек</DataRow>
              <DataRow label="Сүүлийн амьд дохио">{formatRelative(detail.lastHeartbeatAt)}</DataRow>
              <DataRow label="Сүүлд асаалт">{formatDateTime(detail.lastBootAt)}</DataRow>
              <DataRow label="Салсан хугацаа">{formatDateTime(detail.disconnectedAt)}</DataRow>
            </dl>
          </Card>
        </div>

        <Card>
          <CardHeader title="Байршил" />
          <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
            <DataRow label="Нэр">{detail.name ?? '—'}</DataRow>
            <DataRow label="Тайлбар">{detail.description ?? '—'}</DataRow>
            <DataRow label="Хаяг">{detail.address ?? '—'}</DataRow>
            <DataRow label="Солбицол" mono>
              {detail.latitude != null && detail.longitude != null
                ? `${detail.latitude}, ${detail.longitude}`
                : '—'}
            </DataRow>
            <DataRow label="Тариф">
              {detail.tariffPerKwh != null ? `${formatMoney(detail.tariffPerKwh)} / kWh` : 'Free'}
            </DataRow>
            <DataRow label="Шошго">
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
            <DataRow label="Бүртгэсэн">{formatDateTime(detail.createdAt)}</DataRow>
          </dl>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader title="Шууд үйл ажиллагаа" description="Энэ станцаас ирж буй үйл явдал" />
        <LiveFeed
          chargePointId={detail.cpId}
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
          title="Холбогч мэдээлээгүй байна"
          description="Станц эхний StatusNotification илгээмэгц холбогчид харагдана."
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
                  <p className="text-sm font-semibold">{c.connectorId} дугаар холбогч</p>
                  <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                    {c.availability === 'Operative' ? 'Ажиллагаатай' : 'Ажиллагаагүй'}
                    {c.info ? ` · ${c.info}` : ''}
                  </p>
                </div>
                <ConnectorStatusBadge status={c.status} />
              </div>

              <dl className="mt-3 space-y-0 border-t border-[var(--color-border)] pt-2">
                <DataRow label="Алдаа">
                  <ErrorCodeBadge code={c.errorCode} />
                </DataRow>
                <DataRow label="Цэнэглэлт">
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
                <DataRow label="Тоолуур">{formatWh(c.lastMeterWh)}</DataRow>
                <DataRow label="Чадал">{formatPower(c.lastPowerW)}</DataRow>
                <DataRow label="Цэнэг">
                  {c.lastSocPercent != null ? `${c.lastSocPercent}%` : '—'}
                </DataRow>
                <DataRow label="Шинэчлэгдсэн">{formatRelative(c.statusTimestamp ?? c.updatedAt)}</DataRow>
              </dl>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader
          title="Бүх холбогч"
          description="0 дугаар холбогч нь станцыг бүхэлд нь илэрхийлнэ."
        />
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>#</TH>
                <TH>Төлөв</TH>
                <TH>Алдаа</TH>
                <TH>Ашиглалт</TH>
                <TH>Цэнэглэлт</TH>
                <TH align="right">Тоолуур</TH>
                <TH align="right">Чадал</TH>
                <TH align="right">Шинэчлэгдсэн</TH>
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
                  <TD className="text-xs">
                    {c.availability === 'Operative' ? 'Ажиллагаатай' : 'Ажиллагаагүй'}
                  </TD>
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
