import ExcelJS from 'exceljs';
import { connectorLetter, formatDateTime } from './format';

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
  to: string;   // "YYYY-MM-DD"
  sessionsCount: number;
  platformKwh: number;
  grossRevenue: number;
  /** Optional custom or override values */
  meterKwh?: number;
  electricityCost?: number;
  meterDate?: string;
  clientShare?: number; // e.g. 0.8 (80%)
  qpayRate?: number;    // e.g. 0.01 (1%)
  otherDirectCosts?: number;
  reportNumber?: string;
  operatorName?: string;
  platformName?: string;
  notes?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Colors (8-char ARGB format)
const C_NAVY = 'FF1E293B';          // Slate-800
const C_DARK_SLATE = 'FF0F172A';     // Slate-900
const C_SLATE_HEADER = 'FF334155';   // Slate-700
const C_SUBHEADER_BG = 'FFF1F5F9';   // Slate-100
const C_LABEL_BG = 'FFF8FAFC';       // Slate-50
const C_ZEBRA = 'FFF8FAFC';          // Light row zebra
const C_WHITE = 'FFFFFFFF';
const C_BORDER = 'FFCBD5E1';         // Slate-300
const C_BORDER_LIGHT = 'FFE2E8F0';   // Slate-200
const C_TEXT_DARK = 'FF0F172A';
const C_TEXT_MUTED = 'FF64748B';     // Slate-500
const C_TEXT_LABEL = 'FF475569';     // Slate-600

// Accent cards
const C_AMBER_BG = 'FFFEF3C7';
const C_AMBER_TXT = 'FF92400E';
const C_AMBER_VAL = 'FFB45309';
const C_AMBER_BD = 'FFFCD34D';

const C_BLUE_BG = 'FFE0F2FE';
const C_BLUE_TXT = 'FF0369A1';
const C_BLUE_VAL = 'FF0284C7';
const C_BLUE_BD = 'FFBAE6FD';

const C_EMERALD_BG = 'FFDCFCE7';
const C_EMERALD_TXT = 'FF14532D';
const C_EMERALD_VAL = 'FF15803D';
const C_EMERALD_BD = 'FF86EFAC';
const C_EMERALD_DEEP_BD = 'FF16A34A';

const C_ROSE_BG = 'FFFEE2E2';
const C_ROSE_TXT = 'FF991B1B';

function solidFill(argb: string): ExcelJS.Fill {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  };
}

function thinBorder(argb = C_BORDER): Partial<ExcelJS.Borders> {
  const border: Partial<ExcelJS.Border> = { style: 'thin', color: { argb } };
  return { top: border, left: border, bottom: border, right: border };
}

function setCellStyle(
  ws: ExcelJS.Worksheet,
  r: number,
  c: number,
  opts: {
    value?: ExcelJS.CellValue;
    font?: Partial<ExcelJS.Font>;
    fill?: ExcelJS.Fill;
    border?: Partial<ExcelJS.Borders>;
    alignment?: Partial<ExcelJS.Alignment>;
    numFmt?: string;
  },
) {
  const cell = ws.getCell(r, c);
  if (opts.value !== undefined) cell.value = opts.value;
  cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: C_TEXT_DARK }, ...opts.font };
  if (opts.fill) cell.fill = opts.fill;
  if (opts.border) cell.border = opts.border;
  if (opts.alignment) cell.alignment = { vertical: 'middle', ...opts.alignment };
  if (opts.numFmt) cell.numFmt = opts.numFmt;
  return cell;
}

function mergeAndStyle(
  ws: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  opts: {
    value?: ExcelJS.CellValue;
    font?: Partial<ExcelJS.Font>;
    fill?: ExcelJS.Fill;
    border?: Partial<ExcelJS.Borders>;
    alignment?: Partial<ExcelJS.Alignment>;
    numFmt?: string;
  },
) {
  ws.mergeCells(startRow, startCol, endRow, endCol);
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: C_TEXT_DARK }, ...opts.font };
      if (opts.fill) cell.fill = opts.fill;
      if (opts.border) cell.border = opts.border;
      if (opts.alignment) cell.alignment = { vertical: 'middle', ...opts.alignment };
      if (opts.numFmt) cell.numFmt = opts.numFmt;
    }
  }
  const master = ws.getCell(startRow, startCol);
  if (opts.value !== undefined) master.value = opts.value;
  return master;
}

/**
 * Build Sheet 1: «Тайлан» with high-fidelity executive styling, borders, and live formulas
 */
