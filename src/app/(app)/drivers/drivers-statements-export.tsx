'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { FileSpreadsheet } from 'lucide-react';
import { apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import { appendSheet, localDayEnd, localDayStart, WALLET_ENTRY_LABEL, type ExcelCell } from '@/lib/excel';
import type { ChargePoint } from '@/lib/types';
import { Button, Select } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { DateRangePicker, type DateRange } from '@/components/ui/date-picker';

interface WalletSummary {
  openingBalance: number;
  topups: number;
  bonuses: number;
  refunds: number;
  adjustmentsNet: number;
  charges: number;
  closingBalance: number;
  expectedClosing: number;
  ledgerMismatches: number;
  balanced: boolean;
  currentBalance: number;
  currentMatchesLedger: boolean | null;
}

/** Response of GET /drivers/export/statements. */
interface BulkStatements {
  station: { id: string; name: string; cpId: string } | null;
  drivers: {
    id: string;
    name: string;
    phone: string;
    email: string;
    vehicle: string;
    isInternal: boolean;
    cards: string[];
    sessions: number;
    energyKwh: number;
    cost: number;
    paidFromWallet: number;
    paidDirect: number;
    unknownPayment: number;
    stations: { stationName: string; cpId: string; sessions: number; energyKwh: number; cost: number }[];
    wallet: WalletSummary;
  }[];
  sessions: {
    id: number;
    driverName: string;
    driverPhone: string;
    stationName: string;
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
    at: string;
    driverName: string;
    driverPhone: string;
    type: string;
    delta: number;
    balanceAfter: number;
    transactionId: number | null;
    stationName: string;
    provider: string;
    description: string;
    consistent: boolean;
  }[];
}

const sum = <T,>(items: T[], f: (x: T) => number) => Math.round(items.reduce((a, x) => a + f(x), 0) * 100) / 100;

/** "Бүх жолоочийн хуулга" — many drivers' statements in one Excel workbook. */
export function DriversStatementsExport() {
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<DateRange>({ from: '', to: '' });
  const [stationId, setStationId] = React.useState('all');
  const [busy, setBusy] = React.useState(false);

  const { data: stationsData } = useSWR<{ data: ChargePoint[] }>(
    open ? apiUrl('charge-points', { limit: 200 }) : null,
    fetcher,
  );
  const stations = stationsData?.data ?? [];

  async function download() {
    setBusy(true);
    try {
      const data = await fetcher<BulkStatements>(
        apiUrl('drivers/export/statements', {
          from: range.from ? localDayStart(range.from) : undefined,
          to: range.to ? localDayEnd(range.to) : undefined,
          chargePointId: stationId === 'all' ? undefined : stationId,
        }),
      );
      if (!data.drivers.length) {
        toast.info('Сонгосон нөхцөлд жолооч олдсонгүй');
        return;
      }

      const periodLabel = range.from ? `${range.from} — ${range.to || range.from}` : 'Бүх хугацаа';
      const wb = XLSX.utils.book_new();
      const D = data.drivers;

      // 1. One row per driver: charging totals + wallet reconciliation
      const driverRows: ExcelCell[][] = [
        [
          '№', 'Жолооч', 'Утас', 'Машин', 'Карт', 'Цэнэглэлт', 'Станцын тоо', 'Станцууд', 'Эрчим хүч (кВтц)',
          'Дүн (₮)', 'Хэтэвчээс (₮)', 'Шууд төлсөн (₮)', 'Эхний үлдэгдэл (₮)', 'Данс цэнэглэсэн (₮)',
          'Урамшуулал (₮)', 'Буцаалт (₮)', 'Засвар (₮)', 'Зарцуулсан (₮)', 'Эцсийн үлдэгдэл (₮)',
          'Одоогийн үлдэгдэл (₮)',
        ],
        ...D.map((d, i) => [
          i + 1, d.name, d.phone, d.vehicle, d.cards.join(', '), d.sessions, d.stations.length,
          d.stations.map((s) => s.stationName).join(', '), d.energyKwh, d.cost, d.paidFromWallet, d.paidDirect,
          d.wallet.openingBalance, d.wallet.topups, d.wallet.bonuses, d.wallet.refunds, d.wallet.adjustmentsNet,
          d.wallet.charges, d.wallet.closingBalance, d.wallet.currentBalance,
        ]),
        [],
        [
          'НИЙТ', `${D.length} жолооч`, '', '', '', sum(D, (d) => d.sessions), '', '', sum(D, (d) => d.energyKwh),
          sum(D, (d) => d.cost), sum(D, (d) => d.paidFromWallet), sum(D, (d) => d.paidDirect),
          sum(D, (d) => d.wallet.openingBalance), sum(D, (d) => d.wallet.topups), sum(D, (d) => d.wallet.bonuses),
          sum(D, (d) => d.wallet.refunds), sum(D, (d) => d.wallet.adjustmentsNet), sum(D, (d) => d.wallet.charges),
          sum(D, (d) => d.wallet.closingBalance), sum(D, (d) => d.wallet.currentBalance),
        ],
        [],
        ['Хугацаа', periodLabel],
        ['Станцын шүүлт', data.station ? `${data.station.name} дээр цэнэглэсэн жолооч нар` : 'Бүх жолооч'],
        ['Татсан огноо', formatDateTime(new Date())],
      ];
      appendSheet(wb, 'Жолооч нар', driverRows);

      // 2. Driver × station
      const pairs = D.flatMap((d) => d.stations.map((s) => ({ d, s })));
      appendSheet(wb, 'Жолооч × Станц', [
        ['№', 'Жолооч', 'Утас', 'Станц', 'Станц ID', 'Цэнэглэлт', 'Эрчим хүч (кВтц)', 'Дүн (₮)'],
        ...pairs.map(({ d, s }, i) => [i + 1, d.name, d.phone, s.stationName, s.cpId, s.sessions, s.energyKwh, s.cost]),
        [],
        ['НИЙТ', '', '', '', '', sum(pairs, (p) => p.s.sessions), sum(pairs, (p) => p.s.energyKwh), sum(pairs, (p) => p.s.cost)],
      ]);

      // 3. Every session
      const S = data.sessions;
      appendSheet(wb, 'Цэнэглэлтүүд', [
        [
          '№', 'Сеанс #', 'Жолооч', 'Утас', 'Станц', 'Буу', 'Карт', 'Эхэлсэн', 'Дууссан', 'Эрчим хүч (кВтц)',
          'Тариф (₮/кВтц)', 'Дүн (₮)', 'Төлбөр', 'Хэтэвчээс (₮)', 'Шууд (₮)', 'Буцаалт (₮)', 'Төлөв',
        ],
        ...S.map((s, i) => [
          i + 1, s.id, s.driverName, s.driverPhone, s.stationName, s.connectorId, s.idTag,
          formatDateTime(s.startTimestamp), formatDateTime(s.stopTimestamp), s.energyKwh, s.tariffPerKwh, s.cost,
          s.paidBy, s.walletPaid, s.directPaid, s.refundAmount, s.status,
        ]),
        [],
        [
          'НИЙТ', `${S.length} цэнэглэлт`, '', '', '', '', '', '', '', sum(S, (s) => s.energyKwh), '',
          sum(S, (s) => s.cost), '', sum(S, (s) => s.walletPaid), sum(S, (s) => s.directPaid), sum(S, (s) => s.refundAmount),
        ],
      ]);

      // 4. Every wallet movement
      const L = data.ledger;
      appendSheet(wb, 'Хэтэвчний хуулга', [
        ['№', 'Огноо', 'Жолооч', 'Утас', 'Төрөл', 'Орлого (₮)', 'Зарлага (₮)', 'Үлдэгдэл (₮)', 'Сеанс #', 'Станц', 'Төлбөрийн хэрэгсэл', 'Тайлбар'],
        ...L.map((e, i) => [
          i + 1, formatDateTime(e.at), e.driverName, e.driverPhone, WALLET_ENTRY_LABEL[e.type] ?? e.type,
          e.delta > 0 ? e.delta : '', e.delta < 0 ? -e.delta : '', e.balanceAfter, e.transactionId, e.stationName,
          e.provider, e.description,
        ]),
        [],
        ['НИЙТ', '', '', '', `${L.length} гүйлгээ`, sum(L, (e) => Math.max(e.delta, 0)), sum(L, (e) => Math.max(-e.delta, 0))],
      ]);

      const tag = data.station ? data.station.cpId.replace(/[^\w-]+/g, '_') : 'all';
      XLSX.writeFile(wb, `eplug-drivers-${tag}-${range.from || 'all'}-${range.to || 'time'}.xlsx`);
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" />
        Хуулга Excel
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Жолооч нарын хуулга (Excel)"
        description="Олон жолоочийн цэнэглэлт, станц, хэтэвчний орлого, зарлага, үлдэгдлийг нэг файлд."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Болих
            </Button>
            <Button variant="primary" size="sm" className="gap-1.5" onClick={download} disabled={busy}>
              <FileSpreadsheet className="h-4 w-4" />
              {busy ? 'Бэлдэж байна…' : 'Excel татах'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <label className="block space-y-1">
            <span className="text-[var(--color-fg-muted)]">Хугацаа (хоосон бол бүх хугацаа)</span>
            <DateRangePicker
              className="w-full"
              value={range}
              onChange={(r) => setRange(r.from || r.to ? { from: r.from || r.to, to: r.to || r.from } : { from: '', to: '' })}
              placeholder="Бүх хугацаа"
              aria-label="Хуулгын хугацаа"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[var(--color-fg-muted)]">Станц</span>
            <Select value={stationId} onChange={(e) => setStationId(e.target.value)} className="w-full text-xs">
              <option value="all">Бүх жолооч</option>
              {stations.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name || cp.cpId} дээр цэнэглэсэн
                </option>
              ))}
            </Select>
          </label>
          <p className="text-[var(--color-fg-muted)]">
            Станц сонговол тэнд цэнэглэсэн жолооч нарыг гаргана. Тэдний бусад станцад хийсэн цэнэглэлт мөн харагдана.
          </p>
        </div>
      </Modal>
    </>
  );
}
