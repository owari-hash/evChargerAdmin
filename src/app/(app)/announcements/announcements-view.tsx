'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import type { Announcement, Paginated } from '@/lib/types';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { ConfirmModal } from '@/components/ui/modal';
import { FilterActions, FilterBar, Pagination } from '@/components/ui/pagination';
import { PageGuide } from '@/components/shell/page-guide';
import { AnnouncementModal } from './announcement-modal';

const GUIDE_STEPS = [
  {
    title: 'Мэдээ нийтлэх',
    body: '"Шинэ мэдээ" товч дарж гарчиг, агуулга, (заавал биш) зураг оруулна.',
  },
  {
    title: 'Хэрэглэгчид хэрхэн харагдах вэ',
    body: 'Нэвтэрсэн жолоочид kiosk вэб болон аппаа нээхэд хамгийн сүүлийн, өмнө нь хараагүй мэдээ нь цонх хэлбэрээр нэг удаа харагдана.',
  },
  {
    title: 'Хаасны дараа',
    body: 'Жолооч цонхыг хаасны дараа тухайн мэдээ тэдний мэдэгдлийн хонхны жагсаалтад үлдэнэ — дахин алга болохгүй.',
  },
];

export function AnnouncementsView({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [editing, setEditing] = React.useState<Announcement | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Announcement | null>(null);
  const [busy, setBusy] = React.useState(false);

  const key = apiUrl('announcements', { page, limit });
  const { data, error, isLoading, mutate } = useSWR<Paginated<Announcement>>(key, fetcher, {
    refreshInterval: REFRESH.config,
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`announcements/${deleting.id}`);
      toast.success('Мэдээ устгагдлаа');
      setDeleting(null);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <FilterBar>
          <div className="flex-1" />
          <PageGuide topic="announcements" title="Мэдээ" steps={GUIDE_STEPS} />
          {canEdit ? (
            <FilterActions>
              <Button variant="primary" size="md" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                Шинэ мэдээ
              </Button>
            </FilterActions>
          ) : null}
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH className="w-12 text-center">№</TH>
                <TH className="text-center">Гарчиг</TH>
                <TH className="text-center">Төлөв</TH>
                <TH className="text-center">Нийтэлсэн</TH>
                <TH className="text-center">Шинэчлэгдсэн</TH>
                {canEdit ? (
                  <TH className="text-center">Үйлдэл</TH>
                ) : null}
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={canEdit ? 6 : 5} />
              ) : error ? (
                <TableEmpty colSpan={canEdit ? 6 : 5}>Мэдээг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={canEdit ? 6 : 5}>Одоогоор мэдээ нийтлээгүй байна.</TableEmpty>
              ) : (
                rows.map((a, idx) => {
                  const num = (page - 1) * limit + idx + 1;
                  return (
                  <TR key={a.id}>
                    <TD align="center" className="text-xs text-[var(--color-fg-muted)] font-mono text-center">
                      {num}
                    </TD>
                    <TD align="left" className="whitespace-nowrap px-3 text-left">
                      <div className="inline-flex max-w-[320px] items-center gap-2">
                        <Megaphone className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
                        <span className="truncate font-medium" title={a.title}>
                          {a.title}
                        </span>
                      </div>
                    </TD>
                    <TD align="center" className="text-center">
                      {a.isActive ? <Badge tone="ok">Идэвхтэй</Badge> : <Badge tone="idle">Идэвхгүй</Badge>}
                    </TD>
                    <TD align="center" className="text-xs text-[var(--color-fg-muted)] text-center">{formatDateTime(a.createdAt)}</TD>
                    <TD align="center" className="text-xs text-[var(--color-fg-muted)] text-center">{formatDateTime(a.updatedAt)}</TD>
                    {canEdit ? (
                      <TD align="center" className="py-1.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditing(a)}
                            aria-label="Засах"
                            title="Засах"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(a)}
                            aria-label="Устгах"
                            title="Устгах"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

      {creating ? (
        <AnnouncementModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void mutate();
          }}
        />
      ) : null}

      {editing ? (
        <AnnouncementModal
          announcement={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void mutate();
          }}
        />
      ) : null}

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        loading={busy}
        tone="danger"
        title="Мэдээ устгах уу?"
        confirmLabel="Устгах"
        message={
          deleting ? (
            <span>
              Та <span className="font-semibold">{deleting.title}</span> мэдээг устгахдаа итгэлтэй байна уу?
            </span>
          ) : null
        }
      />
    </>
  );
}
