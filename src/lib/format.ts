/** Display helpers. Everything here is safe on both server and client. */
import { EVENT } from './mn';

const NBSP = ' ';

export function formatNumber(value: number | undefined | null, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return value.toLocaleString('mn-MN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Watt-hours to a human kWh string. */
export function formatWh(wh: number | undefined | null, digits = 2): string {
  if (wh === undefined || wh === null || Number.isNaN(wh)) return '—';
  return `${formatNumber(wh / 1000, digits)}${NBSP}kWh`;
}

export function formatKwh(kwh: number | undefined | null, digits = 2): string {
  if (kwh === undefined || kwh === null || Number.isNaN(kwh)) return '—';
  return `${formatNumber(kwh, digits)}${NBSP}kWh`;
}

export function formatPower(watts: number | undefined | null): string {
  if (watts === undefined || watts === null || Number.isNaN(watts)) return '—';
  if (Math.abs(watts) >= 1000) return `${formatNumber(watts / 1000, 1)}${NBSP}kW`;
  return `${formatNumber(watts, 0)}${NBSP}W`;
}

/**
 * A connector's OCPP `connectorId` (1, 2, 3…) as the letter printed on its
 * sticker (A, B, C…) — the id itself never changes, this is display only.
 * Falls back to the plain number past Z, which no real charge point in this
 * network reaches (stations here have one or two connectors).
 */
export function connectorLetter(connectorId: number): string {
  if (!Number.isInteger(connectorId) || connectorId < 1) return String(connectorId);
  if (connectorId > 26) return String(connectorId);
  return String.fromCharCode(64 + connectorId);
}

/** Format phone number to clean Mongolian mobile without +976 or 976 prefix */
export function formatPhone(phone?: string | null): string {
  if (!phone) return '—';
  const clean = String(phone).replace(/^(\+976|976)/, '').trim();
  return clean || '—';
}

/** Formats amounts with two decimals and comma separation, without the ₮ symbol (e.g. 123,123.00) */
export function formatAmount(value: number | undefined | null, digits = 2): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '0.00';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Mongolian tögrög. The backend stores cost in whatever unit the tariff uses. */
export function formatMoney(value: number | undefined | null, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${formatNumber(value, digits)}${NBSP}₮`;
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${formatNumber(value, 0)}%`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDateTime(value?: string | Date | null, includeSeconds = true): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = includeSeconds
    ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${date} ${time}`;
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** "3 мин өмнө", "2 ц өмнө", "саяхан". */
export function formatRelative(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  const future = seconds < 0;
  const s = Math.abs(seconds);

  let text: string;
  if (s < 10) return 'саяхан';
  if (s < 60) text = `${s} сек`;
  else if (s < 3600) text = `${Math.floor(s / 60)} мин`;
  else if (s < 86400) text = `${Math.floor(s / 3600)} ц`;
  else if (s < 2592000) text = `${Math.floor(s / 86400)} өдөр`;
  else text = `${Math.floor(s / 2592000)} сар`;

  return future ? `${text} дараа` : `${text} өмнө`;
}

/** Elapsed time between two instants as `1ц 04м`. */
export function formatDuration(from?: string | Date | null, to?: string | Date | null): string {
  if (!from) return '—';
  const start = from instanceof Date ? from : new Date(from);
  const end = to ? (to instanceof Date ? to : new Date(to)) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';

  let seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;

  if (hours > 0) return `${hours}ц ${String(minutes).padStart(2, '0')}м`;
  if (minutes > 0) return `${minutes}м ${String(seconds).padStart(2, '0')}с`;
  return `${seconds}с`;
}

export function formatUptime(totalSeconds?: number | null): string {
  if (totalSeconds === undefined || totalSeconds === null) return '—';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days} өдөр ${hours} ц`;
  if (hours > 0) return `${hours} ц ${minutes} мин`;
  return `${minutes} мин`;
}

/** Pretty-print an OCPP payload for the log viewers. */
export function formatJson(value: unknown): string {
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Turn `transaction.metervalue` into its Mongolian label. */
export function humanizeEvent(name: string): string {
  if (EVENT[name]) return EVENT[name];
  const withoutDots = name.replace(/\./g, ' ');
  return withoutDots.charAt(0).toUpperCase() + withoutDots.slice(1);
}

export function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
