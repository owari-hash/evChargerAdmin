import { cn } from '@/lib/cn';

/**
 * The row of page-level controls (period switcher, date range, tabs). Pages
 * carry no title — the sidebar already says where you are. It sits under the
 * stat cards, right above the content it filters.
 */
export function PageToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}
