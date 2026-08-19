'use client';

import * as React from 'react';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime, formatJson } from '@/lib/format';
import type { CommandLog, Paginated } from '@/lib/types';
import { Button, Card, CardHeader, CodeBlock } from '@/components/ui/primitives';
import { CommandStatusBadge } from '@/components/ui/status';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

/** Audit trail of commands the CSMS sent to this charge point, and what came back. */
export function CommandLogTab({ chargePointId }: { chargePointId: string }) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const key = apiUrl(`charge-points/${encodeURIComponent(chargePointId)}/commands`, { page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<CommandLog>>(key, fetcher, {
    refreshInterval: 10_000,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  return (
    <Card>
      <CardHeader
        title="Command log"
        description="Commands issued to this charge point, with the response and who sent it."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void mutate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH>Time</TH>
              <TH>Action</TH>
              <TH>Status</TH>
              <TH>Issued by</TH>
              <TH>Error</TH>
              <TH align="right" />
            </tr>
          </THead>
          <TBody>
            {isLoading && !data ? (
              <TableLoading colSpan={6} />
            ) : error ? (
              <TableEmpty colSpan={6}>Could not load the command log.</TableEmpty>
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={6}>No commands have been sent to this charge point.</TableEmpty>
            ) : (
              rows.map((cmd) => {
                const isOpen = expanded === cmd._id;
                return (
                  <React.Fragment key={cmd._id}>
                    <TR interactive onClick={() => setExpanded(isOpen ? null : cmd._id)}>
                      <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                        {formatDateTime(cmd.createdAt)}
                      </TD>
                      <TD className="text-xs font-medium">{cmd.action}</TD>
                      <TD>
                        <CommandStatusBadge status={cmd.status} />
                      </TD>
                      <TD className="text-xs text-[var(--color-fg-muted)]">{cmd.issuedBy ?? '—'}</TD>
                      <TD className="max-w-[240px] truncate text-xs text-[var(--color-danger)]">
                        {cmd.error ?? ''}
                      </TD>
                      <TD align="right" className="text-xs text-[var(--color-brand)]">
                        {isOpen ? 'Hide' : 'Details'}
                      </TD>
                    </TR>
                    {isOpen ? (
                      <tr>
                        <td colSpan={6} className="bg-[var(--color-surface-2)]/50 px-4 py-3">
                          <div className="grid gap-2 lg:grid-cols-2">
                            <div>
                              <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                                Request
                              </p>
                              <CodeBlock>{formatJson(cmd.payload) || '(none)'}</CodeBlock>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                                Response
                              </p>
                              <CodeBlock>{formatJson(cmd.response) || '(none)'}</CodeBlock>
                            </div>
                          </div>
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
          label="commands"
        />
      ) : null}
    </Card>
  );
}
