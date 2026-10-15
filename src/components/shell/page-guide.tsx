'use client';

import * as React from 'react';
import { HelpCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/primitives';
import { useFirstRunGuide } from './first-run-guide';

export interface GuideStep {
  title: string;
  body: string;
}

const SEEN_PREFIX = 'eplug-admin-guide-seen:';

function hasSeen(topic: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_PREFIX + topic) === '1';
  } catch {
    return true;
  }
}

function markSeen(topic: string): void {
  try {
    window.localStorage.setItem(SEEN_PREFIX + topic, '1');
  } catch {
    // Private mode — it will just show again next visit, which is harmless.
  }
}

/**
 * A small "?" button that opens a step-by-step guide for the page it sits
 * on — auto-opened the first time an admin visits that page, and replayable
 * any time afterward from the same button. One component, one `topic` key
 * per page, so each menu gets its own walkthrough without its own modal.
 */
export function PageGuide({ topic, title, steps }: { topic: string; title: string; steps: GuideStep[] }) {
  // First-visit auto-open waits while the shell's first-run guide is pending
  // or running, then fires as before; the «?» button always opens at once.
  const { suppressPageGuides } = useFirstRunGuide();
  const [autoOpen, setAutoOpen] = React.useState(() => !hasSeen(topic));
  const [manualOpen, setManualOpen] = React.useState(false);
  const open = manualOpen || (autoOpen && !suppressPageGuides);

  function close() {
    markSeen(topic);
    setAutoOpen(false);
    setManualOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setManualOpen(true)}
        data-tour="page-guide"
        aria-label={`${title} — заавар`}
        title="Заавар харах"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      <Modal open={open} onClose={close} title={title} size="sm" footer={<Button variant="primary" onClick={close}>Ойлголоо</Button>}>
        <ol className="space-y-4 px-6 py-5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-fg)]">{s.title}</p>
                <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
