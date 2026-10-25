'use client';

import * as React from 'react';
import useSWR from 'swr';
<<<<<<< HEAD
import { CheckCircle2, MessageSquareText, Phone, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import { Badge, Button, Card, Input, Select } from '@/components/ui/primitives';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { FilterActions, FilterBar, Pagination } from '@/components/ui/pagination';
import { PageGuide } from '@/components/shell/page-guide';

interface FeedbackItem {
  id: string;
  phone: string | null;
  message: string;
  source: string;
  status: 'NEW' | 'READ' | 'RESOLVED';
  smsDeliveredTo: string[];
  createdAt: string;
}

interface FeedbackResponse {
  items: FeedbackItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const GUIDE_STEPS = [
  {
    title: 'Санал хүсэлт хүлээн авах',
    body: 'Вэбсайт болон киоскын хөл хэсгийн "Санал хүсэлт" товчоор жолооч, зочдын илгээсэн санал, хүсэлт, асуудлууд энд бодит цагт бүртгэгдэнэ.',
  },
  {
    title: 'Шуурхай SMS мэдэгдэл',
    body: 'Шинэ санал хүсэлт ирэх бүрд системийн тохиргоот 3 дугаарт (88887207, 95393408, 99246123) "sanal huselt irlee." гэсэн SMS автоматаар очно.',
  },
  {
    title: 'Төлөв шинэчлэх',
    body: 'Ирсэн санал хүсэлттэй танилцаж жолоочтой холбогдон шийдвэрлэсний дараа "Уншсан", "Шийдвэрлэсэн" төлөвт шилжүүлж хөтөлнө.',
  },
];

export function FeedbackView({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [status, setStatus] = React.useState<string>('');
  const [search, setSearch] = React.useState<string>('');
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const queryParams: Record<string, unknown> = { page, limit };
  if (status) queryParams.status = status;
  if (search.trim()) queryParams.search = search.trim();

  const key = apiUrl('feedback', queryParams);
  const { data, error, isLoading, mutate } = useSWR<FeedbackResponse>(key, fetcher, {
    refreshInterval: 10000,
    keepPreviousData: true,
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  async function updateStatus(id: string, newStatus: 'NEW' | 'READ' | 'RESOLVED') {
    setUpdatingId(id);
    try {
      await api.patch(`feedback/${id}`, { status: newStatus });
      toast.success('Төлөв амжилттай шинэчлэгдлээ');
=======
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
>>>>>>> a6b40fb8ed753193d57cf3dff6d63c8bd0d007b8
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
<<<<<<< HEAD
      setUpdatingId(null);
=======
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
>>>>>>> a6b40fb8ed753193d57cf3dff6d63c8bd0d007b8
    }
  }

  return (
<<<<<<< HEAD
    <div className="space-y-6">
      {/* Top Notification Overview Banner */}
      <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Send className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                SMS Мэдэгдэл илгээх дугаарууд
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Санал хүсэлт ирэх үед автоматаар <strong>"sanal huselt irlee."</strong> SMS илгээгдэнэ.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {['88887207', '95393408', '99246123'].map((phone) => (
              <span
                key={phone}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-1.5 text-xs font-mono font-bold text-foreground shadow-sm"
              >
                <Phone className="size-3 text-emerald-500" />
                <span>{phone}</span>
                <CheckCircle2 className="size-3 text-emerald-500" />
              </span>
            ))}
          </div>
        </div>
      </Card>

      <PageGuide topic="feedback" title="Санал хүсэлтийн систем" steps={GUIDE_STEPS} />

      <Card>
        <FilterBar>
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <Input
              placeholder="Утас, санал хүсэлтийн утгаар хайх..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 max-w-full text-xs"
            />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="text-xs w-40"
            >
              <option value="">Бүх төлөв</option>
              <option value="NEW">Шинэ</option>
              <option value="READ">Уншсан</option>
              <option value="RESOLVED">Шийдвэрлэсэн</option>
            </Select>
          </div>

          <FilterActions>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void mutate()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5" />
              <span>Шинэчлэх</span>
            </Button>
=======
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
>>>>>>> a6b40fb8ed753193d57cf3dff6d63c8bd0d007b8
          </FilterActions>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
<<<<<<< HEAD
              <TR>
                <TH>Огноо</TH>
                <TH>Утас</TH>
                <TH className="min-w-[280px]">Санал хүсэлт</TH>
                <TH>Эх сурвалж</TH>
                <TH>SMS очсон</TH>
                <TH>Төлөв</TH>
                {canEdit && <TH className="text-right">Үйлдэл</TH>}
              </TR>
            </THead>
            <TBody>
              {isLoading && rows.length === 0 ? (
                <TableLoading colSpan={canEdit ? 7 : 6} />
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={canEdit ? 7 : 6}>
                  Ирсэн санал хүсэлт одоогоор байхгүй байна.
                </TableEmpty>
              ) : (
                rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="text-xs text-muted whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </TD>
                    <TD className="whitespace-nowrap font-mono text-xs font-semibold">
                      {row.phone ? (
                        <a
                          href={`tel:${row.phone}`}
                          className="inline-flex items-center gap-1.5 text-brand hover:underline"
                        >
                          <Phone className="size-3 text-muted" />
                          <span>{row.phone}</span>
                        </a>
                      ) : (
                        <span className="text-muted">Тодорхойгүй</span>
                      )}
                    </TD>
                    <TD>
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                        {row.message}
                      </p>
                    </TD>
                    <TD className="text-xs text-muted whitespace-nowrap">
                      <span className="uppercase tracking-wider font-mono text-[11px]">
                        {row.source || 'web'}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {row.smsDeliveredTo && row.smsDeliveredTo.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.smsDeliveredTo.map((num) => (
                            <span
                              key={num}
                              className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                            >
                              ✓ {num}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {row.status === 'NEW' ? (
                        <Badge tone="warn">Шинэ</Badge>
                      ) : row.status === 'READ' ? (
                        <Badge tone="info">Уншсан</Badge>
                      ) : (
                        <Badge tone="ok">Шийдвэрлэсэн</Badge>
                      )}
                    </TD>
                    {canEdit && (
                      <TD className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.status === 'NEW' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs h-7 px-2"
                              disabled={updatingId === row.id}
                              onClick={() => void updateStatus(row.id, 'READ')}
                            >
                              Уншсан
                            </Button>
                          )}
                          {row.status !== 'RESOLVED' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs h-7 px-2 text-emerald-600 dark:text-emerald-400"
                              disabled={updatingId === row.id}
                              onClick={() => void updateStatus(row.id, 'RESOLVED')}
                            >
                              Шийдвэрлэсэн
                            </Button>
                          )}
                          {row.status === 'RESOLVED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 px-2 text-muted"
                              disabled={updatingId === row.id}
                              onClick={() => void updateStatus(row.id, 'NEW')}
                            >
                              Дахин нээх
                            </Button>
                          )}
                        </div>
                      </TD>
                    )}
=======
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
>>>>>>> a6b40fb8ed753193d57cf3dff6d63c8bd0d007b8
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>

        <Pagination
          page={page}
<<<<<<< HEAD
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </Card>
    </div>
=======
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
>>>>>>> a6b40fb8ed753193d57cf3dff6d63c8bd0d007b8
  );
}
