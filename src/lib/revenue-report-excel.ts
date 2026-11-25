/**
 * «EV ЦЭНЭГЛЭХ СТАНЦЫН ТАЙЛАН» — per-station revenue report workbook.
 *
 * Mirrors the operator's hand-built template (e.g. "МЕТА ТАЙЛАН_2026-10-23 - 2026-11-12"):
 *
 *   1. Хураангуй             — report info, electricity bill from meter readings, platform
 *                               figures, costs, revenue split per recipient, reconciliation.
 *   2. Шинжилгээ             — by connector, by tariff, operating KPIs, by day.
 *   3. Цэнэглэлт_дэлгэрэнгүй — one row per completed charge.
 *
 * Every derived number is a live Excel formula pointing back at the session sheet or at
 * the input cells (meter readings, tariffs, shares), so staff only type the meter
 * readings and Excel recalculates the rest.
 */
import ExcelJS from 'exceljs';
import { connectorLetter } from './format';

export interface RevenueReportStation {
  id: string;
  cpId: string;
  name: string;
  address?: string;
  vendor?: string;
  model?: string;
  serialNumber?: string;
  tariffPerKwh?: number | null;
}

export interface RevenueReportClient {
  id?: string;
  name?: string;
  businessRegister?: string | null;
  feePercent?: number | null;
  /** Where the client's share is paid (Банк / Төлбөр хүлээн авах данс). */
  payoutAccount?: { bankName?: string; accountNumber?: string } | null;
}

export interface RevenueReportSessionItem {
  id: number;
  connectorId: number;
  /** Optional short station name when multiple stations are combined into one united report. */
  stationLabel?: string;
  idTag: string;
  driverName?: string;
  driverPhone?: string;
  driverEmail?: string;
  driverType?: string;
  vehicle?: string;
  vehicleVin?: string;
  vehicleBatteryKwh?: number | null;
  startTimestamp: string;
  stopTimestamp?: string | null;
  durationMin?: number | null;
  meterStartWh?: number;
  meterStopWh?: number | null;
  energyKwh: number;
  avgPowerKw?: number | null;
  startSocPercent?: number | null;
  endSocPercent?: number | null;
  tariffPerKwh?: number | null;
  cost: number;
  feePercent?: number;
  feeAmount?: number;
  clientNet?: number;
  paymentProvider?: string;
  paymentStatus?: string;
  paidAmount?: number | null;
  refundAmount?: number | null;
  ebarimtStatus?: string;
  ebarimtReceiptId?: string;
  stopReason?: string;
}

export interface SingleTierMeterConfig {
  type: 'single';
  label?: string;
  startReading?: number;
  endReading?: number;
  ctCoefficient?: number;
  basePrice?: number;
  cosPhiLoss?: number;
  capacityChargeFormula?: string;
  renewablePerKwh?: number;
}

export interface ThreeTierMeterConfig {
  type: 'three_tier';
  label?: string;
  ctCoefficient?: number;
  dayStart?: number;
  dayEnd?: number;
  peakStart?: number;
  peakEnd?: number;
  nightStart?: number;
  nightEnd?: number;
  dayPrice?: number;
  peakPrice?: number;
  nightPrice?: number;
  peakPowerCoeff?: number;
  peakCapacityPrice?: number;
  vatRate?: number;
}

export type RevenueReportMeter = SingleTierMeterConfig | ThreeTierMeterConfig;

export interface RevenueReportRecipient {
  name: string;
  bank?: string;
  account?: string;
  share: number;
}

export interface RevenueReportParams {
  station: RevenueReportStation;
  client?: RevenueReportClient | null;
  /** Separate site owner (Талбай эзэмшигч); defaults to client.name when omitted. */
  siteOwnerName?: string;
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD"
  /** Optional explicit report period start/end timestamps (e.g. carried over from previous report). */
  periodStartOverride?: string;
  periodEndOverride?: string;
  sessionsCount: number;
  platformKwh: number;
  grossRevenue: number;
  /** Dynamic list of 1, 2, 3... meters (each single-tariff or 3-tier Өдөр/Оргил/Шөнө). */
  meters?: RevenueReportMeter[];
  /** Legacy single-meter fields (used when `meters` is not supplied). */
  meterStartReading?: number;
  meterEndReading?: number;
  /** Not used by this layout (the bill is computed from meter readings); kept for callers. */
  meterKwh?: number;
  electricityCost?: number;
  meterDate?: string; // "YYYY-MM-DD" or "YYYY-MM-DD HH:mm"
  meterTime?: string; // "HH:mm:ss" or "HH:mm"
  /** Explicit recipients list for Section 5 (Орлого хуваарилалт). */
  recipients?: RevenueReportRecipient[];
  /** Client's share of distributable revenue, e.g. 0.8. Defaults to 1 − feePercent. */
  clientShare?: number;
  /** Payment-provider fee as a fraction of revenue, e.g. 0.01. */
  qpayRate?: number;
  otherDirectCosts?: number;
  /** Extra cost lines (Бусад зардал), each its own row under the data-SIM cost. */
  extraCosts?: { label: string; amount: number; note?: string }[];
  reportNumber?: string;
  operatorName?: string;
  platformName?: string;
  notes?: string;
  /** When the report is generated; defaults to now. */
  generatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Defaults taken from the operator's template. Every one lands in an editable cell.
// ---------------------------------------------------------------------------

const DEFAULTS = {
  operatorName: 'Монголын Цэвэр Тээвэр Суурь Бүтцийн Хөгжлийн Холбоо ТББ',
  platformName: 'Eplug.mn',
  ctCoefficientLabel: '300A/5 гүйдлийн транс-ын Коэффициент',
  ctCoefficient: 60,
  basePricePerKwh: 278,
  cosPhiLoss: 0.15,
  capacityChargeFormula: '16275*1.1',
  renewablePerKwh: 23.79,
  qpayRate: 0.01,
  otherDirectCost: 5000,
  otherDirectCostLabel: 'Дата сим тогтмол зардал',
  note: 'Хуваарилагдах орлого* Ногдох хувь. Гэрээний дагуу батлав.',
};

/** Eplug's side of the split; they share whatever the client does not get, by weight. */
const PLATFORM_RECIPIENTS = [
  { name: 'ЖИРКТО ХХК /IT платформ/', bank: 'Голомт', account: '88001500 2255103877', weight: 0.5 },
  { name: 'СЕКУОИА ИНДАСТРИАЛ ХХК /Засвар үйлчилгээ/', bank: 'Хаан', account: '5111748965', weight: 0.5 },
];

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

const GREEN = 'FF1F6B52';
const GREEN_DARK = 'FF0F6351';
const TEXT = 'FF1F2A28';
const MUTED = 'FF6B7A77';
const TOTAL_BG = 'FFEEF3F1';
const WHITE = 'FFFFFFFF';
const FONT = 'Arial';

const FMT = {
  money: '#,##0.00 ₮;-#,##0.00 ₮;-',
  moneyInt: '#,##0 ₮;-#,##0 ₮;-',
  num2: '#,##0.00;-#,##0.00;-',
  int: '0',
  intSep: '#,##0',
  pct: '0%',
  pct1: '0.0%',
  pct1Signed: '0.0%;-0.0%;-',
  dateTime: 'yyyy-mm-dd hh:mm:ss',
  date: 'yyyy-mm-dd',
  time: 'hh:mm:ss',
  perKwh: '#,##0.0 ₮',
};

type Align = ExcelJS.Alignment['horizontal'];

interface CellOpts {
  bold?: boolean;
  size?: number;
  color?: string;
  bg?: string;
  fmt?: string;
  align?: Align;
  wrap?: boolean;
  indent?: number;
  border?: boolean;
  italic?: boolean;
}

const thin = { style: 'thin' as const, color: { argb: 'FF000000' } };
const hair = { style: 'hair' as const, color: { argb: 'FF000000' } };

function put(ws: ExcelJS.Worksheet, addr: string, value: ExcelJS.CellValue, o: CellOpts = {}) {
  const c = ws.getCell(addr);
  if (value !== undefined) c.value = value;
  c.font = { name: FONT, size: o.size ?? 10, bold: o.bold, italic: o.italic, color: { argb: o.color ?? TEXT } };
  if (o.bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.bg } };
  if (o.fmt) c.numFmt = o.fmt;
  c.alignment = { vertical: 'middle', horizontal: o.align, wrapText: o.wrap, indent: o.indent };
  if (o.border) c.border = { left: thin, right: thin, top: hair, bottom: hair };
  return c;
}

