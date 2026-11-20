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

export interface RevenueReportParams {
  station: RevenueReportStation;
  client?: RevenueReportClient | null;
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD"
  sessionsCount: number;
  platformKwh: number;
  grossRevenue: number;
  /** Meter readings (Эхний / Эцсийн заалт). Left blank when omitted, for manual entry. */
  meterStartReading?: number;
  meterEndReading?: number;
  /** Not used by this layout (the bill is computed from meter readings); kept for callers. */
  meterKwh?: number;
  electricityCost?: number;
  meterDate?: string;
  /** Client's share of distributable revenue, e.g. 0.8. Defaults to 1 − feePercent. */
  clientShare?: number;
  /** Payment-provider fee as a fraction of revenue, e.g. 0.01. */
  qpayRate?: number;
  otherDirectCosts?: number;
  /** Extra cost lines (Бусад зардал), each its own row under the data-SIM cost. */
  extraCosts?: { label: string; amount: number }[];
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
  dateTime: 'yyyy-mm-dd hh:mm',
  date: 'yyyy-mm-dd',
  time: 'h:mm',
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
  ws.columns = [{ width: 35.66 }, { width: 17.55 }, { width: 9.01 }, { width: 32.66 }, { width: 17.55 }];

  const clientName = params.client?.name || 'Станц эзэмшигч';
  const fromDate = parseYmd(params.from);
  const reportNumber =
    params.reportNumber ||
    `${reportCode(st)} ${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;

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
  putMerged(ws, 'D8:E8', excelLocal(ctx.firstStart ?? fromDate), label({ fmt: FMT.dateTime }));
  putMerged(ws, 'B9:C9', 'Дуусах огноо цаг', val());
  putMerged(ws, 'D9:E9', excelLocal(ctx.periodEnd), label({ fmt: FMT.dateTime }));

  putMerged(ws, 'A10:A11', 'Тайлан хүлээн авагч', label({ bold: true }));
  putMerged(ws, 'B10:C10', 'Станц эзэмшигч', val());
  putMerged(ws, 'D10:E10', clientName, label());
  putMerged(ws, 'B11:C11', 'Талбай эзэмшигч', val());
  putMerged(ws, 'D11:E11', f('D10', clientName), label());

  put(ws, 'A12', 'Оператор', label({ bold: true }));
  putMerged(ws, 'B12:E12', params.operatorName || DEFAULTS.operatorName, label());
  put(ws, 'A13', 'Платформ', label({ bold: true }));
  putMerged(ws, 'B13:E13', params.platformName || DEFAULTS.platformName, label());
  ws.getRow(14).height = 9;

  // 2. Эрчим хүчний төлбөрийн тооцоолол --------------------------------------
  sectionTitle(ws, 'A15', '2. Эрчим хүчний төлбөрийн тооцоолол');
  put(ws, 'A16', 'Үзүүлэлт', header());
  put(ws, 'B16', 'Утга', header());
  putMerged(ws, 'C16:D16', 'Тайлбар', header());
  put(ws, 'E16', 'Утга 1', header());
  ws.getRow(16).height = 22.05;

  const meterDay = excelDay(ctx.periodEnd);
  const meterTime = new Date(
    Date.UTC(1899, 11, 30, ctx.periodEnd.getHours(), ctx.periodEnd.getMinutes()),
  );
  put(ws, 'A17', 'Тоолуурын заалтын огноо', label());
  put(ws, 'B17', meterDay, val({ fmt: FMT.date }));
  putMerged(ws, 'C17:D17', '', label());
  put(ws, 'E17', null, val());
  put(ws, 'A18', 'Тоолуурын заалтын цаг, минут', label());
  put(ws, 'B18', meterTime, val({ fmt: FMT.time }));
  putMerged(ws, 'C18:D18', '', label());
  put(ws, 'E18', null, val());

  putMerged(ws, 'A19:A20', 'Тоолуурын заалт', label());
  put(ws, 'B19', params.meterStartReading ?? null, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
  putMerged(ws, 'C19:D19', 'Эхний заалт', label());
  put(ws, 'E19', null, val());
  put(ws, 'B20', params.meterEndReading ?? null, val({ fmt: FMT.num2, bg: 'FFFFF8E1' }));
  putMerged(ws, 'C20:D20', 'Эцсийн заалт', label());
  put(ws, 'E20', null, val());

  const elecRows: [number, string, string, string, ExcelJS.CellValue, string][] = [
    [21, 'Тоолуурын хэрэглээ (кВтц)', '(B20-B19)*E21*1.025', DEFAULTS.ctCoefficientLabel, DEFAULTS.ctCoefficient, FMT.num2],
    [22, 'Ашигласан цахилгааны үнэ', 'B21*E22', 'Нэгж Квтц-ийн суурь үнэ', DEFAULTS.basePricePerKwh, FMT.num2],
    [23, 'Cosinus фи-гийн алдагдал', 'B22*E23', `Cosinus фи-гийн алдагдал ${DEFAULTS.cosPhiLoss * 100}%`, DEFAULTS.cosPhiLoss, FMT.pct],
    [24, 'Чадал', 'B20/365*E24', '365 хоногоор тооцох', f(DEFAULTS.capacityChargeFormula), FMT.num2],
    [25, 'Сэргээгдэх эрчим хүч', 'B20*E25', '', DEFAULTS.renewablePerKwh, FMT.num2],
  ];
  for (const [r, name, formula, desc, input, inputFmt] of elecRows) {
    put(ws, `A${r}`, name, label());
    put(ws, `B${r}`, f(formula), val({ fmt: FMT.num2 }));
    putMerged(ws, `C${r}:D${r}`, desc, label());
    put(ws, `E${r}`, input, val({ fmt: inputFmt, align: 'center' }));
  }
  put(ws, 'A26', 'Цахилгааны нийт төлбөр', total({ align: 'left', indent: 1 }));
  put(ws, 'B26', f('B22+B23+B24+B25'), total({ align: 'right', fmt: FMT.money }));
  putMerged(ws, 'C26:D26', 'Тоолуурын нэхэмжлэлийн дүн', total({ align: 'left', indent: 1 }));
  put(ws, 'E26', null, total());
  ws.getRow(27).height = 7.8;

  // 3. Платформын үзүүлэлт ---------------------------------------------------
  sectionTitle(ws, 'A28', '3. Платформын үзүүлэлт');
  put(ws, 'A29', 'Үзүүлэлт', header());
  put(ws, 'B29', 'Утга', header());
  putMerged(ws, 'C29:E29', 'Тайлбар', header());
  ws.getRow(29).height = 22.05;

  put(ws, 'A30', 'Дууссан нийт цэнэглэлт', label());
  put(ws, 'B30', f(`COUNT(${ctx.col('B')})`, ctx.sessions.length), val({ fmt: FMT.int }));
  putMerged(ws, 'C30:E30', 'Тайлант хугацаанд', label());
  putMerged(ws, 'A31:A32', 'Тайлант хугацааны цэнэглэлт', label());
  put(ws, 'B31', 'Эхлэх огноо цаг', val());
  putMerged(ws, 'C31:E31', excelLocal(ctx.firstStart), label({ fmt: FMT.dateTime }));
  put(ws, 'B32', 'Дуусах огноо цаг', val());
  putMerged(ws, 'C32:E32', excelLocal(ctx.lastStop), label({ fmt: FMT.dateTime }));
  put(ws, 'A33', 'Платформын хэрэглээ (кВтц)', label());
  put(ws, 'B33', f(`SUM(${ctx.col('L')})`, totals.kwh), val({ fmt: FMT.num2 }));
  putMerged(ws, 'C33:E33', 'DC гаралт', label());
  put(ws, 'A34', 'Нийт борлуулалт', total({ align: 'left', indent: 1 }));
  put(ws, 'B34', f('B38', totals.gross), total({ align: 'right', fmt: FMT.money }));
  putMerged(ws, 'C34:E34', 'Цэнэглэлтийн орлого', total({ align: 'left', indent: 1 }));
  ws.getRow(35).height = 8.4;

  // 4. Орлого, зардлын тооцоо ------------------------------------------------
  sectionTitle(ws, 'A36', '4. Орлого, зардлын тооцоо');
  put(ws, 'A37', 'Үзүүлэлт', header());
  put(ws, 'B37', 'Дүн', header());
  putMerged(ws, 'C37:D37', 'Тайлбар', header());
  put(ws, 'E37', 'Утга 1', header());
  ws.getRow(37).height = 22.05;

  const qpayRate = params.qpayRate ?? DEFAULTS.qpayRate;
  const otherCost = params.otherDirectCosts ?? DEFAULTS.otherDirectCost;
  const costRows: [number, string, ExcelJS.CellValue, string, ExcelJS.CellValue, string?][] = [
    [38, 'Цэнэглэлтийн орлого', f(`SUM(${ctx.col('Q')})`, totals.gross), `Платформын тайлан, ${ctx.sessions.length} цэнэглэлт`, null],
    [39, 'Цахилгааны зардал', f('-B26'), 'Тоолуурын нэхэмжлэл', null],
    [40, 'QPay шимтгэл', f('-B38*E40', -round2(totals.gross * qpayRate)), `Орлогын ${qpayRate * 100}%`, qpayRate, FMT.pct],
    [41, 'Бусад шууд зардал', f('-E41', -otherCost), DEFAULTS.otherDirectCostLabel, otherCost, FMT.num2],
  ];
  const extraCosts = (params.extraCosts ?? []).filter((c) => c.amount || c.label.trim());
  extraCosts.forEach((c, i) => {
    const row = 42 + i;
    costRows.push([row, 'Бусад зардал', f(`-E${row}`, -c.amount), c.label.trim() || 'Бусад зардал', c.amount, FMT.num2]);
  });
  const lastCostRow = 41 + extraCosts.length;
  const totalCostRow = lastCostRow + 1;
  const netRow = totalCostRow + 1;
  for (const [r, name, value, desc, input, inputFmt] of costRows) {
    put(ws, `A${r}`, name, label());
    put(ws, `B${r}`, value, val({ fmt: FMT.money }));
    putMerged(ws, `C${r}:D${r}`, desc, label());
    put(ws, `E${r}`, input, val({ fmt: inputFmt, align: 'center' }));
  }
  put(ws, `A${totalCostRow}`, 'Нийт шууд зардал', label({ bold: true }));
  put(ws, `B${totalCostRow}`, f(`SUM(B39:B${lastCostRow})`), val({ bold: true, fmt: FMT.money }));
  putMerged(ws, `C${totalCostRow}:D${totalCostRow}`, '', label());
  put(ws, `E${totalCostRow}`, null, val());
  put(ws, `A${netRow}`, 'Хуваарилагдах орлого', total({ align: 'left', indent: 1 }));
  put(ws, `B${netRow}`, f(`B38+B${totalCostRow}`), total({ align: 'right', fmt: FMT.money }));
  putMerged(ws, `C${netRow}:D${netRow}`, 'Хувь тооцох суурь', total({ align: 'left', indent: 1 }));
  put(ws, `E${netRow}`, null, total());

  // 5. Орлого хуваарилалт ----------------------------------------------------
  // Rows below shift down by one for every extra cost line.
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
  const recipients = [
    {
      name: clientName,
      bank: params.client?.payoutAccount?.bankName ?? '',
      account: params.client?.payoutAccount?.accountNumber ?? '',
      share: clientShare,
    },
    ...PLATFORM_RECIPIENTS.map((p) => ({ ...p, share: round2((1 - clientShare) * p.weight * 1000) / 1000 })),
  ];
  let r = firstRecipient;
  for (const rc of recipients) {
    put(ws, `A${r}`, rc.name, label({ wrap: true }));
    put(ws, `B${r}`, f(`$B$${netRow}*E${r}`), val({ fmt: FMT.money }));
    put(ws, `C${r}`, rc.bank, val({ align: 'center' }));
    put(ws, `D${r}`, rc.account, val({ align: 'center' }));
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
    ['Тоолуурын хэрэглээ (кВтц)', 'B21', FMT.num2, 'Цахилгааны өртөг, 1 кВтц', 'IFERROR(B26/B21,0)', FMT.perKwh],
    ['Платформын хэрэглээ (кВтц)', 'B33', FMT.num2, 'Дундаж борлуулалтын үнэ, 1 кВтц', 'IFERROR(B38/B33,0)', FMT.perKwh],
    ['Зөрүү (кВтц)', `B${a}-B${a + 1}`, FMT.num2, 'Цэвэр орлого, 1 кВтц', `IFERROR(B${netRow}/B33,0)`, FMT.perKwh],
    ['Зөрүү / тоолуур', `IFERROR(B${a + 2}/B${a},0)`, FMT.pct1Signed, 'Цэвэр орлогын хувь', `IFERROR(B${netRow}/B38,0)`, FMT.pct1Signed],
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

  // 1. Буугаар
  const byConnector = groupBy((s) => `Буу ${connectorLetter(s.connectorId)}`);
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
  { header: 'Эхэлсэн', width: 17, fmt: FMT.dateTime },
  { header: 'Дууссан', width: 17, fmt: FMT.dateTime },
  { header: 'Огноо', width: 11, fmt: FMT.date },
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
      `Буу ${connectorLetter(s.connectorId)}`,
      excelLocal(s.startTimestamp),
      excelLocal(s.stopTimestamp),
      f(`INT(D${r})`, excelDay(s.startTimestamp)),
      s.durationMin ?? null,
      s.driverPhone || '',
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
      s.ebarimtStatus || '',
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
