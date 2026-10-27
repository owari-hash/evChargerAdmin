'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Building2, Menu, Pencil, Plus, Search, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { cn } from '@/lib/cn';
import { connectorLetter, formatNumber, formatRelative } from '@/lib/format';
import type { ChargePoint, Client, Paginated } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Select,
} from '@/components/ui/primitives';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { ConnectorStatusBadge, OnlineBadge, RegistrationBadge } from '@/components/ui/status';
import { FilterActions, FilterBar, Pagination } from '@/components/ui/pagination';
import { PageGuide } from '@/components/shell/page-guide';
import { ConfirmModal } from '@/components/ui/modal';
import { CreateChargePointModal } from './create-charge-point-modal';
import { EditChargePointModal } from './edit-charge-point-modal';

const CHARGE_POINTS_GUIDE_STEPS = [
  {
    title: 'Станц бүртгэх',
    body: '"Станц бүртгэх" товч дарж, станцын дугаар (WebSocket хаягтай таарах ёстой) болон байршлыг оруулна. Нэг удаагийн AuthorizationKey гарч ирэхийг хадгална уу.',
  },
  {
    title: 'Харилцагчид холбох',
    body: 'Станцыг эзэмшиж буй байгууллагыг "Харилцагч" талбараас сонгоно. Шаардлагатай бол бусад харилцагчид "мөн харагдах" эрхийг нэмж болно.',
  },
  {
    title: 'Тариф, хураамж',
    body: '1 кВт·ц тариф болон үйлчилгээний хураамжийг станц тус бүрт эсвэл харилцагчаар нь тохируулна. Хоосон орхивол сүлжээний үндсэн утга ашиглагдана.',
  },
];

