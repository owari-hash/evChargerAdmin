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
  FileSpreadsheet,
  Search,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plug,
  TrendingUp,
  Wallet,
  X,
  Plus,
  Trash2,
  Pencil,
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
import type {
  ChargePoint,
  Client,
  Paginated,
  ReportSummary,
  SessionDriverFields,
  SessionPaymentFields,
  SessionPaymentMethod,
  SessionUser,
} from '@/lib/types';
import { Badge, Button, Card, Field, Input, Select, type Tone } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
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
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { PageToolbar } from '@/components/ui/page-toolbar';
import { StatCard, StatGrid } from '@/components/stat-card';
import { cn } from '@/lib/cn';
import {
  buildStationRevenueWorkbook,
  downloadWorkbook,
  revenueReportFileName,
  type RevenueReportParams,
} from '@/lib/revenue-report-excel';

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

/** Төлбөрийн хэлбэр — labels for how a session was paid. */
const PAYMENT_METHOD_META: Record<SessionPaymentMethod, { label: string; tone: Tone }> = {
  WALLET: { label: 'Хэтэвч', tone: 'brand' },
  QPAY: { label: 'QPay', tone: 'info' },
  QPAY_QUICKQR: { label: 'QPay QR', tone: 'info' },
  GOLOMT: { label: 'Карт · Голомт', tone: 'info' },
  SOCIALPAY: { label: 'SocialPay', tone: 'info' },
  TOKI: { label: 'Toki Pay', tone: 'info' },
  INTERNAL: { label: 'Байгууллага', tone: 'idle' },
  FREE: { label: 'Төлбөргүй', tone: 'idle' },
  UNPAID: { label: 'Төлөгдөөгүй', tone: 'danger' },
};

const WALLET_OWNER_LABEL: Record<string, string> = {
  USER: 'апп',
  IDTAG: 'карт',
  CLIENT: 'байгууллага',
};

function paymentMethodLabel(p: SessionPaymentFields): string {
  if (!p.paymentMethod) return '—';
  const base = PAYMENT_METHOD_META[p.paymentMethod]?.label ?? p.paymentMethod;
  const owner = p.paymentMethod === 'WALLET' && p.walletOwnerType ? WALLET_OWNER_LABEL[p.walletOwnerType] : '';
  return owner ? `${base} (${owner})` : base;
}

function PaymentMethodBadge({ session }: { session: SessionPaymentFields }) {
  if (!session.paymentMethod) return <span className="text-[var(--color-fg-subtle)]">—</span>;
  const meta = PAYMENT_METHOD_META[session.paymentMethod];
  return (
    <Badge tone={meta?.tone ?? 'idle'} className="text-[10px] py-0 px-1.5 whitespace-nowrap">
      {paymentMethodLabel(session)}
    </Badge>
  );
}

/** Зарцуулсан хугацаа — charging duration, e.g. "1 ц 23 мин". */
function durationMinutes(start?: string | null, stop?: string | null): number | null {
  if (!start || !stop) return null;
  const ms = new Date(stop).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 60000) : null;
}

