'use client';

import * as React from 'react';
import { SWRConfig } from 'swr';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { FirstRunGuideProvider } from './first-run-guide';
import { LiveStreamProvider } from './live-stream';
import type { SessionUser } from '@/lib/types';
import { SWR_DEFAULTS } from '@/lib/live-query';

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <SWRConfig value={SWR_DEFAULTS}>
      <FirstRunGuideProvider setMenuOpen={setMenuOpen}>
        <LiveStreamProvider>
          <div className="min-h-dvh">
            <Sidebar user={user} open={menuOpen} onClose={() => setMenuOpen(false)} />
            <div className="flex min-h-dvh flex-col lg:pl-64">
              <Topbar user={user} onMenu={() => setMenuOpen(true)} />
              <main className="flex-1 px-2.5 py-4 sm:px-6 sm:py-6">
                <div className="mx-auto w-full max-w-[1400px] min-w-0">{children}</div>
              </main>
            </div>
          </div>
        </LiveStreamProvider>
      </FirstRunGuideProvider>
    </SWRConfig>
  );
}
