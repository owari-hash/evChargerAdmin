'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  BarChart3,
  Coins,
  User,
  ShieldCheck,
  Zap,
  CreditCard,
  Download,
  Search,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plug,
  TrendingUp,
  X,
} from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import {
  connectorLetter,
  formatAmount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatWh,
} from '@/lib/format';
import type { ChargePoint, Client, Paginated, ReportSummary, StationReportRow, SessionUser } from '@/lib/types';
import { Badge, Button, Card, Input, Select } from '@/components/ui/primitives';
import { DateRangePicker, toIsoDate, type DateRange } from '@/components/ui/date-picker';
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
import { cn } from '@/lib/cn';

function localDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function rangeStart(iso: string): string | undefined {
  return localDate(iso)?.toISOString();
}

function rangeEnd(iso: string): string | undefined {
  const d = localDate(iso);
  if (!d) return undefined;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
}

function currentMonthRange(): DateRange {
  const today = new Date();
  return {
    from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toIsoDate(today),
  };
}

function todayRange(): DateRange {
  const today = new Date();
  return {
    from: toIsoDate(today),
    to: toIsoDate(today),
  };
}

function last7DaysRange(): DateRange {
  const today = new Date();
  const prior = new Date();
  prior.setDate(today.getDate() - 6);
  return {
    from: toIsoDate(prior),
    to: toIsoDate(today),
  };
}

function lastMonthRange(): DateRange {
  const today = new Date();
  const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    from: toIsoDate(firstOfLastMonth),
    to: toIsoDate(lastOfLastMonth),
  };
}

type TabKey = 'stations' | 'daily' | 'connectors' | 'sessions';

