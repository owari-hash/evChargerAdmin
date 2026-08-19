'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Pencil, Search, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { formatRelative } from '@/lib/format';
import type { ConfigurationKey } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  Field,
  Input,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { FilterBar } from '@/components/ui/pagination';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty } from '@/components/ui/table';

/**
 * The cached view of the charge point's OCPP configuration. Values only appear
 * here after a GetConfiguration or a successful ChangeConfiguration — the CSMS
 * cannot know them otherwise.
 */
export function ConfigurationTab({
  chargePointId,
  keys,
  isOnline,
  canOperate,
}: {
  chargePointId: string;
  keys: ConfigurationKey[];
  isOnline: boolean;
  canOperate: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [editing, setEditing] = React.useState<ConfigurationKey | null>(null);

  const visible = keys.filter((k) =>
    filter ? k.key.toLowerCase().includes(filter.toLowerCase()) : true,
  );

  async function refetchAll() {
    setRefreshing(true);
    try {
      await api.post(`charge-points/${encodeURIComponent(chargePointId)}/get-configuration`, {});
      toast.success('Станцаас тохиргоог уншлаа');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Тохиргооны түлхүүр"
          description="Станцаас хадгалсан хуулбар. Шинэчлэхийн тулд дахин уншина уу."
          actions={
            canOperate ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refetchAll()}
                loading={refreshing}
                disabled={!isOnline}
                title={isOnline ? undefined : 'Станц офлайн байна'}
              >
                <Download className="h-3.5 w-3.5" />
                Бүх түлхүүрийг унших
              </Button>
            ) : null
          }
        />

        {keys.length > 0 ? (
          <FilterBar>
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
              <Input
                className="pl-8"
                placeholder="Түлхүүр шүүх…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <span className="text-xs text-[var(--color-fg-muted)]">
              {visible.length} of {keys.length}
            </span>
          </FilterBar>
        ) : null}

        {keys.length === 0 ? (
          <EmptyState
            icon={<Settings2 className="h-8 w-8" />}
            title="Тохиргоо хадгалагдаагүй байна"
            description={
              canOperate
                ? 'Жагсаалтыг дүүргэхийн тулд станцаас түлхүүрүүдийг уншина уу.'
                : 'Оператор эрхтэй хэрэглэгч станцаас түлхүүрүүдийг унших боломжтой.'
            }
            action={
              canOperate ? (
                <Button variant="primary" size="sm" onClick={() => void refetchAll()} disabled={!isOnline}>
                  <Download className="h-3.5 w-3.5" />
                  Бүх түлхүүрийг унших
                </Button>
              ) : null
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Түлхүүр</TH>
                  <TH>Утга</TH>
                  <TH>Хандалт</TH>
                  <TH align="right">Шинэчлэгдсэн</TH>
                  <TH align="right" />
                </tr>
              </THead>
              <TBody>
                {visible.length === 0 ? (
                  <TableEmpty colSpan={5}>Энэ шүүлтүүрт тохирох түлхүүр алга.</TableEmpty>
                ) : (
                  visible.map((k) => (
                    <TR key={k.key}>
                      <TD className="font-mono text-xs font-medium">{k.key}</TD>
                      <TD className="max-w-[420px] truncate font-mono text-xs text-[var(--color-fg-muted)]">
                        {/* AuthorizationKey is write-only per the security white paper (A01.FR.11). */}
                        {k.key === 'AuthorizationKey' ? (
                          <span className="italic text-[var(--color-fg-subtle)]">write-only</span>
                        ) : (
                          (k.value ?? '—')
                        )}
                      </TD>
                      <TD>
                        {k.readonly ? (
                          <Badge tone="idle">read-only</Badge>
                        ) : (
                          <Badge tone="info">writable</Badge>
                        )}
                      </TD>
                      <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                        {formatRelative(k.updatedAt)}
                      </TD>
                      <TD align="right">
                        {canOperate && !k.readonly ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(k)}
                            disabled={!isOnline}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Засах
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {/* Keyed on the row so each edit starts from that key's own value, with no
          effect needed to reset form state when the selection changes. */}
      <EditKeyModal
        key={editing?.key ?? '__none__'}
        chargePointId={chargePointId}
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

function EditKeyModal({
  chargePointId,
  entry,
  onClose,
  onSaved,
}: {
  chargePointId: string;
  entry: ConfigurationKey | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = React.useState(entry?.value ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    if (!entry) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ status?: string }>(
        `charge-points/${encodeURIComponent(chargePointId)}/change-configuration`,
        { key: entry.key, value },
      );
      if (res.status === 'Rejected' || res.status === 'NotSupported') {
        setError(`Станц ${res.status} гэж хариулав.`);
        setSaving(false);
        return;
      }
      toast.success(
        res.status === 'RebootRequired'
          ? `${entry.key} хүлээн авлаа — станцыг дахин ачаалах шаардлагатай`
          : `${entry.key} шинэчлэгдлээ`,
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title="Тохиргоо өөрчлөх"
      description={entry?.key}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Станц руу илгээх
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Field label="Утга" hint="ChangeConfiguration командаар илгээнэ. Дээд тал нь 500 тэмдэгт.">
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" autoFocus />
        </Field>
      </div>
    </Modal>
  );
}
