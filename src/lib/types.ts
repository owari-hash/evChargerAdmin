/**
 * Types mirroring the CSMS backend (evChargerBack/src/models). Kept hand-written
 * and narrow: the console only relies on fields the API actually documents.
 */

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER' | 'CLIENT';

export const USER_ROLES: UserRole[] = ['ADMIN', 'OPERATOR', 'VIEWER', 'CLIENT'];

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

export type TransactionStatus = 'Active' | 'Completed' | 'Rejected' | 'Refunded';
export const TRANSACTION_STATUSES: TransactionStatus[] = ['Active', 'Completed', 'Rejected', 'Refunded'];

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
  clientId?: string;
  clientName?: string;
}

export interface User extends SessionUser {
  name?: string;
  clientId?: string;
  client?: { id: string; name: string };
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

  /**
   * Short permanent code behind this gun's printed QR sticker. Minted once and
   * never reissued — the sticker is already on the charger. Absent on
   * connectorId 0, which is the station as a whole rather than a gun.
   */
  code?: string | null;
  /** Ready-made sticker URL, e.g. https://eplug.mn/c/K7M4Q2. */
  qrUrl?: string | null;
  /** Operator-set; OCPP 1.6 reports neither. */
  connectorType?: ConnectorType | null;
  powerKw?: number | null;
  label?: string | null;
}

export const CONNECTOR_TYPES = ['Type2', 'CCS2', 'CHAdeMO', 'GBT', 'Type1', 'Schuko'] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export interface ConnectorInput {
  connectorId: number;
  connectorType?: ConnectorType | null;
  powerKw?: number | null;
  label?: string | null;
}

/** Minutes are since local (Mongolia, UTC+8) midnight; startMinute < endMinute,
 *  no wraparound — a night rate needs two entries either side of midnight. */
export interface TariffZone {
  name?: string;
  startMinute: number;
  endMinute: number;
  tariffPerKwh: number;
}

