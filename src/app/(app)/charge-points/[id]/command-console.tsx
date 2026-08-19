'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Play, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/client';
import { formatJson, formatTime } from '@/lib/format';
import {
  buildPayload,
  COMMAND_GROUPS,
  commandsByGroup,
  defaultValues,
  type CommandSpec,
} from '@/lib/commands';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { ConfirmModal } from '@/components/ui/modal';
import { cn } from '@/lib/cn';

interface Result {
  at: Date;
  action: string;
  ok: boolean;
  payload: unknown;
  response: unknown;
}

export function CommandConsole({
  chargePointId,
  isOnline,
  canOperate,
}: {
  chargePointId: string;
  isOnline: boolean;
  canOperate: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<CommandSpec>(commandsByGroup('Core')[0]!);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    defaultValues(commandsByGroup('Core')[0]!),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [results, setResults] = React.useState<Result[]>([]);

  function choose(spec: CommandSpec) {
    setSelected(spec);
    setValues(defaultValues(spec));
    setError(null);
  }

  async function run() {
    setError(null);
    const built = buildPayload(selected, values);
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setSending(true);
    try {
      const response = await api.post<unknown>(
        `charge-points/${encodeURIComponent(chargePointId)}/${selected.slug}`,
        built.body,
      );
      setResults((prev) =>
        [
          { at: new Date(), action: selected.action, ok: true, payload: built.body, response },
          ...prev,
        ].slice(0, 20),
      );
      toast.success(`${selected.label} accepted`);
      // Side effects are persisted server-side, so pull fresh state.
      router.refresh();
    } catch (err) {
      const message = errorMessage(err);
      setResults((prev) =>
        [
          {
            at: new Date(),
            action: selected.action,
            ok: false,
            payload: built.body,
            response: { error: message },
          },
          ...prev,
        ].slice(0, 20),
      );
      toast.error(message);
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  function submit() {
    if (selected.destructive) {
      // Validate before prompting so the operator does not confirm a doomed call.
      const built = buildPayload(selected, values);
      if (!built.ok) {
        setError(built.error);
        return;
      }
      setConfirming(true);
      return;
    }
    void run();
  }

  if (!canOperate) {
    return (
      <Card>
        <CardHeader title="Command console" />
        <div className="p-5 text-sm text-[var(--color-fg-muted)]">
          Sending commands requires the OPERATOR role.
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Command picker */}
      <Card className="h-fit overflow-hidden">
        <CardHeader title="Commands" />
        <div className="max-h-[560px] overflow-y-auto p-2">
          {COMMAND_GROUPS.map((group) => {
            const items = commandsByGroup(group);
            if (!items.length) return null;
            return (
              <div key={group} className="mb-3">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {items.map((spec) => (
                    <li key={spec.slug}>
                      <button
                        type="button"
                        onClick={() => choose(spec)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                          spec.slug === selected.slug
                            ? 'bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]'
                            : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
                        )}
                      >
                        <span className="truncate">{spec.label}</span>
                        {spec.destructive ? (
                          <CircleAlert className="ml-auto h-3 w-3 shrink-0 text-[var(--color-warn)]" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Form + results */}
      <div className="space-y-4">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {selected.label}
                <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-[11px] font-normal text-[var(--color-fg-muted)]">
                  {selected.action}
                </code>
              </span>
            }
            description={selected.description}
            actions={
              <Button variant="primary" size="sm" onClick={submit} loading={sending} disabled={!isOnline}>
                <Play className="h-3.5 w-3.5" />
                Send
              </Button>
            }
          />

          <div className="space-y-4 p-5">
            {!isOnline ? (
              <div className="rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn-soft)] px-3 py-2 text-xs text-[var(--color-warn)]">
                This charge point is offline. Commands can only reach a connected charge point.
              </div>
            ) : null}

            {error ? <ErrorNote>{error}</ErrorNote> : null}

            {selected.fields.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)]">
                This command takes no parameters.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {selected.fields.map((field) => {
                  const wide = field.type === 'json' || field.type === 'textarea';
                  const id = `${selected.slug}-${field.name}`;
                  return (
                    <Field
                      key={field.name}
                      className={wide ? 'sm:col-span-2' : undefined}
                      htmlFor={id}
                      label={
                        <>
                          {field.label}
                          {field.required ? (
                            <span className="ml-1 text-[var(--color-danger)]">*</span>
                          ) : null}
                        </>
                      }
                      hint={field.hint}
                    >
                      {field.type === 'enum' ? (
                        <Select
                          id={id}
                          value={values[field.name] ?? ''}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [field.name]: e.target.value }))
                          }
                        >
                          {!field.required ? <option value="">—</option> : null}
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </Select>
                      ) : wide ? (
                        <Textarea
                          id={id}
                          rows={field.type === 'json' ? 8 : 3}
                          placeholder={field.placeholder}
                          value={values[field.name] ?? ''}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [field.name]: e.target.value }))
                          }
                        />
                      ) : (
                        <Input
                          id={id}
                          type={field.type === 'datetime' ? 'datetime-local' : 'text'}
                          inputMode={field.type === 'number' ? 'numeric' : undefined}
                          placeholder={field.placeholder}
                          value={values[field.name] ?? ''}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [field.name]: e.target.value }))
                          }
                        />
                      )}
                    </Field>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Results"
            description="Newest first. These are the charge point's actual OCPP responses."
            actions={
              results.length ? (
                <Button variant="ghost" size="sm" onClick={() => setResults([])}>
                  Clear
                </Button>
              ) : null
            }
          />
          {results.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <Terminal className="mb-2 h-6 w-6 text-[var(--color-fg-subtle)]" />
              <p className="text-xs text-[var(--color-fg-muted)]">
                Responses from this session appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {results.map((result, i) => (
                <li key={`${result.at.getTime()}-${i}`} className="space-y-2 p-4">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge tone={result.ok ? 'ok' : 'danger'}>{result.ok ? 'OK' : 'Error'}</Badge>
                    <span className="font-mono font-medium">{result.action}</span>
                    <span className="ml-auto text-[var(--color-fg-subtle)]">
                      {formatTime(result.at)}
                    </span>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                        Request
                      </p>
                      <CodeBlock>{formatJson(result.payload)}</CodeBlock>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                        Response
                      </p>
                      <CodeBlock>{formatJson(result.response)}</CodeBlock>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void run()}
        loading={sending}
        title={`Send ${selected.label}?`}
        confirmLabel={`Send ${selected.label}`}
        message={
          <>
            <span className="block">
              This can interrupt charging on{' '}
              <span className="font-mono font-medium">{chargePointId}</span>.
            </span>
            <span className="mt-2 block text-xs">{selected.description}</span>
          </>
        }
      />
    </div>
  );
}
