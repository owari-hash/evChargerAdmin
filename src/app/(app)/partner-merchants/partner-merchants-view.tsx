'use client';

import * as React from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Activity,
  Building2,
  CheckCircle2,
  Code,
  Eye,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api, apiUrl, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import type {
  PartnerMerchant,
  PartnerApiLogItem,
  PartnerMerchantStats,
  PartnerMerchantListResponse,
  PartnerApiLogListResponse,
} from '@/lib/types';
import { Badge, Button, Card, Input, Select } from '@/components/ui/primitives';
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
import { PartnerMerchantModal } from './partner-merchant-modal';
import { ResetPasswordModal } from './reset-password-modal';

type TabKey = 'merchants' | 'logs' | 'docs';

export function PartnerMerchantsView({
  canEdit = true,
  canDelete = false,
}: {
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [activeTab, setActiveTab] = React.useState<TabKey>('merchants');

  // Merchants state
  const [merchantPage, setMerchantPage] = React.useState(1);
  const [merchantSearch, setMerchantSearch] = React.useState('');
  const [merchantStatus, setMerchantStatus] = React.useState<'all' | 'active' | 'inactive'>('all');

  // Logs state
  const [logPage, setLogPage] = React.useState(1);
  const [logMerchantId, setLogMerchantId] = React.useState<string>('all');
  const [logStatus, setLogStatus] = React.useState<'all' | 'success' | 'error'>('all');
  const [logSearch, setLogSearch] = React.useState('');

  // Modals state
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [selectedMerchant, setSelectedMerchant] = React.useState<PartnerMerchant | null>(null);
  const [resetModalOpen, setResetModalOpen] = React.useState(false);
  const [inspectLog, setInspectLog] = React.useState<PartnerApiLogItem | null>(null);

  // SWR Data queries
  const { data: stats, mutate: mutateStats } = useSWR<PartnerMerchantStats>(
    apiUrl('partner-merchants/stats'),
    fetcher,
    { refreshInterval: 15000 },
  );

  const {
    data: merchantsData,
    isLoading: merchantsLoading,
    mutate: mutateMerchants,
  } = useSWR<PartnerMerchantListResponse>(
    apiUrl('partner-merchants', {
      page: merchantPage,
      limit: 25,
      search: merchantSearch || undefined,
      status: merchantStatus,
    }),
    fetcher,
    { refreshInterval: 20000 },
  );

  const {
    data: logsData,
    isLoading: logsLoading,
    mutate: mutateLogs,
  } = useSWR<PartnerApiLogListResponse>(
    activeTab === 'logs'
      ? apiUrl('partner-merchants/logs/all', {
          page: logPage,
          limit: 30,
          merchantId: logMerchantId !== 'all' ? logMerchantId : undefined,
          status: logStatus !== 'all' ? logStatus : undefined,
          search: logSearch || undefined,
        })
      : null,
    fetcher,
    { refreshInterval: 10000 },
  );

  const merchants = merchantsData?.items || [];
  const logs = logsData?.items || [];

  // Actions
  async function handleToggleStatus(m: PartnerMerchant) {
    if (!canEdit) return;
    const nextStatus = !m.isActive;
    try {
      await api.patch(`/partner-merchants/${m.id}/status`, { isActive: nextStatus });
      toast.success(
        nextStatus
          ? `"${m.name}" мерчант идэвхжлээ`
          : `"${m.name}" мерчантын API хандалт хаагдлаа`,
      );
      mutateMerchants();
      mutateStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Төлөв өөрчлөхөд алдаа гарлаа');
    }
  }

  async function handleRevokeTokens(m: PartnerMerchant) {
    if (!confirm(`"${m.name}" мерчантын одоогийн бүх идэвхтэй нэвтрэлтийн токенуудыг цуцлах уу?`)) return;
    try {
      await api.post(`/partner-merchants/${m.id}/revoke-tokens`);
      toast.success(`"${m.name}" мерчантын бүх токен хүчингүй боллоо`);
      mutateMerchants();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
    }
  }

  async function handleDeleteMerchant(m: PartnerMerchant) {
    if (!confirm(`"${m.name}" мерчантыг системээс бүрмөсөн устгах уу?`)) return;
    try {
      await api.del(`/partner-merchants/${m.id}`);
      toast.success(`"${m.name}" мерчант устгагдлаа`);
      mutateMerchants();
      mutateStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Устгахад алдаа гарлаа');
    }
  }

  function handleFilterLogsForMerchant(m: PartnerMerchant) {
    setLogMerchantId(m.id);
    setActiveTab('logs');
  }

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-fg)] flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-emerald-500" />
            Мерчант удирдлага (API Хандалт)
          </h1>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
            Хамтрагч байгууллагуудад зориулсан нэвтрэх нэр, нууц үг олгох, API хандалтын хяналт ба токен удирдлага
          </p>
        </div>

        {canEdit && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedMerchant(null);
              setEditModalOpen(true);
            }}
            className="gap-1.5 self-start sm:self-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <Plus className="h-4 w-4" />
            Шинэ мерчант бүртгэх
          </Button>
        )}
      </div>

      {/* 2. Top Stats Overview */}
      <StatGrid>
        <StatCard
          label="Нийт хамтрагч мерчант"
          value={stats?.totalMerchants ?? 0}
          icon={Users}
          tone="info"
          sub="Бүртгэлтэй байгууллага"
        />
        <StatCard
          label="Идэвхтэй эрхтэй"
          value={stats?.activeMerchants ?? 0}
          icon={ShieldCheck}
          tone="ok"
          sub={
            stats?.inactiveMerchants ? `${stats.inactiveMerchants} мерчант хаагдсан` : 'Бүх мерчант идэвхтэй'
          }
        />
        <StatCard
          label="Өнөөдрийн API дуудалт"
          value={stats?.todayApiCalls ?? 0}
          icon={Activity}
          tone="warn"
          sub="Нийт хүсэлт"
        />
        <StatCard
          label="Амжилттай хариулт"
          value={`${stats?.successRate ?? 100}%`}
          icon={CheckCircle2}
          tone="ok"
          sub="2xx амжилттай дуудалт"
        />
      </StatGrid>

      {/* 3. Main Card with Tabs */}
      <Card>
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--color-border)] px-3 sm:px-4 bg-[var(--color-surface)]/60 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('merchants')}
            className={`py-2.5 px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'merchants'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Мерчант жагсаалт ({stats?.totalMerchants ?? merchants.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`py-2.5 px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Activity className="h-4 w-4" />
            API Дуудалтын хяналт / Лог
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`py-2.5 px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'docs'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Code className="h-4 w-4" />
            API Зааварчилгаа & Токен
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: MERCHANTS LIST                                                     */}
        {/* ========================================================================= */}
        {activeTab === 'merchants' && (
          <div>
            {/* Filter bar */}
            <div className="p-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[16rem]">
                <div className="relative flex-1 min-w-[13rem] max-w-sm">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
                  <Input
                    value={merchantSearch}
                    onChange={(e) => {
                      setMerchantSearch(e.target.value);
                      setMerchantPage(1);
                    }}
                    placeholder="Мерчантын нэр, код, нэвтрэх нэрээр хайх..."
                    className="h-8 pl-8 pr-7 text-xs w-full"
                  />
                  {merchantSearch && (
                    <button
                      type="button"
                      onClick={() => setMerchantSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Select
                  value={merchantStatus}
                  onChange={(e) => {
                    setMerchantStatus(e.target.value as any);
                    setMerchantPage(1);
                  }}
                  className="h-8 w-36 text-xs"
                >
                  <option value="all">Бүх төлөв</option>
                  <option value="active">Идэвхтэй</option>
                  <option value="inactive">Хаагдсан</option>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => mutateMerchants()}
                  title="Шинэчлэх"
                  className="h-8 px-2 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Table */}
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH className="w-10 text-center">№</TH>
                    <TH>Мерчант нэр & Код</TH>
                    <TH>Нэвтрэх нэр</TH>
                    <TH>Харилцагч</TH>
                    <TH>Хандах эрхүүд (Scopes)</TH>
                    <TH className="text-center">Станцууд</TH>
                    <TH className="text-right">Дуудалт (Өнөөдөр / Нийт)</TH>
                    <TH>Сүүлд хандсан</TH>
                    <TH className="text-center">Төлөв</TH>
                    <TH className="text-right">Үйлдэл</TH>
                  </TR>
                </THead>
                <TBody>
                  {merchantsLoading && !merchantsData ? (
                    <TableLoading colSpan={10} />
                  ) : merchants.length === 0 ? (
                    <TableEmpty colSpan={10}>
                      {merchantSearch ? 'Хайлтад тохирох мерчант олдсонгүй.' : 'Одоогоор мерчант бүртгэгдээгүй байна.'}
                    </TableEmpty>
                  ) : (
                    merchants.map((m: PartnerMerchant, idx: number) => (
                      <TR key={m.id}>
                        <TD className="text-center text-xs text-[var(--color-fg-muted)]">
                          {(merchantPage - 1) * 25 + idx + 1}
                        </TD>

                        <TD>
                          <div className="font-semibold text-xs text-[var(--color-fg)]">{m.name}</div>
                          <div className="text-[11px] font-mono text-[var(--color-fg-subtle)]">{m.code}</div>
                        </TD>

                        <TD>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-fg)]">
                            {m.username}
                          </span>
                        </TD>

                        <TD className="text-xs text-[var(--color-fg-muted)]">
                          {m.client ? (
                            <span className="text-[var(--color-fg)] font-medium">{m.client.name}</span>
                          ) : (
                            <span className="text-[var(--color-fg-subtle)] italic">—</span>
                          )}
                        </TD>

                        <TD>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {m.allowedScopes.slice(0, 3).map((s: string) => (
                              <span
                                key={s}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              >
                                {s.replace(':read', '').replace(':control', '')}
                              </span>
                            ))}
                            {m.allowedScopes.length > 3 && (
                              <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                                +{m.allowedScopes.length - 3}
                              </span>
                            )}
                          </div>
                        </TD>

                        <TD className="text-center text-xs">
                          {!m.allowedStations || m.allowedStations.length === 0 ? (
                            <Badge tone="ok">Бүх станц</Badge>
                          ) : (
                            <Badge tone="warn">{m.allowedStations.length} станц</Badge>
                          )}
                        </TD>

                        <TD className="text-right text-xs">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {m.todayApiCalls ?? 0}
                          </span>
                          <span className="text-[var(--color-fg-muted)]"> / {m.totalApiCalls ?? 0}</span>
                        </TD>

                        <TD className="text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
                          {m.lastActiveAt ? formatDateTime(m.lastActiveAt) : 'Хандаагүй'}
                        </TD>

                        <TD className="text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(m)}
                            disabled={!canEdit}
                            title={m.isActive ? 'Хаах бол дарна уу' : 'Идэвхжүүлэх бол дарна уу'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                              m.isActive
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${m.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            />
                            {m.isActive ? 'Идэвхтэй' : 'Хаагдсан'}
                          </button>
                        </TD>

                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFilterLogsForMerchant(m)}
                              title="API Лог харах"
                              className="h-7 px-2 text-xs text-[var(--color-fg-muted)] hover:text-emerald-600"
                            >
                              <Activity className="h-3.5 w-3.5" />
                            </Button>

                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedMerchant(m);
                                  setResetModalOpen(true);
                                }}
                                title="Нууц үг солих"
                                className="h-7 px-2 text-xs text-[var(--color-fg-muted)] hover:text-amber-600"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeTokens(m)}
                                title="Бүх токеныг хүчингүй болгох"
                                className="h-7 px-2 text-xs text-[var(--color-fg-muted)] hover:text-rose-600"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {canEdit && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedMerchant(m);
                                  setEditModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs font-medium"
                              >
                                Засах
                              </Button>
                            )}

                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMerchant(m)}
                                title="Устгах"
                                className="h-7 px-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </TableWrap>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: API REQUEST LOGS & MONITORING                                      */}
        {/* ========================================================================= */}
        {activeTab === 'logs' && (
          <div>
            {/* Filter toolbar */}
            <div className="p-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[16rem]">
                <Select
                  value={logMerchantId}
                  onChange={(e) => {
                    setLogMerchantId(e.target.value);
                    setLogPage(1);
                  }}
                  className="h-8 w-48 text-xs"
                >
                  <option value="all">Бүх мерчант</option>
                  {merchants.map((m: PartnerMerchant) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.username})
                    </option>
                  ))}
                </Select>

                <Select
                  value={logStatus}
                  onChange={(e) => {
                    setLogStatus(e.target.value as any);
                    setLogPage(1);
                  }}
                  className="h-8 w-36 text-xs"
                >
                  <option value="all">Бүх хариу</option>
                  <option value="success">Зөвхөн амжилттай (2xx)</option>
                  <option value="error">Зөвхөн алдаатай (4xx, 5xx)</option>
                </Select>

                <div className="relative flex-1 min-w-[12rem] max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
                  <Input
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPage(1);
                    }}
                    placeholder="Endpoint, IP-аар хайх..."
                    className="h-8 pl-8 pr-7 text-xs w-full"
                  />
                  {logSearch && (
                    <button
                      type="button"
                      onClick={() => setLogSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => mutateLogs()}
                  title="Шинэчлэх"
                  className="h-8 px-2 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Logs Table */}
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH className="w-10 text-center">№</TH>
                    <TH>Огноо, цаг</TH>
                    <TH>Мерчант</TH>
                    <TH>Хүсэлт (Method & Endpoint)</TH>
                    <TH className="text-center">Хариу код</TH>
                    <TH className="text-right">Хугацаа (ms)</TH>
                    <TH>IP хаяг</TH>
                    <TH>Алдаа / Мэдээлэл</TH>
                    <TH className="text-center">Дэлгэрэнгүй</TH>
                  </TR>
                </THead>
                <TBody>
                  {logsLoading && !logsData ? (
                    <TableLoading colSpan={9} />
                  ) : logs.length === 0 ? (
                    <TableEmpty colSpan={9}>Одоогоор API дуудалтын лог бүртгэгдээгүй байна.</TableEmpty>
                  ) : (
                    logs.map((log: PartnerApiLogItem, idx: number) => {
                      const isOk = log.statusCode < 400;
                      return (
                        <TR key={log.id}>
                          <TD className="text-center text-xs text-[var(--color-fg-muted)]">
                            {(logPage - 1) * 30 + idx + 1}
                          </TD>

                          <TD className="text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </TD>

                          <TD>
                            <div className="font-semibold text-xs text-[var(--color-fg)]">{log.merchantName}</div>
                            <div className="text-[11px] font-mono text-[var(--color-fg-subtle)]">
                              @{log.merchantUsername}
                            </div>
                          </TD>

                          <TD>
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  log.method === 'GET'
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                    : log.method === 'POST'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-amber-500/15 text-amber-600'
                                }`}
                              >
                                {log.method}
                              </span>
                              <span className="text-[var(--color-fg)] truncate max-w-xs">{log.endpoint}</span>
                            </div>
                          </TD>

                          <TD className="text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                                isOk
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : log.statusCode >= 500
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {log.statusCode}
                            </span>
                          </TD>

                          <TD className="text-right text-xs font-mono text-[var(--color-fg-muted)]">
                            {log.durationMs}ms
                          </TD>

                          <TD className="text-xs font-mono text-[var(--color-fg-muted)]">{log.ip || '—'}</TD>

                          <TD className="text-xs max-w-xs truncate text-[var(--color-fg-subtle)]">
                            {log.errorMessage ? (
                              <span className="text-rose-500 font-medium">{log.errorMessage}</span>
                            ) : (
                              '—'
                            )}
                          </TD>

                          <TD className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectLog(log)}
                              className="h-7 px-2 text-xs text-[var(--color-fg-muted)] hover:text-emerald-600"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Харах
                            </Button>
                          </TD>
                        </TR>
                      );
                    })
                  )}
                </TBody>
              </Table>
            </TableWrap>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: INTEGRATION GUIDE & API CHEAT SHEET                                 */}
        {/* ========================================================================= */}
        {activeTab === 'docs' && (
          <div className="p-4 sm:p-6 space-y-6 max-w-4xl text-xs">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-fg)]">
                Хамтрагч мерчантад өгөх зааварчилгаа (API Documentation)
              </h3>
              <p className="text-[var(--color-fg-muted)] mt-1">
                Хамтрагч системүүд (Partner users) дараах 2 алхмаар нэвтэрч, цэнэглэх станцын API-уудыг дуудна.
              </p>
            </div>

            {/* Step 1 */}
            <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-2)]/30">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  1
                </span>
                <span className="font-semibold text-xs text-[var(--color-fg)]">
                  Хэрэглэгчийн нэр, нууц үгээр токен авах (Login)
                </span>
              </div>
              <p className="text-[var(--color-fg-muted)] pl-7">
                Эхлээд системд бүртгэгдсэн username, password-оор хандаж <code className="font-mono">accessToken</code>{' '}
                болон <code className="font-mono">refreshToken</code> авна.
              </p>

              <div className="pl-7 pt-1">
                <pre className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[11px] overflow-x-auto text-[var(--color-fg)]">
                  {`curl -X POST https://eplug.mn/api/partner/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "your_merchant_username",
    "password": "your_password"
  }'`}
                </pre>
                <div className="mt-2 text-[11px] text-[var(--color-fg-subtle)]">
                  Хариу:
                </div>
                <pre className="p-3 mt-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[11px] overflow-x-auto text-emerald-600 dark:text-emerald-400">
                  {`{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "7c9e...",
  "tokenType": "Bearer",
  "expiresIn": 7200,
  "merchant": {
    "id": "...",
    "name": "Токи ХХК",
    "scopes": ["stations:read", "sessions:control"]
  }
}`}
                </pre>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-2)]/30">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  2
                </span>
                <span className="font-semibold text-xs text-[var(--color-fg)]">
                  Токеноороо API дуудах (Call API with Bearer Token)
                </span>
              </div>
              <p className="text-[var(--color-fg-muted)] pl-7">
                Авсан <code className="font-mono">accessToken</code>-оо бүх хүсэлтийн{' '}
                <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> толгой (header) хэсэгт дамжуулна.
              </p>

              <div className="pl-7 pt-1">
                <pre className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[11px] overflow-x-auto text-[var(--color-fg)]">
                  {`curl https://eplug.mn/api/partner/stations \\
  -H "Authorization: Bearer eyJhbGciOi..."`}
                </pre>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-2)]/30">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  3
                </span>
                <span className="font-semibold text-xs text-[var(--color-fg)]">
                  Хугацаа дуусах үед Токен сэргээх (Refresh Token)
                </span>
              </div>
              <p className="text-[var(--color-fg-muted)] pl-7">
                AccessToken хугацаа дуусахад хэрэглэгчийн нэр, нууц үг дахин оруулах шаардлагагүйгээр{' '}
                <code className="font-mono">refreshToken</code>-ээрээ автоматаар шинэ токен авна.
              </p>

              <div className="pl-7 pt-1">
                <pre className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[11px] overflow-x-auto text-[var(--color-fg)]">
                  {`curl -X POST https://eplug.mn/api/partner/auth/refresh \\
  -H "Content-Type: application/json" \\
  -d '{ "refreshToken": "7c9e..." }'`}
                </pre>
              </div>
            </div>

            {/* Available API endpoints list */}
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-xs text-[var(--color-fg)] uppercase tracking-wider">
                Ашиглах боломжтой мерчант API endpoint-ууд
              </h4>

              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between p-2 rounded bg-[var(--color-surface-2)]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 font-bold text-[10px]">
                      GET
                    </span>
                    <span>/api/partner/stations</span>
                  </div>
                  <span className="text-[var(--color-fg-muted)] font-sans text-xs">Станцуудын жагсаалт, төлөв</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[var(--color-surface-2)]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 font-bold text-[10px]">
                      GET
                    </span>
                    <span>/api/partner/stations/:cpId</span>
                  </div>
                  <span className="text-[var(--color-fg-muted)] font-sans text-xs">Нэг станцын дэлгэрэнгүй</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[var(--color-surface-2)]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 font-bold text-[10px]">
                      POST
                    </span>
                    <span>/api/partner/sessions/start</span>
                  </div>
                  <span className="text-[var(--color-fg-muted)] font-sans text-xs">
                    Алсаас цэнэглэлт эхлүүлэх (cpId, connectorId)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[var(--color-surface-2)]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 font-bold text-[10px]">
                      POST
                    </span>
                    <span>/api/partner/sessions/stop</span>
                  </div>
                  <span className="text-[var(--color-fg-muted)] font-sans text-xs">
                    Цэнэглэлт зогсоох (transactionId)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[var(--color-surface-2)]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 font-bold text-[10px]">
                      GET
                    </span>
                    <span>/api/partner/sessions/active</span>
                  </div>
                  <span className="text-[var(--color-fg-muted)] font-sans text-xs">Явагдаж буй цэнэглэлтүүд</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-[var(--color-surface-2)]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 font-bold text-[10px]">
                      GET
                    </span>
                    <span>/api/partner/sessions/:id</span>
                  </div>
                  <span className="text-[var(--color-fg-muted)] font-sans text-xs">
                    Сессийн кВтц, хугацаа, дүнгийн мэдээлэл
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Inspect Log Modal */}
      {inspectLog && (
        <Modal
          open={!!inspectLog}
          onClose={() => setInspectLog(null)}
          title="API Хүсэлтийн дэлгэрэнгүй лог"
          size="md"
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-[var(--color-surface-2)]">
              <div>
                <span className="text-[var(--color-fg-muted)]">Мерчант:</span>{' '}
                <span className="font-semibold text-[var(--color-fg)]">{inspectLog.merchantName}</span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)]">Нэвтрэх нэр:</span>{' '}
                <span className="font-mono text-[var(--color-fg)]">{inspectLog.merchantUsername}</span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)]">Огноо:</span>{' '}
                <span>{formatDateTime(inspectLog.createdAt)}</span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)]">IP:</span>{' '}
                <span className="font-mono">{inspectLog.ip || '—'}</span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)]">Хариу код:</span>{' '}
                <span className="font-mono font-bold">{inspectLog.statusCode}</span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)]">Хугацаа:</span>{' '}
                <span className="font-mono">{inspectLog.durationMs}ms</span>
              </div>
            </div>

            <div>
              <span className="font-semibold text-[var(--color-fg)]">Endpoint:</span>
              <pre className="mt-1 p-2 rounded bg-[var(--color-surface-2)] font-mono text-[11px] overflow-x-auto">
                {inspectLog.method} {inspectLog.endpoint}
              </pre>
            </div>

            {inspectLog.requestQuery && (
              <div>
                <span className="font-semibold text-[var(--color-fg)]">Query params:</span>
                <pre className="mt-1 p-2 rounded bg-[var(--color-surface-2)] font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(inspectLog.requestQuery, null, 2)}
                </pre>
              </div>
            )}

            {inspectLog.requestBody && (
              <div>
                <span className="font-semibold text-[var(--color-fg)]">Request body:</span>
                <pre className="mt-1 p-2 rounded bg-[var(--color-surface-2)] font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(inspectLog.requestBody, null, 2)}
                </pre>
              </div>
            )}

            {inspectLog.errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
                <span className="font-semibold">Алдааны мэдээлэл:</span>
                <div className="mt-1 font-mono">{inspectLog.errorMessage}</div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
              <Button variant="secondary" size="sm" onClick={() => setInspectLog(null)}>
                Хаах
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit/Create Modal */}
      <PartnerMerchantModal
        merchant={selectedMerchant}
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedMerchant(null);
        }}
        onSaved={() => {
          mutateMerchants();
          mutateStats();
        }}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        merchant={selectedMerchant}
        open={resetModalOpen}
        onClose={() => {
          setResetModalOpen(false);
          setSelectedMerchant(null);
        }}
      />
    </div>
  );
}
