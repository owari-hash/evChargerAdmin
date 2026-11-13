import * as XLSX from 'xlsx';

export type ExcelCell = string | number | null | undefined;

/**
 * A worksheet from rows (first row = headers): auto-fit columns, and numbers shown as
 * 123,123.00 while the cells stay numeric so Excel can still sum them. Columns whose header
 * is in `plainHeaders` (IDs) keep plain number formatting.
 */
export function buildSheet(rows: ExcelCell[][], plainHeaders: string[] = ['№', 'Сеанс #']): XLSX.WorkSheet {
  const clean = rows.map((r) => r.map((v) => (v == null ? '' : v)));
  const ws = XLSX.utils.aoa_to_sheet(clean);
  const header = clean[0] ?? [];
  clean.forEach((row, r) =>
    row.forEach((v, c) => {
      if (typeof v !== 'number' || plainHeaders.includes(String(header[c]))) return;
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = '#,##0.00';
    }),
  );
  const width = Math.max(0, ...clean.map((r) => r.length));
  ws['!cols'] = Array.from({ length: width }, (_, c) => ({
    wch: Math.min(Math.max(...clean.map((row) => String(row[c] ?? '').length), 10) + 2, 60),
  }));
  return ws;
}

export function appendSheet(wb: XLSX.WorkBook, name: string, rows: ExcelCell[][], plainHeaders?: string[]) {
  XLSX.utils.book_append_sheet(wb, buildSheet(rows, plainHeaders), name);
}

/** Wallet ledger entry types in Mongolian. */
export const WALLET_ENTRY_LABEL: Record<string, string> = {
  TOPUP: 'Цэнэглэлт (орлого)',
  CHARGE: 'Зарцуулалт',
  REFUND: 'Буцаалт',
  ADJUSTMENT: 'Засвар',
  BONUS: 'Урамшуулал',
};

/** Local-midnight ISO bounds for a YYYY-MM-DD range (end is exclusive, next midnight). */
export function localDayStart(iso: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString() : undefined;
}
export function localDayEnd(iso: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1).toISOString() : undefined;
}
