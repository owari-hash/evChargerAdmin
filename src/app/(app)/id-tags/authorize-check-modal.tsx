'use client';

import * as React from 'react';
import useSWR from 'swr';
import { api, errorMessage } from '@/lib/client';
import { Button, CodeBlock, ErrorNote, Field, Input, Spinner } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { AuthStatusBadge } from '@/components/ui/status';
import { formatDateTime, formatJson } from '@/lib/format';

interface CheckResult {
  status?: string;
  expiryDate?: string;
  parentIdTag?: string;
  [key: string]: unknown;
}

/**
 * Dry-runs the backend's authorization logic for one tag without involving a
 * charge point — the quickest way to answer "why was this driver refused?".
 *
 * The check is a POST, so it is driven through SWR with a tuple key instead of
 * an effect: opening the modal fetches, and editing the charge point refetches.
 */
export function AuthorizeCheckModal({
  idTag,
  onClose,
}: {
  idTag: string | null;
  onClose: () => void;
}) {
  const [chargePointId, setChargePointId] = React.useState('');
  const [applied, setApplied] = React.useState('');

  type CheckKey = readonly ['authorize-check', string, string];

  const { data, error, isLoading, isValidating, mutate } = useSWR<CheckResult>(
    idTag ? (['authorize-check', idTag, applied] satisfies CheckKey) : null,
    ([, tag, cpId]: CheckKey) =>
      api.post<CheckResult>(`id-tags/${encodeURIComponent(tag)}/authorize-check`, {
        ...(cpId ? { chargePointId: cpId } : {}),
      }),
    { revalidateOnFocus: false },
  );

  return (
    <Modal
      open={idTag !== null}
      onClose={onClose}
      title="Зөвшөөрлийн шалгалт"
      description={idTag ? `${idTag} картын туршилт` : undefined}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Хаах
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Field
            className="flex-1"
            label="Цэнэглэх станц (заавал бус)"
            hint="Картын зөвшөөрөгдсөн станцын жагсаалтыг хамт шалгах бол оруулна уу."
          >
            <Input
              value={chargePointId}
              onChange={(e) => setChargePointId(e.target.value)}
              placeholder="CP-UB-001"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') setApplied(chargePointId.trim());
              }}
            />
          </Field>
          <Button
            variant="secondary"
            loading={isValidating}
            onClick={() => {
              const next = chargePointId.trim();
              if (next === applied) void mutate();
              else setApplied(next);
            }}
          >
            Дахин шалгах
          </Button>
        </div>

        {error ? <ErrorNote>{errorMessage(error)}</ErrorNote> : null}

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-fg-muted)]">
            <Spinner /> Шалгаж байна…
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5">
              <span className="text-xs text-[var(--color-fg-muted)]">Үр дүн</span>
              <AuthStatusBadge status={data.status ?? 'Invalid'} />
              {data.parentIdTag ? (
                <span className="text-xs text-[var(--color-fg-muted)]">
                  Эцэг карт <span className="font-mono">{data.parentIdTag}</span>
                </span>
              ) : null}
              {data.expiryDate ? (
                <span className="ml-auto text-xs text-[var(--color-fg-muted)]">
                  Дуусах {formatDateTime(data.expiryDate)}
                </span>
              ) : null}
            </div>

            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                Түүхий idTagInfo
              </p>
              <CodeBlock>{formatJson(data)}</CodeBlock>
            </div>

            <p className="text-xs text-[var(--color-fg-subtle)]">
              CSMS нь Authorize.conf хариунд яг үүнийг буцаана.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
