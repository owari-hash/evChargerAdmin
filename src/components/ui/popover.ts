'use client';

import * as React from 'react';

/**
 * Anchored popover plumbing shared by the field popovers (DatePicker and its
 * range variant): fixed positioning next to a trigger, flipping above it when
 * there is no room below, following scroll/resize, and closing on outside
 * pointer-down. Mirrors what Select does internally.
 *
 * Inside a modal <dialog> the panel must be portalled into the dialog: the
 * dialog lives in the browser's top layer, so anything portalled to <body>
 * would paint underneath it and be inert.
 */

export interface PopoverPosition {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export function useAnchoredPopover({
  open,
  onDismiss,
  triggerRef,
  panelRef,
  width,
  height,
}: {
  open: boolean;
  /** Called on outside pointer-down. */
  onDismiss: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  panelRef: React.RefObject<HTMLElement | null>;
  /** Expected panel size, used for flipping and clamping. */
  width: number;
  height: number;
}) {
  const [position, setPosition] = React.useState<PopoverPosition | null>(null);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  const compute = React.useCallback((): PopoverPosition | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const margin = 8;
    const below = vh - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const up = below < height && above > below;
    const left = Math.max(margin, Math.min(rect.left, vw - Math.min(width, vw - margin * 2) - margin));
    return up
      ? { left, bottom: vh - rect.top + gap, maxHeight: Math.max(200, above) }
      : { left, top: rect.bottom + gap, maxHeight: Math.max(200, below) };
  }, [triggerRef, width, height]);

  /** Call from the handler that opens the popover. */
  const place = React.useCallback(() => {
    const trigger = triggerRef.current;
    setContainer((trigger?.closest('dialog') as HTMLElement | null) ?? document.body);
    setPosition(compute());
  }, [compute, triggerRef]);

  React.useEffect(() => {
    if (!open) return;
    const update = () => setPosition(compute());
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, compute]);

  const dismissRef = React.useRef(onDismiss);
  React.useEffect(() => {
    dismissRef.current = onDismiss;
  });

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      dismissRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, triggerRef, panelRef]);

  return { position, container, place };
}

export const POPOVER_PANEL =
  'z-[60] overflow-y-auto scroll-thin rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-fg)] ' +
  'shadow-[0_12px_32px_-8px_rgba(13,31,23,0.22)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7)] animate-in-fade';
