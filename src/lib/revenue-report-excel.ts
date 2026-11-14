import * as XLSX from 'xlsx';
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

function setCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  val: string | number | null | undefined,
  opts?: { f?: string; z?: string; t?: 's' | 'n' | 'b' },
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (val === null || val === undefined) {
    if (opts?.f) {
      ws[addr] = { t: 'n', f: opts.f, ...(opts.z ? { z: opts.z } : {}) };
    }
    return;
  }
  if (typeof val === 'number') {
    ws[addr] = {
      t: 'n',
      v: val,
      ...(opts?.f ? { f: opts.f } : {}),
      ...(opts?.z ? { z: opts.z } : {}),
    };
  } else {
    ws[addr] = {
      t: 's',
      v: String(val),
      ...(opts?.z ? { z: opts.z } : {}),
    };
  }
}

/**
 * Build Sheet 1: Exact EV Charging Station Revenue Allocation Report
 * («EV ЦЭНЭГЛЭХ СТАНЦЫН ОРЛОГО ХУВААРИЛАЛТЫН ТАЙЛАН»)
 */
export function buildRevenueReportSheet(params: RevenueReportParams): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  const st = params.station;
  const stationName = st.name || st.cpId;
  const clientName = params.client?.name || '';
  const operatorName = params.operatorName || 'Монголын Цэвэр Тээвэр Суурь Бүтцийн Хөгжлийн Холбоо ТББ';
  const platformName = params.platformName || 'Eplug.mn';

  // Format report number (e.g. NEV-META-2026-01)
  const toParts = params.to.split('-');
  const year = toParts[0] || String(new Date().getFullYear());
  const month = toParts[1] || '01';
  const cleanCode = (st.cpId || 'META').replace(/[^a-zA-Z0-9\u0400-\u04FF_-]/g, '').toUpperCase();
  const reportNumber = params.reportNumber || `NEV-${cleanCode}-${year}-${month}`;

  // Numbers
  const platformKwh = round2(params.platformKwh);
  const grossRevenue = round2(params.grossRevenue);
  const sessionsCount = params.sessionsCount;

  // Defaults:
  // If meter reading not manually set, defaults to platformKwh * 1.1 (10% standard conversion loss)
  const meterKwh = params.meterKwh != null ? round2(params.meterKwh) : round2(platformKwh * 1.1);
  // Electricity cost defaults to 50% of gross or calculated
  const electricityCost = params.electricityCost != null ? round2(params.electricityCost) : round2(grossRevenue * 0.5);
  const qpayRate = params.qpayRate != null ? params.qpayRate : 0.01;
  const qpayFee = round2(grossRevenue * qpayRate);
  const otherDirectCosts = params.otherDirectCosts != null ? round2(params.otherDirectCosts) : 0;
  const totalDirectCost = round2(electricityCost + qpayFee + otherDirectCosts);
  const distributableNet = round2(grossRevenue - totalDirectCost);

  // Client share: if client has feePercent (e.g. 20%), share is (100 - 20)/100 = 0.8
  const defaultClientShare =
    params.client?.feePercent != null
      ? round2((100 - params.client.feePercent) / 100)
      : 0.8;
  const clientShare = params.clientShare != null ? params.clientShare : defaultClientShare;
  const payoutAmount = round2(distributableNet * clientShare);

  const diffKwh = round2(meterKwh - platformKwh);
  const lossRatio = meterKwh > 0 ? diffKwh / meterKwh : 0;

  // Date labels
  const meterDateStr = params.meterDate || `${params.to} 23:59`;
  // Short month/day format like "11/12 хүртэл"
  const endDateShort = toParts.length >= 3 ? `${toParts[1]}/${toParts[2]}` : params.to;
  const meterDateShort = meterDateStr.includes(' ')
    ? meterDateStr.split(' ')[0].replace(/^\d{4}-/, '').replace('-', '/') + ' ' + meterDateStr.split(' ')[1]
    : endDateShort;

  // -------------------------------------------------------------------------
  // ROW 1: (r = 0) Empty
  // ROW 2: (r = 1) Main Title
  setCell(ws, 1, 0, 'EV ЦЭНЭГЛЭХ СТАНЦЫН ОРЛОГО ХУВААРИЛАЛТЫН ТАЙЛАН');

  // ROW 3: (r = 2) Period & Station Name
  setCell(ws, 2, 0, `${params.from}– ${params.to} | ${stationName}`);

  // ROW 4: (r = 3) Empty

  // ROW 5: (r = 4) Section Header: ТАЙЛАНГИЙН МЭДЭЭЛЭЛ
  setCell(ws, 4, 0, clientName ? `${clientName} — ТАЙЛАНГИЙН МЭДЭЭЛЭЛ` : 'ТАЙЛАНГИЙН МЭДЭЭЛЭЛ');

  // ROW 6: (r = 5) Report Info
  setCell(ws, 5, 0, 'Тайлангийн дугаар');
  setCell(ws, 5, 1, reportNumber);
  setCell(ws, 5, 4, 'Тайлан хүлээн авагч');
  setCell(ws, 5, 5, clientName || 'Станц эзэмшигч');

  // ROW 7: (r = 6)
  setCell(ws, 6, 0, 'Тайлант хугацаа');
  setCell(ws, 6, 1, `${params.from}  - ${params.to}`);
  setCell(ws, 6, 4, 'Үүрэг');
  setCell(ws, 6, 5, 'Станц эзэмшигч');

  // ROW 8: (r = 7)
  setCell(ws, 7, 0, 'Станц');
  setCell(ws, 7, 1, stationName);
  setCell(ws, 7, 4, 'Оператор');
  setCell(ws, 7, 5, operatorName);

  // ROW 9: (r = 8)
  setCell(ws, 8, 0, 'Байршил');
  setCell(ws, 8, 1, st.address || 'Улаанбаатар');
  setCell(ws, 8, 4, 'Платформ');
  setCell(ws, 8, 5, platformName);

  // ROW 10: (r = 9)
  setCell(ws, 9, 0, 'Тоолуурын заалтын огноо');
  setCell(ws, 9, 1, meterDateStr);
  setCell(ws, 9, 4, 'Тайлангийн төлөв');
  setCell(ws, 9, 5, 'Эцсийн');

  // ROW 11: (r = 10) Empty

  // ROW 12: (r = 11) Section Header: ГОЛ ҮЗҮҮЛЭЛТ
  setCell(ws, 11, 0, 'ГОЛ ҮЗҮҮЛЭЛТ');

  // ROW 13: (r = 12) KPI Headers
  setCell(ws, 12, 0, 'Дууссан сесс');
  setCell(ws, 12, 2, 'Платформын хэрэглээ');
  setCell(ws, 12, 4, 'Тоолуурын хэрэглээ');
  setCell(ws, 12, 6, 'Хуваарилах цэвэр орлого');

  // ROW 14: (r = 13) KPI Values (with live formulas linking to tables below)
  setCell(ws, 13, 0, sessionsCount, { z: '#,##0' });
  setCell(ws, 13, 2, platformKwh, { f: 'F20', z: '#,##0.00' });
  setCell(ws, 13, 4, meterKwh, { f: 'F19', z: '#,##0.00' });
  setCell(ws, 13, 6, distributableNet, { f: 'B24', z: '#,##0' });

  // ROW 15: (r = 14) Empty
  // ROW 16: (r = 15) Empty

  // ROW 17: (r = 16) Section Headers
  setCell(ws, 16, 0, 'ОРЛОГО, ЗАРДЛЫН ТООЦОО');
  setCell(ws, 16, 4, 'ЭРЧИМ ХҮЧНИЙ ТУЛГАЛТ');

  // ROW 18: (r = 17) Column Subheaders
  setCell(ws, 17, 0, 'Үзүүлэлт');
  setCell(ws, 17, 1, 'Дүн, ₮');
  setCell(ws, 17, 2, 'Эх үүсвэр');
  setCell(ws, 17, 3, 'Тайлбар');
  setCell(ws, 17, 4, 'Үзүүлэлт');
  setCell(ws, 17, 5, 'Утга');
  setCell(ws, 17, 6, 'Харьцаа');
  setCell(ws, 17, 7, 'Тайлбар');

  // ROW 19: (r = 18)
  // Left: Цэнэглэлтийн орлого
  setCell(ws, 18, 0, 'Цэнэглэлтийн орлого');
  setCell(ws, 18, 1, grossRevenue, { z: '#,##0' });
  setCell(ws, 18, 2, 'Платформын тайлан');
  setCell(ws, 18, 3, `${endDateShort} хүртэл`);
  // Right: Тоолуурын хэрэглээ
  setCell(ws, 18, 4, 'Тоолуурын хэрэглээ');
  setCell(ws, 18, 5, meterKwh, { z: '#,##0.00' });
  setCell(ws, 18, 6, null);
  setCell(ws, 18, 7, `${meterDateShort} хаалт`);

  // ROW 20: (r = 19)
  // Left: Цахилгааны зардал
  setCell(ws, 19, 0, 'Цахилгааны зардал');
  setCell(ws, 19, 1, electricityCost, { z: '#,##0' });
  setCell(ws, 19, 2, 'Тоолуурын тооцоо');
  setCell(ws, 19, 3, 'Нэхэмжлэлийн дүн');
  // Right: Платформын хэрэглээ
  setCell(ws, 19, 4, 'Платформын хэрэглээ');
  setCell(ws, 19, 5, platformKwh, { z: '#,##0.00' });
  setCell(ws, 19, 6, null);
  setCell(ws, 19, 7, 'DC гаралт');

  // ROW 21: (r = 20)
  // Left: QPay шимтгэл (1%)
  setCell(ws, 20, 0, 'QPay шимтгэл');
  setCell(ws, 20, 1, qpayFee, { f: 'B19*0.01', z: '#,##0' });
  setCell(ws, 20, 2, 'Орлогын 1%');
  setCell(ws, 20, 3, 'Автомат');
  // Right: Шууд зөрүү
  setCell(ws, 20, 4, 'Шууд зөрүү');
  setCell(ws, 20, 5, diffKwh, { f: 'F19-F20', z: '#,##0.00' });
  setCell(ws, 20, 6, null);
  setCell(ws, 20, 7, 'Тоолуур − платформ');

  // ROW 22: (r = 21)
  // Left: Бусад шууд зардал
  setCell(ws, 21, 0, 'Бусад шууд зардал');
  setCell(ws, 21, 1, otherDirectCosts, { z: '#,##0' });
  setCell(ws, 21, 2, 'Баримтаар');
  setCell(ws, 21, 3, 'Одоогоор 0');
  // Right: Зөрүү/тоолуур
  setCell(ws, 21, 4, 'Зөрүү/тоолуур');
  setCell(ws, 21, 5, lossRatio, { f: 'F21/F19', z: '0.00%' });
  setCell(ws, 21, 6, null);
  setCell(ws, 21, 7, 'Нийт хэрэглээнд эзлэх хувь');

  // ROW 23: (r = 22)
  // Left: Нийт шууд зардал
  setCell(ws, 22, 0, 'Нийт шууд зардал');
  setCell(ws, 22, 1, totalDirectCost, { f: 'B20+B21+B22', z: '#,##0' });
  setCell(ws, 22, 2, 'Автомат');
  setCell(ws, 22, 3, 'Цахилгаан + QPay');
  // Right: Тайлбарлагдаагүй үлдэгдэл
  setCell(ws, 22, 4, 'Тайлбарлагдаагүй үлдэгдэл');
  setCell(ws, 22, 5, 0, { z: '#,##0.00' });
  setCell(ws, 22, 6, null);
  setCell(ws, 22, 7, 'Алдагдал ба туслах хэрэглээг хассаны дараа');

  // ROW 24: (r = 23)
  // Left: Хуваарилах цэвэр орлого
  setCell(ws, 23, 0, 'Хуваарилах цэвэр орлого');
  setCell(ws, 23, 1, distributableNet, { f: 'B19-B23', z: '#,##0' });
  setCell(ws, 23, 2, 'Автомат');
  setCell(ws, 23, 3, 'Хувь тооцох суурь');
  // Right: Үлдэгдэл/тоолуур
  setCell(ws, 23, 4, 'Үлдэгдэл/тоолуур');
  setCell(ws, 23, 5, 0, { f: 'F23/F19', z: '0.00%' });
  setCell(ws, 23, 6, null);
  setCell(ws, 23, 7, 'Хяналтын үзүүлэлт');

  // ROW 25: (r = 24) Empty

  // ROW 26: (r = 25) Section Header: {Client} - ХУВААРИЛАЛТЫН ДҮН
  setCell(ws, 25, 0, clientName ? `${clientName} -  ХУВААРИЛАЛТЫН ДҮН` : 'ХУВААРИЛАЛТЫН ДҮН');

  // ROW 27: (r = 26)
  setCell(ws, 26, 0, 'Хуваарилах цэвэр орлого');
  setCell(ws, 26, 1, distributableNet, { f: 'B24', z: '#,##0' });

  // ROW 28: (r = 27)
  setCell(ws, 27, 0, 'Ногдох хувь');
  setCell(ws, 27, 1, clientShare, { z: '0.0%' });

  // ROW 29: (r = 28)
  setCell(ws, 28, 0, 'ТӨЛӨХ ДҮН');
  setCell(ws, 28, 1, payoutAmount, { f: 'B27*B28', z: '#,##0' });

  // ROW 30: (r = 29) Empty

  // ROW 31: (r = 30)
  setCell(ws, 30, 0, 'Тайлбар');
  if (params.notes) {
    setCell(ws, 30, 1, params.notes);
  }

  // -------------------------------------------------------------------------
  // Merged regions
  // -------------------------------------------------------------------------
  ws['!merges'] = [
    // A2:H2 (Title)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    // A3:H3 (Subtitle)
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    // A5:H5 (Report Info Header)
    { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } },
    // B6:D6, F6:H6
    { s: { r: 5, c: 1 }, e: { r: 5, c: 3 } },
    { s: { r: 5, c: 5 }, e: { r: 5, c: 7 } },
    // B7:D7, F7:H7
    { s: { r: 6, c: 1 }, e: { r: 6, c: 3 } },
    { s: { r: 6, c: 5 }, e: { r: 6, c: 7 } },
    // B8:D8, F8:H8
    { s: { r: 7, c: 1 }, e: { r: 7, c: 3 } },
    { s: { r: 7, c: 5 }, e: { r: 7, c: 7 } },
    // B9:D9, F9:H9
    { s: { r: 8, c: 1 }, e: { r: 8, c: 3 } },
    { s: { r: 8, c: 5 }, e: { r: 8, c: 7 } },
    // B10:D10, F10:H10
    { s: { r: 9, c: 1 }, e: { r: 9, c: 3 } },
    { s: { r: 9, c: 5 }, e: { r: 9, c: 7 } },
    // A12:H12 (ГОЛ ҮЗҮҮЛЭЛТ)
    { s: { r: 11, c: 0 }, e: { r: 11, c: 7 } },
    // Row 13 KPI labels: A13:B13, C13:D13, E13:F13, G13:H13
    { s: { r: 12, c: 0 }, e: { r: 12, c: 1 } },
    { s: { r: 12, c: 2 }, e: { r: 12, c: 3 } },
    { s: { r: 12, c: 4 }, e: { r: 12, c: 5 } },
    { s: { r: 12, c: 6 }, e: { r: 12, c: 7 } },
    // Row 14 KPI values: A14:B14, C14:D14, E14:F14, G14:H14
    { s: { r: 13, c: 0 }, e: { r: 13, c: 1 } },
    { s: { r: 13, c: 2 }, e: { r: 13, c: 3 } },
    { s: { r: 13, c: 4 }, e: { r: 13, c: 5 } },
    { s: { r: 13, c: 6 }, e: { r: 13, c: 7 } },
    // Row 17 Section headers: A17:D17, E17:H17
    { s: { r: 16, c: 0 }, e: { r: 16, c: 3 } },
    { s: { r: 16, c: 4 }, e: { r: 16, c: 7 } },
    // Row 26 Allocation header: A26:H26
    { s: { r: 25, c: 0 }, e: { r: 25, c: 7 } },
  ];

  // Column widths
  ws['!cols'] = [
    { wch: 28 }, // A
    { wch: 18 }, // B
    { wch: 20 }, // C
    { wch: 24 }, // D
    { wch: 28 }, // E
    { wch: 18 }, // F
    { wch: 12 }, // G
    { wch: 38 }, // H
  ];

  // Row heights (in points)
  ws['!rows'] = [
    { hpt: 15 }, // Row 1
    { hpt: 26 }, // Row 2 (Title)
    { hpt: 18 }, // Row 3 (Subtitle)
    { hpt: 10 }, // Row 4
    { hpt: 22 }, // Row 5 (Header)
    { hpt: 18 }, // Row 6
    { hpt: 18 }, // Row 7
    { hpt: 18 }, // Row 8
    { hpt: 18 }, // Row 9
    { hpt: 18 }, // Row 10
    { hpt: 12 }, // Row 11
    { hpt: 22 }, // Row 12 (ГОЛ ҮЗҮҮЛЭЛТ)
    { hpt: 18 }, // Row 13
    { hpt: 24 }, // Row 14 (KPI numbers)
    { hpt: 10 }, // Row 15
    { hpt: 10 }, // Row 16
    { hpt: 22 }, // Row 17 (Table Headers)
    { hpt: 18 }, // Row 18
    { hpt: 18 }, // Row 19
    { hpt: 18 }, // Row 20
    { hpt: 18 }, // Row 21
    { hpt: 18 }, // Row 22
    { hpt: 18 }, // Row 23
    { hpt: 18 }, // Row 24
    { hpt: 12 }, // Row 25
    { hpt: 22 }, // Row 26 (ХУВААРИЛАЛТЫН ДҮН)
    { hpt: 18 }, // Row 27
    { hpt: 18 }, // Row 28
    { hpt: 20 }, // Row 29 (ТӨЛӨХ ДҮН)
    { hpt: 12 }, // Row 30
    { hpt: 18 }, // Row 31
  ];

  ws['!ref'] = 'A1:H31';

  return ws;
}