/** Merge a range and style every cell in it (so borders/fills cover the whole block). */
function putMerged(ws: ExcelJS.Worksheet, range: string, value: ExcelJS.CellValue, o: CellOpts = {}) {
  ws.mergeCells(range);
  const [a, b] = range.split(':');
  const s = ws.getCell(a);
  const e = ws.getCell(b);
  for (let r = Number(s.row); r <= Number(e.row); r++) {
    for (let col = Number(s.col); col <= Number(e.col); col++) {
      put(ws, ws.getCell(r, col).address, undefined, o);
    }
  }
  ws.getCell(a).value = value;
}

const header = (o: CellOpts = {}): CellOpts => ({
  bold: true,
  color: WHITE,
  bg: GREEN,
  align: 'center',
  wrap: true,
  border: true,
  ...o,
});
const label = (o: CellOpts = {}): CellOpts => ({ align: 'left', border: true, indent: 1, ...o });
const val = (o: CellOpts = {}): CellOpts => ({ align: 'right', border: true, ...o });
const total = (o: CellOpts = {}): CellOpts => ({ bold: true, bg: TOTAL_BG, border: true, ...o });

function sectionTitle(ws: ExcelJS.Worksheet, addr: string, text: string, color = GREEN) {
  put(ws, addr, text, { bold: true, size: 12, color });
  ws.getRow(Number(ws.getCell(addr).row)).height = 15.6;
}

function f(formula: string, result?: ExcelJS.CellFormulaValue['result']): ExcelJS.CellFormulaValue {
  return { formula, result } as ExcelJS.CellFormulaValue;
}

// ---------------------------------------------------------------------------
// Dates: Excel has no time zone, so write the viewer's wall-clock time.
// ---------------------------------------------------------------------------

function excelLocal(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000);
}

