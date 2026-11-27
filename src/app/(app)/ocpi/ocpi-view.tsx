'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Activity,
  BatteryCharging,
  CheckCircle2,
  Globe,
  Link2,
  Play,
  Receipt,
  RefreshCw,
  RotateCw,
  Square,
  Unlink,
  Zap,
} from 'lucide-react';
import { api, apiUrl, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { StatCard, StatGrid } from '@/components/stat-card';
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

type TabKey = 'locations' | 'tariffs' | 'sessions' | 'cdrs' | 'commands';

interface OcpiStatusResponse {
  enabled: boolean;
  publicVersionsUrl: string;
  connection: {
    code: string;
    name: string;
    cpoCountryCode: string;
    cpoPartyId: string;
    emspCountryCode: string;
    emspPartyId: string;
    versionsUrl: string;
    status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED';
    lastHandshakeAt?: string;
    lastLocationSyncAt?: string;
    lastTariffSyncAt?: string;
    lastSessionSyncAt?: string;
    lastCdrSyncAt?: string;
    lastError?: string;
  };
  counts: {
    locations: number;
    tariffs: number;
    activeSessions: number;
    sessions: number;
    cdrs: number;
    commands: number;
  };
  totals: {
    energyKwh: number;
    revenueInclVat: number;
  };
}

interface OcpiLocationItem {
  id: string;
  locationId: string;
  name?: string;
  address?: string;
  city?: string;
  evses?: Array<{
    uid: string;
    evse_id?: string;
    status?: string;
    connectors?: Array<{
      id: string;
      standard?: string;
      power_type?: string;
      max_electric_power?: number;
      tariff_ids?: string[];
    }>;
  }>;
  lastUpdated?: string;
}

interface OcpiTariffItem {
  id: string;
  tariffId: string;
  currency: string;
  type: string;
  elements?: Array<{
    price_components?: Array<{ type: string; price: number; vat?: number; step_size?: number }>;
    restrictions?: { start_time?: string; end_time?: string };
  }>;
  lastUpdated?: string;
}

interface OcpiSessionItem {
  id: string;
  sessionId: string;
  locationId?: string;
  evseUid?: string;
  kwh: number;
  authMethod?: string;
  authorizationReference?: string;
  totalCost?: { excl_vat?: number; incl_vat?: number };
  status: string;
  startDateTime?: string;
  lastUpdated?: string;
}

interface OcpiCdrItem {
  id: string;
  cdrId: string;
  sessionId?: string;
  totalEnergy: number;
  totalTime: number;
  totalCost?: { excl_vat?: number; incl_vat?: number };
  chargingPeriods?: unknown[];
  startDateTime?: string;
  endDateTime?: string;
}

interface OcpiCommandItem {
  id: string;
  commandId: string;
  commandType: 'START_SESSION' | 'STOP_SESSION';
  locationId?: string;
  evseUid?: string;
  sessionId?: string;
  status: string;
  immediateResult?: string;
  asyncResult?: string;
  message?: string;
  createdAt?: string;
}

export function OcpiView({ canAdmin = false }: { canAdmin?: boolean }) {
  const [tab, setTab] = React.useState<TabKey>('locations');
  const [handshakeOpen, setHandshakeOpen] = React.useState(false);
  const [tokenA, setTokenA] = React.useState('');
  const [versionsUrl, setVersionsUrl] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);

  const [startTarget, setStartTarget] = React.useState<{ locationId: string; evseUid: string } | null>(null);
  const [startTokenUid, setStartTokenUid] = React.useState('TEST-ADMIN-01');

  const { data: statusData, mutate: mutateStatus } = useSWR<OcpiStatusResponse>(
    apiUrl('ocpi/status'),
    fetcher,
    { refreshInterval: 15_000 },
  );

  const { data: locData, mutate: mutateLocs } = useSWR<{ items: OcpiLocationItem[] }>(
    tab === 'locations' ? apiUrl('ocpi/locations') : null,
    fetcher,
  );
  const { data: tariffData, mutate: mutateTariffs } = useSWR<{ items: OcpiTariffItem[] }>(
    tab === 'tariffs' ? apiUrl('ocpi/tariffs') : null,
    fetcher,
  );
  const { data: sessionData, mutate: mutateSessions } = useSWR<{ items: OcpiSessionItem[] }>(
    tab === 'sessions' ? apiUrl('ocpi/sessions') : null,
    fetcher,
    { refreshInterval: 10_000 },
  );
  const { data: cdrData, mutate: mutateCdrs } = useSWR<{ items: OcpiCdrItem[] }>(
    tab === 'cdrs' ? apiUrl('ocpi/cdrs') : null,
    fetcher,
  );
  const { data: cmdData, mutate: mutateCmds } = useSWR<{ items: OcpiCommandItem[] }>(
    tab === 'commands' ? apiUrl('ocpi/commands') : null,
    fetcher,
    { refreshInterval: 5_000 },
  );

  const conn = statusData?.connection;
  const connected = conn?.status === 'CONNECTED';

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
    } finally {
      setBusy(null);
    }
  }

  async function handleHandshake(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenA.trim()) return;
    await runAction('handshake', async () => {
      await api.post('ocpi/handshake', {
        tokenA: tokenA.trim(),
        ...(versionsUrl.trim() ? { versionsUrl: versionsUrl.trim() } : {}),
      });
      toast.success('OCPI холболт амжилттай үүслээ');
      setHandshakeOpen(false);
      setTokenA('');
      await mutateStatus();
    });
  }

  async function handleSync(kind: 'locations' | 'tariffs' | 'sessions' | 'cdrs') {
    await runAction(`sync-${kind}`, async () => {
      const res = await api.post<{ count: number }>(`ocpi/sync/${kind}`, {});
      toast.success(`${kind}: ${res.count} бичлэг шинэчлэгдлээ`);
      await mutateStatus();
      if (kind === 'locations') await mutateLocs();
      if (kind === 'tariffs') await mutateTariffs();
      if (kind === 'sessions') await mutateSessions();
      if (kind === 'cdrs') await mutateCdrs();
    });
  }

  async function handleStartSession(e: React.FormEvent) {
    e.preventDefault();
    if (!startTarget) return;
    await runAction('start', async () => {
      await api.post('ocpi/commands/start', {
        locationId: startTarget.locationId,
        evseUid: startTarget.evseUid,
        tokenUid: startTokenUid.trim() || 'TEST-ADMIN-01',
      });
      toast.success('START_SESSION команд илгээгдлээ');
      setStartTarget(null);
      setTab('commands');
      await mutateCmds();
    });
  }

  async function handleStopSession(sessionId: string) {
    await runAction(`stop-${sessionId}`, async () => {
      await api.post('ocpi/commands/stop', { sessionId });
      toast.success('STOP_SESSION команд илгээгдлээ');
      await mutateCmds();
      await mutateSessions();
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--color-brand)]" />
              OCPI 2.2.1 Роаминг — charger.mn
            </span>
          }
          description={
            statusData
              ? `eMSP (${conn?.emspCountryCode}/${conn?.emspPartyId}) ↔ CPO (${conn?.cpoCountryCode}/${conn?.cpoPartyId}) · ${statusData.publicVersionsUrl}`
              : 'Ачааллаж байна...'
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {statusData && (
                <Badge tone={statusData.enabled ? 'ok' : 'warn'}>
                  {statusData.enabled ? 'OCPI_ENABLED=true' : 'OCPI_ENABLED=false'}
                </Badge>
              )}
              <Badge tone={connected ? 'ok' : 'idle'}>
                {conn?.status ?? 'DISCONNECTED'}
              </Badge>
              {canAdmin && (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setVersionsUrl(conn?.versionsUrl ?? '');
                      setHandshakeOpen(true);
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Token A холбох
                  </Button>
                  {connected && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction('rotate', async () => {
                            await api.post('ocpi/rotate-token', {});
                            toast.success('Token B / Token C шинэчлэгдлээ');
                            await mutateStatus();
                          })
                        }
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Token шинэчлэх
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy !== null}
                        onClick={() =>
                          runAction('disconnect', async () => {
                            await api.post('ocpi/disconnect', {});
                            toast.success('Холболт салгагдлаа');
                            await mutateStatus();
                          })
                        }
                      >
                        <Unlink className="h-3.5 w-3.5" />
                        Салгах
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          }
        />
        {conn?.lastError && (
          <CardBody className="border-t border-[var(--color-border)] bg-red-500/5 py-2.5 text-xs text-red-500">
            Сүүлийн алдаа: {conn.lastError}
          </CardBody>
        )}
      </Card>

      <StatGrid>
        <StatCard label="Станц (Locations)" value={statusData?.counts.locations ?? 0} icon={Zap} />
        <StatCard
          label="Идэвхтэй сесс"
          value={statusData?.counts.activeSessions ?? 0}
          icon={BatteryCharging}
        />
        <StatCard
          label="Нийт CDR / Эрчим хүч"
          value={`${statusData?.counts.cdrs ?? 0} / ${statusData?.totals.energyKwh ?? 0} кВт·ц`}
          icon={Receipt}
        />
        <StatCard
          label="Нийт дүн (НӨАТ-тай)"
          value={`${(statusData?.totals.revenueInclVat ?? 0).toLocaleString()} ₮`}
          icon={Activity}
        />
      </StatGrid>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['locations', 'Станцууд'],
                ['tariffs', 'Тариф'],
                ['sessions', 'Сессүүд'],
                ['cdrs', 'CDR тооцоо'],
                ['commands', 'Командын лог'],
              ] as Array<[TabKey, string]>
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={tab === k ? 'primary' : 'ghost'}
                onClick={() => setTab(k)}
              >
                {label}
              </Button>
            ))}
          </div>
          {tab !== 'commands' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={!connected || busy !== null}
              onClick={() => handleSync(tab)}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === `sync-${tab}` ? 'animate-spin' : ''}`} />
              Синк хийх
            </Button>
          )}
        </div>

        <TableWrap>
          {tab === 'locations' && (
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>Нэр / Хаяг</TH>
                  <TH>Хошуу (EVSE)</TH>
                  <TH>Статус</TH>
                  <TH>Чадал</TH>
                  <TH>Үйлдэл</TH>
                </TR>
              </THead>
              <TBody>
                {!locData ? (
                  <TableLoading colSpan={6} />
                ) : locData.items.length === 0 ? (
                  <TableEmpty colSpan={6}>Станц олдсонгүй. Эхлээд Token A-гаар холбогдоод Синк хийнэ үү.</TableEmpty>
                ) : (
                  locData.items.flatMap((loc) =>
                    (loc.evses ?? []).map((evse) => {
                      const conn0 = evse.connectors?.[0];
                      const kw = conn0?.max_electric_power ? `${(conn0.max_electric_power / 1000).toFixed(0)} кВт` : '—';
                      return (
                        <TR key={`${loc.locationId}-${evse.uid}`}>
                          <TD className="font-mono text-xs">{evse.evse_id ?? evse.uid}</TD>
                          <TD>
                            <div className="font-medium">{loc.name ?? loc.locationId}</div>
                            <div className="text-xs text-[var(--color-fg-muted)]">{loc.address}</div>
                          </TD>
                          <TD className="font-mono text-xs">{evse.uid}</TD>
                          <TD>
                            <Badge tone={evse.status === 'AVAILABLE' ? 'ok' : evse.status === 'CHARGING' ? 'info' : 'warn'}>
                              {evse.status ?? 'UNKNOWN'}
                            </Badge>
                          </TD>
                          <TD className="text-xs">
                            {kw} · {conn0?.standard ?? '—'}
                          </TD>
                          <TD>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!connected || evse.status !== 'AVAILABLE'}
                              onClick={() => setStartTarget({ locationId: loc.locationId, evseUid: evse.uid })}
                            >
                              <Play className="h-3 w-3" /> Эхлүүлэх
                            </Button>
                          </TD>
                        </TR>
                      );
                    }),
                  )
                )}
              </TBody>
            </Table>
          )}

          {tab === 'tariffs' && (
            <Table>
              <THead>
                <TR>
                  <TH>Тариф ID</TH>
                  <TH>Төрөл / Валют</TH>
                  <TH>Цагийн муж ба Үнэ (НӨАТ-гүй → НӨАТ-тай)</TH>
                  <TH>Шинэчилсэн</TH>
                </TR>
              </THead>
              <TBody>
                {!tariffData ? (
                  <TableLoading colSpan={4} />
                ) : tariffData.items.length === 0 ? (
                  <TableEmpty colSpan={4}>Тариф олдсонгүй.</TableEmpty>
                ) : (
                  tariffData.items.map((t) => (
                    <TR key={t.tariffId}>
                      <TD className="font-mono text-xs">{t.tariffId}</TD>
                      <TD>{t.type} · {t.currency}</TD>
                      <TD className="space-y-1 text-xs">
                        {(t.elements ?? []).map((el, i) => {
                          const pc = el.price_components?.[0];
                          const incl = pc ? Math.round(pc.price * (1 + (pc.vat ?? 0) / 100)) : 0;
                          return (
                            <div key={i}>
                              {el.restrictions?.start_time ?? '00:00'}–{el.restrictions?.end_time ?? '24:00'}:{' '}
                              <span className="font-mono">{pc?.price ?? 0} ₮</span> →{' '}
                              <span className="font-semibold">{incl} ₮/кВт·ц</span>
                            </div>
                          );
                        })}
                      </TD>
                      <TD className="text-xs">{t.lastUpdated ? formatDateTime(t.lastUpdated) : '—'}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          )}

          {tab === 'sessions' && (
            <Table>
              <THead>
                <TR>
                  <TH>Session ID</TH>
                  <TH>Байршил / EVSE</TH>
                  <TH>Эрчим хүч</TH>
                  <TH>Нийт дүн</TH>
                  <TH>Төлөв</TH>
                  <TH>Үйлдэл</TH>
                </TR>
              </THead>
              <TBody>
                {!sessionData ? (
                  <TableLoading colSpan={6} />
                ) : sessionData.items.length === 0 ? (
                  <TableEmpty colSpan={6}>Сесс олдсонгүй.</TableEmpty>
                ) : (
                  sessionData.items.map((s) => (
                    <TR key={s.sessionId}>
                      <TD className="font-mono text-xs">{s.sessionId}</TD>
                      <TD className="text-xs">{s.evseUid ?? s.locationId ?? '—'}</TD>
                      <TD className="font-mono text-xs">{s.kwh.toFixed(2)} кВт·ц</TD>
                      <TD className="text-xs">{Math.round(s.totalCost?.incl_vat ?? 0).toLocaleString()} ₮</TD>
                      <TD>
                        <Badge tone={s.status === 'ACTIVE' ? 'info' : s.status === 'COMPLETED' ? 'ok' : 'warn'}>
                          {s.status}
                        </Badge>
                      </TD>
                      <TD>
                        {s.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy !== null}
                            onClick={() => handleStopSession(s.sessionId)}
                          >
                            <Square className="h-3 w-3" /> Зогсоох
                          </Button>
                        )}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          )}

          {tab === 'cdrs' && (
            <Table>
              <THead>
                <TR>
                  <TH>CDR ID</TH>
                  <TH>Эхэлсэн</TH>
                  <TH>Эрчим хүч</TH>
                  <TH>Хугацаа (цаг)</TH>
                  <TH>НӨАТ-тай дүн</TH>
                </TR>
              </THead>
              <TBody>
                {!cdrData ? (
                  <TableLoading colSpan={5} />
                ) : cdrData.items.length === 0 ? (
                  <TableEmpty colSpan={5}>CDR олдсонгүй.</TableEmpty>
                ) : (
                  cdrData.items.map((c) => (
                    <TR key={c.cdrId}>
                      <TD className="font-mono text-xs">{c.cdrId}</TD>
                      <TD className="text-xs">{c.startDateTime ? formatDateTime(c.startDateTime) : '—'}</TD>
                      <TD className="font-mono text-xs">{c.totalEnergy.toFixed(2)} кВт·ц</TD>
                      <TD className="font-mono text-xs">{c.totalTime.toFixed(2)}</TD>
                      <TD className="font-semibold text-xs">
                        {Math.round(c.totalCost?.incl_vat ?? 0).toLocaleString()} ₮
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          )}

          {tab === 'commands' && (
            <Table>
              <THead>
                <TR>
                  <TH>Төрөл</TH>
                  <TH>Байршил / Сесс</TH>
                  <TH>Шууд хариу</TH>
                  <TH>Эцсийн үр дүн</TH>
                  <TH>Огноо</TH>
                </TR>
              </THead>
              <TBody>
                {!cmdData ? (
                  <TableLoading colSpan={5} />
                ) : cmdData.items.length === 0 ? (
                  <TableEmpty colSpan={5}>Командын түүх алга.</TableEmpty>
                ) : (
                  cmdData.items.map((c) => (
                    <TR key={c.commandId}>
                      <TD className="font-mono text-xs">{c.commandType}</TD>
                      <TD className="text-xs">{c.evseUid ?? c.locationId ?? c.sessionId ?? '—'}</TD>
                      <TD className="text-xs">{c.immediateResult ?? '—'}</TD>
                      <TD>
                        <Badge tone={c.status === 'ACCEPTED' ? 'ok' : c.status === 'PENDING' ? 'info' : 'danger'}>
                          {c.asyncResult ?? c.status}
                        </Badge>
                      </TD>
                      <TD className="text-xs">{c.createdAt ? formatDateTime(c.createdAt) : '—'}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          )}
        </TableWrap>
      </Card>

      <Modal open={handshakeOpen} onClose={() => setHandshakeOpen(false)} title="charger.mn — Token A холболт">
        <form onSubmit={handleHandshake} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Token A (нэг удаагийн)</label>
            <Input
              required
              value={tokenA}
              onChange={(e) => setTokenA(e.target.value)}
              placeholder="charger.mn-ээс өгсөн Token A"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">CPO Versions URL (заавал биш)</label>
            <Input
              value={versionsUrl}
              onChange={(e) => setVersionsUrl(e.target.value)}
              placeholder="https://ev.charger.mn/ocpi/versions"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setHandshakeOpen(false)}>
              Болих
            </Button>
            <Button type="submit" variant="primary" disabled={busy === 'handshake'}>
              <CheckCircle2 className="h-4 w-4" /> Холбох
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!startTarget} onClose={() => setStartTarget(null)} title="Туршилтын цэнэглэлт эхлүүлэх">
        <form onSubmit={handleStartSession} className="space-y-4">
          <div className="text-xs text-[var(--color-fg-muted)]">
            Байршил: <span className="font-mono">{startTarget?.locationId}</span> · Хошуу:{' '}
            <span className="font-mono">{startTarget?.evseUid}</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Хэрэглэгчийн Token UID</label>
            <Input
              required
              value={startTokenUid}
              onChange={(e) => setStartTokenUid(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setStartTarget(null)}>
              Болих
            </Button>
            <Button type="submit" variant="primary" disabled={busy === 'start'}>
              <Play className="h-4 w-4" /> START_SESSION илгээх
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
