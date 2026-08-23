/**
 * Mongolian display labels.
 *
 * The console speaks Mongolian, but OCPP itself does not: statuses, actions and
 * error codes travel over the wire as English identifiers. Everything here maps
 * a protocol value to what the operator reads on screen. Raw protocol values are
 * still shown verbatim in the OCPP message log, where they are the data.
 *
 * `mn()` falls back to the raw value, so a status a future firmware invents
 * appears untranslated instead of blank.
 */

export function mn(map: Record<string, string>, value?: string | null): string {
  if (!value) return '—';
  return map[value] ?? value;
}

/** OCPP 1.6 connector states. */
export const CONNECTOR_STATUS: Record<string, string> = {
  Available: 'Бэлэн',
  Preparing: 'Бэлтгэж байна',
  Charging: 'Цэнэглэж байна',
  SuspendedEV: 'Машин түр зогсоосон',
  SuspendedEVSE: 'Станц түр зогсоосон',
  Finishing: 'Дуусгаж байна',
  Reserved: 'Захиалагдсан',
  Unavailable: 'Ашиглах боломжгүй',
  Faulted: 'Эвдрэлтэй',
};

export const TRANSACTION_STATUS: Record<string, string> = {
  Active: 'Идэвхтэй',
  Completed: 'Дууссан',
  Rejected: 'Татгалзсан',
};

export const AUTH_STATUS: Record<string, string> = {
  Accepted: 'Зөвшөөрсөн',
  Blocked: 'Хориглосон',
  Expired: 'Хугацаа дууссан',
  Invalid: 'Буруу',
  ConcurrentTx: 'Зэрэг цэнэглэлт',
};

export const REGISTRATION_STATUS: Record<string, string> = {
  Accepted: 'Бүртгэгдсэн',
  Pending: 'Хүлээгдэж буй',
  Rejected: 'Татгалзсан',
};

export const RESERVATION_STATE: Record<string, string> = {
  Active: 'Идэвхтэй',
  Used: 'Ашигласан',
  Cancelled: 'Цуцалсан',
  Expired: 'Хугацаа дууссан',
  Rejected: 'Татгалзсан',
};

export const COMMAND_STATUS: Record<string, string> = {
  Pending: 'Хүлээгдэж буй',
  Sent: 'Илгээсэн',
  Success: 'Амжилттай',
  Failed: 'Амжилтгүй',
  TimedOut: 'Хугацаа хэтэрсэн',
};

export const CSR_STATUS: Record<string, string> = {
  Pending: 'Хүлээгдэж буй',
  Signed: 'Баталгаажсан',
  Delivered: 'Хүргэгдсэн',
  Rejected: 'Татгалзсан',
  Failed: 'Амжилтгүй',
};

export const ROLE: Record<string, string> = {
  ADMIN: 'Админ',
  OPERATOR: 'Оператор',
  VIEWER: 'Үзэгч',
};

export const ID_TAG_STATUS: Record<string, string> = {
  Accepted: 'Идэвхтэй',
  Blocked: 'Хориглосон',
  Expired: 'Хугацаа дууссан',
  Invalid: 'Буруу',
};

export const FIRMWARE_STATUS: Record<string, string> = {
  Idle: 'Хүлээлгэнд',
  Downloaded: 'Татагдсан',
  Downloading: 'Татаж байна',
  DownloadFailed: 'Татаж чадсангүй',
  InstallationFailed: 'Суулгаж чадсангүй',
  Installing: 'Суулгаж байна',
  Installed: 'Суусан',
  SignatureVerified: 'Гарын үсэг шалгасан',
  InvalidSignature: 'Гарын үсэг буруу',
};

export const DIAGNOSTICS_STATUS: Record<string, string> = {
  Idle: 'Хүлээлгэнд',
  Uploaded: 'Илгээгдсэн',
  UploadFailed: 'Илгээж чадсангүй',
  Uploading: 'Илгээж байна',
};

/** Live event names from the backend's SSE stream. */
export const EVENT: Record<string, string> = {
  'chargepoint.connected': 'Станц холбогдлоо',
  'chargepoint.disconnected': 'Станц салсан',
  'chargepoint.boot': 'Станц асав',
  'chargepoint.heartbeat': 'Амьд дохио',
  'connector.status': 'Холбогчийн төлөв',
  'transaction.started': 'Цэнэглэлт эхэлсэн',
  'transaction.stopped': 'Цэнэглэлт дууссан',
  'transaction.metervalue': 'Тоолуурын утга',
  'security.event': 'Аюулгүй байдлын үйл явдал',
  'firmware.status': 'Программ хангамжийн төлөв',
  'diagnostics.status': 'Оношилгооны төлөв',
  'log.status': 'Логийн төлөв',
  'command.result': 'Командын хариу',
  'ocpp.message': 'OCPP мессеж',
};

/** OCPP 1.6 measurands, for readings the dashboard does not roll up itself. */
export const MEASURAND: Record<string, string> = {
  'Energy.Active.Import.Register': 'Тоолуур',
  'Energy.Active.Import.Interval': 'Эрчим хүч',
  'Energy.Active.Export.Register': 'Буцаалтын тоолуур',
  'Power.Active.Import': 'Чадал',
  'Power.Active.Export': 'Буцаалтын чадал',
  'Power.Offered': 'Санал болгосон чадал',
  'Current.Import': 'Гүйдэл',
  'Current.Export': 'Буцаалтын гүйдэл',
  'Current.Offered': 'Санал болгосон гүйдэл',
  Voltage: 'Хүчдэл',
  Frequency: 'Давтамж',
  Temperature: 'Температур',
  SoC: 'Цэнэг',
};

/** Reasons a charge point reports when a session stops. */
export const STOP_REASON: Record<string, string> = {
  EmergencyStop: 'Яаралтай зогсоолт',
  EVDisconnected: 'Машин салгасан',
  HardReset: 'Хүчтэй дахин ачаалалт',
  Local: 'Станц дээрээс',
  Other: 'Бусад',
  PowerLoss: 'Цахилгаан тасарсан',
  Reboot: 'Дахин ачаалсан',
  Remote: 'Алсаас',
  SoftReset: 'Зөөлөн дахин ачаалалт',
  UnlockCommand: 'Тайлах команд',
  DeAuthorized: 'Эрх цуцлагдсан',
};

/** Command console groups. The keys are the CommandGroup union in lib/commands.ts. */
export const COMMAND_GROUP: Record<string, string> = {
  Session: 'Цэнэглэлт удирдах',
  Availability: 'Ашиглалт ба сэргээлт',
  Configuration: 'Тохиргоо',
  Reservation: 'Захиалга',
  'Smart charging': 'Ухаалаг цэнэглэлт',
  'Local list': 'Картын дотоод жагсаалт',
  'Firmware & logs': 'Программ ба лог',
  Certificates: 'Гэрчилгээ',
  Advanced: 'Нарийвчилсан',
};
