'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  CheckCircle2,
  Clock,
  Edit2,
  FileCode2,
  FileText,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
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

const DISTRICT_NAMES: Record<string, string> = {
  '23': 'Сүхбаатар',
  '24': 'Хан-Уул',
  '25': 'Баянгол',
  '26': 'Баянзүрх',
  '27': 'Сонгинохайрхан',
  '28': 'Чингэлтэй',
  '01': 'Багануур',
  '02': 'Багахангай',
  '05': 'Налайх',
};

export function EbarimtMerchantsView({
  canEdit,
  canDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(10);
  const [search] = React.useState('');

  const { data, error, mutate, isValidating } = useSWR<MerchantListResponse>(
    apiUrl('ebarimt-merchants', { page, limit, search }),
    fetcher,
  );

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingMerchant, setEditingMerchant] = React.useState<EbarimtMerchantItem | null>(null);
  const [deletingMerchant, setDeletingMerchant] = React.useState<EbarimtMerchantItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [checkingId, setCheckingId] = React.useState<string | null>(null);
  const [lastCheckLog, setLastCheckLog] = React.useState<EbarimtMerchantItem | null>(null);

  const merchants = data?.data ?? [];
  const total = data?.total ?? 0;

  // Auto-set latest check log if available
  React.useEffect(() => {
    if (merchants.length > 0 && !lastCheckLog) {
      setLastCheckLog(merchants[0]);
    }
  }, [merchants, lastCheckLog]);

  async function handleDelete() {
    if (!deletingMerchant) return;
    setDeleting(true);
    try {
      const id = deletingMerchant.id || deletingMerchant._id;
      await api.del(`/ebarimt-merchants/${encodeURIComponent(id!)}`);
      toast.success('И-Баримт тохиргоо устгагдлаа');
      setDeletingMerchant(null);
      if (lastCheckLog?.id === id || lastCheckLog?._id === id) {
        setLastCheckLog(null);
      }
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleCheckService(merchantItem: EbarimtMerchantItem) {
    const id = merchantItem.id || merchantItem._id;
    if (!id) return;
    setCheckingId(id);
    try {
      const res: EbarimtMerchantItem = await api.post(`/ebarimt-merchants/${encodeURIComponent(id)}/check`, {});
      toast.success('И-Баримт серверийн холболт шалгагдлаа');
      setLastCheckLog(res);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="И-Баримт Мерчант Тохиргоо"
        description="ГААТ eBarimt REST 3.0 системийн ААН Регистр (TIN), дүүрэг, хорооны бүртгэл болон серверийн холболтын лог"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void mutate()} loading={isValidating}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                onClick={() => {
                  setEditingMerchant(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                И-Баримт тохиргоо нэмэх
              </Button>
            )}
          </div>
        }
      />

      {/* Primary List Table */}
      <Card>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Байгууллагын нэр</TH>
                <TH>Татвар төлөгчийн № (TIN)</TH>
                <TH>Дүүрэг / Хороо</TH>
                <TH>И-Баримт төлөв</TH>
                <TH>Серверийн орчин</TH>
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
                    title="И-Баримт тохиргоо олдсонгүй"
                    description="Шинээр И-Баримт олгох ААН-ийн Регистр болон тохиргоог нэмнэ үү."
                  />
                </TableEmpty>
              ) : (
                merchants.map((item) => {
                  const itemId = item.id || item._id;
                  const isTest = item.envMode === 'TEST';
                  const activeUrl = isTest
                    ? item.testApiUrl || 'http://103.236.194.50:7080/'
                    : item.prodApiUrl || item.ebarimtApiUrl || 'http://103.143.40.43:7080/';
                  const districtName = DISTRICT_NAMES[item.districtCode] || item.districtCode;
                  const khorooName = item.khorooCode ? `${item.khorooCode}-р хороо` : '1-р хороо';

                  const checkStatus = item.lastCheckResult?.status;

                  return (
                    <TR key={itemId}>
                      <TD className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                        {item.isDefault && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Үндсэн
                          </span>
                        )}
                      </TD>
                      <TD className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                        {item.merchantTin}
                      </TD>
                      <TD className="text-slate-700 dark:text-slate-300 text-sm font-medium">
                        {districtName}, {khorooName}
                      </TD>
                      <TD>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <Badge tone={item.enabled ? 'ok' : 'idle'}>
                              {item.enabled ? 'И-Баримт идэвхтэй' : 'Идэвхгүй'}
                            </Badge>
                            {item.autoSend && (
                              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                Автомат
                              </span>
                            )}
                          </div>
                        </div>
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
                          <span className="font-mono text-[11px] text-slate-500 max-w-[180px] truncate mt-0.5">
                            {activeUrl}
                          </span>
                        </div>
                      </TD>
                      <TD align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs font-semibold gap-1"
                            loading={checkingId === itemId}
                            onClick={() => void handleCheckService(item)}
                          >
                            <Server className="h-3.5 w-3.5" />
                            Шалгах
                          </Button>
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

      {/* eBarimt Service Response Log Section */}
      {lastCheckLog && (
        <Card className="p-5 border-l-4 border-l-emerald-500 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                И-Баримт Серверийн Сүүлийн Лог & Холболтын Төлөв
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {lastCheckLog.lastCheckResult?.checkedAt
                ? new Date(lastCheckLog.lastCheckResult.checkedAt).toLocaleString()
                : 'Дөнгөж сая'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status overview card */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                eBarimt Сервис Хүлээн авсан эсэх
              </span>
              <div className="mt-2 flex items-center gap-2">
                {lastCheckLog.lastCheckResult?.status === 'SUCCESS' ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                      ЗӨВШӨӨРСӨН / АМЖИЛТТАЙ
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-amber-500 shrink-0" />
                    <span className="font-extrabold text-amber-600 dark:text-amber-400 text-base">
                      ШЕО/СЕРВЕРТ ХОЛБОГДОЖ БАЙНА
                    </span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-mono">
                TIN: <strong className="text-slate-900 dark:text-slate-100">{lastCheckLog.merchantTin}</strong> | Дүүрэг:{' '}
                {lastCheckLog.districtCode} ({DISTRICT_NAMES[lastCheckLog.districtCode] || ''})
              </p>
            </div>

            {/* Config Info */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Илгээх тохиргоо
              </span>
              <div className="mt-1 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">И-Баримт ашиглах:</span>
                  <span className="font-bold text-emerald-600">
                    {lastCheckLog.enabled ? 'ТИЙМ (Идэвхтэй)' : 'ҮГҮЙ'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Автоматаар илгээх:</span>
                  <span className="font-bold text-blue-600">
                    {lastCheckLog.autoSend ? 'ТИЙМ (Идэвхтэй)' : 'ҮГҮЙ'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Серверийн URL:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                    {lastCheckLog.envMode === 'TEST' ? lastCheckLog.testApiUrl : lastCheckLog.prodApiUrl}
                  </span>
                </div>
              </div>
            </div>

            {/* Response Code */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                HTTP / API Хариу
              </span>
              <div className="mt-1 font-mono text-xs space-y-1">
                <div>
                  HTTP Status:{' '}
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {lastCheckLog.lastCheckResult?.statusCode || 200}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                  {lastCheckLog.lastCheckResult?.message || 'Сервис холбогдсон.'}
                </div>
              </div>
            </div>
          </div>

          {/* Raw JSON Log payload output */}
          <div className="rounded-xl bg-slate-950 text-slate-100 p-4 font-mono text-xs overflow-x-auto border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
              <FileCode2 className="h-4 w-4" />
              eBarimt REST Service Raw Response Log:
            </div>
            <pre className="text-[11px] leading-relaxed text-slate-300">
              {JSON.stringify(
                lastCheckLog.lastCheckResult?.rawResponse || {
                  timestamp: new Date().toISOString(),
                  merchantTin: lastCheckLog.merchantTin,
                  districtCode: lastCheckLog.districtCode,
                  khorooCode: lastCheckLog.khorooCode || '1',
                  enabled: lastCheckLog.enabled,
                  autoSend: lastCheckLog.autoSend,
                  acceptedByService: lastCheckLog.lastCheckResult?.status === 'SUCCESS',
                  httpStatus: lastCheckLog.lastCheckResult?.statusCode || 200,
                  message: lastCheckLog.lastCheckResult?.message || 'OK',
                },
                null,
                2,
              )}
            </pre>
          </div>
        </Card>
      )}

      {modalOpen && (
        <EbarimtMerchantModal
          merchant={editingMerchant}
          onClose={() => {
            setModalOpen(false);
            setEditingMerchant(null);
          }}
          onSaved={(savedItem) => {
            if (savedItem) {
              setLastCheckLog(savedItem);
            }
            void mutate();
          }}
        />
      )}

      {deletingMerchant && (
        <ConfirmModal
          open={Boolean(deletingMerchant)}
          onClose={() => setDeletingMerchant(null)}
          onConfirm={handleDelete}
          loading={deleting}
          title="Тохиргоо устгах уу?"
          message={`"${deletingMerchant.name}" (${deletingMerchant.merchantTin}) И-Баримт тохиргоог устгахдаа итгэлтэй байна уу?`}
          confirmLabel="Устгах"
          tone="danger"
        />
      )}
    </div>
  );
}
