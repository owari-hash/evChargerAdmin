/**
 * Types mirroring the CSMS backend (evChargerBack/src/models). Kept hand-written
 * and narrow: the console only relies on fields the API actually documents.
 */

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export const USER_ROLES: UserRole[] = ['ADMIN', 'OPERATOR', 'VIEWER'];

export type RegistrationStatus = 'Accepted' | 'Pending' | 'Rejected';
export const REGISTRATION_STATUSES: RegistrationStatus[] = ['Accepted', 'Pending', 'Rejected'];

export type ConnectorStatus =
  | 'Available'
  | 'Preparing'
  | 'Charging'
  | 'SuspendedEV'
  | 'SuspendedEVSE'
  | 'Finishing'
  | 'Reserved'
  | 'Unavailable'
  | 'Faulted';

export const CONNECTOR_STATUSES: ConnectorStatus[] = [
  'Available',
  'Preparing',
  'Charging',
  'SuspendedEV',
  'SuspendedEVSE',
  'Finishing',
  'Reserved',
  'Unavailable',
  'Faulted',
];

export type ChargePointErrorCode =
  | 'ConnectorLockFailure'
  | 'EVCommunicationError'
  | 'GroundFailure'
  | 'HighTemperature'
  | 'InternalError'
  | 'LocalListConflict'
  | 'NoError'
  | 'OtherError'
  | 'OverCurrentFailure'
  | 'OverVoltage'
  | 'PowerMeterFailure'
  | 'PowerSwitchFailure'
  | 'ReaderFailure'
  | 'ResetFailure'
  | 'UnderVoltage'
  | 'WeakSignal';

export type AuthorizationStatus = 'Accepted' | 'Blocked' | 'Expired' | 'Invalid' | 'ConcurrentTx';
export const AUTHORIZATION_STATUSES: AuthorizationStatus[] = [
  'Accepted',
  'Blocked',
  'Expired',
  'Invalid',
  'ConcurrentTx',
];

export type TransactionStatus = 'Active' | 'Completed' | 'Rejected';
export const TRANSACTION_STATUSES: TransactionStatus[] = ['Active', 'Completed', 'Rejected'];

export type ReservationState = 'Active' | 'Used' | 'Cancelled' | 'Expired' | 'Rejected';
export const RESERVATION_STATES: ReservationState[] = [
  'Active',
  'Used',
  'Cancelled',
  'Expired',
  'Rejected',
];

export type CertificateType =
  | 'CentralSystemRootCertificate'
  | 'ManufacturerRootCertificate'
  | 'ChargePointCertificate';
export const CERTIFICATE_TYPES: CertificateType[] = [
  'CentralSystemRootCertificate',
  'ManufacturerRootCertificate',
  'ChargePointCertificate',
];

export type CsrStatus = 'Pending' | 'Signed' | 'Rejected' | 'Delivered' | 'Failed';
export type CommandStatus = 'Pending' | 'Sent' | 'Success' | 'Failed' | 'TimedOut';
export type MessageDirection = 'IN' | 'OUT';