export function ChargePointsView({
  canEdit,
  canAdmin,
}: {
  canEdit: boolean;
  canAdmin: boolean;
}) {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [online, setOnline] = React.useState('');
  const [clientId, setClientId] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<ChargePoint | null>(null);
  const [cleanConfirmOpen, setCleanConfirmOpen] = React.useState(false);
  const [cleaningSimulators, setCleaningSimulators] = React.useState(false);
  const [deletingStation, setDeletingStation] = React.useState<ChargePoint | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const { data: clientsData } = useSWR<Paginated<Client>>(
    apiUrl('clients', { limit: 100 }),
    fetcher,
    { refreshInterval: REFRESH.config },
  );
  const clients = clientsData?.data ?? [];

  async function handleCleanSimulators() {
    setCleaningSimulators(true);
    try {
      const res = await api.post<{
        deletedCount: number;
        deletedStations: Array<{ id: string; cpId: string; name?: string }>;
        preservedStations: Array<{ id: string; cpId: string; name?: string }>;
      }>('charge-points/cleanup-simulators');
      setCleanConfirmOpen(false);
      toast.success(
        `Нийт ${res.deletedCount} симулятор станцыг баазаас амжилттай цэвэрлэлээ. Үндсэн бодит станцууд хөндөгдөөгүй.`,
      );
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCleaningSimulators(false);
    }
  }

  async function handleDeleteStation() {
    if (!deletingStation) return;
    setIsDeleting(true);
    try {
      const targetId = deletingStation.id || deletingStation._id || deletingStation.cpId;
      await api.del(`charge-points/${encodeURIComponent(targetId)}`);
      toast.success(`«${deletingStation.name?.trim() || deletingStation.cpId}» станцыг устгалаа`);
      setDeletingStation(null);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  }

  // Debounce so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const key = apiUrl('charge-points', {
    search: debounced,
    online,
    clientId: clientId || undefined,
    page,
    limit,
  });
  const { data, error, isLoading, mutate } = useSWR<Paginated<ChargePoint>>(key, fetcher, {
    refreshInterval: REFRESH.live,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];
  const columns = 12;
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  /** «Kiosk-д харуулах»: off hides the station from the kiosk and app lists. */
  async function toggleKiosk(cp: ChargePoint, next: boolean) {
    setTogglingId(cp.id);
    try {
      await api.patch(`charge-points/${cp.id}`, { showOnKiosk: next });
      toast.success(next ? 'Kiosk-д харагдана' : 'Kiosk-оос нууглаа');
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <Card>
        <FilterBar>
          <div className="relative min-w-0 sm:min-w-[220px] w-full sm:w-auto flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
            <Input
              className="pl-8"
              placeholder="Дугаар, нэр, үйлдвэрлэгч, загвараар хайх…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            className="w-auto"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
            aria-label="Харилцагчийн шүүлтүүр"
          >
            <option value="">Бүх харилцагч</option>
            <option value="none">Харилцагчгүй</option>
            {clients.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </Select>
          <Select
            className="w-auto"
            value={online}
            onChange={(e) => {
              setOnline(e.target.value);
              setPage(1);
            }}
            aria-label="Холболтын шүүлтүүр"
          >
            <option value="">Бүх төлөв</option>
            <option value="true">Зөвхөн онлайн</option>
            <option value="false">Зөвхөн офлайн</option>
          </Select>
          <PageGuide topic="charge-points" title="Станц удирдах" steps={CHARGE_POINTS_GUIDE_STEPS} />
          {canEdit ? (
            <FilterActions>
              <Button variant="primary" size="md" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                Станц бүртгэх
              </Button>
            </FilterActions>
          ) : null}
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH className="w-12 text-center">№</TH>
                <TH>Цэнэглэх станц</TH>
                <TH>Дотоод нэршил</TH>
                <TH>Харилцагч</TH>
                <TH>Холболт</TH>
                <TH>Холбогч</TH>
                <TH>Үйлдвэрлэгч</TH>
                <TH>Программ</TH>
                <TH>Бүртгэл</TH>
                <TH>Сүүлд холбогдсон</TH>
                <TH title="Kiosk вэб болон аппын станцын жагсаалт, газрын зурагт харуулах эсэх">Төлөв</TH>
                <TH>Үйлдэл</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={columns} />
              ) : error ? (
                <TableEmpty colSpan={columns}>Станцын мэдээлэл ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={columns}>
                  {debounced || online || clientId ? 'Энэ шүүлтүүрт тохирох станц алга.' : 'Одоогоор станц бүртгэгдээгүй байна.'}
                </TableEmpty>
              ) : (
                rows.map((cp, idx) => {
                  const num = (page - 1) * limit + idx + 1;
                  return (
                  <TR key={cp.id}>
                    {/* № */}
                    <TD align="center" className="text-xs text-[var(--color-fg-muted)] font-mono">
                      {num}
                    </TD>
                    {/* Цэнэглэх станц */}
                    <TD align="left">
                      <Link
                        href={`/charge-points/${encodeURIComponent(cp.id)}`}
                        className="block truncate font-medium text-[var(--color-fg)] hover:text-[var(--color-brand)] hover:underline max-w-[190px]"
                        title={cp.name?.trim() || cp.cpId}
                      >
                        {cp.name?.trim() || cp.cpId}
                      </Link>
                    </TD>

                    {/* Дотоод нэршил */}
                    <TD align="center" className="font-mono text-xs">
                      <span className="font-mono text-[var(--color-fg-muted)]" title={cp.cpId}>
                        {cp.cpId}
                      </span>
                    </TD>

                    {/* Харилцагч */}
                    <TD align="left" className="text-xs">
                      {cp.client ? (
                        <Link
                          href={`/clients/${encodeURIComponent(cp.client.id)}`}
                          className="inline-flex max-w-[170px] items-center gap-1.5 font-medium text-[var(--color-brand)] hover:underline truncate"
                          title={cp.client.name}
                        >
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{cp.client.name}</span>
                        </Link>
                      ) : (
                        <span className="text-[var(--color-fg-subtle)]">—</span>
                      )}
                    </TD>

                    {/* Холболт */}
                    <TD align="center">
                      <OnlineBadge online={cp.isOnline} />
                    </TD>

                    {/* Холбогч */}
                    <TD align="center">
                      <div className="flex flex-wrap justify-center gap-1 whitespace-nowrap">
                        {(cp.connectors ?? [])
                          .filter((c) => c.connectorId > 0)
                          .map((c) => (
                            <span key={c.connectorId} title={`${connectorLetter(c.connectorId)} холбогч`}>
                              <ConnectorStatusBadge status={c.status} />
                            </span>
                          ))}
                        {!(cp.connectors ?? []).some((c) => c.connectorId > 0) ? (
                          <span className="text-xs text-[var(--color-fg-subtle)]">
                            Мэдээлээгүй
                          </span>
                        ) : null}
                      </div>
                    </TD>

                    {/* Үйлдвэрлэгч */}
                    <TD align="center" className="text-xs text-[var(--color-fg-muted)]">
                      {cp.chargePointVendor ? (
                        <div className="max-w-[120px] truncate" title={cp.chargePointVendor}>
                          {cp.chargePointVendor}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TD>

                    {/* Программ */}
                    <TD align="center" className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {cp.firmwareVersion ? (
                        <div className="max-w-[100px] truncate" title={cp.firmwareVersion}>
                          {cp.firmwareVersion}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TD>

                    {/* Бүртгэл */}
                    <TD align="center">
                      <RegistrationBadge status={cp.registrationStatus} />
                    </TD>

                    {/* Сүүлд холбогдсон */}
                    <TD align="center" className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                      {formatRelative(cp.lastSeenAt)}
                    </TD>

                    {/* Төлөв */}
                    <TD align="center">
                      <KioskToggle
                        on={cp.showOnKiosk !== false}
                        disabled={!canEdit || togglingId === cp.id}
                        onChange={(next) => void toggleKiosk(cp, next)}
                      />
                    </TD>

                    {/* Үйлдэл */}
                    <TD align="center" className="py-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setEditing(cp)}
                            title="Засах"
                            aria-label={`${cp.name?.trim() || cp.cpId} станцыг засах`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <Link
                          href={`/charge-points/${encodeURIComponent(cp.id)}`}
                          title="Дэлгэрэнгүй харах"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition"
                        >
                          <Menu className="h-3.5 w-3.5" />
                        </Link>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setDeletingStation(cp)}
                            title="Станц устгах"
                            aria-label={`${cp.name?.trim() || cp.cpId} станцыг устгах`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                );
              })
              )}
            </TBody>
          </Table>
        </TableWrap>

        {data && data.total > 0 ? (
          <Pagination
            page={page}
            limit={limit}
            total={data.total}
            onPageChange={setPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
            label="станц"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !debounced && !online && canEdit ? (
          <EmptyState
            icon={<Zap className="h-8 w-8" />}
            title="Одоогоор станц алга"
            description="Эндээс бүртгэх, эсвэл OCPP_ALLOW_ANONYMOUS идэвхтэй бол станц анх холбогдохдоо өөрөө бүртгэгдэнэ."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                Станц бүртгэх
              </Button>
            }
          />
        ) : null}
      </Card>

      {data ? (
        <p className="mt-3 text-xs text-[var(--color-fg-subtle)]">
          {formatNumber(data.total)} бүртгэлтэй · 15 секунд тутам шинэчилнэ
        </p>
      ) : null}

      <CreateChargePointModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => void mutate()}
      />

      {/* Mounted only while open, so each edit starts from fresh row data and a
          15-second background refresh cannot overwrite what is being typed. */}
      {editing ? (
        <EditChargePointModal
          chargePoint={editing}
          canRename={canAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void mutate();
          }}
        />
      ) : null}

      {/* Simulator cleanup confirmation modal */}
      <ConfirmModal
        open={cleanConfirmOpen}
        onClose={() => setCleanConfirmOpen(false)}
        onConfirm={() => void handleCleanSimulators()}
        title="Симулятор станцуудыг цэвэрлэх"
        confirmLabel="Бүх симулятор станцыг устгах"
        loading={cleaningSimulators}
        tone="danger"
        message={
          <div className="space-y-2 text-xs">
            <p>
              Та OCPP симулятороор үүсгэгдсэн бүх виртуал станцуудыг (FLEET-SIM-*, CP-SIM-*, Rey-* болон EPlug-Fleet загварууд) устгах гэж байна.
            </p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ Үндсэн бодит станцууд (Багануур ТӨХК гэх мэт) болон харилцагчийн бүртгэлүүд хөндөгдөхгүй, найдвартай хадгалагдана.
            </p>
          </div>
        }
      />

      {/* Individual station deletion modal */}
      <ConfirmModal
        open={Boolean(deletingStation)}
        onClose={() => setDeletingStation(null)}
        onConfirm={() => void handleDeleteStation()}
        title="Станц устгах"
        confirmLabel="Устгах"
        loading={isDeleting}
        tone="danger"
        message={
          <p className="text-xs">
            «<span className="font-semibold">{deletingStation?.name?.trim() || deletingStation?.cpId}</span>» станцыг баазаас бүрмөсөн устгах уу? Түүний бүх холбогч, тохиргоонууд хамт устах болно.
          </p>
        }
      />
    </>
  );
}

/** A small on/off switch for the «Kiosk-д» column. */
function KioskToggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Kiosk-д харагдаж байна' : 'Kiosk-д харагдахгүй'}
      title={on ? 'Kiosk-д харагдаж байна' : 'Kiosk-д харагдахгүй'}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50',
        on ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-border)]',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
