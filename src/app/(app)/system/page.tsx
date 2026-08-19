import type { Metadata } from 'next';
import { Activity, Database, Globe, Radio, ShieldCheck, Zap } from 'lucide-react';
import { csmsSafe } from '@/lib/server-api';
import { serverConfig, brand } from '@/lib/config';
import { getSessionUser } from '@/lib/session';
import { formatDateTime, formatNumber, formatUptime } from '@/lib/format';
import type { ApiDiscovery, HealthResponse } from '@/lib/types';
import { Badge, Card, CardHeader, DataRow, PageHeader } from '@/components/ui/primitives';
import { RoleBadge } from '@/components/ui/status';
import { StatCard } from '@/components/stat-card';
import { BackendDown } from '@/components/backend-down';

export const metadata: Metadata = { title: 'System' };
export const dynamic = 'force-dynamic';

/** Security profile 1 over plain ws is fine for commissioning, not for production. */
const PROFILE_NOTES: Record<number, { text: string; tone: 'ok' | 'warn' | 'info' }> = {
  1: { text: 'HTTP Basic over plain ws — use only behind TLS termination', tone: 'warn' },
  2: { text: 'HTTP Basic over wss', tone: 'ok' },
  3: { text: 'Mutual TLS with client certificates', tone: 'ok' },
};

export default async function SystemPage() {
  const [health, discovery, user] = await Promise.all([
    csmsSafe<HealthResponse>('/health'),
    csmsSafe<ApiDiscovery>('/'),
    getSessionUser(),
  ]);

  if (!health && !discovery) return <BackendDown />;

  const profile = discovery?.securityProfile ?? 0;
  const note = PROFILE_NOTES[profile];
  const healthy = health?.status === 'ok';

  return (
    <>
      <PageHeader
        title="System"
        description="Health of the CSMS backend and how this console is wired to it."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Backend"
          value={healthy ? 'Healthy' : (health?.status ?? 'Unreachable')}
          sub={health ? `Up ${formatUptime(health.uptimeSeconds)}` : 'No response'}
          icon={Activity}
          tone={healthy ? 'ok' : 'danger'}
        />
        <StatCard
          label="Database"
          value={health?.database ?? '—'}
          sub="MongoDB connection"
          icon={Database}
          tone={health?.database === 'connected' ? 'ok' : 'danger'}
        />
        <StatCard
          label="Live connections"
          value={formatNumber(health?.chargePointsOnline ?? 0)}
          sub="Charge points on this instance"
          icon={Radio}
          tone={(health?.chargePointsOnline ?? 0) > 0 ? 'brand' : 'idle'}
        />
        <StatCard
          label="Security profile"
          value={profile || '—'}
          sub={note?.text ?? 'Unknown'}
          icon={ShieldCheck}
          tone={note?.tone ?? 'idle'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Central System" description="Reported by the backend" />
          <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
            <DataRow label="Name">{discovery?.name ?? '—'}</DataRow>
            <DataRow label="OCPP version">{discovery?.ocppVersion ?? '—'}</DataRow>
            <DataRow label="Transport">{discovery?.transport ?? '—'}</DataRow>
            <DataRow label="Security profile">
              {profile ? (
                <Badge tone={note?.tone ?? 'idle'}>Profile {profile}</Badge>
              ) : (
                '—'
              )}
            </DataRow>
            <DataRow label="WebSocket path" mono>
              {discovery?.websocketPath ?? '—'}
            </DataRow>
            <DataRow label="Supported actions">
              {formatNumber(discovery?.supportedActions?.length ?? 0)}
            </DataRow>
            <DataRow label="Health checked">{formatDateTime(health?.timestamp)}</DataRow>
          </dl>
        </Card>

        <Card>
          <CardHeader title="This console" description="How the admin app is configured" />
          <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
            <DataRow label="Brand">{brand.name}</DataRow>
            <DataRow label="Domain" mono>
              {brand.domain}
            </DataRow>
            <DataRow label="Backend URL" mono>
              {serverConfig.apiUrl}
            </DataRow>
            <DataRow label="Signed in as">{user?.email ?? '—'}</DataRow>
            <DataRow label="Your role">{user ? <RoleBadge role={user.role} /> : '—'}</DataRow>
            <DataRow label="Session storage">httpOnly cookie</DataRow>
            <DataRow label="API access">Proxied server-side</DataRow>
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Connecting a charge point"
          description="What to configure on the hardware"
        />
        <div className="space-y-4 p-5 text-sm">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-fg-muted)]">
              <Globe className="h-3.5 w-3.5" />
              Central System URL
            </p>
            <code className="block overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-xs">
              {profile === 1 ? 'ws' : 'wss'}://{brand.domain}
              {discovery?.websocketPath ?? '/ocpp/{chargePointId}'}
            </code>
            <p className="mt-1.5 text-xs text-[var(--color-fg-subtle)]">
              The charge point identity in the URL must match its username in HTTP Basic auth.
            </p>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-fg-muted)]">
              <Zap className="h-3.5 w-3.5" />
              Credentials
            </p>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Username is the charge point id; password is the AuthorizationKey shown once when you
              register it. Lost keys can be rotated from the charge point page.
            </p>
          </div>
        </div>
      </Card>

      {discovery?.supportedActions?.length ? (
        <Card className="mt-4">
          <CardHeader
            title="Supported OCPP actions"
            description={`${formatNumber(discovery.supportedActions.length)} messages validated by the backend`}
          />
          <div className="flex flex-wrap gap-1.5 p-5">
            {discovery.supportedActions.map((action) => (
              <Badge key={action} tone="idle" className="font-mono">
                {action}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
