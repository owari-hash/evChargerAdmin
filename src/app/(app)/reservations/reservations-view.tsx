'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { CalendarClock, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { RESERVATION_STATES, type Paginated, type Reservation } from '@/lib/types';
import { Button, Card, EmptyState, Input, PageHeader, Select } from '@/components/ui/primitives';
import { ReservationBadge } from '@/components/ui/status';
import { ConfirmModal } from '@/components/ui/modal';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

export function ReservationsView({ canOperate }: { canOperate: boolean }) {
  const now = useNow();
  const [state, setState] = React.useState('');
  const [chargePointId, setChargePointId] = React.useState('');
  const [debouncedCp, setDebouncedCp] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [cancelling, setCancelling] = React.useState<Reservation | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCp(chargePointId);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [chargePointId]);

  const key = apiUrl('reservations', { state, chargePointId: debouncedCp, page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<Reservation>>(key, fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  async function cancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      const res = await api.post<{ status?: string }>(
        `charge-points/${encodeURIComponent(cancelling.chargePointId)}/cancel-reservation`,
        { reservationId: cancelling.reservationId ?? cancelling.id },
      );
      if (res.status === 'Accepted') {
        toast.success('Reservation cancelled');
      } else {
        toast.warning(`The charge point answered ${res.status ?? 'unknown'}.`);
      }
      setCancelling(null);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Connector holds created with ReserveNow."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void mutate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <Card>
        <FilterBar>
          <Select
            className="w-auto"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
            aria-label="State"
          >
            <option value="">All states</option>
            {RESERVATION_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Input
            className="w-auto min-w-[180px]"
            placeholder="Charge point id"
            value={chargePointId}
            onChange={(e) => setChargePointId(e.target.value)}
          />
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Reservation</TH>
                <TH>State</TH>
                <TH>Charge point</TH>
                <TH>Connector</TH>
                <TH>Tag</TH>
                <TH>Expires</TH>
                <TH>Session</TH>
                <TH align="right">Created</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={9} />
              ) : error ? (
                <TableEmpty colSpan={9}>Could not load reservations.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={9}>No reservations match these filters.</TableEmpty>
              ) : (
                rows.map((r) => {
                  const id = r.reservationId ?? r.id;
                  const expired = new Date(r.expiryDate).getTime() < now;
                  return (
                    <TR key={id}>
                      <TD className="font-mono text-xs font-medium">#{id}</TD>
                      <TD>
                        <ReservationBadge state={r.state} />
                      </TD>
                      <TD>
                        <Link
                          href={`/charge-points/${encodeURIComponent(r.chargePointId)}`}
                          className="text-xs hover:text-[var(--color-brand)] hover:underline"
                        >
                          {r.chargePointId}
                        </Link>
                      </TD>
                      <TD className="font-mono text-xs">{r.connectorId}</TD>
                      <TD className="font-mono text-xs">{r.idTag}</TD>
                      <TD className="whitespace-nowrap text-xs">
                        <span
                          className={
                            expired && r.state === 'Active'
                              ? 'text-[var(--color-warn)]'
                              : 'text-[var(--color-fg-muted)]'
                          }
                        >
                          {formatDateTime(r.expiryDate)}
                        </span>
                      </TD>
                      <TD className="text-xs">
                        {r.transactionId ? (
                          <Link
                            href={`/transactions/${r.transactionId}`}
                            className="font-mono text-[var(--color-brand)] hover:underline"
                          >
                            #{r.transactionId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                        {formatRelative(r.createdAt)}
                      </TD>
                      <TD align="right">
                        {canOperate && r.state === 'Active' ? (
                          <Button variant="ghost" size="sm" onClick={() => setCancelling(r)}>
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        ) : null}
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
            label="reservations"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !state && !debouncedCp ? (
          <EmptyState
            icon={<CalendarClock className="h-8 w-8" />}
            title="No reservations"
            description="Create one from a charge point's command console with Reserve now."
          />
        ) : null}
      </Card>

      <ConfirmModal
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        onConfirm={() => void cancel()}
        loading={busy}
        title="Cancel reservation?"
        confirmLabel="Send CancelReservation"
        message={
          <>
            Releases the hold on connector {cancelling?.connectorId} of{' '}
            <span className="font-mono font-medium">{cancelling?.chargePointId}</span>. The connector
            becomes available to any driver.
          </>
        }
      />
    </>
  );
}
