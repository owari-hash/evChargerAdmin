'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft,
  Building2,
  Edit2,
  ExternalLink,
  MapPin,
  Pencil,
  Phone,
  Plug,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatMoney, formatNumber, formatRelative } from '@/lib/format';
import type { ChargePoint, Client } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataRow,
  EmptyState,
  PageHeader,
} from '@/components/ui/primitives';
import {
  Table,
  TableEmpty,
  TableLoading,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/table';
import { ConnectorStatusBadge, OnlineBadge } from '@/components/ui/status';
import { ClientModal } from '../client-modal';
import { EditChargePointModal } from '../../charge-points/edit-charge-point-modal';

export function ClientDetailView({
  clientId,
  canEdit,
  canAdmin,
}: {
  clientId: string;
  canEdit: boolean;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const [editingClient, setEditingClient] = React.useState(false);
  const [editingStation, setEditingStation] = React.useState<ChargePoint | null>(null);

  const { data: client, error, isLoading, mutate } = useSWR<Client>(
    apiUrl(`clients/${encodeURIComponent(clientId)}`),
    fetcher,
    { refreshInterval: 15_000 },
  );

  if (isLoading && !client) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--color-fg-subtle)] text-sm">
        Ачаалж байна…
      </div>
    );
  }

  if (error || !client) {
    return (
      <EmptyState
        title="Харилцагч олдсонгүй"
        description="Харилцагчийн мэдээлэл олдсонгүй эсвэл устгагдсан байна."
        action={
          <Link href="/clients">
            <Button variant="secondary">Харилцагчдын жагсаалт руу буцах</Button>
          </Link>
        }
      />
    );
  }

  const stations = client.stations ?? [];
  const onlineCount = stations.filter((s) => s.isOnline).length;
  const totalConnectors = stations.reduce(
    (acc, s) => acc + (s.connectors?.filter((c) => c.connectorId > 0).length ?? 0),
    0,
  );

  return (
    <>
      <div className="mb-4">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Харилцагчдын жагсаалт руу буцах
        </Link>
      </div>

      <PageHeader
        title={client.name}
        description={
          client.businessRegister
            ? `Регистр: ${client.businessRegister} • Бүртгэсэн: ${formatDateTime(client.createdAt)}`
            : `Бүртгэсэн: ${formatDateTime(client.createdAt)}`
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void mutate()} aria-label="Шинэчлэх">
              <RefreshCw className="h-3.5 w-3.5" />
              Шинэчлэх
            </Button>
            {canEdit ? (
              <Button variant="secondary" size="sm" onClick={() => setEditingClient(true)}>
                <Edit2 className="h-3.5 w-3.5" />
                Мэдээлэл засах
              </Button>
            ) : null}
          </>
        }
      />

      {/* Metric summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{formatNumber(stations.length)}</div>
            <div className="text-xs text-[var(--color-fg-muted)]">Нийт цэнэглэх станц</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-success)]/10 text-[var(--color-success)]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-success)]">
              {formatNumber(onlineCount)}
            </div>
            <div className="text-xs text-[var(--color-fg-muted)]">Онлайн станц</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{formatNumber(totalConnectors)}</div>
            <div className="text-xs text-[var(--color-fg-muted)]">Нийт холбогч (буу)</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left 2 cols: Stations table */}
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title={`Харьяалагдах цэнэглэх станцууд (${stations.length})`}
              description="Энэ харилцагчийн эзэмшилд бүртгэгдсэн бүх станц"
            />
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Станц</TH>
                    <TH>Холболт</TH>
                    <TH>Холбогч</TH>
                    <TH>Загвар</TH>
                    <TH>Тариф</TH>
                    <TH align="right">Сүүлд холбогдсон</TH>
                    {canEdit ? (
                      <TH align="right">
                        <span className="sr-only">Үйлдэл</span>
                      </TH>
                    ) : null}
                  </tr>
                </THead>
                <TBody>
                  {stations.length === 0 ? (
                    <TableEmpty colSpan={canEdit ? 7 : 6}>
                      Энэ харилцагчид одоогоор станц хуваарилагдаагүй байна. Та станцын мэдээлэл
                      засах хэсгээс энэ харилцагчийг сонгож холбох боломжтой.
                    </TableEmpty>
                  ) : (
                    stations.map((cp) => (
                      <TR key={cp.id}>
                        <TD>
                          <Link
                            href={`/charge-points/${encodeURIComponent(cp.id)}`}
                            className="font-medium hover:text-[var(--color-brand)] hover:underline flex items-center gap-1.5"
                          >
                            <span>{cp.cpId}</span>
                            <ExternalLink className="h-3 w-3 text-[var(--color-fg-subtle)]" />
                          </Link>
                          {cp.name ? (
                            <p className="text-xs text-[var(--color-fg-muted)]">{cp.name}</p>
                          ) : null}
                        </TD>
                        <TD>
                          <OnlineBadge online={cp.isOnline} />
                        </TD>
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            {(cp.connectors ?? [])
                              .filter((c) => c.connectorId > 0)
                              .map((c) => (
                                <span
                                  key={c.connectorId}
                                  title={`${c.connectorId} дугаар холбогч`}
                                >
                                  <ConnectorStatusBadge status={c.status} />
                                </span>
                              ))}
                            {!(cp.connectors ?? []).some((c) => c.connectorId > 0) ? (
                              <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                            ) : null}
                          </div>
                        </TD>
                        <TD className="text-xs text-[var(--color-fg-muted)]">
                          {cp.chargePointModel || cp.chargePointVendor
                            ? `${cp.chargePointVendor ?? ''} ${cp.chargePointModel ?? ''}`.trim()
                            : '—'}
                        </TD>
                        <TD className="text-xs">
                          {cp.tariffPerKwh != null
                            ? `${formatMoney(cp.tariffPerKwh)} / kWh`
                            : 'Үнэгүй'}
                        </TD>
                        <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                          {formatRelative(cp.lastSeenAt)}
                        </TD>
                        {canEdit ? (
                          <TD align="right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingStation(cp)}
                              aria-label={`${cp.cpId} засах`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TD>
                        ) : null}
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </TableWrap>
          </Card>
        </div>

        {/* Right col: Client details card */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Харилцагчийн мэдээлэл" />
            <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
              <DataRow label="Нэр">{client.name}</DataRow>
              <DataRow label="Регистр" mono>
                {client.businessRegister ?? '—'}
              </DataRow>
              <DataRow label="Холбоо барих">{client.contactPerson ?? '—'}</DataRow>
              <DataRow label="Утас">{client.phone ?? '—'}</DataRow>
              <DataRow label="Имэйл">{client.email ?? '—'}</DataRow>
              <DataRow label="Хаяг">{client.address ?? '—'}</DataRow>
              <DataRow label="Төлөв">
                {client.isActive ? (
                  <Badge tone="ok">Идэвхтэй</Badge>
                ) : (
                  <Badge tone="idle">Идэвхгүй</Badge>
                )}
              </DataRow>
              <DataRow label="Тэмдэглэл">{client.description ?? '—'}</DataRow>
              <DataRow label="Бүртгэсэн">{formatDateTime(client.createdAt)}</DataRow>
            </dl>
          </Card>
        </div>
      </div>

      {editingClient ? (
        <ClientModal
          client={client}
          onClose={() => setEditingClient(false)}
          onSaved={() => {
            setEditingClient(false);
            void mutate();
          }}
        />
      ) : null}

      {editingStation ? (
        <EditChargePointModal
          chargePoint={editingStation}
          canRename={canAdmin}
          onClose={() => setEditingStation(null)}
          onSaved={() => {
            setEditingStation(null);
            void mutate();
          }}
        />
      ) : null}
    </>
  );
}
