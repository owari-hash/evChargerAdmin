'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, FileSpreadsheet, MapPin, Wallet } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { buildSheet, localDayEnd, localDayStart, WALLET_ENTRY_LABEL, type ExcelCell } from '@/lib/excel';
import { formatAmount, formatDateTime, formatNumber } from '@/lib/format';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { DateRangePicker, type DateRange } from '@/components/ui/date-picker';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty } from '@/components/ui/table';

/** Response of GET /drivers/:id/statement. */
interface DriverStatement {
  driver: { id: string; name: string; phone: string; email: string; vehicle: string; isInternal: boolean; cards: string[] };
  walletHidden: boolean;
  totals: {
    sessions: number;
    stations: number;
    energyKwh: number;
    cost: number;
    paidFromWallet: number;
    paidDirect: number;
    unknownPayment: number;
  };
  wallet: {
    openingBalance: number;
    topups: number;
    bonuses: number;
    refunds: number;
    adjustmentsNet: number;
    charges: number;
    closingBalance: number;
    expectedClosing: number;
    balanced: boolean;
    ledgerMismatches: number;
    currentBalance: number;
    currentMatchesLedger: boolean | null;
    lifetimeToppedUp: number;
    lifetimeSpent: number;
  } | null;
  byStation: { stationId: string; stationName: string; cpId: string; sessions: number; energyKwh: number; cost: number; first: string; last: string }[];
  sessions: {
    id: number;
    stationName: string;
    cpId: string;
    connectorId: number;
    idTag: string;
    status: string;
    startTimestamp: string;
    stopTimestamp: string | null;
    energyKwh: number;
    tariffPerKwh: number | null;
    cost: number;
    refundAmount: number;
    paidBy: string;
    walletPaid: number;
    directPaid: number;
  }[];
  ledger: {
    id: string;
    at: string;
    type: string;
    amount: number;
    delta: number;
    balanceAfter: number;
    description: string;
    transactionId: number | null;
    stationName: string;
    provider: string;
    createdBy: string;
    consistent: boolean;
  }[];
}

const ENTRY_LABEL = WALLET_ENTRY_LABEL;
type Cell = ExcelCell;
const localStart = localDayStart;
const localEnd = localDayEnd;

