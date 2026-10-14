'use client';

import * as React from 'react';
import { Bell, Building2, CreditCard, LayoutDashboard, Receipt } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/primitives';

const STORAGE_KEY = 'eplug-admin-onboarding-seen';

const STEPS = [
  {
    icon: LayoutDashboard,
    title: 'Тавтай морил',
    body: 'Энэ бол Eplug-ийн удирдлагын консол — станц, харилцагч, карт, цэнэглэлтээ эндээс удирдана.',
  },
  {
    icon: Building2,
    title: 'Станц ба Харилцагч',
    body: 'Цэнэглэх станцууд цэснээс станц бүртгэнэ. Харилцагчид цэснээс байгууллага үүсгэж, станцыг холбоно — нэг станц олон харилцагчид "мөн харагдах" боломжтой.',
  },
  {
    icon: CreditCard,
    title: 'RFID карт ба дотоод гишүүн',
    body: 'RFID карт цэснээс жолоочийн карт удирдана. Харилцагчийн дотоод ажилтнуудад үнэ төлбөргүй цэнэглэх эрх өгөхдөө "Байгууллагын дотоод гишүүний карт" сонголтыг ашиглана.',
  },
  {
    icon: Receipt,
    title: 'Цэнэглэлт ба баримт',
    body: 'Цэнэглэлтүүд цэснээс бүх гүйлгээг хардаг — одоо жолоочийн нэр, машины марк, е-баримтын төлөв хамт харагдана.',
  },
  {
    icon: Bell,
    title: 'Мэдэгдэл',
    body: 'Дээд талын хонхны icon дээр төлбөр ирэх, хэтэвч цэнэглэгдэх/хасагдах мэдэгдлүүд шууд харагдана.',
  },
] as const;

function hasSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Private mode — it will just show again next visit, which is harmless.
  }
}

/** A one-time, five-step walkthrough for a new admin operator. Shown once
 * per browser; replayable later from a help menu if one is added. */
export function AdminOnboardingTour() {
  const [open, setOpen] = React.useState(() => !hasSeen());
  const [step, setStep] = React.useState(0);

  function finish() {
    markSeen();
    setOpen(false);
  }

  const last = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Modal
      open={open}
      onClose={finish}
      title={current.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={finish}>
            Алгасах
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                Буцах
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => (last ? finish() : setStep((s) => s + 1))}>
              {last ? 'Эхлэх' : 'Дараах'}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
          <Icon className="h-7 w-7" />
        </div>
        <p className="text-sm text-[var(--color-fg-muted)]">{current.body}</p>
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-5 bg-[var(--color-brand)]' : 'w-1.5 bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
