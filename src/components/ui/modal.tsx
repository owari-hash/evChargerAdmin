'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './primitives';

/**
 * Dialog built on the native <dialog> element so focus trapping, Esc handling
 * and the top layer come from the platform rather than a custom focus manager.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  } as const;

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) dismisses.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'w-[calc(100vw-2rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-fg)] shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        'open:animate-in-fade',
        widths[size],
      )}
    >
      {open ? (
        <form method="dialog" onSubmit={(e) => e.preventDefault()}>
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{description}</p>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Хаах">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-3">
              {footer}
            </div>
          ) : null}
        </form>
      ) : null}
    </dialog>
  );
}

/** Confirmation prompt for destructive or irreversible operations. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Батлах',
  tone = 'danger',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Цуцлах
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--color-fg-muted)]">{message}</p>
    </Modal>
  );
}
