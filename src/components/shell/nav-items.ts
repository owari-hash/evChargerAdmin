import {
  Activity,
  BatteryCharging,
  CalendarClock,
  CreditCard,
  Cpu,
  LayoutDashboard,
  Plug,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
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

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Үйл ажиллагаа',
    items: [
      { href: '/', label: 'Ерөнхий тойм', icon: LayoutDashboard },
      { href: '/charge-points', label: 'Цэнэглэх станц', icon: Zap, prefix: true },
      { href: '/connectors', label: 'Холбогч', icon: Plug },
      { href: '/transactions', label: 'Цэнэглэлт', icon: BatteryCharging, prefix: true },
      { href: '/live', label: 'Шууд урсгал', icon: Activity },
    ],
  },
  {
    title: 'Хандалт',
    items: [
      { href: '/id-tags', label: 'RFID карт', icon: CreditCard, prefix: true },
      { href: '/reservations', label: 'Захиалга', icon: CalendarClock },
    ],
  },
  {
    title: 'Удирдлага',
    items: [
      { href: '/charging-profiles', label: 'Ухаалаг цэнэглэлт', icon: SlidersHorizontal },
      { href: '/jobs', label: 'Программ хангамж ба лог', icon: Cpu },
      { href: '/security', label: 'Аюулгүй байдал', icon: ShieldCheck, prefix: true },
    ],
  },
  {
    title: 'Системийн удирдлага',
    items: [
      { href: '/users', label: 'Хэрэглэгчид', icon: Users, minRole: 'ADMIN' },
      { href: '/system', label: 'Систем', icon: Settings },
    ],
  },
];

const RANK: Record<UserRole, number> = { VIEWER: 0, OPERATOR: 1, ADMIN: 2 };

export function visibleSections(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => RANK[role] >= RANK[item.minRole ?? 'VIEWER']),
  })).filter((section) => section.items.length > 0);
}
