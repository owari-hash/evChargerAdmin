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

export const metadata: Metadata = { title: 'Систем' };
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
        title="Систем"
        description="CSMS серверийн эрүүл мэнд, энэ самбар түүнтэй хэрхэн холбогдсон тухай."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Сервер"
          value={healthy ? 'Хэвийн' : (health?.status ?? 'Холбогдохгүй байна')}
          sub={health ? `${formatUptime(health.uptimeSeconds)} ажиллаж байна` : 'Хариу алга'}
          icon={Activity}
          tone={healthy ? 'ok' : 'danger'}
        />
        <StatCard
          label="Өгөгдлийн сан"
          value={health?.database ?? '—'}
          sub="MongoDB connection"
          icon={Database}
          tone={health?.database === 'connected' ? 'ok' : 'danger'}
        />
        <StatCard
          label="Идэвхтэй холболт"
          value={formatNumber(health?.chargePointsOnline ?? 0)}
          sub="Charge points on this instance"
          icon={Radio}
          tone={(health?.chargePointsOnline ?? 0) > 0 ? 'brand' : 'idle'}
        />
        <StatCard
          label="Аюулгүй байдлын профайл"
          value={profile || '—'}
          sub={note?.text ?? 'Тодорхойгүй'}
          icon={ShieldCheck}
          tone={note?.tone ?? 'idle'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Төв систем" description="Серверээс ирсэн мэдээлэл" />
          <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
            <DataRow label="Нэр">{discovery?.name ?? '—'}</DataRow>
            <DataRow label="OCPP хувилбар">{discovery?.ocppVersion ?? '—'}</DataRow>
            <DataRow label="Дамжуулалт">{discovery?.transport ?? '—'}</DataRow>
            <DataRow label="Аюулгүй байдлын профайл">
              {profile ? (
                <Badge tone={note?.tone ?? 'idle'}>Profile {profile}</Badge>
              ) : (
                '—'
              )}
            </DataRow>
            <DataRow label="WebSocket зам" mono>
              {discovery?.websocketPath ?? '—'}
            </DataRow>
            <DataRow label="Дэмжигдэх үйлдэл">
              {formatNumber(discovery?.supportedActions?.length ?? 0)}
            </DataRow>
            <DataRow label="Шалгасан хугацаа">{formatDateTime(health?.timestamp)}</DataRow>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Энэ самбар" description="Удирдлагын аппын тохиргоо" />
          <dl className="divide-y divide-[var(--color-border)] px-5 py-2">
            <DataRow label="Брэнд">{brand.name}</DataRow>
            <DataRow label="Домэйн" mono>
              {brand.domain}
            </DataRow>
            <DataRow label="Серверийн хаяг" mono>
              {serverConfig.apiUrl}
            </DataRow>
            <DataRow label="Нэвтэрсэн">{user?.email ?? '—'}</DataRow>
            <DataRow label="Таны эрх">{user ? <RoleBadge role={user.role} /> : '—'}</DataRow>
            <DataRow label="Сешн хадгалалт">httpOnly cookie</DataRow>
            <DataRow label="API хандалт">Сервер талаас дамжуулна</DataRow>
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Станц холбох"
          description="Тоног төхөөрөмж дээр юу тохируулах вэ"
        />
        <div className="space-y-4 p-5 text-sm">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-fg-muted)]">
              <Globe className="h-3.5 w-3.5" />
              Төв системийн хаяг
            </p>
            <code className="block overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-xs">
              {profile === 1 ? 'ws' : 'wss'}://{brand.domain}
              {discovery?.websocketPath ?? '/ocpp/{chargePointId}'}
            </code>
            <p className="mt-1.5 text-xs text-[var(--color-fg-subtle)]">
              Хаяг дахь станцын нэр нь HTTP Basic нэвтрэлтийн хэрэглэгчийн нэртэй таарах ёстой.
            </p>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-fg-muted)]">
              <Zap className="h-3.5 w-3.5" />
              Нэвтрэх мэдээлэл
            </p>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Хэрэглэгчийн нэр нь станцын дугаар; нууц үг нь бүртгэх үед ганц удаа харагдах
              AuthorizationKey. Түлхүүрээ алдвал станцын хуудаснаас шинэчилж болно.
            </p>
          </div>
        </div>
      </Card>

      {discovery?.supportedActions?.length ? (
        <Card className="mt-4">
          <CardHeader
            title="Дэмжигдэх OCPP үйлдлүүд"
            description={`Сервер ${formatNumber(discovery.supportedActions.length)} мессежийг шалгадаг`}
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
