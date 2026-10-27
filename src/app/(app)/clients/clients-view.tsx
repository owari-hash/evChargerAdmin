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
  Search,
  Shield,
  Trash2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatNumber, formatPhone, formatRelative } from '@/lib/format';
import type { Client, Paginated } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
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
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { MANAGEABLE_MENUS } from '@/components/shell/nav-items';
import { FilterActions, FilterBar, Pagination } from '@/components/ui/pagination';
import { PageGuide } from '@/components/shell/page-guide';
import { ClientModal } from './client-modal';

const CLIENTS_GUIDE_STEPS = [
  {
    title: 'Харилцагч бүртгэх',
    body: '"Харилцагч бүртгэх" товч дарж байгууллагын нэр, регистр, холбоо барих мэдээллийг оруулна.',
  },
  {
    title: 'Станц холбох',
    body: 'Цэнэглэх станцууд цэснээс станцаа засаж, "Харилцагч" талбарт энэ байгууллагыг сонгоно. Нэг станцыг олон харилцагчид "мөн харагдах" байдлаар нэмж болно.',
  },
  {
    title: 'Дотоод гишүүний карт',
    body: 'Харилцагчийн дэлгэрэнгүй хуудаснаас "Дотоод гишүүдийн карт" хэсэгт тухайн байгууллагын ажилтнуудын үнэ төлбөргүй цэнэглэх картуудыг харна.',
  },
];

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
  const [limit, setLimit] = React.useState(50);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = React.useState<Client | null>(null);
  const [permissionClient, setPermissionClient] = React.useState<Client | null>(null);
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
    refreshInterval: REFRESH.config,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const columns = canEdit || canDelete ? 8 : 7;

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
      <Card>
        <FilterBar>
          <div className="relative min-w-0 sm:min-w-[220px] w-full sm:w-auto flex-1">
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
          <PageGuide topic="clients" title="Харилцагч удирдах" steps={CLIENTS_GUIDE_STEPS} />
          {canEdit ? (
            <FilterActions>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setEditingClient(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Харилцагч бүртгэх
              </Button>
            </FilterActions>
          ) : null}
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH className="w-12 text-center">№</TH>
                <TH>Харилцагчийн нэр</TH>
                <TH>Регистр</TH>
                <TH>Станцууд</TH>
                <TH>Холбоо барих</TH>
                <TH>Хаяг</TH>
                <TH>Төлөв</TH>
                {canEdit || canDelete ? (
                  <TH className="text-center">Үйлдлүүд</TH>
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
                rows.map((c, idx) => {
                  const num = (page - 1) * limit + idx + 1;
                  return (
                  <TR key={c.id}>
                    <TD align="center" className="text-xs text-[var(--color-fg-muted)] font-mono">
                      {num}
                    </TD>
                    <TD align="left" className="whitespace-nowrap">
                      {/* One line: name, then the contact person muted. */}
                      <div className="inline-flex max-w-[280px] items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
                        <Link
                          href={`/clients/${encodeURIComponent(c.id)}`}
                          className="truncate font-medium hover:text-[var(--color-brand)] hover:underline"
                          title={c.name}
                        >
                          {c.name}
                        </Link>
                        {c.contactPerson ? (
                          <span
                            className="truncate text-xs text-[var(--color-fg-muted)]"
                            title={`Холбоо барих: ${c.contactPerson}`}
                          >
                            · {c.contactPerson}
                          </span>
                        ) : null}
                      </div>
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
                    <TD align="left" className="whitespace-nowrap text-xs text-[var(--color-fg-muted)] px-3 text-left">
                      {/* Phone and email side by side; a long address truncates. */}
                      {c.phone || c.email ? (
                        <div className="inline-flex max-w-[340px] items-center gap-3">
                          {c.phone ? (
                            <a
                              href={`tel:${c.phone}`}
                              className="inline-flex shrink-0 items-center gap-1 hover:text-[var(--color-fg)]"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="tnum">{formatPhone(c.phone)}</span>
                            </a>
                          ) : null}
                          {c.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              className="inline-flex min-w-0 items-center gap-1 hover:text-[var(--color-fg)]"
                              title={c.email}
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
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
                      <TD>
                        <div className="flex items-center justify-center gap-1">
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPermissionClient(c)}
                              aria-label={`${c.name} цэс хандах эрх`}
                              title="Цэс хандах эрх"
                              className="text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
                            >
                              <Shield className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingClient(c);
                                setModalOpen(true);
                              }}
                              aria-label={`${c.name} засах`}
                              title="Засах"
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
                );
              })
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

      {permissionClient ? (
        <ClientPermissionModal
          client={permissionClient}
          onClose={() => setPermissionClient(null)}
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

function ClientPermissionModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [allowedMenus, setAllowedMenus] = React.useState<string[]>(() => {
    if (client.allowedMenus && client.allowedMenus.length > 0) {
      return [...client.allowedMenus];
    }
    // Default to all manageable menus
    return MANAGEABLE_MENUS.map((m) => m.href);
  });

  const opMenus = MANAGEABLE_MENUS.filter((m) => m.section === 'Үйл ажиллагаа');
  const accessMenus = MANAGEABLE_MENUS.filter((m) => m.section === 'Хандалт');

  const toggleMenu = (href: string) => {
    setAllowedMenus((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href],
    );
  };

  const selectAll = () => {
    setAllowedMenus(MANAGEABLE_MENUS.map((m) => m.href));
  };

  const selectNone = () => {
    setAllowedMenus([]);
  };

  const selectOperationsOnly = () => {
    setAllowedMenus(opMenus.map((m) => m.href));
  };

  async function handleSave() {
    setSaving(true);
    try {
      const id = client.id || client._id;
      await api.patch(`clients/${encodeURIComponent(id!)}`, {
        allowedMenus,
      });
      toast.success(`"${client.name}" харилцагчийн цэс хандах эрх хадгалагдлаа`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[var(--color-brand)]" />
          <span>Цэс хандах эрхийн тохиргоо</span>
        </div>
      }
      description={
        <span>
          <strong className="text-[var(--color-fg)]">{client.name}</strong> харилцагчийн админ системд хандах боломжтой цэсүүдийг чеклэж тохируулна уу.
        </span>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[var(--color-fg-muted)]">
            Сонгогдсон: <strong className="text-[var(--color-brand)]">{allowedMenus.length}</strong> / {MANAGEABLE_MENUS.length}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Болих
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              Хадгалах
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2.5">
          <div className="text-xs text-[var(--color-fg-muted)]">
            Харилцагчийн нэвтрэх хэрэглэгчид зөвхөн энд чеклэсэн цэсүүд харагдана.
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" type="button" onClick={selectAll} className="text-xs h-7 px-2">
              Бүгд
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={selectOperationsOnly} className="text-xs h-7 px-2">
              Үйл ажиллагаа
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={selectNone} className="text-xs h-7 px-2 text-[var(--color-fg-subtle)]">
              Арилгах
            </Button>
          </div>
        </div>

        {/* Үйл ажиллагаа Group */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] mb-2">
            Үйл ажиллагаа
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {opMenus.map((item) => {
              const checked = allowedMenus.includes(item.href);
              return (
                <label
                  key={item.href}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer select-none ${
                    checked
                      ? 'border-[var(--color-brand)]/40 bg-[var(--color-brand-soft)]/40 font-medium text-[var(--color-fg)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-brand)]"
                    checked={checked}
                    onChange={() => toggleMenu(item.href)}
                  />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-[var(--color-fg-subtle)]">{item.href}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Хандалт Group */}
        <div className="pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)] mb-2">
            Хандалт
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {accessMenus.map((item) => {
              const checked = allowedMenus.includes(item.href);
              return (
                <label
                  key={item.href}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer select-none ${
                    checked
                      ? 'border-[var(--color-brand)]/40 bg-[var(--color-brand-soft)]/40 font-medium text-[var(--color-fg)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-brand)]"
                    checked={checked}
                    onChange={() => toggleMenu(item.href)}
                  />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-[var(--color-fg-subtle)]">{item.href}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
