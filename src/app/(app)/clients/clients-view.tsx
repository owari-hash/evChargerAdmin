'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Building2,
  Edit2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatNumber, formatRelative } from '@/lib/format';
import type { Client, Paginated } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from '@/components/ui/primitives';
import {
  Table,
  TableEmpty,
  TableLoading,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/table';
import { ConfirmModal } from '@/components/ui/modal';
import { FilterBar, Pagination } from '@/components/ui/pagination';
import { ClientModal } from './client-modal';

export function ClientsView({
  canEdit,
  canDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = React.useState<Client | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const key = apiUrl('clients', {
    search: debounced,
    status: status === 'all' ? undefined : status,
    page,
    limit,
  });

  const { data, error, isLoading, mutate } = useSWR<Paginated<Client>>(key, fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const columns = canEdit || canDelete ? 7 : 6;

  async function handleDelete() {
    if (!deletingClient) return;
    setDeleting(true);
    try {
      const id = deletingClient.id || deletingClient._id;
      await api.del(`clients/${encodeURIComponent(id!)}`);
      toast.success(`"${deletingClient.name}" харилцагч устгагдлаа`);
      setDeletingClient(null);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Харилцагч"
        description="Цэнэглэх станцуудыг эзэмшигч харилцагч, байгууллагуудын удирдлага."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void mutate()} aria-label="Шинэчлэх">
              <RefreshCw className="h-3.5 w-3.5" />
              Шинэчлэх
            </Button>
            {canEdit ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingClient(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Харилцагч бүртгэх
              </Button>
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
              placeholder="Нэр, регистр, утас, холбоо барих хүнээр хайх…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            className="w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as 'all' | 'active' | 'inactive');
              setPage(1);
            }}
            aria-label="Төлөвийн шүүлтүүр"
          >
            <option value="all">Бүх төлөв</option>
            <option value="active">Зөвхөн идэвхтэй</option>
            <option value="inactive">Зөвхөн идэвхгүй</option>
          </Select>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Харилцагчийн нэр</TH>
                <TH>Регистр</TH>
                <TH>Станцууд</TH>
                <TH>Холбоо барих</TH>
                <TH>Хаяг</TH>
                <TH>Төлөв</TH>
                {canEdit || canDelete ? (
                  <TH align="right">
                    <span className="sr-only">Үйлдэл</span>
                  </TH>
                ) : null}
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={columns} />
              ) : error ? (
                <TableEmpty colSpan={columns}>Харилцагчийн мэдээлэл ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={columns}>
                  {debounced || status !== 'all'
                    ? 'Энэ шүүлтүүрт тохирох харилцагч олдсонгүй.'
                    : 'Одоогоор бүртгэлтэй харилцагч алга байна.'}
                </TableEmpty>
              ) : (
                rows.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link
                        href={`/clients/${encodeURIComponent(c.id)}`}
                        className="font-medium hover:text-[var(--color-brand)] hover:underline flex items-center gap-2"
                      >
                        <Building2 className="h-4 w-4 text-[var(--color-fg-muted)] shrink-0" />
                        <span>{c.name}</span>
                      </Link>
                      {c.contactPerson ? (
                        <p className="text-xs text-[var(--color-fg-muted)] pl-6">
                          Холбоо барих: {c.contactPerson}
                        </p>
                      ) : null}
                    </TD>
                    <TD className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {c.businessRegister ?? '—'}
                    </TD>
                    <TD>
                      <Link
                        href={`/clients/${encodeURIComponent(c.id)}`}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors"
                      >
                        <Zap className="h-3 w-3 text-[var(--color-brand)]" />
                        <span>{c.stationCount ?? 0} станц</span>
                      </Link>
                    </TD>
                    <TD className="text-xs">
                      <div className="space-y-0.5">
                        {c.phone ? (
                          <div className="flex items-center gap-1 text-[var(--color-fg-muted)]">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{c.phone}</span>
                          </div>
                        ) : null}
                        {c.email ? (
                          <div className="flex items-center gap-1 text-[var(--color-fg-muted)]">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span>{c.email}</span>
                          </div>
                        ) : null}
                        {!c.phone && !c.email ? '—' : null}
                      </div>
                    </TD>
                    <TD className="text-xs text-[var(--color-fg-muted)] max-w-[200px] truncate">
                      {c.address ?? '—'}
                    </TD>
                    <TD>
                      {c.isActive ? (
                        <Badge tone="ok">Идэвхтэй</Badge>
                      ) : (
                        <Badge tone="idle">Идэвхгүй</Badge>
                      )}
                    </TD>
                    {canEdit || canDelete ? (
                      <TD align="right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingClient(c);
                                setModalOpen(true);
                              }}
                              aria-label={`${c.name} засах`}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingClient(c)}
                              aria-label={`${c.name} устгах`}
                              className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>

        <Pagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      </Card>

      {modalOpen ? (
        <ClientModal
          client={editingClient}
          onClose={() => {
            setModalOpen(false);
            setEditingClient(null);
          }}
          onSaved={() => void mutate()}
        />
      ) : null}

      <ConfirmModal
        open={deletingClient !== null}
        onClose={() => setDeletingClient(null)}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        tone="danger"
        title="Харилцагч устгах уу?"
        confirmLabel="Устгах"
        message={
          deletingClient ? (
            <>
              <span className="block">
                Та <span className="font-semibold">{deletingClient.name}</span> харилцагчийг
                устгахдаа итгэлтэй байна уу?
              </span>
              {(deletingClient.stationCount ?? 0) > 0 ? (
                <span className="mt-2 block text-xs text-[var(--color-warn)]">
                  Анхаар: Энэ харилцагчид харьяалагдах {deletingClient.stationCount} станцын
                  харилцагчийн холбоос чөлөөлөгдөнө.
                </span>
              ) : null}
            </>
          ) : null
        }
      />
    </>
  );
}
