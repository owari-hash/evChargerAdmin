'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Edit2, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, fetcher } from '@/lib/client';
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ConfirmModal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
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
import { EbarimtMerchantModal, type EbarimtMerchantItem } from './ebarimt-merchant-modal';

interface MerchantListResponse {
  data: EbarimtMerchantItem[];
  total: number;
  page: number;
  limit: number;
}

export function EbarimtMerchantsView({
  canEdit,
  canDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(10);
  const [search, setSearch] = React.useState('');

  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) query.set('search', search);

  const { data, error, mutate, isValidating } = useSWR<MerchantListResponse>(
    `/ebarimt-merchants?${query.toString()}`,
    fetcher,
  );

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingMerchant, setEditingMerchant] = React.useState<EbarimtMerchantItem | null>(null);
  const [deletingMerchant, setDeletingMerchant] = React.useState<EbarimtMerchantItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const merchants = data?.data ?? [];
  const total = data?.total ?? 0;

  async function handleDelete() {
    if (!deletingMerchant) return;
    setDeleting(true);
    try {
      const id = deletingMerchant.id || deletingMerchant._id;
      await api.del(`/ebarimt-merchants/${encodeURIComponent(id!)}`);
      toast.success('И-Баримт мерчант устгагдлаа');
      setDeletingMerchant(null);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="И-Баримт Мерчант"
        description="ГААТ eBarimt REST 3.0 системд бүртгэлтэй байгууллагын дугаар болон POS орчны тохиргоо (Production / Test)"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void mutate()} loading={isValidating}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingMerchant(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Мерчант нэмэх
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Байгууллагын нэр</TH>
                <TH>ААН Регистр (TIN)</TH>
                <TH>Дүүрэг / POS</TH>
                <TH>Серверийн орчин</TH>
                <TH>Төлөв</TH>
                <TH align="right">Үйлдэл</TH>
              </TR>
            </THead>
            <TBody>
              {error ? (
                <TR>
                  <TD colSpan={6} className="text-center text-red-500 py-6">
                    {errorMessage(error)}
                  </TD>
                </TR>
              ) : !data && isValidating ? (
                <TableLoading colSpan={6} rows={5} />
              ) : merchants.length === 0 ? (
                <TableEmpty colSpan={6}>
                  <EmptyState
                    icon={<FileText className="h-8 w-8" />}
                    title="И-Баримт мерчант олдсонгүй"
                    description="Шинээр И-Баримт олгох ААН-ийн Регистр болон орчны тохиргоог нэмнэ үү."
                  />
                </TableEmpty>
              ) : (
                merchants.map((item) => {
                  const isTest = item.envMode === 'TEST';
                  const activeUrl = isTest
                    ? item.testApiUrl || 'http://103.236.194.50:7080/'
                    : item.prodApiUrl || item.ebarimtApiUrl || 'http://103.143.40.43:7080/';

                  return (
                    <TR key={item.id || item._id}>
                      <TD className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                        {item.isDefault && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Үндсэн
                          </span>
                        )}
                      </TD>
                      <TD className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                        {item.merchantTin}
                      </TD>
                      <TD className="text-slate-600 dark:text-slate-400">
                        Дүүрэг: {item.districtCode} · Branch: {item.branchNo} · POS: {item.posNo}
                      </TD>
                      <TD>
                        <div className="flex flex-col">
                          <span
                            className={`inline-flex w-max items-center rounded px-2 py-0.5 text-[11px] font-bold ${
                              isTest
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            }`}
                          >
                            {isTest ? 'TEST (Туршилт)' : 'PROD (Үндсэн)'}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 max-w-[200px] truncate mt-0.5">
                            {activeUrl}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <Badge tone={item.enabled ? 'ok' : 'idle'}>
                          {item.enabled ? 'Идэвхтэй' : 'Идэвхгүй'}
                        </Badge>
                      </TD>
                      <TD align="right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingMerchant(item);
                                setModalOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeletingMerchant(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>

        {total > 0 && (
          <Pagination
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
            label="мерчант"
          />
        )}
      </Card>

      {modalOpen && (
        <EbarimtMerchantModal
          merchant={editingMerchant}
          onClose={() => {
            setModalOpen(false);
            setEditingMerchant(null);
          }}
          onSaved={() => void mutate()}
        />
      )}

      {deletingMerchant && (
        <ConfirmModal
          open={Boolean(deletingMerchant)}
          onClose={() => setDeletingMerchant(null)}
          onConfirm={handleDelete}
          loading={deleting}
          title="Мерчант устгах уу?"
          message={`"${deletingMerchant.name}" (${deletingMerchant.merchantTin}) И-Баримт мерчантыг устгахдаа итгэлтэй байна уу?`}
          confirmLabel="Устгах"
          tone="danger"
        />
      )}
    </div>
  );
}
