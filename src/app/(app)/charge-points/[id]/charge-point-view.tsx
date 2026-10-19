'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  PlugZap,
  Printer,
  Trash2,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { REFRESH, useAutoRefresh } from '@/lib/live-query';
import {
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPower,
  formatRelative,
  formatWh,
} from '@/lib/format';
import type { ChargePointDetail, Client, Connector } from '@/lib/types';
import { withBasePath } from '@/lib/base-path';
import { EbarimtMerchantName, NetworkDefaultFee } from '@/components/ebarimt-merchant-select';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataRow,
  EmptyState,
  DetailHeader,
} from '@/components/ui/primitives';
import { Tabs, TabCount, type TabItem } from '@/components/ui/tabs';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { CopyButton } from '@/components/ui/copy-button';
import { ConnectorStatusBadge, ErrorCodeBadge, OnlineBadge, RegistrationBadge } from '@/components/ui/status';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty } from '@/components/ui/table';
import { ConnectorModal } from './connector-modal';
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
  // Server-rendered detail: re-fetch in place so status, connectors and
  // sessions stay live without a refresh button.
  useAutoRefresh(REFRESH.live);
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
      toast.success(`${detail.name?.trim() || detail.cpId} устгагдлаа`);
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

      <Card className="mb-4 overflow-hidden">
        <DetailHeader
          leading={
            <>
              <span className="text-sm font-semibold text-[var(--color-fg)]">
                {detail.name?.trim() || <span className="font-mono">{detail.cpId}</span>}
              </span>
              {detail.name?.trim() ? (
                <span className="font-mono text-xs text-[var(--color-fg-subtle)]">{detail.cpId}</span>
              ) : null}
              <OnlineBadge online={detail.isOnline} />
              <RegistrationBadge status={detail.registrationStatus} />
              <Badge tone="idle">{detail.securityProfile}-р профайл</Badge>
              {detail.address ? (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
                  <MapPin className="h-3 w-3" />
                  {detail.address}
                </span>
              ) : null}
              <span className="text-xs text-[var(--color-fg-muted)]">
                Сүүлд холбогдсон {formatRelative(detail.lastSeenAt)}
              </span>
            </>
          }
          actions={
            <>
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
        <Tabs items={tabs} value={tab} onChange={(k) => setTab(k as TabKey)} />
      </Card>

      {tab === 'overview' ? <OverviewTab detail={detail} /> : null}
      {tab === 'connectors' ? <ConnectorsTab detail={detail} canOperate={canOperate} /> : null}
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
          cpLabel={detail.name?.trim() || detail.cpId}
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
              Энэ үйлдэл{' '}
              <span className="font-medium">{detail.name?.trim() || detail.cpId}</span>
              {detail.name?.trim() ? (
                <span className="font-mono text-xs text-[var(--color-fg-muted)]"> ({detail.cpId})</span>
              ) : null}{' '}
              станц, түүний
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
          <TableWrap maxHeight="24rem">
            <Table>
              <THead>
                <tr>
                  <TH>Цэнэглэлт</TH>
                  <TH>Холбогч</TH>
                  <TH>Карт</TH>
                  <TH>Эрчим хүч</TH>
                  <TH>Чадал</TH>
                  <TH>Цэнэг</TH>
                  <TH>Үргэлжилсэн</TH>
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
                      <TD className="text-xs">
                        {formatWh((tx.lastMeterWh ?? tx.meterStart) - tx.meterStart)}
                      </TD>
                      <TD className="text-xs">
                        {formatPower(tx.lastPowerW)}
                      </TD>
                      <TD className="text-xs">
                        {tx.lastSocPercent != null ? `${tx.lastSocPercent}%` : '—'}
                      </TD>
                      <TD className="text-xs text-[var(--color-fg-muted)]">
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
            <DataRow label="Харилцагч">
              {detail.client ? (
                <Link
                  href={`/clients/${encodeURIComponent(detail.client.id)}`}
                  className="font-medium text-[var(--color-brand)] hover:underline inline-flex items-center gap-1"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{detail.client.name}</span>
                </Link>
              ) : (
                '—'
              )}
            </DataRow>
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
            <DataRow label="Үйлчилгээний хураамж">
              <EffectiveFee feePercent={detail.feePercent} clientId={detail.client?.id} />
            </DataRow>
            <DataRow label="Е-баримт мерчант">
              <EbarimtMerchantName
                id={detail.ebarimtMerchantId}
                fallback={detail.client ? 'Харилцагчийнхаас' : 'Сүлжээний үндсэн'}
              />
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

      <Card className="flex flex-col min-h-0 overflow-hidden">
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

/**
 * Whether a connector changed state in the last 45 seconds.
 *
 * This is the only reliable way to learn which physical gun is `connectorId: 1`
 * — OCPP never says. An installer plugs a cable into one gun, the pile sends
 * StatusNotification, and whichever card lights up here is that gun.
 *
 * Derived from the station's own `statusTimestamp` rather than diffing on the
 * client, so it survives a page reload mid-commissioning.
 */
const IDENTIFY_WINDOW_MS = 45_000;

function changedRecently(connector: Connector): boolean {
  const raw = connector.statusTimestamp ?? connector.updatedAt;
  if (!raw) return false;
  const at = Date.parse(raw);
  return Number.isFinite(at) && Date.now() - at < IDENTIFY_WINDOW_MS;
}

function ConnectorsTab({
  detail,
  canOperate,
}: {
  detail: ChargePointDetail;
  canOperate: boolean;
}) {
  const router = useRouter();
  const connectors = (detail.connectors ?? []).slice().sort((a, b) => a.connectorId - b.connectorId);
  // connectorId 0 is the station as a whole, not a gun, so it gets no sticker.
  const guns = connectors.filter((c) => c.connectorId > 0);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingConnector, setEditingConnector] = React.useState<Connector | null>(null);
  const [deleting, setDeleting] = React.useState<Connector | null>(null);
  const [busy, setBusy] = React.useState(false);

  function add() {
    setEditingConnector(null);
    setModalOpen(true);
  }

  function edit(connector: Connector) {
    setEditingConnector(connector);
    setModalOpen(true);
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`connectors/${deleting.id}`);
      toast.success(`Холбогч №${deleting.connectorId} устгагдлаа`);
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader
          title="Холбогч ба QR наалт"
          description="Хошуу бүр өөрийн байнгын QR кодтой. Станц холбогдоогүй байсан ч урьдчилан бүртгэж, наалтаа хэвлүүлж болно."
          actions={
            <div className="flex items-center gap-2">
              {guns.some((c) => c.code) ? (
                <Link
                  href={`/charge-points/${detail.id}/stickers`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 text-xs font-medium hover:bg-[var(--color-surface-2)]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Наалт хэвлэх
                </Link>
              ) : null}
              {canOperate ? (
                <Button variant="primary" size="sm" onClick={add}>
                  <Plus className="h-3.5 w-3.5" />
                  Холбогч нэмэх
                </Button>
              ) : null}
            </div>
          }
        />
        {guns.length === 0 ? (
          <EmptyState
            icon={<PlugZap className="h-8 w-8" />}
            title="Холбогч бүртгэгдээгүй байна"
            description="Станц эхний StatusNotification илгээмэгц өөрөө нэмэгдэнэ. Эсвэл одоо гараар бүртгээд QR кодоо авч болно."
            action={
              canOperate ? (
                <Button variant="primary" size="sm" onClick={add}>
                  <Plus className="h-3.5 w-3.5" />
                  Холбогч нэмэх
                </Button>
              ) : undefined
            }
          />
        ) : null}
      </Card>

      {guns.length > 0 ? (
        <div className="mb-4 rounded-lg border border-[var(--color-info)]/30 bg-[var(--color-info-soft)]/40 px-4 py-3 text-xs text-[var(--color-fg-muted)]">
          <p className="font-semibold text-[var(--color-fg)]">Аль хошуу нь хэд дэх холбогч вэ?</p>
          <p className="mt-1">
            OCPP протокол үүнийг хэлж өгдөггүй — үйлдвэр нь өөрөө дугаарладаг. Хошуу руу кабель
            залгахад тухайн холбогчийн карт энд гэрэлтэнэ. Тэрийг нь тэмдэглээд нэр өгч, QR
            наалтаа хэвлээрэй. Наалтыг хошуу тодорхой болсны дараа наах нь зүйтэй.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {guns.map((c) => (
          <Card
            key={c.connectorId}
            className={
              changedRecently(c)
                ? 'p-4 ring-2 ring-[var(--color-brand)] ring-offset-2 ring-offset-[var(--color-bg)]'
                : 'p-4'
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {c.connectorId} дугаар холбогч
                  {c.label ? (
                    <span className="ml-1.5 font-normal text-[var(--color-fg-muted)]">
                      · {c.label}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                  {[
                    c.connectorType ?? null,
                    c.powerKw != null ? `${c.powerKw} кВт` : null,
                    c.availability === 'Operative' ? 'Ажиллагаатай' : 'Ажиллагаагүй',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {changedRecently(c) ? <Badge tone="brand">Дөнгөж өөрчлөгдлөө</Badge> : null}
                <ConnectorStatusBadge status={c.status} />
              </div>
            </div>

            {c.code ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5">
                {/* Drawn by the console's own /console-api/qr, so these cards
                    cost the client bundle no QR library. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={withBasePath(`/console-api/qr?data=${encodeURIComponent(c.qrUrl ?? '')}`)}
                  alt={`Холбогч ${c.connectorId}-ийн QR код`}
                  className="h-20 w-20 shrink-0 rounded bg-white p-1"
                />
                <div className="min-w-0">
                  <p className="font-mono text-base font-bold tracking-widest">{c.code}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                    {c.qrUrl}
                  </p>
                  <div className="mt-1.5">
                    <CopyButton value={c.qrUrl ?? ''} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg-muted)]">
                QR код алга. Станц дараагийн удаа холбогдоход автоматаар үүснэ.
              </p>
            )}

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
              <DataRow label="Шинэчлэгдсэн">
                {formatRelative(c.statusTimestamp ?? c.updatedAt)}
              </DataRow>
            </dl>

            {canOperate ? (
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
                <Button variant="ghost" size="sm" onClick={() => edit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Засах
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Устгах
                </Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {/* Keyed and mounted per open, so the form seeds itself from props and
          needs no effect to reset between an add and an edit. */}
      {modalOpen ? (
        <ConnectorModal
          key={editingConnector?.id ?? 'new'}
          open
          onClose={() => setModalOpen(false)}
          chargePointId={detail.id}
          connector={editingConnector}
          takenIds={guns.map((c) => c.connectorId)}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        tone="danger"
        title={`Холбогч №${deleting?.connectorId ?? ''} устгах уу?`}
        confirmLabel="Устгах"
        message="Энэ хошууны QR код хүчингүй болно. Наалт нь станц дээрээ байвал дахин хэвлэх шаардлагатай."
      />

      <Card>
        <CardHeader
          title="Бүх холбогч"
          description="0 дугаар холбогч нь станцыг бүхэлд нь илэрхийлнэ."
        />
        <TableWrap maxHeight="24rem">
          <Table>
            <THead>
              <tr>
                <TH>#</TH>
                <TH>Төлөв</TH>
                <TH>Алдаа</TH>
                <TH>Ашиглалт</TH>
                <TH>Цэнэглэлт</TH>
                <TH>Тоолуур</TH>
                <TH>Чадал</TH>
                <TH>Шинэчлэгдсэн</TH>
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
                  <TD className="text-xs">
                    {formatWh(c.lastMeterWh)}
                  </TD>
                  <TD className="text-xs">
                    {formatPower(c.lastPowerW)}
                  </TD>
                  <TD className="text-xs text-[var(--color-fg-muted)]">
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

/**
 * The fee a session here is charged: the station's own override, else its
 * client's, else the network default (which the API does not expose).
 */
function EffectiveFee({
  feePercent,
  clientId,
}: {
  feePercent?: number | null;
  clientId?: string;
}) {
  const own = feePercent != null;
  const { data: client, error } = useSWR<Client>(
    !own && clientId ? apiUrl(`clients/${encodeURIComponent(clientId)}`) : null,
    fetcher,
  );

  if (own) return <>{`${feePercent}% · станцын`}</>;
  if (!clientId) return <NetworkDefaultFee />;
  if (error) return <>Харилцагчийнхаас</>;
  if (!client) return <>…</>;
  return client.feePercent != null ? (
    <>{`${client.feePercent}% · харилцагчийн`}</>
  ) : (
    <NetworkDefaultFee />
  );
}