export function buildRevenueReportWorksheet(
  wb: ExcelJS.Workbook,
  params: RevenueReportParams,
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Тайлан', {
    views: [{ showGridLines: true }],
    properties: { defaultRowHeight: 20 },
  });

  // Setup 8 main columns
  ws.columns = [
    { key: 'A', width: 28 }, // 1. Үзүүлэлт
    { key: 'B', width: 18 }, // 2. Дүн, ₮
    { key: 'C', width: 20 }, // 3. Эх үүсвэр
    { key: 'D', width: 22 }, // 4. Тайлбар
    { key: 'E', width: 26 }, // 5. Үзүүлэлт
    { key: 'F', width: 18 }, // 6. Утга
    { key: 'G', width: 12 }, // 7. Харьцаа
    { key: 'H', width: 36 }, // 8. Тайлбар
  ];

  const st = params.station;
  const stationName = st.name || st.cpId;
  const clientName = params.client?.name || 'Станц эзэмшигч';
  const operatorName = params.operatorName || 'Монголын Цэвэр Тээвэр Суурь Бүтцийн Хөгжлийн Холбоо ТББ';
  const platformName = params.platformName || 'Eplug.mn';

  // Format report number: Remove "NEV-", use station code + period (e.g. "META 2026-11" or "ZAISAN1 2026-11")
  const toParts = params.to.split('-');
  const year = toParts[0] || String(new Date().getFullYear());
  const month = toParts[1] || '01';
  const cleanCode = (st.cpId || st.name || 'META')
    .replace(/^NEV[-_]/i, '')
    .replace(/[^a-zA-Z0-9\u0400-\u04FF_-]/g, '')
    .toUpperCase();
  const reportNumber = (params.reportNumber || `${cleanCode} ${year}-${month}`).replace(/^NEV[-_]/i, '');

  // Numbers & Defaults
  const platformKwh = round2(params.platformKwh);
  const grossRevenue = round2(params.grossRevenue);
  const sessionsCount = params.sessionsCount;

  // Meter reading and electricity costs are sent empty (null) by default for manual entry
  const meterKwh = params.meterKwh != null ? round2(params.meterKwh) : null;
  const electricityCost = params.electricityCost != null ? round2(params.electricityCost) : null;
  const qpayRate = params.qpayRate != null ? params.qpayRate : 0.01;
  const qpayFee = round2(grossRevenue * qpayRate);
  const otherDirectCosts = params.otherDirectCosts != null ? round2(params.otherDirectCosts) : 0;
  
  const initialElecCost = electricityCost != null ? electricityCost : 0;
  const totalDirectCost = round2(initialElecCost + qpayFee + otherDirectCosts);
  const distributableNet = round2(grossRevenue - totalDirectCost);

  const defaultClientShare =
    params.client?.feePercent != null ? round2((100 - params.client.feePercent) / 100) : 0.8;
  const clientShare = params.clientShare != null ? params.clientShare : defaultClientShare;
  const payoutAmount = round2(distributableNet * clientShare);

  const diffKwh = meterKwh != null ? round2(meterKwh - platformKwh) : null;
  const lossRatio = meterKwh != null && meterKwh > 0 ? (diffKwh ?? 0) / meterKwh : null;

  const meterDateStr = params.meterDate || '';
  const endDateShort = toParts.length >= 3 ? `${toParts[1]}/${toParts[2]}` : params.to;
  const meterDateShort = meterDateStr
    ? meterDateStr.includes(' ')
      ? meterDateStr.split(' ')[0].replace(/^\d{4}-/, '').replace('-', '/') + ' ' + meterDateStr.split(' ')[1]
      : endDateShort
    : '';

  // -------------------------------------------------------------------------
  // ROW 1: Empty
  ws.getRow(1).height = 10;

  // ROW 2: Main Banner Title (A2:H2)
  ws.getRow(2).height = 32;
  mergeAndStyle(ws, 2, 1, 2, 8, {
    value: 'EV ЦЭНЭГЛЭХ СТАНЦЫН ОРЛОГО ХУВААРИЛАЛТЫН ТАЙЛАН',
    font: { size: 14, bold: true, color: { argb: C_WHITE } },
    fill: solidFill(C_NAVY),
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder(C_SLATE_HEADER),
  });

  // ROW 3: Subtitle Period & Station (A3:H3)
  ws.getRow(3).height = 20;
  mergeAndStyle(ws, 3, 1, 3, 8, {
    value: `${params.from} – ${params.to} | ${stationName}`,
    font: { size: 10, bold: true, color: { argb: 'FFCBD5E1' } },
    fill: solidFill(C_SLATE_HEADER),
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder('FF475569'),
  });

  // ROW 4: Empty
  ws.getRow(4).height = 10;

  // ROW 5: Section Header 1 (A5:H5)
  ws.getRow(5).height = 24;
  mergeAndStyle(ws, 5, 1, 5, 8, {
    value: clientName ? `${clientName} — ТАЙЛАНГИЙН МЭДЭЭЛЭЛ` : 'ТАЙЛАНГИЙН МЭДЭЭЛЭЛ',
    font: { size: 10, bold: true, color: { argb: C_WHITE } },
    fill: solidFill(C_DARK_SLATE),
    alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    border: thinBorder(C_NAVY),
  });

  // ROWS 6 - 10: Metadata Table
  const infoRows = [
    {
      labelL: 'Тайлангийн дугаар',
      valL: reportNumber,
      labelR: 'Тайлан хүлээн авагч',
      valR: clientName,
    },
    {
      labelL: 'Тайлант хугацаа',
      valL: `${params.from}  - ${params.to}`,
      labelR: 'Үүрэг',
      valR: 'Станц эзэмшигч',
    },
    {
      labelL: 'Станц',
      valL: stationName,
      labelR: 'Оператор',
      valR: operatorName,
    },
    {
      labelL: 'Байршил',
      valL: st.address || 'Улаанбаатар',
      labelR: 'Платформ',
      valR: platformName,
    },
    {
      labelL: 'Тоолуурын заалтын огноо',
      valL: meterDateStr,
      labelR: 'Тайлангийн төлөв',
      valR: 'Эцсийн',
    },
  ];

  infoRows.forEach((item, idx) => {
    const r = 6 + idx;
    ws.getRow(r).height = 20;

    // Col A: Label Left
    setCellStyle(ws, r, 1, {
      value: item.labelL,
      font: { bold: true, size: 9, color: { argb: C_TEXT_LABEL } },
      fill: solidFill(C_LABEL_BG),
      alignment: { horizontal: 'left', indent: 1 },
      border: thinBorder(C_BORDER_LIGHT),
    });

    // Merge B:D: Value Left
    mergeAndStyle(ws, r, 2, r, 4, {
      value: item.valL,
      font: { size: 9.5, color: { argb: C_TEXT_DARK } },
      fill: solidFill(C_WHITE),
      alignment: { horizontal: 'left', indent: 1 },
      border: thinBorder(C_BORDER_LIGHT),
    });

    // Col E: Label Right
    setCellStyle(ws, r, 5, {
      value: item.labelR,
      font: { bold: true, size: 9, color: { argb: C_TEXT_LABEL } },
      fill: solidFill(C_LABEL_BG),
      alignment: { horizontal: 'left', indent: 1 },
      border: thinBorder(C_BORDER_LIGHT),
    });

    // Merge F:H: Value Right
    mergeAndStyle(ws, r, 6, r, 8, {
      value: item.valR,
      font: { size: 9.5, color: { argb: C_TEXT_DARK } },
      fill: solidFill(C_WHITE),
      alignment: { horizontal: 'left', indent: 1 },
      border: thinBorder(C_BORDER_LIGHT),
    });
  });

  // ROW 11: Empty
  ws.getRow(11).height = 10;

  // ROW 12: Section Header 2 (A12:H12)
  ws.getRow(12).height = 24;
  mergeAndStyle(ws, 12, 1, 12, 8, {
    value: 'ГОЛ ҮЗҮҮЛЭЛТ',
    font: { size: 10, bold: true, color: { argb: C_WHITE } },
    fill: solidFill(C_DARK_SLATE),
    alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    border: thinBorder(C_NAVY),
  });

  // ROW 13 & 14: KPI Stat Cards
  ws.getRow(13).height = 18;
  ws.getRow(14).height = 30;

  // Card 1: Дууссан сесс (A13:B14)
  mergeAndStyle(ws, 13, 1, 13, 2, {
    value: 'Дууссан сесс',
    font: { bold: true, size: 9, color: { argb: C_TEXT_LABEL } },
    fill: solidFill(C_SUBHEADER_BG),
    alignment: { horizontal: 'center' },
    border: thinBorder(C_BORDER),
  });
  mergeAndStyle(ws, 14, 1, 14, 2, {
    value: sessionsCount,
    font: { bold: true, size: 16, color: { argb: C_TEXT_DARK } },
    fill: solidFill(C_WHITE),
    alignment: { horizontal: 'center' },
    numFmt: '#,##0',
    border: thinBorder(C_BORDER),
  });

  // Card 2: Платформын хэрэглээ (C13:D14)
  mergeAndStyle(ws, 13, 3, 13, 4, {
    value: 'Платформын хэрэглээ (DC)',
    font: { bold: true, size: 9, color: { argb: C_AMBER_TXT } },
    fill: solidFill(C_AMBER_BG),
    alignment: { horizontal: 'center' },
    border: thinBorder(C_AMBER_BD),
  });
  mergeAndStyle(ws, 14, 3, 14, 4, {
    value: { formula: 'F20', result: platformKwh },
    font: { bold: true, size: 16, color: { argb: C_AMBER_VAL } },
    fill: solidFill('FFFFFBEB'),
    alignment: { horizontal: 'center' },
    numFmt: '#,##0.00 "кВтц"',
    border: thinBorder(C_AMBER_BD),
  });

  // Card 3: Тоолуурын хэрэглээ (E13:F14)
  mergeAndStyle(ws, 13, 5, 13, 6, {
    value: 'Тоолуурын хэрэглээ (ЭХ)',
    font: { bold: true, size: 9, color: { argb: C_BLUE_TXT } },
    fill: solidFill(C_BLUE_BG),
    alignment: { horizontal: 'center' },
    border: thinBorder(C_BLUE_BD),
  });
  mergeAndStyle(ws, 14, 5, 14, 6, {
    value: { formula: 'IF(F19="","",F19)', result: meterKwh != null ? meterKwh : '' },
    font: { bold: true, size: 16, color: { argb: C_BLUE_VAL } },
    fill: solidFill('FFF0F9FF'),
    alignment: { horizontal: 'center' },
    numFmt: '#,##0.00 "кВтц"',
    border: thinBorder(C_BLUE_BD),
  });

  // Card 4: Хуваарилах цэвэр орлого (G13:H14)
  mergeAndStyle(ws, 13, 7, 13, 8, {
    value: 'Хуваарилах цэвэр орлого',
    font: { bold: true, size: 9, color: { argb: C_EMERALD_TXT } },
    fill: solidFill(C_EMERALD_BG),
    alignment: { horizontal: 'center' },
    border: thinBorder(C_EMERALD_BD),
  });
  mergeAndStyle(ws, 14, 7, 14, 8, {
    value: { formula: 'B24', result: distributableNet },
    font: { bold: true, size: 16, color: { argb: C_EMERALD_VAL } },
    fill: solidFill('FFF0FDF4'),
    alignment: { horizontal: 'center' },
    numFmt: '#,##0 "₮"',
    border: thinBorder(C_EMERALD_BD),
  });

  // ROWS 15-16: Empty
  ws.getRow(15).height = 10;
  ws.getRow(16).height = 10;

  // ROW 17: Table Headers (A17:D17 and E17:H17)
  ws.getRow(17).height = 24;
  mergeAndStyle(ws, 17, 1, 17, 4, {
    value: 'ОРЛОГО, ЗАРДЛЫН ТООЦОО',
    font: { size: 10, bold: true, color: { argb: C_WHITE } },
    fill: solidFill(C_NAVY),
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder(C_SLATE_HEADER),
  });
  mergeAndStyle(ws, 17, 5, 17, 8, {
    value: 'ЭРЧИМ ХҮЧНИЙ ТУЛГАЛТ',
    font: { size: 10, bold: true, color: { argb: C_WHITE } },
    fill: solidFill(C_NAVY),
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder(C_SLATE_HEADER),
  });

  // ROW 18: Column Subheaders
  ws.getRow(18).height = 22;
  const subheaders = [
    { col: 1, text: 'Үзүүлэлт', align: 'left' },
    { col: 2, text: 'Дүн, ₮', align: 'right' },
    { col: 3, text: 'Эх үүсвэр', align: 'center' },
    { col: 4, text: 'Тайлбар', align: 'left' },
    { col: 5, text: 'Үзүүлэлт', align: 'left' },
    { col: 6, text: 'Утга', align: 'right' },
    { col: 7, text: 'Харьцаа', align: 'center' },
    { col: 8, text: 'Тайлбар', align: 'left' },
  ];
  subheaders.forEach((sh) => {
    setCellStyle(ws, 18, sh.col, {
      value: sh.text,
      font: { bold: true, size: 9, color: { argb: C_TEXT_LABEL } },
      fill: solidFill(C_SUBHEADER_BG),
      alignment: { horizontal: sh.align as ExcelJS.Alignment['horizontal'], indent: sh.align === 'left' ? 1 : 0 },
      border: {
        top: { style: 'thin', color: { argb: C_BORDER } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: C_BORDER } },
        right: { style: 'thin', color: { argb: C_BORDER } },
      },
    });
  });

  // Helper for financial data rows
  const setTableRow = (
    r: number,
    left: {
      name: string;
      val: ExcelJS.CellValue;
      source: string;
      desc: string;
      bold?: boolean;
      fillBg?: string;
      valColor?: string;
    },
    right: {
      name: string;
      val: ExcelJS.CellValue;
      ratio?: ExcelJS.CellValue;
      desc: string;
      bold?: boolean;
      fillBg?: string;
      ratioNumFmt?: string;
    },
  ) => {
    ws.getRow(r).height = 21;

    const bgL = left.fillBg ? solidFill(left.fillBg) : solidFill(r % 2 === 0 ? C_ZEBRA : C_WHITE);
    const bgR = right.fillBg ? solidFill(right.fillBg) : solidFill(r % 2 === 0 ? C_ZEBRA : C_WHITE);
    const borderL = thinBorder(C_BORDER_LIGHT);
    const borderR = thinBorder(C_BORDER_LIGHT);

    // Col A: Name
    setCellStyle(ws, r, 1, {
      value: left.name,
      font: { bold: left.bold || false, size: 9.5, color: { argb: left.valColor || C_TEXT_DARK } },
      fill: bgL,
      alignment: { horizontal: 'left', indent: 1 },
      border: borderL,
    });
    // Col B: Amount
    setCellStyle(ws, r, 2, {
      value: left.val,
      font: { bold: left.bold || false, size: 9.5, color: { argb: left.valColor || C_TEXT_DARK } },
      fill: bgL,
      alignment: { horizontal: 'right' },
      numFmt: '#,##0 "₮"',
      border: borderL,
    });
    // Col C: Source
    setCellStyle(ws, r, 3, {
      value: left.source,
      font: { size: 9, color: { argb: C_TEXT_MUTED } },
      fill: bgL,
      alignment: { horizontal: 'center' },
      border: borderL,
    });
    // Col D: Desc
    setCellStyle(ws, r, 4, {
      value: left.desc,
      font: { size: 9, color: { argb: C_TEXT_MUTED } },
      fill: bgL,
      alignment: { horizontal: 'left', indent: 1 },
      border: borderL,
    });

    // Col E: Name
    setCellStyle(ws, r, 5, {
      value: right.name,
      font: { bold: right.bold || false, size: 9.5, color: { argb: C_TEXT_DARK } },
      fill: bgR,
      alignment: { horizontal: 'left', indent: 1 },
      border: borderR,
    });
    // Col F: Value
    setCellStyle(ws, r, 6, {
      value: right.val,
      font: { bold: right.bold || false, size: 9.5, color: { argb: C_TEXT_DARK } },
      fill: bgR,
      alignment: { horizontal: 'right' },
      numFmt: '#,##0.00',
      border: borderR,
    });
    // Col G: Ratio
    setCellStyle(ws, r, 7, {
      value: right.ratio !== undefined ? right.ratio : '',
      font: { bold: true, size: 9, color: { argb: C_AMBER_VAL } },
      fill: bgR,
      alignment: { horizontal: 'center' },
      numFmt: right.ratioNumFmt || '0.00%',
      border: borderR,
    });
    // Col H: Desc
    setCellStyle(ws, r, 8, {
      value: right.desc,
      font: { size: 9, color: { argb: C_TEXT_MUTED } },
      fill: bgR,
      alignment: { horizontal: 'left', indent: 1 },
      border: borderR,
    });
  };

  // ROW 19: Цэнэглэлтийн орлого & Тоолуурын хэрэглээ
  setTableRow(
    19,
    {
      name: 'Цэнэглэлтийн орлого',
      val: grossRevenue,
      source: 'Платформын тайлан',
      desc: `${endDateShort} хүртэл`,
      bold: true,
    },
    {
      name: 'Тоолуурын хэрэглээ',
      val: meterKwh != null ? meterKwh : (null as any),
      desc: meterDateShort ? `${meterDateShort} хаалт` : '',
      bold: true,
    },
  );

  // ROW 20: Цахилгааны зардал & Платформын хэрэглээ
  setTableRow(
    20,
    {
      name: 'Цахилгааны зардал',
      val: electricityCost != null ? electricityCost : (null as any),
      source: 'Тоолуурын тооцоо',
      desc: 'Нэхэмжлэлийн дүн',
    },
    {
      name: 'Платформын хэрэглээ',
      val: platformKwh,
      desc: 'DC гаралт',
    },
  );

  // ROW 21: QPay шимтгэл & Шууд зөрүү
  setTableRow(
    21,
    {
      name: 'QPay шимтгэл',
      val: { formula: 'B19*0.01', result: qpayFee },
      source: 'Орлогын 1%',
      desc: 'Автомат',
    },
    {
      name: 'Шууд зөрүү',
      val: {
        formula: 'IF(F19="","",F19-F20)',
        result: diffKwh != null ? diffKwh : '',
      },
      desc: 'Тоолуур − платформ',
    },
  );

  // ROW 22: Бусад шууд зардал & Зөрүү/тоолуур
  setTableRow(
    22,
    {
      name: 'Бусад шууд зардал',
      val: otherDirectCosts,
      source: 'Баримтаар',
      desc: 'Одоогоор 0',
    },
    {
      name: 'Зөрүү/тоолуур',
      val: {
        formula: 'IF(OR(F19="",F19=0),"",F21/F19)',
        result: lossRatio != null ? lossRatio : '',
      },
      ratio: {
        formula: 'IF(OR(F19="",F19=0),"",F21/F19)',
        result: lossRatio != null ? lossRatio : '',
      },
      desc: 'Нийт хэрэглээнд эзлэх хувь',
      ratioNumFmt: '0.00%',
    },
  );

  // ROW 23: Нийт шууд зардал (Highlighted expense subtotal) & Тайлбарлагдаагүй үлдэгдэл
  setTableRow(
    23,
    {
      name: 'Нийт шууд зардал',
      val: { formula: 'SUM(B20:B22)', result: totalDirectCost },
      source: 'Автомат',
      desc: 'Цахилгаан + QPay',
      bold: true,
      fillBg: C_ROSE_BG,
      valColor: C_ROSE_TXT,
    },
    {
      name: 'Тайлбарлагдаагүй үлдэгдэл',
      val: 0,
      desc: 'Алдагдал ба туслах хэрэглээг хассаны дараа',
    },
  );

  // ROW 24: Хуваарилах цэвэр орлого (Highlighted Net Revenue) & Үлдэгдэл/тоолуур
  setTableRow(
    24,
    {
      name: 'Хуваарилах цэвэр орлого',
      val: { formula: 'B19-B23', result: distributableNet },
      source: 'Автомат',
      desc: 'Хувь тооцох суурь',
      bold: true,
      fillBg: 'FFECFDF5',
      valColor: 'FF065F46',
    },
    {
      name: 'Үлдэгдэл/тоолуур',
      val: 0,
      ratio: 0,
      desc: 'Хяналтын үзүүлэлт',
      ratioNumFmt: '0.00%',
    },
  );

  // Set double bottom borders on Row 24
  for (let c = 1; c <= 4; c++) {
    const cell = ws.getCell(24, c);
    cell.border = {
      ...cell.border,
      bottom: { style: 'double', color: { argb: C_EMERALD_DEEP_BD } },
    };
  }

  // ROW 25: Empty
  ws.getRow(25).height = 10;

  // ROW 26: Section Header 3: {Client} - ХУВААРИЛАЛТЫН ДҮН (A26:H26)
  ws.getRow(26).height = 24;
  mergeAndStyle(ws, 26, 1, 26, 8, {
    value: clientName ? `${clientName} — ХУВААРИЛАЛТЫН ДҮН` : 'ХУВААРИЛАЛТЫН ДҮН',
    font: { size: 10, bold: true, color: { argb: C_WHITE } },
    fill: solidFill(C_NAVY),
    alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    border: thinBorder(C_SLATE_HEADER),
  });

  // ROW 27: Хуваарилах цэвэр орлого
  ws.getRow(27).height = 20;
  setCellStyle(ws, 27, 1, {
    value: 'Хуваарилах цэвэр орлого',
    font: { bold: true, size: 9.5, color: { argb: C_TEXT_DARK } },
    fill: solidFill(C_LABEL_BG),
    alignment: { horizontal: 'left', indent: 1 },
    border: thinBorder(C_BORDER),
  });
  setCellStyle(ws, 27, 2, {
    value: { formula: 'B24', result: distributableNet },
    font: { bold: true, size: 10, color: { argb: C_TEXT_DARK } },
    fill: solidFill(C_LABEL_BG),
    alignment: { horizontal: 'right' },
    numFmt: '#,##0 "₮"',
    border: thinBorder(C_BORDER),
  });
  mergeAndStyle(ws, 27, 3, 27, 8, {
    value: '',
    fill: solidFill(C_WHITE),
    border: thinBorder(C_BORDER_LIGHT),
  });

  // ROW 28: Ногдох хувь
  ws.getRow(28).height = 20;
  setCellStyle(ws, 28, 1, {
    value: 'Ногдох хувь',
    font: { size: 9.5, color: { argb: C_TEXT_DARK } },
    fill: solidFill(C_WHITE),
    alignment: { horizontal: 'left', indent: 1 },
    border: thinBorder(C_BORDER),
  });
  setCellStyle(ws, 28, 2, {
    value: clientShare,
    font: { bold: true, size: 10, color: { argb: C_TEXT_DARK } },
    fill: solidFill(C_WHITE),
    alignment: { horizontal: 'right' },
    numFmt: '0.0%',
    border: thinBorder(C_BORDER),
  });
  mergeAndStyle(ws, 28, 3, 28, 8, {
    value: '',
    fill: solidFill(C_WHITE),
    border: thinBorder(C_BORDER_LIGHT),
  });

  // ROW 29: ТӨЛӨХ ДҮН (Hero payout box with prominent emerald styling)
  ws.getRow(29).height = 32;
  setCellStyle(ws, 29, 1, {
    value: 'ТӨЛӨХ ДҮН',
    font: { bold: true, size: 12, color: { argb: C_EMERALD_TXT } },
    fill: solidFill(C_EMERALD_BG),
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'medium', color: { argb: C_EMERALD_DEEP_BD } },
      bottom: { style: 'double', color: { argb: C_EMERALD_DEEP_BD } },
      left: { style: 'medium', color: { argb: C_EMERALD_DEEP_BD } },
      right: { style: 'thin', color: { argb: C_EMERALD_BD } },
    },
  });
  setCellStyle(ws, 29, 2, {
    value: { formula: 'B27*B28', result: payoutAmount },
    font: { bold: true, size: 15, color: { argb: C_EMERALD_VAL } },
    fill: solidFill(C_EMERALD_BG),
    alignment: { horizontal: 'right', vertical: 'middle' },
    numFmt: '#,##0 "₮"',
    border: {
      top: { style: 'medium', color: { argb: C_EMERALD_DEEP_BD } },
      bottom: { style: 'double', color: { argb: C_EMERALD_DEEP_BD } },
      left: { style: 'thin', color: { argb: C_EMERALD_BD } },
      right: { style: 'thin', color: { argb: C_EMERALD_BD } },
    },
  });
  mergeAndStyle(ws, 29, 3, 29, 8, {
    value: '✓ Хуваарилах цэвэр орлого × Ногдох хувь',
    font: { italic: true, size: 9.5, color: { argb: 'FF15803D' } },
    fill: solidFill(C_EMERALD_BG),
    alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    border: {
      top: { style: 'medium', color: { argb: C_EMERALD_DEEP_BD } },
      bottom: { style: 'double', color: { argb: C_EMERALD_DEEP_BD } },
      left: { style: 'thin', color: { argb: C_EMERALD_BD } },
      right: { style: 'medium', color: { argb: C_EMERALD_DEEP_BD } },
    },
  });

  // ROW 30: Empty
  ws.getRow(30).height = 10;

  // ROW 31: Тайлбар
  ws.getRow(31).height = 24;
  setCellStyle(ws, 31, 1, {
    value: 'Тайлбар:',
    font: { bold: true, size: 9, color: { argb: C_TEXT_LABEL } },
    fill: solidFill(C_SUBHEADER_BG),
    alignment: { horizontal: 'left', indent: 1 },
    border: thinBorder(C_BORDER),
  });
  mergeAndStyle(ws, 31, 2, 31, 8, {
    value:
      params.notes ||
      'Станц эзэмшигч болон операторын хооронд байгуулсан хамтын ажиллагааны гэрээний дагуу орлого хуваарилалтын тооцоог батлав.',
    font: { italic: true, size: 9, color: { argb: C_TEXT_MUTED } },
    fill: solidFill(C_WHITE),
    alignment: { horizontal: 'left', indent: 1 },
    border: thinBorder(C_BORDER_LIGHT),
  });

  return ws;
}

