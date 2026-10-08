import Image from 'next/image';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { brand } from '@/lib/config';
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
            src="/eplug-mark.png"
            alt=""
            aria-hidden
            width={56}
            height={56}
            priority
            className="mb-4 size-14 rounded-2xl shadow-[0_8px_24px_-8px_rgb(31_138_86/0.45)]"
          />
          <h1 className="text-lg font-semibold tracking-tight">{brand.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
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
