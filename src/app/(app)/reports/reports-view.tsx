'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  Banknote,
  Building2,
  Calculator,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Plug,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import {
  connectorLetter,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatWh,
} from '@/lib/format';
import type { ChargePoint, Client, Paginated, ReportSummary, SessionUser } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Field, Select } from '@/components/ui/primitives';
import { DateRangePicker, toIsoDate, type DateRange } from '@/components/ui/date-picker';
import { FilterBar } from '@/components/ui/pagination';
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
  const [expandedStationId, setExpandedStationId] = React.useState<string | null>(null);

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
  const stations = data?.stations ?? [];
  const daily = data?.daily ?? [];
  const connectors = data?.connectors ?? [];
  const sessions = data?.recentSessions ?? [];

  // Export CSV
  function exportCsv() {
    if (!data) return;
    const header = [
      'Станц ID',
      'Станцын нэр',
      'Хаяг',
      'Цэнэглэлтийн тоо',
      'Эрчим хүч (кВт.ц)',
      'Үндсэн тариф (₮)',
      'Цэнэглэлтийн өртөг (₮)',
      'Шимтгэл %',
      'Шимтгэл дүн (₮)',
      'Нийт борлуулалт (₮)',
      'Харилцагчийн цэвэр орлого (₮)',
      'Тооцооллын томьёо',
    ];

    const rows = stations.map((s) => [
      `"${s.cpId}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${(s.address ?? '').replace(/"/g, '""')}"`,
      s.sessionsCount,
      s.energyKwh,
      s.tariffPerKwh,
      s.energyCost,
      s.feePercent,
      s.feeAmount,
      s.gross,
      s.clientNet,
      `"${s.formula.summaryDisplay.replace(/"/g, '""')}"`,
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
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={exportCsv}
          disabled={!stations.length}
          title="CSV татах"
        >
          <Download className="h-3.5 w-3.5" />
          CSV экспорт
        </Button>
      </div>

      {/* Primary KPI Grid */}
      <StatGrid className="gap-3">
        <StatCard
          label="Нийт борлуулалт (Gross)"
          value={formatMoney(totals?.gross)}
          sub={`${formatNumber(totals?.sessionsCount)} удаагийн цэнэглэлт`}
        />
        <StatCard
          label="Харилцагчийн цэвэр орлого (Net)"
          value={formatMoney(totals?.net)}
          sub="Борлуулалт - Шимтгэл"
          tone="ok"
        />
        <StatCard
          label="Eplug үйлчилгээний шимтгэл"
          value={formatMoney(totals?.fee)}
          sub="Сүлжээний үйлчилгээний хураамж"
          tone="brand"
        />
        <StatCard
          label="Гарсан эрчим хүч"
          value={`${formatNumber(totals?.energyKwh, 1)} кВт.ц`}
          sub={totals?.sessionsCount ? `Дунджаар: ${formatNumber(totals?.averageSessionKwh, 1)} кВт.ц / цэнэглэлт` : '—'}
        />
        <StatCard
          label="Олгох үлдэгдэл"
          value={formatMoney(totals?.outstanding)}
          sub={totals?.paidTotal ? `Төлсөн: ${formatMoney(totals?.paidTotal)}` : 'Шилжүүлсэн тооцоогүй'}
          tone={(totals?.outstanding ?? 0) > 0 ? 'info' : 'idle'}
        />
      </StatGrid>

      {/* Formula Explanation Card */}
      <Card className="border-[var(--color-border)] bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-brand)]/5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">
              <Calculator className="h-4 w-4 text-[var(--color-brand)]" />
              <span>Станцын тооцооллын стандарт томьёо (Calculating Formulas)</span>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Станц бүрийн тооцоо бодит тоолуурын хэмжилт болон баталгаажсан тарифын хувиар дараах томьёогоор бодогдоно:
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-surface)]/80 px-3 py-1.5 border border-[var(--color-border)] text-[11px] text-[var(--color-fg-muted)]">
            <Info className="h-3.5 w-3.5 text-[var(--color-brand)]" />
            <span>1 кВт.ц = 1,000 Вт.ц (Монгол Улсын цагийн бүс UTC+8)</span>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="text-[11px] font-medium text-[var(--color-fg-subtle)] uppercase tracking-wider">
              1. Цэнэглэлтийн өртөг
            </span>
            <div className="mt-1 font-mono text-xs font-semibold text-[var(--color-fg)]">
              кВт.ц × Тариф (₮)
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
              Станцын тоолуурын гарсан эрчим хүчийг тогтоосон тарифын бүсээр үржүүлнэ.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="text-[11px] font-medium text-[var(--color-brand)] uppercase tracking-wider">
              2. Eplug шимтгэл
            </span>
            <div className="mt-1 font-mono text-xs font-semibold text-[var(--color-fg)]">
              Өртөг × Шимтгэлийн %
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
              Цэнэглэлтийн өртгөөс гэрээт хураамжийн хувиар бодогдоно.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="text-[11px] font-medium text-[var(--color-fg-subtle)] uppercase tracking-wider">
              3. Борлуулалт (Gross)
            </span>
            <div className="mt-1 font-mono text-xs font-semibold text-[var(--color-fg)]">
              Цэнэглэлт + Шимтгэл
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
              Жолоочийн төлсөн нийт төлбөрийн дүн.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="text-[11px] font-medium text-[var(--color-success)] uppercase tracking-wider">
              4. Харилцагчийн орлого
            </span>
            <div className="mt-1 font-mono text-xs font-semibold text-[var(--color-success)]">
              Борлуулалт - Шимтгэл
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
              Харилцагчийн дансанд шилжүүлэн олгох цэвэр өгөөж.
            </p>
          </div>
        </div>
      </Card>

      {/* Filter and Date Controls */}
      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-fg-muted)]">Хугацаа:</span>
            <button
              type="button"
              onClick={() => setRange(todayRange())}
              className="px-2.5 py-1 text-xs rounded-md bg-[var(--color-bg)] hover:bg-[var(--color-border)] transition-colors border border-[var(--color-border)]"
            >
              Өнөөдөр
            </button>
            <button
              type="button"
              onClick={() => setRange(last7DaysRange())}
              className="px-2.5 py-1 text-xs rounded-md bg-[var(--color-bg)] hover:bg-[var(--color-border)] transition-colors border border-[var(--color-border)]"
            >
              Сүүлийн 7 хоног
            </button>
            <button
              type="button"
              onClick={() => setRange(currentMonthRange())}
              className="px-2.5 py-1 text-xs rounded-md bg-[var(--color-bg)] hover:bg-[var(--color-border)] transition-colors border border-[var(--color-border)]"
            >
              Энэ сар
            </button>
            <button
              type="button"
              onClick={() => setRange(lastMonthRange())}
              className="px-2.5 py-1 text-xs rounded-md bg-[var(--color-bg)] hover:bg-[var(--color-border)] transition-colors border border-[var(--color-border)]"
            >
              Өнгөрсөн сар
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker
              className="w-auto min-w-[15rem]"
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

            {/* Station dropdown filter */}
            <Select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="w-48 text-xs"
              aria-label="Станц шүүх"
            >
              <option value="all">Бүх станц</option>
              {stationOptions.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name || cp.cpId}
                </option>
              ))}
            </Select>

            {/* Client dropdown filter (admin/operator only) */}
            {!isClient && clientOptions.length > 0 && (
              <Select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-48 text-xs"
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

        {/* Tab Selection */}
        <div className="flex border-b border-[var(--color-border)] px-4 bg-[var(--color-surface)]/50">
          <button
            type="button"
            onClick={() => setActiveTab('stations')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'stations'
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Станцын тайлан ({stations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'daily'
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Өдрийн хөдөлгөөн ({daily.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('connectors')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'connectors'
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Plug className="h-3.5 w-3.5" />
            Холбогч бүрээр ({connectors.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sessions'
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Цэнэглэлтийн лог ({sessions.length})
          </button>
        </div>

        {/* Tab 1: Stations Table with live calculating formula breakdown */}
        {activeTab === 'stations' && (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Станц</TH>
                  <TH>Цэнэглэлт</TH>
                  <TH>Эрчим хүч (кВт.ц)</TH>
                  <TH>Тариф</TH>
                  <TH>Борлуулалт (₮)</TH>
                  <TH>Шимтгэл (₮)</TH>
                  <TH>Харилцагчийн орлого (₮)</TH>
                  <TH>Тооцооллын томьёо</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={8} />
                ) : error ? (
                  <TableEmpty colSpan={8}>Алдаа гарлаа: {String(error)}</TableEmpty>
                ) : stations.length === 0 ? (
                  <TableEmpty colSpan={8}>
                    Сонгосон хугацаанд дууссан цэнэглэлтийн өгөгдөл олдсонгүй.
                  </TableEmpty>
                ) : (
                  stations.map((s) => {
                    const isExpanded = expandedStationId === s.chargePointId;
                    return (
                      <React.Fragment key={s.chargePointId}>
                        <TR
                          className="cursor-pointer hover:bg-[var(--color-surface)]/80"
                          onClick={() =>
                            setExpandedStationId(isExpanded ? null : s.chargePointId)
                          }
                        >
                          <TD>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
                                aria-label="Дэлгэрэнгүй томьёо"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <div>
                                <div className="font-semibold">{s.name}</div>
                                <div className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
                                  {s.cpId} {s.address ? `· ${s.address}` : ''}
                                </div>
                              </div>
                            </div>
                          </TD>
                          <TD className="font-medium">{formatNumber(s.sessionsCount)}</TD>
                          <TD className="font-mono text-sm">{formatNumber(s.energyKwh, 2)} кВт.ц</TD>
                          <TD className="text-xs">{s.tariffPerKwh ? `${formatNumber(s.tariffPerKwh)}₮` : 'Хуваарьт'}</TD>
                          <TD className="font-mono text-sm font-semibold">{formatMoney(s.gross)}</TD>
                          <TD className="font-mono text-xs text-[var(--color-brand)]">
                            {formatMoney(s.feeAmount)} ({s.feePercent}%)
                          </TD>
                          <TD className="font-mono text-sm font-semibold text-[var(--color-success)]">
                            {formatMoney(s.clientNet)}
                          </TD>
                          <TD className="text-[11px] text-[var(--color-fg-muted)] font-mono">
                            {s.formula.summaryDisplay}
                          </TD>
                        </TR>

                        {/* Expandable detail with complete calculation step breakdown */}
                        {isExpanded && (
                          <TR className="bg-[var(--color-bg)]/40 border-b border-[var(--color-border)]">
                            <TD colSpan={8} className="py-3 px-6">
                              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
                                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                                  <div className="text-xs font-bold text-[var(--color-fg)] flex items-center gap-1.5">
                                    <Calculator className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                                    <span>&quot;{s.name}&quot; станцын нарийвчилсан тооцооны задргаа:</span>
                                  </div>
                                  <span className="text-[11px] text-[var(--color-fg-muted)]">
                                    Нийт {s.sessionsCount} цэнэглэлтийн нийлбэр
                                  </span>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                                  <div>
                                    <span className="text-[11px] text-[var(--color-fg-subtle)]">Тоолуурын эрчим хүч:</span>
                                    <p className="font-mono font-medium text-[var(--color-fg)] mt-0.5">
                                      {s.formula.kwhFormula}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-[11px] text-[var(--color-fg-subtle)]">Цэнэглэлтийн өртөг:</span>
                                    <p className="font-mono font-medium text-[var(--color-fg)] mt-0.5">
                                      {s.formula.energyCostFormula}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-[11px] text-[var(--color-fg-subtle)]">Eplug шимтгэл ({s.feePercent}%):</span>
                                    <p className="font-mono font-medium text-[var(--color-brand)] mt-0.5">
                                      {s.formula.feeFormula}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-[11px] text-[var(--color-fg-subtle)]">Харилцагчид олгох цэвэр орлого:</span>
                                    <p className="font-mono font-bold text-[var(--color-success)] mt-0.5">
                                      {s.formula.netFormula}
                                    </p>
                                  </div>
                                </div>
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
        )}

        {/* Tab 2: Daily Breakdown Table */}
        {activeTab === 'daily' && (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Огноо</TH>
                  <TH>Цэнэглэлтийн тоо</TH>
                  <TH>Эрчим хүч (кВт.ц)</TH>
                  <TH>Борлуулалт (₮)</TH>
                  <TH>Eplug шимтгэл (₮)</TH>
                  <TH>Харилцагчийн орлого (₮)</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={6} />
                ) : daily.length === 0 ? (
                  <TableEmpty colSpan={6}>Өдрийн өгөгдөл олдсонгүй.</TableEmpty>
                ) : (
                  daily.map((d) => (
                    <TR key={d.date}>
                      <TD className="font-medium">{d.date}</TD>
                      <TD>{formatNumber(d.sessionsCount)}</TD>
                      <TD className="font-mono text-sm">{formatNumber(d.energyKwh, 2)} кВт.ц</TD>
                      <TD className="font-mono text-sm font-semibold">{formatMoney(d.gross)}</TD>
                      <TD className="font-mono text-xs text-[var(--color-brand)]">{formatMoney(d.fee)}</TD>
                      <TD className="font-mono text-sm font-semibold text-[var(--color-success)]">
                        {formatMoney(d.net)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        )}

        {/* Tab 3: Connectors Table */}
        {activeTab === 'connectors' && (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Станц</TH>
                  <TH>Буу / Холбогч</TH>
                  <TH>Цэнэглэлт</TH>
                  <TH>Эрчим хүч (кВт.ц)</TH>
                  <TH>Борлуулалт (₮)</TH>
                  <TH>Шимтгэл (₮)</TH>
                  <TH>Харилцагчийн орлого (₮)</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={7} />
                ) : connectors.length === 0 ? (
                  <TableEmpty colSpan={7}>Холбогчийн өгөгдөл олдсонгүй.</TableEmpty>
                ) : (
                  connectors.map((c) => (
                    <TR key={`${c.chargePointId}-${c.connectorId}`}>
                      <TD className="font-medium">{c.stationName}</TD>
                      <TD>
                        <Badge tone="idle">Холбогч {connectorLetter(c.connectorId)}</Badge>
                      </TD>
                      <TD>{formatNumber(c.sessionsCount)}</TD>
                      <TD className="font-mono text-sm">{formatNumber(c.energyKwh, 2)} кВт.ц</TD>
                      <TD className="font-mono text-sm font-semibold">{formatMoney(c.gross)}</TD>
                      <TD className="font-mono text-xs text-[var(--color-brand)]">{formatMoney(c.fee)}</TD>
                      <TD className="font-mono text-sm font-semibold text-[var(--color-success)]">
                        {formatMoney(c.net)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        )}

        {/* Tab 4: Detailed Sessions Log */}
        {activeTab === 'sessions' && (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Цэнэглэлт #</TH>
                  <TH>Станц / Холбогч</TH>
                  <TH>Хугацаа</TH>
                  <TH>Хэрэглээ</TH>
                  <TH>Тариф</TH>
                  <TH>Борлуулалт</TH>
                  <TH>Шимтгэл</TH>
                  <TH>Цэвэр орлого</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={8} />
                ) : sessions.length === 0 ? (
                  <TableEmpty colSpan={8}>Цэнэглэлтийн лог олдсонгүй.</TableEmpty>
                ) : (
                  sessions.map((tx) => (
                    <TR key={tx.id}>
                      <TD className="font-mono text-xs font-semibold">#{tx.id}</TD>
                      <TD>
                        <div className="font-medium">{tx.stationName}</div>
                        <div className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
                          Буу {connectorLetter(tx.connectorId)} {tx.vehicleModel ? `· ${tx.vehicleModel}` : ''}
                        </div>
                      </TD>
                      <TD className="text-xs">
                        <div>{formatDateTime(tx.startTimestamp)}</div>
                        <div className="text-[11px] text-[var(--color-fg-subtle)]">
                          {formatDateTime(tx.stopTimestamp)}
                        </div>
                      </TD>
                      <TD className="font-mono text-sm">{formatNumber(tx.energyKwh, 2)} кВт.ц</TD>
                      <TD className="text-xs font-mono">{formatMoney(tx.tariffPerKwh)}/кВт.ц</TD>
                      <TD className="font-mono text-sm font-semibold">{formatMoney(tx.cost)}</TD>
                      <TD className="font-mono text-xs text-[var(--color-brand)]">
                        {formatMoney(tx.feeAmount)} ({tx.feePercent}%)
                      </TD>
                      <TD className="font-mono text-sm font-semibold text-[var(--color-success)]">
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
