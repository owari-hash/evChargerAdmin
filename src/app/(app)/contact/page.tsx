import type { Metadata } from 'next';
import { getSessionUser, hasRole } from '@/lib/session';
import { ContactView } from '@/app/(app)/contact/contact-view';

export const metadata: Metadata = { title: 'Холбоо барих' };
export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const user = await getSessionUser();
  return <ContactView canEdit={hasRole(user, 'OPERATOR')} />;
}
