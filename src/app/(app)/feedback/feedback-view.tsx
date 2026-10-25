'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import type { Feedback, Paginated } from '@/lib/types';
import { Badge, Button, Card, Select } from '@/components/ui/primitives';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { ConfirmModal } from '@/components/ui/modal';
import { FilterActions, FilterBar, Pagination } from '@/components/ui/pagination';
import { PageGuide } from '@/components/shell/page-guide';

const GUIDE_STEPS = [
  {
    title: 'Хаанаас ирдэг вэ',
    body: 'Жолооч kiosk вэбийн доод хэсгийн «Санал хүсэлт» товчоор илгээнэ. Нэвтэрсэн бол бүртгэлийн утас нь автоматаар хавсарна, зочин бол утсаа өөрөө бичнэ.',
  },
  {
    title: 'Шийдвэрлэх',
    body: 'Холбогдож шийдсэний дараа ✓ товчоор «Шийдсэн» болгоно. Шинэ санал хүсэлтүүд дээрээ харагдана.',
  },
];

type StatusFilter = 'all' | 'new' | 'done';

export function FeedbackView({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [status, setStatus] = React.useState<StatusFilter>('new');
  const [deleting, setDeleting] = React.useState<Feedback | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const key = apiUrl('feedback', { page, limit, status });
  const { data, error, isLoading, mutate } = useSWR<Paginated<Feedback> & { unread?: number }>(
    key,
    fetcher,
    { refreshInterval: REFRESH.config, keepPreviousData: true },
  );
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const cols = canEdit ? 6 : 5;

  async function setDone(f: Feedback, done: boolean) {
    setBusyId(f.id);
    try {
      await api.patch(`feedback/${f.id}`, { status: done ? 'done' : 'new' });
      toast.success(done ? 'Шийдсэн гэж тэмдэглэлээ' : 'Шинэ болгож буцаалаа');
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api.del(`feedback/${deleting.id}`);
      toast.success('Устгагдлаа');
      setDeleting(null);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card>
        <FilterBar>
          <Select
            className="h-9 w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            aria-label="Төлөв"
          >
            <option value="new">Шинэ{data?.unread ? ` (${data.unread})` : ''}</option>
            <option value="done">Шийдсэн</option>
            <option value="all">Бүгд</option>
          </Select>
          <div className="flex-1" />
          <FilterActions>
            <PageGuide topic="feedback" title="Санал хүсэлт" steps={GUIDE_STEPS} />
          </FilterActions>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Санал хүсэлт</TH>
                <TH>Утас</TH>
                <TH>Хэрэглэгч</TH>
                <TH>Илгээсэн</TH>
                <TH>Төлөв</TH>
                {canEdit ? (
                  <TH>
                    <span className="sr-only">Үйлдэл</span>
                  </TH>
                ) : null}
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={cols} />
              ) : error ? (
                <TableEmpty colSpan={cols}>Санал хүсэлтийг ачаалж чадсангүй.</TableEmpty>
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={cols}>Санал хүсэлт алга.</TableEmpty>
              ) : (
                rows.map((f) => (
                  <TR key={f.id}>
                    <TD align="left">
                      <p className="max-w-[420px] whitespace-pre-wrap break-words text-sm">{f.message}</p>
                    </TD>
                    <TD className="whitespace-nowrap font-mono text-xs">
                      {f.phone ? (
                        <a href={`tel:${f.phone}`} className="hover:underline">
                          {f.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-xs">
                      {f.userId ? (f.userName || 'Бүртгэлтэй') : <span className="text-[var(--color-fg-muted)]">Зочин</span>}
                      <span className="ml-1 text-[var(--color-fg-muted)]">· {f.source === 'app' ? 'Апп' : 'Вэб'}</span>
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                      {formatDateTime(f.createdAt)}
                    </TD>
                    <TD>
                      {f.status === 'new' ? <Badge tone="warn">Шинэ</Badge> : <Badge tone="ok">Шийдсэн</Badge>}
                    </TD>
                    {canEdit ? (
                      <TD>
                        <div className="flex items-center justify-center gap-1">
                          {f.status === 'new' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === f.id}
                              onClick={() => void setDone(f, true)}
                              aria-label="Шийдсэн болгох"
                              title="Шийдсэн болгох"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === f.id}
                              onClick={() => void setDone(f, false)}
                              aria-label="Шинэ болгох"
                              title="Шинэ болгох"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(f)}
                            aria-label="Устгах"
                            className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        loading={busyId !== null && busyId === deleting?.id}
        tone="danger"
        title="Санал хүсэлт устгах уу?"
        confirmLabel="Устгах"
        message={deleting ? <span className="line-clamp-3">{deleting.message}</span> : null}
      />
    </>
  );
}