function durationText(start?: string | null, stop?: string | null): string {
  const min = durationMinutes(start, stop);
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} ц ${m} мин` : `${m} мин`;
}

/** Утас — the driver's phone number. */
function DriverCell({ session }: { session: SessionDriverFields }) {
  return session.driverPhone ? (
    <span className="font-mono text-[11px] text-[var(--color-fg)] whitespace-nowrap">{session.driverPhone}</span>
  ) : (
    <span className="text-[11px] text-[var(--color-fg-subtle)]">—</span>
  );
}

/** Wallet balance left after the session (үлдэгдэл); dash when no wallet was charged. */
function balanceText(p: SessionPaymentFields): string {
  return p.balanceAfter == null ? '—' : formatMoney(p.balanceAfter);
}

/** Response of GET /reports/sessions-export. */
interface StationSessionsExport {
  station: {
    id: string;
    cpId: string;
    name: string;
    address: string;
    vendor: string;
    model: string;
    serialNumber: string;
    tariffPerKwh: number | null;
    tariffZones: { name?: string; startMinute?: number; endMinute?: number; tariffPerKwh?: number }[];
  };
  client?: {
    id: string;
    name: string;
    businessRegister?: string;
    feePercent?: number | null;
  } | null;
  contactsMasked: boolean;
  totals: { sessionsCount: number; driversCount: number; energyKwh: number; gross: number; fee: number; net: number };
  sessions: ({
    id: number;
    connectorId: number;
    idTag: string;
    driverName: string;
    driverPhone: string;
    driverEmail: string;
    driverType: string;
    vehicle: string;
    vehicleVin: string;
    vehicleBatteryKwh: number | null;
    startTimestamp: string;
    stopTimestamp: string | null;
    durationMin: number | null;
    meterStartWh: number;
    meterStopWh: number | null;
    energyKwh: number;
    avgPowerKw: number | null;
    startSocPercent: number | null;
    endSocPercent: number | null;
    tariffPerKwh: number | null;
    energyCost: number;
    feePercent: number;
    feeAmount: number;
    cost: number;
    clientNet: number;
    stopReason: string;
    startedRemotely: boolean;
    paymentProvider: string;
    paymentStatus: string;
    paidAmount: number | null;
    ebarimtStatus: string;
    ebarimtReceiptId: string;
    refundAmount: number | null;
    stationError: string;
    stationErrorVendorCode?: string;
    stationErrorTitle?: string;
  } & SessionPaymentFields)[];
}

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
  const byPaymentMethod = data?.byPaymentMethod ?? [];
  const sessionsTruncated = !!data?.sessionsTruncated;

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

  // Helper to auto-fit columns in Excel worksheet
  function autoFitColumns(rows: (string | number)[][]) {
    if (!rows.length) return [];
    return rows[0].map((_, colIdx) => {
      const maxLen = rows.reduce((max, row) => {
        const cellVal = row[colIdx] != null ? String(row[colIdx]) : '';
        return Math.max(max, cellVal.length);
      }, 10);
      return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
    });
  }

  type ExportCell = string | number | null | undefined;
  interface ExportData {
    headers: string[];
    rows: ExportCell[][];
    /** Footer (хөл дүн) row, appended after a blank line. */
    total: ExportCell[];
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const sumOf = <T,>(items: T[], f: (x: T) => number | null | undefined) =>
    round2(items.reduce((a, x) => a + (f(x) ?? 0), 0));

  /**
   * Builds a worksheet: auto-fit columns, numbers shown as 123,123.00 (cells stay numeric so
   * Excel can still sum them). ID-like columns (№, Цэнэглэлтийн дугаар) stay plain.
   */
  function buildSheet(rows: ExportCell[][]): XLSX.WorkSheet {
    const clean = rows.map((r) => r.map((v) => (v == null ? '' : v)));
    const ws = XLSX.utils.aoa_to_sheet(clean);
    const header = clean[0] ?? [];
    clean.forEach((row, r) =>
      row.forEach((v, c) => {
        if (typeof v !== 'number' || header[c] === '№' || header[c] === 'Цэнэглэлтийн дугаар') return;
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) cell.z = '#,##0.00';
      }),
    );
    ws['!cols'] = autoFitColumns(clean);
    return ws;
  }

  function appendExportSheet(wb: XLSX.WorkBook, name: string, data: ExportData) {
    XLSX.utils.book_append_sheet(wb, buildSheet([data.headers, ...data.rows, [], data.total]), name);
  }

  // Get structured export data per tab
  function getStationsExportData(): ExportData {
    const headers = ['№', 'Станц ID', 'Станцын нэр', 'Хаяг', 'Цэнэглэлтийн тоо', 'Эрчим хүч (кВтц)', 'Үндсэн тариф (₮)', 'Дүн (₮)'];
    const rows = rawStations.map((s, idx) => [
      idx + 1,
      s.cpId,
      s.name,
      s.address ?? '',
      s.sessionsCount,
      s.energyKwh,
      s.tariffPerKwh ?? 0,
      s.gross,
    ]);
    const total = [
      'НИЙТ', `${rawStations.length} станц`, '', '',
      sumOf(rawStations, (s) => s.sessionsCount),
      sumOf(rawStations, (s) => s.energyKwh),
      '',
      sumOf(rawStations, (s) => s.gross),
    ];
    return { headers, rows, total };
  }

  function getDailyExportData(): ExportData {
    const headers = ['№', 'Огноо', 'Цэнэглэлтийн тоо', 'Эрчим хүч (кВтц)', 'Дүн (₮)'];
    const rows = daily.map((d, idx) => [idx + 1, formatDate(d.date), d.sessionsCount, d.energyKwh, d.gross]);
    const total = [
      'НИЙТ', `${daily.length} өдөр`,
      sumOf(daily, (d) => d.sessionsCount),
      sumOf(daily, (d) => d.energyKwh),
      sumOf(daily, (d) => d.gross),
    ];
    return { headers, rows, total };
  }

  function getConnectorsExportData(): ExportData {
    const headers = ['№', 'Станцын нэр', 'Станц ID', 'Холбогч', 'Цэнэглэлтийн тоо', 'Эрчим хүч (кВтц)', 'Дүн (₮)'];
    const rows = connectors.map((c, idx) => [
      idx + 1,
      c.stationName,
      c.cpId,
      `Буу ${connectorLetter(c.connectorId)}`,
      c.sessionsCount,
      c.energyKwh,
      c.gross,
    ]);
    const total = [
      'НИЙТ', '', '', `${connectors.length} буу`,
      sumOf(connectors, (c) => c.sessionsCount),
      sumOf(connectors, (c) => c.energyKwh),
      sumOf(connectors, (c) => c.gross),
    ];
    return { headers, rows, total };
  }

  function getSessionsExportData(): ExportData {
    const headers = [
      '№', 'Цэнэглэлтийн дугаар', 'Станцын нэр', 'Станц ID', 'Холбогч', 'Утас', 'Тээврийн хэрэгсэл',
      'Эхэлсэн хугацаа', 'Дууссан хугацаа', 'Зарцуулсан хугацаа (мин)', 'Хэрэглээ (кВтц)', 'Тариф (₮/кВтц)', 'Дүн (₮)',
      'Төлбөрийн хэлбэр', 'Хэтэвчээс (₮)', 'Шууд төлсөн (₮)', 'Үлдэгдэл (₮)',
    ];
    const rows = sessions.map((tx, idx) => [
      idx + 1,
      `#${tx.id}`,
      tx.stationName,
      tx.cpId,
      `Буу ${connectorLetter(tx.connectorId)}`,
      tx.driverPhone || '',
      tx.vehicleModel || '',
      formatDateTime(tx.startTimestamp),
      formatDateTime(tx.stopTimestamp),
      durationMinutes(tx.startTimestamp, tx.stopTimestamp) ?? '',
      tx.energyKwh,
      round2(tx.tariffPerKwh || 0),
      tx.cost,
      paymentMethodLabel(tx),
      tx.walletPaid ?? 0,
      tx.directPaid ?? 0,
      tx.balanceAfter ?? '',
    ]);
    const total = [
      'НИЙТ', `${sessions.length} цэнэглэлт`, '', '', '',
      `${new Set(sessions.map((tx) => tx.idTag)).size} хэрэглэгч`, '', '', '',
      sumOf(sessions, (tx) => durationMinutes(tx.startTimestamp, tx.stopTimestamp)),
      sumOf(sessions, (tx) => tx.energyKwh),
      '',
      sumOf(sessions, (tx) => tx.cost),
      '',
      sumOf(sessions, (tx) => tx.walletPaid),
      sumOf(sessions, (tx) => tx.directPaid),
      '',
    ];
    return { headers, rows, total };
  }

  // Export current active tab as Excel (.xlsx)
  function exportActiveTabExcel() {
    let sheetName = 'Станцын тайлан';
    let data = getStationsExportData();
    let prefix = 'station-report';

    if (activeTab === 'daily') {
      sheetName = 'Өдрийн хөдөлгөөн';
      data = getDailyExportData();
      prefix = 'daily-report';
    } else if (activeTab === 'connectors') {
      sheetName = 'Холбогч бүрээр';
      data = getConnectorsExportData();
      prefix = 'connectors-report';
    } else if (activeTab === 'sessions') {
      sheetName = 'Цэнэглэлтийн лог';
      data = getSessionsExportData();
      prefix = 'charging-sessions';
    }

    if (!data.rows.length) return;

    const wb = XLSX.utils.book_new();
    appendExportSheet(wb, sheetName, data);
    XLSX.writeFile(wb, `${prefix}-${range.from}-to-${range.to}.xlsx`);
  }

  // Per-station Revenue Allocation Report («EV ЦЭНЭГЛЭХ СТАНЦЫН ОРЛОГО ХУВААРИЛАЛТЫН ТАЙЛАН»)
  const [revenueReportLoading, setRevenueReportLoading] = React.useState(false);

  // Manual inputs for the report: meter readings and the data-SIM cost (entered by staff).
  const [revenueFormOpen, setRevenueFormOpen] = React.useState(false);
  const [meterStartInput, setMeterStartInput] = React.useState('');
  const [meterEndInput, setMeterEndInput] = React.useState('');
  const [simCostInput, setSimCostInput] = React.useState('5000');
  // "Бусад зардал": any number of extra cost lines, each with a name, amount and optional note.
  type ExtraCostInput = { label: string; amount: string; note?: string };
  const [extraCosts, setExtraCosts] = React.useState<ExtraCostInput[]>([]);
  const addExtraCost = () => setExtraCosts((list) => [...list, { label: 'Бусад зардал', amount: '', note: '' }]);
  const updateExtraCost = (i: number, patch: Partial<ExtraCostInput>) =>
    setExtraCosts((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const removeExtraCost = (i: number) => setExtraCosts((list) => list.filter((_, j) => j !== i));

  const meterStorageKey = (stationId: string) => `eplug.report.meter.${stationId}`;

  function openRevenueForm() {
    if (selectedStation === 'all') return;
    // Last report's end reading is this report's start reading.
    let saved: { end?: string; sim?: string; extra?: ExtraCostInput[] } = {};
    try {
      saved = JSON.parse(localStorage.getItem(meterStorageKey(selectedStation)) ?? '{}');
    } catch {
      saved = {};
    }
    setMeterStartInput(saved.end ?? '');
    setMeterEndInput('');
    setSimCostInput(saved.sim ?? '5000');
    // Recurring costs come back with their names; amounts are kept too so a
    // monthly fixed cost doesn't need retyping.
    setExtraCosts(Array.isArray(saved.extra) ? saved.extra : []);
    setRevenueFormOpen(true);
  }

  const parseNum = (s: string) => {
    const n = Number(s.replace(/[\s,]/g, ''));
    return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
  };
  const meterStart = parseNum(meterStartInput);
  const meterEnd = parseNum(meterEndInput);
  const simCost = parseNum(simCostInput);
  const extraCostItems = extraCosts
    .map((c) => ({ label: c.label.trim(), amount: parseNum(c.amount) ?? 0, note: c.note?.trim() || undefined }))
    .filter((c) => c.label || c.amount);
  const meterError =
    meterStart != null && meterEnd != null && meterEnd < meterStart
      ? 'Эцсийн заалт эхний заалтаас бага байж болохгүй'
      : undefined;

  async function submitRevenueForm(e: React.FormEvent) {
    e.preventDefault();
    if (meterError) return;
    try {
      localStorage.setItem(
        meterStorageKey(selectedStation),
        JSON.stringify({
          end: meterEndInput.trim(),
          sim: simCostInput.trim(),
          extra: extraCosts.filter((c) => c.label.trim() || c.amount.trim()),
        }),
      );
    } catch {
      // Remembering the reading is a convenience only.
    }
    const ok = await handleDownloadRevenueReport({
      meterStart,
      meterEnd,
      simCost,
      extraCosts: extraCostItems,
    });
    if (ok) setRevenueFormOpen(false);
  }

  async function handleDownloadRevenueReport(inputs: {
    meterStart?: number;
    meterEnd?: number;
    simCost?: number;
    extraCosts?: { label: string; amount: number; note?: string }[];
  }): Promise<boolean> {
    if (selectedStation === 'all') return false;
    setRevenueReportLoading(true);
    try {
      const rep = await fetcher<StationSessionsExport>(
        apiUrl('reports/sessions-export', {
          chargePointId: selectedStation,
          from: rangeStart(range.from),
          to: rangeEnd(range.to),
        }),
      );

      const st = rep.station;
      const matchedCp = stationOptions.find((s) => s.id === selectedStation || s.cpId === selectedStation);
      const matchedClient =
        rep.client ||
        matchedCp?.client ||
        (matchedCp?.clientId ? clientOptions.find((c) => c.id === matchedCp.clientId) : null);

      // Bank account for the client's share (Орлого хуваарилалт section).
      const fullClient = matchedClient ? clientOptions.find((c) => c.id === matchedClient.id) : undefined;
      const payoutAccount =
        fullClient?.payoutAccount ?? (data?.client?.id === matchedClient?.id ? data?.client?.payoutAccount : null);

      const params: RevenueReportParams = {
        station: st,
        client: matchedClient
          ? {
              id: matchedClient.id,
              name: matchedClient.name,
              feePercent: (matchedClient as any).feePercent,
              payoutAccount,
            }
          : null,
        from: range.from,
        to: range.to,
        sessionsCount: rep.totals.sessionsCount,
        platformKwh: rep.totals.energyKwh,
        grossRevenue: rep.totals.gross,
        // Entered in the form; any left empty stay blank in Excel for manual entry.
        meterStartReading: inputs.meterStart,
        meterEndReading: inputs.meterEnd,
        otherDirectCosts: inputs.simCost,
        extraCosts: inputs.extraCosts,
      };

      const wb = await buildStationRevenueWorkbook(params, rep.sessions);
      await downloadWorkbook(wb, revenueReportFileName(params));
      toast.success('Орлого хуваарилалтын Excel тайлан амжилттай татагдлаа');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Тайлан татахад алдаа гарлаа');
      return false;
    } finally {
      setRevenueReportLoading(false);
    }
  }

  // Full per-station Excel: every session (no 500-row cap) with driver, payment and e-barimt info.
  const [stationExporting, setStationExporting] = React.useState(false);

  async function exportStationDetailExcel() {
    if (selectedStation === 'all') return;
    setStationExporting(true);
    try {
      const rep = await fetcher<StationSessionsExport>(
        apiUrl('reports/sessions-export', {
          chargePointId: selectedStation,
          from: rangeStart(range.from),
          to: rangeEnd(range.to),
        }),
      );
      if (!rep.sessions.length) {
        toast.info('Сонгосон хугацаанд цэнэглэлт алга');
        return;
      }

      const wb = XLSX.utils.book_new();
      const addSheet = (name: string, rows: ExportCell[][]) =>
        XLSX.utils.book_append_sheet(wb, buildSheet(rows), name);
      const st = rep.station;
      const t = rep.totals;
      const s = rep.sessions;
      const r2 = round2;
      const sum = (f: (x: (typeof s)[number]) => number | null | undefined) =>
        r2(s.reduce((a, x) => a + (f(x) ?? 0), 0));
      const minuteLabel = (m?: number) =>
        m == null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

      // 1. Summary
      addSheet('Хураангуй', [
        ['Станцын нэр', st.name],
        ['Станц ID', st.cpId],
        ['Хаяг', st.address],
        ['Үйлдвэрлэгч / Загвар', [st.vendor, st.model].filter(Boolean).join(' ')],
        ['Серийн дугаар', st.serialNumber],
        ['Хугацаа', `${range.from} — ${range.to}`],
        ['Татсан огноо', formatDateTime(new Date())],
        [],
        ['Цэнэглэлтийн тоо', t.sessionsCount],
        ['Жолоочийн тоо', t.driversCount],
        ['Нийт эрчим хүч (кВтц)', t.energyKwh],
        ['Нийт дүн (₮)', t.gross],
        ['Нийт цэнэглэсэн хугацаа (мин)', s.reduce((a, x) => a + (x.durationMin ?? 0), 0)],
        ['Дундаж эрчим хүч / цэнэглэлт (кВтц)', r2(t.energyKwh / t.sessionsCount)],
        ['Дундаж дүн / цэнэглэлт (₮)', r2(t.gross / t.sessionsCount)],
        [],
        ['Үндсэн тариф (₮/кВтц)', st.tariffPerKwh],
        ...st.tariffZones.map((z) => [
          `${z.name ?? 'Бүс'} (${minuteLabel(z.startMinute)}–${minuteLabel(z.endMinute)})`,
          z.tariffPerKwh ?? '',
        ]),
        ...(rep.contactsMasked ? [[], ['Тайлбар', 'Жолоочийн холбоо барих мэдээллийг нууцалсан']] : []),
      ]);

      // 2. Every session, with a footer total row
      addSheet('Цэнэглэлтүүд', [
        [
          '№', 'Цэнэглэлтийн дугаар', 'Буу', 'Эхэлсэн', 'Дууссан', 'Зарцуулсан хугацаа (мин)',
          'Жолооч', 'Утас', 'И-мэйл', 'Төрөл', 'Карт / ID Tag', 'Машин', 'VIN', 'Батерей (кВтц)',
          'Тоолуур эхлэл (Втц)', 'Тоолуур төгсгөл (Втц)', 'Эрчим хүч (кВтц)', 'Дундаж чадал (кВт)',
          'SoC эхлэл %', 'SoC төгсгөл %', 'Тариф (₮/кВтц)', 'Дүн (₮)',
          'Төлбөрийн хэлбэр', 'Хэтэвчээс (₮)', 'Үлдэгдэл (₮)',
          'Төлбөрийн хэрэгсэл', 'Төлбөрийн төлөв', 'Төлсөн (₮)', 'Буцаалт (₮)',
          'И-баримт', 'И-баримт ID', 'Зогсоосон шалтгаан', 'Алсаас эхлүүлсэн', 'Станцын алдаа',
          'Станцын алдааны код', 'Алдааны тайлбар',
        ],
        ...s.map((x, i) => [
          i + 1, x.id, `Буу ${connectorLetter(x.connectorId)}`, formatDateTime(x.startTimestamp),
          formatDateTime(x.stopTimestamp), x.durationMin, x.driverName, x.driverPhone, x.driverEmail,
          x.driverType, x.idTag, x.vehicle, x.vehicleVin, x.vehicleBatteryKwh, x.meterStartWh,
          x.meterStopWh, x.energyKwh, x.avgPowerKw, x.startSocPercent, x.endSocPercent, x.tariffPerKwh,
          x.cost, paymentMethodLabel(x), x.walletPaid ?? 0, x.balanceAfter ?? '',
          x.paymentProvider, x.paymentStatus, x.paidAmount,
          x.refundAmount, x.ebarimtStatus, x.ebarimtReceiptId, x.stopReason, x.startedRemotely ? 'Тийм' : 'Үгүй',
          x.stationError, x.stationErrorVendorCode ?? '', x.stationErrorTitle ?? '',
        ]),
        [],
        [
          'НИЙТ', `${t.sessionsCount} цэнэглэлт`, '', '', '', sum((x) => x.durationMin), `${t.driversCount} жолооч`,
          '', '', '', '', '', '', '', '', '', t.energyKwh, '', '', '', '', t.gross,
          '', sum((x) => x.walletPaid), '',
          '', '', sum((x) => x.paidAmount), sum((x) => x.refundAmount),
        ],
      ]);

      // Payment method breakdown
      const byMethod = new Map<string, { n: number; kwh: number; gross: number }>();
      for (const x of s) {
        const key = paymentMethodLabel(x);
        const d = byMethod.get(key) ?? { n: 0, kwh: 0, gross: 0 };
        d.n += 1;
        d.kwh += x.energyKwh;
        d.gross += x.cost;
        byMethod.set(key, d);
      }
      addSheet('Төлбөрийн хэлбэр', [
        ['Төлбөрийн хэлбэр', 'Цэнэглэлт', 'Эрчим хүч (кВтц)', 'Дүн (₮)'],
        ...[...byMethod.entries()]
          .sort((a, b) => b[1].gross - a[1].gross)
          .map(([k, d]) => [k, d.n, r2(d.kwh), r2(d.gross)]),
        [],
        ['НИЙТ', t.sessionsCount, t.energyKwh, t.gross],
      ]);

      // 3. Per driver
      const byDriver = new Map<string, { name: string; phone: string; type: string; vehicle: string; n: number; kwh: number; gross: number; first: string; last: string }>();
      for (const x of s) {
        const d = byDriver.get(x.idTag) ?? {
          name: x.driverName, phone: x.driverPhone, type: x.driverType, vehicle: x.vehicle,
          n: 0, kwh: 0, gross: 0, first: x.startTimestamp, last: x.startTimestamp,
        };
        d.n += 1;
        d.kwh += x.energyKwh;
        d.gross += x.cost;
        if (x.vehicle && !d.vehicle) d.vehicle = x.vehicle;
        if (x.startTimestamp < d.first) d.first = x.startTimestamp;
        if (x.startTimestamp > d.last) d.last = x.startTimestamp;
        byDriver.set(x.idTag, d);
      }
      addSheet('Жолоочоор', [
        ['№', 'Карт / ID Tag', 'Жолооч', 'Утас', 'Төрөл', 'Машин', 'Цэнэглэлт', 'Эрчим хүч (кВтц)', 'Дүн (₮)', 'Анхны', 'Сүүлийн'],
        ...[...byDriver.entries()]
          .sort((a, b) => b[1].kwh - a[1].kwh)
          .map(([tag, d], i) => [
            i + 1, tag, d.name, d.phone, d.type, d.vehicle, d.n, r2(d.kwh), r2(d.gross),
            formatDateTime(d.first), formatDateTime(d.last),
          ]),
        [],
        ['НИЙТ', `${byDriver.size} жолооч`, '', '', '', '', t.sessionsCount, t.energyKwh, t.gross],
      ]);

      // 4. Per day (local time)
      const byDay = new Map<string, { n: number; kwh: number; gross: number }>();
      for (const x of s) {
        const day = formatDateTime(x.stopTimestamp ?? x.startTimestamp).slice(0, 10);
        const d = byDay.get(day) ?? { n: 0, kwh: 0, gross: 0 };
        d.n += 1;
        d.kwh += x.energyKwh;
        d.gross += x.cost;
        byDay.set(day, d);
      }
      addSheet('Өдрөөр', [
        ['Огноо', 'Цэнэглэлт', 'Эрчим хүч (кВтц)', 'Дүн (₮)'],
        ...[...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, d]) => [day, d.n, r2(d.kwh), r2(d.gross)]),
        [],
        ['НИЙТ', t.sessionsCount, t.energyKwh, t.gross],
      ]);

      const safeName = (st.cpId || 'station').replace(/[^\w-]+/g, '_');
      XLSX.writeFile(wb, `eplug-${safeName}-${range.from}-to-${range.to}.xlsx`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Тайлан татахад алдаа гарлаа');
    } finally {
      setStationExporting(false);
    }
  }

  return (
    <div className="space-y-4">

      <StatGrid min="11rem">
        <StatCard label="Нийт борлуулалт (брутто)" value={formatMoney(totals?.gross)} sub="Жолоочийн төлсөн нийт" icon={Coins} tone="brand" />
        <StatCard label="Хэрэглэгчийн цэвэр орлого" value={formatMoney(totals?.net)} sub="Шимтгэл хассан дүн" icon={User} tone="ok" />
        <StatCard
          label="Eplug үйлчилгээний шимтгэл"
          value={formatMoney(totals?.fee)}
          sub={`${avgFeePercent}% үйлчилгээний хувь`}
          icon={ShieldCheck}
          tone="info"
        />
        <StatCard
          label="Нийлүүлсэн эрчим хүч"
          value={`${formatNumber(totals?.energyKwh, 2)} кВтц`}
          sub="Сонгосон хугацаанд"
          icon={Zap}
          tone="warn"
        />
        <StatCard
          label="Төлбөрийн үлдэгдэл"
          value={formatMoney(totals?.outstanding ?? totals?.net ?? 0)}
          sub="Шилжүүлэх боломжтой"
          icon={CreditCard}
          tone="idle"
        />
      </StatGrid>

      {byPaymentMethod.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
            <span className="text-xs font-semibold text-[var(--color-fg)]">Төлбөрийн хэлбэрээр</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {byPaymentMethod.map((m) => (
              <div
                key={m.method}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-2.5 py-1.5"
              >
                <PaymentMethodBadge session={{ paymentMethod: m.method }} />
                <span className="text-[11px] text-[var(--color-fg-muted)]">{formatNumber(m.sessionsCount)} удаа</span>
                <span className="font-mono text-xs font-semibold text-[var(--color-fg)]">{formatMoney(m.gross)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <PageToolbar>
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
      </PageToolbar>

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

        {sessionsTruncated && (
          <div className="mx-3 mt-3 rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)] px-3 py-2 text-[11px] text-[var(--color-warn)]">
            Хугацаанд {formatNumber(totals?.sessionsCount)} цэнэглэлт байгаа тул сүүлийн {formatNumber(sessions.length)}-г
            харууллаа. Бүтэн түүхийг станц сонгоод &quot;Станцын дэлгэрэнгүй Excel&quot;-ээр татна уу.
          </div>
        )}

        {/* Sub-toolbar: Search, Date quick chips, and Excel export */}
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

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            {/* Active Tab Excel Export */}
            <Button
              variant="primary"
              size="sm"
              onClick={exportActiveTabExcel}
              disabled={
                activeTab === 'stations'
                  ? !rawStations.length
                  : activeTab === 'daily'
                    ? !daily.length
                    : activeTab === 'connectors'
                      ? !connectors.length
                      : !sessions.length
              }
              className="text-xs h-8 font-medium gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              title={`${
                activeTab === 'stations'
                  ? 'Станцын тайлан'
                  : activeTab === 'daily'
                    ? 'Өдрийн хөдөлгөөн'
                    : activeTab === 'connectors'
                      ? 'Холбогч бүрээр'
                      : 'Цэнэглэлтийн лог'
              }-г Excel (.xlsx) татах`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel татах
            </Button>

            {/* Full per-station export with drivers */}
            <Button
              variant="secondary"
              size="sm"
              onClick={exportStationDetailExcel}
              disabled={selectedStation === 'all' || stationExporting}
              className="text-xs h-8 font-medium gap-1"
              title={
                selectedStation === 'all'
                  ? 'Эхлээд станц сонгоно уу'
                  : 'Сонгосон станцын бүх цэнэглэлт, жолоочийн мэдээлэл, төлбөрийг Excel-ээр татах'
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {stationExporting ? 'Бэлдэж байна…' : 'Станцын дэлгэрэнгүй Excel'}
            </Button>

            {/* Station Revenue Allocation Report */}
            <Button
              variant="secondary"
              size="sm"
              onClick={openRevenueForm}
              disabled={selectedStation === 'all' || revenueReportLoading}
              className={cn(
                'text-xs h-8 font-medium gap-1 transition-all',
                selectedStation !== 'all'
                  ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-semibold shadow-xs'
                  : '',
              )}
              title={
                selectedStation === 'all'
                  ? 'Эхлээд станц сонгоно уу'
                  : 'EV цэнэглэх станцын орлого хуваарилалтын тайлан татах (.xlsx)'
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              {revenueReportLoading ? 'Бэлдэж байна…' : 'Тайлан'}
            </Button>
          </div>
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
                      <TH className="text-center">Цэнэглэлт</TH>
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
                                    aria-label="Цэнэглэлтүүдийг дэлгэрүүлэх"
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
                              <TD align="center" className="text-center font-medium">
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
                                          &quot;{s.name}&quot; станцын цэнэглэлтүүд ({stationSessions.length})
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-[var(--color-fg-muted)]">
                                        Нийт {formatMoney(s.gross)} борлуулалтын нарийвчилсан задаргаа
                                      </span>
                                    </div>

                                    {stationSessions.length === 0 ? (
                                      <div className="py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                                        Энэ хугацаанд цэнэглэлт бүртгэгдээгүй байна.
                                      </div>
                                    ) : (
                                      <div className="overflow-auto max-h-[28rem] overscroll-contain rounded-lg border border-[var(--color-border)]">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="sticky top-0 z-10 border-b border-[var(--color-border)] text-[11px] text-[var(--color-fg-subtle)] font-medium bg-[var(--color-surface)] shadow-[0_1px_0_var(--color-border)]">
                                              <th className="py-1.5 px-2.5 w-10 text-center border-r border-[var(--color-border)]">№</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Цэнэглэлтийн дугаар</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Холбогч</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Утас</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Эхэлсэн хугацаа</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Дууссан хугацаа</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Зарцуулсан хугацаа</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Эрчим хүч</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Тариф</th>
                                              <th className="text-center py-1.5 px-2.5 font-semibold border-r border-[var(--color-border)]">Борлуулалт</th>
                                              <th className="text-center py-1.5 px-2.5 text-blue-500 border-r border-[var(--color-border)]">Шимтгэл</th>
                                              <th className="text-center py-1.5 px-2.5 font-bold text-emerald-600 dark:text-emerald-400 border-r border-[var(--color-border)]">Цэвэр орлого</th>
                                              <th className="text-center py-1.5 px-2.5 border-r border-[var(--color-border)]">Төлбөрийн хэлбэр</th>
                                              <th className="text-center py-1.5 px-2.5">Үлдэгдэл</th>
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
                                                  <DriverCell session={tx} />
                                                </td>
                                                <td className="py-1.5 px-2.5 text-[11px] text-[var(--color-fg-muted)] border-r border-[var(--color-border)] whitespace-nowrap">
                                                  {formatDateTime(tx.startTimestamp)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-[11px] text-[var(--color-fg-muted)] border-r border-[var(--color-border)] whitespace-nowrap">
                                                  {formatDateTime(tx.stopTimestamp)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center text-[11px] font-medium text-[var(--color-fg)] border-r border-[var(--color-border)] whitespace-nowrap">
                                                  {durationText(tx.startTimestamp, tx.stopTimestamp)}
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
                                                <td className="py-1.5 px-2.5 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 border-r border-[var(--color-border)]">
                                                  {formatMoney(tx.clientNet)}
                                                </td>
                                                <td className="py-1.5 px-2.5 border-r border-[var(--color-border)]">
                                                  <PaymentMethodBadge session={tx} />
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono text-xs">
                                                  {balanceText(tx)}
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
                          <div className="text-[10px] text-[var(--color-fg-subtle)] uppercase">Цэнэглэлт</div>
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
                            Цэнэглэлтүүдийг нуух ({stationSessions.length})
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-3.5 w-3.5" />
                            Цэнэглэлтүүдийг харах ({stationSessions.length})
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
                                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-fg-subtle)]">
                                  <span>{formatDateTime(tx.startTimestamp)}</span>
                                  <PaymentMethodBadge session={tx} />
                                </div>
                                <DriverCell session={tx} />
                                {tx.balanceAfter != null && (
                                  <div className="flex justify-between text-[11px] text-[var(--color-fg-muted)]">
                                    <span>Үлдэгдэл:</span>
                                    <span className="font-mono">{balanceText(tx)}</span>
                                  </div>
                                )}
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
                  <TH className="w-28 text-center whitespace-nowrap">Цэнэглэлтийн дугаар</TH>
                  <TH>Станц / Холбогч</TH>
                  <TH>Утас</TH>
                  <TH>Хугацаа</TH>
                  <TH className="text-right">Хэрэглээ</TH>
                  <TH className="text-right">Тариф</TH>
                  <TH className="text-right font-semibold">Борлуулалт</TH>
                  <TH className="text-right text-blue-500">Шимтгэл</TH>
                  <TH className="text-right font-bold text-emerald-600 dark:text-emerald-400">Цэвэр орлого</TH>
                  <TH>Төлбөрийн хэлбэр</TH>
                  <TH className="text-right">Үлдэгдэл</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading && !data ? (
                  <TableLoading colSpan={12} />
                ) : sessions.length === 0 ? (
                  <TableEmpty colSpan={12}>Цэнэглэлтийн лог олдсонгүй.</TableEmpty>
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
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-[var(--color-fg-subtle)] font-mono mt-0.5">
                          <span>Буу {connectorLetter(tx.connectorId)}</span>
                          {tx.vehicleModel ? (
                            <>
                              <span>·</span>
                              <span>{tx.vehicleModel}</span>
                            </>
                          ) : null}
                        </div>
                      </TD>
                      <TD align="left">
                        <DriverCell session={tx} />
                      </TD>
                      <TD align="left" className="text-xs">
                        <div>{formatDateTime(tx.startTimestamp)}</div>
                        <div className="text-[10px] text-[var(--color-fg-subtle)]">
                          {formatDateTime(tx.stopTimestamp)}
                        </div>
                        <div className="text-[10px] font-medium text-[var(--color-fg-muted)]">
                          {durationText(tx.startTimestamp, tx.stopTimestamp)}
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
                      <TD align="left">
                        <PaymentMethodBadge session={tx} />
                      </TD>
                      <TD className="text-right font-mono text-xs">{balanceText(tx)}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={revenueFormOpen}
        onClose={() => setRevenueFormOpen(false)}
        title="Тайлан татах"
        description={`${
          stationOptions.find((s) => s.id === selectedStation)?.name ?? ''
        } · ${range.from} — ${range.to}`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setRevenueFormOpen(false)}>
              Болих
            </Button>
            <Button
              type="submit"
              form="revenue-report-form"
              disabled={revenueReportLoading || !!meterError}
              className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {revenueReportLoading ? 'Бэлдэж байна…' : 'Excel татах'}
            </Button>
          </>
        }
      >
        <form id="revenue-report-form" onSubmit={submitRevenueForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Тоолуурын эхний заалт" htmlFor="meter-start" hint="Өмнөх тайлангийн эцсийн заалт">
              <Input
                id="meter-start"
                inputMode="decimal"
                value={meterStartInput}
                onChange={(e) => setMeterStartInput(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Тоолуурын эцсийн заалт" htmlFor="meter-end" error={meterError}>
              <Input
                id="meter-end"
                inputMode="decimal"
                value={meterEndInput}
                onChange={(e) => setMeterEndInput(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </Field>
          </div>
          <Field label="Дата сим тогтмол зардал (₮)" htmlFor="sim-cost">
            <Input
              id="sim-cost"
              inputMode="numeric"
              value={simCostInput}
              onChange={(e) => setSimCostInput(e.target.value)}
              placeholder="5000"
            />
          </Field>
          {/* Each added cost is its own field: a title you can rename, then the amount. */}
          {extraCosts.map((c, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                {/* Looks like an editable chip (pencil + dashed box) so it's clear the name can be changed. */}
                <label className="group inline-flex min-w-0 max-w-[80%] cursor-text items-center gap-1.5 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-2 py-1 hover:border-[var(--color-brand)] focus-within:border-solid focus-within:border-[var(--color-brand)]">
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-muted)] group-hover:text-[var(--color-brand)]" aria-hidden="true" />
                  <input
                    aria-label={`Зардал ${i + 1}-ийн нэр`}
                    title="Нэрийг өөрчлөх"
                    value={c.label}
                    onChange={(e) => updateExtraCost(i, { label: e.target.value })}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder="Зардлын нэр"
                    size={Math.max(4, (c.label || 'Зардлын нэр').length)}
                    className="min-w-0 bg-transparent text-sm font-medium text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
                  />
                </label>
                <span className="shrink-0 text-sm font-medium text-[var(--color-fg)]">(₮)</span>
                <button
                  type="button"
                  onClick={() => removeExtraCost(i)}
                  aria-label="Устгах"
                  className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-[var(--color-fg-muted)] hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input
                aria-label={`${c.label || 'Бусад зардал'} дүн`}
                inputMode="numeric"
                value={c.amount}
                onChange={(e) => updateExtraCost(i, { amount: e.target.value })}
                placeholder="0"
                autoFocus={i === extraCosts.length - 1 && !c.amount}
              />
              <Input
                aria-label={`${c.label || 'Бусад зардал'} тайлбар`}
                value={c.note ?? ''}
                onChange={(e) => updateExtraCost(i, { note: e.target.value })}
                placeholder="Тайлбар (заавал биш) — Excel-ийн «Тайлбар» баганад орно"
                className="h-8 text-xs"
              />
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addExtraCost} className="w-full gap-1 border-dashed">
            <Plus className="h-3.5 w-3.5" />
            Бусад зардал нэмэх
          </Button>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-3 py-2 text-xs text-[var(--color-fg-muted)]">
            Тоолуурын хэрэглээ:{' '}
            <span className="font-mono font-semibold text-[var(--color-fg)]">
              {meterStart != null && meterEnd != null && !meterError
                ? `${formatNumber((meterEnd - meterStart) * 60 * 1.025, 2)} кВтц`
                : '—'}
            </span>
            <span className="ml-1">= (эцсийн − эхний) × 60 × 1.025</span>
            <div className="mt-1">Хоосон үлдээвэл Excel дээр гараар оруулж болно.</div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
