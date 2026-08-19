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
    label: 'Алсаас эхлүүлэх',
    group: 'Core',
    description: 'RFID картын нэрийн өмнөөс цэнэглэлт эхлүүлнэ. Карт урьдчилан бүртгэлтэй байх ёстой.',
    fields: [
      { name: 'idTag', label: 'RFID карт', type: 'text', required: true, placeholder: 'TAG-0001' },
      { name: 'connectorId', label: 'Холбогч', type: 'number', hint: 'Хоосон орхивол станц өөрөө сонгоно.' },
      { name: 'chargingProfile', label: 'Цэнэглэх профайл', type: 'json', hint: 'Энэ цэнэглэлтэд хэрэглэх TxProfile (заавал бус).' },
    ],
  },
  {
    slug: 'remote-stop',
    action: 'RemoteStopTransaction',
    label: 'Алсаас зогсоох',
    group: 'Core',
    description: 'Үргэлжилж буй цэнэглэлтийг гүйлгээний дугаараар зогсооно.',
    destructive: true,
    fields: [{ name: 'transactionId', label: 'Гүйлгээний дугаар', type: 'number', required: true }],
  },
  {
    slug: 'reset',
    action: 'Reset',
    label: 'Дахин ачаалах',
    group: 'Core',
    description: 'Станцыг дахин ачаална. Хүчтэй дахин ачаалалт цэнэглэлтийг шууд тасална.',
    destructive: true,
    fields: [
      { name: 'type', label: 'Төрөл', type: 'enum', options: ['Soft', 'Hard'], default: 'Soft', required: true },
    ],
  },
  {
    slug: 'unlock-connector',
    action: 'UnlockConnector',
    label: 'Холбогч тайлах',
    group: 'Core',
    description: 'Холбогч дээрх кабелийн түгжээг тайлна.',
    fields: [{ name: 'connectorId', label: 'Холбогч', type: 'number', required: true, default: '1' }],
  },
  {
    slug: 'change-availability',
    action: 'ChangeAvailability',
    label: 'Ашиглалт өөрчлөх',
    group: 'Core',
    description: 'Холбогч, эсвэл станцыг бүхэлд нь (0 дугаар холбогч) ажиллагаанд оруулах / гаргах.',
    destructive: true,
    fields: [
      { name: 'connectorId', label: 'Холбогч', type: 'number', required: true, default: '0', hint: '0 нь станцыг бүхэлд нь хамаарна.' },
      { name: 'type', label: 'Ашиглалт', type: 'enum', options: ['Operative', 'Inoperative'], required: true, default: 'Inoperative' },
    ],
  },
  {
    slug: 'change-configuration',
    action: 'ChangeConfiguration',
    label: 'Тохиргоо өөрчлөх',
    group: 'Core',
    description: 'OCPP тохиргооны нэг түлхүүрийг бичнэ.',
    fields: [
      { name: 'key', label: 'Түлхүүр', type: 'text', required: true, placeholder: 'HeartbeatInterval' },
      { name: 'value', label: 'Утга', type: 'text', required: true, placeholder: '300' },
    ],
  },
  {
    slug: 'get-configuration',
    action: 'GetConfiguration',
    label: 'Тохиргоо унших',
    group: 'Core',
    description: 'Тохиргооны түлхүүрүүдийг уншиж, энэ станцын хамт хадгална.',
    fields: [
      {
        name: 'key',
        label: 'Түлхүүрүүд',
        type: 'stringList',
        hint: 'Таслалаар тусгаарлана. Хоосон орхивол бүх түлхүүрийг уншина.',
        placeholder: 'HeartbeatInterval, MeterValueSampleInterval',
      },
    ],
  },
  {
    slug: 'clear-cache',
    action: 'ClearCache',
    label: 'Кэш цэвэрлэх',
    group: 'Core',
    description: 'Дотоод зөвшөөрлийн кэшийг цэвэрлэнэ.',
    fields: [],
  },
  {
    slug: 'data-transfer',
    action: 'DataTransfer',
    label: 'Өгөгдөл дамжуулах',
    group: 'Core',
    description: 'Үйлдвэрлэгчийн тусгай мессеж илгээнэ.',
    fields: [
      { name: 'vendorId', label: 'Үйлдвэрлэгчийн дугаар', type: 'text', required: true },
      { name: 'messageId', label: 'Мессежийн дугаар', type: 'text' },
      { name: 'data', label: 'Өгөгдөл', type: 'textarea' },
    ],
  },

  // ---- Trigger ------------------------------------------------------------
  {
    slug: 'trigger-message',
    action: 'TriggerMessage',
    label: 'Мессеж дуудах',
    group: 'Trigger',
    description: 'Станцаас тодорхой мессежийг яг одоо илгээхийг хүснэ.',
    fields: [
      {
        name: 'requestedMessage',
        label: 'Мессеж',
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
      { name: 'connectorId', label: 'Холбогч', type: 'number', hint: 'Холбогчид хамаарах мессежид заавал шаардлагатай.' },
    ],
  },
  {
    slug: 'extended-trigger-message',
    action: 'ExtendedTriggerMessage',
    label: 'Өргөтгөсөн дуудалт',
    group: 'Trigger',
    description: 'Аюулгүй байдлын профайлын дуудалт, шинэ гэрчилгээний хүсэлт (CSR) авах боломжтой.',
    fields: [
      {
        name: 'requestedMessage',
        label: 'Мессеж',
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
      { name: 'connectorId', label: 'Холбогч', type: 'number' },
    ],
  },

  // ---- Reservation --------------------------------------------------------
  {
    slug: 'reserve-now',
    action: 'ReserveNow',
    label: 'Захиалга үүсгэх',
    group: 'Reservation',
    description: 'Тухайн картад холбогчийг дуусах хугацаа хүртэл захиална. Захиалгын дугаар автоматаар оногдоно.',
    fields: [
      { name: 'connectorId', label: 'Холбогч', type: 'number', required: true, default: '1' },
      { name: 'idTag', label: 'RFID карт', type: 'text', required: true },
      { name: 'expiryDate', label: 'Дуусах хугацаа', type: 'datetime', required: true, hint: 'Ирээдүйн хугацаа байх ёстой.' },
      { name: 'parentIdTag', label: 'Эцэг RFID карт', type: 'text' },
    ],
  },
  {
    slug: 'cancel-reservation',
    action: 'CancelReservation',
    label: 'Захиалга цуцлах',
    group: 'Reservation',
    description: 'Захиалгыг дугаараар нь цуцална.',
    fields: [{ name: 'reservationId', label: 'Захиалгын дугаар', type: 'number', required: true }],
  },

  // ---- Smart charging -----------------------------------------------------
  {
    slug: 'set-charging-profile',
    action: 'SetChargingProfile',
    label: 'Цэнэглэх профайл тохируулах',
    group: 'Smart charging',
    description: 'Цэнэглэх профайл суулгана. Дугаарыг оруулаагүй бол автоматаар оногдоно.',
    fields: [
      { name: 'connectorId', label: 'Холбогч', type: 'number', required: true, default: '0' },
      {
        name: 'csChargingProfiles',
        label: 'Цэнэглэх профайл',
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
        hint: 'stackLevel, chargingProfilePurpose, chargingProfileKind, chargingSchedule талбарууд шаардлагатай.',
      },
    ],
  },
  {
    slug: 'clear-charging-profile',
    action: 'ClearChargingProfile',
    label: 'Цэнэглэх профайл устгах',
    group: 'Smart charging',
    description: 'Шүүлтүүрт тохирох профайлуудыг устгана. Бүх талбар заавал бус — бүгдийг хоосон орхивол бүх профайл устана.',
    destructive: true,
    fields: [
      { name: 'id', label: 'Профайлын дугаар', type: 'number' },
      { name: 'connectorId', label: 'Холбогч', type: 'number' },
      {
        name: 'chargingProfilePurpose',
        label: 'Зориулалт',
        type: 'enum',
        options: ['ChargePointMaxProfile', 'TxDefaultProfile', 'TxProfile'],
      },
      { name: 'stackLevel', label: 'Давхаргын түвшин', type: 'number' },
    ],
  },
  {
    slug: 'get-composite-schedule',
    action: 'GetCompositeSchedule',
    label: 'Нэгдсэн хуваарь унших',
    group: 'Smart charging',
    description: 'Тухайн хугацаанд станц ямар хязгаар мөрдөхийг асууна.',
    fields: [
      { name: 'connectorId', label: 'Холбогч', type: 'number', required: true, default: '0' },
      { name: 'duration', label: 'Үргэлжлэх хугацаа (сек)', type: 'number', required: true, default: '3600' },
      { name: 'chargingRateUnit', label: 'Хэмжих нэгж', type: 'enum', options: ['A', 'W'] },
    ],
  },

  // ---- Local list ---------------------------------------------------------
  {
    slug: 'get-local-list-version',
    action: 'GetLocalListVersion',
    label: 'Дотоод жагсаалтын хувилбар',
    group: 'Local list',
    description: 'Дотоод зөвшөөрлийн жагсаалтын хувилбарыг уншина.',
    fields: [],
  },
  {
    slug: 'send-local-list',
    action: 'SendLocalList',
    label: 'Дотоод жагсаалт илгээх',
    group: 'Local list',
    description: 'Станц офлайн үед зөвшөөрөл олгох боломжтой болгохын тулд RFID картуудыг илгээнэ.',
    fields: [
      { name: 'updateType', label: 'Шинэчлэлтийн төрөл', type: 'enum', options: ['Full', 'Differential'], default: 'Full', required: true },
      {
        name: 'idTags',
        label: 'RFID картууд',
        type: 'stringList',
        hint: 'Таслалаар тусгаарлана. Хоосон орхивол өгөгдлийн сан дахь бүх картыг илгээнэ.',
      },
    ],
  },

  // ---- Firmware & logs ----------------------------------------------------
  {
    slug: 'update-firmware',
    action: 'UpdateFirmware',
    label: 'Программ шинэчлэх',
    group: 'Firmware & logs',
    description: 'Станцад программ хангамжийг татаж суулгах даалгавар өгнө.',
    destructive: true,
    fields: [
      { name: 'location', label: 'Программын URL', type: 'text', required: true, placeholder: 'https://…/firmware.bin' },
      { name: 'retrieveDate', label: 'Татах хугацаа', type: 'datetime', required: true },
      { name: 'retries', label: 'Дахин оролдлого', type: 'number' },
      { name: 'retryInterval', label: 'Дахин оролдох завсар (сек)', type: 'number' },
    ],
  },
  {
    slug: 'get-diagnostics',
    action: 'GetDiagnostics',
    label: 'Оношилгоо авах',
    group: 'Firmware & logs',
    description: 'Станцаас оношилгооны файл илгээхийг хүснэ.',
    fields: [
      { name: 'location', label: 'Илгээх URL', type: 'text', required: true, placeholder: 'ftp://user:pass@host/path' },
      { name: 'startTime', label: 'Эхлэх', type: 'datetime' },
      { name: 'stopTime', label: 'Дуусах', type: 'datetime' },
      { name: 'retries', label: 'Дахин оролдлого', type: 'number' },
      { name: 'retryInterval', label: 'Дахин оролдох завсар (сек)', type: 'number' },
    ],
  },
  {
    slug: 'get-log',
    action: 'GetLog',
    label: 'Лог авах',
    group: 'Firmware & logs',
    description: 'Оношилгоо эсвэл аюулгүй байдлын логийг хүснэ. Хүсэлтийн дугаар автоматаар оногдоно.',
    fields: [
      { name: 'logType', label: 'Логийн төрөл', type: 'enum', options: ['DiagnosticsLog', 'SecurityLog'], required: true, default: 'SecurityLog' },
      { name: 'remoteLocation', label: 'Илгээх URL', type: 'text', required: true, placeholder: 'ftp://user:pass@host/path' },
      { name: 'oldestTimestamp', label: 'Эхлэх', type: 'datetime' },
      { name: 'latestTimestamp', label: 'Дуусах', type: 'datetime' },
      { name: 'retries', label: 'Дахин оролдлого', type: 'number' },
      { name: 'retryInterval', label: 'Дахин оролдох завсар (сек)', type: 'number' },
    ],
  },
  {
    slug: 'signed-update-firmware',
    action: 'SignedUpdateFirmware',
    label: 'Баталгаажсан программ шинэчлэлт',
    group: 'Firmware & logs',
    description: 'Аюулгүй байдлын стандартын дагуух баталгаажсан программ шинэчлэлт. Гарын үсгийн гэрчилгээ, гарын үсэг шаардлагатай.',
    destructive: true,
    fields: [
      { name: 'location', label: 'Программын URL', type: 'text', required: true, placeholder: 'https://…/firmware.bin' },
      { name: 'retrieveDateTime', label: 'Татах хугацаа', type: 'datetime', required: true },
      { name: 'installDateTime', label: 'Суулгах хугацаа', type: 'datetime' },
      { name: 'signingCertificate', label: 'Гарын үсгийн гэрчилгээ (PEM)', type: 'textarea', required: true },
      { name: 'signature', label: 'Гарын үсэг', type: 'textarea', required: true },
      { name: 'retries', label: 'Дахин оролдлого', type: 'number' },
      { name: 'retryInterval', label: 'Дахин оролдох завсар (сек)', type: 'number' },
    ],
  },

  // ---- Certificates -------------------------------------------------------
  {
    slug: 'install-certificate',
    action: 'InstallCertificate',
    label: 'Гэрчилгээ суулгах',
    group: 'Certificates',
    description: 'Станц дээр үндсэн гэрчилгээ суулгана.',
    fields: [
      {
        name: 'certificateType',
        label: 'Төрөл',
        type: 'enum',
        required: true,
        default: 'CentralSystemRootCertificate',
        options: ['CentralSystemRootCertificate', 'ManufacturerRootCertificate'],
      },
      { name: 'certificate', label: 'Гэрчилгээ (PEM)', type: 'textarea', required: true, placeholder: '-----BEGIN CERTIFICATE-----' },
    ],
  },
  {
    slug: 'get-installed-certificate-ids',
    action: 'GetInstalledCertificateIds',
    label: 'Суусан гэрчилгээ жагсаах',
    group: 'Certificates',
    description: 'Станцын одоо итгэж буй гэрчилгээнүүдийн хэшийг уншина.',
    fields: [
      {
        name: 'certificateType',
        label: 'Төрөл',
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
    label: 'Гэрчилгээ устгах',
    group: 'Certificates',
    description: 'Хэш мэдээллээр тодорхойлсон гэрчилгээг устгана.',
    destructive: true,
    fields: [
      {
        name: 'hashAlgorithm',
        path: 'certificateHashData.hashAlgorithm',
        label: 'Хэш алгоритм',
        type: 'enum',
        options: ['SHA256', 'SHA384', 'SHA512'],
        required: true,
        default: 'SHA256',
      },
      { name: 'issuerNameHash', path: 'certificateHashData.issuerNameHash', label: 'Олгогчийн нэрийн хэш', type: 'text', required: true },
      { name: 'issuerKeyHash', path: 'certificateHashData.issuerKeyHash', label: 'Олгогчийн түлхүүрийн хэш', type: 'text', required: true },
      { name: 'serialNumber', path: 'certificateHashData.serialNumber', label: 'Сериал дугаар', type: 'text', required: true },
    ],
  },
  {
    slug: 'certificate-signed',
    action: 'CertificateSigned',
    label: 'Баталгаажсан гэрчилгээ илгээх',
    group: 'Certificates',
    description: 'Баталгаажсан гэрчилгээний цуваа станц руу хүргэнэ.',
    fields: [
      { name: 'certificateChain', label: 'Гэрчилгээний цуваа (PEM)', type: 'textarea', required: true },
    ],
  },

  // ---- Advanced -----------------------------------------------------------
  {
    slug: 'raw',
    action: 'any',
    label: 'Түүхий OCPP дуудалт',
    group: 'Advanced',
    description: 'Бүртгэлтэй аливаа OCPP үйлдлийг шууд илгээнэ. Дээрх командуудад байхгүй үед ашиглана.',
    destructive: true,
    fields: [
      { name: 'action', label: 'OCPP үйлдэл', type: 'text', required: true, placeholder: 'GetCompositeSchedule' },
      { name: 'payload', label: 'Агуулга', type: 'json', required: true, default: '{}' },
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
      if (field.required) return { ok: false, error: `${field.label} талбарыг бөглөнө үү` };
      continue;
    }

    let value: unknown;
    switch (field.type) {
      case 'number': {
        const n = Number(raw);
        if (!Number.isFinite(n)) return { ok: false, error: `${field.label} тоо байх ёстой` };
        value = n;
        break;
      }
      case 'datetime': {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return { ok: false, error: `${field.label} огноо буруу байна` };
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
          return { ok: false, error: `${field.label} JSON биш байна` };
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