/** Local calendar day as a whole Excel date (matches =INT(datetime) on the session sheet). */
function excelDay(d: Date | string): Date {
  const t = new Date(d);
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Shared derived data
// ---------------------------------------------------------------------------

export const SESSION_SHEET = 'Цэнэглэлт_дэлгэрэнгүй';
const REF = `'${SESSION_SHEET}'!`;

/** The selected station's name, e.g. "Зайсан Хилл Комплекс Баруун", safe for a file name. */
function reportCode(st: RevenueReportStation): string {
  return (st.name || st.cpId || 'Станц')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** File name in the template's style: "META ТАЙЛАН_2026-10-23 - 2026-11-12 (09.58AM).xlsx". */
export function revenueReportFileName(params: RevenueReportParams): string {
  const now = params.generatedAt ?? new Date();
  const h = now.getHours();
  const time = `${String(h % 12 || 12).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`;
  return `${reportCode(params.station)} ТАЙЛАН_${params.from} - ${params.to} (${time}).xlsx`;
}

interface Ctx {
  params: RevenueReportParams;
  sessions: RevenueReportSessionItem[];
  /** First and last data row on the session sheet (empty range when there are no sessions). */
  first: number;
  last: number;
  col: (letter: string) => string;
  generatedAt: Date;
  periodEnd: Date;
  firstStart: Date | null;
  lastStop: Date | null;
  totals: { kwh: number; gross: number; minutes: number; refund: number };
}

function buildCtx(params: RevenueReportParams, sessions: RevenueReportSessionItem[]): Ctx {
  const sorted = [...sessions].sort((a, b) => a.startTimestamp.localeCompare(b.startTimestamp));
  const first = 4;
  const last = 3 + Math.max(sorted.length, 1);
  const generatedAt = params.generatedAt ?? new Date();
  const toEnd = parseYmd(params.to);
  toEnd.setHours(23, 59, 59, 0);
  const periodEnd = generatedAt < toEnd ? generatedAt : toEnd;
  const stops = sorted.map((s) => s.stopTimestamp).filter(Boolean) as string[];
  return {
    params,
    sessions: sorted,
    first,
    last,
    col: (l) => `${REF}$${l}$${first}:$${l}$${last}`,
    generatedAt,
    periodEnd,
    firstStart: sorted[0] ? new Date(sorted[0].startTimestamp) : null,
    lastStop: stops.length ? new Date(stops.sort().at(-1)!) : null,
    totals: {
      kwh: round2(sorted.reduce((a, s) => a + (s.energyKwh || 0), 0)),
      gross: round2(sorted.reduce((a, s) => a + (s.cost || 0), 0)),
      minutes: sorted.reduce((a, s) => a + (s.durationMin ?? 0), 0),
      refund: round2(sorted.reduce((a, s) => a + (s.refundAmount ?? 0), 0)),
    },
  };
}

// ---------------------------------------------------------------------------
// Sheet 1 — Хураангуй
// ---------------------------------------------------------------------------

const THREE_TIER_DEFAULTS = {
  ctCoefficient: 40,
  dayPrice: 278,
  peakPrice: 417,
  nightPrice: 168,
  peakPowerCoeff: 150,
  peakCapacityPrice: 16275,
  vatRate: 0.1,
};

function parseMeterDate(dateStr: string | undefined, fallback: Date): Date {
  if (!dateStr) return excelDay(fallback);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!m) return excelDay(fallback);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function parseMeterTime(timeStr: string | undefined, dateStr: string | undefined, fallback: Date): Date {
  const src = timeStr?.trim() || (dateStr?.includes(' ') ? dateStr.split(' ')[1]?.trim() : '');
  if (src) {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(src);
    if (m) {
      return new Date(Date.UTC(1899, 11, 30, Number(m[1]), Number(m[2]), Number(m[3] ?? 0)));
    }
  }
  return new Date(Date.UTC(1899, 11, 30, fallback.getHours(), fallback.getMinutes(), fallback.getSeconds()));
}

function buildSummarySheet(wb: ExcelJS.Workbook, ctx: Ctx) {
  const { params, totals } = ctx;
  const st = params.station;
  const ws = wb.addWorksheet('Хураангуй', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.2, header: 0.3, footer: 0.3 },
    },
  });
  ws.views = [{ showGridLines: false }];
  ws.columns = [{ width: 35.66 }, { width: 17.55 }, { width: 11 }, { width: 30.66 }, { width: 17.55 }];

  const clientName = params.client?.name || 'Станц эзэмшигч';
  const siteOwnerName = params.siteOwnerName?.trim() || clientName;
  const fromDate = parseYmd(params.from);
  const reportNumber =
    params.reportNumber ||
    `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;
  const periodStartDate = params.periodStartOverride ? new Date(params.periodStartOverride) : (ctx.firstStart ?? fromDate);
  const periodEndDate = params.periodEndOverride ? new Date(params.periodEndOverride) : (ctx.lastStop ?? ctx.periodEnd);

  // Title
  putMerged(ws, 'A1:E1', 'EV ЦЭНЭГЛЭХ СТАНЦЫН ТАЙЛАН', {
    bold: true,
    size: 16,
    color: WHITE,
    bg: GREEN,
    align: 'left',
    indent: 1,
    border: true,
  });
  ws.getRow(1).height = 26.4;
  ws.getRow(2).height = 6;

  // 1. Тайлангийн мэдээлэл ---------------------------------------------------
  sectionTitle(ws, 'A3', '1. Тайлангийн мэдээлэл');
  put(ws, 'A4', 'Үзүүлэлт', header());
  putMerged(ws, 'B4:E4', 'Утга', header());
  ws.getRow(4).height = 22.05;

  put(ws, 'A5', 'Станц', label({ bold: true }));
  putMerged(ws, 'B5:E5', st.name || st.cpId, label({ bold: true }));
  put(ws, 'A6', 'Байршил', label({ bold: true }));
  putMerged(ws, 'B6:E6', st.address || '', label());
  put(ws, 'A7', 'Тайлангийн дугаар', label({ bold: true }));
  putMerged(ws, 'B7:E7', reportNumber, label());

  putMerged(ws, 'A8:A9', 'Тайлант хугацаа', label({ bold: true }));
  putMerged(ws, 'B8:C8', 'Эхлэх огноо цаг', val());
  putMerged(ws, 'D8:E8', excelLocal(periodStartDate), label({ fmt: FMT.dateTime }));
  putMerged(ws, 'B9:C9', 'Дуусах огноо цаг', val());
  putMerged(ws, 'D9:E9', excelLocal(periodEndDate), label({ fmt: FMT.dateTime }));

  putMerged(ws, 'A10:A11', 'Тайлан хүлээн авагч', label({ bold: true }));
  putMerged(ws, 'B10:C10', 'Станц эзэмшигч', val());
  putMerged(ws, 'D10:E10', clientName, label());
  putMerged(ws, 'B11:C11', 'Талбай эзэмшигч', val());
  putMerged(ws, 'D11:E11', siteOwnerName === clientName ? f('D10', clientName) : siteOwnerName, label());

  put(ws, 'A12', 'Оператор', label({ bold: true }));
  putMerged(ws, 'B12:E12', params.operatorName || DEFAULTS.operatorName, label());
  put(ws, 'A13', 'Платформ', label({ bold: true }));
  putMerged(ws, 'B13:E13', params.platformName || DEFAULTS.platformName, label());
  ws.getRow(14).height = 9;

  // 2. Эрчим хүчний төлбөрийн тооцоолол (Dynamic: 1, 2, 3... meters; single or 3-tier)
  sectionTitle(ws, 'A15', '2. Эрчим хүчний төлбөрийн тооцоолол');
  put(ws, 'A16', 'Үзүүлэлт', header());
  put(ws, 'B16', 'Утга', header());
  putMerged(ws, 'C16:D16', 'Тайлбар', header());
  put(ws, 'E16', 'Утга 1', header());
  ws.getRow(16).height = 22.05;

  const meterDay = parseMeterDate(params.meterDate, ctx.periodEnd);
  const meterTime = parseMeterTime(params.meterTime, params.meterDate, ctx.periodEnd);
  put(ws, 'A17', 'Тоолуурын заалтын огноо', label());
  put(ws, 'B17', meterDay, val({ fmt: FMT.date }));
  putMerged(ws, 'C17:D17', '', label());
  put(ws, 'E17', null, val());
  put(ws, 'A18', 'Тоолуурын заалтын цаг, минут', label());
  put(ws, 'B18', meterTime, val({ fmt: FMT.time }));
  putMerged(ws, 'C18:D18', '', label());
  put(ws, 'E18', null, val());

  const meters: RevenueReportMeter[] =
    params.meters && params.meters.length > 0
      ? params.meters
      : [
          {
            type: 'single',
            startReading: params.meterStartReading,
            endReading: params.meterEndReading,
          },
        ];

  let curRow = 19;
  const meterKwhCells: string[] = [];
  const meterCostCells: string[] = [];
  const hasMultipleMeters = meters.length > 1;

  meters.forEach((meter, idx) => {
    const meterTitle = meter.label?.trim() || `Тоолуур ${idx + 1}`;
    if (meter.type === 'three_tier') {
      // 3-tier meter: Өдөр / Оргил / Шөнө
      const hdrRow = curRow;
      put(ws, `A${hdrRow}`, hasMultipleMeters ? `${meterTitle} (Өдөр/Оргил/Шөнө)` : 'Тоолуурын хэрэглээ', total({ align: 'left', indent: 1 }));
      put(ws, `B${hdrRow}`, 'Өдөр', total({ align: 'center' }));
      put(ws, `C${hdrRow}`, 'Оргил', total({ align: 'center' }));
      put(ws, `D${hdrRow}`, 'Шөнө', total({ align: 'center' }));
      put(ws, `E${hdrRow}`, 'НИЙТ', total({ align: 'center' }));
      curRow++;

      const rStart = curRow++;
      const rEnd = curRow++;
      const rDiff = curRow++;
      const rCoeff = curRow++;
      const rKwh = curRow++;
      const rTariff = curRow++;
      const rEnergyCost = curRow++;
      const rPeakCoeff = curRow++;
      const rCapTariff = curRow++;
      const rCapCost = curRow++;
      const rSubTotal = curRow++;
      const rVat = curRow++;
      const rTotal = curRow++;

      const ctCoeff = meter.ctCoefficient ?? THREE_TIER_DEFAULTS.ctCoefficient;
      const dayP = meter.dayPrice ?? THREE_TIER_DEFAULTS.dayPrice;
      const peakP = meter.peakPrice ?? THREE_TIER_DEFAULTS.peakPrice;
      const nightP = meter.nightPrice ?? THREE_TIER_DEFAULTS.nightPrice;
      const peakPowerCoeff = meter.peakPowerCoeff ?? THREE_TIER_DEFAULTS.peakPowerCoeff;
      const peakCapPrice = meter.peakCapacityPrice ?? THREE_TIER_DEFAULTS.peakCapacityPrice;
      const vatRate = meter.vatRate ?? THREE_TIER_DEFAULTS.vatRate;

      put(ws, `A${rStart}`, 'Эхний заалт', label());
      put(ws, `B${rStart}`, meter.dayStart ?? 0, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
      put(ws, `C${rStart}`, meter.peakStart ?? 0, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
      put(ws, `D${rStart}`, meter.nightStart ?? 0, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
      put(ws, `E${rStart}`, f(`SUM(B${rStart}:D${rStart})`), val({ fmt: FMT.num2 }));

      put(ws, `A${rEnd}`, 'Эцсийн заалт', label());
      put(ws, `B${rEnd}`, meter.dayEnd ?? 0, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
      put(ws, `C${rEnd}`, meter.peakEnd ?? 0, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
      put(ws, `D${rEnd}`, meter.nightEnd ?? 0, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
      put(ws, `E${rEnd}`, null, val());

      put(ws, `A${rDiff}`, 'Тоолуурын заалт', label());
      put(ws, `B${rDiff}`, f(`B${rEnd}-B${rStart}`), val({ fmt: FMT.num2 }));
      put(ws, `C${rDiff}`, f(`C${rEnd}-C${rStart}`), val({ fmt: FMT.num2 }));
      put(ws, `D${rDiff}`, f(`D${rEnd}-D${rStart}`), val({ fmt: FMT.num2 }));
      put(ws, `E${rDiff}`, null, val());

      put(ws, `A${rCoeff}`, 'Тоолуурын коэффициент', label());
      put(ws, `B${rCoeff}`, ctCoeff, val({ fmt: FMT.int, align: 'center' }));
      put(ws, `C${rCoeff}`, ctCoeff, val({ fmt: FMT.int, align: 'center' }));
      put(ws, `D${rCoeff}`, ctCoeff, val({ fmt: FMT.int, align: 'center' }));
      put(ws, `E${rCoeff}`, null, val());

      put(ws, `A${rKwh}`, 'Хэрэглээ (кВтц)', label({ bold: true }));
      put(ws, `B${rKwh}`, f(`B${rDiff}*B${rCoeff}`), val({ fmt: FMT.num2 }));
      put(ws, `C${rKwh}`, f(`C${rDiff}*C${rCoeff}`), val({ fmt: FMT.num2 }));
      put(ws, `D${rKwh}`, f(`D${rDiff}*D${rCoeff}`), val({ fmt: FMT.num2 }));
      put(ws, `E${rKwh}`, f(`SUM(B${rKwh}:D${rKwh})`), val({ bold: true, fmt: FMT.num2 }));

      put(ws, `A${rTariff}`, 'Тариф төг/кВт.ц', label());
      put(ws, `B${rTariff}`, dayP, val({ fmt: FMT.num2, align: 'center' }));
      put(ws, `C${rTariff}`, peakP, val({ fmt: FMT.num2, align: 'center' }));
      put(ws, `D${rTariff}`, nightP, val({ fmt: FMT.num2, align: 'center' }));
      put(ws, `E${rTariff}`, null, val());

      put(ws, `A${rEnergyCost}`, 'Ашигласан цахилгааны үнэ', label());
      put(ws, `B${rEnergyCost}`, f(`B${rKwh}*B${rTariff}`), val({ fmt: FMT.money }));
      put(ws, `C${rEnergyCost}`, f(`C${rKwh}*C${rTariff}`), val({ fmt: FMT.money }));
      put(ws, `D${rEnergyCost}`, f(`D${rKwh}*D${rTariff}`), val({ fmt: FMT.money }));
      put(ws, `E${rEnergyCost}`, f(`SUM(B${rEnergyCost}:D${rEnergyCost})`), val({ bold: true, fmt: FMT.money }));

      put(ws, `A${rPeakCoeff}`, 'Оргил цагийн тарифын коэффициент', label());
      put(ws, `B${rPeakCoeff}`, peakPowerCoeff, val({ fmt: FMT.int, align: 'center' }));
      putMerged(ws, `C${rPeakCoeff}:D${rPeakCoeff}`, 'Оргил цагийн хэрэглээ (кВтц)', label());
      put(ws, `E${rPeakCoeff}`, f(`C${rKwh}`), val({ fmt: FMT.num2 }));

      put(ws, `A${rCapTariff}`, 'Тариф төг/кВт.ц', label());
      put(ws, `B${rCapTariff}`, peakCapPrice, val({ fmt: FMT.moneyInt, align: 'center' }));
      putMerged(ws, `C${rCapTariff}:E${rCapTariff}`, '', label());

      put(ws, `A${rCapCost}`, 'ЦЭХ чадлын төлбөр', label());
      put(ws, `B${rCapCost}`, f(`IFERROR(E${rPeakCoeff}/B${rPeakCoeff}*B${rCapTariff},0)`), val({ fmt: FMT.money }));
      putMerged(ws, `C${rCapCost}:E${rCapCost}`, '', label());

      put(ws, `A${rSubTotal}`, 'Нийт цахилгааны дүн', label({ bold: true }));
      put(ws, `B${rSubTotal}`, f(`E${rEnergyCost}+B${rCapCost}`), val({ bold: true, fmt: FMT.money }));
      putMerged(ws, `C${rSubTotal}:E${rSubTotal}`, '', label());

      put(ws, `A${rVat}`, `НӨАТ, ${Math.round(vatRate * 100)}%`, label());
      put(ws, `B${rVat}`, f(`B${rSubTotal}*E${rVat}`), val({ fmt: FMT.money }));
      putMerged(ws, `C${rVat}:D${rVat}`, '', label());
      put(ws, `E${rVat}`, vatRate, val({ fmt: FMT.pct, align: 'center' }));

      put(ws, `A${rTotal}`, hasMultipleMeters ? `${meterTitle} нийт дүн (НӨАТ-тай)` : 'Нийт цахилгааны дүн, НӨАТ-тай', total({ align: 'left', indent: 1 }));
      put(ws, `B${rTotal}`, f(`B${rSubTotal}+B${rVat}`), total({ align: 'right', fmt: FMT.money }));
      putMerged(ws, `C${rTotal}:E${rTotal}`, '', total());

      meterKwhCells.push(`E${rKwh}`);
      meterCostCells.push(`B${rTotal}`);
    } else {
      // Single-tier meter (standard CT meter)
      if (hasMultipleMeters) {
        putMerged(ws, `A${curRow}:E${curRow}`, meterTitle, total({ align: 'left', indent: 1 }));
        curRow++;
      }
      const rStart = curRow++;
      const rEnd = curRow++;
      const rKwh = curRow++;
      const rBase = curRow++;
      const rCos = curRow++;
      const rCap = curRow++;
      const rRen = curRow++;
      const rTotal = curRow++;

      putMerged(ws, `A${rStart}:A${rEnd}`, 'Тоолуурын заалт', label());
      put(ws, `B${rStart}`, meter.startReading ?? null, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
      putMerged(ws, `C${rStart}:D${rStart}`, 'Эхний заалт', label());
      put(ws, `E${rStart}`, null, val());
      put(ws, `B${rEnd}`, meter.endReading ?? null, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
      putMerged(ws, `C${rEnd}:D${rEnd}`, 'Эцсийн заалт', label());
      put(ws, `E${rEnd}`, null, val());

      const ctCoeff = meter.ctCoefficient ?? DEFAULTS.ctCoefficient;
      const basePrice = meter.basePrice ?? DEFAULTS.basePricePerKwh;
      const cosPhi = meter.cosPhiLoss ?? DEFAULTS.cosPhiLoss;
      const capFormula = meter.capacityChargeFormula ?? DEFAULTS.capacityChargeFormula;
      const renPerKwh = meter.renewablePerKwh ?? DEFAULTS.renewablePerKwh;

      const elecRows: [number, string, string, string, ExcelJS.CellValue, string][] = [
        [rKwh, 'Тоолуурын хэрэглээ (кВтц)', `(B${rEnd}-B${rStart})*E${rKwh}*1.025`, DEFAULTS.ctCoefficientLabel, ctCoeff, FMT.num2],
        [rBase, 'Ашигласан цахилгааны үнэ', `B${rKwh}*E${rBase}`, 'Нэгж Квтц-ийн суурь үнэ', basePrice, FMT.num2],
        [rCos, 'Cosinus фи-гийн алдагдал', `B${rBase}*E${rCos}`, `Cosinus фи-гийн алдагдал ${Math.round(cosPhi * 100)}%`, cosPhi, FMT.pct],
        [rCap, 'Чадал', `B${rEnd}/365*E${rCap}`, '365 хоногоор тооцох', f(capFormula), FMT.num2],
        [rRen, 'Сэргээгдэх эрчим хүч', `B${rEnd}*E${rRen}`, '', renPerKwh, FMT.num2],
      ];
      for (const [r, name, formula, desc, input, inputFmt] of elecRows) {
        put(ws, `A${r}`, name, label());
        put(ws, `B${r}`, f(formula), val({ fmt: FMT.num2 }));
        putMerged(ws, `C${r}:D${r}`, desc, label());
        put(ws, `E${r}`, input, val({ fmt: inputFmt, align: 'center' }));
      }
      put(ws, `A${rTotal}`, hasMultipleMeters ? `${meterTitle} цахилгааны төлбөр` : 'Цахилгааны нийт төлбөр', total({ align: 'left', indent: 1 }));
      put(ws, `B${rTotal}`, f(`B${rBase}+B${rCos}+B${rCap}+B${rRen}`), total({ align: 'right', fmt: FMT.money }));
      putMerged(ws, `C${rTotal}:D${rTotal}`, 'Тоолуурын нэхэмжлэлийн дүн', total({ align: 'left', indent: 1 }));
      put(ws, `E${rTotal}`, null, total());

      meterKwhCells.push(`B${rKwh}`);
      meterCostCells.push(`B${rTotal}`);
    }
  });

  let totalMeterKwhRef = meterKwhCells[0];
  let totalMeterCostRef = meterCostCells[0];

  if (hasMultipleMeters) {
    const rSumKwh = curRow++;
    const rSumCost = curRow++;
    put(ws, `A${rSumKwh}`, 'Нийт тоолуурын хэрэглээ (кВтц)', total({ align: 'left', indent: 1 }));
    put(ws, `B${rSumKwh}`, f(meterKwhCells.join('+')), total({ align: 'right', fmt: FMT.num2 }));
    putMerged(ws, `C${rSumKwh}:E${rSumKwh}`, `${meters.length} тоолуурын нийлбэр`, total({ align: 'left', indent: 1 }));

    put(ws, `A${rSumCost}`, 'Цахилгааны нийт төлбөр', total({ align: 'left', indent: 1 }));
    put(ws, `B${rSumCost}`, f(meterCostCells.join('+')), total({ align: 'right', fmt: FMT.money }));
    putMerged(ws, `C${rSumCost}:E${rSumCost}`, 'Бүх тоолуурын нэхэмжлэлийн нийт дүн', total({ align: 'left', indent: 1 }));

    totalMeterKwhRef = `B${rSumKwh}`;
    totalMeterCostRef = `B${rSumCost}`;
  }

  ws.getRow(curRow).height = 7.8;
  curRow++;

  // 3. Платформын үзүүлэлт ---------------------------------------------------
  const sec3Title = curRow++;
  const sec3Hdr = curRow++;
  const rSessCount = curRow++;
  const rSessStart = curRow++;
  const rSessEnd = curRow++;
  const rPlatKwh = curRow++;
  const rGrossSales = curRow++;
  const sec3Spacer = curRow++;

  sectionTitle(ws, `A${sec3Title}`, '3. Платформын үзүүлэлт');
  put(ws, `A${sec3Hdr}`, 'Үзүүлэлт', header());
  put(ws, `B${sec3Hdr}`, 'Утга', header());
  putMerged(ws, `C${sec3Hdr}:E${sec3Hdr}`, 'Тайлбар', header());
  ws.getRow(sec3Hdr).height = 22.05;

  put(ws, `A${rSessCount}`, 'Дууссан нийт сесс', label());
  put(ws, `B${rSessCount}`, f(`COUNT(${ctx.col('B')})`, ctx.sessions.length), val({ fmt: FMT.int }));
  putMerged(ws, `C${rSessCount}:E${rSessCount}`, 'Тайлант хугацаанд', label());
  putMerged(ws, `A${rSessStart}:A${rSessEnd}`, 'Тайлант хугацааны цэнэглэлт', label());
  put(ws, `B${rSessStart}`, 'Эхлэх огноо цаг', val());
  putMerged(ws, `C${rSessStart}:E${rSessStart}`, excelLocal(periodStartDate), label({ fmt: FMT.dateTime }));
  put(ws, `B${rSessEnd}`, 'Дуусах огноо цаг', val());
  putMerged(ws, `C${rSessEnd}:E${rSessEnd}`, excelLocal(periodEndDate), label({ fmt: FMT.dateTime }));
  put(ws, `A${rPlatKwh}`, 'Платформын хэрэглээ (кВтц)', label());
  put(ws, `B${rPlatKwh}`, f(`SUM(${ctx.col('L')})`, totals.kwh), val({ fmt: FMT.num2 }));
  putMerged(ws, `C${rPlatKwh}:E${rPlatKwh}`, 'Бодит DC гаралт', label());

  // 4. Орлого, зардлын тооцоо ------------------------------------------------
  ws.getRow(sec3Spacer).height = 8.4;
  const sec4Title = curRow++;
  const sec4Hdr = curRow++;
  const rRev = curRow++;
  const rElecCost = curRow++;
  const rQpay = curRow++;
  const rSimCost = curRow++;

  // Back-fill "Нийт борлуулалт" formula once rRev is known
  put(ws, `A${rGrossSales}`, 'Нийт борлуулалт', total({ align: 'left', indent: 1 }));
  put(ws, `B${rGrossSales}`, f(`B${rRev}`, totals.gross), total({ align: 'right', fmt: FMT.money }));
  putMerged(ws, `C${rGrossSales}:E${rGrossSales}`, 'Цэнэглэлтийн орлого', total({ align: 'left', indent: 1 }));

  sectionTitle(ws, `A${sec4Title}`, '4. Орлого, зардлын тооцоо');
  put(ws, `A${sec4Hdr}`, 'Үзүүлэлт', header());
  put(ws, `B${sec4Hdr}`, 'Дүн', header());
  putMerged(ws, `C${sec4Hdr}:D${sec4Hdr}`, 'Тайлбар', header());
  put(ws, `E${sec4Hdr}`, 'Утга 1', header());
  ws.getRow(sec4Hdr).height = 22.05;

  const qpayRate = params.qpayRate ?? DEFAULTS.qpayRate;
  const otherCost = params.otherDirectCosts ?? DEFAULTS.otherDirectCost;
  const costRows: [number, string, ExcelJS.CellValue, string, ExcelJS.CellValue, string?][] = [
    [rRev, 'Цэнэглэлтийн орлого', f(`SUM(${ctx.col('Q')})`, totals.gross), `Платформын тайлан, ${ctx.sessions.length} цэнэглэлт`, null],
    [rElecCost, 'Цахилгааны зардал', f(`-${totalMeterCostRef}`), 'Тоолуурын нэхэмжлэл', null],
    [rQpay, 'QPay шимтгэл', f(`-B${rRev}*E${rQpay}`, -round2(totals.gross * qpayRate)), `Орлогын ${qpayRate * 100}%`, qpayRate, FMT.pct],
    [rSimCost, 'Бусад шууд зардал', f(`-E${rSimCost}`, -otherCost), DEFAULTS.otherDirectCostLabel, otherCost, FMT.num2],
  ];
  const extraCosts = (params.extraCosts ?? []).filter((c) => c.amount || c.label.trim());
  extraCosts.forEach((c) => {
    const row = curRow++;
    costRows.push([row, c.label.trim() || 'Бусад зардал', f(`-E${row}`, -c.amount), c.note?.trim() || 'Бусад зардал', c.amount, FMT.num2]);
  });
  const lastCostRow = curRow - 1;
  const totalCostRow = curRow++;
  const netRow = curRow++;
  for (const [r, name, value, desc, input, inputFmt] of costRows) {
    put(ws, `A${r}`, name, label());
    put(ws, `B${r}`, value, val({ fmt: FMT.money }));
    putMerged(ws, `C${r}:D${r}`, desc, label());
    put(ws, `E${r}`, input, val({ fmt: inputFmt, align: 'center' }));
  }
  put(ws, `A${totalCostRow}`, 'Нийт шууд зардал', label({ bold: true }));
  put(ws, `B${totalCostRow}`, f(`SUM(B${rElecCost}:B${lastCostRow})`), val({ bold: true, fmt: FMT.money }));
  putMerged(ws, `C${totalCostRow}:D${totalCostRow}`, '', label());
  put(ws, `E${totalCostRow}`, null, val());
  put(ws, `A${netRow}`, 'Хуваарилагдах орлого', total({ align: 'left', indent: 1 }));
  put(ws, `B${netRow}`, f(`B${rRev}+B${totalCostRow}`), total({ align: 'right', fmt: FMT.money }));
  putMerged(ws, `C${netRow}:D${netRow}`, 'Хувь тооцох суурь', total({ align: 'left', indent: 1 }));
  put(ws, `E${netRow}`, null, total());

  // 5. Орлого хуваарилалт ----------------------------------------------------
  const allocTitleRow = netRow + 2;
  const allocHeaderRow = allocTitleRow + 1;
  const firstRecipient = allocHeaderRow + 1;
  sectionTitle(ws, `A${allocTitleRow}`, '5. Орлого хуваарилалт');
  ['Хүлээн авагч', 'Дүн', 'Банк', 'Төлбөр хүлээн авах данс', 'Ногдох хувь'].forEach((h, i) =>
    put(ws, `${'ABCDE'[i]}${allocHeaderRow}`, h, header()),
  );
  ws.getRow(allocHeaderRow).height = 22.05;

  const clientShare =
    params.clientShare ??
    (params.client?.feePercent != null ? round2((100 - params.client.feePercent) / 100) : 0.8);
  const recipients: RevenueReportRecipient[] =
    params.recipients && params.recipients.length > 0
      ? params.recipients
      : [
          {
            name: clientName,
            bank: params.client?.payoutAccount?.bankName ?? '',
            account: params.client?.payoutAccount?.accountNumber ?? '',
            share: clientShare,
          },
          ...PLATFORM_RECIPIENTS.map((p) => ({
            name: p.name,
            bank: p.bank,
            account: p.account,
            share: round2((1 - clientShare) * p.weight * 1000) / 1000,
          })),
        ];

  let r = firstRecipient;
  for (const rc of recipients) {
    put(ws, `A${r}`, rc.name, label({ wrap: true }));
    put(ws, `B${r}`, f(`$B$${netRow}*E${r}`), val({ fmt: FMT.money }));
    put(ws, `C${r}`, rc.bank ?? '', val({ align: 'center' }));
    put(ws, `D${r}`, rc.account ?? '', val({ align: 'center' }));
    put(ws, `E${r}`, rc.share, val({ align: 'center', fmt: FMT.pct1 }));
    r++;
  }
  put(ws, `A${r}`, 'ТӨЛӨХ ДҮН', total({ align: 'left', indent: 1 }));
  put(ws, `B${r}`, f(`SUM(B${firstRecipient}:B${r - 1})`), total({ align: 'right', fmt: FMT.money }));
  put(ws, `C${r}`, null, total());
  putMerged(ws, `D${r}:E${r}`, f(`SUM(E${firstRecipient}:E${r - 1})`), total({ align: 'center', fmt: FMT.pct1 }));
  r++;
  putMerged(ws, `A${r}:E${r}`, params.notes || DEFAULTS.note, { size: 9, color: MUTED, align: 'left' });
  r++;

  // 6. Эрчим хүчний тулгалт  |  7. Нэгжийн үзүүлэлт --------------------------
  const t = r;
  sectionTitle(ws, `A${t}`, '6. Эрчим хүчний тулгалт');
  sectionTitle(ws, `D${t}`, '7. Нэгжийн үзүүлэлт');
  put(ws, `A${t + 1}`, 'Үзүүлэлт', header({ align: 'left', indent: 1 }));
  put(ws, `B${t + 1}`, 'Утга', header());
  put(ws, `D${t + 1}`, 'Үзүүлэлт', header());
  put(ws, `E${t + 1}`, 'Утга', header());
  ws.getRow(t + 1).height = 22.05;
  const a = t + 2;
  const recon: [string, string, string, string, string, string][] = [
    ['Тоолуурын хэрэглээ (кВтц)', totalMeterKwhRef, FMT.num2, 'Цахилгааны өртөг, 1 кВтц', `IFERROR(${totalMeterCostRef}/${totalMeterKwhRef},0)`, FMT.perKwh],
    ['Платформын хэрэглээ (кВтц)', `B${rPlatKwh}`, FMT.num2, 'Дундаж борлуулалтын үнэ, 1 кВтц', `IFERROR(B${rRev}/B${rPlatKwh},0)`, FMT.perKwh],
    ['Зөрүү (кВтц)', `B${a}-B${a + 1}`, FMT.num2, 'Цэвэр орлого, 1 кВтц', `IFERROR(B${netRow}/B${rPlatKwh},0)`, FMT.perKwh],
    ['Зөрүү / тоолуур', `IFERROR(B${a + 2}/B${a},0)`, FMT.pct1Signed, 'Цэвэр орлогын хувь', `IFERROR(B${netRow}/B${rRev},0)`, FMT.pct1Signed],
  ];
  recon.forEach(([l1, f1, fmt1, l2, f2, fmt2], i) => {
    put(ws, `A${a + i}`, l1, label());
    put(ws, `B${a + i}`, f(f1), val({ align: 'center', fmt: fmt1 }));
    put(ws, `D${a + i}`, l2, val());
    put(ws, `E${a + i}`, f(f2), val({ align: 'center', fmt: fmt2 }));
  });

  return ws;
}

// ---------------------------------------------------------------------------
// Sheet 2 — Шинжилгээ
// ---------------------------------------------------------------------------

function buildAnalysisSheet(wb: ExcelJS.Workbook, ctx: Ctx) {
  const ws = wb.addWorksheet('Шинжилгээ', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.views = [{ showGridLines: false }];
  ws.columns = [{ width: 3 }, { width: 40 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 16 }];
  const hdr = (o: CellOpts = {}) => header({ bg: GREEN_DARK, align: 'right', ...o });
  const { sessions, totals } = ctx;

  putMerged(ws, 'B1:F1', 'Борлуулалтын шинжилгээ', {
    bold: true,
    size: 16,
    color: WHITE,
    bg: GREEN_DARK,
    align: 'left',
    indent: 1,
    border: true,
  });
  ws.getRow(1).height = 26.4;

  let r = 3;

  /** A "group by" table: label column + count / kWh / revenue (+ share) via COUNTIF/SUMIF. */
  const groupTable = (
    title: string,
    keyHeader: string,
    keyCol: string,
    keys: { value: ExcelJS.CellValue; fmt?: string; n: number; kwh: number; gross: number }[],
    withShare: boolean,
  ) => {
    sectionTitle(ws, `B${r}`, title, GREEN_DARK);
    r++;
    put(ws, `B${r}`, keyHeader, hdr({ align: 'left', indent: 1 }));
    put(ws, `C${r}`, 'Цэнэглэлт', hdr());
    put(ws, `D${r}`, 'кВтц', hdr());
    put(ws, `E${r}`, 'Борлуулалт', hdr());
    if (withShare) put(ws, `F${r}`, 'Эзлэх хувь', hdr());
    ws.getRow(r).height = 22.05;
    r++;
    const start = r;
    const end = r + Math.max(keys.length, 1) - 1;
    const totalRow = end + 1;
    for (const k of keys) {
      put(ws, `B${r}`, k.value, label({ fmt: k.fmt }));
      put(ws, `C${r}`, f(`COUNTIF(${ctx.col(keyCol)},B${r})`, k.n), val({ fmt: FMT.int }));
      put(ws, `D${r}`, f(`SUMIF(${ctx.col(keyCol)},B${r},${ctx.col('L')})`, round2(k.kwh)), val({ fmt: FMT.num2 }));
      put(ws, `E${r}`, f(`SUMIF(${ctx.col(keyCol)},B${r},${ctx.col('Q')})`, round2(k.gross)), val({ fmt: FMT.moneyInt }));
      if (withShare) {
        put(ws, `F${r}`, f(`IFERROR(E${r}/E${totalRow},0)`, totals.gross ? k.gross / totals.gross : 0), val({ fmt: FMT.pct1 }));
      }
      r++;
    }
    if (!keys.length) r++;
    put(ws, `B${totalRow}`, 'Нийт', total({ align: 'left', indent: 1 }));
    put(ws, `C${totalRow}`, f(`SUM(C${start}:C${end})`, sessions.length), total({ align: 'right', fmt: FMT.int }));
    put(ws, `D${totalRow}`, f(`SUM(D${start}:D${end})`, totals.kwh), total({ align: 'right', fmt: FMT.num2 }));
    put(ws, `E${totalRow}`, f(`SUM(E${start}:E${end})`, totals.gross), total({ align: 'right', fmt: FMT.moneyInt }));
    if (withShare) put(ws, `F${totalRow}`, f(`SUM(F${start}:F${end})`, 1), total({ align: 'right', fmt: FMT.pct }));
    r = totalRow + 2;
  };

  const groupBy = <K>(key: (s: RevenueReportSessionItem) => K) => {
    const m = new Map<K, { n: number; kwh: number; gross: number }>();
    for (const s of sessions) {
      const k = key(s);
      const g = m.get(k) ?? { n: 0, kwh: 0, gross: 0 };
      g.n += 1;
      g.kwh += s.energyKwh || 0;
      g.gross += s.cost || 0;
      m.set(k, g);
    }
    return m;
  };

  const sessionGunLabel = (s: RevenueReportSessionItem) =>
    s.stationLabel ? `${s.stationLabel} · Буу ${connectorLetter(s.connectorId)}` : `Буу ${connectorLetter(s.connectorId)}`;

  // 1. Буугаар
  const byConnector = groupBy(sessionGunLabel);
  groupTable(
    '1. Буугаар',
    'Буу',
    'C',
    [...byConnector.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, g]) => ({ value: k, ...g })),
    true,
  );

  // 2. Тарифаар
  const byTariff = groupBy((s) => (s.tariffPerKwh != null ? round2(s.tariffPerKwh) : null));
  groupTable(
    '2. Тарифаар (₮/кВтц)',
    'Тариф',
    'P',
    [...byTariff.entries()]
      .filter(([k]) => k != null)
      .sort(([a], [b]) => (b as number) - (a as number))
      .map(([k, g]) => ({ value: k, fmt: '#,##0" ₮"', ...g })),
    true,
  );

  // 3. Үйл ажиллагааны үзүүлэлт
  sectionTitle(ws, `B${r}`, '3. Үйл ажиллагааны үзүүлэлт', GREEN_DARK);
  r++;
  put(ws, `B${r}`, 'Үзүүлэлт', hdr({ align: 'left', indent: 1 }));
  put(ws, `C${r}`, 'Утга', hdr());
  ws.getRow(r).height = 22.05;
  r++;
  const success = sessions.filter((s) => (s.energyKwh || 0) > 0);
  const successRow = r + 1;
  const days =
    Math.round((parseYmd(ctx.params.to).getTime() - parseYmd(ctx.params.from).getTime()) / 86400000) + 1;
  const daysRow = r + 7;
  const [fy, fm, fd] = ctx.params.from.split('-').map(Number);
  const [ty, tm, td] = ctx.params.to.split('-').map(Number);
  const ops: [string, string, ExcelJS.CellFormulaValue['result'], string][] = [
    ['Нийт цэнэглэлт', `COUNT(${ctx.col('B')})`, sessions.length, FMT.int],
    ['Амжилттай цэнэглэлт (кВтц > 0)', `COUNTIF(${ctx.col('L')},">0")`, success.length, FMT.int],
    ['Цэнэглээгүй (0 кВтц)', `COUNTIF(${ctx.col('L')},0)`, sessions.length - success.length, FMT.int],
    ['Нэг цэнэглэлтийн дундаж борлуулалт', `IFERROR(SUM(${ctx.col('Q')})/C${successRow},0)`, success.length ? totals.gross / success.length : 0, FMT.moneyInt],
    ['Нэг цэнэглэлтийн дундаж эрчим хүч (кВтц)', `IFERROR(SUM(${ctx.col('L')})/C${successRow},0)`, success.length ? totals.kwh / success.length : 0, FMT.num2],
    [
      'Нэг цэнэглэлтийн дундаж хугацаа (мин)',
      `IFERROR(SUMIF(${ctx.col('L')},">0",${ctx.col('G')})/C${successRow},0)`,
      success.length ? success.reduce((a2, s) => a2 + (s.durationMin ?? 0), 0) / success.length : 0,
      '0.0',
    ],
    [
      'Давхардаагүй хэрэглэгч (ID Tag)',
      `IFERROR(SUMPRODUCT(1/COUNTIF(${ctx.col('J')},${ctx.col('J')})),0)`,
      new Set(sessions.map((s) => s.idTag)).size,
      FMT.int,
    ],
    ['Тайлант хугацааны хоног', `DATE(${ty},${tm},${td})-DATE(${fy},${fm},${fd})+1`, days, FMT.int],
    ['Өдрийн дундаж борлуулалт', `IFERROR(SUM(${ctx.col('Q')})/C${daysRow},0)`, days ? totals.gross / days : 0, FMT.moneyInt],
  ];
  for (const [name, formula, result, fmt] of ops) {
    put(ws, `B${r}`, name, label());
    put(ws, `C${r}`, f(formula, result), val({ fmt }));
    r++;
  }
  r++;

  // 4. Өдрөөр (by start day, matching =INT(Эхэлсэн) on the session sheet)
  const byDay = groupBy((s) => excelDay(s.startTimestamp).getTime());
  groupTable(
    '4. Өдрөөр',
    'Огноо',
    'F',
    [...byDay.entries()].sort(([a], [b]) => a - b).map(([k, g]) => ({ value: new Date(k), fmt: FMT.date, ...g })),
    false,
  );

  return ws;
}

// ---------------------------------------------------------------------------
// Sheet 3 — Цэнэглэлт_дэлгэрэнгүй
// ---------------------------------------------------------------------------

const SESSION_COLUMNS: { header: string; width: number; fmt?: string; align?: Align }[] = [
  { header: '№', width: 5, align: 'center' },
  { header: 'Цэнэглэлтийн дугаар', width: 12, align: 'center' },
  { header: 'Буу', width: 8, align: 'center' },
  { header: 'Эхэлсэн', width: 21, fmt: FMT.dateTime },
  { header: 'Дууссан', width: 21, fmt: FMT.dateTime },
  { header: 'Огноо', width: 13, fmt: FMT.date },
  { header: 'Хугацаа (мин)', width: 9, fmt: FMT.intSep },
  { header: 'Утас', width: 13, align: 'center' },
  { header: 'Төрөл', width: 13 },
  { header: 'Карт / ID Tag', width: 20.33 },
  { header: 'Машин', width: 16 },
  { header: 'Эрчим хүч (кВтц)', width: 12.77, fmt: FMT.num2 },
  { header: 'Дундаж чадал (кВт)', width: 12.33, fmt: '0.0' },
  { header: 'SoC эхлэл', width: 8, fmt: FMT.pct, align: 'center' },
  { header: 'SoC төгсгөл', width: 8, fmt: FMT.pct, align: 'center' },
  { header: 'Тариф (₮/кВтц)', width: 9, fmt: FMT.intSep },
  { header: 'Борлуулалт (₮)', width: 11.1, fmt: FMT.intSep },
  { header: 'Буцаалт (₮)', width: 9, fmt: '#,##0;-#,##0;-' },
  { header: 'И-баримт', width: 11, align: 'center' },
  { header: 'И-баримт ID', width: 28 },
  { header: 'Зогсоосон шалтгаан', width: 12, align: 'center' },
];

function buildSessionsSheet(wb: ExcelJS.Workbook, ctx: Ctx) {
  const ws = wb.addWorksheet(SESSION_SHEET, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.2, right: 0.2, top: 1, bottom: 1, header: 0.5, footer: 0.5 },
    },
  });
  ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 0, ySplit: 3 }];
  ws.columns = SESSION_COLUMNS.map((c) => ({ width: c.width === 9 ? 9.01 : c.width }));

  put(ws, 'A1', 'Цэнэглэлтийн мэдээлэл', { bold: true, size: 28, color: GREEN_DARK });
  ws.getCell('A1').font = { name: 'Calibri', size: 28, bold: true, color: { argb: GREEN_DARK } };
  ws.getRow(1).height = 36;
  ws.getRow(2).height = 6.6;

  SESSION_COLUMNS.forEach((c, i) => put(ws, ws.getCell(3, i + 1).address, c.header, header()));
  ws.getRow(3).height = 34.05;

  ctx.sessions.forEach((s, i) => {
    const r = ctx.first + i;
    const values: ExcelJS.CellValue[] = [
      i + 1,
      s.id,
      s.stationLabel ? `${s.stationLabel} · Буу ${connectorLetter(s.connectorId)}` : `Буу ${connectorLetter(s.connectorId)}`,
      excelLocal(s.startTimestamp),
      excelLocal(s.stopTimestamp),
      f(`INT(D${r})`, excelDay(s.startTimestamp)),
      s.durationMin ?? null,
      (s.driverPhone || '').replace(/^\+976\s*/, ''),
      s.driverType || '',
      s.idTag || '',
      s.vehicle || '',
      round2(s.energyKwh || 0),
      s.avgPowerKw != null ? round2(s.avgPowerKw) : null,
      s.startSocPercent != null ? s.startSocPercent / 100 : null,
      s.endSocPercent != null ? s.endSocPercent / 100 : null,
      s.tariffPerKwh != null ? round2(s.tariffPerKwh) : null,
      round2(s.cost || 0),
      s.refundAmount != null ? round2(s.refundAmount) : 0,
      s.ebarimtStatus === 'SUCCESS' ? 'Олгосон' : s.ebarimtStatus === 'RETURNED' ? 'Буцаасан' : (s.ebarimtStatus || ''),
      s.ebarimtReceiptId || '',
      s.stopReason || '',
    ];
    values.forEach((v, c) => {
      const col = SESSION_COLUMNS[c];
      put(ws, ws.getCell(r, c + 1).address, v, { border: true, fmt: col.fmt, align: col.align });
    });
  });

  const totalRow = ctx.last + 1;
  for (let c = 1; c <= SESSION_COLUMNS.length; c++) put(ws, ws.getCell(totalRow, c).address, null, total());
  const range = (l: string) => `${l}${ctx.first}:${l}${ctx.last}`;
  ws.getCell(`A${totalRow}`).value = 'НИЙТ';
  put(ws, `B${totalRow}`, f(`COUNT(${range('B')})`, ctx.sessions.length), total({ fmt: '0" цэнэглэлт"' }));
  put(ws, `G${totalRow}`, f(`SUM(${range('G')})`, ctx.totals.minutes), total({ fmt: FMT.intSep }));
  put(ws, `L${totalRow}`, f(`SUM(${range('L')})`, ctx.totals.kwh), total({ fmt: FMT.num2 }));
  put(ws, `Q${totalRow}`, f(`SUM(${range('Q')})`, ctx.totals.gross), total({ fmt: FMT.intSep }));
  put(ws, `R${totalRow}`, f(`SUM(${range('R')})`, ctx.totals.refund), total({ fmt: '#,##0;-#,##0;-' }));

  const fmtN = (n: number, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  put(
    ws,
    `A${totalRow + 2}`,
    `Борлуулалт = системд бүртгэгдсэн цэнэглэлт бүрийн дүн (нийт: ${fmtN(ctx.totals.gross)} ₮, ${fmtN(ctx.totals.kwh, 2)} кВтц, ${fmtN(ctx.totals.minutes)} мин).`,
    { size: 9, color: MUTED },
  );

  ws.autoFilter = `A3:U${ctx.last}`;
  return ws;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildStationRevenueWorkbook(
  params: RevenueReportParams,
  sessions: RevenueReportSessionItem[],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eplug.mn';
  wb.created = new Date();
  wb.modified = new Date();
  // Cached results are best-effort; make Excel recompute everything on open.
  wb.calcProperties = { fullCalcOnLoad: true };

  const ctx = buildCtx(params, sessions);
  buildSummarySheet(wb, ctx);
  buildAnalysisSheet(wb, ctx);
  buildSessionsSheet(wb, ctx);
  return wb;
}

/** Browser download helper. */
export async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
