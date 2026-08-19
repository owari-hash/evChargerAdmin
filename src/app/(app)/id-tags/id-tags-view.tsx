'use client';

import * as React from 'react';
import useSWR from 'swr';
import { CreditCard, Pencil, Plus, RefreshCw, Search, ShieldQuestion, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { AUTHORIZATION_STATUSES, type IdTag, type Paginated } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '@/components/ui/primitives';
import { AuthStatusBadge } from '@/components/ui/status';
import { ConfirmModal } from '@/components/ui/modal';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { IdTagModal } from './id-tag-modal';
import { BulkImportModal } from './bulk-import-modal';
import { AuthorizeCheckModal } from './authorize-check-modal';

export function IdTagsView({
  canEdit,
  initialSearch,
}: {
  canEdit: boolean;
  initialSearch: string;
}) {
  const now = useNow();
  const [search, setSearch] = React.useState(initialSearch);
  const [debounced, setDebounced] = React.useState(initialSearch);
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);

  const [editing, setEditing] = React.useState<IdTag | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [checking, setChecking] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<IdTag | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const key = apiUrl('id-tags', { search: debounced, status, page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<IdTag>>(key, fetcher, {
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`id-tags/${encodeURIComponent(deleting.idTag)}`);
      toast.success(`${deleting.idTag} deleted`);
      setDeleting(null);
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
        title="RFID tags"
        description="Authorisation tokens drivers present at the charge point."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void mutate()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            {canEdit ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
                  <Upload className="h-3.5 w-3.5" />
                  Bulk import
                </Button>
                <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New tag
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <Card>
        <FilterBar>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
            <Input
              className="pl-8"
              placeholder="Search by tag, label, owner name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            className="w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {AUTHORIZATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Tag</TH>
                <TH>Status</TH>
                <TH>Label / owner</TH>
                <TH>Parent</TH>
                <TH>Expires</TH>
                <TH align="right">Max sessions</TH>
                <TH>Restricted to</TH>
                <TH align="right">Updated</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={9} />
              ) : error ? (
                <TableEmpty colSpan={9}>Could not load tags.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={9}>
                  {debounced || status ? 'No tags match these filters.' : 'No tags yet.'}
                </TableEmpty>
              ) : (
                rows.map((tag) => {
                  const expired =
                    tag.expiryDate != null && new Date(tag.expiryDate).getTime() < now;
                  return (
                    <TR key={tag.idTag}>
                      <TD className="font-mono text-xs font-medium">{tag.idTag}</TD>
                      <TD>
                        <AuthStatusBadge status={tag.status} />
                      </TD>
                      <TD className="text-xs">
                        {tag.label || tag.ownerName || '—'}
                        {tag.ownerEmail ? (
                          <p className="text-[var(--color-fg-subtle)]">{tag.ownerEmail}</p>
                        ) : null}
                      </TD>
                      <TD className="font-mono text-xs text-[var(--color-fg-muted)]">
                        {tag.parentIdTag ?? '—'}
                      </TD>
                      <TD className="text-xs">
                        {tag.expiryDate ? (
                          <span className={expired ? 'text-[var(--color-danger)]' : undefined}>
                            {formatDate(tag.expiryDate)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-fg-subtle)]">Never</span>
                        )}
                      </TD>
                      <TD align="right" className="text-xs">
                        {tag.maxActiveTransactions === 0 ? '∞' : tag.maxActiveTransactions}
                      </TD>
                      <TD className="text-xs">
                        {tag.allowedChargePointIds?.length ? (
                          <Badge tone="info">
                            {formatNumber(tag.allowedChargePointIds.length)} charge points
                          </Badge>
                        ) : (
                          <span className="text-[var(--color-fg-subtle)]">Any</span>
                        )}
                      </TD>
                      <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                        {formatRelative(tag.updatedAt)}
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setChecking(tag.idTag)}
                            title="Dry-run authorization"
                          >
                            <ShieldQuestion className="h-3.5 w-3.5" />
                          </Button>
                          {canEdit ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditing(tag)}
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleting(tag)}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
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
            label="tags"
          />
        ) : null}

        {!isLoading && !error && rows.length === 0 && !debounced && !status && canEdit ? (
          <EmptyState
            icon={<CreditCard className="h-8 w-8" />}
            title="No RFID tags yet"
            description="Create tags here or import an existing database in bulk."
            action={
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New tag
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
                  <Upload className="h-3.5 w-3.5" />
                  Bulk import
                </Button>
              </div>
            }
          />
        ) : null}
      </Card>

      <IdTagModal
        key={creating ? 'create' : (editing?.idTag ?? 'none')}
        open={creating || editing !== null}
        tag={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => void mutate()}
      />

      <BulkImportModal
        open={importing}
        onClose={() => setImporting(false)}
        onImported={() => void mutate()}
      />

      <AuthorizeCheckModal
        key={checking ?? 'none'}
        idTag={checking}
        onClose={() => setChecking(null)}
      />

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        loading={busy}
        title="Delete this tag?"
        confirmLabel="Delete"
        message={
          <>
            <span className="block">
              <span className="font-mono font-medium">{deleting?.idTag}</span> will no longer
              authorise charging, and it is removed from local authorisation lists.
            </span>
            <span className="mt-2 block">Past sessions are kept.</span>
          </>
        }
      />
    </>
  );
}