export interface ChargePoint {
  /** The CSMS's own identifier. Stable across renames; used in API paths. */
  id: string;
  _id?: string;
  /** The OCPP identifier the station connects with. This is what operators read. */
  cpId: string;
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
  /** The rate whenever no `tariffZones` entry covers the current time. */
  tariffPerKwh?: number;
  /** Time-of-day pricing — e.g. 13:00–17:00 at one rate, 17:00–20:00 at another. */
  tariffZones?: TariffZone[];
  tags: string[];
  clientId?: string | null;
  client?: { id: string; name: string; businessRegister?: string } | null;
  /** Other clients this station also shows up for, beyond the owner. */
  linkedClientIds?: string[];
  linkedClients?: { id: string; name: string; businessRegister?: string }[];
  /** On a client's own station list: true for its owned stations, false for merely-linked ones. */
  owned?: boolean;
  /** Eplug service fee override (0–100). Unset = the client's, then the network default. */
  feePercent?: number | null;
  /** E-barimt merchant override. Unset = the client's, then the network default. */
  ebarimtMerchantId?: string | null;
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
  cpId?: string;
  chargePointName?: string;
  chargePoint?: { id: string; cpId: string; name?: string } | null;
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
  vehicleVin?: string;
  vehicleModel?: string;
  tariffPerKwh?: number;
  /** Total the driver pays: energyCost + feeAmount. */
  cost?: number;
  /** Energy part of the cost. Missing on sessions from before the service fee. */
  energyCost?: number;
  /** Eplug's service fee, energyCost × feePercent / 100. */
  feeAmount?: number;
  feePercent?: number;
  /** The client that owned the station when the session ran. */
  clientId?: string | null;
  /** Closed by the CSMS; a late StopTransaction from the station re-settles it. */
  closedByCsms?: boolean;
  ebarimt?: {
    receiptId?: string;
    type?: 'B2C_RECEIPT' | 'B2B_RECEIPT';
    totalAmount?: number;
    status?: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';
    issuedAt?: string;
    returnedAt?: string;
  };
  /** Буцаалт. */
  refund?: {
    state?: 'PENDING' | 'DONE';
    amount?: number;
    reason?: string;
    refundedBy?: string;
    refundedAt?: string;
    ebarimtReturned?: boolean;
  };
  /** Who was actually charging, and which vehicle — looked up from `idTag`. Null for a tag with no linked driver account (an RFID card, say). */
  driver?: { name?: string; phone?: string; vehicleBrand?: string; vehicleModel?: string } | null;
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
  ownerPhone?: string;
  maxActiveTransactions: number;
  allowedChargePointIds?: string[];
  note?: string;
  activeTransactions?: number;
  /** Set when this tag is an internal member card — charges for free against the client's own wallet instead of its own balance. */
  walletOwnerType?: 'USER' | 'IDTAG' | 'CLIENT';
  walletOwnerId?: string;
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
  statusCounts?: Record<string, number>;
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

/** Live SSE payload. `event` is the OCPP-domain event name, `data` its payload. */
export interface CsmsEvent {
  event: string;
  chargePointId?: string;
  at?: string;
  data?: unknown;
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

export interface QpayActiveMerchantConfig {
  id?: string;
  merchantId: string;
  merchantName?: string;
  mccCode: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Харилцагч (Clients / Partners) (backend: /api/clients/*)
// ---------------------------------------------------------------------------

export interface ClientLoginAccount {
  email: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface Client {
  id: string;
  _id?: string;
  name: string;
  businessRegister?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  description?: string | null;
  isActive: boolean;
  loginAccount?: ClientLoginAccount | null;
  /** Eplug service fee (0–100) on this client's stations. Unset = network default. */
  feePercent?: number | null;
  /** Receipts for this client's stations are issued under this merchant. Unset = network default. */
  ebarimtMerchantId?: string | null;
  payoutAccount?: PayoutAccount | null;
  stationCount?: number;
  stations?: ChargePoint[];
  createdAt: string;
  updatedAt: string;
}

/** Bank account Eplug pays a client's earnings into. */
export interface PayoutAccount {
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface ClientInput {
  name: string;
  businessRegister?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  password?: string | null;
  address?: string | null;
  description?: string | null;
  isActive?: boolean;
  feePercent?: number | null;
  ebarimtMerchantId?: string | null;
  payoutAccount?: PayoutAccount | null;
}

// ---------------------------------------------------------------------------
// Тайлан (Reports) (backend: /api/reports/*)
// ---------------------------------------------------------------------------

export interface StationReportRow {
  chargePointId: string;
  cpId: string;
  name: string;
  address?: string;
  tariffPerKwh: number;
  sessionsCount: number;
  energyWh: number;
  energyKwh: number;
  energyCost: number;
  feePercent: number;
  feeAmount: number;
  gross: number;
  clientNet: number;
  formula: {
    kwhFormula: string;
    energyCostFormula: string;
    feeFormula: string;
    grossFormula: string;
    netFormula: string;
    summaryDisplay: string;
  };
}

export interface DailyReportRow {
  date: string;
  sessionsCount: number;
  energyWh: number;
  energyKwh: number;
  gross: number;
  fee: number;
  net: number;
}

export interface ConnectorReportRow {
  chargePointId: string;
  connectorId: number;
  cpId: string;
  stationName: string;
  sessionsCount: number;
  energyKwh: number;
  gross: number;
  fee: number;
  net: number;
}

export interface RecentSessionReportRow {
  id: number;
  chargePointId: string;
  cpId: string;
  stationName: string;
  connectorId: number;
  idTag: string;
  vehicleModel?: string;
  startTimestamp: string;
  stopTimestamp: string;
  energyWh: number;
  energyKwh: number;
  tariffPerKwh: number;
  energyCost: number;
  feePercent: number;
  feeAmount: number;
  cost: number;
  clientNet: number;
}

export interface ReportSummary {
  period: {
    from: string | null;
    to: string | null;
  };
  client?: {
    id: string;
    name: string;
    businessRegister?: string;
    feePercent?: number;
    payoutAccount?: PayoutAccount;
  } | null;
  totals: {
    sessionsCount: number;
    energyWh: number;
    energyKwh: number;
    gross: number;
    fee: number;
    net: number;
    paidTotal: number;
    outstanding: number;
    lastPaidAt: string | null;
    averageSessionKwh: number;
    averageSessionCost: number;
  };
  formulasGuide: {
    energy: string;
    energyCost: string;
    fee: string;
    gross: string;
    clientNet: string;
    outstanding: string;
  };
  stations: StationReportRow[];
  daily: DailyReportRow[];
  connectors: ConnectorReportRow[];
  recentSessions: RecentSessionReportRow[];
}

// ---------------------------------------------------------------------------
// Тооцоо (Settlements) (backend: /api/settlements/*)
// ---------------------------------------------------------------------------

/** One client's row in GET /api/settlements/summary. */
export interface SettlementSummaryRow {
  client: {
    id: string;
    name: string;
    businessRegister?: string;
    feePercent?: number;
    payoutAccount?: PayoutAccount;
    isActive: boolean;
  };
  /** Completed sessions stopped inside the requested range. */
  period: {
    sessions: number;
    energyWh: number;
    /** What drivers paid. */
    gross: number;
    /** Eplug's service fee. */
    fee: number;
    /** What the client earned: gross − fee. */
    net: number;
  };
  /** All-time net earnings. */
  earnedTotal: number;
  /** All-time payouts. */
  paidTotal: number;
  /** earnedTotal − paidTotal. Negative after a refund of an already-paid session. */
  outstanding: number;
  lastPaidAt: string | null;
}

export interface SettlementSummary {
  from: string | null;
  to: string | null;
  data: SettlementSummaryRow[];
  totals: { sessions: number; gross: number; fee: number; net: number; outstanding: number };
}

/** A payout from Eplug to a client. */
export interface Settlement {
  id: string;
  _id?: string;
  clientId: string;
  amount: number;
  periodFrom?: string;
  periodTo?: string;
  reference?: string;
  note?: string;
  paidAt: string;
  createdBy?: string;
  createdAt?: string;
}

export interface SettlementInput {
  clientId: string;
  amount: number;
  periodFrom?: string;
  periodTo?: string;
  reference?: string;
  note?: string;
  paidAt?: string;
}


// ---------------------------------------------------------------------------
// Апп хувилбар (backend: /api/app-releases)
// ---------------------------------------------------------------------------

export type AppPlatform = 'android' | 'ios';
export const APP_PLATFORMS: AppPlatform[] = ['android', 'ios'];

/** One store's release settings. `configured: false` means no row exists yet. */
export interface AppRelease {
  id?: string;
  platform: AppPlatform;
  configured?: false;
  /** Newest build in the store. Below it, the driver is offered an update. */
  latestVersion?: string;
  latestBuild?: number | null;
  /** Oldest build still allowed to run. Below it, the update is forced. */
  minSupportedVersion?: string | null;
  minSupportedBuild?: number | null;
  storeUrl?: string;
  releaseNotesMn?: string | null;
  releaseNotesEn?: string | null;
  isActive?: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AppReleaseInput {
  latestVersion: string;
  latestBuild?: number | null;
  minSupportedVersion?: string | null;
  minSupportedBuild?: number | null;
  storeUrl: string;
  releaseNotesMn?: string | null;
  releaseNotesEn?: string | null;
  isActive: boolean;
}

/** What a driver on a given build would be shown. */
export interface AppReleasePreview {
  configured: boolean;
  updateAvailable: boolean;
  forceUpdate: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
