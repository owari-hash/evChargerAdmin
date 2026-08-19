'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime, formatRelative } from '@/lib/format';
import { USER_ROLES, type User, type UserRole } from '@/lib/types';
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select } from '@/components/ui/primitives';
import { RoleBadge } from '@/components/ui/status';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { Table, TableWrap, TBody, TD, TH, THead, TR, TableEmpty, TableLoading } from '@/components/ui/table';

export function UsersView({ currentUserId }: { currentUserId: string }) {
  const { data, error, isLoading, mutate } = useSWR<User[]>(apiUrl('auth/users'), fetcher);
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
      toast.success(`${deleting.email} deleted`);
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
      <PageHeader
        title="Users"
        description="Console accounts. Roles are enforced by the CSMS on every request."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void mutate()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              New user
            </Button>
          </>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Email</TH>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>State</TH>
                <TH>Last sign-in</TH>
                <TH align="right">Created</TH>
                <TH align="right" />
              </tr>
            </THead>
            <TBody>
              {isLoading && !data ? (
                <TableLoading colSpan={7} />
              ) : error ? (
                <TableEmpty colSpan={7}>Could not load users.</TableEmpty>
              ) : users.length === 0 ? (
                <TableEmpty colSpan={7}>No users found.</TableEmpty>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUserId;
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
                      <TD>
                        <Badge tone={user.isActive ? 'ok' : 'idle'}>
                          {user.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-[var(--color-fg-muted)]">
                        {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never'}
                      </TD>
                      <TD align="right" className="text-xs text-[var(--color-fg-muted)]">
                        {formatDateTime(user.createdAt)}
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(user)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleting(user)}
                            title={isSelf ? 'You cannot delete your own account' : 'Delete'}
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
        VIEWER reads data · OPERATOR also sends commands and edits data · ADMIN also manages users,
        deletions, key rotation and the CA.
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
        title="Delete user?"
        confirmLabel="Delete"
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

  const [form, setForm] = React.useState({
    email: user?.email ?? '',
    name: user?.name ?? '',
    role: (user?.role ?? 'VIEWER') as UserRole,
    password: '',
    isActive: user?.isActive ?? true,
  });

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          name: form.name.trim() || undefined,
          role: form.role,
          isActive: form.isActive,
        };
        if (form.password) body.password = form.password;
        await api.patch(`auth/users/${encodeURIComponent(user.id)}`, body);
        toast.success(`${user.email} updated`);
      } else {
        await api.post('auth/users', {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || undefined,
          role: form.role,
        });
        toast.success(`${form.email.trim()} created`);
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
      title={isEdit ? 'Edit user' : 'New user'}
      description={isEdit ? user.email : 'They sign in with this email and password.'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {!isEdit ? (
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              autoFocus
              placeholder="operator@eplug.mn"
            />
          </Field>
        ) : null}

        <Field label="Name">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>

        <Field
          label="Role"
          hint={isSelf ? 'Careful: lowering your own role takes effect immediately.' : undefined}
        >
          <Select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={isEdit ? 'New password' : 'Password'}
          hint={isEdit ? 'Leave empty to keep the current password. Minimum 8 characters.' : 'Minimum 8 characters.'}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>

        {isEdit ? (
          <label className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-brand)]"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              disabled={isSelf}
            />
            Account is active
            {isSelf ? ' (you cannot disable your own account here)' : ''}
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
