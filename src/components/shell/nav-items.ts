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
    title: 'Operations',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/charge-points', label: 'Charge points', icon: Zap, prefix: true },
      { href: '/connectors', label: 'Connectors', icon: Plug },
      { href: '/transactions', label: 'Sessions', icon: BatteryCharging, prefix: true },
      { href: '/live', label: 'Live feed', icon: Activity },
    ],
  },
  {
    title: 'Access',
    items: [
      { href: '/id-tags', label: 'RFID tags', icon: CreditCard, prefix: true },
      { href: '/reservations', label: 'Reservations', icon: CalendarClock },
    ],
  },
  {
    title: 'Management',
    items: [
      { href: '/charging-profiles', label: 'Smart charging', icon: SlidersHorizontal },
      { href: '/jobs', label: 'Firmware & logs', icon: Cpu },
      { href: '/security', label: 'Security', icon: ShieldCheck, prefix: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/users', label: 'Users', icon: Users, minRole: 'ADMIN' },
      { href: '/system', label: 'System', icon: Settings },
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