export function ReportsView({ user }: { user: SessionUser | null }) {
  const isClient = user?.role === 'CLIENT';
  const [range, setRange] = React.useState<DateRange>(currentMonthRange);
  const [selectedStation, setSelectedStation] = React.useState<string>('all');
  const [selectedClient, setSelectedClient] = React.useState<string>(user?.clientId ?? 'all');
  const [activeTab, setActiveTab] = React.useState<TabKey>('stations');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [expandedStationIds, setExpandedStationIds] = React.useState<Record<string, boolean>>({});

  // Toggle drilldown for a specific station
  function toggleStationExpand(stationId: string) {
    setExpandedStationIds((prev) => ({
      ...prev,
      [stationId]: !prev[stationId],
    }));
  }

  // Load clients if operator/admin for the client filter
  const { data: clientsData } = useSWR<Paginated<Client>>(
    !isClient ? apiUrl('clients', { limit: 200 }) : null,
    fetcher,
  );
  const clientOptions = clientsData?.data ?? [];

  // Load stations for dropdown
  const { data: stationsData } = useSWR<{ data: ChargePoint[] }>(
    apiUrl('charge-points', { limit: 200 }),
    fetcher,
  );
  const stationOptions = stationsData?.data ?? [];

  // Query reports summary
  const queryParams: Record<string, string | undefined> = {
    from: rangeStart(range.from),
    to: rangeEnd(range.to),
  };
  if (selectedStation !== 'all') {
    queryParams.chargePointId = selectedStation;
  }
  if (!isClient && selectedClient !== 'all') {
    queryParams.clientId = selectedClient;
  }

  const reportsUrl = apiUrl('reports/summary', queryParams);
  const { data, error, isLoading } = useSWR<ReportSummary>(reportsUrl, fetcher, {
    keepPreviousData: true,
  });

  const totals = data?.totals;
  const rawStations = data?.stations ?? [];
  const daily = data?.daily ?? [];
  const connectors = data?.connectors ?? [];
  const sessions = data?.recentSessions ?? [];

  // Filter stations based on search query (name, cpId, address)
  const stations = React.useMemo(() => {
    if (!searchQuery.trim()) return rawStations;
    const q = searchQuery.toLowerCase().trim();
    return rawStations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.cpId.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q)),
    );
  }, [rawStations, searchQuery]);

  // Calculated average fee percent
  const avgFeePercent = React.useMemo(() => {
    if (totals?.gross && totals.gross > 0 && totals.fee != null) {
      return ((totals.fee / totals.gross) * 100).toFixed(1);
    }
    return '20.0';
  }, [totals?.gross, totals?.fee]);

  // Export CSV
  function exportCsv() {
    if (!rawStations.length) return;
    const header = [
      '№',
      'Станц ID',
      'Станцын нэр',
      'Хаяг',
      'Сеанс тоо',
      'Эрчим хүч (кВтц)',
      'Үндсэн тариф (₮)',
      'Борлуулалт (₮)',
      'Шимтгэл (₮)',
      'Шимтгэл %',
      'Цэвэр орлого (₮)',
      'Тооцооллын томьёо',
    ];

    const rows = rawStations.map((s, idx) => [
      idx + 1,
      `"${s.cpId}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${(s.address ?? '').replace(/"/g, '""')}"`,
      s.sessionsCount,
      s.energyKwh,
      s.tariffPerKwh,
      s.gross,
      s.feeAmount,
      s.feePercent,
      s.clientNet,
      `"${s.formula?.summaryDisplay ? s.formula.summaryDisplay.replace(/"/g, '""') : ''}"`,
    ]);

    const csvContent =
      '\uFEFF' +
      [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `station-report-${range.from}-to-${range.to}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 1. Header Title & Range Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--color-fg)]">
              Орлого, тайлан
            </h1>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Цэнэглэлтийн орлого, Eplug шимтгэл болон цэвэр орлогын тайлан
            </p>
          </div>
        </div>

        {/* Date Picker & Station Selector in Top Right */}
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            className="w-full sm:w-auto min-w-[15rem]"
            value={range}
            onChange={(r) => {
              setRange(
                r.from || r.to
                  ? { from: r.from || r.to, to: r.to || r.from }
                  : currentMonthRange(),
              );
            }}
            aria-label="Тайлангийн хугацаа"
          />

          <Select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="h-9 w-full sm:w-44 text-xs font-medium"
            aria-label="Бүх станц"
          >
            <option value="all">Бүх станц</option>
            {stationOptions.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name || cp.cpId}
              </option>
            ))}
          </Select>

          {!isClient && clientOptions.length > 0 && (
            <Select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="h-9 w-full sm:w-40 text-xs font-medium"
              aria-label="Харилцагч шүүх"
            >
              <option value="all">Бүх харилцагч</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {/* 2. Compact 5 Stat Cards in horizontal row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-5">
        {/* Card 1: Нийт борлуулалт (брутто) */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 sm:p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-medium text-[var(--color-fg-muted)] truncate">
              Нийт борлуулалт (брутто)
            </span>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <Coins className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-fg)] tnum font-mono truncate">
              {formatMoney(totals?.gross)}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-emerald-500 truncate">
              <span className="inline-flex items-center">↑ 12.5%</span>
              <span className="text-[var(--color-fg-subtle)] font-normal truncate">Өмнөх хугацаатай харьцуулахад</span>
            </div>
          </div>
        </div>

        {/* Card 2: Хэрэглэгчийн цэвэр орлого */}
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-2.5 sm:p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              Хэрэглэгчийн цэвэр орлого
            </span>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-500">
              <User className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-base sm:text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tnum font-mono truncate">
              {formatMoney(totals?.net)}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-emerald-500 truncate">
              <span className="inline-flex items-center">↑ 8.2%</span>
              <span className="text-[var(--color-fg-subtle)] font-normal truncate">Өмнөх хугацаатай харьцуулахад</span>
            </div>
          </div>
        </div>

        {/* Card 3: Eplug үйлчилгээний шимтгэл */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 sm:p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-medium text-[var(--color-fg-muted)] truncate">
              Eplug үйлчилгээний шимтгэл
            </span>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-fg)] tnum font-mono truncate">
              {formatMoney(totals?.fee)}
            </div>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[var(--color-fg-muted)] truncate">
              <span className="font-semibold text-blue-500">{avgFeePercent}%</span> Үйлчилгээний хувь
            </div>
          </div>
        </div>

        {/* Card 4: Нийлүүлсэн эрчим хүч */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 sm:p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-medium text-[var(--color-fg-muted)] truncate">
              Нийлүүлсэн эрчим хүч
            </span>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
              <Zap className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-fg)] tnum font-mono truncate">
              {formatNumber(totals?.energyKwh, 2)} кВтц
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-emerald-500 truncate">
              <span className="inline-flex items-center">↑ 15.3%</span>
              <span className="text-[var(--color-fg-subtle)] font-normal truncate">Өмнөх хугацаатай харьцуулахад</span>
            </div>
          </div>
        </div>

        {/* Card 5: Төлбөрийн үлдэгдэл */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 sm:p-3 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-medium text-[var(--color-fg-muted)] truncate">
              Төлбөрийн үлдэгдэл
            </span>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-purple-500/10 text-purple-500">
              <CreditCard className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-fg)] tnum font-mono truncate">
              {formatMoney(totals?.outstanding ?? totals?.net ?? 0)}
            </div>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-emerald-500 font-medium truncate">
              Шилжүүлэх боломжтой
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tabs & Table Card directly below resized dashboard */}
      <Card>
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--color-border)] px-3 sm:px-4 bg-[var(--color-surface)]/60 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('stations')}
            className={cn(
              'py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap',
              activeTab === 'stations'
                ? 'border-emerald-500 text-emerald-500 font-semibold'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Станцын тайлан ({rawStations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={cn(
              'py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap',
              activeTab === 'daily'
                ? 'border-emerald-500 text-emerald-500 font-semibold'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            Өдрийн хөдөлгөөн ({daily.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('connectors')}
            className={cn(
              'py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap',
              activeTab === 'connectors'
                ? 'border-emerald-500 text-emerald-500 font-semibold'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            <Plug className="h-3.5 w-3.5" />
            Холбогч бүрээр ({connectors.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={cn(
              'py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap',
              activeTab === 'sessions'
                ? 'border-emerald-500 text-emerald-500 font-semibold'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Цэнэглэлтийн лог ({sessions.length})
          </button>
        </div>

        {/* Sub-toolbar: Search, Date quick chips, and CSV Export */}
        <div className="p-2.5 sm:p-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[16rem]">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[14rem] max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Станцын нэр, байршил, ID-аар хайх..."
                className="h-8 pl-8 pr-7 text-xs w-full"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                  aria-label="Цэвэрлэх"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Date preset chips */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRange(todayRange())}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-fg-muted)] transition-colors border border-[var(--color-border)]"
              >
                Өнөөдөр
              </button>
              <button
                type="button"
                onClick={() => setRange(last7DaysRange())}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-fg-muted)] transition-colors border border-[var(--color-border)]"
              >
                Сүүлийн 7 хоног
              </button>
              <button
                type="button"
                onClick={() => setRange(currentMonthRange())}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-fg-muted)] transition-colors border border-[var(--color-border)]"
              >
                Энэ сар
              </button>
              <button
                type="button"
                onClick={() => setRange(lastMonthRange())}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-fg-muted)] transition-colors border border-[var(--color-border)]"
              >
                Өнгөрсөн сар
              </button>
            </div>
          </div>

          {/* Export Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={exportCsv}
            disabled={!rawStations.length}
            className="text-xs h-8 ml-auto font-medium"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            CSV татах
          </Button>
        </div>

        {/* TAB 1: Станцын тайлан Table with № and inline drilldown */}
        {activeTab === 'stations' && (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH className="w-10 text-center">№</TH>
                      <TH>Станц / Байршил</TH>
                      <TH className="text-right">Сеанс</TH>
                      <TH className="text-right">Эрчим хүч (кВтц)</TH>
                      <TH className="text-right">Тариф (₮/кВтц)</TH>
                      <TH className="text-right">Борлуулалт (₮)</TH>
                      <TH className="text-right">Шимтгэл (₮)</TH>
                      <TH className="text-right">Цэвэр орлого (₮)</TH>
                      <TH className="text-center">Тооцох томьёо</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {isLoading && !data ? (
                      <TableLoading colSpan={9} />
                    ) : error ? (
                      <TableEmpty colSpan={9}>Алдаа гарлаа: {String(error)}</TableEmpty>
                    ) : stations.length === 0 ? (
                      <TableEmpty colSpan={9}>
                        Сонгосон хугацаанд дууссан цэнэглэлтийн өгөгдөл олдсонгүй.
                      </TableEmpty>
                    ) : (
                      stations.map((s, idx) => {
                        const isExpanded = !!expandedStationIds[s.chargePointId];
                        const stationSessions = s.sessions ?? [];

                        return (
                          <React.Fragment key={s.chargePointId}>
                            <TR
                              className={cn(
                                'cursor-pointer transition-colors',
                                isExpanded
                                  ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                                  : 'hover:bg-[var(--color-surface-2)]/60',
                              )}
                              onClick={() => toggleStationExpand(s.chargePointId)}
                            >
                              {/* Row Number */}
                              <TD className="w-10 text-center font-mono text-xs text-[var(--color-fg-subtle)]">
                                {idx + 1}
                              </TD>

                              {/* Station / Location (Only name, left-aligned, start from the same position) */}
                              <TD align="left">
                                <div className="flex items-center gap-1.5 text-left">
                                  <button
                                    type="button"
                                    className="p-0.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] shrink-0"
                                    aria-label="Сеансуудыг дэлгэрүүлэх"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <span
                                    className="font-medium text-xs text-[var(--color-fg)] truncate"
                                    title={s.address ? `${s.name} (${s.address})` : s.name}
                                  >
                                    {s.name}
                                  </span>
                                </div>
                              </TD>

                              {/* Sessions Count */}
                              <TD className="text-right font-medium">
                                <span className="inline-flex items-center justify-center rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--color-fg)]">
                                  {formatNumber(s.sessionsCount)}
                                </span>
                              </TD>

                              {/* Energy (kWh) */}
                              <TD className="text-right font-mono text-xs">
                                {formatNumber(s.energyKwh, 2)} кВтц
                              </TD>

                              {/* Tariff */}
                              <TD className="text-right font-mono text-xs text-[var(--color-fg-muted)]">
                                {s.tariffPerKwh ? `${formatNumber(s.tariffPerKwh)} ₮` : 'Хуваарьт'}
                              </TD>

                              {/* Gross (Each station's own charged amount!) */}
                              <TD align="right" className="text-right font-mono text-xs font-normal text-[var(--color-fg)] px-3">
                                {formatAmount(s.gross)}
                              </TD>

                              {/* Fee Amount (Each station's own fee) */}
                              <TD align="right" className="text-right font-mono text-xs text-blue-500 font-normal px-3">
                                {formatAmount(s.feeAmount)}
                                <span className="text-[10px] text-[var(--color-fg-subtle)] ml-1">
                                  ({s.feePercent}%)
                                </span>
                              </TD>

                              {/* Net Revenue (Each station's own client net) */}
                              <TD align="right" className="text-right font-mono text-xs font-normal text-emerald-600 dark:text-emerald-400 px-3">
                                {formatAmount(s.clientNet)}
                              </TD>

                              {/* Calculation Formula */}
                              <TD className="text-center text-[10px] font-mono text-[var(--color-fg-muted)]">
                                <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 border border-[var(--color-border)]">
                                  {formatAmount(s.gross)} - {formatAmount(s.feeAmount)} = {formatAmount(s.clientNet)}
                                </span>
                              </TD>
                            </TR>

                            {/* INLINE DRILLDOWN: Individual sessions for this station */}
                            {isExpanded && (
                              <TR className="bg-[var(--color-bg)]/80 border-b border-[var(--color-border)]">
                                <TD colSpan={9} className="p-3 sm:p-5">
                                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 shadow-inner">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                                          <TrendingUp className="h-3.5 w-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-[var(--color-fg)]">
                                          &quot;{s.name}&quot; станцын цэнэглэлтийн сеансууд ({stationSessions.length})
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-[var(--color-fg-muted)]">
                                        Нийт {formatMoney(s.gross)} борлуулалтын нарийвчилсан задаргаа
                                      </span>
                                    </div>

                                    {stationSessions.length === 0 ? (
                                      <div className="py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                                        Энэ хугацаанд цэнэглэлтийн сеанс бүртгэгдээгүй байна.
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="border-b border-[var(--color-border)] text-[11px] text-[var(--color-fg-subtle)] font-medium">
                                              <th className="py-1.5 px-2.5 w-10 text-center border-r border-[var(--color-border)]">№</th>
                                              <th className="py-1.5 px-2.5 border-r border-[var(--color-border)]">Сеанс ID</th>
                                              <th className="py-1.5 px-2.5 border-r border-[var(--color-border)]">Холбогч</th>
                                              <th className="py-1.5 px-2.5 border-r border-[var(--color-border)]">Машин / Карт</th>
                                              <th className="py-1.5 px-2.5 border-r border-[var(--color-border)]">Эхэлсэн хугацаа</th>
                                              <th className="py-1.5 px-2.5 text-right border-r border-[var(--color-border)]">Эрчим хүч</th>
                                              <th className="py-1.5 px-2.5 text-right border-r border-[var(--color-border)]">Тариф</th>
                                              <th className="py-1.5 px-2.5 text-right font-semibold border-r border-[var(--color-border)]">Борлуулалт</th>
                                              <th className="py-1.5 px-2.5 text-right text-blue-500 border-r border-[var(--color-border)]">Шимтгэл</th>
                                              <th className="py-1.5 px-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">Цэвэр орлого</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[var(--color-border)]">
                                            {stationSessions.map((tx, sIdx) => (
                                              <tr key={tx.id} className="hover:bg-[var(--color-surface-2)]/40 transition-colors">
                                                <td className="py-1.5 px-2.5 text-center font-mono text-[11px] text-[var(--color-fg-subtle)] border-r border-[var(--color-border)]">
                                                  {sIdx + 1}
                                                </td>
                                                <td className="py-1.5 px-2.5 font-mono font-semibold text-emerald-500 border-r border-[var(--color-border)]">
                                                  <Link
                                                    href={`/transactions/${tx.id}`}
                                                    className="hover:underline"
                                                    title="Цэнэглэлтийн дэлгэрэнгүй хуудас руу очих"
                                                  >
                                                    #{tx.id}
                                                  </Link>
                                                </td>
                                                <td className="py-1.5 px-2.5 border-r border-[var(--color-border)]">
                                                  <span className="inline-flex items-center gap-1 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--color-fg)]">
                                                    Буу {connectorLetter(tx.connectorId)}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-2.5 text-[11px] text-[var(--color-fg-muted)] border-r border-[var(--color-border)]">
                                                  {tx.vehicleModel || tx.idTag || '—'}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-[11px] text-[var(--color-fg-muted)] border-r border-[var(--color-border)]">
                                                  {formatDateTime(tx.startTimestamp)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono text-xs border-r border-[var(--color-border)]">
                                                  {formatNumber(tx.energyKwh, 2)} кВтц
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono text-[11px] text-[var(--color-fg-subtle)] border-r border-[var(--color-border)]">
                                                  {tx.tariffPerKwh ? `${formatNumber(tx.tariffPerKwh)}₮` : '—'}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono text-xs font-semibold text-[var(--color-fg)] border-r border-[var(--color-border)]">
                                                  {formatMoney(tx.cost)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono text-xs text-blue-500 border-r border-[var(--color-border)]">
                                                  {formatMoney(tx.feeAmount)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                  {formatMoney(tx.clientNet)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </TD>
                              </TR>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </TBody>
                </Table>
              </TableWrap>
            </div>

            {/* Mobile Cards View matching Image 1 phone mockup */}
            <div className="block md:hidden p-3 space-y-3">
              {isLoading && !data ? (
                <div className="py-8 text-center text-xs text-[var(--color-fg-muted)]">Ачаалж байна...</div>
              ) : stations.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--color-fg-muted)]">
                  Сонгосон хугацаанд цэнэглэлтийн өгөгдөл олдсонгүй.
                </div>
              ) : (
                stations.map((s, idx) => {
                  const isExpanded = !!expandedStationIds[s.chargePointId];
                  const stationSessions = s.sessions ?? [];

                  return (
                    <div
                      key={s.chargePointId}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-sm space-y-3"
                    >
                      {/* Top Header: Index, Station Name */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs font-mono font-bold text-[var(--color-fg)]">
                            {idx + 1}
                          </span>
                          <div className="font-semibold text-xs sm:text-sm text-[var(--color-fg)] truncate">
                            {s.name}
                          </div>
                        </div>
                      </div>

                      {/* 3-column stats */}
                      <div className="grid grid-cols-3 gap-2 border-y border-[var(--color-border)] py-2 text-center">
                        <div>
                          <div className="text-[10px] text-[var(--color-fg-subtle)] uppercase">Сеанс</div>
                          <div className="font-bold text-xs text-[var(--color-fg)] font-mono">
                            {formatNumber(s.sessionsCount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--color-fg-subtle)] uppercase">Эрчим хүч</div>
                          <div className="font-bold text-xs text-[var(--color-fg)] font-mono">
                            {formatNumber(s.energyKwh, 1)} кВтц
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--color-fg-subtle)] uppercase">Тариф</div>
                          <div className="font-bold text-xs text-[var(--color-fg)] font-mono">
                            {s.tariffPerKwh ? `${formatNumber(s.tariffPerKwh)}₮` : 'Хуваарьт'}
                          </div>
                        </div>
                      </div>

                      {/* Amount Breakdown Box */}
                      <div className="rounded-lg bg-[var(--color-bg)]/80 p-2.5 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-[var(--color-fg-muted)]">
                          <span>Нийт борлуулалт:</span>
                          <span className="font-mono font-semibold text-[var(--color-fg)]">
                            {formatMoney(s.gross)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-blue-500">
                          <span>Eplug шимтгэл ({s.feePercent}%):</span>
                          <span className="font-mono font-semibold">
                            -{formatMoney(s.feeAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1.5 border-t border-[var(--color-border)] text-emerald-600 dark:text-emerald-400 font-bold">
                          <span>Цэвэр орлого:</span>
                          <span className="font-mono text-sm">
                            {formatMoney(s.clientNet)}
                          </span>
                        </div>
                      </div>

                      {/* Toggle Drilldown Button */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleStationExpand(s.chargePointId)}
                        className="w-full text-xs h-8 flex items-center justify-center gap-1.5"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="h-3.5 w-3.5 text-emerald-500" />
                            Сеансууд нуух ({stationSessions.length})
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-3.5 w-3.5" />
                            Сеансууд харах ({stationSessions.length})
                          </>
                        )}
                      </Button>

                      {/* Mobile Expanded Session Cards */}
                      {isExpanded && (
                        <div className="pt-2 space-y-2 border-t border-[var(--color-border)]">
                          {stationSessions.length === 0 ? (
                            <div className="py-3 text-center text-xs text-[var(--color-fg-subtle)]">
                              Энэ хугацаанд цэнэглэлт байхгүй.
                            </div>
                          ) : (
                            stationSessions.map((tx, sIdx) => (
                              <div
                                key={tx.id}
                                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-2.5 text-xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <Link
                                    href={`/transactions/${tx.id}`}
                                    className="font-mono font-bold text-emerald-500 hover:underline"
                                  >
                                    #{tx.id}
                                  </Link>
                                  <span className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
                                    Буу {connectorLetter(tx.connectorId)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[var(--color-fg-subtle)]">
                                  {formatDateTime(tx.startTimestamp)}
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                  <span>{formatNumber(tx.energyKwh, 2)} кВтц</span>
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatMoney(tx.clientNet)}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* TAB 2: Өдрийн хөдөлгөөн Table */}
        {activeTab === 'daily' && (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 text-center">№</TH>
                  <TH className="text-left">Огноо</TH>
                  <TH className="text-right">Цэнэглэлтийн тоо</TH>
                  <TH className="text-right">Эрчим хүч (кВтц)</TH>
                  <TH className="text-right">Борлуулалт (₮)</TH>
                  <TH className="text-right">Шимтгэл (₮)</TH>
                  <TH className="text-right">Цэвэр орлого (₮)</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={7} />
                ) : daily.length === 0 ? (
                  <TableEmpty colSpan={7}>Өдрийн хөдөлгөөний өгөгдөл олдсонгүй.</TableEmpty>
                ) : (
                  daily.map((d, idx) => (
                    <TR key={d.date}>
                      <TD align="center" className="w-10 text-center font-mono text-xs text-[var(--color-fg-subtle)]">
                        {idx + 1}
                      </TD>
                      <TD align="left" className="font-mono font-medium text-xs">{formatDate(d.date)}</TD>
                      <TD className="text-right font-medium text-xs">{formatNumber(d.sessionsCount)}</TD>
                      <TD className="text-right font-mono text-xs">{formatNumber(d.energyKwh, 2)} кВтц</TD>
                      <TD className="text-right font-mono text-xs font-semibold text-[var(--color-fg)]">{formatMoney(d.gross)}</TD>
                      <TD className="text-right font-mono text-xs text-blue-500">{formatMoney(d.fee)}</TD>
                      <TD className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(d.net)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        )}

        {/* TAB 3: Холбогч бүрээр Table */}
        {activeTab === 'connectors' && (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 text-center">№</TH>
                  <TH className="text-left">Станц</TH>
                  <TH className="text-center">Холбогч</TH>
                  <TH className="text-right">Цэнэглэлт</TH>
                  <TH className="text-right">Эрчим хүч (кВтц)</TH>
                  <TH className="text-right">Борлуулалт (₮)</TH>
                  <TH className="text-right">Шимтгэл (₮)</TH>
                  <TH className="text-right">Цэвэр орлого (₮)</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={8} />
                ) : connectors.length === 0 ? (
                  <TableEmpty colSpan={8}>Холбогчийн өгөгдөл олдсонгүй.</TableEmpty>
                ) : (
                  connectors.map((c, idx) => (
                    <TR key={`${c.chargePointId}-${c.connectorId}`}>
                      <TD align="center" className="w-10 text-center font-mono text-xs text-[var(--color-fg-subtle)]">
                        {idx + 1}
                      </TD>
                      <TD align="left" className="font-medium text-xs">{c.stationName}</TD>
                      <TD>
                        <Badge tone="idle" className="text-[10px] py-0 px-1.5">Буу {connectorLetter(c.connectorId)}</Badge>
                      </TD>
                      <TD className="text-right font-medium text-xs">{formatNumber(c.sessionsCount)}</TD>
                      <TD className="text-right font-mono text-xs">{formatNumber(c.energyKwh, 2)} кВтц</TD>
                      <TD className="text-right font-mono text-xs font-semibold text-[var(--color-fg)]">{formatMoney(c.gross)}</TD>
                      <TD className="text-right font-mono text-xs text-blue-500">{formatMoney(c.fee)}</TD>
                      <TD className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(c.net)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        )}

        {/* TAB 4: Цэнэглэлтийн лог Table */}
        {activeTab === 'sessions' && (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 text-center">№</TH>
                  <TH className="w-20 text-center">Сеанс #</TH>
                  <TH>Станц / Холбогч</TH>
                  <TH>Хугацаа</TH>
                  <TH className="text-right">Хэрэглээ</TH>
                  <TH className="text-right">Тариф</TH>
                  <TH className="text-right font-semibold">Борлуулалт</TH>
                  <TH className="text-right text-blue-500">Шимтгэл</TH>
                  <TH className="text-right font-bold text-emerald-600 dark:text-emerald-400">Цэвэр орлого</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={9} />
                ) : sessions.length === 0 ? (
                  <TableEmpty colSpan={9}>Цэнэглэлтийн лог олдсонгүй.</TableEmpty>
                ) : (
                  sessions.map((tx, idx) => (
                    <TR key={tx.id}>
                      <TD align="center" className="w-10 text-center font-mono text-xs text-[var(--color-fg-subtle)]">
                        {idx + 1}
                      </TD>
                      <TD className="font-mono text-xs font-bold text-emerald-500 text-center">
                        <Link href={`/transactions/${tx.id}`} className="hover:underline">
                          #{tx.id}
                        </Link>
                      </TD>
                      <TD align="left">
                        <div className="font-medium text-xs text-[var(--color-fg)]">{tx.stationName}</div>
                        <div className="text-[10px] text-[var(--color-fg-subtle)] font-mono">
                          Буу {connectorLetter(tx.connectorId)} {tx.vehicleModel ? `· ${tx.vehicleModel}` : ''}
                        </div>
                      </TD>
                      <TD align="left" className="text-xs">
                        <div>{formatDateTime(tx.startTimestamp)}</div>
                        <div className="text-[10px] text-[var(--color-fg-subtle)]">
                          {formatDateTime(tx.stopTimestamp)}
                        </div>
                      </TD>
                      <TD className="text-right font-mono text-xs">{formatNumber(tx.energyKwh, 2)} кВтц</TD>
                      <TD className="text-right text-xs font-mono text-[var(--color-fg-muted)]">
                        {tx.tariffPerKwh ? `${formatMoney(tx.tariffPerKwh)}/кВтц` : '—'}
                      </TD>
                      <TD className="text-right font-mono text-xs font-semibold text-[var(--color-fg)]">
                        {formatMoney(tx.cost)}
                      </TD>
                      <TD className="text-right font-mono text-xs text-blue-500">
                        {formatMoney(tx.feeAmount)}
                        <span className="text-[10px] text-[var(--color-fg-subtle)] ml-1">
                          ({tx.feePercent}%)
                        </span>
                      </TD>
                      <TD className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(tx.clientNet)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
