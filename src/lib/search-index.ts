import {
  Activity,
  Banknote,
  Building2,
  CalendarClock,
  CreditCard,
  Cpu,
  FileText,
  KeyRound,
  LayoutDashboard,
  Percent,
  Plug,
  Receipt,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Store,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';
import { COMMANDS } from './commands';
import { NAV_SECTIONS } from '@/components/shell/nav-items';
import type { UserRole } from './types';

/**
 * The catalogue behind the top-bar search.
 *
 * Two kinds of result, kept apart in the UI because they answer different
 * questions: a `menu` is a page you can open, a `function` is something you can
 * *do* — and most of those live inside a page rather than beside it in the nav.
 * Searching "данс" should surface the Тооцоо page AND the payout-account fields
 * buried in the client editor, which is the whole point of this index.
 */

export type SearchKind = 'menu' | 'function';

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  label: string;
  href: string;
  icon: typeof Activity;
  /** Nav entry this belongs under. Rendered as the breadcrumb on a result row. */
  section?: string;
  /** Where inside the page the thing actually is, when it is not obvious. */
  hint?: string;
  /**
   * Synonyms, Latin spellings and related nouns. Matching is only ever as good
   * as this list, so it is deliberately generous.
   */
  keywords: string[];
  minRole?: UserRole;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Folds the letters Mongolian typists most often substitute for one another, so
 * "толбор" still finds "төлбөр" and "уйлчилгээ" finds "үйлчилгээ".
 */
const FOLD: Record<string, string> = { ө: 'о', ү: 'у', ё: 'е', й: 'и', ъ: 'ь' };

export function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/[өүёйъ]/g, (ch) => FOLD[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Latin → Cyrillic, for the very common case of searching with the keyboard
 * still in English: "dans" finds "данс", "tulbur" finds "төлбөр".
 *
 * Longest sequences first — "sh" must be consumed before "s".
 */
const TRANSLIT: [string, string][] = [
  ['shch', 'щ'],
  ['sch', 'щ'],
  ['sh', 'ш'],
  ['ch', 'ч'],
  ['ts', 'ц'],
  ['kh', 'х'],
  ['zh', 'ж'],
  ['ya', 'я'],
  ['yo', 'е'],
  ['yu', 'ю'],
  ['ye', 'е'],
  ['ee', 'э'],
  ['oo', 'о'],
  ['uu', 'у'],
  ['ii', 'и'],
  ['a', 'а'],
  ['b', 'б'],
  ['v', 'в'],
  ['w', 'в'],
  ['g', 'г'],
  ['d', 'д'],
  ['e', 'е'],
  ['j', 'ж'],
  ['z', 'з'],
  ['i', 'и'],
  ['k', 'к'],
  ['l', 'л'],
  ['m', 'м'],
  ['n', 'н'],
  ['o', 'о'],
  ['p', 'п'],
  ['r', 'р'],
  ['s', 'с'],
  ['t', 'т'],
  ['u', 'у'],
  ['f', 'ф'],
  ['h', 'х'],
  ['c', 'ц'],
  ['q', 'к'],
  ['x', 'х'],
  ['y', 'и'],
];

export function transliterate(value: string): string {
  let out = '';
  let i = 0;
  const lower = value.toLowerCase();

  while (i < lower.length) {
    const rest = lower.slice(i);
    const hit = TRANSLIT.find(([latin]) => rest.startsWith(latin));
    if (hit) {
      out += hit[1];
      i += hit[0].length;
    } else {
      out += lower[i];
      i += 1;
    }
  }
  return fold(out);
}

// ---------------------------------------------------------------------------
// Menus — derived from the nav so the two can never drift apart
// ---------------------------------------------------------------------------

/** Extra search terms per nav route; the label alone is rarely enough. */
const MENU_KEYWORDS: Record<string, string[]> = {
  '/': ['нүүр', 'дашбоард', 'хураангуй', 'статистик', 'dashboard', 'nuur', 'toim'],
  '/charge-points': [
    'станц', 'цэнэглэгч', 'цэгүүд', 'чарж', 'station', 'charger', 'stants', 'cp', 'ocpp',
  ],
  '/connectors': ['холбогч', 'буу', 'залгуур', 'соккет', 'connector', 'gun', 'holbogch'],
  '/transactions': [
    'цэнэглэлт', 'гүйлгээ', 'сешн', 'түүх', 'transaction', 'session', 'tsenegllelt', 'guilgee',
  ],
  '/live': ['шууд', 'урсгал', 'лог', 'event', 'live', 'stream', 'shuud'],
  '/id-tags': ['карт', 'rfid', 'таг', 'нфс', 'tag', 'card', 'kart'],
  '/reservations': ['захиалга', 'урьдчилсан', 'reservation', 'booking', 'zahialga'],
  '/clients': [
    'харилцагч', 'түнш', 'эзэмшигч', 'байгууллага', 'компани', 'client', 'partner', 'haritsagch',
  ],
  '/settlements': [
    'тооцоо', 'данс', 'төлбөр', 'олголт', 'үлдэгдэл', 'орлого', 'борлуулалт',
    'settlement', 'payout', 'balance', 'dans', 'tootsoo', 'tulbur',
  ],
  '/charging-profiles': [
    'профайл', 'ухаалаг', 'хуваарь', 'хязгаар', 'profile', 'smart', 'schedule', 'profail',
  ],
  '/jobs': ['программ', 'firmware', 'лог', 'диагностик', 'шинэчлэл', 'job', 'log', 'programm'],
  '/merchants': ['qpay', 'мерчант', 'төлбөр', 'данс', 'merchant', 'payment', 'merchant id'],
  '/ebarimt-merchants': [
    'ебаримт', 'и-баримт', 'баримт', 'татвар', 'тин', 'нөат', 'ebarimt', 'tin', 'vat', 'tax',
  ],
  '/security': ['аюулгүй', 'гэрчилгээ', 'сертификат', 'security', 'certificate', 'ayuulgui'],
  '/tariffs': [
    'тариф', 'цахилгааны тариф', 'үнэ', 'тооцоолуур', 'квт', 'квтц', '350',
    'tariff', 'tariffs', 'rate', 'rates', 'calculator', 'energy', 'price', 'une', 'tootsooluur',
  ],
  '/users': ['хэрэглэгч', 'эрх', 'админ', 'бүртгэл', 'user', 'role', 'admin', 'hereglegch'],
  '/app-versions': [
    'апп', 'хувилбар', 'шинэчлэл', 'версон', 'андройд', 'айфон', 'дэлгүүр',
    'app', 'version', 'update', 'android', 'ios', 'store', 'build', 'release', 'app version',
  ],
  '/system': ['систем', 'тохиргоо', 'орчин', 'system', 'settings', 'config', 'tohirgoo'],
};

const MENU_ENTRIES: SearchEntry[] = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({
    id: `menu:${item.href}`,
    kind: 'menu' as const,
    label: item.label,
    href: item.href,
    icon: item.icon,
    section: section.title,
    keywords: MENU_KEYWORDS[item.href] ?? [],
    minRole: item.minRole,
  })),
);