export type StopReason =
  | 'EmergencyStop'
  | 'EVDisconnected'
  | 'HardReset'
  | 'Local'
  | 'Other'
  | 'PowerLoss'
  | 'Reboot'
  | 'Remote'
  | 'SoftReset'
  | 'UnlockCommand'
  | 'DeAuthorized';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface User extends SessionUser {
  name?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Connector {
  id: string;
  _id?: string;
  chargePointId: string;
  connectorId: number;
  status: ConnectorStatus;
  errorCode: ChargePointErrorCode;
  info?: string;
  vendorId?: string;
  vendorErrorCode?: string;
  statusTimestamp?: string;
  availability: 'Operative' | 'Inoperative';
  currentTransactionId: number | null;
  lastMeterWh?: number;
  lastPowerW?: number;
  lastSocPercent?: number;
  updatedAt: string;
}

export interface ChargePoint {
  id: string;
  _id?: string;
  name?: string;
  description?: string;
  chargePointVendor?: string;
  chargePointModel?: string;
  chargePointSerialNumber?: string;
  chargeBoxSerialNumber?: string;
  firmwareVersion?: string;
  iccid?: string;
  imsi?: string;
  meterType?: string;
  meterSerialNumber?: string;
  registrationStatus: RegistrationStatus;
  securityProfile: number;
  ocppProtocol?: string;
  isEnabled: boolean;
  isOnline: boolean;
  lastSeenAt?: string;
  lastBootAt?: string;
  lastHeartbeatAt?: string;
  disconnectedAt?: string;
  heartbeatInterval: number;
  remoteAddress?: string;
  numberOfConnectors: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  tariffPerKwh?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  connectors?: Connector[];
}

export interface ConfigurationKey {
  _id: string;
  chargePointId: string;
  key: string;
  value?: string;
  readonly?: boolean;
  known?: boolean;
  updatedAt: string;
}

export interface ChargePointDetail extends ChargePoint {
  connectors: Connector[];
  activeTransactions: Transaction[];
  configuration: ConfigurationKey[];
}

export interface Transaction {
  id: number;
  transactionId: number;
  _id?: number;
  chargePointId: string;
  connectorId: number;
  idTag: string;
  status: TransactionStatus;
  meterStart: number;
  meterStop?: number;
  energyWh: number;
  startTimestamp: string;
  stopTimestamp?: string;
  stopReason?: StopReason;
  stopIdTag?: string;
  reservationId?: number;
  startedRemotely: boolean;
  stoppedRemotely: boolean;
  lastMeterWh?: number;
  lastPowerW?: number;
  lastSocPercent?: number;
  lastMeterValueAt?: string;
  tariffPerKwh?: number;
  cost?: number;
}

export interface SampledValue {
  value: string;
  context?: string;
  format?: string;
  measurand?: string;
  phase?: string;
  location?: string;
  unit?: string;
}

export interface MeterValue {
  _id: string;
  chargePointId: string;
  connectorId: number;
  transactionId?: number;
  timestamp: string;
  sampledValue: SampledValue[];
}

export interface IdTag {
  idTag: string;
  _id?: string;
  parentIdTag?: string;
  status: AuthorizationStatus;
  expiryDate?: string;
  label?: string;
  ownerName?: string;
  ownerEmail?: string;
  maxActiveTransactions: number;
  allowedChargePointIds?: string[];
  note?: string;
  activeTransactions?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: number;
  reservationId: number;
  _id?: number;
  chargePointId: string;
  connectorId: number;
  idTag: string;
  parentIdTag?: string;
  expiryDate: string;
  state: ReservationState;
  transactionId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChargingProfile {
  _id: string;
  chargePointId: string;
  connectorId: number;
  chargingProfileId: number;
  stackLevel?: number;
  chargingProfilePurpose?: string;
  chargingProfileKind?: string;
  recurrencyKind?: string;
  validFrom?: string;
  validTo?: string;
  transactionId?: number;
  chargingSchedule?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  _id: string;
  chargePointId: string;
  kind: string;
  status?: string;
  location?: string;
  fileName?: string;
  requestId?: number;
  retrieveDate?: string;
  startTime?: string;
  stopTime?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityEvent {
  _id: string;
  chargePointId: string;
  type: string;
  techInfo?: string;
  timestamp: string;
  isCritical: boolean;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface CertificateRecord {
  _id: string;
  chargePointId?: string;
  type: CertificateType;
  serialNumber?: string;
  issuerNameHash?: string;
  issuerKeyHash?: string;
  hashAlgorithm?: string;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  pem?: string;
  createdAt: string;
}

export interface CsrRequest {
  _id: string;
  chargePointId: string;
  csrPem: string;
  status: CsrStatus;
  certificatePem?: string;
  signedBy?: string;
  signedAt?: string;
  rejectedReason?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OcppMessageLog {
  _id: string;
  chargePointId: string;
  direction: MessageDirection;
  messageType: number;
  messageId: string;
  action?: string;
  payload?: unknown;
  errorCode?: string;
  timestamp: string;
}

export interface CommandLog {
  _id: string;
  chargePointId: string;
  action: string;
  payload?: unknown;
  response?: unknown;
  status: CommandStatus;
  error?: string;
  issuedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// API envelopes
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface StatsOverview {
  chargePoints: { total: number; online: number; offline: number };
  liveConnections: number;
  connectors: Partial<Record<ConnectorStatus, number>>;
  transactions: { active: number; last24h: number; completedLast24h: number };
  energyLast24hKwh: number;
  revenueLast24h: number;
  unacknowledgedCriticalSecurityEvents: number;
}

export interface EnergySeriesPoint {
  date: string;
  energyKwh: number;
  sessions: number;
  cost: number;
}

export interface TopChargePoint {
  chargePointId: string;
  energyKwh: number;
  sessions: number;
  cost: number;
}

export interface HealthResponse {
  status: string;
  uptimeSeconds: number;
  database: string;
  chargePointsOnline: number;
  timestamp: string;
}

export interface ApiDiscovery {
  name: string;
  ocppVersion: string;
  transport: string;
  securityProfile: number;
  websocketPath: string;
  supportedActions: string[];
  endpoints: Record<string, string>;
}

/** Live SSE payload. `event` is the OCPP-domain event name. */
export interface CsmsEvent {
  event: string;
  chargePointId?: string;
  at?: string;
  [key: string]: unknown;
}

export const LIVE_EVENT_NAMES = [
  'chargepoint.connected',
  'chargepoint.disconnected',
  'chargepoint.boot',
  'chargepoint.heartbeat',
  'connector.status',
  'transaction.started',
  'transaction.stopped',
  'transaction.metervalue',
  'security.event',
  'firmware.status',
  'diagnostics.status',
  'log.status',
  'command.result',
  'ocpp.message',
] as const;

// ---------------------------------------------------------------------------
// QPay QuickQR merchants (backend: /api/qpay/*)
// ---------------------------------------------------------------------------

/** Aimag/hot and sum/duureg entries, as returned by QuickQR. */
export interface QpayLocation {
  code?: string;
  name?: string;
}

/**
 * A QuickQR merchant. QPay returns a loose object whose exact fields differ
 * between the person and company variants, so everything is optional and the
 * console falls back to whatever is present.
 */
export interface QpayMerchant {
  merchant_id?: string;
  register_number?: string;
  company_name?: string;
  business_name?: string;
  name?: string;
  name_eng?: string;
  first_name?: string;
  last_name?: string;
  mcc_code?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  [key: string]: unknown;
}

export type QpayMerchantKind = 'person' | 'company';

/** POST /api/qpay/merchants/person */
export interface QpayPersonMerchantInput {
  register_number: string;
  first_name: string;
  last_name: string;
  business_name: string;
  mcc_code: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  email: string;
}

/** POST /api/qpay/merchants/company */
export interface QpayCompanyMerchantInput {
  register_number: string;
  company_name: string;
  name: string;
  mcc_code: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  email: string;
}

/** GET /api/payments/config — used to tell "not configured" from "broken". */
export interface PaymentsConfig {
  enabled: boolean;
  mode: 'sandbox' | 'production';
  quickQrEnabled: boolean;
  invoiceTtlMinutes: number;
  credentialsConfigured: boolean;
  tokens: { scope: string; cached: boolean; accessExpiresAt?: string }[];
}
