/**
 * Registry of every Central-System-to-Charge-Point command the backend exposes
 * under `POST /api/charge-points/:id/<slug>`.
 *
 * Field definitions mirror the zod schemas in
 * `evChargerBack/src/api/routes/commands.routes.ts` exactly — the console builds
 * its forms from this table, so a mismatch here shows up as a 400 from the API.
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'enum'
  | 'datetime'
  | 'textarea'
  | 'stringList'
  | 'json';

export interface CommandField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  hint?: string;
  default?: string;
  /** Dotted path for nested payloads, e.g. `certificateHashData.serialNumber`. */
  path?: string;
}

export type CommandGroup =
  | 'Core'
  | 'Trigger'
  | 'Reservation'
  | 'Smart charging'
  | 'Local list'
  | 'Firmware & logs'
  | 'Certificates'
  | 'Advanced';

export interface CommandSpec {
  slug: string;
  /** The OCPP action this maps to, shown for operator confidence. */
  action: string;
  label: string;
  group: CommandGroup;
  description: string;
  fields: CommandField[];
  /** Needs confirmation before firing: disruptive to a live session or the site. */
  destructive?: boolean;
}

export const COMMANDS: CommandSpec[] = [
  // ---- Core ---------------------------------------------------------------
  {
    slug: 'remote-start',
    action: 'RemoteStartTransaction',
    label: 'Remote start',
    group: 'Core',
    description: 'Start a charging session on behalf of an RFID tag. The tag must already exist.',
    fields: [
      { name: 'idTag', label: 'ID tag', type: 'text', required: true, placeholder: 'TAG-0001' },
      { name: 'connectorId', label: 'Connector', type: 'number', hint: 'Omit to let the charge point choose.' },
      { name: 'chargingProfile', label: 'Charging profile', type: 'json', hint: 'Optional TxProfile to apply to this session.' },
    ],
  },
  {
    slug: 'remote-stop',
    action: 'RemoteStopTransaction',
    label: 'Remote stop',
    group: 'Core',
    description: 'Stop an in-progress session by its transaction id.',
    destructive: true,
    fields: [{ name: 'transactionId', label: 'Transaction id', type: 'number', required: true }],
  },
  {
    slug: 'reset',
    action: 'Reset',
    label: 'Reset',
    group: 'Core',
    description: 'Reboot the charge point. A hard reset drops sessions immediately.',
    destructive: true,
    fields: [
      { name: 'type', label: 'Type', type: 'enum', options: ['Soft', 'Hard'], default: 'Soft', required: true },
    ],
  },
  {
    slug: 'unlock-connector',
    action: 'UnlockConnector',
    label: 'Unlock connector',
    group: 'Core',
    description: 'Release the cable lock on a connector.',
    fields: [{ name: 'connectorId', label: 'Connector', type: 'number', required: true, default: '1' }],
  },
  {
    slug: 'change-availability',
    action: 'ChangeAvailability',
    label: 'Change availability',
    group: 'Core',
    description: 'Take a connector — or the whole charge point (connector 0) — in or out of service.',
    destructive: true,
    fields: [
      { name: 'connectorId', label: 'Connector', type: 'number', required: true, default: '0', hint: '0 targets the entire charge point.' },
      { name: 'type', label: 'Availability', type: 'enum', options: ['Operative', 'Inoperative'], required: true, default: 'Inoperative' },
    ],
  },
  {
    slug: 'change-configuration',
    action: 'ChangeConfiguration',
    label: 'Change configuration',
    group: 'Core',
    description: 'Write a single OCPP configuration key.',
    fields: [
      { name: 'key', label: 'Key', type: 'text', required: true, placeholder: 'HeartbeatInterval' },
      { name: 'value', label: 'Value', type: 'text', required: true, placeholder: '300' },
    ],
  },
  {
    slug: 'get-configuration',
    action: 'GetConfiguration',
    label: 'Get configuration',
    group: 'Core',
    description: 'Read configuration keys and cache them against this charge point.',
    fields: [
      {
        name: 'key',
        label: 'Keys',
        type: 'stringList',
        hint: 'Comma-separated. Leave empty to read every key.',
        placeholder: 'HeartbeatInterval, MeterValueSampleInterval',
      },
    ],
  },
  {
    slug: 'clear-cache',
    action: 'ClearCache',
    label: 'Clear cache',
    group: 'Core',
    description: 'Empty the local authorization cache.',
    fields: [],
  },
  {
    slug: 'data-transfer',
    action: 'DataTransfer',
    label: 'Data transfer',
    group: 'Core',
    description: 'Send a vendor-specific message.',
    fields: [
      { name: 'vendorId', label: 'Vendor id', type: 'text', required: true },
      { name: 'messageId', label: 'Message id', type: 'text' },
      { name: 'data', label: 'Data', type: 'textarea' },
    ],
  },

  // ---- Trigger ------------------------------------------------------------
  {
    slug: 'trigger-message',
    action: 'TriggerMessage',
    label: 'Trigger message',
    group: 'Trigger',
    description: 'Ask the charge point to send a message right now.',
    fields: [
      {
        name: 'requestedMessage',
        label: 'Message',
        type: 'enum',
        required: true,
        default: 'StatusNotification',
        options: [
          'BootNotification',
          'DiagnosticsStatusNotification',
          'FirmwareStatusNotification',
          'Heartbeat',
          'MeterValues',
          'StatusNotification',
        ],
      },
      { name: 'connectorId', label: 'Connector', type: 'number', hint: 'Required for connector-scoped messages.' },
    ],
  },
  {
    slug: 'extended-trigger-message',
    action: 'ExtendedTriggerMessage',
    label: 'Extended trigger',
    group: 'Trigger',
    description: 'Security-profile trigger, including a request for a new certificate signing request.',
    fields: [
      {
        name: 'requestedMessage',
        label: 'Message',
        type: 'enum',
        required: true,
        default: 'StatusNotification',
        options: [
          'BootNotification',
          'LogStatusNotification',
          'FirmwareStatusNotification',
          'Heartbeat',
          'MeterValues',
          'SignChargePointCertificate',
          'StatusNotification',
        ],
      },
      { name: 'connectorId', label: 'Connector', type: 'number' },
    ],
  },

  // ---- Reservation --------------------------------------------------------
  {
    slug: 'reserve-now',
    action: 'ReserveNow',
    label: 'Reserve now',
    group: 'Reservation',
    description: 'Hold a connector for a tag until the expiry time. The reservation id is allocated automatically.',
    fields: [
      { name: 'connectorId', label: 'Connector', type: 'number', required: true, default: '1' },
      { name: 'idTag', label: 'ID tag', type: 'text', required: true },
      { name: 'expiryDate', label: 'Expires at', type: 'datetime', required: true, hint: 'Must be in the future.' },
      { name: 'parentIdTag', label: 'Parent ID tag', type: 'text' },
    ],
  },
  {
    slug: 'cancel-reservation',
    action: 'CancelReservation',
    label: 'Cancel reservation',
    group: 'Reservation',
    description: 'Release a reservation by id.',
    fields: [{ name: 'reservationId', label: 'Reservation id', type: 'number', required: true }],
  },

  // ---- Smart charging -----------------------------------------------------
  {
    slug: 'set-charging-profile',
    action: 'SetChargingProfile',
    label: 'Set charging profile',
    group: 'Smart charging',
    description: 'Install a charging profile. The profile id is allocated automatically when omitted.',
    fields: [
      { name: 'connectorId', label: 'Connector', type: 'number', required: true, default: '0' },
      {
        name: 'csChargingProfiles',
        label: 'Charging profile',
        type: 'json',
        required: true,
        default: JSON.stringify(
          {
            stackLevel: 0,
            chargingProfilePurpose: 'TxDefaultProfile',
            chargingProfileKind: 'Absolute',
            chargingSchedule: {
              chargingRateUnit: 'A',
              chargingSchedulePeriod: [{ startPeriod: 0, limit: 16 }],
            },
          },
          null,
          2,
        ),
        hint: 'Requires stackLevel, chargingProfilePurpose, chargingProfileKind and chargingSchedule.',
      },
    ],
  },
  {
    slug: 'clear-charging-profile',
    action: 'ClearChargingProfile',
    label: 'Clear charging profile',
    group: 'Smart charging',
    description: 'Remove profiles matching the given filter. Every field is optional — omit all to clear everything.',
    destructive: true,
    fields: [
      { name: 'id', label: 'Profile id', type: 'number' },
      { name: 'connectorId', label: 'Connector', type: 'number' },
      {
        name: 'chargingProfilePurpose',
        label: 'Purpose',
        type: 'enum',
        options: ['ChargePointMaxProfile', 'TxDefaultProfile', 'TxProfile'],
      },
      { name: 'stackLevel', label: 'Stack level', type: 'number' },
    ],
  },
  {
    slug: 'get-composite-schedule',
    action: 'GetCompositeSchedule',
    label: 'Get composite schedule',
    group: 'Smart charging',
    description: 'Ask what limit the charge point will actually apply over a window.',
    fields: [
      { name: 'connectorId', label: 'Connector', type: 'number', required: true, default: '0' },
      { name: 'duration', label: 'Duration (s)', type: 'number', required: true, default: '3600' },
      { name: 'chargingRateUnit', label: 'Rate unit', type: 'enum', options: ['A', 'W'] },
    ],
  },

  // ---- Local list ---------------------------------------------------------
  {
    slug: 'get-local-list-version',
    action: 'GetLocalListVersion',
    label: 'Get local list version',
    group: 'Local list',
    description: 'Read the version of the local authorization list.',
    fields: [],
  },
  {
    slug: 'send-local-list',
    action: 'SendLocalList',
    label: 'Send local list',
    group: 'Local list',
    description: 'Push RFID tags to the charge point so it can authorise offline.',
    fields: [
      { name: 'updateType', label: 'Update type', type: 'enum', options: ['Full', 'Differential'], default: 'Full', required: true },
      {
        name: 'idTags',
        label: 'ID tags',
        type: 'stringList',
        hint: 'Comma-separated. Leave empty to push every tag in the database.',
      },
    ],
  },

  // ---- Firmware & logs ----------------------------------------------------
  {
    slug: 'update-firmware',
    action: 'UpdateFirmware',
    label: 'Update firmware',
    group: 'Firmware & logs',
    description: 'Tell the charge point to download and install firmware.',
    destructive: true,
    fields: [
      { name: 'location', label: 'Firmware URL', type: 'text', required: true, placeholder: 'https://…/firmware.bin' },
      { name: 'retrieveDate', label: 'Retrieve at', type: 'datetime', required: true },
      { name: 'retries', label: 'Retries', type: 'number' },
      { name: 'retryInterval', label: 'Retry interval (s)', type: 'number' },
    ],
  },
  {
    slug: 'get-diagnostics',
    action: 'GetDiagnostics',
    label: 'Get diagnostics',
    group: 'Firmware & logs',
    description: 'Ask the charge point to upload a diagnostics file.',
    fields: [
      { name: 'location', label: 'Upload URL', type: 'text', required: true, placeholder: 'ftp://user:pass@host/path' },
      { name: 'startTime', label: 'From', type: 'datetime' },
      { name: 'stopTime', label: 'To', type: 'datetime' },
      { name: 'retries', label: 'Retries', type: 'number' },
      { name: 'retryInterval', label: 'Retry interval (s)', type: 'number' },
    ],
  },
  {
    slug: 'get-log',
    action: 'GetLog',
    label: 'Get log',
    group: 'Firmware & logs',
    description: 'Request the diagnostics or security log. The request id is allocated automatically.',
    fields: [
      { name: 'logType', label: 'Log type', type: 'enum', options: ['DiagnosticsLog', 'SecurityLog'], required: true, default: 'SecurityLog' },
      { name: 'remoteLocation', label: 'Upload URL', type: 'text', required: true, placeholder: 'ftp://user:pass@host/path' },
      { name: 'oldestTimestamp', label: 'From', type: 'datetime' },
      { name: 'latestTimestamp', label: 'To', type: 'datetime' },
      { name: 'retries', label: 'Retries', type: 'number' },
      { name: 'retryInterval', label: 'Retry interval (s)', type: 'number' },
    ],
  },
  {
    slug: 'signed-update-firmware',
    action: 'SignedUpdateFirmware',
    label: 'Signed firmware update',
    group: 'Firmware & logs',
    description: 'Signed firmware update from the security white paper. Requires the signing certificate and signature.',
    destructive: true,
    fields: [
      { name: 'location', label: 'Firmware URL', type: 'text', required: true, placeholder: 'https://…/firmware.bin' },
      { name: 'retrieveDateTime', label: 'Retrieve at', type: 'datetime', required: true },
      { name: 'installDateTime', label: 'Install at', type: 'datetime' },
      { name: 'signingCertificate', label: 'Signing certificate (PEM)', type: 'textarea', required: true },
      { name: 'signature', label: 'Signature', type: 'textarea', required: true },
      { name: 'retries', label: 'Retries', type: 'number' },
      { name: 'retryInterval', label: 'Retry interval (s)', type: 'number' },
    ],
  },

  // ---- Certificates -------------------------------------------------------
  {
    slug: 'install-certificate',
    action: 'InstallCertificate',
    label: 'Install certificate',
    group: 'Certificates',
    description: 'Install a root certificate on the charge point.',
    fields: [
      {
        name: 'certificateType',
        label: 'Type',
        type: 'enum',
        required: true,
        default: 'CentralSystemRootCertificate',
        options: ['CentralSystemRootCertificate', 'ManufacturerRootCertificate'],
      },
      { name: 'certificate', label: 'Certificate (PEM)', type: 'textarea', required: true, placeholder: '-----BEGIN CERTIFICATE-----' },
    ],
  },
  {
    slug: 'get-installed-certificate-ids',
    action: 'GetInstalledCertificateIds',
    label: 'List installed certificates',
    group: 'Certificates',
    description: 'Read the hashes of certificates the charge point currently trusts.',
    fields: [
      {
        name: 'certificateType',
        label: 'Type',
        type: 'enum',
        required: true,
        default: 'CentralSystemRootCertificate',
        options: ['CentralSystemRootCertificate', 'ManufacturerRootCertificate'],
      },
    ],
  },
  {
    slug: 'delete-certificate',
    action: 'DeleteCertificate',
    label: 'Delete certificate',
    group: 'Certificates',
    description: 'Remove a certificate identified by its hash data.',
    destructive: true,
    fields: [
      {
        name: 'hashAlgorithm',
        path: 'certificateHashData.hashAlgorithm',
        label: 'Hash algorithm',
        type: 'enum',
        options: ['SHA256', 'SHA384', 'SHA512'],
        required: true,
        default: 'SHA256',
      },
      { name: 'issuerNameHash', path: 'certificateHashData.issuerNameHash', label: 'Issuer name hash', type: 'text', required: true },
      { name: 'issuerKeyHash', path: 'certificateHashData.issuerKeyHash', label: 'Issuer key hash', type: 'text', required: true },
      { name: 'serialNumber', path: 'certificateHashData.serialNumber', label: 'Serial number', type: 'text', required: true },
    ],
  },
  {
    slug: 'certificate-signed',
    action: 'CertificateSigned',
    label: 'Push signed certificate',
    group: 'Certificates',
    description: 'Deliver a signed certificate chain to the charge point.',
    fields: [
      { name: 'certificateChain', label: 'Certificate chain (PEM)', type: 'textarea', required: true },
    ],
  },

  // ---- Advanced -----------------------------------------------------------
  {
    slug: 'raw',
    action: 'any',
    label: 'Raw OCPP call',
    group: 'Advanced',
    description: 'Send any registered OCPP action verbatim. Use when a command is not covered above.',
    destructive: true,
    fields: [
      { name: 'action', label: 'OCPP action', type: 'text', required: true, placeholder: 'GetCompositeSchedule' },
      { name: 'payload', label: 'Payload', type: 'json', required: true, default: '{}' },
    ],
  },
];

