import { Suspense } from 'react';
import type { Metadata } from 'next';
import { brand } from '@/lib/config';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand)]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="var(--color-brand-fg)" aria-hidden="true">
              <path d="M13.5 2 5 13.2h5.2L9.4 22 19 10.4h-5.4L13.5 2Z" />
            </svg>
          </span>
          <h1 className="text-lg font-semibold tracking-tight">{brand.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Charging network operations console
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <Suspense fallback={<div className="h-52" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--color-fg-subtle)]">
          Authorised personnel only. All actions are logged.
        </p>
      </div>
    </main>
  );
}
