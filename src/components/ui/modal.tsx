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
        // `m-auto` is what centres the dialog: the browser's own stylesheet
        // centres a modal <dialog> with `margin: auto`, and Tailwind's preflight
        // resets every element to `margin: 0`, which was pinning it top-left.
        'm-auto w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-fg)] shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        'open:animate-in-fade',
        widths[size],
      )}
    >
      {open ? (
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 sm:px-6 py-3 sm:py-4">
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

          <div className="max-h-[min(80vh,760px)] overflow-y-auto px-4 sm:px-6 py-3.5 sm:py-5 pb-6 sm:pb-7">{children}</div>

          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 sm:px-6 py-3 sm:py-3.5">
              {footer}
            </div>
          ) : null}
        </div>
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
