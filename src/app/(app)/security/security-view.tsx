'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import useSWR from 'swr';
import { apiUrl, fetcher } from '@/lib/client';
import { formatNumber } from '@/lib/format';
import type { Paginated, SecurityEvent } from '@/lib/types';
import { Button, Card, PageHeader } from '@/components/ui/primitives';
import { Tabs, TabCount } from '@/components/ui/tabs';
import { SecurityEventsTab } from './events-tab';
import { CertificatesTab } from './certificates-tab';
import { CsrsTab } from './csrs-tab';
import { CaTab } from './ca-tab';

type TabKey = 'events' | 'csrs' | 'certificates' | 'ca';

export function SecurityView({
  canOperate,
  canAdmin,
}: {
  canOperate: boolean;
  canAdmin: boolean;
}) {
  const [tab, setTab] = React.useState<TabKey>('events');

  // Badge counts: the things an operator needs to act on.
  const { data: critical } = useSWR<Paginated<SecurityEvent>>(
    apiUrl('security/events', { critical: 'true', acknowledged: 'false', limit: 1 }),
    fetcher,
    { refreshInterval: 30_000 },
  );
  const { data: pendingCsrs } = useSWR<Paginated<unknown>>(
    apiUrl('security/csrs', { status: 'Pending', limit: 1 }),
    fetcher,
    { refreshInterval: 30_000 },
  );

  return (
    <>
      <PageHeader
        title="Аюулгүй байдал"
        description="OCPP 1.6-J аюулгүй байдлын стандартын дагуух үйл явдал, гэрчилгээний хүсэлт, дотоод CA."
        actions={
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Шинэчлэх
          </Button>
        }
      />

      <Card className="mb-4 overflow-hidden">
        <Tabs
          items={[
            {
              key: 'events',
              label: 'Үйл явдал',
              badge: critical?.total ? (
                <TabCount>{formatNumber(critical.total)} critical</TabCount>
              ) : undefined,
            },
            {
              key: 'csrs',
              label: 'Гэрчилгээний хүсэлт',
              badge: pendingCsrs?.total ? (
                <TabCount>{formatNumber(pendingCsrs.total)} pending</TabCount>
              ) : undefined,
            },
            { key: 'certificates', label: 'Гэрчилгээ' },
            { key: 'ca', label: 'Дотоод CA' },
          ]}
          value={tab}
          onChange={(k) => setTab(k as TabKey)}
        />
      </Card>

      {tab === 'events' ? <SecurityEventsTab canOperate={canOperate} /> : null}
      {tab === 'csrs' ? <CsrsTab canOperate={canOperate} /> : null}
      {tab === 'certificates' ? <CertificatesTab /> : null}
      {tab === 'ca' ? <CaTab canAdmin={canAdmin} /> : null}
    </>
  );
}
