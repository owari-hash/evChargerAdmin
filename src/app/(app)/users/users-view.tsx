'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Building2, CheckSquare, Layers, Pencil, Plus, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { REFRESH } from '@/lib/live-query';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime, formatRelative } from '@/lib/format';
import { USER_ROLES, type Client, type Paginated, type User, type UserRole } from '@/lib/types';
import { Badge, Button, Card, ErrorNote, Field, Input, Select } from '@/components/ui/primitives';
import { RoleBadge } from '@/components/ui/status';
import { ROLE, mn } from '@/lib/mn';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';
import { MANAGEABLE_MENUS } from '@/components/shell/nav-items';

export function UsersView({ currentUserId }: { currentUserId: string }) {
  const { data, error, isLoading, mutate } = useSWR<User[]>(apiUrl('auth/users'), fetcher, {
    refreshInterval: REFRESH.config,
  });
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [deleting, setDeleting] = React.useState<User | null>(null);
  const [busy, setBusy] = React.useState(false);

  const users = data ?? [];

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`auth/users/${encodeURIComponent(deleting.id)}`);
      toast.success(`${deleting.email} устгагдлаа`);
      setDeleting(null);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3.5 sm:px-5 py-2.5 sm:py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">Хэрэглэгчдийн эрх ба цэс удирдлага</h2>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Хэрэглэгч тус бүрийн хандах цэс болон харилцагчийн өгөгдлийн хамрах хүрээг тохируулна.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            Шинэ хэрэглэгч
          </Button>
        </div>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>И-мэйл</TH>
                <TH>Нэр</TH>
                <TH>Эрх</TH>
                <TH>Харилцагч</TH>
                <TH>Зөвшөөрсөн цэсүүд</TH>
                <TH>Төлөв</TH>
                <TH>Сүүлд нэвтэрсэн</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={8} />
              ) : error ? (
                <TableEmpty colSpan={8}>Хэрэглэгчдийг ачаалж чадсангүй.</TableEmpty>
              ) : users.length === 0 ? (
                <TableEmpty colSpan={8}>Хэрэглэгч олдсонгүй.</TableEmpty>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const hasCustomMenus = Array.isArray(user.allowedMenus) && user.allowedMenus.length > 0;
                  const allowedCount = hasCustomMenus ? user.allowedMenus!.length : MANAGEABLE_MENUS.length;

                  return (
                    <TR key={user.id}>
                      <TD className="text-xs font-medium">
                        {user.email}
                        {isSelf ? (
                          <Badge tone="brand" className="ml-2">
                            you
                          </Badge>
                        ) : null}
                      </TD>
                      <TD className="text-xs text-[var(--color-fg-muted)]">{user.name ?? '—'}</TD>
                      <TD>
                        <RoleBadge role={user.role} />
                      </TD>
                      <TD className="text-xs">
                        {user.client ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-fg)]">
                            <Building2 className="h-3.5 w-3.5 text-[var(--color-brand)] shrink-0" />
                            <span className="truncate max-w-[140px]">{user.client.name}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-fg-subtle)]">Бүх сүлжээ</span>
                        )}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {hasCustomMenus ? (
                            <Badge tone="brand" className="font-mono text-[11px]">
                              {allowedCount} цэс
                            </Badge>
                          ) : (
                            <Badge tone="idle" className="text-[11px]">
                              Бүх цэс
                            </Badge>
                          )}
                        </div>
                      </TD>
                      <TD>
                        <Badge tone={user.isActive ? 'ok' : 'idle'}>
                          {user.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                        {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Хэзээ ч үгүй'}
                      </TD>
                      <TD>
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(user)}
                            title="Засах"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleting(user)}
                            title={isSelf ? 'Өөрийн бүртгэлээ устгах боломжгүй' : 'Устгах'}
                            disabled={isSelf}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <p className="mt-3 text-xs text-[var(--color-fg-subtle)]">
        Хэрэглэгчид харилцагч сонгосон үед зөвхөн тухайн харилцагчийн станц, цэнэглэлт, баримт харагдана. Сонгосон цэсүүд системд нэвтрэхэд автоматаар хэрэгжинэ.
      </p>

      <UserModal
        key={creating ? 'create' : (editing?.id ?? 'none')}
        open={creating || editing !== null}
        user={editing}
        isSelf={editing?.id === currentUserId}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => void mutate()}
      />

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        loading={busy}
        title="Хэрэглэгчийг устгах уу?"
        confirmLabel="Устгах"
        message={
          <>
            <span className="font-medium">{deleting?.email}</span> loses access immediately. Any
            token they still hold stops working when it expires.
          </>
        }
      />
    </>
  );
}

