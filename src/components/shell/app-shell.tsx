'use client';

import * as React from 'react';
import { SWRConfig } from 'swr';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { FirstRunGuideProvider } from './first-run-guide';
import { LiveStreamProvider } from './live-stream';
import type { SessionUser } from '@/lib/types';
import { SWR_DEFAULTS } from '@/lib/live-query';

import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

export function AppShell({
  user,
  children,
}: {
  user: SessionUser & { allowedMenus?: string[] };
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isAllowed = React.useMemo(() => {
    if (!user.allowedMenus || user.allowedMenus.length === 0) return true;
    if (pathname === '/login') return true;
    return user.allowedMenus.some((menu) => {
      if (menu === '/') return pathname === '/';
      return pathname === menu || pathname.startsWith(`${menu}/`);
    });
  }, [user.allowedMenus, pathname]);

  return (
    <SWRConfig value={SWR_DEFAULTS}>
      <FirstRunGuideProvider setMenuOpen={setMenuOpen}>
        <LiveStreamProvider>
          <div className="min-h-dvh">
            <Sidebar user={user} open={menuOpen} onClose={() => setMenuOpen(false)} />
            <div className="flex min-h-dvh flex-col lg:pl-64">
              <Topbar user={user} onMenu={() => setMenuOpen(true)} />
              <main className="flex-1 px-2.5 py-4 sm:px-6 sm:py-6">
                <div className="mx-auto w-full max-w-[1850px] min-w-0">
                  {isAllowed ? (
                    children
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="mb-4 rounded-full bg-amber-500/10 p-4 text-amber-500">
                        <ShieldAlert className="h-10 w-10" />
                      </div>
                      <h2 className="text-lg font-semibold">Хандах эрх хязгаарлагдсан</h2>
                      <p className="mt-1 max-w-md text-sm text-[var(--color-fg-muted)]">
                        Таны хэрэглэгчийн эрхэд энэ цэс зөвшөөрөгдөөгүй байна. Системийн админд хандана уу.
                      </p>
                      {user.allowedMenus && user.allowedMenus.length > 0 && (
                        <div className="mt-6">
                          <Button
                            variant="primary"
                            onClick={() => router.push(user.allowedMenus![0])}
                          >
                            Зөвшөөрөгдсөн цэс рүү очих
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </main>
            </div>
          </div>
        </LiveStreamProvider>
      </FirstRunGuideProvider>
    </SWRConfig>
  );
}
