import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { getSessionUser } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Middleware already redirects when the cookie is missing; this also covers an
  // expired or malformed token, which middleware deliberately does not inspect.
  if (!user) redirect('/login');

  return <AppShell user={user}>{children}</AppShell>;
}