export const COMMAND_GROUPS: CommandGroup[] = [
  'Core',
  'Trigger',
  'Reservation',
  'Smart charging',
  'Local list',
  'Firmware & logs',
  'Certificates',
  'Advanced',
];

export function commandsByGroup(group: CommandGroup): CommandSpec[] {
  return COMMANDS.filter((c) => c.group === group);
}

/** Assemble the request body from raw form values, honouring nesting and types. */
export function buildPayload(
  spec: CommandSpec,
  values: Record<string, string>,
): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  const body: Record<string, unknown> = {};

  for (const field of spec.fields) {
    const raw = (values[field.name] ?? '').trim();

    if (!raw) {
      if (field.required) return { ok: false, error: `${field.label} is required` };
      continue;
    }

    let value: unknown;
    switch (field.type) {
      case 'number': {
        const n = Number(raw);
        if (!Number.isFinite(n)) return { ok: false, error: `${field.label} must be a number` };
        value = n;
        break;
      }
      case 'datetime': {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return { ok: false, error: `${field.label} is not a valid date` };
        value = d.toISOString();
        break;
      }
      case 'stringList': {
        const list = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (list.length === 0) continue;
        value = list;
        break;
      }
      case 'json': {
        try {
          value = JSON.parse(raw);
        } catch {
          return { ok: false, error: `${field.label} is not valid JSON` };
        }
        break;
      }
      default:
        value = raw;
    }

    setPath(body, field.path ?? field.name, value);
  }

  return { ok: true, body };
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof cursor[part] !== 'object' || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

/** Initial form state from the field defaults. */
export function defaultValues(spec: CommandSpec): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of spec.fields) {
    out[field.name] = field.default ?? (field.type === 'enum' ? (field.options?.[0] ?? '') : '');
  }
  return out;
}
