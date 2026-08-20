'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, ErrorNote, Field, Input } from '@/components/ui/primitives';
import { withBasePath } from '@/lib/base-path';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const expired = params.get('expired') === '1';

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(
    expired ? 'Таны нэвтрэлтийн хугацаа дууслаа. Дахин нэвтэрнэ үү.' : null,
  );
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(withBasePath('/console-api/auth/login'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(payload?.error ?? 'Нэвтрэх амжилтгүй боллоо');
        setLoading(false);
        return;
      }

      // Only follow `next` when it is a path on this origin, never an absolute URL.
      // It is basePath-relative; router.replace() adds the prefix back.
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      router.replace(target);
      router.refresh();
    } catch {
      setError('Сервертэй холбогдож чадсангүй. Холболтоо шалгана уу.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Field label="И-мэйл" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="you@eplug.mn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="Нууц үг" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <Button type="submit" variant="primary" className="w-full justify-center" loading={loading}>
        Нэвтрэх
      </Button>
    </form>
  );
}