/**
 * Build Sheet 2: «Цэнэглэлтийн лог» with clear headers, zebra striping and total footer
 */
export function buildSessionsLogWorksheet(
  wb: ExcelJS.Workbook,
  sessions: RevenueReportSessionItem[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Цэнэглэлтийн лог', {
    views: [{ showGridLines: true }],
    properties: { defaultRowHeight: 20 },
  });

  const columns = [
    { header: '№', key: 'no', width: 7, align: 'center' },
    { header: 'Сеанс #', key: 'id', width: 11, align: 'center' },
    { header: 'Буу', key: 'connector', width: 9, align: 'center' },
    { header: 'Эхэлсэн огноо', key: 'start', width: 18, align: 'center' },
    { header: 'Дууссан огноо', key: 'stop', width: 18, align: 'center' },
    { header: 'Хугацаа (мин)', key: 'duration', width: 14, align: 'right', numFmt: '#,##0' },
    { header: 'Жолооч', key: 'driver', width: 18, align: 'left' },
    { header: 'Утас', key: 'phone', width: 14, align: 'center' },
    { header: 'И-мэйл', key: 'email', width: 22, align: 'left' },
    { header: 'Төрөл', key: 'driverType', width: 14, align: 'center' },
    { header: 'Карт / ID Tag', key: 'idTag', width: 16, align: 'left' },
    { header: 'Машин', key: 'vehicle', width: 18, align: 'left' },
    { header: 'VIN', key: 'vin', width: 20, align: 'left' },
    { header: 'Батерей (кВтц)', key: 'battery', width: 14, align: 'right', numFmt: '#,##0.0' },
    { header: 'Тоолуур эхлэл (Втц)', key: 'meterStart', width: 18, align: 'right', numFmt: '#,##0' },
    { header: 'Тоолуур төгсгөл (Втц)', key: 'meterStop', width: 18, align: 'right', numFmt: '#,##0' },
    { header: 'Эрчим хүч (кВтц)', key: 'kwh', width: 16, align: 'right', numFmt: '#,##0.00' },
    { header: 'Дундаж чадал (кВт)', key: 'power', width: 16, align: 'right', numFmt: '#,##0.0' },
    { header: 'SoC эхлэл', key: 'startSoc', width: 11, align: 'center' },
    { header: 'SoC төгсгөл', key: 'endSoc', width: 12, align: 'center' },
    { header: 'Тариф (₮/кВтц)', key: 'tariff', width: 15, align: 'right', numFmt: '#,##0 "₮"' },
    { header: 'Борлуулалт (₮)', key: 'gross', width: 16, align: 'right', numFmt: '#,##0 "₮"' },
    { header: 'Шимтгэл (₮)', key: 'fee', width: 15, align: 'right', numFmt: '#,##0 "₮"' },
    { header: 'Цэвэр орлого (₮)', key: 'net', width: 16, align: 'right', numFmt: '#,##0 "₮"' },
    { header: 'Төлбөрийн хэрэгсэл', key: 'provider', width: 18, align: 'center' },
    { header: 'Төлбөрийн төлөв', key: 'status', width: 15, align: 'center' },
    { header: 'Төлсөн (₮)', key: 'paid', width: 15, align: 'right', numFmt: '#,##0 "₮"' },
    { header: 'Буцаалт (₮)', key: 'refund', width: 15, align: 'right', numFmt: '#,##0 "₮"' },
    { header: 'И-баримт', key: 'ebarimt', width: 14, align: 'center' },
    { header: 'И-баримт ID', key: 'ebarimtId', width: 16, align: 'left' },
    { header: 'Зогсоосон шалтгаан', key: 'stopReason', width: 18, align: 'left' },
  ];

  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  // Header Row
  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  columns.forEach((c, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = c.header;
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: C_WHITE } };
    cell.fill = solidFill(C_NAVY);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(C_SLATE_HEADER);
  });

  // Data rows
  sessions.forEach((s, idx) => {
    const r = idx + 2;
    const row = ws.getRow(r);
    row.height = 20;
    const isEven = idx % 2 === 1;
    const bgFill = isEven ? solidFill(C_ZEBRA) : solidFill(C_WHITE);

    const values: (string | number)[] = [
      idx + 1,
      s.id,
      `Буу ${connectorLetter(s.connectorId)}`,
      formatDateTime(s.startTimestamp),
      formatDateTime(s.stopTimestamp),
      s.durationMin ?? 0,
      s.driverName || '',
      s.driverPhone || '',
      s.driverEmail || '',
      s.driverType || '',
      s.idTag || '',
      s.vehicle || '',
      s.vehicleVin || '',
      s.vehicleBatteryKwh != null ? round2(s.vehicleBatteryKwh) : '',
      s.meterStartWh ?? 0,
      s.meterStopWh ?? 0,
      round2(s.energyKwh),
      s.avgPowerKw != null ? round2(s.avgPowerKw) : '',
      s.startSocPercent != null ? `${s.startSocPercent}%` : '',
      s.endSocPercent != null ? `${s.endSocPercent}%` : '',
      s.tariffPerKwh != null ? round2(s.tariffPerKwh) : '',
      round2(s.cost),
      round2(s.feeAmount ?? 0),
      round2(s.clientNet ?? s.cost - (s.feeAmount ?? 0)),
      s.paymentProvider || '',
      s.paymentStatus || '',
      s.paidAmount != null ? round2(s.paidAmount) : '',
      s.refundAmount != null ? round2(s.refundAmount) : '',
      s.ebarimtStatus || '',
      s.ebarimtReceiptId || '',
      s.stopReason || '',
    ];

    values.forEach((v, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = v;
      const colDef = columns[colIdx];
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: C_TEXT_DARK } };
      cell.fill = bgFill;
      cell.alignment = {
        vertical: 'middle',
        horizontal: (colDef?.align || 'left') as ExcelJS.Alignment['horizontal'],
        indent: colDef?.align === 'left' ? 1 : 0,
      };
      if (colDef?.numFmt && typeof v === 'number') {
        cell.numFmt = colDef.numFmt;
      }
      cell.border = thinBorder(C_BORDER_LIGHT);
    });
  });

  // Total summary footer row
  const totalR = sessions.length + 3;
  const totalRow = ws.getRow(totalR);
  totalRow.height = 24;

  const totalDuration = sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
  const totalKwh = round2(sessions.reduce((sum, s) => sum + (s.energyKwh ?? 0), 0));
  const totalGross = round2(sessions.reduce((sum, s) => sum + (s.cost ?? 0), 0));
  const totalFee = round2(sessions.reduce((sum, s) => sum + (s.feeAmount ?? 0), 0));
  const totalNet = round2(sessions.reduce((sum, s) => sum + (s.clientNet ?? s.cost - (s.feeAmount ?? 0)), 0));
  const totalPaid = round2(sessions.reduce((sum, s) => sum + (s.paidAmount ?? 0), 0));
  const totalRefund = round2(sessions.reduce((sum, s) => sum + (s.refundAmount ?? 0), 0));
  const uniqueDrivers = new Set(sessions.map((s) => s.idTag).filter(Boolean)).size;

  for (let c = 1; c <= columns.length; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: C_TEXT_DARK } };
    cell.fill = solidFill(C_SUBHEADER_BG);
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: C_DARK_SLATE } },
      left: { style: 'thin', color: { argb: C_BORDER } },
      right: { style: 'thin', color: { argb: C_BORDER } },
    };
  }

  totalRow.getCell(1).value = 'НИЙТ';
  totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(2).value = `${sessions.length} сеанс`;
  totalRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(6).value = totalDuration;
  totalRow.getCell(6).numFmt = '#,##0';
  totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(7).value = `${uniqueDrivers} жолооч`;
  totalRow.getCell(7).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  totalRow.getCell(17).value = totalKwh;
  totalRow.getCell(17).numFmt = '#,##0.00';
  totalRow.getCell(17).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(22).value = totalGross;
  totalRow.getCell(22).numFmt = '#,##0 "₮"';
  totalRow.getCell(22).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(23).value = totalFee;
  totalRow.getCell(23).numFmt = '#,##0 "₮"';
  totalRow.getCell(23).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(24).value = totalNet;
  totalRow.getCell(24).numFmt = '#,##0 "₮"';
  totalRow.getCell(24).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(27).value = totalPaid;
  totalRow.getCell(27).numFmt = '#,##0 "₮"';
  totalRow.getCell(27).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(28).value = totalRefund;
  totalRow.getCell(28).numFmt = '#,##0 "₮"';
  totalRow.getCell(28).alignment = { horizontal: 'right', vertical: 'middle' };

  return ws;
}

/**
 * Builds the full styled 2-sheet workbook
 */
export async function buildStationRevenueWorkbook(
  params: RevenueReportParams,
  sessions: RevenueReportSessionItem[],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eplug.mn CSMS';
  wb.lastModifiedBy = 'Eplug Operator';
  wb.created = new Date();
  wb.modified = new Date();

  // Sheet 1: «Тайлан»
  buildRevenueReportWorksheet(wb, params);

  // Sheet 2: «Цэнэглэлтийн лог»
  buildSessionsLogWorksheet(wb, sessions);

  return wb;
}

/**
 * Browser download helper
 */
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
