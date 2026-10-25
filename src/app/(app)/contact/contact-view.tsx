'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Download, Facebook, Instagram, Mail, Phone, PhoneCall, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiUrl, errorMessage, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import type { ContactInfo } from '@/lib/types';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Skeleton,
} from '@/components/ui/primitives';

export function ContactView({ canEdit }: { canEdit: boolean }) {
  const key = apiUrl('contact');
  const { data, error, isLoading, mutate } = useSWR<ContactInfo>(key, fetcher);

  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [facebookUrl, setFacebookUrl] = React.useState('');
  const [facebookName, setFacebookName] = React.useState('');
  const [instagramUrl, setInstagramUrl] = React.useState('');
  const [instagramName, setInstagramName] = React.useState('');
  const [logoDownloadUrl, setLogoDownloadUrl] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data) {
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setAddress(data.address || '');
      setFacebookUrl(data.facebookUrl || '');
      setFacebookName(data.facebookName || '');
      setInstagramUrl(data.instagramUrl || '');
      setInstagramName(data.instagramName || '');
      setLogoDownloadUrl(data.logoDownloadUrl || '/eplug-mark.png');
    }
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Утасны дугаар оруулна уу');
      return;
    }
    if (!email.trim()) {
      toast.error('И-мэйл хаяг оруулна уу');
      return;
    }

    setSaving(true);
    try {
      await api.put('contact', {
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        facebookUrl: facebookUrl.trim(),
        facebookName: facebookName.trim(),
        instagramUrl: instagramUrl.trim(),
        instagramName: instagramName.trim(),
        logoDownloadUrl: logoDownloadUrl.trim() || '/eplug-mark.png',
      });
      toast.success('Холбоо барих мэдээлэл амжилттай хадгалагдлаа');
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorNote>{errorMessage(error)}</ErrorNote>;

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: Contact details & Social */}
              <div className="space-y-6">
                <Card>
                  <CardHeader
                    title="Холбоо барих мэдээлэл"
                    description="Вэбсайт болон киоскын хөл хэсэгт (Footer) харагдах холбоо барих утас, и-мэйл."
                  />
                  <CardBody className="space-y-4">
                    <Field label="Холбоо барих утас" hint="Нэг буюу таслалаар тусгаарласан хэд хэдэн дугаар байж болно.">
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+976 7777 4242, 8888 5516"
                        disabled={!canEdit || saving}
                        required
                      />
                    </Field>

                    <Field label="И-мэйл хаяг" hint="Хэрэглэгчийн санал хүсэлт, лавлагаа авах и-мэйл.">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contact@eplug.mn"
                        disabled={!canEdit || saving}
                        required
                      />
                    </Field>

                    <Field label="Хаяг / Байршил (сонголттой)" hint="Компанийн албан ёсны хаяг.">
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Улаанбаатар хот, Хан-Уул дүүрэг..."
                        disabled={!canEdit || saving}
                      />
                    </Field>

                    <Field label="Лого татах холбоос" hint="Хэрэглэгч «Лого татах» товч дарахад татагдах файлын зам.">
                      <Input
                        value={logoDownloadUrl}
                        onChange={(e) => setLogoDownloadUrl(e.target.value)}
                        placeholder="/eplug-mark.png"
                        disabled={!canEdit || saving}
                      />
                    </Field>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Сошиал хаягууд"
                    description="Хэрэглэгчидтэй холбогдох Facebook, Instagram хуудасны тохиргоо."
                  />
                  <CardBody className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Facebook нэр" hint="Харагдах нэр">
                        <Input
                          value={facebookName}
                          onChange={(e) => setFacebookName(e.target.value)}
                          placeholder="Eplug.mn"
                          disabled={!canEdit || saving}
                        />
                      </Field>
                      <Field label="Facebook холбоос (URL)" hint="Бүрэн линк">
                        <Input
                          value={facebookUrl}
                          onChange={(e) => setFacebookUrl(e.target.value)}
                          placeholder="https://facebook.com/eplug.mn"
                          disabled={!canEdit || saving}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Instagram нэр" hint="Харагдах нэр">
                        <Input
                          value={instagramName}
                          onChange={(e) => setInstagramName(e.target.value)}
                          placeholder="Eplug.mn"
                          disabled={!canEdit || saving}
                        />
                      </Field>
                      <Field label="Instagram холбоос (URL)" hint="Бүрэн линк">
                        <Input
                          value={instagramUrl}
                          onChange={(e) => setInstagramUrl(e.target.value)}
                          placeholder="https://instagram.com/eplug.mn"
                          disabled={!canEdit || saving}
                        />
                      </Field>
                    </div>
                  </CardBody>
                </Card>

                {canEdit && (
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-[var(--color-fg-muted)]">
                      {data?.updatedAt ? `Сүүлд шинэчилсэн: ${formatDateTime(data.updatedAt)} (${data.updatedBy ?? '—'})` : ''}
                    </div>
                    <Button type="submit" variant="primary" loading={saving}>
                      <Save className="size-4" />
                      Хадгалах
                    </Button>
                  </div>
                )}
              </div>

              {/* Right Column: Live Footer Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                    Хөл хэсэг (Footer)-т хэрхэн харагдах урьдчилсан харагдац:
                  </h3>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Live Preview
                  </span>
                </div>

                {/* Mock Footer matching kiosk */}
                <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] shadow-sm">
                  <div className="p-5 sm:p-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                      {/* Brand column */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/eplug-mark.png"
                            alt="Logo"
                            className="size-8 rounded-xl object-contain shadow-sm"
                          />
                          <h4 className="text-base font-bold tracking-tight text-[var(--color-fg)]">Eplug</h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--color-fg)]">
                            <Download className="size-3.5 text-[var(--color-fg-muted)]" />
                            Лого татах
                          </span>
                        </div>
                      </div>

                      {/* Social column */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                          Сошиал хаяг
                        </h4>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-right sm:text-left">
                              <p className="text-[11px] font-medium text-[var(--color-fg-muted)]">Facebook</p>
                              <p className="text-xs font-semibold text-[var(--color-fg)]">
                                {facebookName || 'Eplug.mn'}
                              </p>
                            </div>
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-fg-muted)]">
                              <Facebook className="size-3.5" />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-right sm:text-left">
                              <p className="text-[11px] font-medium text-[var(--color-fg-muted)]">Instagram</p>
                              <p className="text-xs font-semibold text-[var(--color-fg)]">
                                {instagramName || 'Eplug.mn'}
                              </p>
                            </div>
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-fg-muted)]">
                              <Instagram className="size-3.5" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact column */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                          Холбоо барих
                        </h4>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-right sm:text-left">
                              <p className="text-[11px] font-medium text-[var(--color-fg-muted)]">Утас</p>
                              <p className="text-xs font-semibold text-[var(--color-fg)]">
                                {phone || '+976 7777 4242, 8888 5516'}
                              </p>
                            </div>
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-fg-muted)]">
                              <Phone className="size-3.5" />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-right sm:text-left">
                              <p className="text-[11px] font-medium text-[var(--color-fg-muted)]">И-мэйл</p>
                              <p className="text-xs font-semibold text-[var(--color-fg)]">
                                {email || 'contact@eplug.mn'}
                              </p>
                            </div>
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-fg-muted)]">
                              <Mail className="size-3.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom bar */}
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-5 py-3 text-xs text-[var(--color-fg-muted)] sm:px-6">
                    <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                      <p>© {new Date().getFullYear()} Eplug. Бүх эрх хуулиар хамгаалагдсан.</p>
                      <div className="flex items-center gap-4">
                        <span>Үйлчилгээний нөхцөл</span>
                        <span>Нууцлалын бодлого</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
