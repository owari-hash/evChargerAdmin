'use client';

import * as React from 'react';
import useSWR from 'swr';
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatJson } from '@/lib/format';
import type { OcppMessageLog, Paginated } from '@/lib/types';
import { Badge, Button, Card, CardHeader, CodeBlock, Input, Select } from '@/components/ui/primitives';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

/** OCPP message type ids from the OCPP-J framing spec. */
const MESSAGE_TYPES: Record<number, string> = { 2: 'CALL', 3: 'RESULT', 4: 'ERROR' };

export function MessagesTab({ chargePointId }: { chargePointId: string }) {
  const [direction, setDirection] = React.useState('');
  const [action, setAction] = React.useState('');
  const [debouncedAction, setDebouncedAction] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedAction(action);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [action]);

  const key = apiUrl(`charge-points/${encodeURIComponent(chargePointId)}/messages`, {
    direction,
    action: debouncedAction,
    page,
    limit,
  });
  const { data, error, isLoading, mutate } = useSWR<Paginated<OcppMessageLog>>(key, fetcher, {
    refreshInterval: autoRefresh ? 5_000 : 0,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  return (
    <Card>
      <CardHeader
        title="OCPP message log"
        description="Every frame exchanged with this charge point, newest first."
        actions={
          <>
            <Button
              variant={autoRefresh ? 'subtle' : 'ghost'}
              size="sm"
              onClick={() => setAutoRefresh((v) => !v)}
            >
              {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void mutate()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      <FilterBar>
        <Input
          className="min-w-[200px] flex-1"
          placeholder="Filter by action, e.g. StatusNotification"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <Select
          className="w-auto"
          value={direction}
          onChange={(e) => {
            setDirection(e.target.value);
            setPage(1);
          }}
          aria-label="Direction"
        >
          <option value="">Both directions</option>
          <option value="IN">Inbound (from charge point)</option>
          <option value="OUT">Outbound (from CSMS)</option>
        </Select>
      </FilterBar>

      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH>Time</TH>
              <TH>Dir</TH>
              <TH>Type</TH>
              <TH>Action</TH>
              <TH>Message id</TH>
              <TH align="right" />
            </tr>
          </THead>
          <TBody>
            {isLoading && !data ? (
              <TableLoading colSpan={6} />
            ) : error ? (
              <TableEmpty colSpan={6}>Could not load messages.</TableEmpty>
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={6}>
                No messages logged. Set OCPP_LOG_MESSAGES=true on the backend to record frames.
              </TableEmpty>
            ) : (
              rows.map((msg) => {
                const isOpen = expanded === msg._id;
                return (
                  <React.Fragment key={msg._id}>
                    <TR
                      interactive
                      onClick={() => setExpanded(isOpen ? null : msg._id)}
                    >
                      <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                        {formatDateTime(msg.timestamp)}
                      </TD>
                      <TD>
                        {msg.direction === 'IN' ? (
                          <Badge tone="info">
                            <ArrowDownLeft className="h-3 w-3" />
                            IN
                          </Badge>
                        ) : (
                          <Badge tone="brand">
                            <ArrowUpRight className="h-3 w-3" />
                            OUT
                          </Badge>
                        )}
                      </TD>
                      <TD className="text-xs">
                        {msg.errorCode ? (
                          <Badge tone="danger">{msg.errorCode}</Badge>
                        ) : (
                          <span className="font-mono text-[var(--color-fg-muted)]">
                            {MESSAGE_TYPES[msg.messageType] ?? msg.messageType}
                          </span>
                        )}
                      </TD>
                      <TD className="text-xs font-medium">{msg.action ?? '—'}</TD>
                      <TD className="max-w-[180px] truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">
                        {msg.messageId}
                      </TD>
                      <TD align="right" className="text-xs text-[var(--color-brand)]">
                        {isOpen ? 'Hide' : 'Payload'}
                      </TD>
                    </TR>
                    {isOpen ? (
                      <tr>
                        <td colSpan={6} className="bg-[var(--color-surface-2)]/50 px-4 py-3">
                          <CodeBlock>{formatJson(msg.payload) || '(empty payload)'}</CodeBlock>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
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
          label="messages"
        />
      ) : null}
    </Card>
  );
}