function UserModal({
  open,
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: User | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = user !== null;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch clients to allow binding user to a specific organization
  const { data: clientsData } = useSWR<Paginated<Client>>(apiUrl('clients', { limit: 100 }), fetcher);
  const clients = clientsData?.data ?? [];

  const [form, setForm] = React.useState({
    email: user?.email ?? '',
    name: user?.name ?? '',
    role: (user?.role ?? (user?.clientId ? 'CLIENT' : 'VIEWER')) as UserRole,
    clientId: user?.clientId ?? (user?.client ? String(user.client.id) : ''),
    password: '',
    isActive: user?.isActive ?? true,
  });

  const [allowedMenus, setAllowedMenus] = React.useState<string[]>(() => {
    if (user?.allowedMenus && user.allowedMenus.length > 0) {
      return [...user.allowedMenus];
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

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          name: form.name.trim() || undefined,
          role: form.role,
          clientId: form.clientId || null,
          allowedMenus,
          isActive: form.isActive,
        };
        if (form.password) body.password = form.password;
        await api.patch(`auth/users/${encodeURIComponent(user.id)}`, body);
        toast.success(`${user.email} шинэчлэгдлээ`);
      } else {
        await api.post('auth/users', {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || undefined,
          role: form.role,
          clientId: form.clientId || undefined,
          allowedMenus,
        });
        toast.success(`${form.email.trim()} үүслээ`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = isEdit
    ? true
    : form.email.trim().length > 0 && form.password.length >= 8;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Хэрэглэгч засах' : 'Шинэ хэрэглэгч'}
      description={isEdit ? user.email : 'Энэ и-мэйл, нууц үгээр системд нэвтэрч эрх олгогдсон цэсүүдийг удирдана.'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Цуцлах
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
            {isEdit ? 'Хадгалах' : 'Хэрэглэгч үүсгэх'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!isEdit ? (
            <Field label="И-мэйл" className="sm:col-span-2">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                autoFocus
                placeholder="operator@eplug.mn"
              />
            </Field>
          ) : null}

          <Field label="Нэр">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Хэрэглэгчийн нэр"
            />
          </Field>

          <Field
            label="Системийн үндсэн эрх"
            hint={isSelf ? 'Болгоомжтой: өөрийн эрхээ бууруулбал шууд хэрэгжинэ.' : undefined}
          >
            <Select
              value={form.role}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                setForm((f) => ({ ...f, role: newRole }));
              }}
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {mn(ROLE, r)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Client association dropdown */}
        <Field
          label="Харилцагч байгууллага (Client)"
          hint="Хэрэв харилцагч сонговол уг хэрэглэгч зөвхөн тухайн байгууллагын станц, цэнэглэлт, баримт, тайланг харна."
        >
          <Select
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
          >
            <option value="">Бүх сүлжээ (Админ / Бүх станцууд)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.businessRegister ? `(${c.businessRegister})` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={isEdit ? 'Шинэ нууц үг' : 'Нууц үг'}
          hint={isEdit ? 'Хэвээр үлдээхийг хүсвэл хоосон орхино уу. Хамгийн багадаа 8 тэмдэгт.' : 'Хамгийн багадаа 8 тэмдэгт.'}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>

        {/* Menu Access Control with Checkboxes */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2.5">
            <div>
              <div className="text-xs font-semibold text-[var(--color-fg)] flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[var(--color-brand)]" />
                Хандах эрхтэй цэсүүд ({allowedMenus.length} / {MANAGEABLE_MENUS.length})
              </div>
              <p className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5">
                Хэрэглэгчийн харахыг зөвшөөрсөн цэсүүдийг чеклэнэ үү.
              </p>
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
                    className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs transition-colors cursor-pointer select-none ${
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
                    className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs transition-colors cursor-pointer select-none ${
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

        {isEdit ? (
          <label className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)] pt-1">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-brand)]"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              disabled={isSelf}
            />
            Бүртгэл идэвхтэй
            {isSelf ? ' (өөрийн эрхээ хаах боломжгүй)' : ''}
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