export function DriverStatement({ driverId }: { driverId: string }) {
  const [range, setRange] = React.useState<DateRange>({ from: '', to: '' });
  const url = apiUrl(`drivers/${driverId}/statement`, {
    from: range.from ? localStart(range.from) : undefined,
    to: range.to ? localEnd(range.to) : undefined,
  });
  const { data, error, isLoading } = useSWR<DriverStatement>(url, fetcher, { keepPreviousData: true });
  const w = data?.wallet;
  const periodLabel = range.from ? `${range.from} — ${range.to || range.from}` : 'Бүх хугацаа';

  function exportExcel() {
    if (!data) return;
    try {
      const wb = XLSX.utils.book_new();
      const t = data.totals;
      const summary: Cell[][] = [
        ['Жолооч', data.driver.name],
        ['Утас', data.driver.phone],
        ['И-мэйл', data.driver.email],
        ['Машин', data.driver.vehicle],
        ['Карт / ID Tag', data.driver.cards.join(', ')],
        ['Хугацаа', periodLabel],
        ['Татсан огноо', formatDateTime(new Date())],
        [],
        ['ЦЭНЭГЛЭЛТ', ''],
        ['Цэнэглэлтийн тоо', t.sessions],
        ['Станцын тоо', t.stations],
        ['Нийт эрчим хүч (кВтц)', t.energyKwh],
        ['Нийт дүн (₮)', t.cost],
        ['Хэтэвчээс төлсөн (₮)', t.paidFromWallet],
        ['Шууд төлсөн (QPay г.м) (₮)', t.paidDirect],
        ['Төлбөр тодорхойгүй цэнэглэлт', t.unknownPayment],
      ];
      if (w) {
        summary.push(
          [],
          ['ХЭТЭВЧНИЙ ТУЛГАЛТ', ''],
          ['Эхний үлдэгдэл (₮)', w.openingBalance],
          ['+ Данс цэнэглэсэн (₮)', w.topups],
          ['+ Урамшуулал (₮)', w.bonuses],
          ['+ Буцаалт (₮)', w.refunds],
          ['± Засвар (₮)', w.adjustmentsNet],
          ['− Цэнэглэлтэд зарцуулсан (₮)', w.charges],
          ['= Тооцоолсон эцсийн үлдэгдэл (₮)', w.expectedClosing],
          ['Бүртгэлийн эцсийн үлдэгдэл (₮)', w.closingBalance],
          ['Одоогийн үлдэгдэл (₮)', w.currentBalance],
          ['Тулгалт', w.balanced ? 'Таарч байна' : `Зөрүүтэй (${w.ledgerMismatches} мөр)`],
        );
      }
      XLSX.utils.book_append_sheet(wb, buildSheet(summary), 'Хураангуй');

      XLSX.utils.book_append_sheet(
        wb,
        buildSheet([
          ['№', 'Станц', 'Станц ID', 'Цэнэглэлт', 'Эрчим хүч (кВтц)', 'Дүн (₮)', 'Анхны', 'Сүүлийн'],
          ...data.byStation.map((s, i) => [
            i + 1, s.stationName, s.cpId, s.sessions, s.energyKwh, s.cost, formatDateTime(s.first), formatDateTime(s.last),
          ]),
          [],
          ['НИЙТ', `${t.stations} станц`, '', t.sessions, t.energyKwh, t.cost],
        ]),
        'Станцаар',
      );

      XLSX.utils.book_append_sheet(
        wb,
        buildSheet([
          ['№', 'Сеанс #', 'Станц', 'Буу', 'Карт', 'Эхэлсэн', 'Дууссан', 'Эрчим хүч (кВтц)', 'Тариф (₮/кВтц)', 'Дүн (₮)', 'Төлбөр', 'Хэтэвчээс (₮)', 'Шууд (₮)', 'Буцаалт (₮)', 'Төлөв'],
          ...data.sessions.map((s, i) => [
            i + 1, s.id, s.stationName, s.connectorId, s.idTag, formatDateTime(s.startTimestamp),
            formatDateTime(s.stopTimestamp), s.energyKwh, s.tariffPerKwh, s.cost, s.paidBy, s.walletPaid,
            s.directPaid, s.refundAmount, s.status,
          ]),
          [],
          ['НИЙТ', `${t.sessions} цэнэглэлт`, '', '', '', '', '', t.energyKwh, '', t.cost, '', t.paidFromWallet, t.paidDirect,
            data.sessions.reduce((a, s) => a + s.refundAmount, 0)],
        ]),
        'Цэнэглэлтүүд',
      );

      if (w) {
        XLSX.utils.book_append_sheet(
          wb,
          buildSheet([
            ['№', 'Огноо', 'Төрөл', 'Орлого (₮)', 'Зарлага (₮)', 'Үлдэгдэл (₮)', 'Сеанс #', 'Станц', 'Төлбөрийн хэрэгсэл', 'Тайлбар', 'Тулгалт'],
            ['', '', 'Эхний үлдэгдэл', '', '', w.openingBalance],
            ...data.ledger.map((e, i) => [
              i + 1, formatDateTime(e.at), ENTRY_LABEL[e.type] ?? e.type, e.delta > 0 ? e.delta : '', e.delta < 0 ? -e.delta : '',
              e.balanceAfter, e.transactionId, e.stationName, e.provider, e.description, e.consistent ? '' : 'Зөрүүтэй',
            ]),
            [],
            ['НИЙТ', '', `${data.ledger.length} гүйлгээ`,
              data.ledger.reduce((a, e) => a + Math.max(e.delta, 0), 0),
              data.ledger.reduce((a, e) => a + Math.max(-e.delta, 0), 0),
              w.closingBalance],
          ], ['№', 'Сеанс #']),
          'Хэтэвчний хуулга',
        );
      }

      const who = (data.driver.phone || data.driver.id).replace(/[^\w-]+/g, '_');
      XLSX.writeFile(wb, `eplug-driver-${who}-${range.from || 'all'}-${range.to || 'time'}.xlsx`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Excel үүсгэхэд алдаа гарлаа');
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3.5 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[var(--color-brand)]" />
            Хуулга: станцаар ба хэтэвчний тулгалт
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)]">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            className="w-full sm:w-auto min-w-[14rem]"
            value={range}
            onChange={(r) => setRange(r.from || r.to ? { from: r.from || r.to, to: r.to || r.from } : { from: '', to: '' })}
            placeholder="Бүх хугацаа"
            aria-label="Хуулгын хугацаа"
          />
          <Button variant="primary" size="sm" className="gap-1.5" onClick={exportExcel} disabled={!data || isLoading}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Хуулга Excel
          </Button>
        </div>
      </div>

      {error ? (
        <p className="p-4 text-xs text-[var(--color-danger,#dc2626)]">Хуулга ачаалахад алдаа гарлаа</p>
      ) : null}

      {w ? (
        <div className="grid gap-3 border-b border-[var(--color-border)] p-4 sm:grid-cols-2 sm:p-5">
          <div className="space-y-1 text-xs font-mono">
            <Row label="Эхний үлдэгдэл" value={w.openingBalance} />
            <Row label="+ Данс цэнэглэсэн" value={w.topups} />
            {w.bonuses ? <Row label="+ Урамшуулал" value={w.bonuses} /> : null}
            {w.refunds ? <Row label="+ Буцаалт" value={w.refunds} /> : null}
            {w.adjustmentsNet ? <Row label="± Засвар" value={w.adjustmentsNet} /> : null}
            <Row label="− Цэнэглэлтэд зарцуулсан" value={-w.charges} />
            <div className="border-t border-[var(--color-border)] pt-1">
              <Row label="= Эцсийн үлдэгдэл" value={w.expectedClosing} bold />
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[var(--color-fg-muted)]" />
              <span>Одоогийн хэтэвч:</span>
              <span className="font-mono font-semibold">{formatAmount(w.currentBalance)}</span>
            </div>
            {w.balanced && w.currentMatchesLedger !== false ? (
              <Badge tone="ok" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Тулгалт таарч байна
              </Badge>
            ) : (
              <Badge tone="danger" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {w.ledgerMismatches
                  ? `Хэтэвчний ${w.ledgerMismatches} гүйлгээ зөрүүтэй`
                  : w.currentMatchesLedger === false
                    ? 'Одоогийн үлдэгдэл хуулгатай таарахгүй'
                    : 'Тулгалт зөрүүтэй'}
              </Badge>
            )}
            {data && data.totals.unknownPayment > 0 ? (
              <p className="text-[var(--color-fg-muted)]">
                {data.totals.unknownPayment} цэнэглэлтийн төлбөрийн бүртгэл олдсонгүй
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Станц</TH>
              <TH align="right" className="text-right">Цэнэглэлт</TH>
              <TH align="right" className="text-right">кВтц</TH>
              <TH align="right" className="text-right">Дүн</TH>
              <TH>Сүүлийн</TH>
            </TR>
          </THead>
          <TBody>
            {!data?.byStation.length ? (
              <TableEmpty colSpan={5}>{isLoading ? 'Ачаалж байна…' : 'Цэнэглэлт олдсонгүй'}</TableEmpty>
            ) : (
              <>
                {data.byStation.map((s) => (
                  <TR key={s.stationId}>
                    <TD className="text-xs">{s.stationName}</TD>
                    <TD align="right" className="text-right font-mono text-xs">{formatNumber(s.sessions)}</TD>
                    <TD align="right" className="text-right font-mono text-xs">{formatNumber(s.energyKwh, 2)}</TD>
                    <TD align="right" className="text-right font-mono text-xs">{formatAmount(s.cost)}</TD>
                    <TD className="font-mono text-xs text-[var(--color-fg-muted)]">{formatDateTime(s.last, false)}</TD>
                  </TR>
                ))}
                <TR>
                  <TD className="text-xs font-semibold">НИЙТ</TD>
                  <TD align="right" className="text-right font-mono text-xs font-semibold">{formatNumber(data.totals.sessions)}</TD>
                  <TD align="right" className="text-right font-mono text-xs font-semibold">{formatNumber(data.totals.energyKwh, 2)}</TD>
                  <TD align="right" className="text-right font-mono text-xs font-semibold">{formatAmount(data.totals.cost)}</TD>
                  <TD />
                </TR>
              </>
            )}
          </TBody>
        </Table>
      </TableWrap>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? 'font-semibold' : ''}`}>
      <span className="font-sans text-[var(--color-fg-muted)]">{label}</span>
      <span>{formatAmount(value)}</span>
    </div>
  );
}
