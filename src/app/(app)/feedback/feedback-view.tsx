'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  Check,
  CheckCircle2,
  MessageSquareText,
  Phone,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import type { Feedback } from '@/lib/types';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';
import {
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableEmpty,
  TableLoading,
} from '@/components/ui/table';
import { ConfirmModal } from '@/components/ui/modal';
import { FilterActions, FilterBar, Pagination } from '@/components/ui/pagination';
import { PageGuide } from '@/components/shell/page-guide';

interface FeedbackResponse {
  data: Feedback[];
  items?: Feedback[];
  total: number;
  unread: number;
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
    title: 'Төлөв шинэчлэх & устгах',
    body: 'Ирсэн санал хүсэлттэй танилцаж жолоочтой холбогдон шийдвэрлэсний дараа "Шийдсэн" төлөвт шилжүүлэх эсвэл шаардлагагүй бол устгаж цэгцэлнэ.',
  },
];

export function FeedbackView({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [status, setStatus] = React.useState<'all' | 'new' | 'done'>('all');
  const [search, setSearch] = React.useState<string>('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<Feedback | null>(null);

  const queryParams: Record<string, unknown> = { page, limit };
  if (status !== 'all') queryParams.status = status;
  if (search.trim()) queryParams.search = search.trim();

  const key = apiUrl('feedback', queryParams);
  const { data, error, isLoading, mutate } = useSWR<FeedbackResponse>(key, fetcher, {
    refreshInterval: REFRESH.config,
    keepPreviousData: true,
  });

  const rows = data?.data ?? data?.items ?? [];
  const total = data?.total ?? 0;
  const unread = data?.unread ?? 0;

  async function setStatusDone(f: Feedback, done: boolean) {
    setBusyId(f.id);
    try {
      await api.patch(`feedback/${f.id}`, { status: done ? 'done' : 'new' });
      toast.success(done ? 'Шийдвэрлэсэн гэж тэмдэглэлээ' : 'Шинэ төлөвт шилжүүллээ');
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
      toast.success('Санал хүсэлт устгагдлаа');
      setDeleting(null);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
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
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setStatus('all');
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                status === 'all'
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Бүгд
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus('new');
                setPage(1);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                status === 'new'
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <span>Шинэ</span>
              {unread > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {unread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus('done');
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                status === 'done'
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Шийдсэн
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-sm">
            <Input
              placeholder="Утас, санал хүсэлтийн утгаар хайх..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs"
            />
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
          </FilterActions>
        </FilterBar>

        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Огноо</TH>
                <TH>Жолооч / Утас</TH>
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
                    <TD className="whitespace-nowrap text-xs">
                      {row.userName && (
                        <div className="font-semibold text-foreground">{row.userName}</div>
                      )}
                      {row.phone ? (
                        <a
                          href={`tel:${row.phone}`}
                          className="inline-flex items-center gap-1 font-mono text-brand hover:underline"
                        >
                          <Phone className="size-3 text-muted" />
                          <span>{row.phone}</span>
                        </a>
                      ) : (
                        <span className="text-muted">Зочин (утасгүй)</span>
                      )}
                    </TD>
                    <TD>
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                        {row.message}
                      </p>
                      {row.handledBy && (
                        <p className="mt-1 text-[11px] text-muted">
                          Шийдвэрлэсэн: {row.handledBy}
                        </p>
                      )}
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
                      {row.status === 'done' ? (
                        <Badge tone="ok">Шийдсэн</Badge>
                      ) : (
                        <Badge tone="warn">Шинэ</Badge>
                      )}
                    </TD>
                    {canEdit && (
                      <TD className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {row.status === 'new' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busyId === row.id}
                              onClick={() => void setStatusDone(row, true)}
                              title="Шийдвэрлэсэн болгох"
                              className="text-xs h-7 px-2 text-emerald-600 dark:text-emerald-400"
                            >
                              <Check className="size-3.5 mr-1" />
                              <span>Шийдсэн</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === row.id}
                              onClick={() => void setStatusDone(row, false)}
                              title="Шинэ болгох"
                              className="text-xs h-7 px-2 text-muted"
                            >
                              <RotateCcw className="size-3.5 mr-1" />
                              <span>Шинэ</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => setDeleting(row)}
                            title="Устгах"
                            className="text-xs h-7 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TD>
                    )}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>

        <Pagination
          page={page}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
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
    </div>
  );
}
