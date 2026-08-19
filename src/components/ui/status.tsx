import * as React from 'react';
import { Badge, Dot, type Tone } from './primitives';
import * as L from '@/lib/mn';
import type {
  AuthorizationStatus,
  CommandStatus,
  ConnectorStatus,
  CsrStatus,
  RegistrationStatus,
  ReservationState,
  TransactionStatus,
} from '@/lib/types';

/** OCPP connector states mapped to the palette. Charging is the "good, active" state. */
const CONNECTOR_TONES: Record<ConnectorStatus, Tone> = {
  Available: 'ok',
  Preparing: 'info',
  Charging: 'brand',
  SuspendedEV: 'warn',
  SuspendedEVSE: 'warn',
  Finishing: 'info',
  Reserved: 'info',
  Unavailable: 'idle',
  Faulted: 'danger',
};

export function connectorTone(status?: ConnectorStatus | string): Tone {
  return CONNECTOR_TONES[status as ConnectorStatus] ?? 'idle';
}

export function ConnectorStatusBadge({ status }: { status?: ConnectorStatus | string }) {
  if (!status) return <span className="text-[var(--color-fg-subtle)]">—</span>;
  const tone = connectorTone(status);
  return (
    <Badge tone={tone}>
      <Dot tone={tone} pulse={status === 'Charging'} />
      {L.mn(L.CONNECTOR_STATUS, status)}
    </Badge>
  );
}

export function OnlineBadge({ online }: { online: boolean }) {
  return (
    <Badge tone={online ? 'ok' : 'idle'}>
      <Dot tone={online ? 'ok' : 'idle'} pulse={online} />
      {online ? 'Онлайн' : 'Офлайн'}
    </Badge>
  );
}

const TRANSACTION_TONES: Record<TransactionStatus, Tone> = {
  Active: 'brand',
  Completed: 'idle',
  Rejected: 'danger',
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus | string }) {
  const tone = TRANSACTION_TONES[status as TransactionStatus] ?? 'idle';
  return (
    <Badge tone={tone}>
      <Dot tone={tone} pulse={status === 'Active'} />
      {L.mn(L.TRANSACTION_STATUS, status)}
    </Badge>
  );
}

const AUTH_TONES: Record<AuthorizationStatus, Tone> = {
  Accepted: 'ok',
  Blocked: 'danger',
  Expired: 'warn',
  Invalid: 'danger',
  ConcurrentTx: 'warn',
};

export function AuthStatusBadge({ status }: { status: AuthorizationStatus | string }) {
  return <Badge tone={AUTH_TONES[status as AuthorizationStatus] ?? 'idle'}>{L.mn(L.AUTH_STATUS, status)}</Badge>;
}

const REGISTRATION_TONES: Record<RegistrationStatus, Tone> = {
  Accepted: 'ok',
  Pending: 'warn',
  Rejected: 'danger',
};

export function RegistrationBadge({ status }: { status: RegistrationStatus | string }) {
  return (
    <Badge tone={REGISTRATION_TONES[status as RegistrationStatus] ?? 'idle'}>
      {L.mn(L.REGISTRATION_STATUS, status)}
    </Badge>
  );
}

const RESERVATION_TONES: Record<ReservationState, Tone> = {
  Active: 'brand',
  Used: 'ok',
  Cancelled: 'idle',
  Expired: 'warn',
  Rejected: 'danger',
};

export function ReservationBadge({ state }: { state: ReservationState | string }) {
  return <Badge tone={RESERVATION_TONES[state as ReservationState] ?? 'idle'}>{L.mn(L.RESERVATION_STATE, state)}</Badge>;
}

const COMMAND_TONES: Record<CommandStatus, Tone> = {
  Pending: 'idle',
  Sent: 'info',
  Success: 'ok',
  Failed: 'danger',
  TimedOut: 'warn',
};

export function CommandStatusBadge({ status }: { status: CommandStatus | string }) {
  return <Badge tone={COMMAND_TONES[status as CommandStatus] ?? 'idle'}>{L.mn(L.COMMAND_STATUS, status)}</Badge>;
}

const CSR_TONES: Record<CsrStatus, Tone> = {
  Pending: 'warn',
  Signed: 'ok',
  Delivered: 'brand',
  Rejected: 'idle',
  Failed: 'danger',
};

export function CsrStatusBadge({ status }: { status: CsrStatus | string }) {
  return <Badge tone={CSR_TONES[status as CsrStatus] ?? 'idle'}>{L.mn(L.CSR_STATUS, status)}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const tone: Tone = role === 'ADMIN' ? 'brand' : role === 'OPERATOR' ? 'info' : 'idle';
  return <Badge tone={tone}>{L.mn(L.ROLE, role)}</Badge>;
}

/** OCPP error codes: anything other than NoError deserves attention. */
export function ErrorCodeBadge({ code }: { code?: string }) {
  if (!code || code === 'NoError') {
    return <span className="text-xs text-[var(--color-fg-subtle)]">Алдаагүй</span>;
  }
  return <Badge tone="danger">{code}</Badge>;
}

export function SecurityCriticality({ critical }: { critical: boolean }) {
  return <Badge tone={critical ? 'danger' : 'idle'}>{critical ? 'Ноцтой' : 'Мэдээллийн'}</Badge>;
}
