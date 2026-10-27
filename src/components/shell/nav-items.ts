import {
  Activity,
  Banknote,
  BarChart3,
  BatteryCharging,
  Building2,
  Calculator,
  CalendarClock,
  CreditCard,
  Wallet,
  Cpu,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  PhoneCall,
  Plug,
  Receipt,
  PlayCircle,
  Settings,
  Smartphone,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Users,
  Zap,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Activity;
  /** Minimum role required to see the entry. Defaults to VIEWER. */
  minRole?: UserRole;
  /** Match nested routes, e.g. /charge-points/CP-1. */
  prefix?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const CLIENT_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Миний станцууд',
    items: [
      { href: '/', label: 'Ерөнхий тойм', icon: LayoutDashboard },
      { href: '/charge-points', label: 'Цэнэглэх станц', icon: Zap, prefix: true },
      { href: '/connectors', label: 'Холбогч', icon: Plug },
      { href: '/transactions', label: 'Цэнэглэлт', icon: BatteryCharging, prefix: true },
      { href: '/ebarimt', label: 'И-Баримт', icon: Receipt, prefix: true },
    ],
  },
  {
    title: 'Тайлан & Тооцоо',
    items: [
      { href: '/reports', label: 'Тайлан', icon: FileSpreadsheet, prefix: true },
      { href: '/settlements', label: 'Тооцоо', icon: Banknote },
      { href: '/tariffs', label: 'Цахилгааны тариф', icon: Calculator },
    ],
  },
  {
    title: 'Хандалт',
    items: [
      { href: '/drivers', label: 'Жолооч', icon: Users, prefix: true },
    ],
  },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Үйл ажиллагаа',
    items: [
      { href: '/', label: 'Ерөнхий тойм', icon: LayoutDashboard },
      { href: '/charge-points', label: 'Цэнэглэх станц', icon: Zap, prefix: true },
      { href: '/connectors', label: 'Холбогч', icon: Plug },
      { href: '/transactions', label: 'Цэнэглэлт', icon: BatteryCharging, prefix: true },
      { href: '/payments', label: 'Төлбөр', icon: Wallet },
      { href: '/ebarimt', label: 'И-Баримт', icon: Receipt, prefix: true },
      { href: '/reports', label: 'Тайлан', icon: FileSpreadsheet, prefix: true },
      { href: '/analytics', label: 'Вэб & Апп хандалт', icon: BarChart3, minRole: 'VIEWER' },
      { href: '/live', label: 'Шууд урсгал', icon: Activity },
      { href: '/simulator', label: 'OCPP Симулятор', icon: PlayCircle },
    ],
  },
  {
    title: 'Хандалт',
    items: [
      { href: '/drivers', label: 'Жолооч', icon: Users, prefix: true },
      { href: '/reservations', label: 'Захиалга', icon: CalendarClock },
    ],
  },
  {
    title: 'Удирдлага',
    items: [
      { href: '/clients', label: 'Харилцагч', icon: Building2, minRole: 'OPERATOR', prefix: true },
      { href: '/announcements', label: 'Мэдээ', icon: Megaphone, minRole: 'OPERATOR' },
      { href: '/feedback', label: 'Санал хүсэлт', icon: MessageSquareText, minRole: 'OPERATOR' },
      { href: '/contact', label: 'Холбоо барих', icon: PhoneCall, minRole: 'OPERATOR' },
      { href: '/settlements', label: 'Тооцоо', icon: Banknote, minRole: 'OPERATOR' },
      { href: '/charging-profiles', label: 'Ухаалаг цэнэглэлт', icon: SlidersHorizontal },
      { href: '/jobs', label: 'Программ хангамж ба лог', icon: Cpu },
      { href: '/merchants', label: 'QPay мерчант', icon: Store, minRole: 'OPERATOR' },
      { href: '/ebarimt-merchants', label: 'И-Баримт мерчант', icon: FileText, minRole: 'OPERATOR' },
      { href: '/tariffs', label: 'Цахилгааны тариф', icon: Calculator, prefix: true },
      { href: '/security', label: 'Аюулгүй байдал', icon: ShieldCheck, prefix: true },
    ],
  },
  {
    title: 'Системийн удирдлага',
    items: [
      { href: '/users', label: 'Хэрэглэгчид', icon: Users, minRole: 'ADMIN' },
      { href: '/app-versions', label: 'Апп хувилбар', icon: Smartphone, minRole: 'OPERATOR' },
      { href: '/system', label: 'Систем', icon: Settings },
    ],
  },
];

const RANK: Record<UserRole, number> = { CLIENT: 0, VIEWER: 1, OPERATOR: 2, ADMIN: 3 };

export interface ManageableMenu {
  href: string;
  label: string;
  section: 'Үйл ажиллагаа' | 'Хандалт';
}

export const MANAGEABLE_MENUS: ManageableMenu[] = [
  // Үйл ажиллагаа
  { href: '/', label: 'Ерөнхий тойм', section: 'Үйл ажиллагаа' },
  { href: '/charge-points', label: 'Цэнэглэх станц', section: 'Үйл ажиллагаа' },
  { href: '/connectors', label: 'Холбогч', section: 'Үйл ажиллагаа' },
  { href: '/transactions', label: 'Цэнэглэлт', section: 'Үйл ажиллагаа' },
  { href: '/payments', label: 'Төлбөр', section: 'Үйл ажиллагаа' },
  { href: '/ebarimt', label: 'И-Баримт', section: 'Үйл ажиллагаа' },
  { href: '/reports', label: 'Тайлан', section: 'Үйл ажиллагаа' },
  { href: '/live', label: 'Шууд урсгал', section: 'Үйл ажиллагаа' },
  { href: '/simulator', label: 'OCPP Симулятор', section: 'Үйл ажиллагаа' },
  // Хандалт
  { href: '/drivers', label: 'Жолооч', section: 'Хандалт' },
  { href: '/reservations', label: 'Захиалга', section: 'Хандалт' },
];

export function visibleSections(role: UserRole, allowedMenus?: string[]): NavSection[] {
  if (allowedMenus && allowedMenus.length > 0) {
    const allowedSet = new Set(allowedMenus);
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => allowedSet.has(item.href)),
    })).filter((section) => section.items.length > 0);
  }
  if (role === 'CLIENT') {
    return CLIENT_NAV_SECTIONS;
  }
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => RANK[role] >= RANK[item.minRole ?? 'VIEWER']),
  })).filter((section) => section.items.length > 0);
}