// ---------------------------------------------------------------------------
// Functions — what an operator can actually do, and where it lives
// ---------------------------------------------------------------------------

const FUNCTION_ENTRIES: SearchEntry[] = [
  // ---- Цэнэглэх станц ----
  {
    id: 'fn:cp-create',
    kind: 'function',
    label: 'Станц бүртгэх',
    href: '/charge-points',
    icon: Zap,
    section: 'Цэнэглэх станц',
    hint: 'Жагсаалтын дээд талын "Станц бүртгэх" товч',
    keywords: ['шинэ', 'нэмэх', 'үүсгэх', 'бүртгэх', 'new', 'create', 'add', 'nemeh', 'shine'],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:cp-tariff',
    kind: 'function',
    label: 'Станцын тариф тохируулах',
    href: '/charge-points',
    icon: Banknote,
    section: 'Цэнэглэх станц',
    hint: 'Станц засах цонх → Тариф (₮/кВт·ц)',
    keywords: [
      'тариф', 'үнэ', 'ханш', 'кВт', 'квт', 'price', 'tariff', 'tarif', 'une', 'rate', 'kwh',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:cp-fee',
    kind: 'function',
    label: 'Станцын үйлчилгээний хураамж',
    href: '/charge-points',
    icon: Percent,
    section: 'Цэнэглэх станц',
    hint: 'Станц засах цонх → Хураамж %. Хоосон бол харилцагчийнхаас',
    keywords: [
      'хураамж', 'шимтгэл', 'хувь', 'процент', 'fee', 'percent', 'commission', 'huraamj',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:cp-ebarimt',
    kind: 'function',
    label: 'Станцын и-баримт мерчант',
    href: '/charge-points',
    icon: FileText,
    section: 'Цэнэглэх станц',
    hint: 'Станц засах цонх → И-Баримт мерчант',
    keywords: ['ебаримт', 'и-баримт', 'баримт', 'татвар', 'tin', 'ebarimt', 'merchant'],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:cp-location',
    kind: 'function',
    label: 'Станцын байршил, хаяг',
    href: '/charge-points',
    icon: Zap,
    section: 'Цэнэглэх станц',
    hint: 'Станц засах цонх → Өргөрөг / Уртраг / Хаяг',
    keywords: [
      'байршил', 'хаяг', 'өргөрөг', 'уртраг', 'газрын зураг', 'location', 'address', 'gps',
      'map', 'bairshil', 'hayag',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:cp-authkey',
    kind: 'function',
    label: 'AuthorizationKey шинэчлэх',
    href: '/charge-points',
    icon: KeyRound,
    section: 'Цэнэглэх станц',
    hint: 'Станцын дэлгэрэнгүй → Тойм таб',
    keywords: [
      'түлхүүр', 'нууц үг', 'нууц', 'аюулгүй', 'key', 'password', 'secret', 'auth', 'tulhuur',
    ],
    minRole: 'ADMIN',
  },
  {
    id: 'fn:cp-config',
    kind: 'function',
    label: 'Станцын тохиргоо унших, өөрчлөх',
    href: '/charge-points',
    icon: SlidersHorizontal,
    section: 'Цэнэглэх станц',
    hint: 'Станцын дэлгэрэнгүй → Тохиргоо таб',
    keywords: [
      'тохиргоо', 'түлхүүр', 'утга', 'параметр', 'configuration', 'config', 'key', 'tohirgoo',
    ],
  },
  {
    id: 'fn:cp-messages',
    kind: 'function',
    label: 'OCPP мессежийн урсгал',
    href: '/charge-points',
    icon: Terminal,
    section: 'Цэнэглэх станц',
    hint: 'Станцын дэлгэрэнгүй → OCPP мессеж таб',
    keywords: ['мессеж', 'лог', 'протокол', 'ocpp', 'message', 'log', 'debug', 'messej'],
  },
  {
    id: 'fn:cp-command-log',
    kind: 'function',
    label: 'Командын түүх',
    href: '/charge-points',
    icon: Terminal,
    section: 'Цэнэглэх станц',
    hint: 'Станцын дэлгэрэнгүй → Командын түүх таб',
    keywords: ['команд', 'түүх', 'лог', 'command', 'history', 'log', 'komand'],
  },
  {
    id: 'fn:cp-delete',
    kind: 'function',
    label: 'Станц устгах',
    href: '/charge-points',
    icon: Zap,
    section: 'Цэнэглэх станц',
    hint: 'Станцын дэлгэрэнгүй → Үйлдэл',
    keywords: ['устгах', 'хасах', 'delete', 'remove', 'ustgah'],
    minRole: 'ADMIN',
  },

  // ---- Холбогч ----
  {
    id: 'fn:connector-availability',
    kind: 'function',
    label: 'Холбогчийг ажиллагаатай / ажиллагаагүй болгох',
    href: '/connectors',
    icon: Plug,
    section: 'Холбогч',
    hint: 'Холбогчийн мөрөн дэх "Удирдах" товч',
    keywords: [
      'ашиглалт', 'ажиллагаа', 'хаах', 'нээх', 'идэвхгүй', 'availability', 'disable', 'enable',
      'operative',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:connector-unlock',
    kind: 'function',
    label: 'Холбогч тайлах',
    href: '/connectors',
    icon: Plug,
    section: 'Холбогч',
    hint: 'Холбогчийн мөрөн дэх "Удирдах" цонх',
    keywords: ['тайлах', 'онгойлгох', 'түгжээ', 'unlock', 'release', 'tailah'],
    minRole: 'OPERATOR',
  },

  // ---- Цэнэглэлт ----
  {
    id: 'fn:tx-refund',
    kind: 'function',
    label: 'Цэнэглэлтийн буцаалт хийх',
    href: '/transactions',
    icon: RotateCcw,
    section: 'Цэнэглэлт',
    hint: 'Цэнэглэлтийн дэлгэрэнгүй → Буцаалт хийх',
    keywords: [
      'буцаалт', 'буцаах', 'мөнгө буцаах', 'хэтэвч', 'refund', 'return', 'butsaalt', 'butsaah',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:tx-breakdown',
    kind: 'function',
    label: 'Төлбөрийн задаргаа: эрчим хүч ба хураамж',
    href: '/transactions',
    icon: Banknote,
    section: 'Цэнэглэлт',
    hint: 'Цэнэглэлтийн дэлгэрэнгүй → Нөхцөл',
    keywords: [
      'төлбөр', 'задаргаа', 'хураамж', 'эрчим хүч', 'өртөг', 'cost', 'fee', 'energy', 'tulbur',
    ],
  },
  {
    id: 'fn:tx-meter',
    kind: 'function',
    label: 'Тоолуурын утгууд',
    href: '/transactions',
    icon: Activity,
    section: 'Цэнэглэлт',
    hint: 'Цэнэглэлтийн дэлгэрэнгүй → Тоолуурын утгууд',
    keywords: [
      'тоолуур', 'хэмжилт', 'фаз', 'чадал', 'meter', 'measurand', 'phase', 'soc', 'tooluur',
    ],
  },
  {
    id: 'fn:tx-ebarimt',
    kind: 'function',
    label: 'Цэнэглэлтийн и-баримт',
    href: '/transactions',
    icon: Receipt,
    section: 'Цэнэглэлт',
    hint: 'Цэнэглэлтийн дэлгэрэнгүй → И-Баримт',
    keywords: [
      'ебаримт', 'и-баримт', 'баримт', 'ддтд', 'qr', 'татвар', 'ebarimt', 'receipt', 'barimt',
    ],
  },

  // ---- RFID карт ----
  {
    id: 'fn:tag-create',
    kind: 'function',
    label: 'RFID карт нэмэх',
    href: '/id-tags',
    icon: CreditCard,
    section: 'RFID карт',
    keywords: ['карт', 'нэмэх', 'шинэ', 'таг', 'card', 'tag', 'new', 'add', 'kart'],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:tag-import',
    kind: 'function',
    label: 'Картуудыг бөөнөөр импортлох',
    href: '/id-tags',
    icon: CreditCard,
    section: 'RFID карт',
    hint: 'Жагсаалтын дээд талын "Импорт" товч',
    keywords: ['импорт', 'бөөнөөр', 'олноор', 'csv', 'import', 'bulk', 'import'],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:tag-authorize',
    kind: 'function',
    label: 'Зөвшөөрлийн шалгалт',
    href: '/id-tags',
    icon: ShieldCheck,
    section: 'RFID карт',
    hint: 'Карт жинхэнэ станц дээр ажиллах эсэхийг шалгана',
    keywords: [
      'зөвшөөрөл', 'шалгах', 'тест', 'authorize', 'check', 'test', 'zuvshuurul', 'shalgalt',
    ],
  },

  // ---- Захиалга ----
  {
    id: 'fn:reservation-cancel',
    kind: 'function',
    label: 'Захиалга цуцлах',
    href: '/reservations',
    icon: CalendarClock,
    section: 'Захиалга',
    keywords: ['захиалга', 'цуцлах', 'болих', 'cancel', 'reservation', 'tsutslah'],
    minRole: 'OPERATOR',
  },

  // ---- Харилцагч ----
  {
    id: 'fn:client-create',
    kind: 'function',
    label: 'Харилцагч нэмэх',
    href: '/clients',
    icon: Building2,
    section: 'Харилцагч',
    keywords: [
      'харилцагч', 'түнш', 'байгууллага', 'нэмэх', 'шинэ', 'client', 'partner', 'new', 'add',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:client-payout-account',
    kind: 'function',
    label: 'Төлбөр шилжүүлэх данс',
    href: '/clients',
    icon: Banknote,
    section: 'Харилцагч',
    hint: 'Харилцагч засах цонх → Тооцоо ба е-баримт',
    keywords: [
      'данс', 'дансны дугаар', 'банк', 'банкны', 'шилжүүлэг', 'гүйлгээ', 'эзэмшигч',
      'bank', 'account', 'payout', 'iban', 'dans', 'dansnii dugaar', 'bankni',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:client-fee',
    kind: 'function',
    label: 'Харилцагчийн үйлчилгээний хураамж',
    href: '/clients',
    icon: Percent,
    section: 'Харилцагч',
    hint: 'Харилцагч засах цонх → Тооцоо ба е-баримт',
    keywords: ['хураамж', 'шимтгэл', 'хувь', 'процент', 'fee', 'percent', 'huraamj'],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:client-ebarimt',
    kind: 'function',
    label: 'Харилцагчийн и-баримт мерчант',
    href: '/clients',
    icon: FileText,
    section: 'Харилцагч',
    hint: 'Харилцагч засах цонх → Тооцоо ба е-баримт',
    keywords: ['ебаримт', 'и-баримт', 'татвар', 'tin', 'ebarimt', 'merchant', 'barimt'],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:client-stations',
    kind: 'function',
    label: 'Харилцагчийн станцууд ба тооцоо',
    href: '/clients',
    icon: Building2,
    section: 'Харилцагч',
    hint: 'Харилцагчийн дэлгэрэнгүй → Тооцоо ба данс',
    keywords: [
      'станц', 'тооцоо', 'данс', 'орлого', 'борлуулалт', 'station', 'settlement', 'revenue',
    ],
    minRole: 'OPERATOR',
  },

  // ---- Тооцоо ----
  {
    id: 'fn:settlement-create',
    kind: 'function',
    label: 'Харилцагчид олгосон төлбөр бүртгэх',
    href: '/settlements',
    icon: Banknote,
    section: 'Тооцоо',
    hint: 'Харилцагчийн мөрөн дэх "Төлбөр бүртгэх"',
    keywords: [
      'төлбөр', 'олгох', 'шилжүүлэх', 'данс', 'гүйлгээний утга', 'payout', 'settle', 'transfer',
      'dans', 'tulbur',
    ],
    minRole: 'ADMIN',
  },
  {
    id: 'fn:settlement-history',
    kind: 'function',
    label: 'Төлбөрийн түүх',
    href: '/settlements',
    icon: Banknote,
    section: 'Тооцоо',
    keywords: ['түүх', 'олголт', 'данс', 'history', 'payout', 'tuuh', 'dans'],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:settlement-outstanding',
    kind: 'function',
    label: 'Нийт үлдэгдэл, харилцагчид олгох дүн',
    href: '/settlements',
    icon: Banknote,
    section: 'Тооцоо',
    keywords: [
      'үлдэгдэл', 'өр', 'авлага', 'данс', 'нийт', 'balance', 'outstanding', 'owed', 'uldegdel',
    ],
    minRole: 'OPERATOR',
  },

  // ---- Мерчант ----
  {
    id: 'fn:qpay-merchant',
    kind: 'function',
    label: 'QPay мерчант нэмэх',
    href: '/merchants',
    icon: Store,
    section: 'QPay мерчант',
    keywords: [
      'qpay', 'мерчант', 'төлбөр', 'данс', 'quickqr', 'merchant', 'payment', 'merchant id',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:qpay-active',
    kind: 'function',
    label: 'Идэвхтэй QPay мерчант сонгох',
    href: '/merchants',
    icon: Store,
    section: 'QPay мерчант',
    hint: 'Нэхэмжлэх энэ мерчантаар үүснэ',
    keywords: ['идэвхтэй', 'сонгох', 'qpay', 'active', 'select', 'idevhtei'],
    minRole: 'ADMIN',
  },
  {
    id: 'fn:ebarimt-merchant',
    kind: 'function',
    label: 'И-Баримт тохиргоо нэмэх (TIN, дүүрэг, салбар)',
    href: '/ebarimt-merchants',
    icon: FileText,
    section: 'И-Баримт мерчант',
    keywords: [
      'ебаримт', 'и-баримт', 'татвар', 'тин', 'дүүрэг', 'салбар', 'нөат', 'ebarimt', 'tin',
      'vat', 'tax', 'posapi',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:ebarimt-status',
    kind: 'function',
    label: 'И-Баримт серверийн төлөв',
    href: '/ebarimt-merchants',
    icon: FileText,
    section: 'И-Баримт мерчант',
    keywords: ['төлөв', 'сервер', 'холболт', 'шалгах', 'status', 'server', 'health', 'tuluv'],
  },

  // ---- Ухаалаг цэнэглэлт / Jobs ----
  {
    id: 'fn:profile-set',
    kind: 'function',
    label: 'Цэнэглэх профайл тохируулах',
    href: '/charging-profiles',
    icon: SlidersHorizontal,
    section: 'Ухаалаг цэнэглэлт',
    keywords: [
      'профайл', 'хязгаар', 'чадал', 'хуваарь', 'ухаалаг', 'profile', 'limit', 'smart', 'profail',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:firmware',
    kind: 'function',
    label: 'Программ хангамж шинэчлэх',
    href: '/jobs',
    icon: Cpu,
    section: 'Программ хангамж ба лог',
    keywords: [
      'программ', 'firmware', 'шинэчлэл', 'update', 'хувилбар', 'version', 'programm',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:diagnostics',
    kind: 'function',
    label: 'Лог, диагностик татах',
    href: '/jobs',
    icon: Cpu,
    section: 'Программ хангамж ба лог',
    keywords: ['лог', 'диагностик', 'татах', 'log', 'diagnostics', 'download', 'debug'],
    minRole: 'OPERATOR',
  },

  // ---- Апп хувилбар ----
  {
    id: 'fn:app-release-latest',
    kind: 'function',
    label: 'Аппын сүүлийн хувилбар, билд тохируулах',
    href: '/app-versions',
    icon: Smartphone,
    section: 'Апп хувилбар',
    hint: 'Android, iOS тус бүр тусдаа',
    keywords: [
      'хувилбар', 'билд', 'шинэчлэл', 'апп', 'version', 'build', 'update', 'release',
      'versioncode', 'cfbundleversion',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:app-release-force',
    kind: 'function',
    label: 'Заавал шинэчлэх босго тохируулах',
    href: '/app-versions',
    icon: Smartphone,
    section: 'Апп хувилбар',
    hint: 'Энэ билдээс доош апп нээгдэхгүй',
    keywords: [
      'заавал', 'албадах', 'босго', 'хаах', 'force', 'mandatory', 'required', 'minimum',
      'zaavaal', 'albadah',
    ],
    minRole: 'OPERATOR',
  },
  {
    id: 'fn:app-release-store-url',
    kind: 'function',
    label: 'Play Store / App Store татах холбоос',
    href: '/app-versions',
    icon: Smartphone,
    section: 'Апп хувилбар',
    hint: 'Платформ бүр өөрийн холбоостой',
    keywords: [
      'дэлгүүр', 'холбоос', 'татах', 'линк', 'play', 'appstore', 'playstore', 'store', 'url',
      'link', 'download', 'delguur', 'holboos',
    ],
    minRole: 'OPERATOR',
  },

  // ---- Хэрэглэгч / систем ----
  {
    id: 'fn:user-create',
    kind: 'function',
    label: 'Консолын хэрэглэгч нэмэх',
    href: '/users',
    icon: Users,
    section: 'Хэрэглэгчид',
    keywords: ['хэрэглэгч', 'нэмэх', 'админ', 'оператор', 'user', 'add', 'new', 'hereglegch'],
    minRole: 'ADMIN',
  },
  {
    id: 'fn:user-role',
    kind: 'function',
    label: 'Хэрэглэгчийн эрх өөрчлөх',
    href: '/users',
    icon: ShieldCheck,
    section: 'Хэрэглэгчид',
    keywords: [
      'эрх', 'хандалт', 'админ', 'оператор', 'харагч', 'role', 'permission', 'access', 'erh',
    ],
    minRole: 'ADMIN',
  },
  {
    id: 'fn:live-filter',
    kind: 'function',
    label: 'Үйл явдлын урсгал шүүх',
    href: '/live',
    icon: Activity,
    section: 'Шууд урсгал',
    keywords: ['шүүлтүүр', 'үйл явдал', 'урсгал', 'filter', 'event', 'live', 'shuultuur'],
  },
  {
    id: 'fn:system-settings',
    kind: 'function',
    label: 'Системийн тохиргоо ба орчин',
    href: '/system',
    icon: Settings,
    section: 'Систем',
    keywords: ['систем', 'тохиргоо', 'орчин', 'хувилбар', 'system', 'settings', 'env', 'version'],
  },
  {
    id: 'fn:dashboard-stats',
    kind: 'function',
    label: 'Орлого, эрчим хүчний статистик',
    href: '/',
    icon: LayoutDashboard,
    section: 'Ерөнхий тойм',
    keywords: [
      'статистик', 'орлого', 'эрчим хүч', 'график', 'тойм', 'revenue', 'energy', 'chart', 'stats',
    ],
  },
  {
    id: 'fn:security-certs',
    kind: 'function',
    label: 'Гэрчилгээ ба аюулгүй байдлын үйл явдал',
    href: '/security',
    icon: ShieldCheck,
    section: 'Аюулгүй байдал',
    keywords: [
      'гэрчилгээ', 'сертификат', 'аюулгүй', 'csr', 'certificate', 'security', 'gerchilgee',
    ],
  },
];

/**
 * Every OCPP command is also a function an operator may be hunting for, and the
 * console already describes them properly — so they are folded in rather than
 * being retyped and left to rot out of sync.
 */
const COMMAND_ENTRIES: SearchEntry[] = COMMANDS.map((command) => ({
  id: `cmd:${command.slug}`,
  kind: 'function' as const,
  label: command.label,
  href: '/charge-points',
  icon: Terminal,
  section: 'Цэнэглэх станц',
  hint: `Станц сонгоод Команд таб · ${command.action}`,
  keywords: [
    'команд', 'command', 'ocpp', command.action.toLowerCase(), command.slug,
    ...command.description.toLowerCase().split(/[^\wа-яөүё]+/).filter((w) => w.length > 3),
  ],
  minRole: 'OPERATOR' as UserRole,
}));

export const SEARCH_ENTRIES: SearchEntry[] = [
  ...MENU_ENTRIES,
  ...FUNCTION_ENTRIES,
  ...COMMAND_ENTRIES,
];

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const RANK: Record<UserRole, number> = { CLIENT: 0, VIEWER: 1, OPERATOR: 2, ADMIN: 3 };

export interface SearchResult {
  entry: SearchEntry;
  score: number;
}

/** Best score one token achieves against one entry, or 0 for no match at all. */
function scoreToken(entry: SearchEntry, token: string): number {
  const label = fold(entry.label);
  const section = fold(entry.section ?? '');
  const hint = fold(entry.hint ?? '');

  if (label.startsWith(token)) return 100;
  if (label.split(' ').some((word) => word.startsWith(token))) return 80;

  for (const keyword of entry.keywords) {
    const k = fold(keyword);
    if (k === token) return 75;
    if (k.startsWith(token)) return 60;
    if (k.includes(token)) return 40;
  }

  if (label.includes(token)) return 50;
  // The section is real context — "данс харилцагч" should keep the client-side
  // account above an unrelated page that merely mentions данс.
  if (section.startsWith(token)) return 55;
  if (section.includes(token)) return 40;
  if (hint.includes(token)) return 25;

  return 0;
}

/**
 * Every token must match something (AND), so "данс харилцагч" narrows rather
 * than widens. Each token is tried as typed and transliterated from Latin, and
 * the better of the two wins.
 */
export function searchEntries(query: string, role: UserRole): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const tokens = fold(trimmed).split(' ').filter(Boolean);
  const latin = transliterate(trimmed).split(' ').filter(Boolean);

  const results: SearchResult[] = [];

  for (const entry of SEARCH_ENTRIES) {
    if (RANK[role] < RANK[entry.minRole ?? 'VIEWER']) continue;

    let total = 0;
    let matchedAll = true;

    for (let i = 0; i < tokens.length; i++) {
      const direct = scoreToken(entry, tokens[i]!);
      // Only worth transliterating a token that was typed in Latin.
      const viaLatin = /[a-z]/.test(tokens[i]!) && latin[i] ? scoreToken(entry, latin[i]!) : 0;
      const best = Math.max(direct, viaLatin);

      if (best === 0) {
        matchedAll = false;
        break;
      }
      total += best;
    }

    if (matchedAll) results.push({ entry, score: total / tokens.length });
  }

  return results.sort(
    (a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, 'mn'),
  );
}

/** Shown before anything is typed. */
export function defaultEntries(role: UserRole): SearchEntry[] {
  const wanted = ['/charge-points', '/transactions', '/clients', '/settlements', '/id-tags'];
  return wanted
    .map((href) => MENU_ENTRIES.find((entry) => entry.href === href))
    .filter((entry): entry is SearchEntry => Boolean(entry))
    .filter((entry) => RANK[role] >= RANK[entry.minRole ?? 'VIEWER']);
}
