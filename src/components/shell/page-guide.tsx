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
 * Step-by-step page guides have been disabled per operator requirements.
 */
export function PageGuide(_props: { topic: string; title: string; steps: GuideStep[] }) {
  return null;
}