/**
 * Build Sheet 2: Charging Sessions Log («Цэнэглэлтийн лог»)
 */
export function buildSessionsLogSheet(sessions: RevenueReportSessionItem[]): XLSX.WorkSheet {
  const headers = [
    '№',
    'Сеанс #',
    'Буу',
    'Эхэлсэн',
    'Дууссан',
    'Хугацаа (мин)',
    'Жолооч',
    'Утас',
    'И-мэйл',
    'Төрөл',
    'Карт / ID Tag',
    'Машин',
    'VIN',
    'Батерей (кВтц)',
    'Тоолуур эхлэл (Втц)',
    'Тоолуур төгсгөл (Втц)',
    'Эрчим хүч (кВтц)',
    'Дундаж чадал (кВт)',
    'SoC эхлэл %',
    'SoC төгсгөл %',
    'Тариф (₮/кВтц)',
    'Борлуулалт (₮)',
    'Шимтгэл (₮)',
    'Цэвэр орлого (₮)',
    'Төлбөрийн хэрэгсэл',
    'Төлбөрийн төлөв',
    'Төлсөн (₮)',
    'Буцаалт (₮)',
    'И-баримт',
    'И-баримт ID',
    'Зогсоосон шалтгаан',
  ];

  type CellVal = string | number | null | undefined;
  const rows: CellVal[][] = sessions.map((s, idx) => [
    idx + 1,
    s.id,
    `Буу ${connectorLetter(s.connectorId)}`,
    formatDateTime(s.startTimestamp),
    formatDateTime(s.stopTimestamp),
    s.durationMin ?? '',
    s.driverName || '',
    s.driverPhone || '',
    s.driverEmail || '',
    s.driverType || '',
    s.idTag || '',
    s.vehicle || '',
    s.vehicleVin || '',
    s.vehicleBatteryKwh != null ? round2(s.vehicleBatteryKwh) : '',
    s.meterStartWh ?? '',
    s.meterStopWh ?? '',
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
  ]);

  const totalDuration = sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
  const uniqueDrivers = new Set(sessions.map((s) => s.idTag).filter(Boolean)).size;
  const totalKwh = round2(sessions.reduce((sum, s) => sum + (s.energyKwh ?? 0), 0));
  const totalGross = round2(sessions.reduce((sum, s) => sum + (s.cost ?? 0), 0));
  const totalFee = round2(sessions.reduce((sum, s) => sum + (s.feeAmount ?? 0), 0));
  const totalNet = round2(sessions.reduce((sum, s) => sum + (s.clientNet ?? s.cost - (s.feeAmount ?? 0)), 0));
  const totalPaid = round2(sessions.reduce((sum, s) => sum + (s.paidAmount ?? 0), 0));
  const totalRefund = round2(sessions.reduce((sum, s) => sum + (s.refundAmount ?? 0), 0));

  const totalRow: CellVal[] = [
    'НИЙТ',
    `${sessions.length} сеанс`,
    '',
    '',
    '',
    totalDuration,
    `${uniqueDrivers} жолооч`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalKwh,
    '',
    '',
    '',
    '',
    totalGross,
    totalFee,
    totalNet,
    '',
    '',
    totalPaid,
    totalRefund,
    '',
    '',
    '',
  ];

  const clean = [headers, ...rows, [], totalRow].map((r) => r.map((v) => (v == null ? '' : v)));
  const ws = XLSX.utils.aoa_to_sheet(clean);

  // Apply number formatting to numeric cells
  clean.forEach((row, r) => {
    row.forEach((v, c) => {
      if (typeof v !== 'number' || c === 0 || c === 1) return; // skip №, session #
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = '#,##0.00';
    });
  });

  // Auto-fit column widths
  const width = Math.max(0, ...clean.map((r) => r.length));
  ws['!cols'] = Array.from({ length: width }, (_, c) => {
    const maxLen = clean.reduce((m, row) => Math.max(m, String(row[c] ?? '').length), 10);
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });

  return ws;
}

/**
 * Generates the full workbook with:
 * Sheet 1: «Тайлан» (EV ЦЭНЭГЛЭХ СТАНЦЫН ОРЛОГО ХУВААРИЛАЛТЫН ТАЙЛАН)
 * Sheet 2: «Цэнэглэлтийн лог»
 */
export function buildStationRevenueWorkbook(
  params: RevenueReportParams,
  sessions: RevenueReportSessionItem[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Орлого хуваарилалт (or Тайлан)
  const reportSheet = buildRevenueReportSheet(params);
  XLSX.utils.book_append_sheet(wb, reportSheet, 'Тайлан');

  // Sheet 2: Цэнэглэлтийн лог
  const logSheet = buildSessionsLogSheet(sessions);
  XLSX.utils.book_append_sheet(wb, logSheet, 'Цэнэглэлтийн лог');

  return wb;
}
