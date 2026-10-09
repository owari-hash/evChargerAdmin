import Image from 'next/image';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { brand } from '@/lib/config';
import { withBasePath } from '@/lib/base-path';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Нэвтрэх' };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--color-bg)] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgb(31_138_86/0.16),transparent_70%)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src={withBasePath('/eplug-mark.png')}
            alt=""
            aria-hidden
            width={64}
            height={64}
            priority
            className="mb-5 size-16 rounded-[18px] object-contain shadow-[0_10px_30px_-10px_rgb(31_138_86/0.6)] ring-1 ring-black/5 dark:ring-white/10"
          />
          {/* Mirrors the printed lockup: hairline rules either side of a wide-set wordmark. */}
          <div className="flex items-center gap-3 text-[var(--color-fg)]" aria-hidden>
            <span className="h-px w-6 bg-[var(--color-brand)]" />
            <span className="pl-[0.4em] text-sm font-light uppercase tracking-[0.4em]">eplug</span>
            <span className="h-px w-6 bg-[var(--color-brand)]" />
          </div>
          <h1 className="sr-only">{brand.name}</h1>
          <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
            Цэнэглэх сүлжээний удирдлагын самбар
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-lg">
          <Suspense fallback={<div className="h-52" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--color-fg-subtle)]">
          Зөвшөөрөгдсөн ажилтнууд нэвтэрнэ. Бүх үйлдэл бүртгэгдэнэ.
        </p>
      </div>
    </main>
  );
}
