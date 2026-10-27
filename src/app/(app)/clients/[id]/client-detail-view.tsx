'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Edit2,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  Lock,
  MapPin,
  Pencil,
  Phone,
  Plug,
  Plus,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { connectorLetter, formatDateTime, formatMoney, formatNumber, formatPhone, formatRelative } from '@/lib/format';
import type { ChargePoint, Client, IdTag, Paginated } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataRow,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Select,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
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
import { StatGrid } from '@/components/stat-card';
import { EbarimtMerchantName, NetworkDefaultFee } from '@/components/ebarimt-merchant-select';
import { ID_TAG_STATUS, mn } from '@/lib/mn';
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
  const [editingLogin, setEditingLogin] = React.useState(false);

  const { data: client, error, isLoading, mutate } = useSWR<Client>(
    apiUrl(`clients/${encodeURIComponent(clientId)}`),
    fetcher,
    { refreshInterval: REFRESH.config },
  );

  // "Дотоод бүртгэл": member cards that charge for free against this client's
  // own wallet — replaces the station's broken RFID fleet. Logged the same way
  // every other card is, so the usage trail lives in /transactions as usual.
  const { data: memberCardsData } = useSWR<Paginated<IdTag>>(
    apiUrl('id-tags', { walletOwnerType: 'CLIENT', walletOwnerId: clientId, limit: 200 }),
    fetcher,
    { refreshInterval: REFRESH.config },
  );
  const memberCards = memberCardsData?.data ?? [];

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
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Харилцагчдын жагсаалт руу буцах
        </Link>

        <Link href={`/reports?clientId=${client.id || client._id}`}>
          <Button variant="secondary" size="sm">
            <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--color-brand)]" />
            Станцын тайлан үзэх
          </Button>
        </Link>
      </div>


      {/* Metric summary */}
      <StatGrid min="13rem" className="mb-6 gap-4">
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
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left 2 cols: Stations table */}
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title={`Харьяалагдах цэнэглэх станцууд (${stations.length})`}
              description="Энэ харилцагчийн эзэмшдэг болон холбогдсон бүх станц"
            />
            <TableWrap maxHeight="24rem">
              <Table>
                <THead>
                  <tr>
                    <TH>Станц</TH>
                    <TH>Холболт</TH>
                    <TH>Холбогч</TH>
                    <TH>Загвар</TH>
                    <TH>Тариф</TH>
                    <TH>Сүүлд холбогдсон</TH>
                    {canEdit ? (
                      <TH>
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
                        <TD align="left" className="text-left px-3">
                          <Link
                            href={`/charge-points/${encodeURIComponent(cp.id)}`}
                            className="font-normal hover:text-[var(--color-brand)] hover:underline flex items-center gap-1.5"
                          >
                            <span className={cp.name?.trim() ? undefined : 'font-mono'}>
                              {cp.name?.trim() || cp.cpId}
                            </span>
                            <ExternalLink className="h-3 w-3 text-[var(--color-fg-subtle)]" />
                          </Link>
                          {cp.name?.trim() ? (
                            <p className="font-mono text-[11px] text-[var(--color-fg-subtle)]">{cp.cpId}</p>
                          ) : null}
                          {cp.owned === false ? (
                            <Badge tone="idle">Холбогдсон</Badge>
                          ) : null}
                        </TD>
                        <TD>
                          <OnlineBadge online={cp.isOnline} />
                        </TD>
                        <TD>
                          <div className="flex flex-wrap justify-center gap-1">
                            {(cp.connectors ?? [])
                              .filter((c) => c.connectorId > 0)
                              .map((c) => (
                                <span
                                  key={c.connectorId}
                                  title={`${connectorLetter(c.connectorId)} холбогч`}
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
                        <TD className="text-xs text-[var(--color-fg-muted)]">
                          {formatRelative(cp.lastSeenAt)}
                        </TD>
                        {canEdit ? (
                          <TD>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingStation(cp)}
                              aria-label={`${cp.name?.trim() || cp.cpId} засах`}
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
            <CardHeader
              title={client.name}
              description="Харилцагчийн мэдээлэл"
              actions={
                canEdit ? (
                  <Button variant="secondary" size="sm" onClick={() => setEditingClient(true)}>
                    <Edit2 className="h-3.5 w-3.5" />
                    Засах
                  </Button>
                ) : null
              }
            />
            <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
              <DataRow label="Нэр">{client.name}</DataRow>
              <DataRow label="Регистр" mono>
                {client.businessRegister ?? '—'}
              </DataRow>
              <DataRow label="Холбоо барих">{client.contactPerson ?? '—'}</DataRow>
              <DataRow label="Утас">{client.phone ? formatPhone(client.phone) : '—'}</DataRow>
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

          <Card>
            <CardHeader title="Тооцоо ба данс" description="Үйлчилгээний хураамж, е-баримт, төлбөр шилжүүлэх данс" />
            <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
              <DataRow label="Үйлчилгээний хураамж">
                {client.feePercent != null ? `${client.feePercent}%` : <NetworkDefaultFee />}
              </DataRow>
              <DataRow label="Е-баримт мерчант">
                <EbarimtMerchantName id={client.ebarimtMerchantId} fallback="Сүлжээний үндсэн" />
              </DataRow>
              <DataRow label="Банк">
                {client.payoutAccount?.bankName || client.payoutAccount?.bankCode
                  ? [client.payoutAccount.bankName, client.payoutAccount.bankCode]
                      .filter(Boolean)
                      .join(' · ')
                  : '—'}
              </DataRow>
              <DataRow label="Дансны дугаар" mono>
                {client.payoutAccount?.accountNumber || '—'}
              </DataRow>
              <DataRow label="Данс эзэмшигч">{client.payoutAccount?.accountName || '—'}</DataRow>
            </dl>
          </Card>

          {/* Client Web Login Account */}
          <Card>
            <CardHeader
              title="Нэвтрэх эрх (Вэб самбар)"
              description="Харилцагч системд нэвтэрч өөрийн станц, тайлангаа хянана"
              actions={
                canEdit ? (
                  <Button variant="secondary" size="sm" onClick={() => setEditingLogin(true)}>
                    <KeyRound className="h-3.5 w-3.5" />
                    {client.loginAccount ? 'Нууц үг солих' : 'Эрх үүсгэх'}
                  </Button>
                ) : null
              }
            />
            <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
              <DataRow label="Нэвтрэх имэйл">
                {client.loginAccount?.email ?? client.email ?? 'Тохируулаагүй'}
              </DataRow>
              <DataRow label="Нэвтрэх төлөв">
                {client.loginAccount ? (
                  client.loginAccount.isActive ? (
                    <Badge tone="ok">Идэвхтэй</Badge>
                  ) : (
                    <Badge tone="warn">Түр хаагдсан</Badge>
                  )
                ) : (
                  <Badge tone="idle">Эрх үүсгээгүй</Badge>
                )}
              </DataRow>
              <DataRow label="Сүүлд нэвтэрсэн">
                {client.loginAccount?.lastLoginAt ? formatDateTime(client.loginAccount.lastLoginAt) : 'Нэвтрээгүй'}
              </DataRow>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title={`Дотоод гишүүдийн карт (${memberCards.length})`}
              description="Эдгээр карт энэ харилцагчийн станцад үнэ төлбөргүй цэнэглэнэ"
              actions={
                canEdit ? (
                  <Link href="/id-tags">
                    <Button variant="secondary" size="sm">
                      <Plus className="h-3.5 w-3.5" />
                      Карт нэмэх
                    </Button>
                  </Link>
                ) : null
              }
            />
            {memberCards.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-[var(--color-fg-muted)]">
                Одоогоор дотоод гишүүний карт бүртгэгдээгүй байна. RFID карт хэсгээс
                &quot;Байгууллагын дотоод гишүүний карт&quot; сонголтоор нэмнэ үү.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {memberCards.map((t) => (
                  <li
                    key={t.idTag}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CreditCard className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {t.label || t.ownerName || t.idTag}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">
                          {t.idTag}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.status === 'Accepted' ? (
                        <Badge tone="ok">{mn(ID_TAG_STATUS, t.status)}</Badge>
                      ) : (
                        <Badge tone="idle">{mn(ID_TAG_STATUS, t.status)}</Badge>
                      )}
                      <Link
                        href={`/transactions?idTag=${encodeURIComponent(t.idTag)}`}
                        className="text-xs text-[var(--color-brand)] hover:underline"
                      >
                        Лог
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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

      {editingLogin ? (
        <ClientLoginModal
          clientId={client.id || client._id!}
          defaultEmail={client.loginAccount?.email ?? client.email ?? ''}
          isActive={client.loginAccount?.isActive ?? true}
          onClose={() => setEditingLogin(false)}
          onSaved={() => {
            setEditingLogin(false);
            void mutate();
          }}
        />
      ) : null}
    </>
  );
}

function ClientLoginModal({
  clientId,
  defaultEmail,
  isActive,
  onClose,
  onSaved,
}: {
  clientId: string;
  defaultEmail: string;
  isActive: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = React.useState(defaultEmail);
  const [password, setPassword] = React.useState('');
  const [active, setActive] = React.useState(isActive);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Имэйл хаягийг оруулна уу.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api.post(`clients/${encodeURIComponent(clientId)}/login-account`, {
        email: email.trim().toLowerCase(),
        password,
        isActive: active,
      });
      toast.success('Харилцагчийн нэвтрэх эрх амжилттай хадгалагдлаа');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Харилцагчийн нэвтрэх эрх тохируулах" size="sm">
      <form onSubmit={submit} className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <Field label="Нэвтрэх имэйл хаяг *" hint="Харилцагчийн нэвтрэх нэр">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@company.mn"
            required
            autoFocus
          />
        </Field>

        <Field
          label="Шинэ нууц үг *"
          hint="Хамгийн багадаа 6 тэмдэгт"
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
        </Field>

        <Field label="Эрхийн төлөв">
          <Select
            value={String(active)}
            onChange={(e) => setActive(e.target.value === 'true')}
          >
            <option value="true">Идэвхтэй (Нэвтрэх боломжтой)</option>
            <option value="false">Идэвхгүй (Нэвтрэлтийг хаах)</option>
          </Select>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Болих
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Хадгалах
          </Button>
        </div>
      </form>
    </Modal>
  );
}
