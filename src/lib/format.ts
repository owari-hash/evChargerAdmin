/** Display helpers. Everything here is safe on both server and client. */

const NBSP = ' ';

export function formatNumber(value: number | undefined | null, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', {
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

/** Mongolian tögrög. The backend stores cost in whatever unit the tariff uses. */
export function formatMoney(value: number | undefined | null, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${formatNumber(value, digits)}${NBSP}₮`;
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${formatNumber(value, 0)}%`;
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

/** "3m ago", "2h ago", "just now". */
export function formatRelative(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  const future = seconds < 0;
  const s = Math.abs(seconds);

  let text: string;
  if (s < 10) return 'just now';
  if (s < 60) text = `${s}s`;
  else if (s < 3600) text = `${Math.floor(s / 60)}m`;
  else if (s < 86400) text = `${Math.floor(s / 3600)}h`;
  else if (s < 2592000) text = `${Math.floor(s / 86400)}d`;
  else text = `${Math.floor(s / 2592000)}mo`;

  return future ? `in ${text}` : `${text} ago`;
}

/** Elapsed time between two instants as `1h 04m`. */
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

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

export function formatUptime(totalSeconds?: number | null): string {
  if (totalSeconds === undefined || totalSeconds === null) return '—';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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

/** Turn `transaction.metervalue` into `Transaction metervalue`. */
export function humanizeEvent(name: string): string {
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
